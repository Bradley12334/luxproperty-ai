/**
 * lib/brief/air-quality.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AIR QUALITY (PRO) — nearest DEFRA/ERG monitoring station to the validated
 * coordinate, with the MONITOR NAME AND DISTANCE ALWAYS DISCLOSED.
 *
 * THE FIX (Phase 2d): the old brief cited a Westminster monitor for an N1 brief
 * without saying so. The honest correction is disclosure — every reading names the
 * physical station it came from and how far away it is, and a distant monitor is
 * flagged as possibly-unrepresentative rather than presented as local truth.
 *
 * SOURCE / COVERAGE (probed live): the ERG "London Air" API (api.erg.ic.ac.uk),
 * GroupName=All, is the open, keyless real-time index feed. It covers London + the
 * South East / East of England (~73 local authorities) — it is NOT nationwide. So:
 *   - a monitor within range → readings + band, monitor disclosed;
 *   - the nearest monitor far away (e.g. a non-SE location) → honest note that it may
 *     not represent local air quality, or UNAVAILABLE with a uk-air.defra.gov.uk
 *     link-out when there is simply no monitor near enough to be meaningful.
 * Never a fabricated reading, never an undisclosed borough.
 *
 * Best-effort; never throws. Runs inside generate() (no new serverless function).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { haversineMeters } from "./overpass.js";

const ERG_INDEX = "https://api.erg.ic.ac.uk/AirQuality/Hourly/MonitoringIndex/GroupName=All/Json";
const DEFAULT_TIMEOUT_MS = 7_000;

/** DEFRA Daily Air Quality Index (1–10) → band. */
export function daqiBand(index) {
  if (!Number.isFinite(index) || index < 1) return null;
  if (index <= 3) return "Low";
  if (index <= 6) return "Moderate";
  if (index <= 9) return "High";
  return "Very High";
}

/** Coerce ERG's "single object OR array" fields to an array. */
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

/**
 * @param {{lat:number,lng:number}} location
 * @param {{ signal?:AbortSignal, timeoutMs?:number }} [opts]
 * @returns {Promise<{
 *   ok:boolean,
 *   monitor:{ name:string, localAuthority:string|null, distanceMeters:number }|null,
 *   readings:{ species:string, index:number, band:string|null }[],
 *   maxIndex:number|null, band:string|null
 * }>}
 */
export async function fetchAirQuality(location, opts = {}) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  const empty = { ok: false, monitor: null, readings: [], maxIndex: null, band: null };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return empty;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS);
  const onParentAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", onParentAbort, { once: true });
  }

  let json;
  try {
    const res = await fetch(ERG_INDEX, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) return empty;
    // The feed sometimes carries a UTF-8 BOM; strip it before JSON.parse.
    const text = (await res.text()).replace(/^\uFEFF/, "");
    json = JSON.parse(text);
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
    if (opts.signal) opts.signal.removeEventListener("abort", onParentAbort);
  }

  const authorities = arr(json?.HourlyAirQualityIndex?.LocalAuthority);
  const SPECIES = ["NO2", "PM25", "PM10", "O3", "SO2"];

  // Find the nearest SITE that actually has a live index for at least one species.
  let best = null;
  for (const la of authorities) {
    for (const site of arr(la.Site)) {
      const siteLat = Number(site["@Latitude"]);
      const siteLng = Number(site["@Longitude"]);
      if (!Number.isFinite(siteLat) || !Number.isFinite(siteLng)) continue;

      const readings = [];
      for (const sp of arr(site.Species)) {
        const code = String(sp["@SpeciesCode"] || "");
        const index = parseInt(sp["@AirQualityIndex"], 10);
        if (!SPECIES.includes(code) || !Number.isFinite(index) || index < 1) continue;
        readings.push({
          species: code === "PM25" ? "PM2.5" : code,
          index,
          band: String(sp["@AirQualityBand"] || "").trim() || daqiBand(index),
        });
      }
      if (readings.length === 0) continue; // site online but no live index — skip

      const dist = haversineMeters(lat, lng, siteLat, siteLng);
      if (!best || dist < best.distanceMeters) {
        best = {
          distanceMeters: dist,
          name: String(site["@SiteName"] || "Monitoring station").trim(),
          localAuthority: String(la["@LocalAuthorityName"] || "").trim() || null,
          readings,
        };
      }
    }
  }

  if (!best) return empty;

  const maxIndex = Math.max(...best.readings.map((r) => r.index));
  return {
    ok: true,
    monitor: { name: best.name, localAuthority: best.localAuthority, distanceMeters: best.distanceMeters },
    readings: best.readings,
    maxIndex,
    band: daqiBand(maxIndex),
  };
}
