/**
 * lib/brief/sections/sold-prices-map.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Sold Prices Map" (INV).
 *
 * Plots the SAME recent in-district sales the "Recent sales" section lists
 * (shared selectRecent over the SAME cached TransactionSet — no new query), at
 * their POSTCODE CENTROIDS. PPD has no coordinates, so each marker sits at the
 * centre of the sale's postcode unit, NOT the exact property — the UI labels this
 * explicitly (BRIEF_SPEC → Sold prices map).
 *
 * Coordinates arrive already-resolved from lib/brief/geocode.js (one bulk
 * Postcodes.io lookup done in generate()). This builder is a pure function of the
 * transactions + that centroid map; it does no network itself.
 *
 * Render states:
 *   UNAVAILABLE  no in-district sales at all.
 *   SPARSE       <3 recent sales — too thin to map meaningfully; show what exists.
 *   DATA         ≥3 recent sales.
 * Independently, `mapAvailable` is false when fewer than 2 of the shown sales could
 * be geocoded — the section then renders the sold-prices LIST without a map plus an
 * honest note, never a broken map (BRIEF_SPEC → "never a broken map").
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { formatGBP } from "../stats.js";
import { isEntitled } from "../entitlements.js";
import { selectRecent, assembleAddress, monthYear } from "./nearby-sold-prices.js";

/** Minimum recent sales to bother mapping. */
const MIN_FOR_DATA = 3;
/** Minimum geocoded points for a real map (fewer → list-only fallback). */
const MIN_GEOCODED = 2;

export const MAP_DISCLAIMER = "Markers are postcode-centroid estimates — not exact property locations.";

/** Quintile price tiers (low → high) so the map can colour by relative price. Tier
 *  labels are stable keys; the client maps them to colours. */
const TIER_ORDER = ["low", "mid-low", "mid", "mid-high", "high"];
const TIER_LABELS = {
  low: "Lower end",
  "mid-low": "Below mid",
  mid: "Mid-range",
  "mid-high": "Above mid",
  high: "Upper end",
};

/** Assign a price its quintile tier within the shown set. */
function assignTier(price, sortedAsc) {
  if (sortedAsc.length === 0) return "mid";
  const q = (p) => sortedAsc[Math.min(sortedAsc.length - 1, Math.floor(sortedAsc.length * p))];
  const p20 = q(0.2);
  const p40 = q(0.4);
  const p60 = q(0.6);
  const p80 = q(0.8);
  if (price <= p20) return "low";
  if (price <= p40) return "mid-low";
  if (price <= p60) return "mid";
  if (price <= p80) return "mid-high";
  return "high";
}

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
 * @param {Map<string,{lat:number,lng:number}>} centroids  postcode → centroid (from geocode)
 * @returns {Object} a BriefSection
 */
export function buildSoldPricesMapSection(spine, location, tier, centroids = new Map()) {
  const base = {
    key: "soldPricesMap",
    title: "Sold Prices Map",
    minTier: "INV",
    entitled: isEntitled(tier, "section.soldPricesMap"), // INV; unlock-all → true in 2a
    disclaimer: MAP_DISCLAIMER,
  };

  const district = spine?.district || location.outcode;
  const total = Array.isArray(spine?.recent) ? spine.recent.length : 0;

  // ── UNAVAILABLE ────────────────────────────────────────────────────────────
  if (total === 0) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note: `No Land Registry sold prices are on record for ${district} in this window, so there is nothing to map.`,
      data: null,
    };
  }

  const recent = selectRecent(spine).items;
  const sortedAsc = [...recent.map((t) => t.price)].sort((a, b) => a - b);

  // Canonical-postcode key must match geocode.js's canonical form (spaced, upper);
  // spine postcodes are already "DISTRICT INCODE", so they match directly.
  let geocoded = 0;
  const points = recent.map((t) => {
    const centroid = centroids.get(t.postcode) || null;
    if (centroid) geocoded++;
    return {
      id: t.id,
      address: assembleAddress(t),
      postcode: t.postcode,
      price: { raw: t.price, formatted: formatGBP(t.price) },
      propertyType: t.propertyType,
      monthYear: monthYear(t.date),
      tier: assignTier(t.price, sortedAsc),
      lat: centroid ? centroid.lat : null,
      lng: centroid ? centroid.lng : null,
    };
  });

  const mapAvailable = geocoded >= MIN_GEOCODED;
  const prices = recent.map((t) => t.price);
  const summary = {
    low: { raw: Math.min(...prices), formatted: formatGBP(Math.min(...prices)) },
    median: { raw: median(prices), formatted: formatGBP(median(prices)) },
    high: { raw: Math.max(...prices), formatted: formatGBP(Math.max(...prices)) },
  };

  // Legend = the tiers actually present, in order.
  const present = new Set(points.map((p) => p.tier));
  const legend = TIER_ORDER.filter((k) => present.has(k)).map((k) => ({ tier: k, label: TIER_LABELS[k] }));

  const state = total < MIN_FOR_DATA ? "SPARSE" : "DATA";
  const sparseNote =
    state === "SPARSE"
      ? `Fewer than 3 recent in-district sales are on record for ${district} — too thin to map meaningfully; the sales that exist are shown.`
      : null;
  const mapNote = mapAvailable
    ? null
    : "Coordinate lookup was unavailable for these sales, so the map can’t be drawn — the recent sold prices are listed below instead.";

  return {
    ...base,
    state,
    note: sparseNote,
    sourceFootnote: `Source: HM Land Registry Price Paid Data, most recent ${points.length} registered sales in ${district}. Marker positions are postcode-centroid estimates from Postcodes.io.`,
    data: {
      mapAvailable,
      mapNote,
      centre: { lat: location.lat, lng: location.lng },
      subjectLabel: `${location.postcode} (approx. centre)`,
      geocodedCount: geocoded,
      points,
      legend,
      summary,
    },
  };
}
