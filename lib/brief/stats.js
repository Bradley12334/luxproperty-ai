/**
 * lib/brief/stats.js
 * ─────────────────────────────────────────────────────────────────────────────
 * STATS MODULE — every price statistic in the brief, derived from ONE clean
 * transaction set (the output of getTransactions). No section runs its own
 * divergent price query; they all read this object.
 *
 *   computeStats(txSet) → { available, medianPrice, latestYear, previousYear,
 *                           yoyChangePct, trend[], pricePerSqm, fairValue,
 *                           openingOffer, offerConfidence, confidence }
 *
 * Design notes (BRIEF_SPEC.md → Data spine, Confidence):
 *   - Raw NUMBERS only; sign/currency formatting happens at the edge via the
 *     exported formatSignedPct / formatGBP helpers, so no call site ever prefixes
 *     "+" onto an already-negative value ("+-5.1%").
 *   - Missing years are represented explicitly (median: null, state "missing"),
 *     never fabricated or back-filled. Thin years are flagged "sparse".
 *   - price/m² is OMITTED (null): PPD carries no floor area, and the spec forbids
 *     estimating it from an assumed size (the old engine's median ÷ 75/85/95 m²).
 *     It returns once EPC floor-area data is wired in (a later phase).
 *   - fairValue / openingOffer use the old engine's ±8% band and opening-offer
 *     multipliers, but anchor to the robust median rather than the old engine's
 *     outlier-fragile recent-comp mean (see the deviation note at the call site).
 *
 * Confidence thresholds (chosen here; stated in the Phase 1 report):
 *   dataset confidence, from window total (T) and most-recent-full-year count (Y):
 *     high   : Y >= 30 AND T >= 100
 *     medium : Y >= 10 AND T >= 30
 *     low    : T >= 1
 *     none   : T === 0
 *   per-year sparsity: a year with 0 sales is "missing"; 1-4 sales is "sparse"
 *     (median shown but low-volume); >= 5 is "data".
 *   offer confidence, from the most-recent-full-year count (Y):
 *     Strong Y>=30 ; Moderate Y>=10 ; Thin otherwise.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { BriefError, ErrorCodes } from "./errors.js";

const SPARSE_YEAR_MAX = 4; // 1-4 sales in a year → sparse; 0 → missing; >=5 → data

/** @typedef {import("./transactions.js").Transaction} Transaction */

/** Median of a numeric array (empty → null). */
function median(nums) {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Percentage change a→b as a number, or null if either side is missing/zero. */
function pctChange(from, to) {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

/** Format a signed percentage: -5.1% / +5.1% / 0.0%. null → "—". */
export function formatSignedPct(n, dp = 1) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : ""; // negatives already carry "-"
  return `${sign}${n.toFixed(dp)}%`;
}

/** Format GBP with no decimals. null → "—". */
export function formatGBP(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * @param {import("./transactions.js").TransactionSet} txSet
 * @returns {Object} stats
 * @throws {BriefError} BAD_INPUT if given something that is not a transaction set
 */
export function computeStats(txSet) {
  if (!txSet || !Array.isArray(txSet.transactions) || !txSet.window) {
    throw new BriefError(ErrorCodes.BAD_INPUT, "computeStats expects a TransactionSet from getTransactions.", {});
  }
  const { transactions, window } = txSet;
  const { startYear, endYear } = window;

  // ── No data: honest empty state, never a throw ─────────────────────────────
  if (transactions.length === 0) {
    return {
      available: false,
      district: txSet.district,
      window,
      totalCount: 0,
      medianPrice: null,
      latestYear: { year: endYear, count: 0, median: null },
      previousYear: { year: endYear - 1, count: 0, median: null },
      yoyChangePct: null,
      trend: buildTrend(new Map(), startYear, endYear),
      pricePerSqm: null,
      fairValue: null,
      openingOffer: null,
      offerConfidence: "Thin",
      confidence: {
        level: "none",
        note: "No Land Registry transactions found in this postcode district for the window — price figures are unavailable.",
        totalCount: 0,
        latestYearCount: 0,
      },
    };
  }

  // ── Group by calendar year ─────────────────────────────────────────────────
  const byYear = new Map(); // year → number[] prices
  for (const t of transactions) {
    const y = Number(t.date.slice(0, 4));
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(t.price);
  }

  const allPrices = transactions.map((t) => t.price);
  const medianPrice = median(allPrices);

  const latestPrices = byYear.get(endYear) || [];
  const prevPrices = byYear.get(endYear - 1) || [];
  const latestYear = { year: endYear, count: latestPrices.length, median: median(latestPrices) };
  const previousYear = { year: endYear - 1, count: prevPrices.length, median: median(prevPrices) };
  const yoyChangePct = pctChange(previousYear.median, latestYear.median);

  const trend = buildTrend(byYear, startYear, endYear);

  // ── Fair value / opening offer ─────────────────────────────────────────────
  // Anchor to the most recent full-year median (robust to outliers), falling back
  // to the whole-window median if the latest full year is empty. The ±8% band and
  // opening-offer multipliers are the old engine's; the anchor is NOT.
  //
  // DELIBERATE DEVIATION from the old engine (reported in the Phase 1 notes):
  // the old code blended a MEAN of the most-recent-6-by-date sales at weight 0.6
  // into the anchor. With a small N that mean is outlier-fragile — a single
  // £5.8M W11 sale dragged "fair value" to ~£1.9M against a £1.15M median. That is
  // the kind of distortion the rebuild exists to remove, so the spine anchors to
  // the median; genuine comparable-weighted valuation (property-type-matched,
  // outlier-trimmed comps) belongs to the Phase 2 comparable-sales section.
  const anchor = latestYear.median ?? medianPrice;

  let fairValue = null;
  let openingOffer = null;
  if (anchor != null) {
    fairValue = { anchor, low: Math.round(anchor * 0.92), high: Math.round(anchor * 1.08) };

    // Opening range: wider in a softening market (YoY < 0), tighter in high demand.
    const isSoftMarket = yoyChangePct != null && yoyChangePct < 0;
    const isHighDemand = latestYear.count > 40;
    const loMult = isSoftMarket ? 0.86 : isHighDemand ? 0.9 : 0.88;
    const hiMult = isSoftMarket ? 0.94 : isHighDemand ? 0.96 : 0.95;
    openingOffer = { low: Math.round(anchor * loMult), high: Math.round(anchor * hiMult) };
  }

  // Offer confidence keys off real transaction volume in the most recent full
  // year (not a fixed comp count), consistent with the dataset confidence signal.
  const offerConfidence =
    latestYear.count >= 30 ? "Strong" : latestYear.count >= 10 ? "Moderate" : "Thin";

  // ── Dataset confidence ─────────────────────────────────────────────────────
  const totalCount = transactions.length;
  const latestYearCount = latestYear.count;
  const confidence = deriveConfidence(totalCount, latestYearCount, txSet);

  return {
    available: true,
    district: txSet.district,
    window,
    totalCount,
    medianPrice,
    latestYear,
    previousYear,
    yoyChangePct,
    trend,
    pricePerSqm: null, // omitted — no floor-area data; never estimated
    fairValue,
    openingOffer,
    offerConfidence,
    confidence,
  };
}

/**
 * Build the per-year trend across the FULL requested window (not just years that
 * happen to have data), so missing years render as "—" rather than vanishing.
 * @param {Map<number, number[]>} byYear
 */
function buildTrend(byYear, startYear, endYear) {
  const rows = [];
  let prevMedian = null;
  for (let year = startYear; year <= endYear; year++) {
    const prices = byYear.get(year) || [];
    const count = prices.length;
    const med = median(prices);
    const state = count === 0 ? "missing" : count <= SPARSE_YEAR_MAX ? "sparse" : "data";
    rows.push({
      year,
      count,
      median: med, // null when missing
      changePct: pctChange(prevMedian, med), // vs previous year with data
      state,
    });
    // Only advance the YoY baseline when this year actually had a median, so a
    // gap year doesn't produce a misleading two-year jump labelled as one year.
    if (med != null) prevMedian = med;
  }
  return rows;
}

/** @returns {{ level: "high"|"medium"|"low"|"none", note: string, totalCount: number, latestYearCount: number }} */
function deriveConfidence(totalCount, latestYearCount, txSet) {
  let level;
  if (totalCount === 0) level = "none";
  else if (latestYearCount >= 30 && totalCount >= 100) level = "high";
  else if (latestYearCount >= 10 && totalCount >= 30) level = "medium";
  else level = "low";

  const span = txSet.window.endYear - txSet.window.startYear + 1;
  const note =
    level === "high"
      ? `Based on ${totalCount} Land Registry transactions in ${txSet.district} over ${span} year${span === 1 ? "" : "s"} (${latestYearCount} in the most recent full year) — price figures are well-supported.`
      : level === "medium"
        ? `Based on ${totalCount} transactions in ${txSet.district} (${latestYearCount} in the most recent full year) — figures are indicative; widen your margin of safety.`
        : `Only ${totalCount} transaction${totalCount === 1 ? "" : "s"} on record for ${txSet.district} in this window — treat all price figures as directional only.`;

  return { level, note, totalCount, latestYearCount };
}
