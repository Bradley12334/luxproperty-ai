/**
 * lib/brief/council-tax.js
 * ─────────────────────────────────────────────────────────────────────────────
 * COUNCIL-TAX ADAPTER (EXP) — reuses the consolidated source in
 * lib/sources/council-tax.js WITHOUT modifying it. That module is a shared handler
 * (also imported by api/postcode-data.js); the brief may CALL shared code but never
 * change it (BRIEF_SPEC → Scope boundary). So we invoke its handler with a tiny
 * response-capture shim and read the JSON it would have sent — the same pattern used
 * by lib/brief/broadband.js.
 *
 * WHAT WE TAKE (and what we deliberately drop):
 *   - The billing authority + its Band D rate, and the full A–H cost table the shared
 *     source derives from Band D via the STATUTORY multipliers (fixed by law:
 *     A=6/9 … D=1 … E=11/9 … H=2). Those multipliers guarantee cost(E)>cost(D)>cost(C)
 *     — the correct ordering the old brief's rendering inverted.
 *   - We DROP the source's `mostLikelyBandRange` ("typical band for the outcode"). It
 *     is a hardcoded EPC-stock heuristic, not a genuine per-postcode band source, so
 *     per BRIEF_SPEC we omit it rather than present an invented "most common band".
 *
 * DATA CURRENCY (labelled honestly downstream): the shared source's Band D table is
 * the VOA/DLUHC "Council Tax levels 2024-25" dataset (`dataYear: "2024/25"`). That is
 * the last full published year the source carries; the section states the year
 * explicitly and links to the gov.uk band checker for the exact current-year figure.
 *
 * OUTCODE HANDLING: the shared handler resolves the postcode via `/postcodes/{pc}`,
 * which 404s for a bare outcode ("E8"). For a district-wide brief we therefore
 * reverse-geocode the district centroid to a real full postcode inside the district
 * first, then shim the handler with that — yielding the correct billing authority.
 *
 * Best-effort; never throws. Runs inside generate() (no new serverless function).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import councilTaxHandler from "../sources/council-tax.js";

const POSTCODES_IO = "https://api.postcodes.io";

/** Reverse-geocode a lat/lng to the nearest real full postcode (district-wide case). */
async function nearestFullPostcode(lat, lng) {
  try {
    const res = await fetch(`${POSTCODES_IO}/postcodes?lon=${lng}&lat=${lat}&limit=1`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result?.[0]?.postcode ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {import("./resolve.js").ResolvedLocation} location
 * @returns {Promise<{ ok:boolean, data:Object|null }>}
 */
export async function fetchCouncilTax(location) {
  // The shared handler needs a full postcode to resolve the billing authority. A full
  // postcode brief passes its own; a district-wide (bare outcode) brief reverse-geocodes
  // the centroid to a real full postcode in the district first.
  let postcode = location.postcode;
  if (location.outcodeOnly) {
    postcode = await nearestFullPostcode(location.lat, location.lng);
    if (!postcode) return { ok: false, data: null };
  }

  let captured = null;
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return this; },
    json(obj) { captured = obj; return this; },
  };

  try {
    await councilTaxHandler({ query: { postcode, type: "council-tax" } }, res);
  } catch {
    return { ok: false, data: null };
  }

  // A real billing-authority rate is required — the shared source's regional-average
  // fallback (confidence "Estimate") is not a genuine authority figure, so we treat it
  // as unavailable rather than present an averaged number as this authority's rate.
  if (statusCode !== 200 || !captured || captured.error || captured.confidence !== "Guidance" || !captured.bandD || !captured.bandCosts) {
    return { ok: false, data: null };
  }

  return {
    ok: true,
    data: {
      authority: captured.authority,      // "Hackney"
      bandD: captured.bandD,              // 1836
      bandCosts: captured.bandCosts,      // { A..H: £/yr, from statutory multipliers }
      dataYear: captured.dataYear,        // "2024/25"
      checkerUrl: captured.checkerUrl,
      country: captured.country,
    },
  };
}
