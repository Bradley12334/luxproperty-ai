/**
 * lib/brief/sections/rental-snapshot.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Rental Snapshot" (PRO).
 *
 * Two figures at two DIFFERENT granularities, each labelled as exactly what it is:
 *   - REGIONAL rent benchmarks (VOA Private Rental Market Statistics 2024, one row per
 *     ONS region). Named "<Region>-region benchmarks, VOA PRMS 2024" — NEVER presented
 *     as local. All London postcodes legitimately share the London row; the copy says so.
 *   - LOCAL median sold price (the live spine window median for THIS district).
 *
 * Gross yield is computed by crossing the two: annual regional rent ÷ local median
 * price. Because the numerator is regional and the denominator is local, the result is
 * an explicit CROSS-GRANULARITY ESTIMATE — the copy and footnote say so, and give the
 * yield as a RANGE spanning the 1-bed → 3-bed regional rents against the local median.
 *
 * There is deliberately NO rent-growth (YoY) figure: the live ONS feed behind the old
 * brief is dead (IPHRP discontinued), and we don't surface a number we can't source.
 *
 * States:
 *   DATA         regional benchmarks + a local median → benchmarks + yield range.
 *   SPARSE       regional benchmarks present but no local median (price scan failed) →
 *                show benchmarks, omit yield with an honest reason.
 *   UNAVAILABLE  the regional benchmark itself couldn't be resolved.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";
import { formatGBP } from "../stats.js";

function pcm(n) {
  return `£${Math.round(n).toLocaleString("en-GB")} pcm`;
}

/**
 * @param {{ ok:boolean, data:{ region:string, medianRents:Object }|null }} rentalResult
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @param {number|null} localMedianPrice  stats.medianPrice (LIVE, this district)
 * @returns {Object} a BriefSection
 */
export function buildRentalSnapshotSection(rentalResult, location, tier, localMedianPrice) {
  const base = {
    key: "rentalSnapshot",
    title: "Rental Snapshot",
    minTier: "PRO",
    entitled: isEntitled(tier, "section.rentalContext"), // PRO; unlock-all → true
  };

  if (!rentalResult?.ok || !rentalResult.data) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note: `Regional rent benchmarks couldn't be retrieved for ${location.postcode} right now.`,
      sourceFootnote:
        "Rents: VOA Private Rental Market Statistics 2024 (ONS-region medians). For current local asking rents see the ONS 'Private rent and house prices' bulletin.",
      data: null,
    };
  }

  const { region, medianRents } = rentalResult.data;
  const regionLabel = region === "London" ? "London-region" : `${region} region`;

  const benchmarks = [
    { key: "1bed", label: "1 bed", monthly: medianRents["1bed"], formatted: pcm(medianRents["1bed"]) },
    { key: "2bed", label: "2 bed", monthly: medianRents["2bed"], formatted: pcm(medianRents["2bed"]) },
    { key: "3bed", label: "3 bed", monthly: medianRents["3bed"], formatted: pcm(medianRents["3bed"]) },
  ].filter((b) => b.monthly != null);

  // Gross yield: annual regional rent ÷ LOCAL median price. Cross-granularity estimate.
  let yieldBlock = null;
  if (localMedianPrice != null && Number.isFinite(localMedianPrice) && localMedianPrice > 0) {
    const yields = benchmarks.map((b) => (b.monthly * 12) / localMedianPrice);
    const low = Math.min(...yields);
    const high = Math.max(...yields);
    yieldBlock = {
      localMedian: { raw: localMedianPrice, formatted: formatGBP(localMedianPrice) },
      low: `${(low * 100).toFixed(1)}%`,
      high: `${(high * 100).toFixed(1)}%`,
      range: `${(low * 100).toFixed(1)}–${(high * 100).toFixed(1)}%`,
      basis:
        `Gross yield = annual ${regionLabel} rent ÷ the local ${location.outcode} median sold price ` +
        `(${formatGBP(localMedianPrice)}). This crosses a REGIONAL rent with a LOCAL price and mixes flat/house ` +
        `sizes, so treat it as an indicative range, not a property-specific yield.`,
    };
  }

  const granularityNote =
    `These are ${regionLabel.toUpperCase()} rent benchmarks (VOA Private Rental Market Statistics 2024), ` +
    `not a measurement for ${location.outcode} specifically — every postcode in the ${region} region shares ` +
    `the same regional figure. Use them as a reference point, not a local asking rent.`;

  return {
    ...base,
    state: yieldBlock ? "DATA" : "SPARSE",
    note: yieldBlock
      ? granularityNote
      : `${granularityNote} A gross-yield estimate needs the local median sold price, which is unavailable for this postcode right now.`,
    sourceFootnote:
      `Rents: VOA Private Rental Market Statistics 2024 (${region}-region medians). Gross yield crosses these regional ` +
      `rents with the live local median sold price and is an indicative estimate only. For current local asking rents ` +
      `see the ONS 'Private rent and house prices' bulletin.`,
    data: {
      region,
      regionLabel,
      benchmarks,
      yield: yieldBlock,
    },
  };
}
