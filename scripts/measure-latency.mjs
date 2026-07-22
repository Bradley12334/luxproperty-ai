/**
 * scripts/measure-latency.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * STEP 1 — MEASURE. Replicates generate()'s exact flow (resolve → cached
 * transactions under the 50s abort budget → computeStats) against a spread of
 * districts, timing each phase, then runs the list a SECOND time so the warm
 * in-process cache is exercised. Prints a per-district table for cold and warm.
 *
 *   node scripts/measure-latency.mjs
 *
 * This is a diagnostic; it writes nothing. Cold pass ≈ one SPARQL scan per
 * district, so budget on 5-10 min.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { resolve } from "../lib/brief/resolve.js";
import { getTransactions } from "../lib/brief/transactions.js";
import { computeStats } from "../lib/brief/stats.js";
import { withCachedTransactions, clearCache } from "../lib/brief/cache.js";
import { isBriefError } from "../lib/brief/errors.js";

const FETCH_YEARS = 10;
const BUDGET_MS = 56_000; // same as generate.js DEFAULT_BUDGET_MS

// [seed full postcode, human label]. Mix: dense London, mid-size cities, rural.
const DISTRICTS = [
  ["E8 1NG", "Hackney (dense London)"],
  ["M1 1AE", "Manchester centre"],
  ["LS1 1UR", "Leeds centre"],
  ["B1 1HQ", "Birmingham centre"],
  ["BS1 4DJ", "Bristol centre"],
  ["NE1 4XF", "Newcastle centre"],
  ["LD1 5DL", "Llandrindod Wells (rural Wales)"],
  ["TR12 7RH", "Lizard (rural Cornwall)"],
  ["YO1 7HH", "York centre"],
  ["PL1 2AA", "Plymouth centre"],
];

const now = () => process.hrtime.bigint();
const ms = (a, b) => Number(b - a) / 1e6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Be polite to the shared public APIs so a rapid burst doesn't trip their rate
// limiting (which would show up as spurious resolve/UPSTREAM failures unrelated to
// generation latency). Production traffic is naturally spread out; this pause just
// makes the back-to-back benchmark representative.
const INTER_DISTRICT_MS = 3_000;

/** resolve() with one gentle retry, so a transient Postcodes.io blip during the
 *  benchmark burst doesn't contaminate the district's row. */
async function resolveResilient(pc) {
  try {
    return await resolve(pc);
  } catch (err) {
    if (isBriefError(err) && err.code === "UPSTREAM_ERROR") {
      await sleep(1500);
      return await resolve(pc);
    }
    throw err;
  }
}

/** One generate()-equivalent run for a seed postcode, fully timed. */
async function measure(rawPostcode) {
  const t0 = now();
  const row = {
    postcode: rawPostcode,
    tResolve: null,
    tTx: null,
    tStats: null,
    tTotal: null,
    outcome: "?",
    reason: "",
    cached: false,
    count: 0,
    pages: 0,
    rawRows: 0,
    truncated: false,
  };

  let location;
  try {
    location = await resolveResilient(rawPostcode);
    row.tResolve = ms(t0, now());
    row.outcode = location.outcode;
  } catch (err) {
    row.tResolve = ms(t0, now());
    row.tTotal = row.tResolve;
    row.outcome = "RESOLVE_FAIL";
    row.reason = isBriefError(err) ? err.code : String(err?.message || err);
    return row;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BUDGET_MS);
  const tTxStart = now();
  try {
    const result = await withCachedTransactions(location.outcode, FETCH_YEARS, () =>
      getTransactions(location.outcode, FETCH_YEARS, { signal: controller.signal }),
    );
    row.tTx = ms(tTxStart, now());
    row.cached = result.cached;
    const txSet = result.value;
    row.count = txSet.meta.count;
    row.pages = txSet.meta.pagesFetched;
    row.rawRows = txSet.meta.rawRows;
    row.truncated = txSet.meta.truncated;

    const tStatsStart = now();
    const stats = computeStats(txSet);
    row.tStats = ms(tStatsStart, now());
    row.outcome = stats.available ? "SUCCESS" : "EMPTY(0 tx)";
  } catch (err) {
    row.tTx = ms(tTxStart, now());
    row.outcome = "UNAVAILABLE";
    row.reason = isBriefError(err) ? `${err.code}:${err.meta?.reason || ""}` : String(err?.message || err);
  } finally {
    clearTimeout(timer);
  }

  row.tTotal = ms(t0, now());
  return row;
}

function fmt(n) {
  return n == null ? "—" : (n / 1000).toFixed(1) + "s";
}

function printTable(title, rows) {
  console.log(`\n### ${title}`);
  console.log(
    "outcode  outcome        total   resolve   sparql   stats   cached  count  pages  raw     reason",
  );
  console.log("─".repeat(110));
  for (const r of rows) {
    console.log(
      `${String(r.outcode || r.postcode).padEnd(8)} ${r.outcome.padEnd(14)} ` +
        `${fmt(r.tTotal).padStart(6)}  ${fmt(r.tResolve).padStart(7)}  ${fmt(r.tTx).padStart(7)}  ` +
        `${fmt(r.tStats).padStart(6)}  ${String(r.cached).padEnd(6)} ${String(r.count).padStart(5)}  ` +
        `${String(r.pages).padStart(5)}  ${String(r.rawRows).padStart(6)}  ${r.reason}`,
    );
  }
  const ok = rows.filter((r) => r.outcome === "SUCCESS").length;
  const slow = rows.filter((r) => r.tTotal != null && r.tTotal > BUDGET_MS * 0.8);
  console.log("─".repeat(110));
  console.log(
    `SUCCESS ${ok}/${rows.length} | UNAVAILABLE ${rows.filter((r) => r.outcome === "UNAVAILABLE").length} | ` +
      `>${(BUDGET_MS * 0.8) / 1000}s: ${slow.length} (${slow.map((r) => r.outcode).join(", ") || "none"})`,
  );
}

async function main() {
  console.log(`LuxProperty brief — latency measurement (budget ${BUDGET_MS / 1000}s, ${FETCH_YEARS}yr window)`);
  console.log(`districts: ${DISTRICTS.map((d) => d[0].split(" ")[0]).join(", ")}`);

  clearCache();

  // ── COLD pass ──────────────────────────────────────────────────────────────
  const cold = [];
  for (const [pc, label] of DISTRICTS) {
    process.stdout.write(`\n[cold] ${pc} (${label}) … `);
    const r = await measure(pc);
    process.stdout.write(`${r.outcome} ${fmt(r.tTotal)} (n=${r.count})`);
    cold.push(r);
    await sleep(INTER_DISTRICT_MS);
  }

  // ── WARM pass (same process → in-process cache is populated) ────────────────
  const warm = [];
  for (const [pc, label] of DISTRICTS) {
    process.stdout.write(`\n[warm] ${pc} (${label}) … `);
    const r = await measure(pc);
    process.stdout.write(`${r.outcome} ${fmt(r.tTotal)} cached=${r.cached}`);
    warm.push(r);
    await sleep(1000);
  }

  console.log("\n");
  printTable("COLD pass (first generation per district)", cold);
  printTable("WARM pass (repeat — in-process cache)", warm);

  // Where does cold time go, on average, for SUCCESS rows?
  const s = cold.filter((r) => r.outcome === "SUCCESS");
  if (s.length) {
    const avg = (f) => (s.reduce((a, r) => a + (f(r) || 0), 0) / s.length / 1000).toFixed(1);
    console.log(
      `\nCOLD averages (SUCCESS only): resolve ${avg((r) => r.tResolve)}s | ` +
        `sparql ${avg((r) => r.tTx)}s | stats ${avg((r) => r.tStats)}s | total ${avg((r) => r.tTotal)}s`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
