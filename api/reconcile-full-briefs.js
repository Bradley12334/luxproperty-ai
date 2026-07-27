/**
 * api/reconcile-full-briefs.js — Vercel serverless function (HIGH ledger: webhook reconciliation)
 * ─────────────────────────────────────────────────────────────────────────────
 * SAFETY NET for the money path. If a checkout.session.completed webhook is ever missed
 * (delivery failure, downtime, endpoint misconfig — all of which we have seen), a buyer
 * must NEVER be left having paid £14.99 with no grant. This endpoint finds paid Full Brief
 * Checkout Sessions that have NO brief_purchases row and grants them, reusing grantFullBrief
 * UNCHANGED. It is purely additive: it does not alter the webhook, checkout, or entitlement.
 *
 * WHY SESSIONS, NOT PaymentIntents: every Full Brief payment originates from a Checkout
 * Session (create-checkout mints sessions only). The Session carries the SAME fields the
 * webhook consumes — including the buyer's typed full postcode (the PI metadata omits it) —
 * and its id IS the webhook's idempotency key (brief_purchases.stripe_session_id). Keying on
 * the session id means the webhook and this job can never double-grant the same purchase:
 * the unique constraint serialises them, and grantFullBrief treats 23505 as success.
 *   ⚠️ Keying on pi.id instead would DOUBLE-GRANT (webhook writes cs_…, job writes pi_…).
 *
 * IDEMPOTENT: safe to run repeatedly, concurrently, and interleaved with a late webhook —
 * all converge to exactly one row per purchase.
 *
 * TRIGGER: manual, secret-guarded. DRY-RUN by default (reports the gap, grants nothing);
 * ?apply=1 opts in to granting. NOT on any live-request hot path. Cron may call it later.
 *
 * FAIL CLOSED on the guard: no RECONCILE_SECRET configured → 503 (never runs unguarded);
 * wrong/absent bearer → 401.
 *
 * MODE SAFETY: the caller must declare ?mode=test|live and it must match the Stripe secret
 * key's own mode (sk_test_ / sk_live_). This forces intent and blocks the catastrophic
 * "thought I was in test" run against the wrong Stripe/Supabase pairing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { grantFullBrief } from "../lib/brief/ownership.js";
import { sessionIsFullBrief, fullBriefGrantArgsFromSession } from "../lib/stripe/full-brief.js";

// Cap the scan so a misconfiguration can never spin forever. Full Brief volume is low; if we
// ever hit this we log a truncation warning rather than silently claiming full coverage.
const MAX_SESSIONS_SCANNED = 20000;

/** Constant-time string compare (avoids leaking the secret via timing). */
function secretEquals(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** "live" | "test" | "unknown" from the Stripe secret key prefix. */
function stripeKeyMode(key) {
  if (/^sk_live_|^rk_live_/.test(key)) return "live";
  if (/^sk_test_|^rk_test_/.test(key)) return "test";
  return "unknown";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
  }

  // ── Guard (fail closed) ─────────────────────────────────────────────────────
  const secret = process.env.RECONCILE_SECRET;
  if (!secret || !String(secret).trim()) {
    console.error("[reconcile] RECONCILE_SECRET not configured — refusing to run (fail closed).");
    return res.status(503).json({ error: "Reconciliation is not configured.", code: "NOT_CONFIGURED" });
  }
  const authz = String(req.headers.authorization || "");
  const bearer = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!secretEquals(bearer, secret)) {
    return res.status(401).json({ error: "Unauthorized.", code: "UNAUTHORIZED" });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(503).json({ error: "Stripe key missing.", code: "NOT_CONFIGURED" });
  }
  const keyMode = stripeKeyMode(stripeKey);

  // ── Mode-safety assert: caller must declare the mode, and it must match the key ─
  const declaredMode = String(req.query?.mode || "").toLowerCase().trim();
  if (declaredMode !== "test" && declaredMode !== "live") {
    return res.status(400).json({
      error: "Declare ?mode=test or ?mode=live (must match the Stripe key). Refusing to guess.",
      code: "MODE_REQUIRED",
    });
  }
  if (declaredMode !== keyMode) {
    console.error(`[reconcile] MODE MISMATCH — declared '${declaredMode}' but Stripe key is '${keyMode}'. Refusing.`);
    return res.status(409).json({
      error: `Declared mode '${declaredMode}' does not match the Stripe key mode '${keyMode}'.`,
      code: "MODE_MISMATCH",
    });
  }

  const apply = String(req.query?.apply || "") === "1";
  // Optional lookback bound. Default: scan all complete sessions (never miss an old purchase).
  const days = Number.parseInt(String(req.query?.days || ""), 10);
  const createdGte = Number.isFinite(days) && days > 0
    ? Math.floor((Date.now() - days * 86400_000) / 1000)
    : null;

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const supabaseHost = (() => { try { return new URL(process.env.SUPABASE_URL).host; } catch { return "(unknown)"; } })();

  console.log(
    `[reconcile] start — mode=${keyMode} apply=${apply} ` +
    `lookback=${createdGte ? `${days}d` : "all"} supabase=${supabaseHost}`
  );

  // ── 1. Enumerate paid Full Brief Checkout Sessions (paginated, full) ──────────
  // Server-side filter to status=complete; the rest (payment mode, paid, kind) is client-side.
  const candidates = []; // { sessionId, args }
  let scanned = 0;
  let truncated = false;
  try {
    const listParams = { limit: 100, status: "complete" };
    if (createdGte) listParams.created = { gte: createdGte };
    for await (const session of stripe.checkout.sessions.list(listParams)) {
      scanned += 1;
      if (scanned > MAX_SESSIONS_SCANNED) { truncated = true; break; }
      if (session.mode !== "payment") continue;
      if (session.payment_status !== "paid") continue;      // money actually captured
      if (!sessionIsFullBrief(session, null)) continue;      // metadata.kind === "full_brief"
      const args = fullBriefGrantArgsFromSession(session);
      if (!args.userId || !args.outcode || !args.stripeSessionId) {
        // Paid Full Brief we cannot tie to an account/district — surface, don't grant.
        console.error(
          "[reconcile] UNRESOLVABLE paid Full Brief session:", session.id,
          "| userId:", args.userId, "| outcode:", args.outcode || "(none)"
        );
        continue;
      }
      candidates.push({ sessionId: session.id, args });
    }
  } catch (err) {
    console.error("[reconcile] session enumeration failed:", err?.message || err);
    return res.status(502).json({ error: "Could not enumerate Stripe sessions.", code: "STRIPE_ERROR" });
  }
  if (truncated) {
    console.error(`[reconcile] TRUNCATED at ${MAX_SESSIONS_SCANNED} sessions — coverage incomplete; narrow with ?days=N.`);
  }

  // ── 2. Which candidates already have a brief_purchases row? (the gap = the rest) ─
  const candidateIds = candidates.map((c) => c.sessionId);
  const existing = new Set();
  try {
    for (let i = 0; i < candidateIds.length; i += 200) {
      const chunk = candidateIds.slice(i, i + 200);
      if (!chunk.length) continue;
      const { data, error } = await supabase
        .from("brief_purchases")
        .select("stripe_session_id")
        .in("stripe_session_id", chunk);
      if (error) throw new Error(error.message);
      for (const row of data || []) existing.add(row.stripe_session_id);
    }
  } catch (err) {
    console.error("[reconcile] brief_purchases lookup failed:", err?.message || err);
    return res.status(500).json({ error: "Could not read existing purchases.", code: "DB_ERROR" });
  }

  const gap = candidates.filter((c) => !existing.has(c.sessionId));

  // ── 3. Report (dry-run) or grant (apply). grantFullBrief is idempotent regardless. ─
  const report = {
    mode: keyMode,
    dryRun: !apply,
    supabase: supabaseHost,
    scanned,
    truncated,
    fullBriefPaidSessions: candidates.length,
    alreadyGranted: candidates.length - gap.length,
    gapCount: gap.length,
    gap: gap.map((c) => ({
      sessionId: c.sessionId,
      userId: c.args.userId,
      outcode: c.args.outcode,
      postcode: c.args.postcode,
    })),
    granted: [],
    errors: [],
  };

  if (apply) {
    for (const c of gap) {
      try {
        const { duplicate } = await grantFullBrief(c.args); // idempotent on stripe_session_id
        report.granted.push({
          sessionId: c.sessionId,
          userId: c.args.userId,
          outcode: c.args.outcode,
          postcode: c.args.postcode,
          duplicate, // true => a late webhook / concurrent run beat us here (still exactly one row)
        });
        console.log(
          `[reconcile] granted ${c.args.userId} → ${c.args.outcode} ` +
          `(${duplicate ? "already existed — idempotent" : "new"}), session ${c.sessionId}`
        );
      } catch (err) {
        report.errors.push({ sessionId: c.sessionId, error: err?.message || String(err) });
        console.error("[reconcile] grant failed for session", c.sessionId, "-", err?.message || err);
      }
    }
  }

  console.log(
    `[reconcile] done — scanned=${scanned} paid=${candidates.length} ` +
    `already=${report.alreadyGranted} gap=${gap.length} ` +
    `${apply ? `granted=${report.granted.length} errors=${report.errors.length}` : "(dry-run)"}`
  );

  const status = report.errors.length ? 207 : 200;
  return res.status(status).json({ ok: report.errors.length === 0, report });
}
