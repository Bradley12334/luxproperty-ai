/**
 * lib/brief/sections/executive-summary.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Executive Summary" (EXP).
 *
 * A templated but NON-generic opener: every sentence is a pure function of the
 * spine stats + resolved location, and every figure is traceable to a named
 * payload field. There is deliberately no boilerplate sentence that would render
 * identically for two different postcodes — a district with no median reads
 * differently from one that is up 6% on thin volume.
 *
 * Two derived reads, both from STATED thresholds (below) over real inputs:
 *   - marketTrajectory  — from stats.yoyChangePct (the most-recent full year vs the
 *                         year before), NOT a mood word: rising/firming/flat/
 *                         softening/falling, or "unclear" when YoY can't be computed.
 *   - salesActivity     — from stats.latestYear.count (recorded sales in the most
 *                         recent full year): active / steady / thin / very thin / none.
 *
 * The `signals` array is the provenance ledger: each entry names the payload field
 * it came from, so the UI can show the inputs behind the prose (BRIEF_SPEC → inputs
 * visible; Confidence computed, never asserted).
 *
 * States:
 *   DATA         a real median exists for the district window.
 *   SPARSE       spine confidence is "low" (a median exists but on thin volume).
 *   UNAVAILABLE  the spine found no transactions (price scan failed or empty district).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { formatGBP, formatSignedPct } from "../stats.js";
import { isEntitled } from "../entitlements.js";

/**
 * Market trajectory from YoY. Thresholds are stated here and surfaced in the
 * signal's `basis`, so the classification is auditable rather than asserted.
 * @param {number|null} yoy  stats.yoyChangePct
 */
function classifyTrajectory(yoy) {
  if (yoy == null || !Number.isFinite(yoy)) {
    return { key: "unclear", label: "Trajectory unclear", basis: "the two most recent full years don't both carry enough sales to compute a year-on-year move" };
  }
  if (yoy >= 5) return { key: "rising", label: "Rising", basis: "year-on-year median up 5% or more" };
  if (yoy >= 2) return { key: "firming", label: "Firming", basis: "year-on-year median up 2–5%" };
  if (yoy > -2) return { key: "flat", label: "Broadly flat", basis: "year-on-year median within ±2%" };
  if (yoy > -5) return { key: "softening", label: "Softening", basis: "year-on-year median down 2–5%" };
  return { key: "falling", label: "Falling", basis: "year-on-year median down 5% or more" };
}

/**
 * Sales activity from the most-recent-full-year count. A liquidity read, not a
 * demand claim — it's what the Land Registry actually recorded.
 * @param {number} count  stats.latestYear.count
 */
function classifyActivity(count) {
  if (count >= 40) return { key: "active", label: "Active", basis: "40+ recorded sales in the most recent full year" };
  if (count >= 15) return { key: "steady", label: "Steady", basis: "15–39 recorded sales in the most recent full year" };
  if (count >= 5) return { key: "thin", label: "Thin", basis: "5–14 recorded sales in the most recent full year" };
  if (count >= 1) return { key: "veryThin", label: "Very thin", basis: "fewer than 5 recorded sales in the most recent full year" };
  return { key: "none", label: "No recent sales", basis: "no sales recorded in the most recent full year" };
}

/** Where the brief is anchored, worded for point vs district-wide. */
function placeClause(location) {
  const region = location.region ? ` (${location.region})` : "";
  const la = location.localAuthority || "the local authority";
  if (location.outcodeOnly) {
    return `${location.outcode} is a postcode district in ${la}${region}, assessed district-wide from its centroid`;
  }
  const ward = location.ward ? `${location.ward} ward, ` : "";
  return `${location.postcode} sits in ${ward}${la}${region}`;
}

/**
 * @param {ReturnType<import("../stats.js").computeStats>} stats
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildExecutiveSummarySection(stats, location, tier) {
  const base = {
    key: "executiveSummary",
    title: "Executive Summary",
    minTier: "EXP",
    entitled: isEntitled(tier, "section.executiveSummary"), // EXP; unlock-all → true
  };

  const place = placeClause(location);

  // ── UNAVAILABLE: no spine data. Still location-specific, never filler. ───────
  if (!stats || stats.available === false) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note: null,
      sourceFootnote: "Summary derived from HM Land Registry Price Paid Data for the postcode district and the Postcodes.io location lookup.",
      data: {
        headline: `${place}.`,
        classification: null,
        paragraphs: [
          `${cap(place)}.`,
          `No HM Land Registry sold prices are on record for ${location.outcode} in this window, so the price, trajectory and negotiation reads below can't be computed. The location itself is verified; the rest of the brief still renders every non-price section.`,
        ],
        signals: [
          { label: "Location", value: locationValue(location), source: "Postcodes.io resolver (ward / local authority / region)" },
          { label: "Transactions in window", value: "0", source: "HM Land Registry Price Paid Data — postcode-district scan" },
        ],
      },
    };
  }

  const window = stats.window;
  const windowLabel = `${window.startYear}–${window.endYear}`;
  const median = stats.medianPrice;
  const latest = stats.latestYear; // { year, count, median }
  const yoy = stats.yoyChangePct;
  const total = stats.totalCount;
  const conf = stats.confidence; // { level, note, ... }

  const trajectory = classifyTrajectory(yoy);
  const activity = classifyActivity(latest.count);
  const sparse = conf.level === "low";

  // ── Prose — every clause carries a real figure. ─────────────────────────────
  const p1 = `${cap(place)}. Across ${total.toLocaleString()} in-district Land Registry sale${total === 1 ? "" : "s"} over ${windowLabel}, the median sold price is ${formatGBP(median)}.`;

  const p2 =
    yoy == null
      ? `The market trajectory is unclear: a year-on-year move can't be measured because the two most recent full years don't both carry enough sales.`
      : `The market reads as ${trajectory.label.toLowerCase()} — the ${latest.year} median of ${formatGBP(latest.median)} is ${formatSignedPct(yoy)} on the ${latest.year - 1} median.`;

  const p3 = `Recorded sales activity is ${activity.label.toLowerCase()} (${latest.count} sale${latest.count === 1 ? "" : "s"} in ${latest.year}), which is why confidence in these figures is rated ${conf.level}. ${sparse ? "Treat every price figure as directional and widen your margin of safety." : conf.level === "high" ? "The price reads are well-supported." : "The price reads are indicative — sanity-check against live listings."}`;

  const signals = [
    { label: "Location", value: locationValue(location), source: "Postcodes.io resolver (ward / local authority / region)" },
    { label: `Median (${windowLabel})`, value: formatGBP(median), source: `HM Land Registry — ${total.toLocaleString()} in-district sales, deduped` },
    { label: `${latest.year} median`, value: formatGBP(latest.median), source: `HM Land Registry — ${latest.count} sale${latest.count === 1 ? "" : "s"} in the most recent full year` },
    { label: "Year-on-year", value: formatSignedPct(yoy), source: `${latest.year} vs ${latest.year - 1} median · classified "${trajectory.label}" (${trajectory.basis})` },
    { label: "Sales activity", value: activity.label, source: `${latest.count} sales in ${latest.year} (${activity.basis})` },
    { label: "Confidence", value: cap(conf.level), source: "Derived from transaction counts (spine confidence)" },
  ];

  return {
    ...base,
    state: sparse ? "SPARSE" : "DATA",
    note: sparse ? conf.note : null,
    sourceFootnote:
      "Summary derived from HM Land Registry Price Paid Data (the same deduped in-district transaction set as every price figure in this brief) and the Postcodes.io location lookup. Market-trajectory and sales-activity labels use fixed thresholds shown against each signal.",
    data: {
      headline: `${formatGBP(median)} median · ${trajectory.label} · ${activity.label.toLowerCase()} sales activity`,
      classification: { trajectory: trajectory.key, trajectoryLabel: trajectory.label, activity: activity.key, activityLabel: activity.label },
      paragraphs: [p1, p2, p3],
      signals,
    },
  };
}

/** "Hackney Central ward, Hackney, London" / "E8 district, Hackney, London". */
function locationValue(location) {
  const parts = [];
  if (location.outcodeOnly) parts.push(`${location.outcode} district`);
  else if (location.ward) parts.push(location.ward);
  if (location.localAuthority) parts.push(location.localAuthority);
  if (location.region) parts.push(location.region);
  return parts.join(", ") || location.outcode;
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
