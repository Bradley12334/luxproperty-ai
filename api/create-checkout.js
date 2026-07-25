/**
 * api/create-checkout.js — Vercel serverless function (pricing restructure, Step 2)
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/create-checkout   body: { postcode }
 * Auth: Authorization: Bearer <session token>   (server-verified; NO client userId)
 *
 * Mints a PAYMENT-MODE Stripe Checkout Session for the £14.99 one-off Full Brief on a
 * specific postcode's district (outcode). Unlike the static Payment Links used for the
 * subscriptions, a server-created session lets us embed:
 *   - client_reference_id = the VERIFIED userId (the webhook grants this exact account)
 *   - metadata.outcode    = the district being bought (the webhook reads it from here)
 *
 * GATES (fail closed):
 *   1. Signed in — a valid session token, else 401. (The client also gates this, but
 *      the server is the real boundary — an anonymous "buy" must route through sign-in.)
 *   2. Real, supported postcode — resolve() rejects invalid / Scotland-NI / guard-fail,
 *      so we never sell a Full Brief for a postcode that cannot generate one.
 *   3. Not already owned — repeat-purchase of an owned outcode is blocked here (409),
 *      per the approved plan; the button also flips to "open it" client-side.
 *
 * This function NEVER writes entitlements — the webhook does, only after Stripe confirms
 * payment. It also never touches users.plan.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "../lib/brief/resolve.js";
import { isBriefError } from "../lib/brief/errors.js";
import { verifySessionToken, bearerFromHeader } from "../lib/auth/session-token.js";
import { ownsFullBrief } from "../lib/brief/ownership.js";
import { fullBriefPriceId } from "../lib/stripe/full-brief.js";

// Only ever send the buyer back to our own site (mirrors billing-portal.js).
const ALLOWED_RETURN_HOSTS = /(^|\.)luxproperty\.ai$|\.vercel\.app$/;

function resolveOrigin(req) {
  const fallback = "https://www.luxproperty.ai";
  const origin = req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : "");
  try {
    const url = new URL(origin);
    if (!ALLOWED_RETURN_HOSTS.test(url.hostname)) return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
  }

  // ── Gate 1: server-verified identity ───────────────────────────────────────
  const session = verifySessionToken(bearerFromHeader(req.headers.authorization));
  const userId = session?.sub || null;
  if (!userId) {
    return res.status(401).json({
      error: "Please sign in to buy the Full Brief.",
      code: "SIGN_IN_REQUIRED",
    });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const postcode = String(body.postcode || "").trim();
  if (!postcode) {
    return res.status(400).json({ error: "A postcode is required.", code: "BAD_REQUEST" });
  }

  // ── Gate 2: real, supported postcode → canonical outcode ───────────────────
  // resolve() is the SAME resolver the brief uses, so the outcode stored on the session
  // is byte-identical to the meta.outcode the generated brief will carry.
  let location;
  try {
    location = await resolve(postcode);
  } catch (err) {
    if (isBriefError(err)) {
      // Invalid / Scotland-NI / validation-guard — a postcode we cannot sell a brief for.
      return res.status(400).json({ error: err.message, code: err.code });
    }
    console.error("[create-checkout] resolve failed:", err?.message || err);
    return res.status(502).json({ error: "Could not verify that postcode. Please try again.", code: "RESOLVE_ERROR" });
  }
  const outcode = location.outcode;

  // ── Gate 3: block repeat-purchase of an owned outcode ──────────────────────
  if (await ownsFullBrief(userId, outcode)) {
    return res.status(409).json({
      error: `You already own the Full Brief for ${outcode}. Open it from your library any time — no need to buy again.`,
      code: "ALREADY_OWNED",
      outcode,
    });
  }

  // ── Look up the account (existence check + email prefill) ───────────────────
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();
  if (userErr) {
    console.error("[create-checkout] user lookup failed:", userErr.message);
    return res.status(500).json({ error: "Could not start checkout. Please try again.", code: "DB_ERROR" });
  }
  if (!user) {
    // Token verified but the account is gone — treat as signed-out.
    return res.status(401).json({ error: "Please sign in again.", code: "SIGN_IN_REQUIRED" });
  }

  // ── Mint the payment-mode Checkout Session ─────────────────────────────────
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });
  const origin = resolveOrigin(req);

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: fullBriefPriceId(), quantity: 1 }],
      client_reference_id: userId,
      customer_email: user.email || undefined,
      // The webhook reads outcode from here; kind is a belt-and-braces Full Brief marker.
      metadata: { kind: "full_brief", outcode, postcode: location.postcode, userId },
      payment_intent_data: { metadata: { kind: "full_brief", outcode, userId } },
      success_url: `${origin}/success?fullbrief=${encodeURIComponent(outcode)}`,
      cancel_url: `${origin}/pricing`,
    });

    if (!checkout?.url) {
      console.error("[create-checkout] Stripe returned no URL for session", checkout?.id);
      return res.status(502).json({ error: "Could not start checkout. Please try again.", code: "STRIPE_ERROR" });
    }
    return res.status(200).json({ url: checkout.url });
  } catch (err) {
    // A "No such price" here almost always means STRIPE_PRICE_FULLBRIEF is unset/wrong
    // for THIS Stripe mode (e.g. live default against a test key on preview).
    const message = String(err?.message || "");
    if (/no such price/i.test(message)) {
      console.error("[create-checkout] STRIPE_PRICE_FULLBRIEF misconfigured for this mode:", message);
      return res.status(503).json({
        error: "Checkout is temporarily unavailable. Please try again shortly.",
        code: "PRICE_MISCONFIGURED",
      });
    }
    console.error("[create-checkout] checkout.sessions.create failed:", message);
    return res.status(502).json({ error: "Could not start checkout. Please try again.", code: "STRIPE_ERROR" });
  }
}
