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

// ── Serving thresholds ────────────────────────────────────────────────────────
// Every number here was derived from the full 8.5M-transaction PPD dataset by
// measuring the distribution-free 90% confidence interval of a median (binomial
// order statistics — no normality assumption, and it uses each district's OWN
// price dispersion). See ~/Documents/ppd-agg/thresholds.mjs for the working.
//
// They are applied HERE, in the shared derivation, so the aggregate path and the
// legacy SPARQL path make identical presentation decisions. A difference between
// the two can then only be a difference in the DATA.

/** Below 5 sales, no 90% interval for the median exists at all: the widest possible
 *  interval [min,max] has coverage 1 - 2^(1-n), which first reaches 90% at n=5. A
 *  year with 1-4 sales therefore reports its COUNT and no median — the old code
 *  printed a median from a single sale. */
const YEAR_MIN_FOR_MEDIAN = 5;

/** At 30 sales a year's median carries ~±16% at p50 and ~±29% at p90. Below that,
 *  measured across 22,786 district-years, over 80% of printed year-on-year moves are
 *  smaller than their own error bar. 5-29 still shows a median, marked sparse. */
const YEAR_MIN_FOR_DATA = 30;

/** Below 100 sales in the whole window the window median carries ±10% at p50 and up
 *  to ±103% at p90 — not a price statistic. 58 districts (2.5%) holding 0.022% of all
 *  transactions. */
const WINDOW_MIN_FOR_MEDIAN = 100;

/** fairValue quotes a ±8% band and openingOffer multiplies the anchor. Both are
 *  meaningless when the anchor's own 90% error is wider than the band they quote —
 *  which stops being true at 300 sales (p90 ±7.1%). */
const WINDOW_MIN_FOR_VALUATION = 300;

export const THRESHOLDS = Object.freeze({
  YEAR_MIN_FOR_MEDIAN,
  YEAR_MIN_FOR_DATA,
  WINDOW_MIN_FOR_MEDIAN,
  WINDOW_MIN_FOR_VALUATION,
});

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

  // Collapse the raw set into the SAME per-year series shape the offline aggregate
  // stores, then run the one shared derivation. Both sources converge here.
  const byYear = new Map();
  for (const t of transactions) {
    const y = Number(t.date.slice(0, 4));
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(t.price);
  }
  const perYear = [];
  for (let year = window.startYear; year <= window.endYear; year++) {
    const prices = (byYear.get(year) || []).sort((a, b) => a - b);
    perYear.push({ year, count: prices.length, median: median(prices), ...medianCi(prices) });
  }
  const allPrices = transactions.map((t) => t.price).sort((a, b) => a - b);

  return deriveStats({
    district: txSet.district,
    window,
    totalCount: transactions.length,
    median: median(allPrices),
    ...medianCi(allPrices),
    min: allPrices[0] ?? null,
    max: allPrices[allPrices.length - 1] ?? null,
    perYear,
  });
}

/**
 * Build the stats object for a district from an offline PPD aggregate row, without
 * ever materialising 8.5M transactions. Produces byte-identical shape to
 * computeStats — same thresholds, same confidence rules, same trend states — so no
 * downstream section can tell which source it is reading.
 *
 * @param {Object} agg the aggregate payload (see ~/Documents/ppd-agg/aggregate.mjs)
 * @param {{startYear:number,endYear:number}} window taken from the ROW's
 *   window_start/window_end, never computed from the clock.
 */
export function statsFromAggregate(agg, window) {
  if (!agg || !Array.isArray(agg.byYear)) {
    throw new BriefError(ErrorCodes.BAD_INPUT, "statsFromAggregate expects an aggregate payload with a byYear series.", {});
  }
  return deriveStats({
    district: agg.district,
    window,
    totalCount: agg.txCount,
    median: agg.median,
    ciLo: agg.ciLo,
    ciHi: agg.ciHi,
    min: agg.min ?? null,
    max: agg.max ?? null,
    perYear: agg.byYear.map((y) => ({ year: y.year, count: y.count, median: y.median, ciLo: y.ciLo, ciHi: y.ciHi })),
  });
}

/**
 * THE single derivation. Everything the brief says about price comes through here,
 * from either source, so the serving thresholds cannot drift apart between them.
 *
 * @param {{district:string, window:{startYear:number,endYear:number}, totalCount:number,
 *          median:number|null, ciLo:number|null, ciHi:number|null,
 *          perYear:Array<{year:number,count:number,median:number|null,ciLo:number|null,ciHi:number|null}>}} input
 */
function deriveStats({ district, window, totalCount, median: windowMedian, ciLo, ciHi, min, max, perYear }) {
  const { startYear, endYear } = window;
  const trend = buildTrend(perYear);
  const byYearIndex = new Map(perYear.map((y) => [y.year, y]));

  const emptyYear = (year) => ({ year, count: 0, median: null, ciLo: null, ciHi: null });
  const latestRaw = byYearIndex.get(endYear) || emptyYear(endYear);
  const prevRaw = byYearIndex.get(endYear - 1) || emptyYear(endYear - 1);

  // A year's median is only published above the CI-existence floor.
  const publish = (y) => (y.count >= YEAR_MIN_FOR_MEDIAN ? y.median : null);
  const latestYear = { year: latestRaw.year, count: latestRaw.count, median: publish(latestRaw), ciLo: latestRaw.ciLo, ciHi: latestRaw.ciHi };
  const previousYear = { year: prevRaw.year, count: prevRaw.count, median: publish(prevRaw), ciLo: prevRaw.ciLo, ciHi: prevRaw.ciHi };

  // ── No data at all ─────────────────────────────────────────────────────────
  if (totalCount === 0) {
    return unavailableStats(district, window, trend, {
      level: "none",
      note: `No Land Registry transactions found in this postcode district for the window \u2014 price figures are unavailable.`,
      totalCount: 0,
      latestYearCount: 0,
    });
  }

  // ── Below the window floor ─────────────────────────────────────────────────
  // The district HAS sales, just not enough for a median to mean anything. The
  // sales themselves are facts and stay visible; only the summary claim is
  // withheld. `available` therefore stays true — this is a sparse render, not an
  // absent one — and every derived claim is nulled with a stated reason.
  //
  // The range is carried deliberately. A list of sales with no stated spread
  // invites the reader to average it by eye, which is the very inference the
  // sample cannot support; three sales spanning 180k-900k must SAY so.
  if (totalCount < WINDOW_MIN_FOR_MEDIAN) {
    return {
      available: true,
      district,
      window,
      totalCount,
      medianPrice: null,
      medianCi: null,
      priceRange: min != null && max != null ? { low: min, high: max } : null,
      latestYear,
      previousYear,
      yoyChangePct: null,
      yoyChange: { changePct: null, significant: false, errorPct: null },
      trend,
      pricePerSqm: null,
      fairValue: null,
      openingOffer: null,
      // Below-floor is a withholding like any other, so it uses the same field and
      // renders through the same notice — rather than leaving the negotiation block
      // to vanish, which would read as a load failure.
      valuationWithheld:
        `No fair-value or opening-offer range is quoted for ${district}. With ${totalCount} recorded ` +
        `sale${totalCount === 1 ? "" : "s"} in the whole window there is no reliable typical price to anchor one to, ` +
        `and a range built on this many sales would imply a precision the evidence cannot support. This is a ` +
        `deliberate omission, not missing data: the recorded sales are listed in full below.`,
      summaryWithheld: {
        reason: "below-window-threshold",
        note:
          `Too few recorded sales in ${district} to state a typical price. ` +
          `${totalCount} sale${totalCount === 1 ? " is" : "s are"} on record across ` +
          `${endYear - startYear + 1} years` +
          (min != null && max != null && min !== max
            ? `, ranging from ${formatGBP(min)} to ${formatGBP(max)}. That spread is the honest picture — ` +
              `a median drawn from this many sales would carry a wider margin of error than the price ` +
              `differences you are trying to judge, so none is shown.`
            : `. A median drawn from this many sales would carry a wider margin of error than the price ` +
              `differences you are trying to judge, so none is shown.`),
        minimum: WINDOW_MIN_FOR_MEDIAN,
      },
      offerConfidence: "Thin",
      confidence: {
        level: "low",
        note:
          `Only ${totalCount} transaction${totalCount === 1 ? "" : "s"} on record for ${district} in this window — ` +
          `individual sales are shown, but there is no basis for a typical price.`,
        totalCount,
        latestYearCount: latestYear.count,
      },
    };
  }

  // ── Year-on-year, gated on the error bar rather than a sample count ─────────
  // A change is only reported when it exceeds the combined 90% uncertainty of the
  // two years it is drawn from. Measured across the full dataset, only 8-27% of
  // printed YoY moves clear that bar below n=150 \u2014 the rest were noise wearing a
  // percentage sign.
  const yoy = significantChange(prevRaw, latestRaw);
  const yoyChangePct = yoy.significant ? yoy.changePct : null;

  // ── Fair value / opening offer ─────────────────────────────────────────────
  // Anchored to the most recent publishable year median, falling back to the window
  // median. Withheld entirely below the valuation floor: a \u00b18% band quoted around
  // an anchor whose own 90% error is wider than \u00b18% is not a valuation.
  const anchor = latestYear.median ?? windowMedian;
  let fairValue = null;
  let openingOffer = null;
  let valuationWithheld = null;

  if (totalCount < WINDOW_MIN_FOR_VALUATION) {
    valuationWithheld =
      `Fair-value and opening-offer ranges are not shown for ${district}: with ${totalCount} recorded sales ` +
      `the area median carries a wider margin of error than the \u00b18% band those ranges would quote, so any ` +
      `figure would imply precision the data cannot support.`;
  } else if (anchor != null) {
    fairValue = { anchor, low: Math.round(anchor * 0.92), high: Math.round(anchor * 1.08) };
    const isSoftMarket = yoyChangePct != null && yoyChangePct < 0;
    const isHighDemand = latestYear.count > 40;
    const loMult = isSoftMarket ? 0.86 : isHighDemand ? 0.9 : 0.88;
    const hiMult = isSoftMarket ? 0.94 : isHighDemand ? 0.96 : 0.95;
    openingOffer = { low: Math.round(anchor * loMult), high: Math.round(anchor * hiMult) };
  }

  const offerConfidence =
    latestYear.count >= YEAR_MIN_FOR_DATA ? "Strong" : latestYear.count >= 10 ? "Moderate" : "Thin";

  return {
    available: true,
    district,
    window,
    totalCount,
    medianPrice: windowMedian,
    medianCi: ciLo != null && ciHi != null ? { low: ciLo, high: ciHi } : null,
    priceRange: min != null && max != null ? { low: min, high: max } : null,
    latestYear,
    previousYear,
    yoyChangePct,
    yoyChange: yoy,
    trend,
    pricePerSqm: null, // omitted \u2014 no floor-area data; never estimated
    fairValue,
    openingOffer,
    valuationWithheld,
    summaryWithheld: null,
    offerConfidence,
    confidence: deriveConfidence(totalCount, latestYear.count, district, window),
  };
}

/** The honest empty shape, shared by "no sales" and "too few sales to speak". */
function unavailableStats(district, window, trend, confidence) {
  return {
    available: false,
    district,
    window,
    totalCount: confidence.totalCount,
    medianPrice: null,
    medianCi: null,
    priceRange: null,
    latestYear: { year: window.endYear, count: confidence.latestYearCount ?? 0, median: null, ciLo: null, ciHi: null },
    previousYear: { year: window.endYear - 1, count: 0, median: null, ciLo: null, ciHi: null },
    yoyChangePct: null,
    yoyChange: { changePct: null, significant: false, errorPct: null },
    trend,
    pricePerSqm: null,
    fairValue: null,
    openingOffer: null,
    valuationWithheld: null,
    summaryWithheld: null,
    offerConfidence: "Thin",
    confidence,
  };
}

/** Relative half-width of a median's 90% CI, as a percentage of the median. */
function relErrorPct(m, lo, hi) {
  if (m == null || lo == null || hi == null || m === 0) return null;
  return ((hi - lo) / (2 * m)) * 100;
}

/**
 * Is the move between two years larger than the uncertainty of the two medians it
 * is drawn from? Errors are combined in quadrature (the years are independent
 * samples). When either year lacks a CI \u2014 below the 5-sale floor \u2014 the answer is
 * always "no", because there is no error bar to clear.
 */
function significantChange(prev, latest) {
  const changePct = pctChange(prev?.median, latest?.median);
  const ePrev = relErrorPct(prev?.median, prev?.ciLo, prev?.ciHi);
  const eLatest = relErrorPct(latest?.median, latest?.ciLo, latest?.ciHi);
  if (changePct == null || ePrev == null || eLatest == null) {
    return { changePct, significant: false, errorPct: null };
  }
  const errorPct = Math.sqrt(ePrev * ePrev + eLatest * eLatest);
  return { changePct, significant: Math.abs(changePct) > errorPct, errorPct };
}

/**
 * Build the per-year trend across the FULL requested window (not just years that
 * happen to have data), so missing years render as "\u2014" rather than vanishing.
 *
 * Three states, unchanged in name so the client contract holds ("data"|"sparse"|
 * "missing"), but the boundaries moved on evidence:
 *   missing  0 sales
 *   sparse   1-29. Below 5 the median is WITHHELD (median: null) because no 90%
 *            interval exists for it; 5-29 shows a median carrying real uncertainty.
 *   data     30+
 * A year-on-year change is attached only when it exceeds the combined error bar of
 * the two years \u2014 otherwise changePct is null and the row renders "\u2014", which is
 * the honest answer for a move that cannot be distinguished from sampling noise.
 *
 * @param {Array<{year:number,count:number,median:number|null,ciLo:number|null,ciHi:number|null}>} perYear
 */
function buildTrend(perYear) {
  const rows = [];
  let prev = null; // the last year whose median was actually published
  for (const y of perYear) {
    const publishable = y.count >= YEAR_MIN_FOR_MEDIAN;
    const med = publishable ? y.median : null;
    const state = y.count === 0 ? "missing" : y.count < YEAR_MIN_FOR_DATA ? "sparse" : "data";
    const change = prev && med != null ? significantChange(prev, { ...y, median: med }) : null;
    rows.push({
      year: y.year,
      count: y.count,
      median: med,
      ciLo: publishable ? y.ciLo : null,
      ciHi: publishable ? y.ciHi : null,
      // Null unless the move clears its own uncertainty. A suppressed change is not
      // the same as no change, so the reason is carried for anyone inspecting.
      changePct: change?.significant ? change.changePct : null,
      changeSuppressed: change && !change.significant ? "within-error-bar" : null,
      // Why a median is absent, when it is: below the CI-existence floor, not missing.
      medianWithheld: y.count > 0 && !publishable ? "below-ci-floor" : null,
      state,
    });
    if (med != null) prev = { ...y, median: med };
  }
  return rows;
}

/** @returns {{ level: "high"|"medium"|"low"|"none", note: string, totalCount: number, latestYearCount: number }} */
function deriveConfidence(totalCount, latestYearCount, district, window) {
  // Recalibrated against the measured error curve. The old "high" bar (Y>=30,
  // T>=100) sat at roughly \u00b118% p90 on the window median \u2014 it described a figure
  // that could be a fifth wrong as well-supported.
  let level;
  if (totalCount === 0) level = "none";
  else if (latestYearCount >= 100 && totalCount >= 1000) level = "high";
  else if (latestYearCount >= YEAR_MIN_FOR_DATA && totalCount >= WINDOW_MIN_FOR_VALUATION) level = "medium";
  else level = "low";

  const span = window.endYear - window.startYear + 1;
  const note =
    level === "high"
      ? `Based on ${totalCount.toLocaleString()} Land Registry transactions in ${district} over ${span} year${span === 1 ? "" : "s"} (${latestYearCount} in the most recent full year) \u2014 price figures are well-supported.`
      : level === "medium"
        ? `Based on ${totalCount.toLocaleString()} transactions in ${district} (${latestYearCount} in the most recent full year) \u2014 figures are sound but not precise; widen your margin of safety.`
        : `Only ${totalCount.toLocaleString()} transaction${totalCount === 1 ? "" : "s"} on record for ${district} in this window \u2014 treat all price figures as directional only.`;

  return { level, note, totalCount, latestYearCount };
}

// \u2500\u2500 median confidence interval \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// The SPARQL path has raw prices and must derive the same interval the offline
// aggregate stores, or the two sources would disagree on presentation while agreeing
// on data. Distribution-free, from binomial order statistics at p=0.5.

const _ciRanks = new Map();
function medianCiRanks(n) {
  if (_ciRanks.has(n)) return _ciRanks.get(n);
  // Coverage of the widest interval [min,max] is 1 - 2^(1-n); below n=5 it cannot
  // reach 90%, so no interval exists and the honest answer is null.
  if (n < YEAR_MIN_FOR_MEDIAN) { _ciRanks.set(n, null); return null; }
  const lchoose = (nn, k) => lgamma(nn + 1) - lgamma(k + 1) - lgamma(nn - k + 1);
  let lo = 0, acc = 0;
  for (let k = 0; k <= n; k++) { acc += Math.exp(lchoose(n, k) - n * Math.LN2); if (acc > 0.05) { lo = k; break; } }
  let hi = n - 1; acc = 0;
  for (let k = n; k >= 0; k--) { acc += Math.exp(lchoose(n, k) - n * Math.LN2); if (acc > 0.05) { hi = k; break; } }
  lo = Math.max(0, Math.min(lo, n - 1));
  hi = Math.max(lo, Math.min(hi, n - 1));
  const r = [lo, hi];
  _ciRanks.set(n, r);
  return r;
}

function lgamma(z) { // Lanczos
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Strip every derived valuation from a stats object, because its anchor is known to
 * be at the wrong level for the address being briefed.
 *
 * THE RULE, stated once and applied everywhere it recurs: wherever the brief tells a
 * reader that a figure is the wrong level for their address, no valuation or offer
 * range anchored to that figure may be shown alongside it. A caveat cannot repair
 * the contradiction — the reader is given a number and told in the same breath not
 * to trust it, and the number is what they will act on.
 *
 * The FACTS survive (district median, sector median, counts, the sales themselves).
 * Only the claims derived from the wrong anchor are withheld, and the copy says so
 * explicitly, so this reads as a decision rather than as data we failed to fetch.
 *
 * @param {Object} stats
 * @param {string} note reader-facing explanation of the omission
 */
export function withholdValuation(stats, note) {
  if (!stats) return stats;
  return { ...stats, fairValue: null, openingOffer: null, valuationWithheld: note };
}

/** { ciLo, ciHi } for a SORTED price array; nulls below the 5-sale floor. */
export function medianCi(sorted) {
  const r = medianCiRanks(sorted.length);
  if (!r) return { ciLo: null, ciHi: null };
  return { ciLo: sorted[r[0]], ciHi: sorted[r[1]] };
}
