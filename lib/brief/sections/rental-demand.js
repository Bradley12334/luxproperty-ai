/**
 * lib/brief/sections/rental-demand.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Letting Economics" (INV). (Pricing page: "Rental demand score
 * — letting potential rated across areas".)
 *
 * The pricing page promises a letting read. The HONEST truth is we hold NO
 * tenant-demand data — no days-to-let, no void periods, no demand index is wired
 * from any free feed. So this section does NOT assert a single "demand score" or a
 * "Very High" label (the old brief invented those). Instead it presents the TWO real
 * inputs that DO exist in the payload, each labelled as exactly what it is:
 *
 *   1. GROSS YIELD range — from the Rental Snapshot: annual regional VOA rent ÷ the
 *      local median sold price. A RETURN signal (cross-granularity estimate).
 *   2. SALES VELOCITY — from the spine: recorded in-district sales per year. A
 *      LIQUIDITY / churn signal, NOT tenant demand.
 *
 * Both are shown side by side with a plain statement that neither is a tenant-demand
 * measurement, so no letting-demand rating is collapsed out of them.
 *
 * States:
 *   DATA    at least one of the two inputs is available.
 *   SPARSE  neither input is available (no yield and no price scan).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";

/**
 * @param {Object} inputs
 * @param {Object|null} inputs.rentalData  rentalSnapshot section .data (region, yield, benchmarks)
 * @param {ReturnType<import("../stats.js").computeStats>} inputs.stats
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildRentalDemandSection({ rentalData, stats }, location, tier) {
  const base = {
    key: "rentalDemandScore",
    title: "Letting Economics",
    minTier: "INV",
    entitled: isEntitled(tier, "section.rentalDemandScore"), // INV; unlock-all → true
  };

  // ── Input 1: gross yield (return) — reuse the Rental Snapshot's computed block ──
  const y = rentalData?.yield || null;
  const yieldInput = y
    ? {
        available: true,
        range: y.range,
        low: y.low,
        high: y.high,
        regionLabel: rentalData.regionLabel,
        localMedian: y.localMedian?.formatted ?? null,
        basis: y.basis,
      }
    : { available: false, reason: rentalData ? "no local median sold price to divide the regional rent by" : "regional rent benchmarks couldn't be retrieved" };

  // ── Input 2: sales velocity (liquidity) — from the spine transaction set ──────
  let velocityInput;
  if (stats?.available) {
    const span = Math.max(1, stats.window.endYear - stats.window.startYear + 1);
    const avgPerYear = Math.round(stats.totalCount / span);
    velocityInput = {
      available: true,
      avgPerYear,
      latestYear: { year: stats.latestYear.year, count: stats.latestYear.count },
      windowYears: span,
      totalCount: stats.totalCount,
    };
  } else {
    velocityInput = { available: false, reason: "the Land Registry price scan returned no sales for this district" };
  }

  const anyInput = yieldInput.available || velocityInput.available;

  const methodology =
    "This is NOT a tenant-demand score. We hold no days-to-let, void-period or tenant-demand data for any postcode, so none is asserted. " +
    "What's shown are the two letting signals that CAN be derived honestly: a gross-yield estimate (return) and recorded sales velocity (market liquidity). " +
    "A high yield often reflects lower capital values rather than strong tenant demand, and sales velocity is a sales-market measure — read them as inputs, not a verdict.";

  return {
    ...base,
    state: anyInput ? "DATA" : "SPARSE",
    note: anyInput
      // Counted, not asserted. "Two" was emitted whenever EITHER input resolved, so a
      // brief showing one input told the reader it was showing two.
      ? `${[yieldInput, velocityInput].filter((i) => i.available).length === 1 ? "One real letting input is" : "Two real letting inputs are"} shown below. ` +
        "Neither is a tenant-demand measurement — see the methodology note."
      : "Neither a gross-yield estimate nor sales-velocity figure can be formed for this postcode right now (no regional rent benchmark and no local price scan).",
    sourceFootnote:
      "Gross yield: VOA Private Rental Market Statistics 2024 (regional) ÷ HM Land Registry local median — a cross-granularity estimate. " +
      "Sales velocity: HM Land Registry recorded in-district sales per year. No tenant-demand, void or days-to-let data is used because none is available from a free national feed.",
    data: {
      yield: yieldInput,
      velocity: velocityInput,
      methodology,
    },
  };
}
