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

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d — PPD publishes MONTHLY, so a 24h
// TTL forced needless daily cold re-scans; 7d keeps districts warm between refreshes
// while still refreshing well inside a monthly data cycle. (Matches the source TTL.)
const MAX_ENTRIES = 64; // bound memory on a long-lived instance (simple FIFO evict)

// Cap the durable read/write so a slow DB can never eat into the generation budget
// (the whole function must finish under the Vercel ceiling). A miss/timeout here
// just falls through to the live fetch or skips the write — never blocks.
const L2_TIMEOUT_MS = 2_500;

// ── Serve-stale bridge (INTERIM, revertible) ──────────────────────────────────
// While the Land Registry SPARQL endpoint is degraded (flat ~30s/page scan floor,
// flapping to 90s→503; multi-page districts like CR0 = 22k rows / 3 pages ≈ 90s cannot
// fit the function budget even on a healthy endpoint), serve the LAST GOOD cached row —
// clearly dated by the section — instead of a bare UNAVAILABLE price section. Retired
// wholesale once the offline aggregate loader lands (there is then no live fetch to fail).
// Off-switch: SERVE_STALE_TX=0 (needs a Vercel REBUILD to take effect, like TX_SOURCE).
// Age cap: STALE_TX_MAX_AGE_DAYS (default 60) — beyond it, UNAVAILABLE is more honest than
// an ever-staler number. DO NOT run the Step-1 reclaim delete: the expired rows ARE this
// bridge's insurance; brief_transaction_cache is dropped only after the loader is proven.
const STALE_ENABLED = process.env.SERVE_STALE_TX !== "0";
const STALE_MAX_AGE_MS = (Number(process.env.STALE_TX_MAX_AGE_DAYS) || 60) * 24 * 60 * 60 * 1000;

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
 * Read the durable layer IGNORING expiry, for the serve-stale bridge. Returns the row's
 * payload + its original fetched_at ONLY if it is within `maxAgeMs` of `now` (else null,
 * so a too-old row is never served). Never throws. Independent of getDurable's expiry gate.
 * @returns {Promise<{ payload:any, fetchedAt:number }|null>}
 */
export async function getDurableStale(district, years, maxAgeMs, now = Date.now()) {
  const client = durableClient();
  if (!client) return null;
  try {
    const { data, error } = await withTimeout(
      client
        .from("brief_transaction_cache")
        .select("payload, fetched_at")
        .eq("district", String(district).toUpperCase())
        .eq("years", years)
        .maybeSingle(),
      L2_TIMEOUT_MS,
      "durable stale read",
    );
    if (error || !data || data.payload == null) return null;
    const fetchedAt = new Date(data.fetched_at).getTime();
    if (!Number.isFinite(fetchedAt)) return null;
    if (now - fetchedAt > maxAgeMs) return null; // beyond the age cap → not servable
    return { payload: data.payload, fetchedAt };
  } catch (err) {
    console.warn(`[brief] durable stale read miss (${district}:${years}) — ${err?.message || err}`);
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

  // ── Serve-stale bridge ──────────────────────────────────────────────────────
  // Fresh cache miss. Read the stale fallback ONCE (reused for BOTH the early-skip below
  // and the failure-fallback in the catch — no second DB round-trip). Deliberately NOT
  // written back to L1/L2, so labelling stays correct and we recover to fresh the instant
  // the endpoint heals (trade-off: a sustained outage re-attempts the live scan per request
  // for single-page districts).
  const stale = STALE_ENABLED ? await getDurableStale(district, years, STALE_MAX_AGE_MS, opts.now) : null;
  const staleResult = (s) => ({ value: s.payload, cached: true, layer: "stale", stale: true, staleAsOf: s.fetchedAt });

  // Early skip: a KNOWN multi-page district cannot fit the function budget even on a healthy
  // endpoint (flat ~30s/page; e.g. CR0 = 3 pages ≈ 90s > budget → guaranteed abort). Don't
  // burn ~budget seconds per request re-learning that — serve stale immediately. pagesFetched
  // is the exact recorded signal; count>10000 is a fallback for a legacy row missing it.
  if (stale) {
    const m = stale.payload?.meta ?? {};
    if ((m.pagesFetched ?? 0) > 1 || (m.count ?? 0) > 10000) return staleResult(stale);
  }

  try {
    const value = await produce();
    setCached(district, years, value, opts);
    await setDurable(district, years, value, opts); // awaited so it persists before the function freezes
    return { value, cached: false, layer: "live" };
  } catch (err) {
    // Single-page district attempted live and failed → serve stale if we have one in cap.
    if (stale) return staleResult(stale);
    throw err; // no servable stale row → existing UNAVAILABLE behaviour (never-cached or >cap)
  }
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

// ── ANTI-SPIRAL GUARD (per-location negative marker + circuit breaker) ────────
// Stops production's OWN traffic from sustaining a rate-limit on a flaky upstream
// (Overpass): during an outage every organic request would otherwise re-hit the
// throttled endpoint, holding the limiter open. Two layers:
//   1. Per-LOCATION negative marker — a location that just failed is skipped for a
//      short TTL, so a refresh of the same postcode doesn't re-call upstream.
//   2. Global CIRCUIT BREAKER — after N consecutive failures the breaker OPENS and
//      ALL calls to that upstream short-circuit for a window, then HALF-OPEN (one
//      trial call decides: a success closes it, a failure re-opens it).
//
// BOTH LAYERS ARE PER-INSTANCE (in-process L1) BY DESIGN. Each lambda self-limits its
// own calls to the upstream — we deliberately do NOT persist these to Supabase. A
// durable/global breaker would add a DB write on every failure, on the hot path, which
// is exactly the load we are trying to shed during an outage. Few warm instances exist
// and each backs off independently, which is sufficient to let the per-IP limiter decay.

const NEGATIVE_TTL_MS = 5 * 60 * 1000; // per-location: skip re-calling a just-failed location for 5 min
const BREAKER_STRIKES = 3;             // consecutive failures that OPEN the breaker
const BREAKER_OPEN_MS = 2 * 60 * 1000; // how long the breaker stays open before half-open

const _negMarkers = new Map(); // guardKey (e.g. "overpass:E8 1AA") → failedUntil epoch ms
const _breakers = new Map();   // breakerName (e.g. "overpass") → { fails, openUntil }

/** Constants exported for the guard harness. */
export const _GUARD = Object.freeze({ NEGATIVE_TTL_MS, BREAKER_STRIKES, BREAKER_OPEN_MS });

/**
 * Should this upstream call be SKIPPED right now?
 * True when the breaker is OPEN (≥N consecutive failures, still inside the window) or
 * this exact location has a fresh failure marker. Once the breaker window elapses it
 * stops forcing a skip → the next call is the half-open trial.
 */
export function shouldSkipUpstream(breakerName, guardKey, now = Date.now()) {
  const br = _breakers.get(breakerName);
  if (br && br.fails >= BREAKER_STRIKES && br.openUntil > now) return true; // breaker OPEN
  const failedUntil = _negMarkers.get(guardKey);
  return !!(failedUntil && failedUntil > now); // location failed recently
}

/** Record an upstream SUCCESS: closes the breaker and clears this location's marker. */
export function recordUpstreamSuccess(breakerName, guardKey) {
  _breakers.set(breakerName, { fails: 0, openUntil: 0 });
  _negMarkers.delete(guardKey);
}

/** Record an upstream FAILURE: mark this location for NEGATIVE_TTL_MS and add a strike;
 *  the Nth consecutive strike OPENS the breaker for BREAKER_OPEN_MS. */
export function recordUpstreamFailure(breakerName, guardKey, now = Date.now()) {
  _negMarkers.set(guardKey, now + NEGATIVE_TTL_MS);
  const cur = _breakers.get(breakerName) || { fails: 0, openUntil: 0 };
  cur.fails += 1;
  if (cur.fails >= BREAKER_STRIKES) cur.openUntil = now + BREAKER_OPEN_MS;
  _breakers.set(breakerName, cur);
}

/** Test/ops hook — clear the in-process (L1) caches. Does not touch the durable layer. */
export function clearCache() {
  store.clear();
  srcStore.clear();
  _negMarkers.clear();
  _breakers.clear();
}
