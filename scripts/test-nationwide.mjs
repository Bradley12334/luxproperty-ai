/**
 * scripts/test-nationwide.mjs — STEP 3 verification.
 *
 * Draws 30 DISTINCT England-&-Wales postcode districts from Postcodes.io's random
 * endpoint (real postcodes, so no hand-picked-seed validity trap), then runs the
 * full cold generate() path (resolve → cached transactions under the 56s budget →
 * stats) on each and reports a pass/fail table. Target: 30/30 generate — a slow
 * first fetch is acceptable, a failure is not.
 *
 *   node scripts/test-nationwide.mjs
 *
 * Cold, so ~20-25s per district → budget ~12-15 min. Writes nothing.
 */

import { resolve } from "../lib/brief/resolve.js";
import { getTransactions } from "../lib/brief/transactions.js";
import { computeStats } from "../lib/brief/stats.js";
import { withCachedTransactions, clearCache } from "../lib/brief/cache.js";
import { isBriefError } from "../lib/brief/errors.js";

const FETCH_YEARS = 10;
const BUDGET_MS = 56_000; // matches generate.js DEFAULT_BUDGET_MS
const TARGET = 30;

const now = () => process.hrtime.bigint();
const ms = (a, b) => Number(b - a) / 1e6;
const fmt = (n) => (n == null ? "—" : (n / 1000).toFixed(1) + "s");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pull one random real UK postcode. */
async function randomPostcode() {
  const res = await fetch("https://api.postcodes.io/random/postcodes");
  const j = await res.json();
  return j?.result?.postcode ?? null;
}

/** Gather TARGET distinct E&W outcodes (each with a known-valid seed postcode). */
async function gatherDistricts() {
  const seen = new Map(); // outcode → seed postcode
  let draws = 0;
  while (seen.size < TARGET && draws < TARGET * 8) {
    draws++;
    const pc = await randomPostcode();
    if (!pc) continue;
    try {
      const loc = await resolve(pc); // enforces E&W + validation guard
      if (!seen.has(loc.outcode)) {
        seen.set(loc.outcode, pc);
        process.stdout.write(`\rgathering districts… ${seen.size}/${TARGET} (${draws} draws)   `);
      }
    } catch {
      /* Scotland/NI/guard/invalid — skip, draw again */
    }
    await sleep(250); // be polite to Postcodes.io during the gathering burst
  }
  console.log("");
  return [...seen.entries()].map(([outcode, seed]) => ({ outcode, seed }));
}

/** One cold generate()-equivalent run, timed. */
async function measure(seed) {
  const t0 = now();
  const row = { seed, outcode: "?", outcome: "?", reason: "", tTotal: null, count: 0 };
  let location;
  try {
    location = await resolve(seed);
    row.outcode = location.outcode;
  } catch (err) {
    row.outcome = "RESOLVE_FAIL";
    row.reason = isBriefError(err) ? err.code : String(err?.message || err);
    row.tTotal = ms(t0, now());
    return row;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BUDGET_MS);
  try {
    const result = await withCachedTransactions(location.outcode, FETCH_YEARS, () =>
      getTransactions(location.outcode, FETCH_YEARS, { signal: controller.signal }),
    );
    const stats = computeStats(result.value);
    row.count = result.value.meta.count;
    row.outcome = stats.available ? "SUCCESS" : "EMPTY(0tx)";
  } catch (err) {
    row.outcome = "UNAVAILABLE";
    row.reason = isBriefError(err) ? `${err.code}:${err.meta?.reason || ""}` : String(err?.message || err);
  } finally {
    clearTimeout(timer);
  }
  row.tTotal = ms(t0, now());
  return row;
}

async function main() {
  console.log(`Nationwide cold-generation test — ${TARGET} random E&W districts (budget ${BUDGET_MS / 1000}s)`);
  clearCache();
  const districts = await gatherDistricts();
  console.log(`districts: ${districts.map((d) => d.outcode).join(", ")}\n`);

  const rows = [];
  for (const { seed } of districts) {
    process.stdout.write(`[${rows.length + 1}/${districts.length}] ${seed} … `);
    const r = await measure(seed);
    console.log(`${r.outcode.padEnd(5)} ${r.outcome.padEnd(12)} ${fmt(r.tTotal)} (n=${r.count}) ${r.reason}`);
    rows.push(r);
    await sleep(2000); // spread the cold SPARQL scans so we don't self-throttle
  }

  const ok = rows.filter((r) => r.outcome === "SUCCESS" || r.outcome === "EMPTY(0tx)").length;
  const fails = rows.filter((r) => r.outcome === "UNAVAILABLE" || r.outcome === "RESOLVE_FAIL");
  const gen = rows.filter((r) => r.tTotal != null && r.outcome !== "RESOLVE_FAIL");
  const times = gen.map((r) => r.tTotal).sort((a, b) => a - b);
  const p = (q) => times.length ? fmt(times[Math.min(times.length - 1, Math.floor(q * times.length))]) : "—";

  console.log("\n" + "─".repeat(70));
  console.log(`GENERATED ${ok}/${rows.length}  |  failures: ${fails.length}`);
  if (times.length) console.log(`cold timings — min ${fmt(times[0])}  p50 ${p(0.5)}  p90 ${p(0.9)}  max ${fmt(times[times.length - 1])}`);
  if (fails.length) {
    console.log("FAILURES (must be zero — diagnose each):");
    for (const f of fails) console.log(`  ✗ ${f.seed} (${f.outcode}) ${f.outcome} — ${f.reason}`);
    process.exit(1);
  }
  console.log("All districts generated. ✓");
}

main().catch((e) => { console.error(e); process.exit(1); });
