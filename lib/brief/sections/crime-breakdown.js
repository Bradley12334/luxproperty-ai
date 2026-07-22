/**
 * lib/brief/sections/crime-breakdown.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Crime Breakdown" (PRO).
 *
 * Street-level recorded crime from data.police.uk at the validated coordinates:
 * category breakdown with counts and shares, the data month stated (the feed lags
 * ~2 months), and the ~1-mile catchment framed honestly.
 *
 * DELIBERATELY NO BENCHMARK CLAIM. police.uk provides no population denominator, so a
 * fair "above/below the national average" can't be computed from it — the old brief's
 * hardcoded thresholds fabricated one. It's dropped. What's kept is genuinely-general,
 * clearly-labelled guidance (true of recorded-crime geography everywhere, not a
 * per-postcode assertion): totals concentrate on high-footfall commercial streets, so
 * a residential street is usually quieter than an area-wide count implies.
 *
 * States:
 *   DATA         crimes recorded in the latest month within the radius.
 *   SPARSE       zero recorded within the radius (genuinely quiet / rural coverage) —
 *                stated honestly, not dressed up.
 *   UNAVAILABLE  police.uk couldn't be reached / returned no usable data.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";

/** "2026-05" → "May 2026" for display. */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthLabel(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || "");
  if (!m) return ym || "the latest published month";
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

const GENERAL_GUIDANCE =
  "Recorded-crime totals concentrate on high-footfall commercial streets, transport hubs and town centres, " +
  "so a residential street is usually quieter than an area-wide count suggests. Street-level police.uk points are " +
  "also snapped to representative map locations, not exact addresses. Treat this as neighbourhood context, not a " +
  "street-by-street safety score.";

/**
 * @param {{ ok:boolean, data:{ month:string, total:number, categories:Array }|null }} crimeResult
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildCrimeBreakdownSection(crimeResult, location, tier) {
  const base = {
    key: "crimeBreakdown",
    title: "Crime Breakdown",
    minTier: "PRO",
    entitled: isEntitled(tier, "section.crimeBreakdown"), // PRO; unlock-all → true
  };

  if (!crimeResult?.ok || !crimeResult.data) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note: `Street-level crime data couldn't be retrieved for ${location.postcode} right now (data.police.uk did not respond). Try again shortly.`,
      sourceFootnote: "Crime: data.police.uk street-level crimes (England & Wales).",
      data: null,
    };
  }

  const { month, total, categories } = crimeResult.data;
  const when = monthLabel(month);
  // police.uk returns crimes within ~1 mile of the point; frame the centre honestly.
  const centre = location.outcodeOnly
    ? `the ${location.outcode} district centroid`
    : `${location.postcode}`;
  const radiusFrame = `Street-level crimes recorded within approximately 1 mile of ${centre} in ${when}.`;

  if (total === 0) {
    return {
      ...base,
      state: "SPARSE",
      note: `No street-level crimes were recorded within approximately 1 mile of ${centre} in ${when} — a genuinely quiet return, typical of rural or low-density areas. ${GENERAL_GUIDANCE}`,
      sourceFootnote: `Crime: data.police.uk street-level crimes, ${when} (the feed lags ~2 months). Radius ~1 mile of the coordinates. No national benchmark is shown — police.uk carries no population denominator to compute one fairly.`,
      data: { month, when, total: 0, categories: [], radiusFrame, guidance: GENERAL_GUIDANCE, centre },
    };
  }

  return {
    ...base,
    state: "DATA",
    note: `${radiusFrame} ${GENERAL_GUIDANCE}`,
    sourceFootnote: `Crime: data.police.uk street-level crimes, ${when} (the feed lags ~2 months). Radius ~1 mile of the coordinates. No national benchmark is shown — police.uk carries no population denominator to compute one fairly.`,
    data: {
      month,
      when,
      total,
      categories, // [{ key, label, count, pct }] sorted desc
      radiusFrame,
      guidance: GENERAL_GUIDANCE,
      centre,
    },
  };
}
