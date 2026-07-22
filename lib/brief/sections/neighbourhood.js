/**
 * lib/brief/sections/neighbourhood.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Neighbourhood Profile / Lifestyle Fit" (EXP).
 *
 * Five buyer dimensions, EACH a pure function of named payload inputs that were
 * already fetched for other sections — nothing new is fetched here, and nothing is
 * a constant. Every dimension surfaces the exact inputs behind its rating, so the UI
 * can show "Excellent — nearest station 4 min, 3 stations, 5 lines" rather than an
 * unexplained score (BRIEF_SPEC → inputs visible; no static ratings).
 *
 *   family       = f(schools count+proximity, crime composition, green space)
 *   commute      = f(nearest station walk time, station count, line diversity)
 *   convenience  = f(supermarket/food proximity + counts)
 *   greenSpace   = f(named parks count + nearest park distance)   [Overpass leisure]
 *   longTerm     = f(price trajectory + dataset confidence + flood risk)
 *
 * THE MISSING-INPUT RULE (BRIEF_SPEC): a dimension whose PRIMARY input wasn't
 * fetched/available renders `insufficient` with an honest reason — NEVER a default
 * score. Secondary inputs (e.g. crime for family) refine the rating when present and
 * are simply noted as "not factored" when absent.
 *
 * Curated resident sentiment (lib/brief/neighbourhood-sentiment.js) is folded in as a
 * clearly-labelled QUALITATIVE sub-block, and ONLY for the districts that have curation;
 * everywhere else the sub-block states plainly that no curated commentary exists.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";
import { residentSentimentFor } from "../neighbourhood-sentiment.js";

/** Ordered rating tiers (best → worst); `insufficient` is off-scale. */
const TIER_LABEL = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  limited: "Limited",
  insufficient: "Insufficient data",
};

function dim(key, title, tier, summary, inputs, note) {
  return { key, title, tier, label: TIER_LABEL[tier], summary, inputs: inputs || [], note: note || null };
}

/** Nearest item (min distance) from a shaped group's items, or null. */
function nearest(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items.reduce((a, b) => (b.distanceMeters < a.distanceMeters ? b : a));
}

// ── Commute = f(nearest station walk time, station count, line diversity) ──────
function commuteDimension(stationsData) {
  if (!stationsData || stationsData.stationsState === "unavailable") {
    return dim("commute", "Commute", "insufficient", "Live station data couldn't be retrieved, so commute fit can't be rated.", [], "OpenStreetMap station lookup did not respond.");
  }
  const stations = stationsData.stations || [];
  const n = stations.length;
  if (n === 0) {
    return dim("commute", "Commute", "limited", "No station within walking range.", [{ label: "Stations in range", value: "0" }], "Car- or bus-dependent for most journeys.");
  }
  const nrst = stationsData.nearest || nearest(stations);
  const w = nrst?.walkMins ?? null;
  const lines = new Set();
  for (const s of stations) for (const l of s.lines || []) lines.add(l);
  const L = lines.size;

  let tier;
  if (w != null && w <= 5 && n >= 3) tier = "excellent";
  else if (w != null && w <= 10 && n >= 2) tier = "good";
  else if (w != null && w <= 15) tier = "fair";
  else tier = "limited";

  const inputs = [
    { label: "Nearest station", value: nrst ? `${nrst.name} · ${w} min walk` : "—" },
    { label: "Stations in range", value: String(n) },
    { label: "Line diversity", value: L ? `${L} line${L === 1 ? "" : "s"}` : "—" },
  ];
  return dim("commute", "Commute", tier, summarise(tier, `nearest station ${w} min, ${n} in range`), inputs);
}

// ── Convenience = f(supermarket/food proximity + counts) ───────────────────────
// Consumes the RAW amenities Overpass result: { ok, groups:{ supermarkets, food, health, parks } }.
function convenienceDimension(amenitiesResult) {
  if (!amenitiesResult?.ok) {
    return dim("convenience", "Everyday convenience", "insufficient", "Live amenity data couldn't be retrieved.", [], "OpenStreetMap amenity lookup did not respond.");
  }
  const groups = amenitiesResult.groups || {};
  const shops = groups.supermarkets;
  const food = groups.food;
  const shopN = shops?.total ?? 0;
  const foodN = food?.total ?? 0;
  const nrstShop = nearest(shops?.items);
  const sw = nrstShop?.walkMins ?? null;

  if (shopN === 0 && foodN === 0) {
    return dim("convenience", "Everyday convenience", "limited", "No shops or food outlets recorded in OpenStreetMap within walking range.", [{ label: "Shops / food recorded", value: "0" }], "OSM coverage can be patchy here — check a mapping app.");
  }
  let tier;
  if (sw != null && sw <= 6 && shopN >= 3) tier = "excellent";
  else if (sw != null && sw <= 12 && shopN >= 1) tier = "good";
  else if (shopN + foodN >= 3) tier = "fair";
  else tier = "limited";

  const inputs = [
    { label: "Nearest food shop", value: nrstShop ? `${nrstShop.name} · ${sw} min walk` : "—" },
    { label: "Shops & food outlets", value: `${shopN} shops · ${foodN} cafés/restaurants` },
  ];
  return dim("convenience", "Everyday convenience", tier, summarise(tier, `nearest shop ${sw ?? "?"} min, ${shopN} shops nearby`), inputs);
}

// ── Green space = f(named parks count + nearest park distance) ─────────────────
// Parks come from the SAME amenities Overpass call (folded into fetchAmenities), so
// there is no extra fetch and green space shares the amenity result's fetched-state.
function greenSpaceDimension(amenitiesResult) {
  if (!amenitiesResult?.ok) {
    return dim("greenSpace", "Green space", "insufficient", "Green-space data couldn't be retrieved.", [], "OpenStreetMap lookup did not respond.");
  }
  const parks = amenitiesResult.groups?.parks;
  const total = parks?.total ?? 0;
  const nrst = nearest(parks?.items);
  const pw = nrst?.walkMins ?? null;
  if (total === 0) {
    return dim("greenSpace", "Green space", "limited", "No named parks or gardens recorded within about a 12-minute walk.", [{ label: "Parks in range", value: "0" }], "OSM records named green spaces only — small greens may be missing.");
  }
  let tier;
  if (pw != null && pw <= 8 && total >= 3) tier = "excellent";
  else if (pw != null && pw <= 12 && total >= 2) tier = "good";
  else if (total >= 1) tier = "fair";
  else tier = "limited";

  const inputs = [
    { label: "Nearest green space", value: nrst ? `${nrst.name} · ${pw} min walk` : "—" },
    { label: "Named parks in range", value: String(total) },
  ];
  return dim("greenSpace", "Green space", tier, summarise(tier, `${nrst?.name ?? "a park"} ${pw} min, ${total} in range`), inputs);
}

// ── Family = f(schools count+proximity, crime composition, green space) ────────
function familyDimension(schoolsData, crimeData, greenDim) {
  // Schools is the primary input; without it, family can't be rated.
  const schoolsFetched = Array.isArray(schoolsData?.schools) && schoolsData.schools.length > 0;
  if (!schoolsFetched) {
    return dim("family", "Family suitability", "insufficient", "No school data within range — the primary input for a family read.", [], "OpenStreetMap returned no schools (a data gap or a genuinely school-free radius).");
  }
  const schools = schoolsData.schools;
  const nrst = nearest(schools);
  const sw = nrst?.walkMins ?? null;
  const sc = schools.length;

  // Primary: schools. 0..1
  let pts = 0;
  if (sc >= 3 && sw != null && sw <= 15) pts += 1;
  else if (sc >= 1) pts += 0.5;

  // Secondary: green space (reuse the green dimension's tier). 0..0.5
  if (greenDim && (greenDim.tier === "excellent" || greenDim.tier === "good")) pts += 0.5;
  else if (greenDim && greenDim.tier === "fair") pts += 0.25;

  // Secondary: crime composition (violence & sexual + robbery share). Lower = safer.
  let safetyNote = "crime composition not available (not factored)";
  let violentShare = null;
  if (crimeData && Array.isArray(crimeData.categories) && crimeData.total > 0) {
    const violent = crimeData.categories
      .filter((c) => c.key === "violent-crime" || c.key === "robbery")
      .reduce((n, c) => n + c.count, 0);
    violentShare = Math.round((violent / crimeData.total) * 100);
    if (violentShare < 20) pts += 0.5;
    else if (violentShare < 35) pts += 0.25;
    safetyNote = `${violentShare}% of recorded crime is violence/robbery`;
  } else if (crimeData && crimeData.total === 0) {
    pts += 0.5; // genuinely quiet return
    safetyNote = "no crime recorded within the radius in the latest month";
  }

  // Map cumulative (max 2.0) to a tier.
  let tier;
  if (pts >= 1.75) tier = "excellent";
  else if (pts >= 1.25) tier = "good";
  else if (pts >= 0.75) tier = "fair";
  else tier = "limited";

  const inputs = [
    { label: "Nearest school", value: nrst ? `${nrst.name} · ${sw} min walk` : "—" },
    { label: "Schools in range", value: String(sc) },
    { label: "Safety (composition)", value: violentShare != null ? `${violentShare}% violence/robbery` : "not factored" },
    { label: "Green space", value: greenDim ? greenDim.label : "not factored" },
  ];
  return dim("family", "Family suitability", tier, summarise(tier, `${sc} schools, nearest ${sw ?? "?"} min; ${safetyNote}`), inputs);
}

// ── Long-term = f(price trajectory + dataset confidence + flood risk) ──────────
function longTermDimension(stats, floodData) {
  if (!stats || stats.available === false) {
    return dim("longTerm", "Long-term hold", "insufficient", "No sold-price history for the district, so a hold read can't be formed.", [], "Land Registry price scan returned no data.");
  }
  const yoy = stats.yoyChangePct;
  const conf = stats.confidence?.level ?? "low";
  // Flood band, if the flood section resolved one. Best-effort; may be absent.
  const floodBand = floodBandOf(floodData);

  let pts = 0;
  // Trajectory: rising/firming favourable, falling unfavourable.
  if (yoy != null) {
    if (yoy >= 2) pts += 1;
    else if (yoy > -2) pts += 0.5;
    // falling → 0
  }
  // Confidence in the read.
  if (conf === "high") pts += 0.75;
  else if (conf === "medium") pts += 0.4;
  // Flood: an elevated band is a genuine long-term drag.
  if (floodBand === "low") pts += 0.5;
  else if (floodBand === "unknown" || floodBand == null) pts += 0.25; // not penalised, not credited

  let tier;
  if (pts >= 1.75) tier = "excellent";
  else if (pts >= 1.2) tier = "good";
  else if (pts >= 0.7) tier = "fair";
  else tier = "limited";

  const inputs = [
    { label: "Price trajectory (YoY)", value: yoy == null ? "unclear" : `${yoy > 0 ? "+" : ""}${yoy.toFixed(1)}%` },
    { label: "Data confidence", value: cap(conf) },
    { label: "Flood risk", value: floodBand == null ? "not assessed" : cap(floodBand) },
  ];
  return dim("longTerm", "Long-term hold", tier, summarise(tier, `${yoy == null ? "trajectory unclear" : (yoy > 0 ? "prices firm" : "prices soft")}, ${conf} confidence`), inputs);
}

/** Coarse low/elevated/high band from the flood section's point read (riskBand/planningZone). */
function floodBandOf(floodData) {
  if (!floodData) return null;
  const zone = floodData.planningZone;
  const band = String(floodData.riskBand || "").toLowerCase();
  if (band.includes("high") || zone === 3) return "high";
  if (band.includes("medium") || zone === 2) return "elevated";
  if (band.includes("low")) return "low"; // covers "low" and "very low"
  return "unknown";
}

function summarise(tier, inputPhrase) {
  return `${TIER_LABEL[tier]} — ${inputPhrase}`;
}
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * @param {Object} inputs
 * @param {Object} inputs.stationsData     stationsCommute section .data (or null)
 * @param {Object} inputs.amenitiesResult  RAW fetchAmenities result { ok, groups } (or null)
 * @param {Object} inputs.schoolsData      schools section .data (or null)
 * @param {Object} inputs.crimeData        crimeBreakdown section .data (or null)
 * @param {Object} inputs.floodData        floodClimate section .data (riskBand/planningZone) (or null)
 * @param {ReturnType<import("../stats.js").computeStats>} inputs.stats
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildNeighbourhoodSection({ stationsData, amenitiesResult, schoolsData, crimeData, floodData, stats }, location, tier) {
  const base = {
    key: "neighbourhood",
    title: "Neighbourhood Profile / Lifestyle Fit",
    minTier: "EXP",
    entitled: isEntitled(tier, "section.neighbourhood"), // EXP; unlock-all → true
  };

  const green = greenSpaceDimension(amenitiesResult);
  const dimensions = [
    familyDimension(schoolsData, crimeData, green),
    commuteDimension(stationsData),
    convenienceDimension(amenitiesResult),
    green,
    longTermDimension(stats, floodData),
  ];

  const rated = dimensions.filter((d) => d.tier !== "insufficient").length;

  // ── Curated resident sentiment (folded, labelled, dated) ────────────────────
  // Curation is keyed by outcode; district-wide briefs use the same outcode lookup.
  const curated = residentSentimentFor(location.outcode);
  const sentiment = curated
    ? {
        available: true,
        asOf: curated.asOf,
        text: curated.text,
        label: "Curated qualitative commentary",
        disclaimer:
          `An editorial summary of PUBLIC resident commentary (Reddit, Mumsnet, press features) compiled through ${curated.asOf}. ` +
          `Qualitative context only — not live data, not a survey, and not specific to any one street.`,
      }
    : {
        available: false,
        asOf: null,
        text: null,
        label: "Resident sentiment",
        disclaimer: `No curated resident commentary exists for ${location.outcode}. This section is hand-curated for a small set of well-documented districts only; it is deliberately left empty rather than filled with generic text.`,
      };

  const distScope = location.outcodeOnly ? "district" : "point";
  const scopeNote =
    distScope === "district"
      ? `Lifestyle inputs are measured from the ${location.outcode} district centroid — a full postcode gives an address-specific read.`
      : null;

  return {
    ...base,
    state: rated > 0 ? "DATA" : "SPARSE",
    note: scopeNote,
    sourceFootnote:
      "Lifestyle dimensions are computed from the same OpenStreetMap (stations, schools, amenities, parks), data.police.uk (crime composition), " +
      "Environment Agency (flood) and HM Land Registry (price trajectory) signals shown elsewhere in this brief. Each rating lists the exact inputs behind it. " +
      "Resident sentiment, where shown, is hand-curated editorial commentary, dated and clearly labelled — not live data.",
    data: {
      scope: distScope,
      ratedCount: rated,
      dimensions,
      sentiment,
    },
  };
}
