/**
 * lib/brief/geocode.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POSTCODE-CENTROID GEOCODER — turns full postcodes into approximate coordinates
 * for the sold-prices map (INV).
 *
 * WHY THIS EXISTS: HM Land Registry Price Paid Data carries NO coordinates, only
 * the postcode. To plot recent sales we look up each postcode's CENTROID (the
 * geographic centre of the postcode unit) via Postcodes.io's bulk endpoint. These
 * are deliberately postcode-centroid ESTIMATES — not the exact property location —
 * and the map UI must label them as such (BRIEF_SPEC → Sold prices map).
 *
 * NO NEW SERVERLESS FUNCTION: this runs inside generate() (already server-side in
 * api/brief.js). It is ONE bulk POST for the ≤12 distinct postcodes of the recent
 * set — not a per-row lookup.
 *
 * CACHING — a module-level in-process memo, NOT the transaction cache:
 *   - Postcode centroids are effectively immutable, so entries never expire; the
 *     memo just avoids re-hitting Postcodes.io for a postcode a warm instance has
 *     already resolved. It is FIFO-bounded so a long-lived instance can't grow
 *     without bound.
 *   - It is deliberately SEPARATE from lib/brief/cache.js: that layer caches only
 *     the raw Land Registry transaction set (its documented contract), never
 *     derived data. Baking centroids into it would violate that separation and
 *     couple two independently-varying things.
 *
 * BEST-EFFORT: any failure (network, timeout, bad body, Postcodes.io down) resolves
 * to "no coordinates for these postcodes" — never throws. The map section then
 * renders the sold-prices data WITHOUT a map plus an honest note.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BULK_ENDPOINT = "https://api.postcodes.io/postcodes";
const BULK_LIMIT = 100; // Postcodes.io caps a bulk request at 100 postcodes
const DEFAULT_TIMEOUT_MS = 4_000; // own short budget; independent of the SPARQL budget
const MEMO_MAX = 4_000; // bound the in-process memo (FIFO evict)

/** @type {Map<string, {lat:number,lng:number}|null>} postcode(upper) → centroid or known-miss */
const memo = new Map();

/** Normalise a postcode to the canonical spaced, upper form Postcodes.io expects. */
function canonical(pc) {
  const compact = String(pc || "").replace(/\s+/g, "").toUpperCase();
  if (compact.length < 5) return compact; // too short to split; let the API reject it
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

function memoSet(key, value) {
  if (!memo.has(key) && memo.size >= MEMO_MAX) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, value);
}

/** POST one chunk (≤100) to the bulk endpoint. Returns a Map of query→centroid for
 *  the ones that resolved; misses are recorded as null in the memo. Never throws. */
async function fetchChunk(canonPostcodes, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(BULK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ postcodes: canonPostcodes }),
      signal: controller.signal,
    });
    if (!res.ok) return;
    const json = await res.json();
    const rows = Array.isArray(json?.result) ? json.result : [];
    for (const row of rows) {
      const query = canonical(row?.query);
      const r = row?.result;
      const lat = Number(r?.latitude);
      const lng = Number(r?.longitude);
      if (r && Number.isFinite(lat) && Number.isFinite(lng)) {
        memoSet(query, { lat, lng });
      } else {
        memoSet(query, null); // known miss — don't retry this postcode
      }
    }
  } catch (err) {
    // Timeout / network / parse — leave the un-resolved postcodes absent from the
    // memo so a later generation may retry; the map just degrades this time.
    console.warn(`[brief] geocode chunk failed (${canonPostcodes.length} postcodes) — ${err?.message || err}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a list of full postcodes to centroids. Best-effort and non-throwing.
 * @param {string[]} postcodes  full postcodes (any case/spacing)
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<Map<string, {lat:number,lng:number}>>}  keyed by canonical
 *   postcode; only successfully-resolved postcodes are present.
 */
export async function geocodePostcodes(postcodes, opts = {}) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const out = new Map();

  // Dedupe + canonicalise; split into memo hits and the ones we must fetch.
  const distinct = new Set();
  for (const pc of postcodes || []) {
    const key = canonical(pc);
    if (key) distinct.add(key);
  }

  const toFetch = [];
  for (const key of distinct) {
    if (memo.has(key)) {
      const v = memo.get(key);
      if (v) out.set(key, v); // known hit; known-miss (null) simply stays absent
    } else {
      toFetch.push(key);
    }
  }

  // Fetch the misses in chunks of ≤100 (we normally have ≤12, so a single chunk).
  for (let i = 0; i < toFetch.length; i += BULK_LIMIT) {
    const chunk = toFetch.slice(i, i + BULK_LIMIT);
    await fetchChunk(chunk, timeoutMs);
    for (const key of chunk) {
      const v = memo.get(key);
      if (v) out.set(key, v);
    }
  }

  return out;
}

/** Test/ops hook — clear the in-process centroid memo. */
export function clearGeocodeCache() {
  memo.clear();
}
