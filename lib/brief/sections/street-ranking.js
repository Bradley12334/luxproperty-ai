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

/** Minimum recorded sales for a street to be ranked at all (see WHY above). */
export const MIN_STREET_TXNS = 5;

/** Below this many qualifying streets, a ranking isn't reliable enough → SPARSE. */
const MIN_QUALIFYING_FOR_DATA = 5;

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
 * @param {import("../transactions.js").TransactionSet} txSet
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @param {number|null} [areaMedian] the spine window median (stats.medianPrice) for
 *   a computed per-street "vs area" figure — never templated.
 * @returns {Object} a BriefSection
 */
export function buildStreetRankingSection(txSet, location, tier, areaMedian = null) {
  const base = {
    key: "streetPriceRanking",
    title: "Street Price Ranking",
    minTier: "INV",
    entitled: isEntitled(tier, "section.streetPriceRanking"), // INV; unlock-all → true in 2a
  };

  const txns = Array.isArray(txSet?.transactions) ? txSet.transactions : [];
  const district = txSet?.district || location.outcode;

  // ── UNAVAILABLE: nothing in-district ───────────────────────────────────────
  if (txns.length === 0) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note: `No Land Registry sold prices are on record for ${district} in this window, so streets cannot be ranked.`,
      data: null,
    };
  }

  // ── Group by street ────────────────────────────────────────────────────────
  const byStreet = new Map(); // norm → { prices[] }
  let namedStreets = 0;
  let unnamed = 0;
  for (const t of txns) {
    const key = normStreet(t.street);
    if (!key) {
      unnamed++;
      continue; // can't rank a street we can't name
    }
    if (!byStreet.has(key)) {
      byStreet.set(key, []);
      namedStreets++;
    }
    byStreet.get(key).push(t.price);
  }

  // ── Qualify + rank ─────────────────────────────────────────────────────────
  const qualifying = [];
  for (const [norm, prices] of byStreet) {
    if (prices.length < MIN_STREET_TXNS) continue;
    const med = median(prices);
    qualifying.push({
      street: displayStreet(norm),
      count: prices.length,
      median: { raw: med, formatted: formatGBP(med) },
      vsArea: computeVsArea(med, areaMedian),
    });
  }
  // Rank by median, high → low. Ties broken by count (more evidence first) then name
  // so the order is deterministic for a whole deploy cycle.
  qualifying.sort(
    (a, b) => b.median.raw - a.median.raw || b.count - a.count || a.street.localeCompare(b.street),
  );
  qualifying.forEach((s, i) => (s.rank = i + 1));

  const qCount = qualifying.length;
  const sourceFootnote = `Source: HM Land Registry Price Paid Data, ${txSet.window.startYear}–${txSet.window.endYear}, postcode district ${district}. Streets ranked by median of at least ${MIN_STREET_TXNS} recorded sales; ${qCount} of ${namedStreets} named streets qualify.`;

  // ── SPARSE: too few streets clear the minimum to rank reliably ─────────────
  if (qCount < MIN_QUALIFYING_FOR_DATA) {
    const note =
      qCount === 0
        ? `No street in ${district} has at least ${MIN_STREET_TXNS} recorded sales in this window, so none can be ranked reliably. Sales are spread too thinly across streets to compare them.`
        : `Only ${qCount} street${qCount === 1 ? "" : "s"} in ${district} clear${qCount === 1 ? "s" : ""} the ${MIN_STREET_TXNS}-sale minimum needed to rank reliably — treat this as directional, not a full picture.`;
    return {
      ...base,
      state: "SPARSE",
      note,
      sourceFootnote,
      data: {
        qualifyingCount: qCount,
        namedStreets,
        unnamed,
        minSales: MIN_STREET_TXNS,
        areaMedian: areaMedian ? { raw: areaMedian, formatted: formatGBP(areaMedian) } : null,
        top: qualifying, // whatever qualifies, ranked
        bottom: [],
      },
    };
  }

  // ── DATA ───────────────────────────────────────────────────────────────────
  const top = qualifying.slice(0, END_SIZE);
  // Bottom is the tail that does NOT overlap the top slice (no street shown twice).
  const bottom = qCount > END_SIZE ? qualifying.slice(-Math.min(END_SIZE, qCount - END_SIZE)) : [];

  return {
    ...base,
    state: "DATA",
    note: null,
    sourceFootnote,
    data: {
      qualifyingCount: qCount,
      namedStreets,
      unnamed,
      minSales: MIN_STREET_TXNS,
      areaMedian: areaMedian ? { raw: areaMedian, formatted: formatGBP(areaMedian) } : null,
      top,
      bottom,
    },
  };
}

/** Per-street position relative to the area median — computed, for context only. */
function computeVsArea(streetMedian, areaMedian) {
  if (!areaMedian || streetMedian == null) return null;
  const pct = ((streetMedian - areaMedian) / areaMedian) * 100;
  return { pct, formatted: formatSignedPct(pct), direction: Math.abs(pct) < 5 ? "inline" : pct > 0 ? "above" : "below" };
}
