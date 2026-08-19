/**
 * scripts/test-client-render.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * RENDERS THE CLIENT. Every other suite tests the server.
 *
 * WHY: on 2026-08-19, test-section-titles (7/7), test-sector-e2e, test-gating
 * (257/257) and tsc all passed while LL78 8JJ white-screened with
 * `Cannot read properties of null (reading 'latestYear')`. The server payload was
 * valid — the client crashed rendering it. Nothing in the repo mounted a component.
 *
 * The same seam had already broken once: a below-floor payload sets
 * data.marketOverview to null, and the market-overview grid dereferences
 * mo.latestYear in six places. A guard was added ABOVE that grid as a SIBLING
 * rather than an else, so both rendered and the second one threw.
 *
 * So this file feeds REAL server payloads — produced by the real section builders —
 * into the REAL React components, and asserts they render. It is the only test here
 * that would have caught it.
 *
 * BRANCH COVERAGE, as elsewhere: every render state a section can emit must have a
 * case, and the suite FAILS if one does not. States are read from the payloads the
 * builders actually produce, not from a hand-written list, so a new state cannot be
 * added without a case appearing for it.
 *
 *   node scripts/test-client-render.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { computeStats } from "../lib/brief/stats.js";
import { buildPricesSection } from "../lib/brief/sections/prices.js";
import { buildStreetRankingSection } from "../lib/brief/sections/street-ranking.js";
import { buildNearbySoldPricesSection } from "../lib/brief/sections/nearby-sold-prices.js";
import { classifySector } from "../lib/brief/tx-agg.js";
import { applySectorPolicy } from "../lib/brief/tx-source.js";

let passed = 0, failed = 0;
const failures = [];
const check = (label, ok, detail = "") => {
  if (ok) { passed++; console.log(`   ✓ ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`   ✗ FAIL: ${label}${detail ? ` — ${detail}` : ""}`); }
};

// ── build the client components for node ─────────────────────────────────────
// esbuild is already a dependency. Bundling brief.tsx pulls in the real component
// tree; browser-only leaves (leaflet, wouter navigation) are stubbed rather than
// mocked away from the components under test.
// Inside the repo, not the OS temp dir: react/react-dom are marked external so the
// bundle imports them at runtime, and node resolves those from the nearest
// node_modules. A bundle in /tmp has none.
const outdir = path.join("node_modules", ".cache", "brief-render");
fs.mkdirSync(outdir, { recursive: true });
const outfile = path.join(outdir, "brief.cjs");

const stubPlugin = {
  name: "stub-browser-only",
  setup(b) {
    b.onResolve({ filter: /^(leaflet|react-leaflet)/ }, () => ({ path: "stub", namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export default {}; export const Map = {};", loader: "js" }));
  },
};

await build({
  entryPoints: ["client/src/pages/brief.tsx"],
  // CJS, not ESM: transitive CommonJS deps (use-sync-external-store) call
  // require("react") at load time, which an ESM bundle cannot satisfy for an
  // external. react/react-dom stay external so the components and renderToString
  // share ONE React instance — bundling React would give two and fail at render.
  outfile, bundle: true, format: "cjs", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/server"],
  loader: { ".css": "empty", ".svg": "empty", ".png": "empty" },
  plugins: [stubPlugin],
  logLevel: "silent",
  define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true", "import.meta.env.MODE": '"production"' },
  tsconfig: "tsconfig.json",
});

const { renderToString } = await import("react-dom/server");
const React = (await import("react")).default;
const require_ = (await import("node:module")).createRequire(import.meta.url);
delete require_.cache?.[path.resolve(outfile)];
const mod = require_(path.resolve(outfile));

// ── real payloads, from the real builders ────────────────────────────────────
const WINDOW = { startYear: 2016, endYear: 2025 };
const ASOF = { published: "2026-07-28", label: "July 2026", statement: "Sold price data as of July 2026.", refreshOverdue: false };
const mk = (y, n, base, spread, street = "A ROAD") =>
  Array.from({ length: n }, (_, i) => ({
    id: `${y}-${street}-${i}`, price: base + Math.round((i / n) * spread), date: `${y}-06-15`,
    postcode: "E20 1AA", paon: String(i + 1), saon: "", street, town: "LONDON",
    propertyType: "Flat", tenure: "Leasehold", newBuild: false, category: "standard",
  }));

function spineOf(district, txns, sector = null) {
  const byStreet = new Map();
  for (const t of txns) {
    const k = t.street.toUpperCase();
    let a = byStreet.get(k); if (!a) byStreet.set(k, (a = [])); a.push(t.price);
  }
  const streets = [];
  for (const [street, prices] of byStreet) {
    if (prices.length < 8) continue;
    prices.sort((a, b) => a - b);
    const mid = prices.length >> 1;
    streets.push({
      street, count: prices.length,
      median: prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2),
      ciLo: prices[Math.floor(prices.length * 0.15)], ciHi: prices[Math.floor(prices.length * 0.85)],
      p25: prices[Math.floor(prices.length * 0.25)], p75: prices[Math.floor(prices.length * 0.75)],
    });
  }
  return {
    source: "aggregate", district, window: WINDOW, asOf: ASOF,
    streets, streetsTotal: byStreet.size, recent: txns.slice(0, 40),
    totalCount: txns.length, recentWindowCount: txns.length, sectorContext: sector, txSet: null,
  };
}

/** The four price-path states, plus the two sparse states, from real builders. */
function cases() {
  const out = [];

  // WARN — E20 3BE: sector diverges beyond its error bar, ranges withheld.
  {
    const txns = [...mk(2024, 300, 560000, 90000, "VILLIERS GARDENS"), ...mk(2025, 300, 600000, 90000, "FORBES LANE")];
    let stats = computeStats({ district: "E20", window: WINDOW, transactions: txns });
    const sc = classifySector({ sector: "E20 3", txCount: 76, median: 741250, ciLo: 680000, ciHi: 770000 }, stats.medianPrice);
    stats = applySectorPolicy(stats, sc, "E20", 76);
    const spine = { ...spineOf("E20", txns), sectorContext: sc };
    out.push({ name: "warn (E20 3BE)", spine, stats, expectPriceState: "DATA" });
  }
  // NONE — E20 1HT: in-line sector, nothing withheld.
  {
    const txns = [...mk(2024, 300, 560000, 90000, "MADISON WAY"), ...mk(2025, 300, 600000, 90000, "LOGAN CLOSE")];
    const stats = computeStats({ district: "E20", window: WINDOW, transactions: txns });
    const sc = classifySector({ sector: "E20 1", txCount: 1172, median: 589500, ciLo: 580000, ciHi: 595000 }, stats.medianPrice);
    out.push({ name: "none (E20 1HT)", spine: { ...spineOf("E20", txns), sectorContext: sc }, stats, expectPriceState: "DATA" });
  }
  // BELOW-FLOOR — LL78 8JJ: under the 100-sale floor. THE CRASH.
  {
    const txns = [...mk(2024, 45, 200000, 80000, "BUSH TERRACE"), ...mk(2025, 45, 230000, 80000, "MILL LANE")];
    const stats = computeStats({ district: "LL78", window: WINDOW, transactions: txns });
    out.push({ name: "below-floor (LL78 8JJ)", spine: spineOf("LL78", txns), stats, expectPriceState: "SPARSE" });
  }
  // SPARSE STREETS — too few qualifying streets to form blocks.
  {
    const txns = [...mk(2024, 150, 300000, 60000, "ONLY STREET"), ...mk(2025, 150, 320000, 60000, "ONLY STREET")];
    const stats = computeStats({ district: "TA15", window: WINDOW, transactions: txns });
    out.push({ name: "sparse streets (TA15)", spine: spineOf("TA15", txns), stats, expectPriceState: "DATA" });
  }
  // SPARSE byYEAR — years below the 5-sale floor: medians withheld, dashes rendered.
  {
    // Thin YEARS (2023: 3 sales, 2024: 2) inside a district with ample total volume,
    // so the price section is DATA while individual byYear rows withhold their median.
    const txns = [...mk(2019, 200, 400000, 50000, "THIN ROAD"), ...mk(2021, 200, 410000, 50000, "THIN ROAD"),
                  ...mk(2023, 3, 420000, 10000, "THIN ROAD"), ...mk(2024, 2, 430000, 10000, "THIN ROAD"),
                  ...mk(2025, 200, 450000, 50000, "THIN ROAD")];
    const stats = computeStats({ district: "SA35", window: WINDOW, transactions: txns });
    out.push({ name: "sparse byYear (SA35)", spine: spineOf("SA35", txns), stats, expectPriceState: "DATA" });
  }
  // STREET DATA — six streets clearing the 12-sale minimum, in two clearly separated
  // price bands so the dearer/cheaper block claim holds. Without this the suite has no
  // case producing street state DATA, which the coverage rule refuses to let pass.
  {
    // TEN streets, five per band: the section shows five at each end, so with only six
    // the top block necessarily contains cheap streets and the block claim correctly
    // fails. Five and five is the smallest set that can separate.
    const dear = ["ABERCROMBIE ROAD", "VILLIERS GARDENS", "FORBES LANE", "KEIRIN ROAD", "TANDY PLACE"]
      .flatMap((st) => mk(2024, 40, 900000, 20000, st));
    const cheap = ["GLASSHOUSE GARDENS", "MADISON WAY", "LOGAN CLOSE", "CHERRY ORCHARD", "SYDENHAM ROAD"]
      .flatMap((st) => mk(2025, 40, 400000, 20000, st));
    const txns = [...dear, ...cheap];
    const stats = computeStats({ district: "CR0", window: WINDOW, transactions: txns });
    out.push({ name: "street blocks (CR0)", spine: spineOf("CR0", txns), stats, expectPriceState: "DATA" });
  }
  return out;
}

const bar = "─".repeat(78);
console.log(`\n${"═".repeat(78)}\nCLIENT RENDER — real payloads into real components\n${"═".repeat(78)}`);

const priceStatesSeen = new Set();
const streetStatesSeen = new Set();

for (const c of cases()) {
  console.log(`\n▶ ${c.name}\n${bar}`);
  const prices = buildPricesSection(c.stats, { outcode: c.spine.district }, "INV", c.spine);
  const street = buildStreetRankingSection(c.spine, { outcode: c.spine.district }, "INV", c.stats.medianPrice);
  const nearby = buildNearbySoldPricesSection(c.spine, { outcode: c.spine.district }, "INV", c.stats.medianPrice);
  priceStatesSeen.add(prices.state);
  streetStatesSeen.add(street.state);

  check(`${c.name}: price section state is ${c.expectPriceState}`, prices.state === c.expectPriceState, `got ${prices.state}`);

  for (const [label, Component, section] of [
    ["PricesSection", mod.PricesSection, prices],
    ["StreetRankingSection", mod.StreetRankingSection, street],
  ]) {
    let html = null, err = null;
    try { html = renderToString(React.createElement(Component, { section })); }
    catch (e) { err = e; }
    check(`${c.name}: ${label} renders`, !err, err ? `${err.constructor.name}: ${err.message}` : "");
    if (html != null) {
      check(`${c.name}: ${label} produced markup`, html.length > 50, `${html.length} chars`);
      check(`${c.name}: ${label} has no literal "undefined"/"null" in text`,
        !/>(\s*)(undefined|null)(\s*)</.test(html), "a nulled field leaked into rendered text");
    }
  }
  void nearby;
}

// ── branch coverage ──────────────────────────────────────────────────────────
console.log(`\n▶ Branch coverage\n${bar}`);
const PRICE_STATES = ["DATA", "SPARSE"];
const STREET_STATES = ["DATA", "SPARSE"];
console.log(`   price states exercised:  ${[...priceStatesSeen].sort().join(", ")}`);
console.log(`   street states exercised: ${[...streetStatesSeen].sort().join(", ")}`);
for (const [label, want, seen] of [["price", PRICE_STATES, priceStatesSeen], ["street", STREET_STATES, streetStatesSeen]]) {
  const missing = want.filter((w) => !seen.has(w));
  check(`every ${label} render state has a case`, missing.length === 0,
    missing.length ? `no case produces: ${missing.join(", ")} — add one before shipping` : "");
}

fs.rmSync(outdir, { recursive: true, force: true });
console.log(`\n${bar}\n${passed} passed, ${failed} failed`);
if (failures.length) { console.log(`\nFAILURES:`); for (const f of failures) console.log(`  - ${f}`); }
console.log("");
process.exit(failed ? 1 : 0);
