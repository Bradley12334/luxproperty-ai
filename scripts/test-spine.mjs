/**
 * scripts/test-spine.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 1 verification harness for the brief data spine. Runs resolve →
 * getTransactions → computeStats end-to-end against the LIVE Postcodes.io and
 * Land Registry APIs, prints an eyeball-checkable report per postcode, and makes
 * hard programmatic assertions.
 *
 *   node scripts/test-spine.mjs
 *
 * No build step, no tsx — plain Node (>=18 for global fetch; repo runs Node 24).
 * Land Registry SPARQL queries are table scans (~15-30s each), so expect the
 * whole run to take roughly 2-3 minutes. Nothing is written; it only reads APIs.
 * Exit code is non-zero if any assertion fails.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { resolve } from "../lib/brief/resolve.js";
import { getTransactions } from "../lib/brief/transactions.js";
import { computeStats, formatGBP, formatSignedPct } from "../lib/brief/stats.js";
import { isBriefError, ErrorCodes } from "../lib/brief/errors.js";

const YEARS = 10; // full window so the per-year trend and sparse-year handling are visible

// ── tiny assertion harness ───────────────────────────────────────────────────
let passed = 0;
const failures = [];
function check(label, cond) {
  if (cond) {
    passed++;
    console.log(`   ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`   ✗ FAIL: ${label}`);
  }
}

function hr() {
  console.log("─".repeat(78));
}

/** A postcode we expect to resolve and have transactions. */
async function runDataCase(rawPostcode, assertFn) {
  hr();
  console.log(`▶ ${rawPostcode}`);
  const loc = await resolve(rawPostcode);
  console.log(
    `   location: district=${loc.outcode}  ward=${loc.ward}  LA=${loc.localAuthority}  ` +
      `region=${loc.region ?? "—"}  country=${loc.country}  (${loc.lat}, ${loc.lng})`,
  );
  console.log(`   validation guard: PASSED (resolve() only returns after reverse-geocode match)`);

  const txSet = await getTransactions(loc.outcode, YEARS);
  console.log(
    `   transactions: ${txSet.meta.count} in-district over ${txSet.window.startYear}-${txSet.window.endYear} ` +
      `(pages=${txSet.meta.pagesFetched}, truncated=${txSet.meta.truncated}, raw=${txSet.meta.rawRows})`,
  );

  console.log(`   sample (5, newest-first) — postcodes must all start "${loc.outcode} ":`);
  for (const t of txSet.transactions.slice(0, 5)) {
    console.log(
      `      ${t.postcode.padEnd(9)} ${formatGBP(t.price).padStart(12)}  ${t.date}  ` +
        `${t.propertyType.padEnd(13)} ${t.tenure.padEnd(9)} ${t.newBuild ? "new-build" : ""}`,
    );
  }

  const stats = computeStats(txSet);
  console.log(
    `   median (window)=${formatGBP(stats.medianPrice)}   ` +
      `latest full year ${stats.latestYear.year}=${formatGBP(stats.latestYear.median)} (n=${stats.latestYear.count})   ` +
      `YoY=${formatSignedPct(stats.yoyChangePct)}`,
  );
  console.log(
    `   fair value=${formatGBP(stats.fairValue?.low)} – ${formatGBP(stats.fairValue?.high)}   ` +
      `opening=${formatGBP(stats.openingOffer?.low)} – ${formatGBP(stats.openingOffer?.high)}   ` +
      `price/m²=${stats.pricePerSqm ?? "omitted"}`,
  );
  console.log(
    `   confidence=${stats.confidence.level} (offer: ${stats.offerConfidence})  — ${stats.confidence.note}`,
  );
  console.log(`   per-year trend:`);
  console.log(`      year   n     median        YoY       state`);
  for (const row of stats.trend) {
    console.log(
      `      ${row.year}   ${String(row.count).padStart(3)}   ${(row.median ? formatGBP(row.median) : "—").padEnd(12)}  ` +
        `${formatSignedPct(row.changePct).padStart(7)}   ${row.state}`,
    );
  }

  // shared assertions for every data case
  check(
    `${loc.outcode}: every transaction postcode starts with "${loc.outcode} "`,
    txSet.transactions.every((t) => t.postcode.startsWith(`${loc.outcode} `)),
  );
  const ids = new Set(txSet.transactions.map((t) => t.id));
  check(`${loc.outcode}: no duplicate transaction ids`, ids.size === txSet.transactions.length);
  check(`${loc.outcode}: trend spans the full ${YEARS}-year window`, stats.trend.length === YEARS);
  // Category filter: the default set is STANDARD price-paid entries only — the
  // Category-B "additional" records (garages/parking/land, repossessions,
  // portfolio transfers) that poisoned medians are excluded.
  check(
    `${loc.outcode}: every transaction is a standard price-paid entry (Category-B excluded)`,
    txSet.transactions.every((t) => t.category === "standard"),
  );
  if (assertFn) assertFn({ loc, txSet, stats });
}

/** A postcode we expect resolve() to REJECT with a specific typed error. */
async function runRejectCase(rawPostcode, expectedCode) {
  hr();
  console.log(`▶ ${rawPostcode} (expect reject: ${expectedCode})`);
  try {
    await resolve(rawPostcode);
    check(`${rawPostcode}: rejected with ${expectedCode}`, false);
  } catch (err) {
    const ok = isBriefError(err) && err.code === expectedCode;
    console.log(`   threw: ${isBriefError(err) ? err.code : "(non-BriefError)"} — ${err.message}`);
    check(`${rawPostcode}: rejected with ${expectedCode}`, ok);
  }
}

async function main() {
  console.log("LuxProperty brief spine — Phase 1 verification");
  console.log(`window: latest ${YEARS} full years | live Postcodes.io + Land Registry SPARQL`);

  // E8 (Hackney) — dense urban. resolve() needs a full postcode to run the
  // reverse-geocode guard; a real E8 postcode seeds it, and the spine then works
  // district-wide on the E8 outcode.
  await runDataCase("E8 1NG");
  // W11 2ED (Notting Hill) — prime; median must clear £1m
  await runDataCase("W11 2ED", ({ stats }) => {
    check("W11: latest full-year median > £1,000,000", (stats.latestYear.median ?? 0) > 1_000_000);
  });
  // SW9 6BE (Brixton)
  await runDataCase("SW9 6BE");
  // LD1 5DL (Llandrindod Wells) — rural WALES: must be accepted (country=Wales), likely sparser years
  await runDataCase("LD1 5DL", ({ loc }) => {
    check("LD1: accepted as England & Wales (country=Wales)", loc.country === "Wales");
  });

  // EH1 1YZ (Edinburgh) — SCOTLAND: reject
  await runRejectCase("EH1 1YZ", ErrorCodes.UNSUPPORTED_NATION);
  // garbage input — invalid
  await runRejectCase("NOTAPOSTCODE", ErrorCodes.INVALID_POSTCODE);

  // ── Bare outcodes (district-wide) ──────────────────────────────────────────
  // "E8" with no incode must resolve district-wide (centroid), not hit the invalid
  // card — the SEO guides tell users to "generate your E8 brief".
  hr();
  console.log(`▶ E8 (bare outcode — expect district-wide resolve)`);
  const e8 = await resolve("E8");
  console.log(`   location: outcode=${e8.outcode}  outcodeOnly=${e8.outcodeOnly}  LA=${e8.localAuthority}  country=${e8.country}  (${e8.lat}, ${e8.lng})`);
  check("bare E8: resolves as outcode-only (district-wide)", e8.outcodeOnly === true);
  check("bare E8: outcode is E8, postcode display is the district", e8.outcode === "E8" && e8.postcode === "E8");
  // A bare Scottish outcode must still be rejected as unsupported nation.
  await runRejectCase("EH1", ErrorCodes.UNSUPPORTED_NATION);

  hr();
  console.log(`\nRESULT: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log("All spine assertions passed.");
}

main().catch((err) => {
  console.error("\nUNEXPECTED ERROR (a case threw where it should not have):");
  console.error(err);
  process.exit(1);
});
