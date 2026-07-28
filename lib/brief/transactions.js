/**
 * lib/brief/transactions.js
 * ─────────────────────────────────────────────────────────────────────────────
 * TRANSACTION MODULE — the single, clean, in-district transaction set that every
 * price statistic in the brief derives from.
 *
 *   getTransactions("E8", 10) → { district, window, transactions[], meta }
 *
 * Contract (BRIEF_SPEC.md → Data spine):
 *   - Filter Land Registry PPD so EVERY returned transaction's postcode starts
 *     with "<DISTRICT> " (trailing space). N1 must never match N10–N19. This is
 *     the root-cause fix for the old pipeline, which filtered on
 *     `propertyAddress.district` — in PPD "district" is the LOCAL AUTHORITY, not
 *     the postcode district, so N1 briefs pulled in Camden/Islington addresses.
 *   - Deduplicate on Land Registry transaction id.
 *   - No arbitrary page cap silently truncating data; page through the whole
 *     window with a sane hard ceiling and a loud warning if the ceiling is hit.
 *
 * FILTERING APPROACH — why SPARQL, not the linked-data JSON API:
 *   The linked-data endpoint (`/data/ppi/transaction-record.json`) can only
 *   filter by an EXACT postcode or by local authority — it has no postcode-prefix
 *   filter. Filtering by LA would mean fetching an entire borough (tens of
 *   thousands of rows) just to keep one outcode. The SPARQL endpoint supports
 *   `FILTER(STRSTARTS(STR(?postcode), "E8 "))`, which IS the `postcode LIKE
 *   'E8 %'` the spec calls for — evaluated server-side. It also returns clean
 *   ISO dates, the transaction id, the new-build flag and tenure directly.
 *   Trade-off: STRSTARTS is a table scan, so a query takes ~15-30s. Acceptable
 *   for the spine; a candidate for caching / a materialised view in a later phase.
 *   The strict prefix check is ALSO re-asserted in code (belt and braces).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { BriefError, ErrorCodes } from "./errors.js";

const SPARQL_ENDPOINT = "https://landregistry.data.gov.uk/landregistry/query";

// Page through OFFSET windows. One page (10k) covers ~any single outcode over a
// decade (e.g. E8 ≈ 5k rows / 10yr). Additional pages only fire for exceptionally
// dense outcodes; CEILING caps total rows so a runaway query can't hang forever.
const PAGE_SIZE = 10_000;
const HARD_CEILING = 60_000; // 6 pages
const REQUEST_TIMEOUT_MS = 90_000;

// Outcode shape: area (1-2 letters) + district digit + optional (letter|digit).
const OUTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?$/;

/**
 * @typedef {Object} Transaction
 * @property {string} id            Land Registry transaction id (dedup key)
 * @property {number} price         pricePaid, GBP integer
 * @property {string} date          ISO "YYYY-MM-DD"
 * @property {string} postcode      Full postcode, guaranteed to start with "<district> "
 * @property {string} paon          Primary addressable object name (house no./name)
 * @property {string} saon          Secondary addressable object name (flat, etc.)
 * @property {string} street
 * @property {string} town
 * @property {"Detached"|"Semi-detached"|"Terraced"|"Flat"|"Other"} propertyType
 * @property {boolean} newBuild
 * @property {"Freehold"|"Leasehold"|"Unknown"} tenure
 * @property {"standard"|"additional"} category  HM Land Registry PPD price-paid
 *   category. "standard" (Category A) = a single residential property sold for
 *   value at full market value. "additional" (Category B) = additional price-paid
 *   entries: repossessions/power-of-sale, buy-to-let portfolio transfers, transfers
 *   to non-private individuals, and "Other" property-type records (garages, parking
 *   spaces, land-only, non-residential). These are NOT ordinary home sales, so they
 *   distort medians (a £2,250 garage or a £17k parking bay); the default set
 *   excludes them (see EXCLUDE_ADDITIONAL below). Retained on the object so a future
 *   caller can opt back in.
 */

/**
 * @typedef {Object} TransactionSet
 * @property {string} district                 The requested outcode, e.g. "E8"
 * @property {{ startYear: number, endYear: number }} window  Full calendar-year span queried (inclusive)
 * @property {Transaction[]} transactions      Deduped, in-district, sorted newest-first
 * @property {Object} meta
 * @property {number} meta.count
 * @property {number} meta.pagesFetched
 * @property {boolean} meta.truncated          true if HARD_CEILING was hit (data may be incomplete)
 * @property {number} meta.rawRows             rows returned before dedup
 */

const PROPERTY_TYPE_MAP = {
  detached: "Detached",
  "semi-detached": "Semi-detached",
  terraced: "Terraced",
  "flat-maisonette": "Flat",
};

/**
 * Parse the OUTCODE (postcode district) from a full postcode by taking the token
 * before the space and uppercasing it. A UK postcode is always "OUTCODE INCODE"
 * with the incode three chars, and PPD stores postcodes WITH the space, so the
 * first whitespace-delimited token is exactly the outcode ("SE1 2AB" → "SE1",
 * "SE10 9XX" → "SE10"). Returns "" for a value with no space (never a valid full
 * postcode) so it can only ever FAIL an equality check, never spuriously pass one.
 */
function outcodeOfPostcode(postcode) {
  const s = String(postcode || "").toUpperCase().trim();
  const sp = s.indexOf(" ");
  return sp === -1 ? "" : s.slice(0, sp);
}

/** Map a Land Registry propertyType URI to a display label. */
function mapPropertyType(uri) {
  const slug = String(uri || "").split("/").pop();
  return PROPERTY_TYPE_MAP[slug] || "Other";
}

/** Map a Land Registry estateType URI to a tenure label. */
function mapTenure(uri) {
  const slug = String(uri || "").split("/").pop().toLowerCase();
  if (slug.includes("free")) return "Freehold";
  if (slug.includes("lease")) return "Leasehold";
  return "Unknown";
}

/** Map a Land Registry transactionCategory URI to "standard" | "additional".
 *  Unknown/absent → "additional" (fail safe: an unclassifiable record is treated
 *  as non-standard so it can't slip past the default exclusion). */
function mapCategory(uri) {
  const slug = String(uri || "").split("/").pop();
  return slug === "standardPricePaidTransaction" ? "standard" : "additional";
}

/**
 * Build the PPD SPARQL query for one OFFSET page.
 * ORDER BY (date desc, txid) is deterministic so OFFSET paging is stable; any
 * page-boundary overlap is absorbed by the txid dedup downstream.
 *
 * The query selects `?category` (the PPD transactionCategory) but does NOT filter
 * on it: a server-side `FILTER(?category = standardPricePaidTransaction)` wrecks the
 * endpoint's query plan (measured: an E8 decade goes from ~18s to a >180s timeout).
 * The Category-B exclusion is therefore applied cheaply in CODE (see getTransactions),
 * which is both fast and keeps the raw category on every fetched row.
 */
function buildQuery(district, startYear, endYear, offset) {
  return `
PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
SELECT ?txid ?amount ?date ?postcode ?paon ?saon ?street ?town ?propertyType ?estate ?newBuild ?category
WHERE {
  ?tranx lrppi:pricePaid ?amount ;
         lrppi:transactionDate ?date ;
         lrppi:propertyAddress ?addr ;
         lrppi:propertyType ?propertyType ;
         lrppi:estateType ?estate ;
         lrppi:newBuild ?newBuild ;
         lrppi:transactionCategory ?category ;
         lrppi:transactionId ?txid .
  ?addr lrcommon:postcode ?postcode .
  OPTIONAL { ?addr lrcommon:paon ?paon }
  OPTIONAL { ?addr lrcommon:saon ?saon }
  OPTIONAL { ?addr lrcommon:street ?street }
  OPTIONAL { ?addr lrcommon:town ?town }
  FILTER(STRSTARTS(STR(?postcode), "${district} "))
  FILTER(?date >= "${startYear}-01-01"^^<http://www.w3.org/2001/XMLSchema#date>
      && ?date <= "${endYear}-12-31"^^<http://www.w3.org/2001/XMLSchema#date>)
  FILTER(?amount > 0)
}
ORDER BY DESC(?date) ?txid
LIMIT ${PAGE_SIZE} OFFSET ${offset}`.trim();
}

/**
 * Run one SPARQL request, with a single retry on transient failure.
 * @param {string} query
 * @param {AbortSignal} [externalSignal] caller's budget signal; when it aborts,
 *   the in-flight fetch is cancelled and the error propagates (no retry). This is
 *   what lets api/brief.js cap generation below the Vercel function ceiling instead
 *   of being killed mid-flight with a 504. Composed with the per-request timeout.
 */
async function runSparql(query, externalSignal) {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&output=json`;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    // If the caller's budget is already spent, don't start another attempt.
    if (externalSignal?.aborted) {
      throw new BriefError(ErrorCodes.UPSTREAM_ERROR, "Land Registry SPARQL aborted: generation budget exceeded.", {
        reason: "external-abort",
      });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    // Compose the per-request timeout with the caller's budget signal, so whichever
    // fires first cancels the fetch. AbortSignal.any is available on Node >= 20.3.
    const signal = externalSignal
      ? AbortSignal.any([controller.signal, externalSignal])
      : controller.signal;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/sparql-results+json" },
        signal,
      });
      if (!res.ok) {
        lastErr = new BriefError(
          ErrorCodes.UPSTREAM_ERROR,
          `Land Registry SPARQL returned ${res.status}.`,
          { status: res.status, attempt },
        );
        continue; // retry
      }
      const json = await res.json();
      return json?.results?.bindings ?? [];
    } catch (cause) {
      // An external-budget abort is terminal — don't burn the retry re-issuing a
      // 30s scan we no longer have time for.
      if (externalSignal?.aborted) {
        clearTimeout(timer);
        throw new BriefError(ErrorCodes.UPSTREAM_ERROR, "Land Registry SPARQL aborted: generation budget exceeded.", {
          reason: "external-abort",
        });
      }
      lastErr = new BriefError(ErrorCodes.UPSTREAM_ERROR, `Land Registry SPARQL request failed.`, {
        cause: String(cause),
        attempt,
      });
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

/**
 * The most recent COMPLETE calendar year. The current year is always partial
 * (and PPD lags registration by weeks), so it is never treated as a full year —
 * this keeps per-year medians and counts comparable and the window deterministic
 * for a whole deploy cycle.
 */
export function latestFullYear(now = new Date()) {
  return now.getUTCFullYear() - 1;
}

/**
 * Fetch the deduped, strictly in-district transaction set for an outcode.
 * @param {string} district  Postcode outcode, e.g. "E8" (the ResolvedLocation.outcode)
 * @param {number} years     Size of the trailing full-year window (>= 1)
 * @param {{ now?: Date, signal?: AbortSignal, includeAdditional?: boolean }} [opts]
 *   signal caps total time across all pages; on abort, throws UPSTREAM_ERROR rather
 *   than hanging. includeAdditional (default false) keeps Category-B "additional"
 *   entries in the set; the default excludes them so medians reflect ordinary
 *   residential sales only.
 * @returns {Promise<TransactionSet>}
 * @throws {BriefError}
 */
export async function getTransactions(district, years, opts = {}) {
  const includeAdditional = opts.includeAdditional === true;
  const outcode = String(district || "").trim().toUpperCase();
  if (!OUTCODE_RE.test(outcode)) {
    throw new BriefError(ErrorCodes.BAD_INPUT, `"${district}" is not a valid postcode district (outcode).`, {
      district,
    });
  }
  const yrs = Math.floor(Number(years));
  if (!Number.isFinite(yrs) || yrs < 1) {
    throw new BriefError(ErrorCodes.BAD_INPUT, `years must be an integer >= 1 (got ${years}).`, { years });
  }

  const endYear = latestFullYear(opts.now);
  const startYear = endYear - yrs + 1;

  // ── Page through the window ────────────────────────────────────────────────
  const byId = new Map();
  let rawRows = 0;
  let pagesFetched = 0;
  let truncated = false;

  for (let offset = 0; offset < HARD_CEILING; offset += PAGE_SIZE) {
    const rows = await runSparql(buildQuery(outcode, startYear, endYear, offset), opts.signal);
    pagesFetched++;
    rawRows += rows.length;

    for (const row of rows) {
      const id = row.txid?.value;
      if (!id || byId.has(id)) continue;
      const postcode = String(row.postcode?.value || "").toUpperCase();
      const price = parseInt(row.amount?.value ?? "", 10);
      const date = String(row.date?.value || "").slice(0, 10);
      if (!Number.isFinite(price) || price <= 0) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const category = mapCategory(row.category?.value);
      // Exclude Category-B "additional" entries (garages/parking/land, repossessions,
      // portfolio transfers) by default — they poison medians. Filtered in code, not
      // SPARQL, because the server-side category filter is pathologically slow.
      if (!includeAdditional && category !== "standard") continue;
      byId.set(id, {
        id,
        price,
        date,
        postcode,
        paon: String(row.paon?.value || ""),
        saon: String(row.saon?.value || ""),
        street: String(row.street?.value || ""),
        town: String(row.town?.value || ""),
        propertyType: mapPropertyType(row.propertyType?.value),
        newBuild: row.newBuild?.value === "true",
        tenure: mapTenure(row.estate?.value),
        category,
      });
    }

    if (rows.length < PAGE_SIZE) break; // last page
    if (offset + PAGE_SIZE >= HARD_CEILING) {
      truncated = true;
      console.warn(
        `[brief] getTransactions(${outcode}, ${yrs}) hit the ${HARD_CEILING}-row ceiling — ` +
          `results are truncated and statistics may be incomplete.`,
      );
    }
  }

  const transactions = [...byId.values()].sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date),
  );

  // ── Hard assertion: every transaction is in-district ───────────────────────
  // STRSTARTS already guarantees this server-side; re-check in code per the spec
  // so a future change to the query can never silently reintroduce out-of-district
  // comps. A violation is a bug, not a data condition — fail loudly.
  //
  // Compare the PARSED outcode EXACTLY rather than string-prefixing the full
  // postcode. A prefix check ("SE1 ") is correct for the instances we know about,
  // but exact comparison removes the whole class: it can never confuse SE1 with
  // SE10 regardless of how the postcode is spaced/formatted, and it stays honest
  // if a future query change alters the returned column.
  const offender = transactions.find((t) => outcodeOfPostcode(t.postcode) !== outcode);
  if (offender) {
    throw new BriefError(
      ErrorCodes.UPSTREAM_ERROR,
      `In-district assertion failed: ${offender.postcode} is not in outcode "${outcode}".`,
      { outcode, offender: offender.postcode },
    );
  }

  return {
    district: outcode,
    window: { startYear, endYear },
    transactions,
    meta: { count: transactions.length, pagesFetched, truncated, rawRows },
  };
}
