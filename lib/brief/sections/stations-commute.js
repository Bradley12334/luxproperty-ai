/**
 * lib/brief/sections/stations-commute.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Stations & Commute" (EXP).
 *
 * Combines the nearby stations (OSM/Overpass, deduped modes & lines, walk-time
 * estimates) with the region-adaptive SIMPLE commute note (one honest headline
 * destination). Pure function of the already-fetched station result + location — no
 * network here (the Overpass call happens concurrently in generate()).
 *
 * States (BRIEF_SPEC → every section DATA/SPARSE/UNAVAILABLE):
 *   DATA    at least one station within walking range.
 *   SPARSE  no station in range (an honest rural result — NEVER a far-off station
 *           listed as if walkable) OR the live station lookup failed. The commute
 *           headline still renders in both cases, so the section never disappears.
 * There is no UNAVAILABLE state: the commute headline is always computable from the
 * validated coordinate, so there is always something honest to show.
 *
 * DISTRICT-WIDE (outcodeOnly): distances are measured from the district CENTROID, and
 * the copy says so — a bare-outcode brief must not imply a single property location.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";
import { WALK_M_PER_MIN, distanceLabel } from "../overpass.js";
import { buildSimpleCommute } from "../commute.js";

/**
 * @param {{ ok:boolean, stations:import("../overpass.js").Station[] }} stationsResult
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildStationsCommuteSection(stationsResult, location, tier) {
  const scope = location.outcodeOnly ? "district" : "point";
  const from = location.outcodeOnly ? `the ${location.outcode} district centre` : "this postcode";

  const commute = buildSimpleCommute(location);

  const fetched = stationsResult?.ok === true;
  const stations = Array.isArray(stationsResult?.stations) ? stationsResult.stations : [];

  let stationsState;
  if (!fetched) stationsState = "unavailable";
  else if (stations.length === 0) stationsState = "none";
  else stationsState = "found";

  const shaped = stations.map((s) => ({
    name: s.name,
    modes: s.modes,
    lines: s.lines,
    distanceMeters: s.distanceMeters,
    distanceLabel: distanceLabel(s.distanceMeters),
    walkMins: s.walkMins,
  }));

  const state = stationsState === "found" ? "DATA" : "SPARSE";

  let note = null;
  if (stationsState === "none") {
    note =
      `No railway, tram or bus station is recorded within about a 15-minute walk of ${from}. ` +
      `This is a car- or bus-dependent location for most journeys — the nearest stations are further out ` +
      `than the walking range shown, so none are listed as walkable.`;
  } else if (stationsState === "unavailable") {
    note =
      `Live station data (OpenStreetMap) could not be retrieved for ${from} right now, so nearby stations ` +
      `aren’t listed. The commute headline below is unaffected. Try again shortly for the station list.`;
  } else if (scope === "district") {
    note =
      `Stations are measured from the ${location.outcode} district centre — a full postcode gives ` +
      `walk times from a specific address.`;
  }

  const walkSpeedNote =
    `Walk times are estimates from straight-line distance at ${WALK_M_PER_MIN} m/min (~4.8 km/h), ` +
    `not routed walking directions.`;

  return {
    key: "stationsCommute",
    title: "Stations & Commute",
    minTier: "EXP",
    entitled: isEntitled(tier, "section.commuteNote"), // EXP; unlock-all → true
    state,
    note,
    sourceFootnote:
      "Stations from OpenStreetMap (Overpass). Modes and lines are deduplicated from OSM tags. " +
      "Commute distance is straight-line to the nearest major employment centre — not a timetabled journey time.",
    data: {
      scope,
      stationsState,
      walkSpeedNote,
      stations: shaped,
      nearest: shaped[0] ?? null,
      commute,
    },
  };
}
