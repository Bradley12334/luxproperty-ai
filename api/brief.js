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

// Raise the function ceiling to the Hobby maximum so a cold ~20-30s generation
// completes. generate()'s own 50s budget still fires first on a slow upstream.
export const config = { maxDuration: 60 };

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

  // Resolve the account's REAL tier from the client-supplied userId (the existing
  // product mechanism; anonymous → EXP). This does NOT modify auth/plan/billing — it
  // only READS users.plan. See lib/brief/account.js.
  const account = await resolveAccountTier(req.query.userId);

  try {
    const payload = await generate(postcode, { tier: account.tier });
    // Payload built, tier-filtered at generation. The transaction set is cached
    // (24h) but the tier-filtered payload is not — always recomputed against the
    // current entitlement config and the caller's plan.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, ...payload });
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
