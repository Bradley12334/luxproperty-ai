/**
 * lib/brief/cache.js
 * ─────────────────────────────────────────────────────────────────────────────
 * TRANSACTION-SET CACHE — the Phase 2a mitigation for the ~20-30s SPARQL scan.
 *
 * A best-effort, in-process TTL cache keyed by district+window. It lives at module
 * scope inside the serverless function, so it survives only for the lifetime of a
 * WARM Lambda instance: back-to-back generations of the same district (the common
 * case — a user retrying, or two people briefing the same area) return instantly;
 * a cold instance simply regenerates. It degrades gracefully and needs no external
 * infra, so it respects the read-only `server/storage.ts` boundary.
 *
 * DELIBERATELY NOT persistent. A durable cross-instance cache (a brief-owned
 * `brief_transaction_cache` table via a NEW migration, or Vercel KV) is proposed
 * for a later phase and needs sign-off before any DB/schema work — see BRIEF_SPEC
 * scope boundary. This module is the interface that durable layer will slot behind.
 *
 * Caches ONLY the raw transaction set (the expensive network result), never the
 * derived stats or the tier-filtered payload — those are cheap to recompute and
 * must always reflect the current entitlement config.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h — PPD updates at most daily
const MAX_ENTRIES = 64; // bound memory on a long-lived instance (simple FIFO evict)

/** @type {Map<string, { value: any, expires: number }>} */
const store = new Map();

/** Cache key for a district + window. Years is part of the key: a 5yr and a 10yr
 *  set for the same district are different cached values. */
function keyFor(district, years) {
  return `${String(district).toUpperCase()}:${years}`;
}

/**
 * Return the cached value for (district, years), or null on miss/expiry.
 * @returns {any|null}
 */
export function getCached(district, years, now = Date.now()) {
  const key = keyFor(district, years);
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expires <= now) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

/**
 * Store a value for (district, years) with a TTL. Evicts the oldest entry when the
 * store is full so a long-lived instance can't grow without bound.
 */
export function setCached(district, years, value, { ttlMs = DEFAULT_TTL_MS, now = Date.now() } = {}) {
  const key = keyFor(district, years);
  if (!store.has(key) && store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expires: now + ttlMs });
}

/**
 * Get-or-produce: return the cached transaction set, or run `produce()` and cache
 * its result. Failures are NOT cached — a transient upstream error must not poison
 * the district for the whole TTL.
 * @template T
 * @param {string} district
 * @param {number} years
 * @param {() => Promise<T>} produce
 * @param {{ ttlMs?: number, now?: number }} [opts]
 * @returns {Promise<{ value: T, cached: boolean }>}
 */
export async function withCachedTransactions(district, years, produce, opts = {}) {
  const cached = getCached(district, years, opts.now);
  if (cached !== null) return { value: cached, cached: true };
  const value = await produce();
  setCached(district, years, value, opts);
  return { value, cached: false };
}

/** Test/ops hook — clear the whole cache. */
export function clearCache() {
  store.clear();
}
