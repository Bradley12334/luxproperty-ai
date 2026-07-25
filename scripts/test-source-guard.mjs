/**
 * scripts/test-source-guard.mjs — anti-spiral guard (Item 2).
 * Verifies the per-location negative marker and the global circuit breaker as pure
 * functions with a synthetic clock (no network). Both are per-instance L1 by design.
 *
 *   node scripts/test-source-guard.mjs
 */
import {
  shouldSkipUpstream, recordUpstreamSuccess, recordUpstreamFailure, clearCache, _GUARD,
} from "../lib/brief/cache.js";

const { NEGATIVE_TTL_MS, BREAKER_STRIKES, BREAKER_OPEN_MS } = _GUARD;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log(`  ✗ ${m}`); } };

console.log("Source-guard harness — negative marker + circuit breaker\n");

// Constants match the approved design.
ok(NEGATIVE_TTL_MS === 5 * 60 * 1000, "negative TTL = 5 min");
ok(BREAKER_STRIKES === 3, "breaker strikes = 3");
ok(BREAKER_OPEN_MS === 2 * 60 * 1000, "breaker window = 2 min");

// ── (a) A failure marker prevents a live call within its TTL ──────────────────
clearCache();
const t = 1_000_000;
ok(!shouldSkipUpstream("overpass", "L1", t), "fresh location → not skipped (call allowed)");
recordUpstreamFailure("overpass", "L1", t); // L1 failed once (1 strike, breaker still closed)
ok(shouldSkipUpstream("overpass", "L1", t + 1_000), "within TTL → SKIPPED (no live call)");
ok(shouldSkipUpstream("overpass", "L1", t + NEGATIVE_TTL_MS - 1), "just before TTL → still skipped");
ok(!shouldSkipUpstream("overpass", "L1", t + NEGATIVE_TTL_MS + 1), "after TTL → allowed again");
ok(!shouldSkipUpstream("overpass", "L2", t + 1_000), "a DIFFERENT location (1 strike total) → not skipped");
recordUpstreamSuccess("overpass", "L1");
ok(!shouldSkipUpstream("overpass", "L1", t + 2_000), "success clears the marker → L1 allowed again");

// ── (b) Breaker opens after N consecutive failures, half-opens after the window ─
clearCache();
const s = 2_000_000;
recordUpstreamFailure("overpass", "A", s);
recordUpstreamFailure("overpass", "B", s); // 2 strikes
ok(!shouldSkipUpstream("overpass", "C", s + 1), "2 strikes → breaker CLOSED (fresh loc C allowed)");
recordUpstreamFailure("overpass", "D", s);  // 3rd consecutive → OPEN
ok(shouldSkipUpstream("overpass", "C", s + 1), "3 strikes → breaker OPEN (even fresh loc C skipped)");
ok(shouldSkipUpstream("overpass", "C", s + BREAKER_OPEN_MS - 1), "inside window → still open");
ok(!shouldSkipUpstream("overpass", "C", s + BREAKER_OPEN_MS + 1), "after window → HALF-OPEN (trial allowed)");

// half-open trial FAILS → re-opens
recordUpstreamFailure("overpass", "C", s + BREAKER_OPEN_MS + 2);
ok(shouldSkipUpstream("overpass", "E", s + BREAKER_OPEN_MS + 3), "trial failed → breaker RE-OPEN");

// after the second window, half-open again; a SUCCESS closes it
const w = s + 2 * BREAKER_OPEN_MS + 10;
ok(!shouldSkipUpstream("overpass", "E", w), "after 2nd window → half-open again");
recordUpstreamSuccess("overpass", "E");
ok(!shouldSkipUpstream("overpass", "F", w + 1), "trial success → breaker CLOSED (fresh loc F allowed)");

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
