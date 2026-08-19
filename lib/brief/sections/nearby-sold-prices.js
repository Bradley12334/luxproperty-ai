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

/** "The most recent sales" is only honest while those sales are actually recent.
 *  Measured across all 2,304 districts: the 12th most recent sale is 0.6 months old
 *  at p50 and 2.3 at p90, but 22.2 months at p99 and up to 78 months at worst. A
 *  24-month cap therefore binds on under 1% of districts while capping the worst
 *  case at two years instead of six and a half. 24 rather than 12 because a 12-month
 *  cap leaves 84 districts unable to fill the set against 47 at 24; and rather than
 *  36 because that only recovers 5 more districts — the curve has flattened. */
const RECENT_MAX_AGE_MONTHS = 24;

/** Below this many sales inside the recency window, fall back to the most recent
 *  regardless of age and label every comp's age rather than show a near-empty set. */
const MIN_QUALIFYING_RECENT = 6;

/** A recent set of <3 in-district sales is too thin to summarise → SPARSE. */
const MIN_FOR_DATA = 3;

/** A recent set whose high is ≥ this multiple of its low spans "significantly
 *  different property types" — the only condition under which spread commentary
 *  is emitted (BRIEF_SPEC → no static filler). */
const WIDE_SPREAD_RATIO = 2.5;

const SOURCE_NOTE =
  "These are completed, registered sales from HM Land Registry Price Paid Data — not asking prices. Any negotiation after the sale agreed is not reflected in the recorded figure.";

/**
 * The N most recent in-district transactions. `spine.recent` is already
 * deduped, in-district and sorted newest-first, so this is a straight slice.
 * @param {import("../tx-source.js").Spine} spine
 * @param {number} [n=RECENT_N]
 * @returns {import("../transactions.js").Transaction[]}
 */
export function selectRecent(spine, n = RECENT_N) {
  const all = Array.isArray(spine?.recent) ? spine.recent : [];
  const limit = Math.max(0, n);

  // The cutoff is measured from the DATA's window end, not the clock — the same
  // discipline as taking the window from the row. A brief generated in March must
  // not silently narrow its comp set relative to one generated in January.
  const endYear = spine?.window?.endYear;
  if (!endYear) return { items: all.slice(0, limit), agedFallback: false, cutoff: null };

  const cutoffDate = new Date(Date.UTC(endYear, 11, 31));
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - RECENT_MAX_AGE_MONTHS);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const fresh = all.filter((t) => t.date >= cutoff);
  if (fresh.length >= MIN_QUALIFYING_RECENT) {
    return { items: fresh.slice(0, limit), agedFallback: false, cutoff };
  }
  return { items: all.slice(0, limit), agedFallback: true, cutoff };
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
 * @param {import("../tx-source.js").Spine} spine
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @param {number} [windowMedian] the spine window median (stats.medianPrice) to
 *   compare the recent set against — computed, not templated.
 * @returns {Object} a BriefSection
 */
export function buildNearbySoldPricesSection(spine, location, tier, windowMedian = null) {
  const base = {
    key: "nearbySoldPrices",
    // District-wide recency slice (the N most recent in-district sales), NOT filtered by
    // proximity to the searched postcode — see 0d. Title names the district so it never
    // implies "near you". Key stays `nearbySoldPrices` (client/gate/pricing contract).
    title: `Recent sales in ${spine?.district || location.outcode}`,
    minTier: "PRO",
    entitled: isEntitled(tier, "section.comparableSales"),
    sourceNote: SOURCE_NOTE,
  };

  const district = spine?.district || location.outcode;
  const total = spine?.totalCount ?? 0;

  // ── UNAVAILABLE: nothing in-district ───────────────────────────────────────
  if (total === 0) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note: `No Land Registry sold prices are on record for ${district} in this window.`,
      data: null,
    };
  }

  const { items: recent, agedFallback, cutoff } = selectRecent(spine);
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

  // ── The spread, stated ALWAYS ──────────────────────────────────────────────
  // Not only in the DATA state. A list of sales with no stated range invites the
  // reader to average it by eye, and that inference is worst exactly where the set
  // is thinnest — so the count and the range are facts this section always states,
  // whether or not it is willing to summarise them.
  const prices = recent.map((t) => t.price);
  const low = prices.length ? Math.min(...prices) : null;
  const high = prices.length ? Math.max(...prices) : null;
  const spread =
    low != null && high != null
      ? {
          low: { raw: low, formatted: formatGBP(low) },
          high: { raw: high, formatted: formatGBP(high) },
          statement:
            low === high
              ? `1 recorded sale, at ${formatGBP(low)}.`
              : `${items.length} recorded sale${items.length === 1 ? "" : "s"} shown, ranging from ${formatGBP(low)} to ${formatGBP(high)}. They are individual properties of differing size and condition — the spread is real, not noise, so do not read the middle of it as a typical price.`,
        }
      : null;

  const recencyNote = agedFallback
    ? `Fewer than ${MIN_QUALIFYING_RECENT} sales were registered in ${district} in the two years to the end of ${spine.window.endYear}, so older sales are included to fill this list — check the date on each.`
    : null;

  // ── SPARSE: fewer than 3 in-district sales exist. Facts, no summary. ────────
  if (total < MIN_FOR_DATA) {
    return {
      ...base,
      state: "SPARSE",
      note: `Fewer than 3 recorded sales exist in ${district} for this window — the sales shown are all there are, and no out-of-district sales are substituted. Too thin to summarise a range you could rely on.`,
      data: { count: items.length, totalInDistrict: total, items, spread, recencyNote, cutoff, summary: null },
    };
  }

  const recentMedian = median(prices);
  const summary = buildSummary({
    low, high, recentMedian, windowMedian, district, count: items.length,
  });

  return {
    ...base,
    state: "DATA",
    note: null,
    data: { count: items.length, totalInDistrict: total, items, spread, recencyNote, cutoff, summary },
  };
}

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
