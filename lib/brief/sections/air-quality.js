/**
 * lib/brief/sections/air-quality.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Air Quality" (PRO).
 *
 * Nearest DEFRA/ERG monitor's live index, with THE MONITOR NAME AND DISTANCE ALWAYS
 * DISCLOSED — the fix for the old brief citing an undisclosed Westminster monitor
 * for an N1 property. A distant monitor is flagged as possibly-unrepresentative
 * rather than presented as local fact.
 *
 * States (driven by how far the nearest reporting monitor actually is):
 *   DATA         monitor within ~12 km — readings + band, monitor named.
 *   SPARSE       12–35 km — readings shown, but a strong "may not represent here"
 *                caveat and the disclosed distance.
 *   UNAVAILABLE  >35 km or no monitor with live data — honest note (the real-time
 *                network is densest in London/SE) + uk-air.defra.gov.uk link. The
 *                far monitor's name/distance is STILL disclosed so the gap is visible.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";
import { distanceLabel } from "../overpass.js";

const NEAR_M = 12_000;
const FAR_M = 35_000;
const DEFRA_URL = "https://uk-air.defra.gov.uk/";

const SCALE_NOTE =
  "DEFRA Daily Air Quality Index (1–10): 1–3 Low, 4–6 Moderate, 7–9 High, 10 Very High. " +
  "The band shown is the worst of the pollutants the monitor reports.";

/**
 * @param {{ ok:boolean, monitor:Object|null, readings:Object[], maxIndex:number|null, band:string|null }} aq
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildAirQualitySection(aq, location, tier) {
  const base = {
    key: "airQuality",
    title: "Air Quality",
    minTier: "PRO",
    entitled: isEntitled(tier, "section.airQuality"), // PRO; unlock-all → true
  };

  const from = location.outcodeOnly ? `the ${location.outcode} district centre` : location.postcode;

  // No monitor with live data at all.
  if (!aq?.ok || !aq.monitor) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note:
        `No live air-quality monitor returned readings near ${from}. DEFRA's real-time index network is densest ` +
        `in London and the South East, so many areas have no nearby reporting station. See DEFRA UK-AIR for the ` +
        `nearest background estimates.`,
      sourceFootnote: "Air quality: DEFRA / ERG real-time monitoring index. Coverage is not nationwide.",
      data: { linkUrl: DEFRA_URL, monitor: null, readings: [], scaleNote: SCALE_NOTE, representativeness: "none" },
    };
  }

  const distM = aq.monitor.distanceMeters;
  const monitor = {
    name: aq.monitor.name,
    localAuthority: aq.monitor.localAuthority,
    distanceMeters: distM,
    distanceLabel: distanceLabel(distM),
  };
  const readings = aq.readings.map((r) => ({ species: r.species, index: r.index, band: r.band }));

  // Monitor too far to be meaningful — disclose it, but don't present it as local.
  if (distM > FAR_M) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note:
        `The nearest reporting air-quality monitor, ${monitor.name}, is about ${monitor.distanceLabel} from ${from} — ` +
        `too far to represent air quality here. DEFRA's real-time index network is densest in London and the South East. ` +
        `Check DEFRA UK-AIR for the nearest background estimates.`,
      sourceFootnote: "Air quality: DEFRA / ERG real-time monitoring index. Coverage is not nationwide.",
      data: { linkUrl: DEFRA_URL, monitor, readings: [], scaleNote: SCALE_NOTE, representativeness: "far" },
    };
  }

  const representative = distM <= NEAR_M;
  const state = representative ? "DATA" : "SPARSE";
  const note = representative
    ? `Readings are from the nearest DEFRA monitor, ${monitor.name} (${monitor.localAuthority || "monitoring station"}), ` +
      `about ${monitor.distanceLabel} away. Air quality varies street to street; treat this as the local background.`
    : `The nearest DEFRA monitor is ${monitor.name}, about ${monitor.distanceLabel} away — further than ideal, so these ` +
      `readings may not fully represent ${from}. They are the closest live figures available.`;

  return {
    ...base,
    state,
    note,
    sourceFootnote:
      `Source: DEFRA / ERG real-time monitoring — ${monitor.name}${monitor.localAuthority ? `, ${monitor.localAuthority}` : ""}, ` +
      `${monitor.distanceLabel} from the location. Live index at time of generation.`,
    data: {
      monitor,
      band: aq.band,
      maxIndex: aq.maxIndex,
      readings,
      scaleNote: SCALE_NOTE,
      representativeness: representative ? "near" : "caveat",
      linkUrl: DEFRA_URL,
    },
  };
}
