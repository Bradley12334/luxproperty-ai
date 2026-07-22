/**
 * lib/brief/broadband.js
 * ─────────────────────────────────────────────────────────────────────────────
 * BROADBAND ADAPTER (PRO) — reuses the consolidated Ofcom source in
 * lib/sources/broadband.js WITHOUT modifying it. That module is a shared handler
 * (also serving /api/broadband); the brief may CALL shared code but never change it
 * (BRIEF_SPEC → Scope boundary). So we invoke its handler with a tiny response-
 * capture shim and read the JSON it would have sent.
 *
 * TRUE GRANULARITY (labelled honestly downstream): the Ofcom source is a STATIC
 * local-authority-level table from the Connected Nations 2024 report — averages for
 * the LA (or a regional fallback), NOT a live per-address measurement. The section
 * says so and links to checker.ofcom.org.uk for the address-specific check.
 *
 * Best-effort; never throws. Runs inside generate() (no new serverless function).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import broadbandHandler from "../sources/broadband.js";

/**
 * @param {import("./resolve.js").ResolvedLocation} location
 * @returns {Promise<{ ok:boolean, data:Object|null, granularity:"local-authority"|"region"|null }>}
 */
export async function fetchBroadband(location) {
  // A full postcode gives the LA-level row; a bare outcode has no incode, so the
  // shared handler falls back to the regional average — which we then label as such.
  const postcode = location.outcodeOnly ? location.outcode : location.postcode;

  let captured = null;
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return this; },
    json(obj) { captured = obj; return this; },
  };

  try {
    await broadbandHandler({ query: { postcode } }, res);
  } catch {
    return { ok: false, data: null, granularity: null };
  }

  if (statusCode !== 200 || !captured || captured.error) {
    return { ok: false, data: null, granularity: null };
  }

  // The handler's own note distinguishes an LA-level row from a regional fallback.
  const granularity = /local authority/i.test(String(captured.note || "")) ? "local-authority" : "region";
  return { ok: true, data: captured, granularity };
}
