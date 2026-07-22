/**
 * lib/brief/resolve.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POSTCODE RESOLVER — the single source of location truth for the brief spine.
 *
 *   resolve("e8 1ng") → { postcode, outcode, ward, localAuthority, region,
 *                         country, lat, lng }
 *
 * Contract (BRIEF_SPEC.md → Data spine):
 *   1. Normalise the input; reject anything that is not a real UK postcode with a
 *      typed INVALID_POSTCODE error.
 *   2. Postcodes.io forward lookup → lat/lng, outcode (postcode district), ward,
 *      local authority, region, country.
 *   3. Reject Scotland / Northern Ireland with a typed UNSUPPORTED_NATION error
 *      ("England & Wales only") — HM Land Registry PPD covers E&W only, so a brief
 *      for those nations would be built on absent price data.
 *   4. VALIDATION GUARD: reverse-geocode the resolved lat/lng via Postcodes.io;
 *      the nearest postcode's outcode MUST equal the requested outcode. A mismatch
 *      is a typed VALIDATION_GUARD_FAILED error — never a silent fallback. This is
 *      what stops the pipeline generating from coordinates that don't actually
 *      belong to the requested district.
 *
 * The object this returns is the ONLY location the rest of the spine may use.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { BriefError, ErrorCodes } from "./errors.js";

const POSTCODES_IO = "https://api.postcodes.io";

/**
 * @typedef {Object} ResolvedLocation
 * @property {string} postcode        Canonical form, e.g. "E8 1NG"
 * @property {string} outcode         Postcode district, e.g. "E8" (this is what the spec calls "district")
 * @property {string} ward            Administrative ward name
 * @property {string} localAuthority  Local authority / borough (NOT the outcode; do not filter LR on this)
 * @property {string|null} region     e.g. "London" (null for Wales/Scotland in the source data)
 * @property {string} country         "England" | "Wales" (Scotland/NI are rejected before returning)
 * @property {number} lat
 * @property {number} lng
 */

// Full UK postcode, ignoring spacing. Outward = area(1-2 letters)+district digit+optional
// (letter|digit); inward = digit + 2 letters. Deliberately permissive on the outward
// alnum slot — Postcodes.io is the authority on whether it is a *real* postcode.
const FULL_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;

/**
 * Normalise a raw postcode string to canonical "OUTCODE INCODE" form.
 * Strips all internal whitespace, uppercases, then reinserts the single space
 * before the final three characters (the incode).
 * @param {string} raw
 * @returns {{ canonical: string, compact: string, outcode: string }}
 * @throws {BriefError} INVALID_POSTCODE if the shape can't be a UK postcode
 */
export function normalizePostcode(raw) {
  if (typeof raw !== "string") {
    throw new BriefError(ErrorCodes.INVALID_POSTCODE, "Postcode must be a string.", { raw });
  }
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (!FULL_POSTCODE_RE.test(compact)) {
    throw new BriefError(
      ErrorCodes.INVALID_POSTCODE,
      `"${raw}" is not a valid UK postcode.`,
      { raw, compact },
    );
  }
  const incode = compact.slice(-3);
  const outcode = compact.slice(0, -3);
  return { canonical: `${outcode} ${incode}`, compact, outcode };
}

/**
 * @param {string} url
 * @returns {Promise<{ ok: boolean, status: number, json: any }>}
 */
async function getJson(url) {
  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (cause) {
    throw new BriefError(ErrorCodes.UPSTREAM_ERROR, `Postcodes.io request failed: ${url}`, {
      cause: String(cause),
    });
  }
  // 404 is a meaningful "not found" for postcode lookups — surface the status,
  // let the caller decide (a 404 on forward lookup = invalid postcode).
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body — leave json null, status carries the signal */
  }
  return { ok: res.ok, status: res.status, json };
}

/**
 * Resolve a raw postcode string to its validated canonical location.
 * @param {string} rawPostcode
 * @returns {Promise<ResolvedLocation>}
 * @throws {BriefError}
 */
export async function resolve(rawPostcode) {
  const { canonical, compact, outcode } = normalizePostcode(rawPostcode);

  // ── Forward lookup ─────────────────────────────────────────────────────────
  const fwd = await getJson(`${POSTCODES_IO}/postcodes/${encodeURIComponent(compact)}`);
  if (fwd.status === 404) {
    throw new BriefError(
      ErrorCodes.INVALID_POSTCODE,
      `"${rawPostcode}" is not a recognised UK postcode.`,
      { canonical },
    );
  }
  if (!fwd.ok || !fwd.json?.result) {
    throw new BriefError(
      ErrorCodes.UPSTREAM_ERROR,
      `Postcodes.io returned ${fwd.status} for ${canonical}.`,
      { status: fwd.status },
    );
  }

  const r = fwd.json.result;
  const country = String(r.country || "");
  const resolvedOutcode = String(r.outcode || outcode);

  // ── Nation guard ───────────────────────────────────────────────────────────
  // Land Registry PPD covers England & Wales only. Key off `country` — `region`
  // is null for both Wales and Scotland, so it cannot distinguish them.
  if (country === "Scotland" || country === "Northern Ireland") {
    throw new BriefError(
      ErrorCodes.UNSUPPORTED_NATION,
      `${canonical} is in ${country}. LuxProperty briefs cover England & Wales only.`,
      { country, canonical },
    );
  }

  const lat = Number(r.latitude);
  const lng = Number(r.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new BriefError(
      ErrorCodes.UPSTREAM_ERROR,
      `Postcodes.io returned no coordinates for ${canonical}.`,
      { canonical },
    );
  }

  // ── Validation guard: reverse-geocode must land back in the same outcode ─────
  const rev = await getJson(`${POSTCODES_IO}/postcodes?lon=${lng}&lat=${lat}&limit=1`);
  const nearest = rev.json?.result?.[0];
  if (!rev.ok || !nearest) {
    throw new BriefError(
      ErrorCodes.VALIDATION_GUARD_FAILED,
      `Could not reverse-geocode the coordinates for ${canonical} to confirm its district.`,
      { canonical, lat, lng, status: rev.status },
    );
  }
  const nearestOutcode = String(nearest.outcode || "");
  if (nearestOutcode !== resolvedOutcode) {
    throw new BriefError(
      ErrorCodes.VALIDATION_GUARD_FAILED,
      `Location check failed for ${canonical}: coordinates resolve to ${nearestOutcode}, not ${resolvedOutcode}.`,
      { canonical, requestedOutcode: resolvedOutcode, nearestOutcode, lat, lng },
    );
  }

  return Object.freeze({
    postcode: canonical,
    outcode: resolvedOutcode,
    ward: String(r.admin_ward || ""),
    localAuthority: String(r.admin_district || ""),
    region: r.region ?? null,
    country,
    lat,
    lng,
  });
}
