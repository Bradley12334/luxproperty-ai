/**
 * api/brief.js — Vercel serverless function (Phase 2a)
 * ─────────────────────────────────────────────────────────────────────────────
 * The single, consolidated entry point for brief generation.
 *
 *   GET /api/brief?postcode=E8+1NG
 *     → 200 { ok: true, meta, sections }        payload built (some sections may
 *                                               themselves be UNAVAILABLE/SPARSE)
 *     → 4xx { ok: false, error: { code, message } }   resolve-altitude failure:
 *                                               invalid postcode / Scotland-NI /
 *                                               validation-guard mismatch
 *     → 502 { ok: false, error }                unexpected server failure
 *
 * FUNCTION BUDGET: Vercel Hobby caps a deployment at 12 Serverless Functions.
 * api/ was at 11; this is the 12th and last. Delivery is therefore SYNCHRONOUS —
 * there is deliberately no separate status/poll function. The ~16-49s SPARQL scan
 * is covered on the client by the reused stepping loader; repeat generations of a
 * district are near-instant via the two-layer cache (in-process L1 + durable
 * Supabase L2, so warmth survives cold serverless instances); and generate() runs
 * the fetch under a 56s abort budget so a slow upstream yields a RETRYABLE
 * UNAVAILABLE price section (meta.dataError.retryable) that the page auto-retries,
 * rather than a Vercel 504. maxDuration is raised to 60 (config below).
 *
 * Phase 2a does not read the account plan — the entitlement stub treats every
 * request as INV (unlock-all). Auth-linked plan lookup arrives with gating.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { generate } from "../lib/brief/generate.js";
import { isBriefError } from "../lib/brief/errors.js";
import { resolveAccountTier } from "../lib/brief/account.js";
import { monthKey, countGenerations, recordGeneration, quotaStatus } from "../lib/brief/quota.js";
import { verifySessionToken, bearerFromHeader } from "../lib/auth/session-token.js";
import { ownsFullBrief, outcodeOf } from "../lib/brief/ownership.js";
import { readAnonState, buildAnonCookie } from "../lib/auth/anon-cookie.js";
import { bumpAndCheckIp } from "../lib/brief/anon-limit.js";
import { isEmailVerified } from "../lib/brief/verification.js";

// Raise the function ceiling to the Hobby maximum so a cold ~20-30s generation
// completes. generate()'s own 50s budget still fires first on a slow upstream.
export const config = { maxDuration: 60 };

// The ONE postcode for which ?preview=1 is honoured — the pricing page's hardcoded
// RealProductShowcase demo (client/src/pages/pricing.tsx → SHOWCASE_POSTCODE "E8 1NG"),
// stored normalised (uppercase, no spaces). preview=1 on any other postcode is ignored, so
// it cannot be used as a general soft-gate bypass. Even here it only skips the soft gate,
// never the per-IP hard cap. Keep in sync with the client constant.
const DEMO_PREVIEW_POSTCODE = "E81NG";

/** Map a typed BriefError code to an HTTP status. */
const STATUS_BY_CODE = {
  INVALID_POSTCODE: 400,
  BAD_INPUT: 400,
  UNSUPPORTED_NATION: 422,
  VALIDATION_GUARD_FAILED: 422,
  UPSTREAM_ERROR: 502,
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
  }

  const postcode = String(req.query.postcode || "").trim();
  if (!postcode) {
    return res.status(400).json({
      ok: false,
      error: { code: "INVALID_POSTCODE", message: "A postcode query parameter is required." },
    });
  }

  // ── Server-verified identity ────────────────────────────────────────────────
  // Identity comes ONLY from a valid HMAC session token in the Authorization header
  // (minted at sign-in AFTER password verification). The verified `sub` is the userId;
  // a client-supplied ?userId= is IGNORED — it is no longer part of the contract, so a
  // stolen or forged UUID grants nothing. No/invalid/expired token → anonymous Explorer,
  // exactly as a logged-out visitor (product behaviour, not a hole). resolveAccountTier
  // still only READS users.plan — auth/plan/billing are untouched.
  const session = verifySessionToken(bearerFromHeader(req.headers.authorization));
  const account = await resolveAccountTier(session?.sub);

  // ── Verified-email gate (signed-in accounts only) ───────────────────────────
  // A signed-in account must confirm its email before generating briefs — reusing the
  // existing flow (api/auth-email.js sends the email at sign-up; /verify-email flips the
  // column; resend-verification re-sends). Unverified → a clean `verifyEmailRequired` 200
  // (the client shows a "confirm your email to continue" state with a resend button), NOT
  // a 4xx. Anonymous visitors have no email and are handled by the soft gate below. Reads
  // users.email_verified via isEmailVerified() — a SEPARATE read; resolveAccountTier
  // (accountTier) is untouched. Fail-open: a DB blip / pre-migration schema → allowed.
  if (account.userId && !(await isEmailVerified(account.userId))) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, verifyEmailRequired: true });
  }

  // ── Full Brief ownership (the £149 one-off) ───────────────────────────────
  // If this account OWNS the Full Brief for the requested district, it is served at
  // INVESTOR depth regardless of plan, and the generation NEVER consumes free quota
  // (owned regen is free forever). Ownership is keyed by outcode, derived here without
  // a network call (outcodeOf) so it agrees with the meta.outcode the brief will carry.
  // Owning ONE postcode does not affect any OTHER postcode — those still gate by plan.
  const requestedOutcode = outcodeOf(postcode);
  const owned = account.userId ? await ownsFullBrief(account.userId, requestedOutcode) : false;
  const effectiveTier = owned ? "INV" : account.tier;

  // ── Anonymous soft gate (product funnel) ────────────────────────────────────
  // ONE free brief per anonymous visitor, tracked by a signed HttpOnly cookie. A second
  // brief for a DIFFERENT postcode returns a clean `signupRequired` 200 (the sign-up
  // prompt). Re-viewing the SAME postcode is not re-gated — it's their brief, and this
  // also lets the client's slow-Land-Registry retry re-fetch the same postcode. Skipped
  // for claimed crawlers and the pricing demo (both UA/query-based — they must NOT be
  // trusted to skip the per-IP hard cap below, only this soft gate). Signed-in accounts
  // are metered by the monthly quota, not this cookie.
  const isAnon = !account.userId;
  const internalWarm = isInternalWarm(req);
  let anonSetCookie = null;
  if (isAnon && !internalWarm) {
    const ua = req.headers["user-agent"];
    const softGateBypass = isCrawler(ua) || isDemoPreview(req, postcode);
    if (!softGateBypass) {
      const anon = readAnonState(req);
      const sameArea = anon.postcode && normPostcode(anon.postcode) === normPostcode(postcode);
      if (anon.used >= 1 && !sameArea) {
        // Second area for a returning anonymous visitor → the sign-up prompt.
        // Encouraging, not punitive (client composes the copy) — a clean 200, not a 4xx.
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({
          ok: true,
          signupRequired: true,
          requested: { postcode, outcode: requestedOutcode },
        });
      }
      // First-ever free brief → remember it (count + postcode for carry-over on sign-up).
      // Same-area re-view keeps the existing cookie untouched.
      if (anon.used < 1) anonSetCookie = buildAnonCookie({ used: 1, postcode });
    }
  }

  // ── Quota (server-enforced, calendar-month, per signed-in account) ──────────
  // Anonymous → no quota (unlimited Explorer sections; funnel nudges sign-in).
  // Counted BEFORE generation so an over-quota request does no work; a warm/cached
  // district still consumes quota because the count is on generations, not fetches.
  const now = new Date();
  const month = monthKey(now);
  const used = account.userId ? await countGenerations(account.userId, month) : 0;
  const quota = quotaStatus(account.tier, used, month, now, account.authenticated);

  // Owned districts are EXEMPT from the quota wall — a paid, permanently-owned brief is
  // never blocked by the free monthly limit, even when the account is otherwise at 0 left.
  // (The wall COPY and the 3→2 limit change are Step 5's propose-gate — untouched here.)
  if (!owned && quota.exceeded) {
    // Clean, non-error over-quota response — NOT a 4xx, NOT a bypass. The client
    // (OverQuotaScreen) composes the wall copy — single source of truth — from this
    // contextual data. `requested.outcode` is non-empty for a plausible postcode and
    // drives the "full {PC} brief — £149" variant; empty (garbage input) → the
    // generic "any postcode" variant so the buy button never targets nothing.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      quotaExceeded: true,
      quota,
      requested: { postcode, outcode: requestedOutcode },
    });
  }

  // ── Per-IP hard cap (anti-abuse, NOT a product limit) ───────────────────────
  // Counts EVERY free-tier generation — anonymous OR authenticated Explorer — against the
  // SAME hashed-IP record, so account-farming behind one IP can't multiply the free
  // allowance. `effectiveTier === "EXP"` is exactly "free tier, non-owner": it is EXP for
  // anonymous and for authenticated Explorer, but INV when this district is OWNED (the
  // owner override above) and PRO/INV for paid plans — so Full Brief owners, Investor
  // subscribers and Professional subscribers are all EXEMPT (ownsFullBrief and accountTier
  // are READ to derive effectiveTier, never modified). Internal warming is exempt via
  // BRIEF_WARM_SECRET. Runs AFTER the quota wall so a walled request isn't counted; fails
  // open (a counter blip never walls a legitimate visitor). Well above normal use.
  if (effectiveTier === "EXP" && !internalWarm) {
    const cap = await bumpAndCheckIp(req);
    if (cap.blocked) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(429).json({
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message:
            "You’ve generated a lot of briefs from this network today. Please try again tomorrow" +
            (account.userId ? "." : ", or create a free account to keep going."),
        },
      });
    }
  }

  try {
    // skipOverpass=1 is a cache-WARMING flag: build everything EXCEPT the Overpass
    // sources (which organic traffic fills), so a warm run never hits the rate-limited
    // Overpass endpoint. Benign if a user passes it — they just get an Overpass-less brief.
    const skipOverpass = req.query.skipOverpass === "1";
    const payload = await generate(postcode, { tier: effectiveTier, skipOverpass });
    // Payload built, tier-filtered at generation. The transaction set is cached
    // (24h) but the tier-filtered payload is not — always recomputed against the
    // current entitlement config and the caller's effective tier (INV if owned).

    // Record the generation (best-effort; never throws). Only signed-in accounts get a
    // ledger row — AND owned districts are never recorded, so regenerating a purchased
    // Full Brief never counts against the free quota. Anonymous leaves no trace either.
    let recordedUsed = used;
    if (account.userId && !owned) {
      const recorded = await recordGeneration(account.userId, month, payload?.meta?.outcode || "");
      if (recorded) recordedUsed = used + 1;
    }

    res.setHeader("Cache-Control", "no-store");
    // Anonymous first free brief → set the signed soft-gate cookie (marks it used and
    // remembers the postcode for carry-over on sign-up). Null for signed-in, crawler,
    // warming, preview, or same-area re-views.
    if (anonSetCookie) res.setHeader("Set-Cookie", anonSetCookie);
    return res.status(200).json({
      ok: true,
      ...payload,
      // True when this district is a permanently-owned Full Brief (drives the client's
      // "you own this — unlimited free regenerations" affordance instead of a quota line).
      fullBriefOwned: owned,
      // Post-generation quota snapshot for the funnel ("1 of 2 used", "sign in to track").
      quota: quotaStatus(account.tier, recordedUsed, month, now, account.authenticated),
    });
  } catch (err) {
    if (isBriefError(err)) {
      const status = STATUS_BY_CODE[err.code] ?? 400;
      // err.meta is internal-only; never leak it to the client.
      return res.status(status).json({ ok: false, error: { code: err.code, message: err.message } });
    }
    console.error("[api/brief] unexpected error:", err);
    return res.status(502).json({
      ok: false,
      error: { code: "UPSTREAM_ERROR", message: "Brief generation failed unexpectedly. Please try again." },
    });
  }
}

/** Normalised postcode key for same-area comparison: uppercase, no whitespace. */
export function normPostcode(pc) {
  return String(pc || "").toUpperCase().replace(/\s+/g, "");
}

/**
 * Search-engine and link-preview crawlers, which must not be shown the sign-up wall — so a
 * claimed crawler bypasses the SOFT gate only (it sees exactly what a first-time human sees,
 * a full Explorer brief, keeping every /brief page crawlable; identical content, so not
 * cloaking). It is NOT trusted to skip the per-IP hard cap: a User-Agent is trivially
 * spoofed, so the cap — the real anti-abuse control — must apply regardless of UA. Real
 * Googlebot crawls from many IPs and won't approach 10/IP/day.
 */
export function isCrawler(ua) {
  const s = typeof ua === "string" ? ua : "";
  if (!s) return false;
  return /bot|crawl|spider|slurp|googlebot|bingbot|applebot|yandex|duckduckbot|baiduspider|facebookexternalhit|embedly|slackbot|whatsapp|telegrambot|discordbot|pinterest|google-inspectiontool|googleother|adsbot-google|mediapartners-google|storebot-google/i.test(s);
}

/**
 * The pricing page's background demo fetch (RealProductShowcase) passes ?preview=1 so it
 * doesn't spend a visitor's one free brief. Honoured ONLY for the single hardcoded demo
 * postcode — preview=1 on any other postcode is ignored (so it can't be appended to farm
 * briefs), and even here it skips the soft gate only, never the per-IP hard cap.
 */
export function isDemoPreview(req, postcode) {
  return req.query.preview === "1" && normPostcode(postcode) === DEMO_PREVIEW_POSTCODE;
}

/**
 * Internal cache-warming (scripts/warm-districts.mjs) hits many districts from one IP and
 * must bypass BOTH gates. Authenticated by a shared secret in the `x-brief-warm` header,
 * matched against BRIEF_WARM_SECRET. Absent/empty env → no request can claim the bypass
 * (so this is inert, and safe, on any deployment where the env isn't provisioned).
 */
export function isInternalWarm(req) {
  const secret = process.env.BRIEF_WARM_SECRET;
  if (typeof secret !== "string" || secret.length < 8) return false;
  const provided = req.headers["x-brief-warm"];
  const value = Array.isArray(provided) ? provided[0] : provided;
  return typeof value === "string" && value === secret;
}
