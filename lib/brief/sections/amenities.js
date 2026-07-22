/**
 * lib/brief/sections/amenities.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Local Amenities" (EXP).
 *
 * Everyday amenities from Overpass (OSM) in three honest groups — supermarkets &
 * food shops, cafés/restaurants, GPs & health — each with straight-line distances
 * and a REAL count (total found vs shown). Thin OSM coverage is stated plainly
 * (BRIEF_SPEC → "thin coverage → say so"), never dressed up as "no amenities".
 *
 * States:
 *   DATA    at least one amenity found.
 *   SPARSE  fetch ok but nothing found (a coverage caveat, not a claim of absence),
 *           OR the fetch failed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";
import { WALK_M_PER_MIN, distanceLabel } from "../overpass.js";

const GROUP_META = [
  { key: "supermarkets", label: "Supermarkets & food shops" },
  { key: "food", label: "Cafés & restaurants" },
  { key: "health", label: "GPs & health" },
];

function shapeGroup(group) {
  const items = (group?.items || []).map((i) => ({
    name: i.name,
    type: i.type,
    distanceMeters: i.distanceMeters,
    distanceLabel: distanceLabel(i.distanceMeters),
    walkMins: i.walkMins,
  }));
  return { total: group?.total ?? items.length, shown: items.length, items };
}

/**
 * @param {{ ok:boolean, groups:Object }} amenitiesResult
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildAmenitiesSection(amenitiesResult, location, tier) {
  const base = {
    key: "amenities",
    title: "Local Amenities",
    minTier: "EXP",
    entitled: isEntitled(tier, "section.amenities"), // EXP; unlock-all → true
  };

  const from = location.outcodeOnly ? `the ${location.outcode} district centre` : "this postcode";
  const fetched = amenitiesResult?.ok === true;
  const groups = GROUP_META.map((g) => ({ ...g, ...shapeGroup(amenitiesResult?.groups?.[g.key]) }));
  const totalFound = groups.reduce((n, g) => n + g.total, 0);

  if (!fetched) {
    return {
      ...base,
      state: "SPARSE",
      note: `Live amenity data (OpenStreetMap) could not be retrieved for ${from} right now. Try again shortly.`,
      data: { scope: location.outcodeOnly ? "district" : "point", groups, totalFound: 0 },
    };
  }

  if (totalFound === 0) {
    return {
      ...base,
      state: "SPARSE",
      note:
        `No shops, food or health amenities are recorded in OpenStreetMap within walking range of ${from}. ` +
        `OSM coverage can be patchy — this may reflect a data gap rather than a genuine absence; check a mapping app for the street-level picture.`,
      data: { scope: location.outcodeOnly ? "district" : "point", groups, totalFound: 0 },
    };
  }

  // Thin coverage note (some data, but sparse) — honest, not alarmist.
  const thin = totalFound < 6;
  const note = location.outcodeOnly
    ? `Amenities are measured from the ${location.outcode} district centre — a full postcode gives distances from a specific address.`
    : thin
    ? `Only a handful of amenities are recorded in OpenStreetMap near ${from}; coverage can be patchy, so treat this as a floor, not a full picture.`
    : null;

  return {
    ...base,
    state: "DATA",
    note,
    sourceFootnote:
      `Amenities from OpenStreetMap (Overpass). Counts are what OSM records within range (supermarkets/food ≤1.2 km, ` +
      `cafés/restaurants ≤800 m, health ≤1.5 km); distances are straight-line, walk times estimated at ${WALK_M_PER_MIN} m/min.`,
    data: { scope: location.outcodeOnly ? "district" : "point", groups, totalFound },
  };
}
