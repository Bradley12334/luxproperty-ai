/**
 * lib/brief/gate.js
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TIER GATE — the single, auditable place where a fully-built brief is
 * reduced to exactly what the user's plan is entitled to, AT GENERATION TIME.
 *
 * Contract (BRIEF_SPEC → Tier gating):
 *   - SERVER-SIDE ONLY. A locked section's real `data` is DROPPED here, before
 *     serialization — never sent to the client and hidden with CSS/JS. A locked
 *     section becomes a titled upgrade preview: { state:"LOCKED", title,
 *     description, tier badge, cta } with data:null.
 *   - DEPTH VARIANTS are computed, not truncated client-side: the price-trend
 *     table is sliced to the tier's entitled depth (EXP 1yr / PRO 5yr / INV 10yr),
 *     so a PRO payload literally contains 5 years of rows, not 10 with 5 hidden.
 *   - The verdict is built from the FULL evidence set BEFORE this gate runs, so the
 *     free Explorer verdict stays high-quality; the gate then locks the underlying
 *     PRO/INV sections. The verdict itself is EXP and always passes.
 *
 * WHY a central gate (not per-builder): one reader of the entitlement config = one
 * thing to audit. The "grep the serialized PRO payload for zero INV data" test
 * (scripts/test-gating.mjs) exercises THIS function.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ENTITLEMENTS, isEntitled, trendDepthYears } from "./entitlements.js";

/** Human tier labels for upgrade CTAs. */
const TIER_LABEL = Object.freeze({ EXP: "Explorer", PRO: "Professional", INV: "Investor" });

/**
 * section.key → the entitlement key that gates the WHOLE section.
 * Composite sections (prices, buying costs) carry their FREE FLOOR key here and
 * gate their paid internals separately (see gatePricesInternals / the buying-costs
 * builder, which already nulls its PRO stamp-duty block).
 */
export const SECTION_ENTITLEMENT = Object.freeze({
  areaVerdict:            "section.areaVerdict",       // EXP
  executiveSummary:       "section.executiveSummary",  // EXP
  pricesTrendNegotiation: "section.marketOverview",    // EXP floor (+ depth trend + PRO negotiation)
  floodClimate:           "section.floodClimate",      // EXP
  stationsCommute:        "section.commuteNote",        // EXP
  schools:                "section.amenities",          // EXP
  amenities:              "section.amenities",          // EXP
  buyingCosts:            "section.councilTax",          // EXP floor (+ PRO stamp duty)
  neighbourhood:          "section.neighbourhood",      // EXP
  nearbySoldPrices:       "section.comparableSales",     // PRO
  commuteCalculator:      "section.commuteCalculator",  // PRO
  broadband:              "section.broadband",          // PRO
  airQuality:             "section.airQuality",         // PRO
  rentalSnapshot:         "section.rentalContext",       // PRO
  crimeBreakdown:         "section.crimeBreakdown",     // PRO
  preOfferQuestions:      "section.preOfferQuestions",  // PRO
  planning:               "section.planning",           // PRO
  streetPriceRanking:     "section.streetPriceRanking", // INV
  soldPricesMap:          "section.soldPricesMap",       // INV
  developmentTracker:     "section.developmentTracker", // INV
  rentalDemandScore:      "section.rentalDemandScore",  // INV
});

/**
 * One-line upgrade-preview copy per section, shown when the section is LOCKED.
 * Titles come from the built section; this is the "here's what you'd unlock" line.
 */
const LOCKED_BLURB = Object.freeze({
  nearbySoldPrices:   "Recent comparable sales near this postcode with a valuation range — in-district, deduplicated.",
  commuteCalculator:  "Door-to-door commute times to multiple destinations, adapted to the region.",
  broadband:          "Fibre availability and the fastest broadband speeds recorded at this location (Ofcom).",
  airQuality:         "The local air-quality index with the named monitoring station.",
  rentalSnapshot:     "Rental market context — typical rents and gross yield against the local median.",
  crimeBreakdown:     "Recorded crime broken down by category from police.uk, with area context.",
  preOfferQuestions:  "The specific questions to ask before offering, triggered by this brief's own findings.",
  planning:           "Planning designations and risk flags (conservation areas, Article 4, listing) at these coordinates.",
  streetPriceRanking: "Relative sold-price ranking of streets within the area, from the transaction spine.",
  soldPricesMap:      "A visual map of recent nearby sold prices (postcode-centroid estimates).",
  developmentTracker: "Local development pipeline and change signals for the area.",
  rentalDemandScore:  "Letting potential rated across areas — gross-yield range and sales velocity.",
});

/**
 * Build the LOCKED upgrade-preview stub for a section, dropping ALL of its data.
 * @param {Object} section  the fully-built section
 * @param {string} entKey   its gating entitlement key
 */
function lockedStub(section, entKey) {
  const ent = ENTITLEMENTS[entKey];
  const requiredTier = ent?.minTier ?? section.minTier ?? "PRO";
  return {
    key: section.key,
    title: section.title,
    minTier: requiredTier,
    state: "LOCKED",
    // The tier the user must reach to unlock — drives the badge + CTA copy.
    requiredTier,
    requiredTierLabel: TIER_LABEL[requiredTier] ?? requiredTier,
    description: LOCKED_BLURB[section.key] ?? `Unlock ${section.title} on ${TIER_LABEL[requiredTier] ?? requiredTier}.`,
    cta: { label: `Upgrade to ${TIER_LABEL[requiredTier] ?? requiredTier}`, target: "/pricing" },
    data: null,
  };
}

/**
 * Trim the price-trend depth and gate the PRO negotiation sub-block IN PLACE of the
 * (EXP-floor) prices section, which is never whole-locked.
 *   - trend rows sliced to the tier's entitled depth (most-recent N years)
 *   - negotiation (fair value / opening range / leverage) nulled below PRO
 * @param {Object} section
 * @param {"EXP"|"PRO"|"INV"} tier
 */
function gatePricesInternals(section, tier) {
  if (!section.data) return section; // UNAVAILABLE/SPARSE-with-null — nothing to trim.

  const data = { ...section.data };

  // ── Depth trim: EXP 1yr / PRO 5yr / INV 10yr. Trend rows are oldest→newest, so
  // the most-recent N are the tail. Recompute the sparse-year note over the VISIBLE
  // rows only, so a caveat about "—" years appears only if a shown year is thin.
  if (data.trend && Array.isArray(data.trend.rows)) {
    const years = trendDepthYears(tier);
    const rows = data.trend.rows.slice(-years);
    const hasSparseYears = rows.some((r) => r.state === "sparse" || r.state === "missing");
    data.trend = {
      ...data.trend,
      rows,
      years: rows.length,
      hasSparseYears,
      lowVolumeNote: hasSparseYears ? data.trend.lowVolumeNote : null,
      depthYears: years, // the entitled depth, for the client's "1/5/10-year" label
    };
  }

  // ── Negotiation is PRO (section.preOfferStrategy). Below PRO: DROP the figures,
  // keep only the not-a-valuation note + a locked flag so the client can preview it.
  if (data.negotiation && !isEntitled(tier, "section.preOfferStrategy")) {
    data.negotiation = {
      entitled: false,
      locked: true,
      requiredTier: "PRO",
      requiredTierLabel: TIER_LABEL.PRO,
      fairValueRange: null,
      openingRange: null,
      leveragePoints: [],
      confidence: null,
      notAValuationNote: data.negotiation.notAValuationNote ?? null,
    };
  }

  return { ...section, data };
}

/**
 * Reduce a fully-built section to what `tier` is entitled to see.
 * Whole-section lock (data dropped → LOCKED stub) OR internal depth/sub-block
 * gating for the composite EXP-floor sections.
 * @param {Object} section
 * @param {"EXP"|"PRO"|"INV"} tier
 */
export function gateSection(section, tier) {
  const entKey = SECTION_ENTITLEMENT[section.key];
  if (!entKey) {
    // Fail closed: an unmapped section is treated as locked so a new section can
    // never accidentally ship its data ungated. Loud, so it's caught immediately.
    console.warn(`[brief/gate] no entitlement mapping for section "${section.key}" — locking (fail closed).`);
    return lockedStub(section, "section.rentalDemandScore" /* highest tier, safe default */);
  }

  if (!isEntitled(tier, entKey)) return lockedStub(section, entKey);

  // Entitled at the section floor — apply any internal composite gating.
  if (section.key === "pricesTrendNegotiation") return gatePricesInternals(section, tier);

  return section;
}

/**
 * Gate a whole sections array. The verdict (areaVerdict) is EXP and passes through;
 * it was already synthesised from the FULL, un-gated evidence upstream.
 * @param {Object[]} sections
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object[]}
 */
export function gateSections(sections, tier) {
  return sections.map((s) => gateSection(s, tier));
}
