/**
 * scripts/shape-diff.mjs — enumerate, empirically, every field the below-floor
 * price payload nulls or omits relative to a normal one.
 *
 * Read from the REAL builders, not from reading the source: the whole class of bug
 * here is code that looks right and behaves otherwise.
 */
import { computeStats } from "../lib/brief/stats.js";
import { buildPricesSection } from "../lib/brief/sections/prices.js";

const mk = (y, n, base, spread) =>
  Array.from({ length: n }, (_, i) => ({
    id: `x${y}${i}`, price: base + Math.round((i / n) * spread), date: `${y}-06-15`,
    postcode: "E20 1AA", paon: String(i), saon: "", street: "A ROAD", town: "LONDON",
    propertyType: "Flat", tenure: "Leasehold", newBuild: false, category: "standard",
  }));

const WINDOW = { startYear: 2016, endYear: 2025 };
const spine = { asOf: { published: "2026-07-28", label: "July 2026", statement: "x", refreshOverdue: false }, sectorContext: null };

// NORMAL: comfortably above every floor.
const normal = buildPricesSection(
  computeStats({ district: "E20", window: WINDOW, transactions: [...mk(2024, 300, 560000, 90000), ...mk(2025, 300, 600000, 90000)] }),
  { outcode: "E20" }, "INV", spine);

// BELOW-FLOOR: LL78-like, 90 sales across the window.
const below = buildPricesSection(
  computeStats({ district: "LL78", window: WINDOW, transactions: [...mk(2024, 45, 200000, 80000), ...mk(2025, 45, 230000, 80000)] }),
  { outcode: "LL78" }, "INV", spine);

/** Every leaf path in an object, with its type. */
function paths(o, prefix = "", out = new Map()) {
  if (o === null || typeof o !== "object") { out.set(prefix, o === null ? "null" : typeof o); return out; }
  if (Array.isArray(o)) { out.set(prefix, `array[${o.length}]`); if (o.length) paths(o[0], `${prefix}[0]`, out); return out; }
  for (const [k, v] of Object.entries(o)) paths(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

const pn = paths(normal);
const pb = paths(below);
const bar = "─".repeat(84);

console.log(`\n${"═".repeat(84)}\nBELOW-FLOOR PRICE PAYLOAD — what differs from a normal one\n${"═".repeat(84)}`);
console.log(`normal state: ${normal.state}   ·   below-floor state: ${below.state}\n`);

console.log(`FIELDS PRESENT IN NORMAL, NULL OR ABSENT BELOW-FLOOR:\n${bar}`);
const risky = [];
for (const [p, t] of pn) {
  if (!pb.has(p)) { console.log(`  ABSENT  ${p}`.padEnd(56) + `(normal: ${t})`); risky.push([p, "ABSENT"]); }
  else if (pb.get(p) === "null" && t !== "null") { console.log(`  NULL    ${p}`.padEnd(56) + `(normal: ${t})`); risky.push([p, "NULL"]); }
}
if (!risky.length) console.log("  (none)");

console.log(`\nFIELDS PRESENT ONLY BELOW-FLOOR:\n${bar}`);
let extra = 0;
for (const [p, t] of pb) if (!pn.has(p)) { console.log(`  ONLY    ${p}`.padEnd(56) + `(${t})`); extra++; }
if (!extra) console.log("  (none)");

console.log(`\nTOP-LEVEL data.* KEYS\n${bar}`);
console.log(`  normal:      ${Object.keys(normal.data).join(", ")}`);
console.log(`  below-floor: ${Object.keys(below.data).join(", ")}`);
console.log(`  data.marketOverview  normal=${typeof normal.data.marketOverview}  below=${JSON.stringify(below.data.marketOverview)}`);
console.log(`  data.negotiation     normal=${typeof normal.data.negotiation}  below=${typeof below.data.negotiation}`);
console.log("");
