/**
 * lib/brief/sections/nearby-sold-prices.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Recent sales in {outcode}" (fulfils the PRO comparable-sales slot).
 * (Was "Nearby Sold Prices"; renamed — this is a district-wide recency slice, not a
 * proximity filter. Section key stays `nearbySoldPrices` as an API/gating contract.)
 *
 * A pure function of the SAME cached TransactionSet the prices section reads — no
 * network, no divergent price query (BRIEF_SPEC → Data spine). It surfaces the
 * most recent in-district registered sales with an assembled display address, and
 * a computed summary (range + how the recent set sits against the window median).
 *
 * WHY N = 12: enough recent sales to show a representative cross-section (several
 * property types and a real price spread) while staying scannable in one card, and
 * small enough that the sold-prices map's centroid lookup is a single bulk request
 * over ≤12 distinct postcodes. The set is the N most recent in-district sales —
 * never padded from outside the district (BRIEF_SPEC → "no out-of-district backfill").
 *
 * Render states (BRIEF_SPEC → Section render states):
 *   DATA        ≥3 recent in-district sales — full list + summary.
 *   SPARSE      <3 in-district sales total — show what exists, say "fewer than 3
 *               recent in-district sales", NO summary inference, NO backfill.
 *   UNAVAILABLE no in-district sales at all.
 *
 * Standing source note: these are completed, registered sales (HM Land Registry),
 * not asking prices; post-sale negotiation is not reflected in the figure.
 *
 * The `selectRecent` / `assembleAddress` / `monthYear` helpers are exported so the
 * sold-prices map (INV) can display exactly the SAME recent set from the SAME set.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { formatGBP, formatSignedPct } from "../stats.js";
import { isEntitled } from "../entitlements.js";

/** How many recent sales the section surfaces (see WHY N = 12 above). */
export const RECENT_N = 12;

/** A recent set of <3 in-district sales is too thin to summarise → SPARSE. */
const MIN_FOR_DATA = 3;

/** A recent set whose high is ≥ this multiple of its low spans "significantly
 *  different property types" — the only condition under which spread commentary
 *  is emitted (BRIEF_SPEC → no static filler). */
const WIDE_SPREAD_RATIO = 2.5;

const SOURCE_NOTE =
  "These are completed, registered sales from HM Land Registry Price Paid Data — not asking prices. Any negotiation after the sale agreed is not reflected in the recorded figure.";

/**
 * The N most recent in-district transactions. `txSet.transactions` is already
 * deduped, in-district and sorted newest-first, so this is a straight slice.
 * @param {import("../transactions.js").TransactionSet} txSet
 * @param {number} [n=RECENT_N]
 * @returns {import("../transactions.js").Transaction[]}
 */
export function selectRecent(txSet, n = RECENT_N) {
  const txns = Array.isArray(txSet?.transactions) ? txSet.transactions : [];
  return txns.slice(0, Math.max(0, n));
}

/** Title-case a raw PPD field ("GREENWOOD ROAD" → "Greenwood Road"); leaves
 *  pure-numeric tokens ("14") untouched. Empty in → "". */
function titleCase(s) {
  const v = String(s || "").trim();
  if (!v) return "";
  return v.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/**
 * Assemble a display address from PPD parts, filtering missing fields so the
 * result never contains "undefined", empty commas or a dangling space. PPD parts:
 *   saon   secondary object (flat/unit), e.g. "FLAT 2"
 *   paon   primary object (house no./name), e.g. "14" or "THE COACH HOUSE"
 *   street e.g. "GREENWOOD ROAD"
 *   town   e.g. "LONDON"
 * → "Flat 2, 14 Greenwood Road, London" — dropping whatever is absent.
 * @param {import("../transactions.js").Transaction} t
 * @returns {string}
 */
export function assembleAddress(t) {
  const saon = titleCase(t?.saon);
  const paon = titleCase(t?.paon);
  const street = titleCase(t?.street);
  const town = titleCase(t?.town);

  // Building line = house number/name + street, whichever exist.
  const buildingLine = [paon, street].filter(Boolean).join(" ");
  // Prefix the flat/unit only when there is one.
  const streetPart = saon ? [saon, buildingLine].filter(Boolean).join(", ") : buildingLine;
  // Append the town when present and not already the whole of the line.
  const full = [streetPart, town].filter(Boolean).join(", ");
  return full || "Address not recorded";
}

/** "2024-03-14" → "Mar 2024". Bad input → "". */
export function monthYear(isoDate) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(isoDate || ""));
  if (!m) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mon = months[Number(m[2]) - 1];
  return mon ? `${mon} ${m[1]}` : m[1];
}

/** Median of a numeric array (empty → null). Local copy so this module has no
 *  dependency on stats internals beyond the formatters. */
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
 * @param {number} [windowMedian] the spine window median (stats.medianPrice) to
 *   compare the recent set against — computed, not templated.
 * @returns {Object} a BriefSection
 */
export function buildNearbySoldPricesSection(txSet, location, tier, windowMedian = null) {
  const base = {
    key: "nearbySoldPrices",
    // District-wide recency slice (the N most recent in-district sales), NOT filtered by
    // proximity to the searched postcode — see 0d. Title names the district so it never
    // implies "near you". Key stays `nearbySoldPrices` (client/gate/pricing contract).
    title: `Recent sales in ${txSet?.district || location.outcode}`,
    minTier: "PRO",
    entitled: isEntitled(tier, "section.comparableSales"), // PRO; unlock-all → true in 2a
    sourceNote: SOURCE_NOTE,
  };

  const total = Array.isArray(txSet?.transactions) ? txSet.transactions.length : 0;

  // ── UNAVAILABLE: nothing in-district ───────────────────────────────────────
  if (total === 0) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note: `No Land Registry sold prices are on record for ${txSet?.district || location.outcode} in this window.`,
      data: null,
    };
  }

  const recent = selectRecent(txSet);
  const items = recent.map((t) => ({
    id: t.id,
    address: assembleAddress(t),
    postcode: t.postcode,
    price: { raw: t.price, formatted: formatGBP(t.price) },
    propertyType: t.propertyType,
    tenure: t.tenure,
    newBuild: t.newBuild,
    monthYear: monthYear(t.date),
  }));

  // ── SPARSE: fewer than 3 in-district sales exist. Show them, no summary. ────
  if (total < MIN_FOR_DATA) {
    return {
      ...base,
      state: "SPARSE",
      note: `Fewer than 3 recent in-district sales are on record for ${txSet.district} — the sales shown are all that exist; no out-of-district sales are substituted, and the set is too thin to summarise a reliable range.`,
      data: { count: items.length, totalInDistrict: total, items, summary: null },
    };
  }

  // ── DATA ───────────────────────────────────────────────────────────────────
  const prices = recent.map((t) => t.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const recentMedian = median(prices);

  const summary = buildSummary({
    low,
    high,
    recentMedian,
    windowMedian,
    district: txSet.district,
    count: items.length,
  });

  return {
    ...base,
    state: "DATA",
    note: null,
    sourceFootnote: `Source: HM Land Registry Price Paid Data, most recent ${items.length} registered sales in postcode district ${txSet.district}. Deduplicated, in-district only.`,
    data: { count: items.length, totalInDistrict: total, items, summary },
  };
}

/**
 * Summary block for the recent set: low / median / high, a wide-spread flag with
 * commentary ONLY when the computed spread warrants it, and a computed comparison
 * of the recent median against the window median (never templated filler).
 */
function buildSummary({ low, high, recentMedian, windowMedian, district, count }) {
  const spreadRatio = low > 0 ? high / low : null;
  const wide = spreadRatio != null && spreadRatio >= WIDE_SPREAD_RATIO;

  const vsWindowPct =
    windowMedian && recentMedian != null ? ((recentMedian - windowMedian) / windowMedian) * 100 : null;
  const vsWindowDirection =
    vsWindowPct == null ? null : Math.abs(vsWindowPct) < 5 ? "inline" : vsWindowPct > 0 ? "above" : "below";

  let vsWindowText = null;
  if (vsWindowPct != null) {
    if (vsWindowDirection === "inline") {
      vsWindowText = `The most recent ${count} sales are broadly in line with the longer-run window median for ${district}.`;
    } else {
      vsWindowText = `The most recent ${count} sales run ${formatSignedPct(vsWindowPct)} ${vsWindowDirection} the longer-run window median for ${district} — read the trend, not any single recent sale.`;
    }
  }

  return {
    low: { raw: low, formatted: formatGBP(low) },
    median: { raw: recentMedian, formatted: formatGBP(recentMedian) },
    high: { raw: high, formatted: formatGBP(high) },
    windowMedian: windowMedian ? { raw: windowMedian, formatted: formatGBP(windowMedian) } : null,
    vsWindow: vsWindowPct == null ? null : { pct: vsWindowPct, formatted: formatSignedPct(vsWindowPct), direction: vsWindowDirection, text: vsWindowText },
    spread: {
      ratio: spreadRatio,
      wide,
      text: wide
        ? "The recent sales span a wide price range, so significantly different property types or sizes are represented — compare like-for-like before drawing a conclusion."
        : null,
    },
  };
}
