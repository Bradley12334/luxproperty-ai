/**
 * scripts/test-phase2f.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 2f verification — the derived & curated section builders:
 *   Executive Summary, Neighbourhood Profile (+ resident sentiment), Pre-offer
 *   Questions, Planning Activity & Risk Flags, Development Tracker, Letting Economics.
 *
 *   node scripts/test-phase2f.mjs
 *
 * The pure builders are exercised with synthetic payload inputs (no SPARQL); the two
 * network fetchers (planning.data.gov.uk designations, Overpass parks-via-amenities)
 * are hit live with a handful of assertions. The GOVERNING RULE is checked directly:
 * derived scores are pure functions of visible inputs; curated blocks render only
 * where curation exists; nothing renders from constants for un-curated areas.
 *
 * Complements scripts/test-spine.mjs (still 23/23). Exit code non-zero on any failure.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { buildExecutiveSummarySection } from "../lib/brief/sections/executive-summary.js";
import { buildNeighbourhoodSection } from "../lib/brief/sections/neighbourhood.js";
import { buildPreOfferQuestionsSection } from "../lib/brief/sections/pre-offer-questions.js";
import { buildPlanningActivitySection } from "../lib/brief/sections/planning-activity.js";
import { buildDevelopmentTrackerSection } from "../lib/brief/sections/development-tracker.js";
import { buildRentalDemandSection } from "../lib/brief/sections/rental-demand.js";
import { fetchPlanning } from "../lib/brief/planning.js";
import { fetchAmenities } from "../lib/brief/overpass.js";
import { residentSentimentFor } from "../lib/brief/neighbourhood-sentiment.js";
import { developmentSchemesFor } from "../lib/brief/development-schemes.js";

let passed = 0;
const failures = [];
function check(label, cond) {
  if (cond) { passed++; console.log(`   ✓ ${label}`); }
  else { failures.push(label); console.log(`   ✗ FAIL: ${label}`); }
}
function hr() { console.log("─".repeat(78)); }

const E8 = { postcode: "E8 1NG", outcode: "E8", ward: "Hackney Central", localAuthority: "Hackney", region: "London", country: "England", lat: 51.54814, lng: -0.067554, outcodeOnly: false };
const TR24 = { postcode: "TR24 0QQ", outcode: "TR24", ward: "", localAuthority: "Isles of Scilly", region: "South West", country: "England", lat: 49.9146, lng: -6.2969, outcodeOnly: false };
const M1 = { postcode: "M1 1AA", outcode: "M1", ward: "Piccadilly", localAuthority: "Manchester", region: "North West", country: "England", lat: 53.478, lng: -2.238, outcodeOnly: false };

const risingStats = { available: true, district: "E8", window: { startYear: 2016, endYear: 2025 }, totalCount: 400, medianPrice: 585000, latestYear: { year: 2025, count: 48, median: 620000 }, previousYear: { year: 2024, count: 40, median: 585000 }, yoyChangePct: 6.0, confidence: { level: "high", note: "ok", totalCount: 400 } };
const softStats = { ...risingStats, yoyChangePct: -4.2, confidence: { level: "low", note: "thin", totalCount: 8 }, totalCount: 8 };

async function main() {
  console.log("LuxProperty brief — Phase 2f (derived & curated) verification\n");

  // ── Executive Summary ───────────────────────────────────────────────────────
  hr(); console.log("▶ Executive Summary — thresholds & provenance");
  const exRise = buildExecutiveSummarySection(risingStats, E8, "INV");
  check("rising market classified 'Rising'", exRise.data.classification.trajectory === "rising");
  check("every signal names a source", exRise.data.signals.every((s) => s.source && s.value !== undefined));
  const exSoft = buildExecutiveSummarySection(softStats, E8, "INV");
  check("softening market classified 'softening'", exSoft.data.classification.trajectory === "softening");
  check("low confidence → SPARSE state", exSoft.state === "SPARSE");
  const exNull = buildExecutiveSummarySection(null, E8, "INV");
  check("no stats → UNAVAILABLE but still location-specific", exNull.state === "UNAVAILABLE" && exNull.data.paragraphs[0].includes("Hackney Central"));

  // ── Neighbourhood Profile (+ sentiment) — LIVE amenities/parks ──────────────
  hr(); console.log("▶ Neighbourhood Profile — pure-function dimensions + curated sentiment (live Overpass)");
  const amen = await fetchAmenities(E8);
  check("amenities+parks fetch ok", amen.ok === true);
  check("parks folded into amenities result", amen.groups.parks && amen.groups.parks.total >= 1);
  const stationsData = { stationsState: "found", nearest: { name: "Hackney Central", walkMins: 6 }, stations: [{ name: "Hackney Central", lines: ["Overground"], walkMins: 6, distanceMeters: 500 }, { name: "London Fields", lines: ["Overground"], walkMins: 12, distanceMeters: 1000 }] };
  const schoolsData = { schools: [{ name: "A", walkMins: 8, distanceMeters: 650 }, { name: "B", walkMins: 11, distanceMeters: 900 }, { name: "C", walkMins: 13, distanceMeters: 1050 }] };
  const crimeData = { total: 200, when: "May 2026", categories: [{ key: "anti-social-behaviour", label: "Anti-social behaviour", count: 60, pct: 30 }, { key: "violent-crime", label: "Violence & sexual offences", count: 40, pct: 20 }] };
  const nb = buildNeighbourhoodSection({ stationsData, amenitiesResult: amen, schoolsData, crimeData, floodData: { riskBand: "Very Low", planningZone: 1 }, stats: risingStats }, E8, "INV");
  check("all five dimensions present", nb.data.dimensions.length === 5);
  check("every rated dimension exposes its inputs", nb.data.dimensions.filter((d) => d.tier !== "insufficient").every((d) => d.inputs.length > 0));
  check("E8 has curated sentiment (dated)", nb.data.sentiment.available && nb.data.sentiment.asOf === "2025");
  // Missing-input rule: unavailable amenities → convenience & green 'insufficient', never a default score.
  const nbSparse = buildNeighbourhoodSection({ stationsData: { stationsState: "unavailable" }, amenitiesResult: { ok: false }, schoolsData: { schools: [] }, crimeData: null, floodData: null, stats: { available: false } }, TR24, "INV");
  check("missing inputs → 'insufficient', not a default score", nbSparse.data.dimensions.filter((d) => d.tier === "insufficient").length >= 4);
  check("TR24 → no curated sentiment (honest omission)", nbSparse.data.sentiment.available === false && !nbSparse.data.sentiment.text);
  check("M1 sentiment is Manchester content, not London leak", /Ancoats|Northern Quarter/.test(residentSentimentFor("M1").text) && !/Notting|Hackney|Belgravia/.test(residentSentimentFor("M1").text));

  // ── Pre-offer Questions — trigger gating ────────────────────────────────────
  hr(); console.log("▶ Pre-offer Questions — trigger gating");
  const txLease = { transactions: Array.from({ length: 20 }, (_, i) => ({ category: "standard", date: "2024-06-01", tenure: i < 14 ? "Leasehold" : "Freehold", newBuild: i < 7 })) };
  const q = buildPreOfferQuestionsSection({ stats: softStats, txSet: txLease, floodData: { riskBand: "Medium", planningZone: 2 }, crimeData }, E8, "INV");
  const keys = q.data.groups.map((g) => g.key);
  check("flood trigger fired", keys.includes("flood"));
  check("softening-price trigger fired", keys.includes("pricing"));
  check("leasehold trigger fired (14/20)", keys.includes("leasehold"));
  check("universal set always present", keys.includes("universal"));
  const qNone = buildPreOfferQuestionsSection({ stats: risingStats, txSet: { transactions: Array.from({ length: 10 }, () => ({ category: "standard", date: "2024-01-01", tenure: "Freehold", newBuild: false })) }, floodData: { riskBand: "Very Low", planningZone: 1 }, crimeData: { total: 0, categories: [] } }, E8, "INV");
  check("no triggers → only universal set", qNone.data.groups.length === 1 && qNone.data.groups[0].key === "universal");

  // ── Planning Activity — LIVE planning.data.gov.uk ───────────────────────────
  hr(); console.log("▶ Planning Activity — live MHCLG designations + payload-derived flags");
  const pr = await fetchPlanning(E8);
  check("planning fetch ok", pr.ok === true);
  const pl = buildPlanningActivitySection(pr, { stats: softStats, floodData: { riskBand: "Very Low", planningZone: 1 }, crimeData }, E8, "INV");
  check("E8 returns a real conservation-area designation", pl.data.designations.some((d) => d.dataset === "conservation-area"));
  check("no fabricated application count anywhere", JSON.stringify(pl.data).toLowerCase().includes("aren't available") || pl.data.applicationsNote.includes("aren't available"));
  check("softening-price flag derived from payload", pl.data.flags.some((f) => f.key === "prices"));
  check("Hackney portal is curated link-out", pl.data.portal.curated === true && pl.data.portal.url.includes("hackney"));
  const trPl = buildPlanningActivitySection(await fetchPlanning(TR24), { stats: { available: false }, floodData: null, crimeData: null }, TR24, "INV");
  check("TR24 → AONB designation present", trPl.data.designations.some((d) => d.dataset === "area-of-outstanding-natural-beauty"));

  // ── Development Tracker — curated-where-exists ───────────────────────────────
  hr(); console.log("▶ Development Tracker — curation vs honest omission");
  const dtE8 = buildDevelopmentTrackerSection(E8, "INV");
  check("E8 has curated dated schemes", dtE8.state === "DATA" && dtE8.data.asOf === "2025" && dtE8.data.schemes.length >= 1);
  const dtTr = buildDevelopmentTrackerSection(TR24, "INV");
  check("TR24 → honest 'no curated schemes' (SPARSE)", dtTr.state === "SPARSE" && dtTr.data.curated === false);
  check("no curation for Scotland-style / unlisted areas", developmentSchemesFor("EH1") === null && developmentSchemesFor("TR24") === null);
  check("M1 schemes are Manchester, not London", buildDevelopmentTrackerSection(M1, "INV").data.schemes.some((s) => /NOMA|St Michael|Victoria North|Manchester/i.test(s.name)));

  // ── Letting Economics — two raw inputs, no collapsed score ──────────────────
  hr(); console.log("▶ Letting Economics — two real inputs, no invented demand label");
  const rd = buildRentalDemandSection({ rentalData: { regionLabel: "London-region", yield: { range: "2.8–4.1%", low: "2.8%", high: "4.1%", localMedian: { formatted: "£585,000" }, basis: "regional rent ÷ local median" } }, stats: risingStats }, E8, "INV");
  check("gross-yield input present", rd.data.yield.available === true && rd.data.yield.range === "2.8–4.1%");
  check("sales-velocity input present", rd.data.velocity.available === true && rd.data.velocity.avgPerYear > 0);
  check("methodology disclaims tenant-demand", /NOT a tenant-demand/.test(rd.data.methodology));
  check("no 'Very High'/score label emitted", !/Very High|score/i.test(JSON.stringify(rd.data.yield) + JSON.stringify(rd.data.velocity)));
  const rdNone = buildRentalDemandSection({ rentalData: null, stats: { available: false } }, E8, "INV");
  check("neither input → SPARSE, honest", rdNone.state === "SPARSE");

  // ── Result ───────────────────────────────────────────────────────────────────
  hr();
  console.log(`\nRESULT: ${passed} passed, ${failures.length} failed`);
  if (failures.length) { console.log("FAILURES:\n  - " + failures.join("\n  - ")); process.exit(1); }
  console.log("All Phase 2f assertions passed.");
}

main().catch((e) => { console.error(e); process.exit(1); });
