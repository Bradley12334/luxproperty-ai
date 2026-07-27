/**
 * lib/brief/entitlements.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ENTITLEMENT CONFIG — the single source of truth for "which tier unlocks what".
 * This table IS the pricing page, transcribed from BRIEF_SPEC.md → Tier gating.
 * The brief payload builder, the (future) PDF exporter, and the pricing page must
 * all agree with THIS file.
 *
 * ENFORCEMENT (gating session): this file is pure config + predicates. The real
 * plan lookup lives in lib/brief/account.js (`resolveAccountTier`, reading
 * users.plan via the existing userId mechanism); the whole-section lock + depth
 * trim live in lib/brief/gate.js. Both consult THIS file. There is no unlock-all
 * stub any more.
 *
 * Cumulative access: INV ⊇ PRO ⊇ EXP.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Tier rank — higher includes everything below it. */
export const TIER_RANK = Object.freeze({ EXP: 0, PRO: 1, INV: 2 });

/** @typedef {"EXP"|"PRO"|"INV"} Tier */

/**
 * Feature key → minimum tier. Keys are stable identifiers used by the payload
 * builder and section builders; they are NOT user-facing.
 *
 * `kind`:
 *   "section" — a whole brief section
 *   "depth"   — a depth variant within a section (server computes only the
 *               entitled depth; a PRO payload has 5yr of trend, not 10yr hidden)
 *   "feature" — a non-section entitlement (PDF export, save, branding, …)
 *   "quota"   — a metered non-section entitlement (briefs per month)
 */
export const ENTITLEMENTS = Object.freeze({
  // ── Sections (EXPLORER) ────────────────────────────────────────────────────
  "section.areaVerdict":        { minTier: "EXP", kind: "section", label: "Area screening verdict" },
  "section.executiveSummary":   { minTier: "EXP", kind: "section", label: "Executive summary" },
  "section.marketOverview":     { minTier: "EXP", kind: "section", label: "Market overview" },
  "section.neighbourhood":      { minTier: "EXP", kind: "section", label: "Neighbourhood profile" },
  "section.amenities":          { minTier: "EXP", kind: "section", label: "Schools, stations, parks & amenities" },
  "section.floodClimate":       { minTier: "EXP", kind: "section", label: "Flood & climate risk" },
  "section.councilTax":         { minTier: "EXP", kind: "section", label: "Council tax band" },
  "section.commuteNote":        { minTier: "EXP", kind: "section", label: "Simple commute note" },

  // ── Sections (PROFESSIONAL) ────────────────────────────────────────────────
  "section.propertyTypeSplit":  { minTier: "PRO", kind: "section", label: "Property type split" },
  "section.commuteCalculator":  { minTier: "PRO", kind: "section", label: "Full commute calculator" },
  "section.crimeBreakdown":     { minTier: "PRO", kind: "section", label: "Crime breakdown by category" },
  "section.comparableSales":    { minTier: "PRO", kind: "section", label: "Comparable sales & valuation range" },
  "section.preOfferStrategy":   { minTier: "PRO", kind: "section", label: "Pre-offer strategy" },
  "section.preOfferQuestions":  { minTier: "PRO", kind: "section", label: "Pre-offer questions" },
  "section.planning":           { minTier: "PRO", kind: "section", label: "Planning activity & risk flags" },
  "section.broadband":          { minTier: "PRO", kind: "section", label: "Broadband speed & fibre coverage" },
  "section.rentalContext":      { minTier: "PRO", kind: "section", label: "Rental market context" },
  "section.airQuality":         { minTier: "PRO", kind: "section", label: "Air quality index" },

  // ── Sections (INVESTOR) ────────────────────────────────────────────────────
  "section.rentalDemandScore":  { minTier: "INV", kind: "section", label: "Rental demand score" },
  "section.soldPricesMap":      { minTier: "INV", kind: "section", label: "Sold prices map" },
  "section.streetPriceRanking": { minTier: "INV", kind: "section", label: "Street price ranking" },
  "section.developmentTracker": { minTier: "INV", kind: "section", label: "Development tracker" },

  // ── Price-trend depth variants ─────────────────────────────────────────────
  // The server computes only the deepest entitled depth (see trendDepthYears()).
  "depth.trend.1yr":            { minTier: "EXP", kind: "depth", label: "Price trend — 1 year" },
  "depth.trend.5yr":            { minTier: "PRO", kind: "depth", label: "Price trend — 5 year" },
  "depth.trend.10yr":           { minTier: "INV", kind: "depth", label: "Price trend — 10 year" },

  // ── Non-section entitlements ───────────────────────────────────────────────
  "feature.pdfExport":          { minTier: "PRO", kind: "feature", label: "Export to PDF" },
  "feature.saveBrief":          { minTier: "PRO", kind: "feature", label: "Save & revisit briefs" },
  "feature.portfolio":          { minTier: "INV", kind: "feature", label: "Portfolio dashboard" },
  "feature.customBranding":     { minTier: "INV", kind: "feature", label: "Custom report branding" },
  "quota.briefsPerMonth":       { minTier: "EXP", kind: "quota", label: "Briefs per month", quota: { EXP: 2, PRO: Infinity, INV: Infinity } },
});

/**
 * Cumulative-tier check: does `tier` unlock `key`?
 * Unknown keys are treated as locked (fail closed) and warned about, so a typo in
 * a section builder can never silently ship gated content.
 * @param {Tier} tier
 * @param {string} key
 * @returns {boolean}
 */
export function isEntitled(tier, key) {
  const entry = ENTITLEMENTS[key];
  if (!entry) {
    console.warn(`[brief] isEntitled: unknown entitlement key "${key}" — treating as locked.`);
    return false;
  }
  return TIER_RANK[tier] >= TIER_RANK[entry.minTier];
}

/**
 * The deepest price-trend depth (in years) this tier is entitled to.
 * Phase 2a builds the full 10yr regardless (depth-trimming is a later phase), but
 * this is the value the trimming step will consult so it isn't bolted on later.
 * @param {Tier} tier
 * @returns {1|5|10}
 */
export function trendDepthYears(tier) {
  if (isEntitled(tier, "depth.trend.10yr")) return 10;
  if (isEntitled(tier, "depth.trend.5yr")) return 5;
  return 1;
}

/** The monthly brief quota for a tier (Infinity for unlimited). */
export function briefsPerMonth(tier) {
  return ENTITLEMENTS["quota.briefsPerMonth"].quota[tier] ?? 0;
}
