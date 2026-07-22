/**
 * lib/brief/sections/buying-costs.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Buying Costs" (EXP base + PRO depth).
 *
 * One section, two costs a buyer faces on the same property:
 *   - COUNCIL TAX (EXP, always shown): the billing authority's Band D rate and the
 *     full A–H ladder derived from it via the STATUTORY multipliers (fixed by law:
 *     A=6/9 … D=1 … E=11/9 … H=2). Above D always costs MORE than D — the ordering
 *     the old brief's rendering inverted. Data year is stated; a gov.uk band-checker
 *     link gives the exact current-year figure and the property's confirmed band.
 *   - STAMP DUTY (PRO block): wired in Phase 2e Unit 2. Until then the block is null.
 *
 * The section carries the EXP `section.councilTax` entitlement (council tax is free);
 * the stamp-duty BLOCK is gated PRO by rank inside the payload so a future non-INV
 * plan sees council tax but an upgrade preview for stamp duty — no new entitlement
 * key, no pricing-page gap (folded per the Phase 2e decision).
 *
 * States:
 *   DATA         real billing-authority Band D rate + A–H ladder.
 *   UNAVAILABLE  the authority's rate isn't in the source (or the lookup failed) —
 *                honest message + checker link, never a regional-average stand-in.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled, TIER_RANK } from "../entitlements.js";
import { formatGBP } from "../stats.js";

const BAND_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H"];

/**
 * @param {{ ok:boolean, data:Object|null }} councilTaxResult   from fetchCouncilTax()
 * @param {Object|null} stampDuty   PRO block from buildStampDuty() (Unit 2; null until then)
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildBuyingCostsSection(councilTaxResult, stampDuty, location, tier) {
  const stampDutyEntitled = TIER_RANK[tier] >= TIER_RANK.PRO; // PRO block; stub INV → true
  const base = {
    key: "buyingCosts",
    title: "Buying Costs",
    minTier: "EXP",
    entitled: isEntitled(tier, "section.councilTax"), // EXP; council tax is free
  };

  if (!councilTaxResult?.ok || !councilTaxResult.data) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note:
        `The billing-authority council tax rate for ${location.postcode} couldn't be retrieved right now. ` +
        `Check the exact band and charge for a specific address at gov.uk.`,
      sourceFootnote:
        "Council tax: VOA/DLUHC Council Tax levels (billing-authority Band D) + statutory band multipliers. Confirm a property's band at gov.uk.",
      data: {
        councilTax: null,
        stampDuty: stampDutyEntitled ? stampDuty : null,
        stampDutyEntitled,
      },
    };
  }

  const d = councilTaxResult.data;
  const bands = BAND_ORDER.filter((b) => d.bandCosts[b] != null).map((band) => ({
    band,
    cost: d.bandCosts[band],
    formatted: formatGBP(d.bandCosts[band]),
    isBandD: band === "D",
  }));

  // District-wide briefs: an outcode almost always sits in one billing authority, but
  // could straddle two — name the authority and say the figure is authority-wide.
  const authorityNote = location.outcodeOnly
    ? `${d.authority} is the billing authority for this district. Council tax is set per authority (not per postcode), so these figures apply area-wide.`
    : `${d.authority} is the billing authority. Council tax is set per authority, so the same rates apply across the area — the band for a specific property must be confirmed at gov.uk.`;

  return {
    ...base,
    state: "DATA",
    note: authorityNote,
    sourceFootnote:
      `Council tax: ${d.authority} Band D ${formatGBP(d.bandD)}/yr, VOA/DLUHC Council Tax levels ${d.dataYear}. ` +
      `Bands A–H derived via the statutory multipliers (A=6/9 … D=1 … H=2). ` +
      `${d.dataYear} is the last full published year in our dataset — use the gov.uk checker for the exact current-year charge and a property's confirmed band.`,
    data: {
      councilTax: {
        authority: d.authority,
        country: d.country,
        dataYear: d.dataYear,
        bandD: { raw: d.bandD, formatted: formatGBP(d.bandD) },
        bands, // A–H ladder, Band D flagged
        checkerUrl: d.checkerUrl,
      },
      stampDuty: stampDutyEntitled ? stampDuty : null,
      stampDutyEntitled,
    },
  };
}
