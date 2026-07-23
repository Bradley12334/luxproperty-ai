/**
 * lib/brief/sections/verdict.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Area Screening Verdict" (EXPLORER / free tier).
 *
 * THE SYNTHESIS ENGINE. Unlike every other section it fetches NOTHING — it is a pure
 * function of the ALREADY-BUILT section payloads plus meta, so it adds ~0 wall-clock.
 * It turns twenty evidence sections into ONE call — Good fit / Mixed / Limited fit
 * (the pricing page's exact vocabulary) — or, below a confidence floor, HONESTLY
 * REFUSES to give one.
 *
 * WHY THIS ENGINE IS SHAPED THE WAY IT IS (the W11 lesson):
 *   The old engine branded prime Notting Hill "probably not worth pursuing" off a false
 *   flood zone and fabricated benchmarks. Its failure mode was CONFIDENT SYNTHESIS OF
 *   BAD INPUTS. The inputs are trustworthy now, but any section can still be SPARSE or
 *   UNAVAILABLE per postcode — so the guardrail here is ARCHITECTURAL:
 *
 *     1. A SIGNAL REGISTRY (below) is the ONLY thing that reads section data. No signal
 *        outside it can move the verdict. It ships as reviewable data, not scattered logic.
 *     2. CONFIDENCE is computed FIRST and GATES the label. Good/Limited require Moderate+
 *        confidence; Moderate+ requires the price spine present. So a "Limited fit" from
 *        missing spine data is UNREACHABLE — see the hard gate in `computeConfidence`.
 *     3. Below the floor the card REFUSES ("insufficient data … here's what we can and
 *        can't see") instead of asserting any verdict.
 *
 * TONE: honest, never scare-framed. Elevated flood renders as "price this in and check
 * insurance early", never "avoid". A Limited fit always states FOR WHOM, WHY, and WHAT
 * WOULD CHANGE the read — it's guidance, not a condemnation of someone's street.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";
import { formatSignedPct } from "../stats.js";

const STANDING_NOTE =
  "This screening verdict is a due-diligence starting point — not financial or investment advice, and not a formal valuation. " +
  "It is synthesised from the evidence sections in this brief; read them, and independently verify anything that will drive your decision.";

// ── Confidence tiers ──────────────────────────────────────────────────────────
const TIER = Object.freeze({ HIGH: "High", MODERATE: "Moderate", LOW: "Low", INSUFFICIENT: "Insufficient" });
const TIER_RANK = Object.freeze({ Insufficient: 0, Low: 1, Moderate: 2, High: 3 });
const CONF_HIGH = 70; // ≥ → High
const CONF_MODERATE = 45; // ≥ → Moderate
const CONF_FLOOR = 20; // < → Insufficient (refusal)

// ── Fit-score label bands (only reached when confidence permits a label) ───────
const GOOD_AT = 2.0; // score ≥ → Good fit
const LIMITED_AT = -2.0; // score ≤ → Limited fit

// AMENDMENT 1 — crime needs a volume companion. police.uk carries no population
// denominator, so composition percentages are meaningless at low volume: with fewer
// than this many incidents in the ~1-mile / one-month radius, a single 5-incident
// swing moves a category share by 25+ points. Below the floor the crime signal scores
// 0 and renders neutrally — the no-benchmark rule is preserved (we still assert no
// national average), we just refuse to read a share we can't stand behind.
const CRIME_VOLUME_FLOOR = 20;

// Per-source score caps: a single peripheral signal can only move the fit score so far.
// lifestyle aggregates five dimensions (cap ±2.5); planning constraints, however many,
// cap at −0.5 so a listed+Article-4 stack can't dominate a peripheral read.
const SCORE_CAPS = Object.freeze({ lifestyle: 2.5, planningConstraints: 0.5 });

// ─────────────────────────────────────────────────────────────────────────────
// THE SIGNAL REGISTRY — the ONLY reader of section data.
// Each entry: read(ctx) → observation; confidenceWeight(obs) → points; and
// (optionally) scoreContributions(obs, ctx) → [{ source, sectionKey, points, dir,
// headline, detail?, nextStep? }]. The engine iterates this array and nothing else.
// ─────────────────────────────────────────────────────────────────────────────
const REGISTRY = [
  // ── priceTrajectory (CORE) — spine YoY. Scores; no confidence weight (that's
  //    dataConfidence's job) so the spine's confidence isn't double-counted. ────
  {
    key: "priceTrajectory",
    label: "Price trend",
    core: true,
    read(ctx) {
      const mo = sec(ctx, "pricesTrendNegotiation")?.data?.marketOverview;
      const yoy = mo?.yoyChange?.raw ?? null;
      return { available: yoy != null, yoy, year: mo?.latestYear?.year ?? null };
    },
    confidenceWeight() {
      return 0;
    },
    scoreContributions(o) {
      if (o.yoy == null) return [];
      const f = formatSignedPct(o.yoy);
      if (o.yoy >= 2)
        return [ctb("priceTrajectory", "pricesTrendNegotiation", 2, "pos", `Sold-price medians rose ${f} over the last full year`, `The ${o.year} median was up ${f} year-on-year — local values are currently rising.`)];
      if (o.yoy > -2)
        return [ctb("priceTrajectory", "pricesTrendNegotiation", 0.5, "pos", `Prices are holding firm (${f} year-on-year)`, `The ${o.year} median moved ${f} on the year before — broadly stable.`)];
      if (o.yoy > -5)
        return [ctbN("priceTrajectory", "pricesTrendNegotiation", -1, `Prices are softening (${f} year-on-year)`, `The ${o.year} median fell ${f} on the year before.`, "Use it as negotiating leverage: anchor offers to the median, not the asking price.")];
      return [ctbN("priceTrajectory", "pricesTrendNegotiation", -2, `Sold-price medians fell ${f} over the last full year`, `The ${o.year} median dropped ${f} year-on-year.`, "Use it as negotiating leverage — anchor to the median, and check whether the fall is area-wide or specific to a run of stock.")];
    },
  },

  // ── dataConfidence (CORE) — this is the SPINE GATE. Its availability defines
  //    spineAvailable; its level drives most of the confidence budget. ──────────
  {
    key: "dataConfidence",
    label: "Sold-price evidence",
    core: true,
    read(ctx) {
      const p = sec(ctx, "pricesTrendNegotiation");
      const conf = p?.data?.marketOverview?.confidence;
      const level = conf?.level ?? "none";
      return {
        available: !!p?.data && level !== "none",
        level, // high | medium | low | none
        totalCount: p?.data?.marketOverview?.totalTransactions ?? 0,
      };
    },
    confidenceWeight(o) {
      if (!o.available) return 0;
      return 25 + ({ high: 30, medium: 18, low: 6 }[o.level] ?? 0);
    },
    scoreContributions(o) {
      if (o.level === "high")
        return [ctb("dataConfidence", "pricesTrendNegotiation", 1, "pos", "Price evidence is well-supported", `Based on ${o.totalCount} in-district Land Registry sales — the read is well-grounded.`)];
      return [];
    },
  },

  // ── floodRisk (peripheral) — point band/zone from the flood section. ─────────
  {
    key: "floodRisk",
    label: "Flood risk",
    core: false,
    read(ctx) {
      const d = sec(ctx, "floodClimate")?.data;
      const districtWide = ctx.districtWide || d?.scope === "district";
      if (!d) return { available: false, districtWide };
      if (districtWide) return { available: true, districtWide: true, band: null, zone: null };
      const band = d.riskBand || null;
      const zone = d.planningZone || null;
      return { available: !!(band || zone), districtWide: false, band, zone };
    },
    confidenceWeight(o) {
      if (!o.available) return 0;
      if (o.districtWide) return 8; // a centroid can't claim a point flood zone
      return o.band || o.zone ? 15 : 8;
    },
    scoreContributions(o) {
      if (!o.available || o.districtWide) return []; // district-wide: no point flood claim
      const band = String(o.band || "").toLowerCase();
      const zone = o.zone;
      if (band.includes("high") || zone === 3)
        return [ctbN("floodRisk", "floodClimate", -2.5, "High flood risk from rivers or the sea at this location", o.band ? `Environment Agency ${o.band} band${zone ? ` / Flood Zone ${zone}` : ""}.` : `Flood Zone ${zone}.`, "Price this in rather than ruling it out: get a buildings-insurance quote and confirm Flood Re eligibility early, and check lender appetite before committing.")];
      if (band.includes("medium") || zone === 2)
        return [ctbN("floodRisk", "floodClimate", -1.5, "Some flood risk to price in", o.band ? `Environment Agency ${o.band} band${zone ? ` / Flood Zone ${zone}` : ""}.` : `Flood Zone ${zone}.`, "Get a buildings-insurance quote early and confirm Flood Re eligibility, and factor any premium into your offer.")];
      if (band.includes("low") || zone === 1)
        return [ctb("floodRisk", "floodClimate", 1, "pos", "Low flood risk from rivers and the sea", o.band ? `Environment Agency ${o.band} band.` : "Environment Agency Flood Zone 1.")];
      return [];
    },
  },

  // ── lifestyle (peripheral) — the neighbourhood dimensions. ───────────────────
  {
    key: "lifestyle",
    label: "Lifestyle fit",
    core: false,
    read(ctx) {
      const n = sec(ctx, "neighbourhood")?.data;
      const dims = n?.dimensions || [];
      const rated = n?.ratedCount ?? dims.filter((d) => d.tier !== "insufficient").length;
      return { available: rated > 0, dims, rated };
    },
    confidenceWeight(o) {
      return Math.round((Math.min(o.rated, 5) / 5) * 15);
    },
    scoreContributions(o) {
      const out = [];
      for (const d of o.dims) {
        if (d.tier === "excellent") out.push(ctb("lifestyle", "neighbourhood", 1, "pos", `${d.title}: excellent`, d.summary));
        else if (d.tier === "good") out.push(ctb("lifestyle", "neighbourhood", 0.5, "pos", `${d.title}: good`, d.summary));
        else if (d.tier === "limited") out.push(ctbN("lifestyle", "neighbourhood", -0.75, `${d.title}: limited`, d.summary, nextStepForDim(d.key)));
      }
      return out;
    },
  },

  // ── crimeComposition (peripheral) — NO benchmark; volume-gated (Amendment 1). ─
  {
    key: "crimeComposition",
    label: "Crime mix",
    core: false,
    read(ctx) {
      const d = sec(ctx, "crimeBreakdown")?.data;
      if (!d) return { available: false };
      const total = d.total ?? 0;
      const cats = d.categories || [];
      const violent = cats.filter((c) => c.key === "violent-crime" || c.key === "robbery").reduce((s, c) => s + (c.count || 0), 0);
      const violentShare = total > 0 ? Math.round((violent / total) * 100) : 0;
      return { available: true, total, violentShare, when: d.when };
    },
    confidenceWeight(o) {
      return o.available ? 8 : 0; // resolved (incl. a genuine zero) counts toward confidence
    },
    scoreContributions(o) {
      if (!o.available || o.total < CRIME_VOLUME_FLOOR) return []; // below floor → neutral (see neutralNotes)
      if (o.violentShare >= 25)
        return [ctbN("crimeComposition", "crimeBreakdown", -1, `Violence and robbery are ${o.violentShare}% of recorded crime`, `Recorded ${o.when} within ~1 mile.`, "Read it street-level, not area-wide — police.uk points snap to representative map locations; walk the specific street at different times of day.")];
      if (o.violentShare < 20)
        return [ctb("crimeComposition", "crimeBreakdown", 0.5, "pos", `Low share of violent crime in the recorded mix (${o.violentShare}%)`, `Recorded ${o.when} within ~1 mile.`)];
      return [];
    },
  },

  // ── planningConstraints (peripheral) — Article 4 & listed score −0.5; a
  //    conservation area scores 0 and renders as a neutral note (Amendment 4). ──
  {
    key: "planningConstraints",
    label: "Planning constraints",
    core: false,
    read(ctx) {
      const d = sec(ctx, "planning")?.data;
      const desigs = d?.designations || [];
      return {
        available: !!d?.designationsFetched,
        fetched: !!d?.designationsFetched,
        article4: desigs.some((x) => x.dataset === "article-4-direction-area"),
        listed: desigs.some((x) => x.dataset === "listed-building-outline"),
        conservation: desigs.filter((x) => x.dataset === "conservation-area"),
      };
    },
    confidenceWeight(o) {
      return o.fetched ? 7 : 0;
    },
    scoreContributions(o) {
      const out = [];
      if (o.article4) out.push(ctbN("planningConstraints", "planning", -0.5, "Article 4 direction — permitted-development rights restricted", "In scope of an Article 4 direction.", "Budget for planning consent on alterations you'd normally do under permitted development."));
      if (o.listed) out.push(ctbN("planningConstraints", "planning", -0.5, "Listed building at or adjacent to this location", "A listed-building outline covers this point.", "Factor listed-building consent into any renovation plans."));
      return out; // conservation → 0, handled in neutralNotes
    },
  },

  // ── investorEconomics (peripheral) — informs BEST-FOR only, never the fit score. ─
  {
    key: "investorEconomics",
    label: "Letting economics",
    core: false,
    read(ctx) {
      const d = sec(ctx, "rentalDemandScore")?.data;
      const y = d?.yield?.available ? d.yield : null;
      const v = d?.velocity?.available ? d.velocity : null;
      return { available: !!(y || v), yield: y, velocity: v };
    },
    confidenceWeight() {
      return 0;
    },
    scoreContributions() {
      return []; // best-for signal only
    },
  },
];

/** All registry keys, exported in the payload for the traceability harness. */
const REGISTRY_KEYS = REGISTRY.map((e) => e.key);

// ── small helpers ─────────────────────────────────────────────────────────────
function sec(ctx, key) {
  return ctx.byKey[key] || null;
}
/** Positive contribution. */
function ctb(source, sectionKey, points, dir, headline, detail) {
  return { source, sectionKey, points, dir, headline, detail: detail || null, nextStep: null };
}
/** Negative contribution (carries a practical next step). */
function ctbN(source, sectionKey, points, headline, detail, nextStep) {
  return { source, sectionKey, points, dir: "neg", headline, detail: detail || null, nextStep: nextStep || null };
}
function lowerFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
function nextStepForDim(key) {
  switch (key) {
    case "commute":
      return "Factor in the car/bus dependence and check journey times to your own destinations.";
    case "convenience":
      return "Check a maps app for shops and food outlets the OpenStreetMap data may miss.";
    case "greenSpace":
      return "Visit to gauge real access to parks and open space near the specific plot.";
    case "family":
      return "Verify school catchments and current Ofsted ratings directly before relying on them.";
    case "longTerm":
      return "Weight the thin or soft price evidence into your own margin of safety.";
    default:
      return "Verify this on the ground before relying on it.";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE — computed first, gates the label. THE W11 GUARDRAIL LIVES HERE.
// ─────────────────────────────────────────────────────────────────────────────
function computeConfidence(reads) {
  let points = 0;
  for (const e of REGISTRY) points += e.confidenceWeight(reads[e.key]);
  points = Math.round(points);

  let tier = points >= CONF_HIGH ? TIER.HIGH : points >= CONF_MODERATE ? TIER.MODERATE : points >= CONF_FLOOR ? TIER.LOW : TIER.INSUFFICIENT;

  // ── THE HARD GATE ───────────────────────────────────────────────────────────
  // Good/Limited require Moderate+. Moderate+ requires the spine.
  //   spine ABSENT  → cap at LOW  → only Mixed (heavily hedged) or refusal is reachable.
  //   spine SPARSE  → cap at MODERATE → never a confident (High) verdict off thin sales.
  // This is the single place a confident negative from missing data is made impossible.
  const spine = reads.dataConfidence;
  if (!spine.available) tier = capTier(tier, TIER.LOW);
  else if (spine.level === "low") tier = capTier(tier, TIER.MODERATE);

  return { tier, points, spineAvailable: spine.available, spineLevel: spine.level };
}
function capTier(current, max) {
  return TIER_RANK[current] > TIER_RANK[max] ? max : current;
}

/** Fit score: sum of contributions, with per-source caps applied. */
function scoreOf(contributions) {
  const bySource = {};
  for (const c of contributions) bySource[c.source] = (bySource[c.source] || 0) + c.points;
  let total = 0;
  for (const [k, v] of Object.entries(bySource)) {
    const cap = SCORE_CAPS[k];
    total += cap != null ? Math.max(-cap, Math.min(cap, v)) : v;
  }
  return Math.round(total * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// BEST-FOR — deterministic map from the SHAPE of the signals. Never invented.
// ─────────────────────────────────────────────────────────────────────────────
function computeBestFor(reads, score) {
  const dims = {};
  for (const d of reads.lifestyle.dims) dims[d.key] = d.tier;
  const good = (t) => t === "excellent" || t === "good";
  const flood = reads.floodRisk;
  const floodElevated = !flood.districtWide && (/high|medium/.test(String(flood.band || "").toLowerCase()) || flood.zone === 2 || flood.zone === 3);
  const yoy = reads.priceTrajectory.yoy;
  const y = reads.investorEconomics.yield;
  const yHigh = y ? parseFloat(String(y.high)) : null;
  const lowConfPrices = reads.dataConfidence.level === "low";

  if (floodElevated && score > LIMITED_AT)
    return who("buyers ready to price in flood insurance", "the location carries some flood risk but the rest of the picture holds up — it suits a buyer who'll get insurance quotes early and complete the flood diligence rather than walk away");
  if (good(dims.family)) return who("families", "schools, green space and the recorded-crime mix point to family suitability");
  if (yHigh != null && yHigh >= 5.5) return who("buy-to-let investors", `the gross-yield range (up to ${y.high}) and recorded sales liquidity favour an income-focused buyer — though neither is a tenant-demand measure`);
  if (good(dims.commute) && good(dims.convenience) && yoy != null && yoy >= -2) return who("commuters and first-time buyers", "strong transport and everyday convenience with steady prices");
  if ((yoy != null && yoy <= -5) || lowConfPrices) return who("cash buyers comfortable with negotiation", "softer or thin price evidence rewards a buyer who can negotiate hard and do their own due diligence");
  return who("a broad range of buyers", "the signals don't point to a single standout buyer profile");
}
function who(shortWho, why) {
  return { shortWho, why, text: `Best for ${shortWho} — ${why}.` };
}

/** What would change a soft read — keyed off the strongest negative signal. */
function whatWouldChangeFrom(topNeg) {
  if (!topNeg) return "Stronger evidence across the price, flood and lifestyle signals would lift this read.";
  switch (topNeg.source) {
    case "priceTrajectory":
      return "A return to steady or positive price growth would lift this read.";
    case "floodRisk":
      return "Confirmed affordable insurance and a clean flood history would improve the picture materially.";
    case "crimeComposition":
      return "A lower violent-crime share in the recorded mix would lift this read.";
    case "lifestyle":
      return "Better transport, amenity or green-space access would strengthen the everyday-living read.";
    case "planningConstraints":
      return "The verdict already prices these constraints in — they change what you can alter, not whether the area works for you.";
    default:
      return "Stronger supporting evidence would lift this read.";
  }
}

// ── Neutral notes — real signals that legitimately don't push the verdict. ─────
function neutralNotes(reads) {
  const notes = [];
  const cons = reads.planningConstraints.conservation || [];
  if (cons.length)
    notes.push({
      signal: "planningConstraints",
      sectionKey: "planning",
      text: `In a conservation area (${cons.map((c) => c.label).join(", ")}) — worth knowing, it cuts both ways: it protects the area's character and can support resale values, but it also adds consent requirements for alterations. Neither strongly positive nor negative on its own.`,
    });
  const c = reads.crimeComposition;
  if (c.available && c.total > 0 && c.total < CRIME_VOLUME_FLOOR)
    notes.push({
      signal: "crimeComposition",
      sectionKey: "crimeBreakdown",
      text: `Only ${c.total} crime${c.total === 1 ? "" : "s"} recorded within ~1 mile in ${c.when} — too few for the crime composition to be meaningful at this scale, so it isn't scored either way.`,
    });
  else if (c.available && c.total === 0)
    notes.push({
      signal: "crimeComposition",
      sectionKey: "crimeBreakdown",
      text: `No crimes recorded within ~1 mile in the latest month — a genuinely quiet return; at this volume it isn't scored as a positive.`,
    });
  return notes;
}

// ── Item shape shown in positives / watch-outs (carries its signal + source). ──
function toItem(c) {
  return { signal: c.source, sectionKey: c.sectionKey, headline: c.headline, detail: c.detail || null, nextStep: c.nextStep || null };
}

// ── Refusal card — below the floor, no verdict is asserted. ────────────────────
function refusalCard(base, ctx, conf, canSee, cannotSee) {
  const area = areaLabel(ctx);
  return {
    ...base,
    state: "DATA",
    pending: false,
    data: {
      refused: true,
      verdict: null,
      chip: { label: "Insufficient data", tone: "neutral" },
      confidence: { tier: TIER.INSUFFICIENT, points: conf.points, label: "Insufficient data" },
      collapsed: false,
      scope: ctx.districtWide ? "district" : "point",
      headline: `There isn't enough reliable data to give ${area} a screening verdict.`,
      explanation:
        `A screening verdict needs the core sold-price evidence for this postcode, which isn't available here. ` +
        `Rather than guess a Good / Mixed / Limited call from partial signals — the mistake this tool exists to avoid — the verdict is withheld. ` +
        `Here's what the brief can and can't see; every signal that did resolve is shown in the sections below.`,
      canSee,
      cannotSee,
      standingNote: STANDING_NOTE,
      registryKeys: REGISTRY_KEYS,
      availableSignals: canSeeKeys(ctx),
      signalsUsed: [],
    },
  };
}

function areaLabel(ctx) {
  return ctx.districtWide ? `the ${ctx.meta.outcode} district` : ctx.meta.postcode || "this location";
}
function canSeeKeys(ctx) {
  const out = [];
  for (const e of REGISTRY) if (e.read(ctx).available) out.push(e.key);
  return out;
}

/**
 * @param {Object[]} builtSections  the already-built section payloads (verdict excluded)
 * @param {Object} meta             the brief meta (postcode, outcode, outcodeOnly, region…)
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection (key "areaVerdict")
 */
export function buildAreaVerdictSection(builtSections, meta, tier) {
  const base = {
    key: "areaVerdict",
    title: "Area Screening Verdict",
    minTier: "EXP",
    entitled: isEntitled(tier, "section.areaVerdict"), // EXP — free tier
    pending: false,
  };

  const byKey = {};
  for (const s of builtSections || []) byKey[s.key] = s;
  const ctx = { byKey, meta: meta || {}, districtWide: !!meta?.outcodeOnly };

  // 1. Registry read — the ONLY place section data is consumed.
  const reads = {};
  for (const e of REGISTRY) reads[e.key] = e.read(ctx);

  // 2. Confidence (with the hard gate).
  const conf = computeConfidence(reads);

  // Transparency lists (labels for display; keys for traceability).
  const canSee = [];
  const cannotSee = [];
  const availableSignals = [];
  for (const e of REGISTRY) {
    if (reads[e.key].available) {
      canSee.push(e.label);
      availableSignals.push(e.key);
    } else {
      cannotSee.push(e.label);
    }
  }

  // 3. Refusal — below the floor, no verdict.
  if (conf.tier === TIER.INSUFFICIENT) return refusalCard(base, ctx, conf, canSee, cannotSee);

  // 4. Fit score from the registry contributions ONLY.
  const contributions = [];
  for (const e of REGISTRY) {
    const cs = e.scoreContributions ? e.scoreContributions(reads[e.key], ctx) : [];
    for (const c of cs) contributions.push(c);
  }
  const score = scoreOf(contributions);

  const positives = contributions.filter((c) => c.dir === "pos").sort((a, b) => b.points - a.points);
  const negatives = contributions.filter((c) => c.dir === "neg").sort((a, b) => a.points - b.points);

  // 5. Label — from the score, INTERSECTED with what confidence permits.
  //    At Low confidence the extremes collapse to Mixed (the hedge rung), and the
  //    copy MUST say so (Amendment 2) — see `collapsed`/`summary` below.
  let verdict;
  const collapsed = conf.tier === TIER.LOW;
  if (collapsed) verdict = "Mixed";
  else if (score >= GOOD_AT) verdict = "Good fit";
  else if (score <= LIMITED_AT) verdict = "Limited fit";
  else verdict = "Mixed";

  // 6. Copy.
  const bestFor = computeBestFor(reads, score);
  const whatWouldChange = whatWouldChangeFrom(negatives[0]);

  // The dedicated "strongest reason" line leads in the verdict's direction for a clear
  // Good/Limited call, and with the largest-magnitude signal (either sign) for Mixed.
  let strongest;
  if (verdict === "Good fit") strongest = positives[0] || byAbs(contributions);
  else if (verdict === "Limited fit") strongest = negatives[0] || byAbs(contributions);
  else strongest = byAbs(contributions);

  const firm = conf.tier === TIER.HIGH;
  const area = areaLabel(ctx);
  const summary = buildSummary({ verdict, area, firm, collapsed, strongest, topPos: positives[0], topNeg: negatives[0], bestFor, whatWouldChange });

  const chipTone = verdict === "Good fit" ? "good" : verdict === "Limited fit" ? "limited" : "mixed";

  const strongestReason = strongest
    ? { text: strongest.headline, detail: strongest.detail, sectionKey: strongest.sectionKey, signal: strongest.source, direction: strongest.dir }
    : { text: "The available evidence is mixed, with no single dominant signal.", detail: null, sectionKey: null, signal: null, direction: "neutral" };

  return {
    ...base,
    state: "DATA",
    data: {
      refused: false,
      verdict,
      chip: { label: verdict, tone: chipTone },
      confidence: { tier: conf.tier, points: conf.points, label: `${conf.tier} confidence` },
      collapsed,
      score,
      scope: ctx.districtWide ? "district" : "point",
      summary,
      strongestReason,
      bestFor,
      whatWouldChange,
      positives: positives.slice(0, 3).map(toItem),
      watchOuts: negatives.slice(0, 3).map(toItem),
      neutralNotes: neutralNotes(reads),
      canSee,
      cannotSee,
      standingNote: STANDING_NOTE,
      // Traceability surface (Amendment 3b): every cited signal must be one of these keys.
      registryKeys: REGISTRY_KEYS,
      availableSignals,
      signalsUsed: [...new Set(contributions.map((c) => c.source))],
    },
  };
}

/** Largest-magnitude contribution (either sign), or null. */
function byAbs(contributions) {
  if (!contributions.length) return null;
  return [...contributions].sort((a, b) => Math.abs(b.points) - Math.abs(a.points))[0];
}

/**
 * The headline sentence(s) under the chip. Vocabulary shifts with confidence:
 *   High → firm ("is a good fit"); Moderate → hedged ("appears a good fit … on the data available").
 * A Low-confidence Mixed MUST visibly state the extremes were suppressed (Amendment 2).
 * A Limited fit MUST carry both a for-whom clause and a what-would-change clause (Amendment 3c).
 */
function buildSummary({ verdict, area, firm, collapsed, strongest, topPos, topNeg, bestFor, whatWouldChange }) {
  const Area = cap(area);
  const reason = strongest ? lowerFirst(strongest.headline) : "the evidence is mixed with no dominant signal";
  const forWho = bestFor ? ` for ${bestFor.shortWho}` : "";

  if (verdict === "Good fit") {
    return firm
      ? `${Area} is a good fit${forWho}, most of all because ${reason}.`
      : `On the data available, ${area} appears a good fit${forWho}, mainly because ${reason}.`;
  }

  if (verdict === "Limited fit") {
    // Must contain BOTH a for-whom clause and a what-would-change clause.
    const lead = firm ? `${Area} is a limited fit${forWho}` : `On the data available, ${area} appears a limited fit${forWho}`;
    return `${lead}, mainly because ${reason}. That's guidance, not a verdict on the street itself: ${lowerFirst(whatWouldChange)}`;
  }

  // Mixed.
  const pos = topPos ? lowerFirst(topPos.headline) : null;
  const neg = topNeg ? lowerFirst(topNeg.headline) : null;
  if (collapsed) {
    // The collapse must be visible so it can't masquerade as a considered middle verdict.
    const seen = pos && neg ? ` What we can see: ${pos}, set against ${neg}.` : pos ? ` What we can see: ${pos}.` : neg ? ` What we can see: ${neg}.` : "";
    return `On limited data, ${area} reads as a partial, middle-of-the-road picture — there isn't enough evidence to place it firmly as a good or limited fit, so the extremes are deliberately suppressed. A fuller dataset might read stronger or weaker.${seen}`;
  }
  const body = pos && neg ? `${cap(pos)}, but ${neg}` : pos ? cap(pos) : neg ? cap(neg) : "the signals are balanced";
  return firm ? `${Area} is a mixed picture${forWho}: ${body}.` : `On the data available, ${area} looks like a mixed picture${forWho}: ${body}.`;
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
