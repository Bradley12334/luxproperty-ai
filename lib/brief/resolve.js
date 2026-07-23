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
 * @property {boolean} outcodeOnly  true when the caller supplied a bare outcode
 *   (e.g. "E8") rather than a full postcode: the location is the DISTRICT centroid,
 *   there is no single ward, and `postcode` holds the outcode itself. The brief
 *   presents such a result as district-wide.
 */

// Full UK postcode, ignoring spacing. Outward = area(1-2 letters)+district digit+optional
// (letter|digit); inward = digit + 2 letters. Deliberately permissive on the outward
// alnum slot — Postcodes.io is the authority on whether it is a *real* postcode.
const FULL_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;

// A bare OUTCODE (postcode district) with no incode: area(1-2 letters) + district
// digit + optional (letter|digit). "E8", "W11", "EC1A". The SEO guides tell users
// to "generate your E8 brief", so a bare outcode must resolve district-wide rather
// than hit the invalid-postcode card.
const OUTCODE_ONLY_RE = /^[A-Z]{1,2}\d[A-Z\d]?$/;

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
 *
 * Accepts EITHER a full postcode ("E8 1NG" — the strict path, with the
 * reverse-geocode validation guard) OR a bare outcode ("E8" — resolved to the
 * district centroid, district-wide). Anything else is an INVALID_POSTCODE.
 * @param {string} rawPostcode
 * @returns {Promise<ResolvedLocation>}
 * @throws {BriefError}
 */
export async function resolve(rawPostcode) {
  if (typeof rawPostcode !== "string") {
    throw new BriefError(ErrorCodes.INVALID_POSTCODE, "Postcode must be a string.", { raw: rawPostcode });
  }
  const compact = rawPostcode.replace(/\s+/g, "").toUpperCase();
  // A bare outcode (no incode) takes the district-wide path; a full postcode takes
  // the strict guarded path. FULL is checked first so a valid full postcode is never
  // mis-read as an outcode.
  if (!FULL_POSTCODE_RE.test(compact) && OUTCODE_ONLY_RE.test(compact)) {
    return resolveOutcode(compact, rawPostcode);
  }
  return resolveFullPostcode(rawPostcode);
}

/**
 * Strict full-postcode resolution: forward lookup + nation guard + reverse-geocode
 * validation guard. This is the original, unchanged behaviour.
 * @param {string} rawPostcode
 * @returns {Promise<ResolvedLocation>}
 * @throws {BriefError}
 */
async function resolveFullPostcode(rawPostcode) {
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
    // The dominant cause of a reverse-geocode mismatch is a non-geographic /
    // large-user postcode (PO boxes, mail-sorting, corporate "XX99"-style
    // districts): its coordinates sit in a neighbouring residential district, so
    // the guard cannot confirm it. Surface an actionable, user-facing message;
    // keep the technical outcodes in `meta` for logs. See Stage 2b SA99 1YX.
    throw new BriefError(
      ErrorCodes.VALIDATION_GUARD_FAILED,
      "This appears to be a non-geographic or large-user postcode (PO boxes, mail sorting and similar) — enter a residential postcode for a brief.",
      { canonical, requestedOutcode: resolvedOutcode, nearestOutcode, lat, lng },
    );
  }

  return Object.freeze({
    postcode: canonical,
    outcode: resolvedOutcode,
    ward: String(r.admin_ward || ""),
    localAuthority: String(r.admin_district || ""),
    // GSS code of the local authority (e.g. "E09000012"), for ONS/Nomis area lookups
    // like the property-type split. Empty string if Postcodes.io omitted it.
    laCode: String(r.codes?.admin_district || ""),
    region: r.region ?? null,
    country,
    lat,
    lng,
    outcodeOnly: false,
  });
}

/**
 * District-wide resolution for a bare outcode ("E8"). Uses Postcodes.io's
 * `/outcodes/{outcode}` endpoint, which returns the district CENTROID plus the
 * admin areas it spans. No reverse-geocode guard is needed: we are using the
 * outcode's own centroid, so it is by construction inside the requested district
 * (the guard exists to catch a full postcode resolving to the wrong place). The
 * nation guard still applies — Scotland/NI outcodes are rejected.
 * @param {string} outcode  normalised, e.g. "E8"
 * @param {string} raw      original input, for error messages
 * @returns {Promise<ResolvedLocation>}
 * @throws {BriefError}
 */
async function resolveOutcode(outcode, raw) {
  const res = await getJson(`${POSTCODES_IO}/outcodes/${encodeURIComponent(outcode)}`);
  if (res.status === 404) {
    throw new BriefError(
      ErrorCodes.INVALID_POSTCODE,
      `"${raw}" is not a recognised UK postcode district.`,
      { outcode },
    );
  }
  if (!res.ok || !res.json?.result) {
    throw new BriefError(
      ErrorCodes.UPSTREAM_ERROR,
      `Postcodes.io returned ${res.status} for outcode ${outcode}.`,
      { status: res.status, outcode },
    );
  }

  const r = res.json.result;
  // `country` is an array — an outcode can straddle admin/national boundaries.
  const countries = Array.isArray(r.country) ? r.country : r.country ? [r.country] : [];

  // ── Nation guard ───────────────────────────────────────────────────────────
  // Land Registry PPD covers England & Wales. Accept the outcode if ANY part is in
  // E&W (the spine's postcode-prefix scan only ever pulls E&W registered sales, so
  // a rare border-straddling outcode still yields correct data). Reject only when
  // no part is in E&W (a wholly Scottish/NI district such as EH1 or BT1).
  const inEnglandOrWales = countries.some((c) => c === "England" || c === "Wales");
  if (!inEnglandOrWales) {
    const shown = countries[0] || "outside England & Wales";
    throw new BriefError(
      ErrorCodes.UNSUPPORTED_NATION,
      `${outcode} is in ${shown}. LuxProperty briefs cover England & Wales only.`,
      { country: shown, outcode },
    );
  }

  const lat = Number(r.latitude);
  const lng = Number(r.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new BriefError(
      ErrorCodes.UPSTREAM_ERROR,
      `Postcodes.io returned no coordinates for outcode ${outcode}.`,
      { outcode },
    );
  }

  const country = countries.includes("England") ? "England" : "Wales";
  const adminDistricts = Array.isArray(r.admin_district) ? r.admin_district.filter(Boolean) : [];

  return Object.freeze({
    postcode: outcode, // display: the district itself, e.g. "E8"
    outcode,
    ward: "", // district-wide — no single ward
    localAuthority: adminDistricts[0] || "",
    // The /outcodes endpoint returns admin_district NAMES, not GSS codes; leave the
    // code empty for a district-wide brief. The property-type module reverse-geocodes
    // the centroid to a representative LA code when needed.
    laCode: "",
    region: r.region ?? null,
    country,
    lat,
    lng,
    outcodeOnly: true,
  });
}
