/**
 * lib/brief/sections/prices.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Prices, Trend & Negotiation".
 *
 * A pure function of the spine stats (computeStats output) + resolved location.
 * No network, no divergent price query — every figure here comes from the one
 * clean transaction set. Runs server-side; returns a display-ready section object
 * (formatted strings for the client to render verbatim, plus the raw numbers the
 * client needs for sign-colouring and the like).
 *
 * Three blocks, each carrying its own render state so a thin-data area degrades
 * honestly instead of vanishing (BRIEF_SPEC → Section render states):
 *   1. marketOverview — median, latest-year median, YoY, counts, confidence.
 *   2. trend          — the full per-year table (depth-gating is a later phase);
 *                       sparse years show "—" + a low-volume note.
 *   3. negotiation    — fair value range (median-anchored, per the Phase 1 spine
 *                       decision), opening range, and leverage points ONLY where
 *                       the data supports them. No static filler, no scare framing.
 *
 * Section state = UNAVAILABLE if the spine found no transactions; SPARSE if the
 * dataset confidence is "low"; otherwise DATA.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { formatGBP, formatSignedPct } from "../stats.js";
import { isEntitled } from "../entitlements.js";

const NOT_A_VALUATION =
  "This is a due-diligence estimate from Land Registry sold prices, not a formal valuation or mortgage-lending figure.";

/**
 * @param {ReturnType<import("../stats.js").computeStats>} stats
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildPricesSection(stats, location, tier, spine = null) {
  const base = {
    key: "pricesTrendNegotiation",
    title: "Prices, Trend & Negotiation",
    // Section floor is the (free) market overview; the negotiation block carries
    // its own PRO entitlement flag below so depth-gating slots in cleanly later.
    minTier: "EXP",
  };

  // ── UNAVAILABLE: the spine found nothing for this district/window ───────────
  if (!stats || stats.available === false) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note:
        stats?.confidence?.note ||
        "No Land Registry sold-price data is available for this postcode district — price, trend and negotiation figures cannot be shown.",
      data: null,
    };
  }

  const { district } = stats;
  const confidenceLevel = stats.confidence.level; // high | medium | low
  const sparse = confidenceLevel === "low";

  // ── Provenance, always ─────────────────────────────────────────────────────
  // Dated whether or not the data is stale. A fresh figure is dated for the same
  // reason a stale one is: the reader should never have to assume how current it is.
  // The SPARQL path has no publication vintage to quote, so it carries none — the
  // absence is explicit rather than a fabricated "today".
  const asOf = spine?.asOf
    ? {
        published: spine.asOf.published,
        label: spine.asOf.label,
        statement: `Sold price data as of ${spine.asOf.label}.`,
        refreshOverdue: spine.asOf.refreshOverdue,
      }
    : null;

  // ── Sector context ─────────────────────────────────────────────────────────
  // Where the resolved sector diverges from its district by more than sampling
  // error, say so. The "warn" band exists so we never knowingly print a figure that
  // misdescribes the address without telling the reader which way it is wrong.
  const sectorNote = spine?.sectorContext?.note ?? null;
  const sectorVerdict = spine?.sectorContext?.verdict ?? null;

  // ── Too few sales to state a typical price ────────────────────────────────
  // Not UNAVAILABLE: the recorded sales are facts and stay in the brief via the
  // sold-prices section. Only the summary claim is withheld — with the count and
  // the spread stated, so the list of sales cannot be read as an implied average.
  if (stats.summaryWithheld) {
    return {
      ...base,
      state: "SPARSE",
      note: stats.summaryWithheld.note,
      asOf,
      sectorNote,
      sectorVerdict,
      sourceFootnote: `Source: HM Land Registry Price Paid Data, ${stats.window.startYear}\u2013${stats.window.endYear}, postcode district ${district}. Deduplicated in-district transactions only.`,
      data: {
        marketOverview: null,
        totalTransactions: stats.totalCount,
        priceRange: stats.priceRange
          ? {
              low: { raw: stats.priceRange.low, formatted: formatGBP(stats.priceRange.low) },
              high: { raw: stats.priceRange.high, formatted: formatGBP(stats.priceRange.high) },
            }
          : null,
        trend: buildTrendBlock(stats),
        // Always an object, never null: the client renders the negotiation card
        // unconditionally, and a null here would blank the page rather than explain
        // the omission. buildNegotiationBlock surfaces stats.valuationWithheld.
        negotiation: buildNegotiationBlock(stats, district, tier),
      },
    };
  }

  const marketOverview = buildMarketOverview(stats, district);
  const trend = buildTrendBlock(stats);
  const negotiation = buildNegotiationBlock(stats, district, tier);

  return {
    ...base,
    state: sparse ? "SPARSE" : "DATA",
    note: sparse ? stats.confidence.note : null,
    asOf,
    sectorNote,
    sectorVerdict,
    sourceFootnote: `Source: HM Land Registry Price Paid Data, ${stats.window.startYear}–${stats.window.endYear}, postcode district ${district}. Deduplicated in-district transactions only.`,
    data: { marketOverview, trend, negotiation },
  };
}

// ── Block 1: market overview ──────────────────────────────────────────────────
function buildMarketOverview(stats, district) {
  const { latestYear, previousYear, yoyChangePct, medianPrice, totalCount } = stats;
  return {
    district,
    windowMedian: { raw: medianPrice, formatted: formatGBP(medianPrice) },
    latestYear: {
      year: latestYear.year,
      count: latestYear.count,
      median: { raw: latestYear.median, formatted: formatGBP(latestYear.median) },
    },
    previousYear: {
      year: previousYear.year,
      count: previousYear.count,
      median: { raw: previousYear.median, formatted: formatGBP(previousYear.median) },
    },
    yoyChange: {
      raw: yoyChangePct,
      formatted: formatSignedPct(yoyChangePct),
      direction: yoyChangePct == null ? "flat" : yoyChangePct > 0 ? "up" : yoyChangePct < 0 ? "down" : "flat",
    },
    totalTransactions: totalCount,
    confidence: {
      level: stats.confidence.level,
      note: stats.confidence.note,
    },
  };
}

// ── Block 2: price trend (full window; depth-trim is a later phase) ────────────
function buildTrendBlock(stats) {
  const rows = stats.trend.map((r) => ({
    year: r.year,
    count: r.count,
    median: { raw: r.median, formatted: r.median == null ? "—" : formatGBP(r.median) },
    // The band the year's own sales support. Carried on every row that has one; the
    // client shows it where it matters most — a low-volume year, where the median is
    // real but the uncertainty around it is the point.
    range:
      r.ciLo != null && r.ciHi != null
        ? { low: r.ciLo, high: r.ciHi, formatted: `${formatGBP(r.ciLo)} – ${formatGBP(r.ciHi)}` }
        : null,
    change: { raw: r.changePct, formatted: formatSignedPct(r.changePct) },
    // Why a cell is blank, per cell. A dash in the median column and a dash in the
    // change column mean COMPLETELY different things, and one sentence covering both
    // was false about each.
    medianWithheld: r.medianWithheld ?? null,
    changeSuppressed: r.changeSuppressed ?? null,
    state: r.state, // data | sparse | missing
  }));

  // Each note is emitted ONLY when the condition it describes is actually present.
  // The previous single note claimed 'Years marked "—" had no recorded sales', which
  // rendered against years with 121 and 53 sales — the dash there marks a suppressed
  // year-on-year change, not an absence of data.
  const notes = [];
  if (rows.some((r) => r.state === "missing")) {
    notes.push("Years with no median had no recorded sales at all.");
  }
  if (rows.some((r) => r.medianWithheld)) {
    notes.push(
      "Years showing a sale count but no median had too few sales to place one: below five sales there is no meaningful range for a median to sit in, so none is stated.",
    );
  }
  if (rows.some((r) => r.state === "sparse" && r.median != null)) {
    notes.push(
      "Years marked low volume have a real median, but few enough sales that it could sit anywhere in the range shown beside it.",
    );
  }
  if (rows.some((r) => r.changeSuppressed)) {
    notes.push(
      "A blank in the change column means that year's move was smaller than the uncertainty in the two medians it is drawn from — not that prices held steady. Where a change is shown, it is larger than that uncertainty.",
    );
  }

  return {
    years: rows.length,
    rows,
    hasSparseYears: rows.some((r) => r.state === "sparse" || r.state === "missing"),
    notes,
    // Retained so an older client keeps rendering something sane; superseded by notes[].
    lowVolumeNote: notes.length ? notes[notes.length - 1] : null,
  };
}

// ── Block 3: negotiation / pre-offer ──────────────────────────────────────────
// Fair value is median-anchored (Phase 1 spine decision — robust to the outlier
// sales that distorted the old engine's recent-comp mean). Leverage points are
// emitted ONLY where a real signal supports them.
function buildNegotiationBlock(stats, district, tier) {
  const entitled = isEntitled(tier, "section.preOfferStrategy"); // PRO; unlock-all → true in 2a
  const { fairValue, openingOffer, yoyChangePct, latestYear, offerConfidence } = stats;

  const fairValueRange =
    fairValue == null
      ? null
      : {
          anchor: { raw: fairValue.anchor, formatted: formatGBP(fairValue.anchor) },
          low: { raw: fairValue.low, formatted: formatGBP(fairValue.low) },
          high: { raw: fairValue.high, formatted: formatGBP(fairValue.high) },
          basis: `Anchored to the ${latestYear.count > 0 ? `${latestYear.year} median` : "window median"} for ${district}, ±8%.`,
        };

  const openingRange =
    openingOffer == null
      ? null
      : {
          low: { raw: openingOffer.low, formatted: formatGBP(openingOffer.low) },
          high: { raw: openingOffer.high, formatted: formatGBP(openingOffer.high) },
        };

  return {
    entitled,
    confidence: offerConfidence, // Strong | Moderate | Thin
    fairValueRange,
    openingRange,
    // Non-null ONLY when a range was deliberately not quoted. The client renders
    // this in place of the range, so the omission is visible and explained rather
    // than looking like a figure that failed to load.
    withheld: stats.valuationWithheld ?? null,
    leveragePoints: buildLeveragePoints(stats, district),
    notAValuationNote: NOT_A_VALUATION,
  };
}

/**
 * Buyer-side leverage points, each backed by a specific signal from the data.
 * Returns [] rather than inventing filler when the data gives no genuine lever —
 * an honest empty state is the point (BRIEF_SPEC → "No static filler").
 */
function buildLeveragePoints(stats, district) {
  const points = [];
  const yoy = stats.yoyChangePct;
  const latestCount = stats.latestYear.count;
  const level = stats.confidence.level;

  // Falling / flat market → the strongest, most defensible lever.
  if (yoy != null && yoy < 0) {
    points.push({
      signal: "yoy-down",
      text: `Sold-price medians in ${district} fell ${formatSignedPct(yoy)} over the last full year — a seller cannot argue that local values are currently rising.`,
    });
  } else if (yoy != null && yoy >= 0 && yoy < 3) {
    points.push({
      signal: "yoy-flat",
      text: `Local growth is modest (${formatSignedPct(yoy)} YoY) — there is little market-wide justification for a premium over recent comparable medians.`,
    });
  }

  // Thin recent volume → cuts both ways, but denies the seller a strong asking-price anchor.
  if (latestCount > 0 && latestCount < 10) {
    points.push({
      signal: "thin-recent-volume",
      text: `Only ${latestCount} recorded sale${latestCount === 1 ? "" : "s"} in ${district} in the most recent full year — with little fresh evidence, anchor to the median rather than any single asking price.`,
    });
  }

  // Softening market widens the sensible opening range — surface that as a lever.
  if (yoy != null && yoy < 0 && stats.openingOffer && stats.fairValue) {
    points.push({
      signal: "soft-market-opening",
      text: `In a softening market a lower opening offer (${formatGBP(stats.openingOffer.low)}) is defensible without being dismissed as unrealistic.`,
    });
  }

  // Firm market → be honest that area-pricing leverage is limited; redirect it.
  if (yoy != null && yoy >= 5 && latestCount >= 30) {
    points.push({
      signal: "firm-market",
      text: `The local market is firm (${formatSignedPct(yoy)} YoY on ${latestCount} sales) — expect limited room below the median on area pricing alone; base your leverage on the specific property's condition, tenure and time on market.`,
    });
  }

  // Low overall confidence → temper how hard the data can be pushed.
  if (level === "low") {
    points.push({
      signal: "low-confidence",
      text: `Transaction volume in ${district} is too low to negotiate hard on the data alone — treat every figure here as directional and widen your own margin of safety.`,
    });
  }

  return points;
}
