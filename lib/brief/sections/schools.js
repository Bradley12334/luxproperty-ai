/**
 * lib/brief/sections/schools.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Schools" (EXP).
 *
 * WHAT I FOUND ON THE OFSTED QUESTION (Phase 2d investigation):
 *   The old brief footer's "Ratings from OpenStreetMap" was literally true. The old
 *   engine took ratings from the OSM `ofsted:rating` tag (almost never present) and
 *   otherwise attempted a GIAS API fallback that (a) doesn't reliably expose Ofsted
 *   ratings and (b) is now UNREACHABLE — the host no longer resolves. So ratings were
 *   never really from Ofsted, and there is no keyless per-school Ofsted source today.
 *
 * THE RULE WE FOLLOW (BRIEF_SPEC → Schools):
 *   Real per-school Ofsted ratings from a verifiable source, OR schools listed
 *   WITHOUT ratings plus a link-out — never invented or proxied ratings. We take the
 *   second path: locations & names from Overpass, NO rating chip, and each school
 *   carries an official Ofsted report search link so the user reads the real, current
 *   outcome. Specialist / SEND schools are identified as such (the Frank Barnes
 *   lesson). The catchment caveat is ALWAYS shown. "No current rating" is explained
 *   in the copy (new / not-yet-inspected schools exist; check the linked source).
 *
 * States:
 *   DATA    ≥1 school found.
 *   SPARSE  0 schools found (fetch ok) OR the fetch failed — honest note either way.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";
import { WALK_M_PER_MIN, distanceLabel } from "../overpass.js";

export const CATCHMENT_CAVEAT =
  "School proximity is not admission: most state schools admit by catchment and " +
  "criteria that change yearly, and distance here is straight-line, not the admissions " +
  "measure. Confirm current catchments with the local authority before relying on any school.";

/**
 * @param {{ ok:boolean, schools:import("../overpass.js").School[] }} schoolsResult
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildSchoolsSection(schoolsResult, location, tier) {
  const base = {
    key: "schools",
    title: "Schools",
    minTier: "EXP",
    entitled: isEntitled(tier, "section.amenities"), // EXP; unlock-all → true
    disclaimer: CATCHMENT_CAVEAT,
  };

  const from = location.outcodeOnly ? `the ${location.outcode} district centre` : "this postcode";
  const fetched = schoolsResult?.ok === true;
  const schools = Array.isArray(schoolsResult?.schools) ? schoolsResult.schools : [];

  if (!fetched) {
    return {
      ...base,
      state: "SPARSE",
      note: `Live school data (OpenStreetMap) could not be retrieved for ${from} right now. Try again shortly.`,
      data: { scope: location.outcodeOnly ? "district" : "point", schools: [], ratingsNote: null, catchmentCaveat: CATCHMENT_CAVEAT },
    };
  }

  if (schools.length === 0) {
    return {
      ...base,
      state: "SPARSE",
      note: `No schools are recorded in OpenStreetMap within about a mile of ${from}. Coverage can be thin — check the local authority's school finder for the full picture.`,
      data: { scope: location.outcodeOnly ? "district" : "point", schools: [], ratingsNote: null, catchmentCaveat: CATCHMENT_CAVEAT },
    };
  }

  const shaped = schools.map((s) => ({
    name: s.name,
    phase: s.phase,
    specialist: s.specialist,
    distanceMeters: s.distanceMeters,
    distanceLabel: distanceLabel(s.distanceMeters),
    walkMins: s.walkMins,
    ofstedUrl: s.ofstedUrl,
  }));

  const ratingsNote =
    "Ofsted ratings are not shown in-brief: there is no verifiable per-school ratings feed we can " +
    "attach reliably, so rather than proxy or invent them, each school links to its official Ofsted " +
    "report — where you'll also see if a school has no current rating (new or not yet re-inspected).";

  return {
    ...base,
    state: "DATA",
    note:
      location.outcodeOnly
        ? `Schools are measured from the ${location.outcode} district centre — a full postcode gives distances from a specific address.`
        : null,
    sourceFootnote:
      `Schools from OpenStreetMap (Overpass); nearest ${shaped.length} within range. Distances are straight-line, ` +
      `walk times estimated at ${WALK_M_PER_MIN} m/min. Ratings via each school's official Ofsted report (reports.ofsted.gov.uk).`,
    data: {
      scope: location.outcodeOnly ? "district" : "point",
      schools: shaped,
      ratingsNote,
      catchmentCaveat: CATCHMENT_CAVEAT,
    },
  };
}
