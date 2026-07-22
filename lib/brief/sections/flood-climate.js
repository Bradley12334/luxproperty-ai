/**
 * lib/brief/sections/flood-climate.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Flood, Climate & Resilience" (EXPLORER / free tier).
 *
 * A pure function of the point-wise flood signals gathered by lib/brief/flood.js
 * (fetched inside generate() at the VALIDATED coordinates — never borough-level).
 * It does NO network itself.
 *
 * The headline is grounded in two authoritative point reads:
 *   - RoFRS `prob_4band`  → the property-level probability band (High/Med/Low/Very Low)
 *   - Flood Map for Planning → the planning flood zone (1/2/3) at the point,
 *     plus a proximity flag so a centroid sitting JUST outside a zone still reports
 *     the adjacent risk rather than a false all-clear (the Rye-on-the-hill case).
 * Neither is ever derived from a count of nearby areas — that is the W11 "Zone 3"
 * failure this rebuild exists to correct.
 *
 * Surface water and subsidence carry NO fabricated rating (no open point-wise source
 * exists for either at property level): surface water is flagged as a hazard the
 * river/sea zones don't cover, and subsidence renders as clearly-labelled general
 * guidance. Both say plainly what to check and where.
 *
 * Render states (BRIEF_SPEC → Section render states):
 *   DATA         a point risk read resolved (band or zone). Full section.
 *   SPARSE       the point read failed but SOME supporting signal (nearby areas or
 *                live warnings) resolved — show it with an honest caveat.
 *   UNAVAILABLE  every EA source failed — explicit message + gov.uk verify link.
 *
 * DISTRICT-WIDE (bare outcode): a single centroid point is not representative of a
 * whole postcode district, so the point band/zone claim is suppressed; the section
 * presents nearby areas + live warnings around the district and says a full postcode
 * is needed for a point-level flood zone.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";

const VERIFY_URL = "flood-map-for-planning.service.gov.uk";

/** RoFRS band → plain-English annual-chance definition (Environment Agency). */
const BAND_MEANING = {
  High: "a higher than 1 in 30 (3.3%) chance of flooding from rivers or the sea in any given year",
  Medium: "between a 1 in 100 and 1 in 30 (1%–3.3%) chance of flooding from rivers or the sea in any given year",
  Low: "between a 1 in 1,000 and 1 in 100 (0.1%–1%) chance of flooding from rivers or the sea in any given year",
  "Very Low": "less than a 1 in 1,000 (below 0.1%) chance of flooding from rivers or the sea in any given year",
};

/** Planning zone → EA definition. */
const ZONE_MEANING = {
  3: "Flood Zone 3 — land assessed as having a high probability of river or sea flooding (1% or greater annual chance from rivers, 0.5% or greater from the sea).",
  2: "Flood Zone 2 — land assessed as having a medium probability of river or sea flooding (between 0.1% and 1% annual chance from rivers, 0.1%–0.5% from the sea).",
  1: "Flood Zone 1 — land assessed as having a low probability of river or sea flooding (below 0.1% annual chance). Most of England sits in Zone 1.",
};

/** Bands/zones that warrant an insurance & lending caveat. */
const ELEVATED_BANDS = new Set(["High", "Medium"]);

const SURFACE_WATER_NOTE =
  "Surface-water (‘flash’) flooding — drains overwhelmed by intense rainfall — is a SEPARATE hazard from the river and sea flooding mapped above, and can affect properties nowhere near a watercourse. There is no open property-level surface-water rating, so none is asserted here: check the surface-water layer on the EA flood map and ask the seller about any past drainage or flash-flooding issues.";

const SUBSIDENCE_NOTE =
  "General guidance (not a property-specific assessment): ground stability — including clay shrink-swell subsidence — is not covered by Environment Agency flood data and varies property by property. It is not possible to rate it reliably from a postcode alone, so no rating is given. If subsidence is a concern, commission a RICS survey and ask your conveyancer to include a ground-stability / environmental search.";

/**
 * @param {import("../flood.js").FloodClimate} flood
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildFloodClimateSection(flood, location, tier) {
  const base = {
    key: "floodClimate",
    title: "Flood, Climate & Resilience",
    minTier: "EXP",
    entitled: isEntitled(tier, "section.floodClimate"), // EXP — free tier
  };

  const areaName = location?.postcode || location?.outcode || "this location";
  const f = flood || {};
  const nearbyAreas = Array.isArray(f.nearbyAreas) ? f.nearbyAreas : [];
  const activeWarnings = Array.isArray(f.activeWarnings) ? f.activeWarnings : [];
  const warningsChecked = Boolean(f.sources?.warnings); // false = couldn't reach the live endpoint

  // ── UNAVAILABLE: no EA source responded at all ──────────────────────────────
  if (!f.ok && nearbyAreas.length === 0 && activeWarnings.length === 0) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note: `Environment Agency flood data could not be retrieved for ${areaName} right now. Verify flood risk directly at ${VERIFY_URL} before relying on it.`,
      data: null,
    };
  }

  // Standing extras every rendered state carries.
  const guidance = { surfaceWater: SURFACE_WATER_NOTE, subsidence: SUBSIDENCE_NOTE };
  const nearby = formatNearbyAreas(nearbyAreas);
  const warnings = formatWarnings(activeWarnings, warningsChecked);

  // ── DISTRICT-WIDE (bare outcode): suppress the non-representative point claim ─
  if (location?.outcodeOnly) {
    return {
      ...base,
      state: "DATA",
      districtWide: true,
      note: `${location.outcode} is a whole postcode district spanning many streets, so a single flood zone can't represent it — flood zone is property-specific. Generate a brief for a full postcode to get a point-level flood assessment at the property.`,
      data: {
        scope: "district",
        riskBand: null,
        planningZone: null,
        proximity: null,
        headline: `Flood risk varies across ${location.outcode}. The Environment Agency flood areas and any live warnings below are shown for the district as a whole.`,
        nearby,
        warnings,
        historic: null,
        guidance,
        nextSteps: buildNextSteps({ elevated: false, districtWide: true, historic: null }),
      },
      sourceFootnote: sourceFootnote(f),
    };
  }

  // ── SPARSE: point read failed, but some supporting signal survived ──────────
  if (!f.ok) {
    return {
      ...base,
      state: "SPARSE",
      note: `The point-level flood zone for ${areaName} could not be confirmed from the Environment Agency flood map this time — the nearby flood areas and any live warnings below did resolve. Confirm the property's flood zone at ${VERIFY_URL}.`,
      data: {
        scope: "point",
        riskBand: f.riskBand ?? null,
        planningZone: f.planningZone ?? null,
        proximity: null,
        headline: null,
        nearby,
        warnings,
        historic: f.historic ?? null,
        guidance,
        nextSteps: buildNextSteps({ elevated: false, districtWide: false, historic: f.historic ?? null }),
      },
      sourceFootnote: sourceFootnote(f),
    };
  }

  // ── DATA: full point-level assessment ───────────────────────────────────────
  const band = f.riskBand || null;
  const zone = f.planningZone || null;
  const elevated = (band && ELEVATED_BANDS.has(band)) || zone === 3 || zone === 2;

  // Flood Map for Planning zones are the UNDEFENDED extent; RoFRS bands account for
  // existing defences. A high zone + a low band is therefore not a contradiction — it
  // usually signals flood defences, and both figures matter for due diligence.
  const divergent = (zone === 3 || zone === 2) && (band === "Low" || band === "Very Low");
  const defencesNote = divergent
    ? `Note the apparent gap: the planning flood zone (Zone ${zone}) shows the high-probability floodplain as if there were NO flood defences, while the ${band} risk rating reflects the picture WITH any defences in place. The difference usually means defences protect this location — but defences can be overtopped or fail, and their upkeep and your insurance both depend on them, so treat both figures as relevant.`
    : null;

  const headline = buildHeadline({ areaName, band, zone, proximity: f.proximity, divergent });
  const insuranceNote = elevated
    ? "Elevated flood risk can raise buildings-insurance premiums and narrow the choice of lenders — confirm both, and check Flood Re eligibility, before committing."
    : "At this probability level, standard buildings insurance and mortgage lending are not usually affected by flood risk — but always confirm insurability for the specific property.";

  return {
    ...base,
    state: "DATA",
    note: f.partial
      ? "Some supporting flood signals were unavailable this time; the point-level risk band and flood zone below did resolve."
      : null,
    data: {
      scope: "point",
      riskBand: band,
      riskBandMeaning: band ? BAND_MEANING[band] : null,
      planningZone: zone,
      planningZoneMeaning: zone ? ZONE_MEANING[zone] : null,
      proximity: buildProximity(zone, f.proximity),
      headline,
      defencesNote,
      insuranceNote,
      nearby,
      warnings,
      historic: buildHistoric(f.historic),
      guidance,
      nextSteps: buildNextSteps({ elevated, districtWide: false, historic: f.historic }),
    },
    sourceFootnote: sourceFootnote(f),
  };
}

/** One-line headline grounded in the point band + zone, including the proximity nuance. */
function buildHeadline({ areaName, band, zone, proximity, divergent }) {
  const zoneLabel = zone ? `Flood Zone ${zone}` : null;
  const bandLabel = band ? `${band.toLowerCase()} risk` : null;

  // Point is in the lowest zone but a higher zone sits within the proximity buffer.
  const nearHigher = zone === 1 && proximity && (proximity.zone3Within || proximity.zone2Within);
  if (nearHigher) {
    const which = proximity.zone3Within ? "Flood Zone 3" : "Flood Zone 2";
    return `The coordinates for ${areaName} sit in Flood Zone 1 (low probability)${band ? ` and are rated ${band} risk from rivers and the sea` : ""}, but ${which} begins within about ${proximity.bufferM}m — treat this as an edge-of-floodplain location and check the exact plot at ${VERIFY_URL}.`;
  }

  // High zone but low defended rating — phrase so it doesn't read as a contradiction
  // (the defencesNote below explains the gap in full).
  if (divergent && zoneLabel) {
    return `The coordinates for ${areaName} fall within ${zoneLabel}, the Environment Agency's high-probability floodplain, though its separate defended-risk rating is ${band} — a gap that usually reflects flood defences (see below).`;
  }

  if (zoneLabel && bandLabel) {
    return `The coordinates for ${areaName} fall within ${zoneLabel} and are rated ${bandLabel} of flooding from rivers and the sea by the Environment Agency.`;
  }
  if (zoneLabel) return `The coordinates for ${areaName} fall within ${zoneLabel} on the Environment Agency Flood Map for Planning.`;
  if (bandLabel) return `The Environment Agency rates the coordinates for ${areaName} as ${bandLabel} of flooding from rivers and the sea.`;
  return `Environment Agency flood risk for ${areaName} is shown below.`;
}

/** Structured proximity block (only meaningful when the point itself is Zone 1). */
function buildProximity(zone, proximity) {
  if (!proximity || zone !== 1) return null;
  if (!proximity.zone3Within && !proximity.zone2Within) return null;
  return {
    bufferM: proximity.bufferM,
    zone3Within: proximity.zone3Within,
    zone2Within: proximity.zone2Within,
    text: `The point is in Flood Zone 1, but ${proximity.zone3Within ? "Flood Zone 3" : "Flood Zone 2"} lies within about ${proximity.bufferM}m — the exact plot may sit closer to the floodplain than the centroid suggests.`,
  };
}

/** Nearby named EA flood areas with computed approx distances. */
function formatNearbyAreas(areas) {
  if (!areas.length) {
    return { count: 0, items: [], text: "No Environment Agency flood warning or alert areas were found within 3km of these coordinates." };
  }
  const items = areas.map((a) => ({
    name: a.name,
    watercourse: a.watercourse || null,
    approxMeters: a.approxMeters ?? null,
    approxLabel: a.approxMeters == null ? null : a.approxMeters < 1000 ? `~${a.approxMeters}m` : `~${(a.approxMeters / 1000).toFixed(1)}km`,
    kind: a.kind, // "warning" | "alert"
  }));
  const nearest = items[0];
  return {
    count: items.length,
    items,
    text: `${items.length} Environment Agency flood ${items.length === 1 ? "area" : "areas"} within 3km — nearest is “${nearest.name}”${nearest.watercourse ? ` (${nearest.watercourse})` : ""}${nearest.approxLabel ? `, about ${nearest.approxLabel} away` : ""}. Distances are approximate (measured to each area’s centre).`,
  };
}

/** Active (in-force) warnings at generation time.
 *  `checked` is false when the live endpoint couldn't be reached — in that case we
 *  must NOT claim "none in force"; we say the live picture couldn't be confirmed. */
function formatWarnings(warnings, checked) {
  if (!checked) {
    return { active: false, checked: false, count: 0, items: [], text: "The live flood-warning service couldn’t be reached in time, so current warnings couldn’t be confirmed — check the up-to-the-minute picture at gov.uk/check-flood-risk." };
  }
  if (!warnings.length) {
    return { active: false, checked: true, count: 0, items: [], text: "No flood warnings or alerts were in force here at the time this brief was generated." };
  }
  return {
    active: true,
    checked: true,
    count: warnings.length,
    items: warnings.map((w) => ({ name: w.name, severity: w.severity, severityLabel: w.severityLabel, message: w.message || null })),
    text: `${warnings.length} active flood ${warnings.length === 1 ? "warning/alert is" : "warnings/alerts are"} in force near these coordinates right now — check the live picture at gov.uk/check-flood-risk.`,
  };
}

/** Historic-flood block (a recorded past flood outline is a strong real signal). */
function buildHistoric(historic) {
  if (!historic) return null;
  if (historic.floodedAtPoint) {
    return { flooded: true, scope: "point", text: "This location falls within a recorded historic flood outline — the Environment Agency has a record of past flooding here. Ask the seller directly about flood history and any resulting works or insurance claims." };
  }
  if (historic.floodedNearby) {
    return { flooded: true, scope: "nearby", text: "A recorded historic flood outline lies within about 250m — there is a record of past flooding close by. Worth asking the seller about local flood history." };
  }
  return { flooded: false, scope: "none", text: "No recorded historic flood outline at or immediately around this location on the Environment Agency Historic Flood Map." };
}

/** Actionable next steps, scaled to the risk picture. Always includes the EA verify link. */
function buildNextSteps({ elevated, districtWide, historic }) {
  const steps = [];
  if (districtWide) {
    steps.push(`Generate a brief for a full postcode to get the property-level flood zone — then verify the exact plot at ${VERIFY_URL}.`);
  } else {
    steps.push(`Check the exact property address at ${VERIFY_URL} before exchange — area and centroid-level risk can differ from the specific plot.`);
  }
  if (elevated) {
    steps.push("Obtain a buildings-insurance quote early — flood-prone properties can be materially more expensive to insure, and some lenders restrict lending in higher-risk zones.");
    steps.push("Ask your conveyancer for a flood-specific environmental search and confirm Flood Re eligibility.");
  }
  if (historic?.floodedAtPoint || historic?.floodedNearby) {
    steps.push("Ask the seller directly about past flooding, remedial works, and any insurance claims — historic incidents are not always captured in standard searches.");
  }
  steps.push("Check the surface-water flood layer separately — it is a distinct hazard from the river/sea flooding assessed here.");
  return steps;
}

/** Honest source footnote listing the EA datasets that actually resolved. */
function sourceFootnote(f) {
  const parts = [];
  if (f?.sources?.rofrs) parts.push("Risk of Flooding from Rivers and Sea");
  if (f?.sources?.planning) parts.push("Flood Map for Planning (Rivers and Sea)");
  if (f?.sources?.areas) parts.push("Flood Warning/Alert Areas");
  if (f?.sources?.warnings) parts.push("live flood-monitoring warnings");
  if (f?.sources?.historic) parts.push("Historic Flood Map");
  const list = parts.length ? parts.join(", ") : "Environment Agency flood data";
  return `Source: Environment Agency open data (${list}), queried at the validated coordinates. Indicative and area-modelled — not a property-specific flood risk assessment. Confirm at ${VERIFY_URL}.`;
}
