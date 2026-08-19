/**
 * lib/brief/sections/street-ranking.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Street Price Ranking" (INV).
 *
 * A pure function of the SAME cached TransactionSet (the full window, not just the
 * recent set) — no network, no divergent price query (BRIEF_SPEC → Data spine).
 * It groups the in-district sales by street, takes each street's median, and ranks
 * the streets that clear a minimum sale count so thin evidence can never masquerade
 * as a confident ranking.
 *
 * WHY MIN 5 SALES PER STREET: a street median from <5 recorded sales is too
 * volatile to rank an area on — one large or small sale swings it. Five is the
 * smallest count that yields a minimally stable median while still surfacing enough
 * streets to rank in a typical outcode. Streets below the threshold are NEVER
 * ranked (BRIEF_SPEC → "No street ranked below the threshold"); the count is carried
 * on every row so the reader can see exactly how thin each street's evidence is.
 *
 * Render states (BRIEF_SPEC → Section render states):
 *   DATA        ≥5 qualifying streets — top and bottom of the ranking, with counts.
 *   SPARSE      1–4 qualifying streets, OR streets exist but none clear the minimum
 *               — say so plainly; show whatever qualifies.
 *   UNAVAILABLE no in-district transactions at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { formatGBP, formatSignedPct } from "../stats.js";
import { isEntitled } from "../entitlements.js";

/** Minimum recorded sales for a street to appear at all.
 *
 *  Raised from 5 to 12 on measured evidence across all 694,523 district-streets:
 *   - Among streets disturbed at all by new data, the share whose median moved
 *     >10% falls from 28% at 5 sales to 8.5% at 12 and 6% at 20.
 *   - The claim the section actually makes — that the dearer block is dearer than
 *     the cheaper block — holds in 80.8% of districts at a 5-sale floor and PEAKS
 *     at 90.4% at 12, then falls again (86.4% at 20, 75.6% at 30) because raising
 *     the floor truncates the very tails that made the blocks separable.
 *  Cost is 61 districts (2.7%) losing their ranking entirely. */
export const MIN_STREET_TXNS = 12;

/** Below this many qualifying streets, blocks can't be formed → SPARSE. */
const MIN_QUALIFYING_FOR_DATA = 5;

/** A street whose upper quartile is at least this multiple of its lower quartile is
 *  BIMODAL — it holds two different markets, not one level, so its median describes
 *  neither. E20 Waterden Road is the worked example: 13 affordable units at
 *  £107k-£362k and 18 market new-builds at £457k-£797k (p75/p25 = 4.9), whose median
 *  moved 119.8% when the 2025 block completed. Driven by mixed old/new and
 *  affordable/market stock — streets that are PARTLY new-build are 17.2% bimodal
 *  against a 7.4% baseline, while fully-new-build streets are only 2.0%. */
const BIMODAL_QUARTILE_RATIO = 2;

/** How many streets to show at each end of the ranking. */
const END_SIZE = 5;

/** Normalise a street name for GROUPING: uppercase, trim, collapse inner spaces so
 *  "Greenwood  Road" and "GREENWOOD ROAD" are one street. */
function normStreet(s) {
  return String(s || "").trim().toUpperCase().replace(/\s+/g, " ");
}

/** Title-case a normalised street name for DISPLAY. */
function displayStreet(norm) {
  return norm.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/** Median of a numeric array (empty → null). */
function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * @param {import("../tx-source.js").Spine} spine
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @param {number|null} [areaMedian] the spine window median (stats.medianPrice) for
 *   a computed per-street "vs area" figure — never templated.
 * @returns {Object} a BriefSection
 */
export function buildStreetRankingSection(spine, location, tier, areaMedian = null) {
  const base = {
    key: "streetPriceRanking",
    title: "Street Price Ranking",
    minTier: "INV",
    entitled: isEntitled(tier, "section.streetPriceRanking"),
  };

  const district = spine?.district || location.outcode;
  const window = spine?.window || null;
  const allStreets = Array.isArray(spine?.streets) ? spine.streets : [];
  const namedStreets = spine?.streetsTotal ?? allStreets.length;

  // ── UNAVAILABLE: nothing in-district ───────────────────────────────────────
  if ((spine?.totalCount ?? 0) === 0) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note: `No Land Registry sold prices are on record for ${district} in this window, so streets cannot be compared.`,
      data: null,
    };
  }

  // ── Qualify ────────────────────────────────────────────────────────────────
  // Two independent gates. Volume decides whether the median is stable enough to
  // use; the quartile ratio decides whether the street has ONE level to describe.
  const qualifying = [];
  let excludedThin = 0;
  let excludedBimodal = 0;
  for (const st of allStreets) {
    if (!st?.street || st.median == null) continue;
    if (st.count < MIN_STREET_TXNS) { excludedThin++; continue; }
    if (st.p25 > 0 && st.p75 / st.p25 >= BIMODAL_QUARTILE_RATIO) { excludedBimodal++; continue; }
    qualifying.push({
      street: displayStreet(st.street),
      count: st.count,
      median: { raw: st.median, formatted: formatGBP(st.median) },
      // The band the street's own sales support. Carried so the reader can see that
      // two streets a few percent apart are not distinguishable.
      range: st.ciLo != null && st.ciHi != null
        ? { low: st.ciLo, high: st.ciHi, formatted: `${formatGBP(st.ciLo)}–${formatGBP(st.ciHi)}` }
        : null,
      ciLo: st.ciLo ?? null,
      ciHi: st.ciHi ?? null,
      vsArea: computeVsArea(st.median, areaMedian),
    });
  }
  // Sorted for a deterministic payload only. NO rank is emitted: across the whole
  // dataset just 1.3% of adjacent pairs in a district's ranking are separated by
  // more than their own error bars (0.4% at the old 5-sale floor, 8.7% even at 30),
  // so a numbered order would be a claim the data cannot support at ANY threshold.
  qualifying.sort((a, b) => b.median.raw - a.median.raw || b.count - a.count || a.street.localeCompare(b.street));

  const qCount = qualifying.length;
  const windowLabel = window ? `${window.startYear}–${window.endYear}` : "the window";
  const sourceFootnote =
    `Source: HM Land Registry Price Paid Data, ${windowLabel}, postcode district ${district}. ` +
    `Streets need at least ${MIN_STREET_TXNS} recorded sales to appear; ${qCount} of ${namedStreets} named streets qualify` +
    (excludedBimodal
      ? `. ${excludedBimodal} further street${excludedBimodal === 1 ? " was" : "s were"} set aside for holding two clearly different price levels (typically mixed new-build and existing stock), where a single median describes neither.`
      : ".");

  // The two-block sentence describes a layout that only exists in the DATA state.
  // Emitted unconditionally it was false on every SPARSE render, where a single
  // undifferentiated list is shown — the same defect as the trend footnote.
  const blockFootnote =
    " Streets are grouped into a dearer and a cheaper set, not ranked in order — the gaps between neighbouring streets are smaller than the uncertainty in their medians.";
  const listFootnote =
    " These streets are listed together, not split into dearer and cheaper groups: their price ranges overlap too much to separate them.";

  // ── SPARSE: too few qualifying streets to form two blocks ──────────────────
  if (qCount < MIN_QUALIFYING_FOR_DATA) {
    const note =
      qCount === 0
        ? `No street in ${district} has at least ${MIN_STREET_TXNS} recorded sales in this window, so none can be compared reliably. The sales that exist are spread too thinly across streets.`
        : `Only ${qCount} street${qCount === 1 ? "" : "s"} in ${district} clear${qCount === 1 ? "s" : ""} the ${MIN_STREET_TXNS}-sale minimum — enough to show, not enough to say which parts of the district are dearer.`;
    return {
      ...base,
      state: "SPARSE",
      note,
      sourceFootnote: sourceFootnote + listFootnote,
      data: {
        qualifyingCount: qCount, namedStreets, excludedThin, excludedBimodal,
        minSales: MIN_STREET_TXNS,
        areaMedian: areaMedian ? { raw: areaMedian, formatted: formatGBP(areaMedian) } : null,
        blockClaim: false,
        streets: qualifying,
        top: qualifying,
        bottom: [],
      },
    };
  }

  const top = qualifying.slice(0, END_SIZE);
  const bottom = qCount > END_SIZE ? qualifying.slice(-Math.min(END_SIZE, qCount - END_SIZE)) : [];

  // ── The block claim, gated on the error bars ──────────────────────────────
  // "These streets are dearer than those" is only true if the dearer block's lowest
  // credible value clears the cheaper block's highest. Holds in 90.4% of districts
  // at this threshold; the other ~9.6% render SPARSE rather than assert it.
  const blockClaim = separated(top, bottom);
  if (!blockClaim) {
    return {
      ...base,
      state: "SPARSE",
      note:
        `${qCount} streets in ${district} have enough recorded sales to show, but their price ranges overlap ` +
        `too much to say that any group of them is genuinely dearer than another. The medians below are real; ` +
        `the differences between them are not larger than the uncertainty in the figures.`,
      sourceFootnote,
      data: {
        qualifyingCount: qCount, namedStreets, excludedThin, excludedBimodal,
        minSales: MIN_STREET_TXNS,
        areaMedian: areaMedian ? { raw: areaMedian, formatted: formatGBP(areaMedian) } : null,
        blockClaim: false,
        streets: qualifying.slice(0, END_SIZE * 2),
        top: qualifying.slice(0, END_SIZE * 2),
        bottom: [],
      },
    };
  }

  return {
    ...base,
    state: "DATA",
    note: null,
    sourceFootnote: sourceFootnote + blockFootnote,
    data: {
      qualifyingCount: qCount, namedStreets, excludedThin, excludedBimodal,
      minSales: MIN_STREET_TXNS,
      areaMedian: areaMedian ? { raw: areaMedian, formatted: formatGBP(areaMedian) } : null,
      blockClaim: true,
      streets: qualifying,
      top,
      bottom,
    },
  };
}

/** Does the dearer block clear the cheaper one, allowing for each street's own
 *  90% interval? Streets without an interval fall back to their median, which is
 *  the conservative reading (no error bar to hide behind). */
function separated(top, bottom) {
  if (!top.length || !bottom.length) return false;
  const topFloor = Math.min(...top.map((s) => s.ciLo ?? s.median.raw));
  const bottomCeil = Math.max(...bottom.map((s) => s.ciHi ?? s.median.raw));
  return topFloor > bottomCeil;
}

/** Per-street position relative to the area median — computed, for context only. */
function computeVsArea(streetMedian, areaMedian) {
  if (!areaMedian || streetMedian == null) return null;
  const pct = ((streetMedian - areaMedian) / areaMedian) * 100;
  return { pct, formatted: formatSignedPct(pct), direction: Math.abs(pct) < 5 ? "inline" : pct > 0 ? "above" : "below" };
}
