/**
 * scripts/test-section-titles.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Section titles must RENDER — not merely exist as source.
 *
 * WHY: "Recent sales in {outcode}" interpolates a value off the builder's first
 * parameter. A later change renaming that parameter merges CLEANLY (git sees one
 * side touch the title line and the other touch the signature) and produces
 * `ReferenceError: txSet is not defined` at request time. Nothing caught it: the
 * gating suite asserts the section KEY, and the end-to-end suite asserts the
 * payload's fields — neither reads the title. A 500 would have been the first sign.
 *
 * So: invoke every builder whose title is templated, and assert the title renders
 * with the district interpolated.
 *
 * SCOPE, honestly: this constructs its input, so it cannot catch a bug in how that
 * input is BUILT — that is what scripts/test-sector-e2e.mjs is for. What it does
 * catch is a builder that throws, or a title that silently loses its interpolation,
 * which is exactly the failure mode a parameter rename creates.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { buildNearbySoldPricesSection } from "../lib/brief/sections/nearby-sold-prices.js";
import { buildSoldPricesMapSection } from "../lib/brief/sections/sold-prices-map.js";

let passed = 0;
let failed = 0;
const failures = [];

function check(label, ok, detail = "") {
  if (ok) { passed++; console.log(`   ✓ ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`   ✗ FAIL: ${label}${detail ? ` — ${detail}` : ""}`); }
}

/** A minimal in-district set, shaped as the builders expect. */
const DISTRICT = "E20";
const txns = Array.from({ length: 14 }, (_, i) => ({
  id: `T${i}`,
  price: 500_000 + i * 10_000,
  date: `2025-0${(i % 9) + 1}-15`,
  postcode: `${DISTRICT} 1A${String.fromCharCode(65 + (i % 20))}`,
  paon: String(i + 1),
  saon: "",
  street: "VICTORY PARADE",
  town: "LONDON",
  propertyType: "Flat",
  tenure: "Leasehold",
  newBuild: false,
  category: "standard",
}));

/** Both shapes, so this file keeps working across the spine swap: the legacy
 *  TransactionSet and the Spine that replaces it. Whichever the builder takes, the
 *  title must still name the district. */
const legacyTxSet = { district: DISTRICT, window: { startYear: 2016, endYear: 2025 }, transactions: txns, meta: { count: txns.length } };
const spine = {
  source: "aggregate", district: DISTRICT, window: { startYear: 2016, endYear: 2025 },
  recent: txns, totalCount: txns.length, streets: [], streetsTotal: 0,
  recentWindowCount: txns.length, asOf: null, sectorContext: null, txSet: null,
};

const location = { outcode: DISTRICT, postcode: `${DISTRICT} 1AA`, sector: `${DISTRICT} 1` };

console.log(`\n${"═".repeat(70)}\nSECTION TITLES RENDER\n${"═".repeat(70)}\n`);

for (const [name, builder, extra] of [
  ["Nearby / Recent sales", buildNearbySoldPricesSection, 592_000],
  ["Sold Prices Map", buildSoldPricesMapSection, new Map()],
]) {
  let section = null;
  let error = null;
  // Try the Spine first, fall back to the legacy set — one of the two is current.
  for (const input of [spine, legacyTxSet]) {
    try { section = builder(input, location, "INV", extra); error = null; break; }
    catch (e) { error = e; }
  }
  check(`${name}: builder does not throw`, !!section && !error,
    error ? `${error.constructor.name}: ${error.message}` : "");
  if (!section) continue;

  check(`${name}: title is a non-empty string`, typeof section.title === "string" && section.title.length > 0,
    `got ${JSON.stringify(section.title)}`);
  check(`${name}: title has no unresolved interpolation`, !/\$\{|undefined|\[object/.test(section.title),
    `got ${JSON.stringify(section.title)}`);

  // Only the renamed section templates its district into the title.
  if (section.key === "nearbySoldPrices") {
    check(`${name}: title names the district`, section.title.includes(DISTRICT),
      `got ${JSON.stringify(section.title)} — the interpolation resolved to nothing`);
    console.log(`     → "${section.title}"`);
  }
}

console.log(`\n${"─".repeat(70)}\n${passed} passed, ${failed} failed`);
if (failures.length) { console.log(`\nFAILURES:`); for (const f of failures) console.log(`  - ${f}`); }
console.log("");
process.exit(failed ? 1 : 0);
