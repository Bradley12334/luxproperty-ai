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
  propertyTypeSplit:      "section.propertyTypeSplit",  // PRO
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
  nearbySoldPrices:   "The most recent sold prices across this postcode district with a valuation range — deduplicated, in-district.",
  propertyTypeSplit:  "The area's dwelling mix — detached, terraced, flats and more — from ONS Census 2021 (TS044).",
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
    // NOTE: a locked section MISSING from LOCKED_BLURB falls through to this template, which
    // renders "Unlock {title} on Professional" to a free viewer (LockedSection shows
    // `description`). "Professional" is a RETIRED tier. Every current section is in the map, so
    // this never fires today — but add any new locked section to LOCKED_BLURB, or this
    // resurfaces a dead tier name. (requiredTierLabel / cta.label below carry the same retired
    // label but are not rendered by the client.)
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
 * Two sections get a SHORT truncated preview instead of a bare locked card, so the free
 * view can tease the real leading rows behind a locked overlay:
 *   nearbySoldPrices   → the first 2 sold rows
 *   streetPriceRanking → the top 3 ranked-street rows
 * The sliced rows are returned in a SEPARATE `preview` object — the section's `data`
 * STAYS null (see gateSection), so the "locked ⇒ data:null" invariant and its payload-grep
 * test (scripts/test-gating.mjs) are untouched. ONLY the sliced rows are included — no
 * summary, no bottom ranking, no area median, no aggregate counts. Returns null when the
 * source has no such rows (UNAVAILABLE/SPARSE-null, or a shape without the array), so the
 * section falls back to the ordinary locked stub.
 * @param {Object} section  the fully-built (un-gated) section
 * @returns {Object|null}   the preview payload in the client component's data shape, or null
 */
function truncatedPreview(section) {
  const d = section.data;
  if (!d) return null;
  if (section.key === "nearbySoldPrices") {
    if (!Array.isArray(d.items) || d.items.length === 0) return null;
    return { items: d.items.slice(0, 2), summary: null };
  }
  if (section.key === "streetPriceRanking") {
    if (!Array.isArray(d.top) || d.top.length === 0) return null;
    // 2 from the top + 1 from the bottom, so the free view shows the ranking spans
    // expensive AND affordable streets — top-3 alone read as "unaffordable area".
    const top = d.top.slice(0, 2);
    const lowestRow = Array.isArray(d.bottom) && d.bottom.length
      ? d.bottom[d.bottom.length - 1]           // globally lowest qualifying street
      : d.top[d.top.length - 1];                 // edge: exactly END_SIZE streets, no distinct tail
    const bottom = lowestRow && !top.some((r) => r.rank === lowestRow.rank) ? [lowestRow] : [];
    // Summary figures — the reason to buy, NOT rows. Already computed by the builder
    // (no new work): total streets ranked + the price range (highest vs lowest median).
    // Only these two figures accompany the 3 rows; no other aggregate is included.
    return {
      top,
      bottom,
      areaMedian: null,
      qualifyingCount: d.qualifyingCount ?? null,
      range: {
        highest: d.top[0]?.median ?? null,
        lowest: lowestRow?.median ?? d.top[d.top.length - 1]?.median ?? null,
      },
    };
  }
  return null;
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

  if (!isEntitled(tier, entKey)) {
    const stub = lockedStub(section, entKey);
    // A couple of sections tease their leading rows via a SEPARATE `preview` channel —
    // `data` stays null (invariant intact). Everything else is a bare locked card.
    const preview = truncatedPreview(section);
    if (preview) return { ...stub, previewTruncated: true, preview };
    return stub;
  }

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
