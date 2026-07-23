/**
 * scripts/test-verdict.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 3 verification — the Area Screening Verdict synthesis engine.
 *
 *   node scripts/test-verdict.mjs           # synthetic + invariants, then live
 *   node scripts/test-verdict.mjs --no-live # skip the network live checks
 *
 * Two layers:
 *   A. SYNTHETIC — buildAreaVerdictSection is fed hand-built section payloads and the
 *      outcomes are asserted: strong-everything → Good/High; elevated flood + falling
 *      market → Mixed with the right watch-outs; sparse spine → hedged, never confident;
 *      empty payload → the insufficient-data refusal card; district-wide → point claims
 *      suppressed; Low-confidence Mixed copy states the collapse (Amendment 2).
 *   B. INVARIANTS (Amendment 3) — properties that must hold for ALL inputs:
 *      (a) spine-absent fuzz: over many randomised/maxed peripheral combinations with the
 *          spine absent, the output is ALWAYS hedged-Mixed or refusal — NEVER Good, NEVER
 *          Limited, NEVER Moderate+ confidence. (The W11 guardrail, as a property test.)
 *      (b) traceability: no positive/watch-out/strongest-reason cites a signal absent from
 *          that payload's registry read.
 *      (c) Limited-fit copy always carries a for-whom clause AND a what-would-change clause.
 *   C. LIVE — generate() for E8 1NG, W11 2ED (the redemption), PE21 8QR (elevated flood as
 *      guidance), M1 5AN, TR24 0QQ (the degradation ladder live), and bare E8.
 *
 * Complements scripts/test-spine.mjs (23/23) and scripts/test-phase2f.mjs. Exit non-zero
 * on any failure.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { buildAreaVerdictSection } from "../lib/brief/sections/verdict.js";
import { generate } from "../lib/brief/generate.js";
import { isBriefError } from "../lib/brief/errors.js";

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

// ── Deterministic PRNG (mulberry32) so the fuzz is reproducible on failure. ────
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Synthetic section builders — the shapes buildAreaVerdictSection reads. ─────
const DIM_TITLES = { family: "Family suitability", commute: "Commute", convenience: "Everyday convenience", greenSpace: "Green space", longTerm: "Long-term hold" };
function prices({ level = "high", yoy = 5, total = 200 } = {}) {
  if (level === "none") return { key: "pricesTrendNegotiation", state: "UNAVAILABLE", data: null };
  return {
    key: "pricesTrendNegotiation",
    state: "DATA",
    data: { marketOverview: { yoyChange: { raw: yoy }, latestYear: { year: 2024 }, confidence: { level }, totalTransactions: total } },
  };
}
function pricesUnavailable() {
  return { key: "pricesTrendNegotiation", state: "UNAVAILABLE", data: null };
}
function flood({ band = null, zone = null, district = false } = {}) {
  return { key: "floodClimate", state: "DATA", districtWide: district, data: { scope: district ? "district" : "point", riskBand: band, planningZone: zone } };
}
function dim(key, tier) {
  return { key, title: DIM_TITLES[key], tier, label: tier, summary: `${DIM_TITLES[key]} — ${tier}` };
}
function neighbourhood(dims) {
  return { key: "neighbourhood", state: "DATA", data: { dimensions: dims, ratedCount: dims.filter((d) => d.tier !== "insufficient").length } };
}
function crime({ total = 40, violentShare = 12, when = "May 2026" } = {}) {
  const violent = Math.round((total * violentShare) / 100);
  const cats = total > 0 ? [{ key: "violent-crime", label: "Violence and sexual offences", count: violent, pct: violentShare }, { key: "burglary", label: "Burglary", count: total - violent, pct: 100 - violentShare }] : [];
  return { key: "crimeBreakdown", state: total > 0 ? "DATA" : "SPARSE", data: { total, categories: cats, when } };
}
function planning({ article4 = false, listed = false, conservation = false, fetched = true } = {}) {
  const d = [];
  if (article4) d.push({ dataset: "article-4-direction-area", label: "Article 4 Direction" });
  if (listed) d.push({ dataset: "listed-building-outline", label: "Listed Building" });
  if (conservation) d.push({ dataset: "conservation-area", label: "Central Conservation Area" });
  return { key: "planning", state: "DATA", data: { designationsFetched: fetched, designations: d } };
}
function rentalDemand({ yieldHigh = null, velocity = null } = {}) {
  return {
    key: "rentalDemandScore",
    state: "DATA",
    data: {
      yield: yieldHigh != null ? { available: true, high: `${yieldHigh}%`, low: "3.0%", range: `3.0–${yieldHigh}%` } : { available: false },
      velocity: velocity != null ? { available: true, avgPerYear: velocity, latestYear: { year: 2024, count: velocity } } : { available: false },
    },
  };
}
const META = { postcode: "X1 2YZ", outcode: "X1", outcodeOnly: false, region: "London" };
const META_DISTRICT = { postcode: "X1", outcode: "X1", outcodeOnly: true, region: "London" };

function build(sections, meta = META) {
  return buildAreaVerdictSection(sections, meta, "INV").data;
}
/** Every signal a cited item may reference, for the traceability invariant. */
function citedSignals(d) {
  const out = [];
  for (const p of d.positives || []) out.push(p.signal);
  for (const w of d.watchOuts || []) out.push(w.signal);
  if (d.strongestReason?.signal) out.push(d.strongestReason.signal);
  return out.filter(Boolean);
}

console.log("\nPHASE 3 — Area Screening Verdict\n");

// ═══════════════════════════════════════════════════════════════════════════
// A. SYNTHETIC OUTCOMES
// ═══════════════════════════════════════════════════════════════════════════
hr();
console.log("A1. Strong everything → Good fit, High confidence");
{
  const d = build([
    prices({ level: "high", yoy: 12, total: 320 }),
    flood({ band: "Very Low", zone: 1 }),
    neighbourhood([dim("family", "excellent"), dim("commute", "excellent"), dim("convenience", "excellent"), dim("greenSpace", "good"), dim("longTerm", "good")]),
    crime({ total: 60, violentShare: 10 }),
    planning({}),
    rentalDemand({ yieldHigh: 4.5, velocity: 40 }),
  ]);
  check("verdict is Good fit", d.verdict === "Good fit");
  check("confidence tier High", d.confidence.tier === "High");
  check("chip tone good", d.chip.tone === "good");
  check("has ≥1 positive, each traceable", d.positives.length >= 1 && citedSignals(d).length > 0);
  check("summary is firm (not hedged with 'appears')", !/appears/.test(d.summary));
  check("strongest reason is positive", d.strongestReason.direction === "pos");
}

hr();
console.log("A2. Elevated flood + falling market → Mixed with the right watch-outs");
{
  const d = build([
    prices({ level: "high", yoy: -8, total: 200 }),
    flood({ band: "Medium", zone: 2 }),
    neighbourhood([dim("commute", "good"), dim("convenience", "good"), dim("family", "fair"), dim("greenSpace", "fair"), dim("longTerm", "fair")]),
    crime({ total: 40, violentShare: 15 }),
    planning({}),
  ]);
  check("verdict is Mixed", d.verdict === "Mixed");
  const heads = d.watchOuts.map((w) => w.headline.toLowerCase());
  check("watch-out: flood present", heads.some((h) => h.includes("flood")));
  check("watch-out: falling prices present", heads.some((h) => h.includes("fell") || h.includes("softening") || h.includes("fall")));
  const floodWatch = d.watchOuts.find((w) => w.headline.toLowerCase().includes("flood"));
  check("flood watch-out step is 'price it in / insurance', not scare", !!floodWatch && /insurance/i.test(floodWatch.nextStep));
  check("no scare-framing ('avoid') anywhere in copy", !/\bavoid\b/i.test(JSON.stringify(d)));
}

hr();
console.log("A3. Sparse spine (low confidence, thin sales) → hedged, NEVER confident");
{
  const d = build([
    prices({ level: "low", yoy: null, total: 2 }),
    neighbourhood([dim("commute", "good"), dim("convenience", "fair")]),
  ]);
  check("confidence is NOT High", d.confidence.tier !== "High");
  check("verdict is not a confident extreme (Mixed or refused)", d.refused || d.verdict === "Mixed");
  if (d.confidence.tier === "Low") check("Low-confidence copy states the collapse", /partial|suppress|stronger or weaker/i.test(d.summary));
}

hr();
console.log("A4. Empty payload → insufficient-data REFUSAL card (no verdict)");
{
  const d = build([]);
  check("refused === true", d.refused === true);
  check("verdict is null (no Good/Mixed/Limited)", d.verdict === null);
  check("chip tone neutral", d.chip.tone === "neutral");
  check("confidence tier Insufficient", d.confidence.tier === "Insufficient");
  check("cannotSee lists the core sold-price evidence", d.cannotSee.some((s) => /sold-price evidence/i.test(s)));
  check("explanation refuses to guess", /withheld|rather than guess/i.test(d.explanation));
}

hr();
console.log("A5. District-wide (bare outcode) → point-precision claims suppressed");
{
  const d = build(
    [prices({ level: "high", yoy: 6, total: 150 }), flood({ district: true }), neighbourhood([dim("commute", "good"), dim("convenience", "good"), dim("greenSpace", "good")]), crime({ total: 50, violentShare: 12 })],
    META_DISTRICT,
  );
  check("scope is district", d.scope === "district");
  check("summary frames the district, not an address", /district/i.test(d.summary) && !/X1 2YZ/.test(d.summary));
  check("flood not scored (district centroid) — no flood in positives/watch-outs", !citedSignals(d).includes("floodRisk"));
}

hr();
console.log("A6. Low-confidence Mixed copy VISIBLY collapses (Amendment 2)");
{
  // Force Low: spine present but sparse (low), a couple of peripherals → tier Low.
  const d = build([prices({ level: "low", yoy: null, total: 3 }), neighbourhood([dim("commute", "good"), dim("convenience", "good")])]);
  check("tier is Low", d.confidence.tier === "Low");
  check("verdict forced to Mixed", d.verdict === "Mixed");
  check("collapsed flag set", d.collapsed === true);
  check("copy states extremes suppressed / partial read", /suppress|partial|stronger or weaker/i.test(d.summary));
}

hr();
console.log("A7. Conservation area scores 0 (neutral 'worth knowing'); Article 4/listed keep −0.5 (Amendment 4)");
{
  const dCons = build([prices({ level: "high", yoy: 5, total: 200 }), planning({ conservation: true })]);
  check("conservation cited in a NEUTRAL note, not a watch-out", dCons.neutralNotes.some((n) => /conservation/i.test(n.text)) && !dCons.watchOuts.some((w) => /conservation/i.test(w.headline)));
  const dScore = build([prices({ level: "high", yoy: 5, total: 200 })]).score;
  const dConsScore = dCons.score;
  check("conservation does NOT move the score", dConsScore === dScore);
  const dA4 = build([prices({ level: "high", yoy: 5, total: 200 }), planning({ article4: true })]);
  check("Article 4 IS a scored watch-out (−0.5)", dA4.watchOuts.some((w) => /article 4/i.test(w.headline)) && dA4.score < dScore);
}

hr();
console.log("A8. Crime volume floor (Amendment 1) — composition ignored below the floor");
{
  // 10 incidents, 40% violent → would be a −1 watch-out if volume were ignored.
  const dLow = build([prices({ level: "high", yoy: 5, total: 200 }), crime({ total: 10, violentShare: 40 })]);
  check("below-floor crime NOT a watch-out", !dLow.watchOuts.some((w) => /violence|robbery/i.test(w.headline)));
  check("below-floor crime rendered as a neutral note", dLow.neutralNotes.some((n) => /too few|meaningful at this scale/i.test(n.text)));
  // Same composition, above the floor → it DOES fire.
  const dHigh = build([prices({ level: "high", yoy: 5, total: 200 }), crime({ total: 60, violentShare: 40 })]);
  check("above-floor crime IS a watch-out", dHigh.watchOuts.some((w) => /violence|robbery/i.test(w.headline)));
  // 10 incidents, low share → must NOT award the positive either.
  const dLowPos = build([prices({ level: "high", yoy: 5, total: 200 }), crime({ total: 10, violentShare: 8 })]);
  check("below-floor crime NOT a positive", !dLowPos.positives.some((p) => /violent crime/i.test(p.headline)));
}

hr();
console.log("A9. Limited fit — for-whom + what-would-change, framed as guidance (Amendment 3c)");
{
  const d = build([
    prices({ level: "high", yoy: -10, total: 200 }),
    flood({ band: "High", zone: 3 }),
    crime({ total: 60, violentShare: 40 }),
    neighbourhood([dim("commute", "limited"), dim("convenience", "limited"), dim("family", "limited")]),
    planning({ article4: true, listed: true }),
  ]);
  check("verdict is Limited fit", d.verdict === "Limited fit");
  check("summary contains a for-whom clause", /\bfor\b/i.test(d.summary) && !!d.bestFor && new RegExp(d.bestFor.shortWho.split(" ")[0], "i").test(d.summary));
  check("summary contains a what-would-change clause", /would (lift|improve|strengthen)/i.test(d.summary));
  check("Limited framed as guidance, not condemnation", /guidance, not a verdict on the street/i.test(d.summary));
  check("elevated flood watch-out says price-in insurance, not 'avoid'", d.watchOuts.some((w) => /flood/i.test(w.headline) && /insurance/i.test(w.nextStep)) && !/\bavoid\b/i.test(JSON.stringify(d)));
}

// ═══════════════════════════════════════════════════════════════════════════
// B. INVARIANTS (property tests)
// ═══════════════════════════════════════════════════════════════════════════
hr();
console.log("B1. SPINE-ABSENT FUZZ — the W11 guardrail as a property (300 randomised combos)");
{
  const rand = mulberry32(20260723); // fixed seed → reproducible on failure
  const bands = [null, "Very Low", "Low", "Medium", "High"];
  const zones = [null, 1, 2, 3];
  const tiers = ["excellent", "good", "fair", "limited", "insufficient"];
  const dimKeys = ["family", "commute", "convenience", "greenSpace", "longTerm"];
  let violations = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    // Spine ABSENT — either UNAVAILABLE or "none".
    const spine = rand() < 0.5 ? pricesUnavailable() : prices({ level: "none" });
    const sections = [spine];
    if (rand() < 0.85) {
      const bi = Math.floor(rand() * bands.length);
      const zi = Math.floor(rand() * zones.length);
      sections.push(flood({ band: bands[bi], zone: zones[zi] }));
    }
    if (rand() < 0.85) sections.push(neighbourhood(dimKeys.map((k) => dim(k, tiers[Math.floor(rand() * tiers.length)]))));
    if (rand() < 0.85) sections.push(crime({ total: Math.floor(rand() * 120), violentShare: Math.floor(rand() * 60) }));
    if (rand() < 0.7) sections.push(planning({ article4: rand() < 0.5, listed: rand() < 0.5, conservation: rand() < 0.5 }));
    if (rand() < 0.6) sections.push(rentalDemand({ yieldHigh: 3 + rand() * 6, velocity: Math.floor(rand() * 60) }));

    const meta = rand() < 0.2 ? META_DISTRICT : META;
    const d = buildAreaVerdictSection(sections, meta, "INV").data;

    const ok =
      (d.refused === true || d.verdict === "Mixed") && // never Good, never Limited
      d.verdict !== "Good fit" &&
      d.verdict !== "Limited fit" &&
      d.confidence.tier !== "High" &&
      d.confidence.tier !== "Moderate"; // never confident off missing spine
    if (!ok) {
      violations++;
      if (violations <= 3) console.log(`      combo #${i}: verdict=${d.verdict} tier=${d.confidence.tier} refused=${d.refused}`);
    }
  }
  check(`all ${N} spine-absent combos are hedged-Mixed or refusal (0 violations)`, violations === 0);
}

hr();
console.log("B2. TRACEABILITY — no cited signal is absent from the registry read (200 combos)");
{
  const rand = mulberry32(424242);
  const bands = [null, "Very Low", "Low", "Medium", "High"];
  const zones = [null, 1, 2, 3];
  const tiers = ["excellent", "good", "fair", "limited", "insufficient"];
  const dimKeys = ["family", "commute", "convenience", "greenSpace", "longTerm"];
  const levels = ["high", "medium", "low", "none"];
  let violations = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const lvl = levels[Math.floor(rand() * levels.length)];
    const sections = [prices({ level: lvl, yoy: rand() < 0.2 ? null : Math.round((rand() * 30 - 15) * 10) / 10, total: Math.floor(rand() * 300) })];
    if (rand() < 0.8) sections.push(flood({ band: bands[Math.floor(rand() * bands.length)], zone: zones[Math.floor(rand() * zones.length)] }));
    if (rand() < 0.8) sections.push(neighbourhood(dimKeys.map((k) => dim(k, tiers[Math.floor(rand() * tiers.length)]))));
    if (rand() < 0.8) sections.push(crime({ total: Math.floor(rand() * 120), violentShare: Math.floor(rand() * 60) }));
    if (rand() < 0.6) sections.push(planning({ article4: rand() < 0.5, listed: rand() < 0.5, conservation: rand() < 0.5 }));
    const d = buildAreaVerdictSection(sections, META, "INV").data;
    const allowed = new Set(d.availableSignals);
    const registry = new Set(d.registryKeys);
    for (const sig of citedSignals(d)) {
      if (!registry.has(sig) || !allowed.has(sig)) {
        violations++;
        if (violations <= 3) console.log(`      combo #${i}: cited '${sig}' not in available registry read`);
      }
    }
  }
  check(`all cited signals are in the registry read AND available (0 violations)`, violations === 0);
}

hr();
console.log("B3. LIMITED-FIT COPY INVARIANT — for-whom + what-would-change, over many Limited cases");
{
  const rand = mulberry32(99001122);
  let limitedSeen = 0;
  let violations = 0;
  for (let i = 0; i < 200; i++) {
    // Bias toward Limited: strong spine (so a label is permitted) + heavy negatives.
    const sections = [
      prices({ level: rand() < 0.5 ? "high" : "medium", yoy: -(5 + rand() * 12), total: 120 + Math.floor(rand() * 200) }),
      flood({ band: rand() < 0.5 ? "High" : "Medium", zone: rand() < 0.5 ? 3 : 2 }),
      crime({ total: 40 + Math.floor(rand() * 60), violentShare: 30 + Math.floor(rand() * 30) }),
      neighbourhood([dim("commute", "limited"), dim("convenience", "limited"), dim("family", "limited"), dim("greenSpace", "limited"), dim("longTerm", "limited")]),
    ];
    const d = buildAreaVerdictSection(sections, META, "INV").data;
    if (d.verdict !== "Limited fit") continue;
    limitedSeen++;
    const hasForWhom = !!d.bestFor && new RegExp(d.bestFor.shortWho.split(" ")[0], "i").test(d.summary);
    const hasWhatChanges = /would (lift|improve|strengthen)/i.test(d.summary);
    if (!hasForWhom || !hasWhatChanges) {
      violations++;
      if (violations <= 3) console.log(`      combo #${i}: forWhom=${hasForWhom} whatChanges=${hasWhatChanges}`);
    }
  }
  check(`saw Limited-fit verdicts (${limitedSeen} of 200)`, limitedSeen > 0);
  check("every Limited-fit copy carries both clauses (0 violations)", violations === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// C. LIVE — real generate() runs (the acceptance targets)
// ═══════════════════════════════════════════════════════════════════════════
const liveResults = {};
if (!process.argv.includes("--no-live")) {
  hr();
  console.log("C. LIVE — generate() (network; ~20–30s each)\n");
  const cases = [
    { pc: "E8 1NG", note: "strong urban", assert: (d) => !d.refused },
    { pc: "W11 2ED", note: "THE REDEMPTION — prime Notting Hill must read sanely", assert: (d) => d.verdict !== "Limited fit" },
    { pc: "PE21 8QR", note: "elevated flood → guidance, NOT condemnation", assert: (d) => d.verdict !== "Limited fit" },
    { pc: "M1 5AN", note: "central Manchester", assert: (d) => !d.refused || d.confidence.tier === "Insufficient" },
    { pc: "TR24 0QQ", note: "the degradation ladder live (sparse) — never confident", assert: (d) => d.confidence.tier !== "High" },
    { pc: "E8", note: "bare outcode → district-framed", assert: (d) => d.refused || d.scope === "district" },
  ];
  for (const c of cases) {
    try {
      const t0 = Date.now();
      const out = await generate(c.pc);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      const v = out.sections.find((s) => s.key === "areaVerdict");
      const d = v?.data;
      liveResults[c.pc] = d;
      console.log(`   ${c.pc} — ${c.note}  (${secs}s)`);
      if (!d) {
        check(`${c.pc}: verdict section present`, false);
        continue;
      }
      if (d.refused) {
        console.log(`      → REFUSED (insufficient data). tier=${d.confidence.tier}. cannotSee=[${d.cannotSee.join(", ")}]`);
      } else {
        console.log(`      → CHIP: ${d.chip.label}  ·  ${d.confidence.label} (${d.confidence.points}/100)  ·  scope=${d.scope}`);
        console.log(`      → strongest: ${d.strongestReason.text}`);
        console.log(`      → best for: ${d.bestFor?.shortWho ?? "—"}`);
        console.log(`      → watch-outs: ${d.watchOuts.length ? d.watchOuts.map((w) => w.headline).join(" | ") : "none"}`);
      }
      check(`${c.pc}: ${c.note}`, c.assert(d));
      check(`${c.pc}: no 'avoid' scare-framing in copy`, !/\bavoid\b/i.test(JSON.stringify(d)));
    } catch (err) {
      const msg = isBriefError(err) ? `${err.code}: ${err.message}` : String(err?.message || err);
      console.log(`   ${c.pc}: generate() threw — ${msg}`);
      check(`${c.pc}: generate() completed`, false);
    }
  }
} else {
  console.log("\n(skipping live checks — --no-live)\n");
}

// ── Summary ────────────────────────────────────────────────────────────────
hr();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`   ✗ ${f}`);
  process.exit(1);
}
console.log("\n✓ All verdict checks passed.\n");
