/**
 * lib/brief/sections/commute-calculator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Full Commute Calculator" (PRO).
 *
 * Region-adaptive multi-destination journeys:
 *   - London   → LIVE TfL door-to-door times (real figures) to the four London
 *                anchors. Method "tfl".
 *   - elsewhere → the nearest major centres as CLEARLY-LABELLED straight-line
 *                distances + a rough by-road time estimate. There is no keyless
 *                national journey API, so nothing here is presented as a timetabled
 *                time — every non-London figure is explicitly an estimate with a
 *                National Rail link-out. Method "estimate".
 *
 * Pure function of the location + the already-fetched TfL result (fetched
 * concurrently in generate() only when the location is in London).
 *
 * States:
 *   DATA    at least one destination resolved (TfL time, or an estimate row).
 *   SPARSE  London but every TfL lookup failed — honest note + tfl.gov.uk link,
 *           never a fabricated time.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";
import { selectCommuteTargets, kmLabel } from "../commute.js";

/** Minutes → "42 min" / "1h 05m". */
function minutesLabel(mins) {
  if (!Number.isFinite(mins)) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** A deliberately-rough by-road time from a straight-line distance. Straight-line ×
 *  1.3 (typical road detour) at 60 km/h ⇒ minutes ≈ straightKm × 1.3. Labelled as an
 *  estimate everywhere it is shown — never presented as a real journey time. */
function roughDriveMinutes(distanceMeters) {
  const km = distanceMeters / 1000;
  return Math.round(km * 1.3);
}

/**
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @param {{ ok:boolean, results:{destination:string,durationMins:number|null,modes:string[]}[] }|null} tflResult
 * @returns {Object} a BriefSection
 */
export function buildCommuteCalculatorSection(location, tier, tflResult) {
  const base = {
    key: "commuteCalculator",
    title: "Full Commute Calculator",
    minTier: "PRO",
    entitled: isEntitled(tier, "section.commuteCalculator"), // PRO; unlock-all → true
  };

  const targets = selectCommuteTargets(location);
  const from = location.outcodeOnly ? `the ${location.outcode} district centre` : "this postcode";

  // ── London: live TfL ────────────────────────────────────────────────────────
  if (targets.method === "tfl") {
    const ok = tflResult?.ok === true;
    const results = Array.isArray(tflResult?.results) ? tflResult.results : [];

    if (!ok) {
      return {
        ...base,
        state: "SPARSE",
        note:
          `Live TfL journey times could not be retrieved for ${from} right now. ` +
          `Check journeys directly at tfl.gov.uk.`,
        sourceFootnote: "Journey times: Transport for London (TfL) Journey Planner. Live door-to-door times.",
        data: {
          method: "tfl",
          from,
          linkUrl: "https://tfl.gov.uk/plan-a-journey/",
          linkLabel: "Plan a journey at tfl.gov.uk",
          rows: [],
        },
      };
    }

    const rows = results.map((r) => ({
      destination: r.destination,
      durationMins: r.durationMins,
      durationLabel: r.durationMins != null ? minutesLabel(r.durationMins) : null,
      modes: r.modes,
    }));

    return {
      ...base,
      state: "DATA",
      note:
        location.outcodeOnly
          ? `Times are door-to-door from the ${location.outcode} district centre — a full postcode gives times from a specific address.`
          : null,
      sourceFootnote:
        "Journey times: Transport for London (TfL) Journey Planner — live, fastest door-to-door route by public transport at the time of generation.",
      data: {
        method: "tfl",
        from,
        linkUrl: "https://tfl.gov.uk/plan-a-journey/",
        linkLabel: "Plan a journey at tfl.gov.uk",
        rows,
      },
    };
  }

  // ── Non-London: labelled straight-line estimates ────────────────────────────
  const rows = targets.destinations.map((d) => {
    const drive = roughDriveMinutes(d.distanceMeters);
    return {
      destination: d.name,
      distanceLabel: kmLabel(d.distanceMeters),
      driveMins: drive,
      driveLabel: minutesLabel(drive),
    };
  });

  return {
    ...base,
    state: rows.length > 0 ? "DATA" : "SPARSE",
    note:
      `Outside London there is no open live journey API, so these are ESTIMATES, not timetabled times: ` +
      `a straight-line distance to each centre and a rough by-road time (at ~60 km/h). ` +
      `For exact rail times and connections, check National Rail.`,
    sourceFootnote:
      "Distances are straight-line (haversine) from the location to each centre; by-road times are rough estimates (straight-line × 1.3 at 60 km/h). Not timetabled journey times.",
    data: {
      method: "estimate",
      from,
      linkUrl: "https://www.nationalrail.co.uk/",
      linkLabel: "Check exact times at National Rail",
      rows,
    },
  };
}
