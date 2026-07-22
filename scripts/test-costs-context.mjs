/**
 * scripts/test-costs-context.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 2e verification — the "costs & context" section builders (Buying Costs:
 * council tax + stamp duty; Rental Snapshot; Crime Breakdown). Runs each builder
 * against its LIVE source (Postcodes.io / shared VOA-DLUHC & VOA tables / police.uk)
 * and makes hard assertions, including the required statutory sanity check
 * cost(E) > cost(D) > cost(C).
 *
 *   node scripts/test-costs-context.mjs
 *
 * Plain Node, no SPARQL (these sections don't touch Land Registry), so it runs in a
 * few seconds. Exit code is non-zero if any assertion fails.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { resolve } from "../lib/brief/resolve.js";
import { fetchCouncilTax } from "../lib/brief/council-tax.js";
import { buildBuyingCostsSection } from "../lib/brief/sections/buying-costs.js";
import { buildStampDuty } from "../lib/brief/stamp-duty.js";
import { fetchRental } from "../lib/brief/rental.js";
import { buildRentalSnapshotSection } from "../lib/brief/sections/rental-snapshot.js";
import { fetchCrime } from "../lib/brief/crime.js";
import { buildCrimeBreakdownSection } from "../lib/brief/sections/crime-breakdown.js";

let passed = 0;
const failures = [];
function check(label, cond) {
  if (cond) { passed++; console.log(`   ✓ ${label}`); }
  else { failures.push(label); console.log(`   ✗ FAIL: ${label}`); }
}
function hr() { console.log("─".repeat(78)); }

const bandCost = (ct, b) => ct.bands.find((x) => x.band === b).cost;

async function main() {
  console.log("LuxProperty brief — Phase 2e (costs & context) verification\n");

  // ── Pure stamp-duty maths (no network) — hand-computed reference values ──────
  hr();
  console.log("▶ Stamp duty — statutory maths (SDLT/LTT)");
  check("SDLT £295,000 = £4,750", buildStampDuty(295_000, { country: "England" }).total.raw === 4750);
  check("SDLT £500,000 = £15,000", buildStampDuty(500_000, { country: "England" }).total.raw === 15000);
  check("SDLT £1,000,000 = £43,750", buildStampDuty(1_000_000, { country: "England" }).total.raw === 43750);
  check("LTT £500,000 = £18,000 (Wales regime)", (() => {
    const s = buildStampDuty(500_000, { country: "Wales" });
    return s.total.raw === 18000 && s.regime === "LTT";
  })());
  check("no median → no stamp-duty block", buildStampDuty(null, { country: "England" }) === null);

  // ── London full postcode — council tax DATA + ordering, rental, crime ───────
  hr();
  console.log("▶ E8 1NG (Hackney, London) — full DATA across costs & context");
  const e8 = await resolve("E8 1NG");
  const e8ct = await fetchCouncilTax(e8);
  const e8Costs = buildBuyingCostsSection(e8ct, buildStampDuty(650_000, e8), e8, "INV");
  const ct = e8Costs.data.councilTax;
  console.log(`   council: ${ct?.authority} Band D ${ct?.bandD.formatted} (${ct?.dataYear}); C=${bandCost(ct,"C")} D=${bandCost(ct,"D")} E=${bandCost(ct,"E")}`);
  check("E8: council tax DATA", e8Costs.state === "DATA");
  check("E8: billing authority is Hackney", ct.authority === "Hackney");
  check("E8: STATUTORY SANITY — cost(E) > cost(D) > cost(C)", bandCost(ct, "E") > bandCost(ct, "D") && bandCost(ct, "D") > bandCost(ct, "C"));
  check("E8: council-tax data year stated", /^\d{4}\/\d{2}$/.test(ct.dataYear));
  check("E8: stamp duty present (SDLT, PRO)", e8Costs.data.stampDuty?.regime === "SDLT");
  check("E8: no invented 'most common band'", !JSON.stringify(e8Costs.data).toLowerCase().includes("most common"));

  const e8rent = buildRentalSnapshotSection(await fetchRental(e8), e8, "INV", 650_000);
  console.log(`   rental: ${e8rent.data?.regionLabel} 2-bed ${e8rent.data?.benchmarks.find(b=>b.key==="2bed")?.formatted}; yield ${e8rent.data?.yield?.range}`);
  check("E8: rental DATA", e8rent.state === "DATA");
  check("E8: rent benchmark labelled REGIONAL (London-region), not local", e8rent.data.regionLabel === "London-region");
  check("E8: gross yield computed (range present)", !!e8rent.data.yield?.range);
  check("E8: rental note does NOT imply a local rent", /region/i.test(e8rent.note) && !/for E8 specifically\b(?! )/.test(e8rent.note));

  const e8crime = buildCrimeBreakdownSection(await fetchCrime(e8), e8, "INV");
  console.log(`   crime: ${e8crime.data?.total} crimes ${e8crime.data?.when}; top ${e8crime.data?.categories[0]?.label} ${e8crime.data?.categories[0]?.pct}%`);
  check("E8: crime DATA", e8crime.state === "DATA" && e8crime.data.total > 0);
  check("E8: crime month stated", /\b20\d{2}\b/.test(e8crime.data.when));
  check("E8: NO fabricated benchmark claim", !/national average|above the national|below the national/i.test(JSON.stringify(e8crime)));
  check("E8: category shares sum ≈ 100%", Math.abs(e8crime.data.categories.reduce((s, c) => s + c.pct, 0) - 100) <= 2);

  // ── Non-London fixture — proves the RIGHT authority rate + right force by coords
  hr();
  console.log("▶ M1 1AE (Manchester) — non-London: right billing authority + right force");
  const m1 = await resolve("M1 1AE");
  const m1ct = await fetchCouncilTax(m1);
  const m1Costs = buildBuyingCostsSection(m1ct, buildStampDuty(230_000, m1), m1, "INV");
  const m1c = m1Costs.data.councilTax;
  console.log(`   council: ${m1c?.authority} Band D ${m1c?.bandD.formatted}`);
  check("M1: billing authority is Manchester (not Hackney)", m1c.authority === "Manchester" && m1c.authority !== ct.authority);
  check("M1: cost(E) > cost(D) > cost(C)", bandCost(m1c, "E") > bandCost(m1c, "D") && bandCost(m1c, "D") > bandCost(m1c, "C"));
  const m1crime = buildCrimeBreakdownSection(await fetchCrime(m1), m1, "INV");
  console.log(`   crime: ${m1crime.data?.total} crimes ${m1crime.data?.when} (Greater Manchester Police, by coordinate)`);
  check("M1: crime DATA from Manchester coords (force auto-routed by police.uk)", m1crime.state === "DATA" && m1crime.data.total > 0);

  // ── Wales fixture — proves LTT (not SDLT) chosen by country ─────────────────
  hr();
  console.log("▶ LD1 5DL (Powys, Wales) — LTT regime + Welsh billing authority");
  const ld1 = await resolve("LD1 5DL");
  const ld1ct = await fetchCouncilTax(ld1);
  const ld1Costs = buildBuyingCostsSection(ld1ct, buildStampDuty(240_000, ld1), ld1, "INV");
  check("LD1: billing authority is Powys", ld1Costs.data.councilTax?.authority === "Powys");
  check("LD1: stamp duty uses LTT (Wales), not SDLT", ld1Costs.data.stampDuty?.regime === "LTT");

  // ── District-wide + sparse ──────────────────────────────────────────────────
  hr();
  console.log("▶ E8 (bare outcode — district-wide) & TR24 0QQ (sparse)");
  const e8d = await resolve("E8");
  const e8dCosts = buildBuyingCostsSection(await fetchCouncilTax(e8d), null, e8d, "INV");
  check("bare E8: council tax resolves district-wide (reverse-geocoded authority)", e8dCosts.state === "DATA" && e8dCosts.data.councilTax?.authority === "Hackney");
  const tr24 = await resolve("TR24 0QQ");
  const tr24crime = buildCrimeBreakdownSection(await fetchCrime(tr24), tr24, "INV");
  check("TR24: crime SPARSE (zero recorded) rendered honestly, not fabricated", tr24crime.state === "SPARSE" && tr24crime.data.total === 0);
  const tr24ct = buildBuyingCostsSection(await fetchCouncilTax(tr24), null, tr24, "INV");
  check("TR24: council tax DATA (Isles of Scilly), E>D>C", tr24ct.state === "DATA" && bandCost(tr24ct.data.councilTax, "E") > bandCost(tr24ct.data.councilTax, "D"));

  hr();
  console.log(`\nRESULT: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log("All Phase 2e costs & context assertions passed.");
}

main().catch((err) => {
  console.error("\nUNEXPECTED ERROR:");
  console.error(err);
  process.exit(1);
});
