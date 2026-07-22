/**
 * lib/brief/rental.js
 * ─────────────────────────────────────────────────────────────────────────────
 * RENTAL ADAPTER (PRO) — reuses the consolidated source in lib/sources/rental-market.js
 * WITHOUT modifying it (shared handler; also imported by api/postcode-data.js). Same
 * response-capture shim pattern as lib/brief/broadband.js.
 *
 * WHAT SURVIVED THE LIVE PROBE (Phase 2e):
 *   - The shared source's median-rent table is REGIONAL: VOA Private Rental Market
 *     Statistics 2024, one row per ONS region (all London postcodes share the London
 *     row). We take these benchmarks and label them at their TRUE granularity —
 *     region, dated 2024 — never implied-local. This is the "regional data dressed
 *     as local" problem the section is built to avoid.
 *   - We DROP the source's live YoY: its ONS IPHRP feed is dead (the dataset is frozen
 *     — IPHRP was discontinued and superseded by PIPR; the pinned period returns empty
 *     observations, so the handler only ever emits a hardcoded fallback). We do not
 *     surface a rent-growth number we can't source.
 *   - We DROP the source's hardcoded per-region "yield" — the section computes gross
 *     yield itself from the LIVE local spine median (see the section builder).
 *
 * OUTCODE HANDLING: the shared handler 500s on a bare outcode, so a district-wide brief
 * reverse-geocodes the district centroid to a real full postcode first (same as the
 * council-tax adapter), then shims.
 *
 * Best-effort; never throws. Runs inside generate() (no new serverless function).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import rentalHandler from "../sources/rental-market.js";

const POSTCODES_IO = "https://api.postcodes.io";

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
 * @returns {Promise<{ ok:boolean, data:{ region:string, medianRents:{ "1bed":number, "2bed":number, "3bed":number } }|null }>}
 */
export async function fetchRental(location) {
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
    await rentalHandler({ query: { postcode } }, res);
  } catch {
    return { ok: false, data: null };
  }

  const rents = captured?.medianRents;
  if (statusCode !== 200 || !captured || captured.error || !rents || rents["2bed"] == null) {
    return { ok: false, data: null };
  }

  return {
    ok: true,
    data: {
      region: captured.region || location.region || "this region",
      medianRents: {
        "1bed": rents["1bed"],
        "2bed": rents["2bed"],
        "3bed": rents["3bed"],
      },
    },
  };
}
