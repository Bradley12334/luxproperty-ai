/**
 * lib/brief/sections/property-type-split.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Property Type Split" (PRO).
 *
 * The area's housing STOCK mix from ONS Census 2021 table TS044 (accommodation
 * type), at LOCAL-AUTHORITY granularity, pulled live via Nomis. A pure function of
 * the fetchPropertyType() result + location + tier — no divergent query here.
 *
 * Honest labelling (BRIEF_SPEC): the granularity (the whole local authority) and
 * the date (Census 2021, 21 March 2021) are stated on the section, and it is framed
 * as the area's dwelling mix, NOT the mix of properties currently for sale.
 *
 * States:
 *   DATA         real TS044 breakdown with counts + percentages.
 *   UNAVAILABLE  ONS/Nomis didn't return a usable breakdown (or no LA code) — an
 *                honest message, never a fabricated split.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @param {Awaited<ReturnType<import("../property-type.js").fetchPropertyType>>} result
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection (key "propertyTypeSplit")
 */
export function buildPropertyTypeSplitSection(result, location, tier) {
  const base = {
    key: "propertyTypeSplit",
    title: "Property Type Split",
    minTier: "PRO",
  };

  if (!result?.ok || !Array.isArray(result.categories) || result.categories.length === 0) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note:
        "The ONS Census dwelling-type breakdown could not be retrieved for this area right now. " +
        "It is published per local authority — check the ONS TS044 table for the exact figures.",
      sourceFootnote: "Source: ONS Census 2021, table TS044 (Accommodation type), via Nomis.",
      data: null,
    };
  }

  const laName = result.laName || location.localAuthority || "this local authority";
  const dominant = result.categories[0];

  return {
    ...base,
    state: "DATA",
    note:
      `Housing stock mix for ${laName} (the whole local authority), from the 2021 Census — ` +
      `this describes the area's dwellings, not the properties currently for sale.`,
    sourceFootnote:
      `Source: ${result.dateLabel} table TS044 (Accommodation type), ${laName} ` +
      `(${result.laCode}), via Nomis. Granularity: ${result.granularity}.`,
    data: {
      laName,
      laCode: result.laCode,
      granularity: result.granularity,
      dateLabel: result.dateLabel,
      total: result.total,
      dominant: { label: dominant.label, percent: dominant.percent },
      categories: result.categories.map((c) => ({
        label: c.label,
        count: c.count,
        countFormatted: c.count.toLocaleString("en-GB"),
        percent: c.percent,
        percentFormatted: `${c.percent.toFixed(1)}%`,
      })),
    },
  };
}
