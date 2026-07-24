/**
 * lib/brief/cache.js
 * ─────────────────────────────────────────────────────────────────────────────
 * TRANSACTION-SET CACHE — two layers beneath a single get-or-produce interface.
 *
 *   L1  in-process TTL map   — instant, but lives only for a WARM serverless
 *                              instance (back-to-back generations of one district).
 *   L2  durable Supabase     — brief_transaction_cache table, shared across ALL
 *                              instances and users. The first generation of a
 *                              district anywhere populates it; every later request
 *                              reads Postgres in ~tens of ms.
 *
 * WHY L2 (measured, Phase 2b reliability pass):
 *   The only slow step in the spine is the Land Registry SPARQL scan (16–49s, and
 *   the cost is endpoint VARIANCE, not our row count). L1 alone makes warm repeats
 *   instant but every COLD serverless instance refetches and re-runs the variance
 *   tail — which is what clipped the generation budget and produced UNAVAILABLE for
 *   routine latency. L2 collapses that from "every cold instance" to "once per
 *   district per TTL, globally".
 *
 * L2 IS BEST-EFFORT AND NON-BLOCKING TO CORRECTNESS:
 *   - No SUPABASE_URL / SUPABASE_SERVICE_KEY (e.g. local test scripts) → L2 is a
 *     no-op and the pipeline runs on L1 + live fetch exactly as before.
 *   - Any L2 error (missing table pre-migration, network blip, oversized row) is
 *     caught, logged once, and swallowed — a cache must never fail a generation.
 *   Only the RAW transaction set is cached (the expensive network result), never
 *   derived stats or the tier-filtered payload — those stay cheap to recompute and
 *   must always reflect the current entitlement config.
 *
 * SCOPE: this module only CALLS Supabase via the same service-key client pattern
 * the other api/ routes use; it never modifies any shared db/schema file. The table
 * is created by brief-transaction-cache-migration.sql (brief-owned).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h — PPD updates at most daily
const MAX_ENTRIES = 64; // bound memory on a long-lived instance (simple FIFO evict)

// Cap the durable read/write so a slow DB can never eat into the generation budget
// (the whole function must finish under the Vercel ceiling). A miss/timeout here
// just falls through to the live fetch or skips the write — never blocks.
const L2_TIMEOUT_MS = 2_500;

/** @type {Map<string, { value: any, expires: number }>} */
const store = new Map();

/** Cache key for a district + window. Years is part of the key: a 5yr and a 10yr
 *  set for the same district are different cached values. */
function keyFor(district, years) {
  return `${String(district).toUpperCase()}:${years}`;
}

// ── L1: in-process ────────────────────────────────────────────────────────────

/**
 * Return the L1-cached value for (district, years), or null on miss/expiry.
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
 * Store a value for (district, years) with a TTL in L1. Evicts the oldest entry
 * when the store is full so a long-lived instance can't grow without bound.
 */
export function setCached(district, years, value, { ttlMs = DEFAULT_TTL_MS, now = Date.now() } = {}) {
  const key = keyFor(district, years);
  if (!store.has(key) && store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expires: now + ttlMs });
}

// ── L2: durable Supabase ──────────────────────────────────────────────────────

let _client = null;
let _clientResolved = false;

/** Lazily build the service-key Supabase client, or null if env is absent.
 *  Cached across invocations of a warm instance. */
function durableClient() {
  if (_clientResolved) return _client;
  _clientResolved = true;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    _client = null; // no durable layer in this environment — degrade to L1 only
    return null;
  }
  try {
    _client = createClient(url, key, { auth: { persistSession: false } });
  } catch (err) {
    console.warn(`[brief] durable cache disabled — client init failed: ${err?.message || err}`);
    _client = null;
  }
  return _client;
}

/** Race a promise against a timeout so a slow DB never blocks generation. */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/**
 * Read the durable layer. Returns the cached TransactionSet or null on
 * miss/expiry/any-error. Never throws.
 * @returns {Promise<any|null>}
 */
export async function getDurable(district, years, now = Date.now()) {
  const client = durableClient();
  if (!client) return null;
  try {
    const { data, error } = await withTimeout(
      client
        .from("brief_transaction_cache")
        .select("payload, expires_at")
        .eq("district", String(district).toUpperCase())
        .eq("years", years)
        .maybeSingle(),
      L2_TIMEOUT_MS,
      "durable read",
    );
    if (error || !data) return null;
    if (new Date(data.expires_at).getTime() <= now) return null; // stale
    return data.payload ?? null;
  } catch (err) {
    console.warn(`[brief] durable cache read miss (${district}:${years}) — ${err?.message || err}`);
    return null;
  }
}

/**
 * Write the durable layer (upsert on the (district, years) primary key).
 * Best-effort: any failure is logged and swallowed. Never throws.
 */
export async function setDurable(district, years, value, { ttlMs = DEFAULT_TTL_MS, now = Date.now() } = {}) {
  const client = durableClient();
  if (!client) return;
  try {
    const row = {
      district: String(district).toUpperCase(),
      years,
      payload: value,
      row_count: value?.meta?.count ?? 0,
      truncated: value?.meta?.truncated ?? false,
      fetched_at: new Date(now).toISOString(),
      expires_at: new Date(now + ttlMs).toISOString(),
    };
    const { error } = await withTimeout(
      client.from("brief_transaction_cache").upsert(row, { onConflict: "district,years" }),
      L2_TIMEOUT_MS,
      "durable write",
    );
    if (error) console.warn(`[brief] durable cache write skipped (${district}:${years}) — ${error.message}`);
  } catch (err) {
    console.warn(`[brief] durable cache write skipped (${district}:${years}) — ${err?.message || err}`);
  }
}

// ── Combined get-or-produce ───────────────────────────────────────────────────

/**
 * Get-or-produce across both layers:
 *   L1 hit → return instantly.
 *   else L2 hit → hydrate L1, return.
 *   else produce() → write L1 + (best-effort) L2, return.
 * Failures to PRODUCE are NOT cached — a transient upstream error must not poison
 * the district for the whole TTL. Cache-layer failures never surface.
 *
 * @template T
 * @param {string} district
 * @param {number} years
 * @param {() => Promise<T>} produce
 * @param {{ ttlMs?: number, now?: number }} [opts]
 * @returns {Promise<{ value: T, cached: boolean, layer: "memory"|"durable"|"live" }>}
 */
export async function withCachedTransactions(district, years, produce, opts = {}) {
  const l1 = getCached(district, years, opts.now);
  if (l1 !== null) return { value: l1, cached: true, layer: "memory" };

  const l2 = await getDurable(district, years, opts.now);
  if (l2 !== null) {
    setCached(district, years, l2, opts); // hydrate L1 so subsequent same-instance hits skip the DB
    return { value: l2, cached: true, layer: "durable" };
  }

  const value = await produce();
  setCached(district, years, value, opts);
  await setDurable(district, years, value, opts); // awaited so it persists before the function freezes
  return { value, cached: false, layer: "live" };
}

// ── SOURCE (section-evidence) cache ───────────────────────────────────────────
// Separate namespace from the transaction cache: caches the OTHER best-effort live
// sources (flood, crime, planning, amenities, air quality, property-type, …) so a
// brief refresh serves stable evidence instead of re-rolling flaky sources every
// request. Only GENUINE responses are written (isCacheable decides — legitimately-
// empty responses count as success; fetch FAILURES never do). fetched_at is kept so
// a served-stale row can be aged/caveated by the section builder.

const SOURCE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d — sources change slowly (PPD monthly)

/** @type {Map<string, { value: any, fetchedAt: number, expires: number }>} */
const srcStore = new Map();

function getSourceL1(key, now) {
  const hit = srcStore.get(key);
  if (!hit) return null;
  if (hit.expires <= now) { srcStore.delete(key); return null; }
  return hit;
}
function setSourceL1(key, value, fetchedAt, ttlMs, now) {
  if (!srcStore.has(key) && srcStore.size >= MAX_ENTRIES) {
    const oldest = srcStore.keys().next().value;
    if (oldest !== undefined) srcStore.delete(oldest);
  }
  srcStore.set(key, { value, fetchedAt, expires: now + ttlMs });
}

async function getSourceDurable(key, now) {
  const client = durableClient();
  if (!client) return null;
  try {
    const { data, error } = await withTimeout(
      client.from("brief_source_cache").select("payload, fetched_at, expires_at").eq("cache_key", key).maybeSingle(),
      L2_TIMEOUT_MS, "source read",
    );
    if (error || !data) return null;
    if (new Date(data.expires_at).getTime() <= now) return null;
    return { value: data.payload, fetchedAt: new Date(data.fetched_at).getTime() };
  } catch (err) {
    console.warn(`[brief] source cache read miss (${key}) — ${err?.message || err}`);
    return null;
  }
}

async function setSourceDurable(key, source, value, fetchedAt, ttlMs) {
  const client = durableClient();
  if (!client) return;
  try {
    const { error } = await withTimeout(
      client.from("brief_source_cache").upsert(
        {
          cache_key: key,
          source,
          payload: value,
          fetched_at: new Date(fetchedAt).toISOString(),
          expires_at: new Date(fetchedAt + ttlMs).toISOString(),
        },
        { onConflict: "cache_key" },
      ),
      L2_TIMEOUT_MS, "source write",
    );
    if (error) console.warn(`[brief] source cache write skipped (${key}) — ${error.message}`);
  } catch (err) {
    console.warn(`[brief] source cache write skipped (${key}) — ${err?.message || err}`);
  }
}

/**
 * Get-or-produce for a single best-effort SOURCE.
 *   L1 hit → return (with the original fetchedAt).
 *   else L2 hit → hydrate L1, return (with fetchedAt).
 *   else produce(); cache ONLY IF isCacheable(value) — a genuine response, including
 *   legitimately-empty ones; a failure is returned but NEVER cached, so a later
 *   attempt can converge on complete data.
 * @returns {Promise<{ value:any, cached:boolean, layer:"memory"|"durable"|"live", fetchedAt:number|null }>}
 */
export async function withCachedSource(key, source, produce, { isCacheable, ttlMs = SOURCE_TTL_MS, now = Date.now() } = {}) {
  const l1 = getSourceL1(key, now);
  if (l1) return { value: l1.value, cached: true, layer: "memory", fetchedAt: l1.fetchedAt };

  const l2 = await getSourceDurable(key, now);
  if (l2) {
    setSourceL1(key, l2.value, l2.fetchedAt, ttlMs, now);
    return { value: l2.value, cached: true, layer: "durable", fetchedAt: l2.fetchedAt };
  }

  const value = await produce();
  const ok = typeof isCacheable === "function" ? isCacheable(value) : value != null;
  if (ok) {
    setSourceL1(key, value, now, ttlMs, now);
    await setSourceDurable(key, source, value, now, ttlMs);
    return { value, cached: false, layer: "live", fetchedAt: now };
  }
  // Fetch failed → do NOT cache. Refresh will retry and converge on complete data.
  return { value, cached: false, layer: "live", fetchedAt: null };
}

/** Test/ops hook — clear the in-process (L1) caches. Does not touch the durable layer. */
export function clearCache() {
  store.clear();
  srcStore.clear();
}
