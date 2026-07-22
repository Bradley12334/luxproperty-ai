/**
 * lib/brief/flood.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ENVIRONMENT-AGENCY FLOOD FETCH — point-wise flood signals at the VALIDATED
 * coordinates, for the free-tier "Flood, Climate & Resilience" section.
 *
 * WHY THIS EXISTS / WHAT IT DELIBERATELY DOES NOT DO:
 *   The salvaged production brief derived a flood ZONE from a COUNT of nearby EA
 *   flood-warning areas ("≥4 areas within 1.5km → Zone 3"). Those areas are large
 *   administrative warning polygons (whole Tidal-Thames stretches spanning several
 *   boroughs) and the count is a radius search on their reference point — NOT a
 *   point-in-polygon test. That is exactly why Notting Hill (W11), which sits on a
 *   hill in genuine Flood Zone 1, was mislabelled "Zone 3 (High Probability)". This
 *   module NEVER infers a zone from a count. It asks the actual flood-zone polygons
 *   whether the validated coordinate is inside them (BRIEF_SPEC → "EA lookup at
 *   validated coordinates, never borough-level").
 *
 * SOURCES (all Environment Agency open data, all queried point-wise at lat/lng with
 * inSR=4326 — the ArcGIS services reproject WGS84 → British National Grid on the fly):
 *   1. Risk of Flooding from Rivers and Sea (RoFRS) → `prob_4band`: the headline
 *      property-level probability band (High / Medium / Low / Very Low). Absence of a
 *      polygon at the point = Very Low (the dataset only maps Low-and-above).
 *   2. Flood Map for Planning (Rivers and Sea) Flood Zone 2 / Flood Zone 3:
 *      point-in-polygon → the planning-system flood zone (Zone 1/2/3), plus a small
 *      proximity buffer (is Zone 2/3 within 250m) so a centroid that sits just
 *      OUTSIDE a zone still reports the adjacent risk instead of a false all-clear.
 *   3. Flood Warning Areas + Flood Alert Areas (ArcGIS polygons): the named nearby
 *      areas / watercourses, with a genuine computed approximate distance (haversine
 *      from the property to each area centroid). This is what these polygons are FOR
 *      — naming watercourses — never for determining the point's own zone.
 *   4. flood-monitoring `/floods`: any ACTIVE flood warnings/alerts at generation
 *      time (real-time), near the coordinate.
 *   5. Historic Flood Map: has this exact location actually flooded before (a real
 *      recorded outline, not a probability).
 *
 * NOT INCLUDED, on purpose (see BRIEF_SPEC → no fabricated ratings):
 *   - Surface water: no OPEN point-level susceptibility band exists (the proper
 *     RoFSW product is licensed; only a 1km people-exposure grid is open, which is
 *     area exposure, not a property rating). The section flags surface water as a
 *     hazard to check rather than inventing a rating.
 *   - Subsidence / geology: no open point-wise source (BGS GeoSure shrink-swell is
 *     commercial). The old outcode→"London clay" list is the same pseudo-precise
 *     pattern that produced the flood failure, so it is NOT reproduced. The section
 *     renders clearly-labelled general guidance instead.
 *
 * NO NEW SERVERLESS FUNCTION: this runs inside generate() (already server-side).
 * BEST-EFFORT: every sub-query is independent and non-throwing; a failure degrades
 * only that signal. A total failure yields { ok:false } and the section renders an
 * honest UNAVAILABLE with the gov.uk verification link — never a fabricated figure.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// EA "Data Services Platform" hosted feature services (open, no key). Centralised so
// a host/token rotation is a one-line change and, if it ever 404s, the module simply
// degrades to a best-effort miss (the section then renders SPARSE/UNAVAILABLE with the
// gov.uk link, never a fabricated value).
const EA_ARCGIS = "https://environment.data.gov.uk/KB6uNVj5ZcJr7jUP/ArcGIS/rest/services";
const FMP = `${EA_ARCGIS}/Flood_Map_for_Planning/FeatureServer`; // layer 1 = Zone 3, layer 2 = Zone 2
const ROFRS = `${EA_ARCGIS}/RiskOfFloodingFromRiversAndSea/FeatureServer/0`;
const WARNING_AREAS = `${EA_ARCGIS}/FloodWarningAreas/FeatureServer/0`;
const ALERT_AREAS = `${EA_ARCGIS}/FloodAlertAreas/FeatureServer/0`;
const HISTORIC = `${EA_ARCGIS}/HistoricFloodMap/FeatureServer/0`;
// Real-time warnings — the separate, long-stable flood-monitoring API.
const FLOOD_MONITORING = "https://environment.data.gov.uk/flood-monitoring/id/floods";

const DEFAULT_TIMEOUT_MS = 6_000; // own short budget; independent of the SPARQL budget
// The real-time flood-monitoring /floods endpoint is frequently very slow (10–20s),
// so it gets its OWN tight leash: we'd rather honestly report "live warnings couldn't
// be checked in time" than hold the whole section to the full budget waiting for it.
const WARNINGS_TIMEOUT_MS = 3_500;
const NEARBY_RADIUS_M = 3_000;    // radius for naming nearby warning/alert areas
const PROXIMITY_BUFFER_M = 250;   // "is a flood zone right next to the centroid?"
const MAX_NEARBY_AREAS = 6;       // enough to name the local watercourses, still scannable

/**
 * @typedef {Object} FloodClimate
 * @property {boolean} ok                       true if the core point risk resolved (band or zone)
 * @property {boolean} partial                  true if some sub-signals failed but core succeeded
 * @property {"High"|"Medium"|"Low"|"Very Low"|null} riskBand   RoFRS prob_4band at the point
 * @property {1|2|3|null} planningZone          Flood Map for Planning zone at the point
 * @property {{ zone2Within:boolean, zone3Within:boolean, bufferM:number }|null} proximity
 * @property {{ name:string, watercourse:string|null, approxMeters:number|null, kind:"warning"|"alert" }[]} nearbyAreas
 * @property {{ name:string, message:string, severity:number|null, severityLabel:string|null }[]} activeWarnings
 * @property {{ floodedAtPoint:boolean, floodedNearby:boolean }|null} historic
 * @property {{ rofrs:boolean, planning:boolean, areas:boolean, warnings:boolean, historic:boolean }} sources
 */

/** One GET returning parsed JSON, or null on any failure. Never throws. */
async function getJson(url, signal) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // timeout / network / parse — caller treats as "signal unavailable"
  }
}

/** Build an ArcGIS point-query URL at (lat,lng) in WGS84 (the service reprojects). */
function pointQuery(layerUrl, lat, lng, params = {}) {
  const qs = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    where: "1=1",
    f: "json",
    ...params,
  });
  return `${layerUrl}/query?${qs.toString()}`;
}

/** Great-circle distance in metres between two WGS84 points. */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** RoFRS `prob_4band` at the point. → "High"|"Medium"|"Low"|"Very Low"|null(miss). */
async function fetchRiskBand(lat, lng, signal) {
  // NB: no resultRecordCount — on this RoFRS service that param forces a ~11s query
  // path (vs ~180ms without it). A point-in-polygon returns at most a handful of
  // features anyway, so we read the first.
  const json = await getJson(
    pointQuery(ROFRS, lat, lng, { outFields: "prob_4band", returnGeometry: "false" }),
    signal,
  );
  if (!json || !Array.isArray(json.features)) return { ok: false, band: null };
  // No intersecting polygon → the point is below the mapped-risk threshold = Very Low.
  if (json.features.length === 0) return { ok: true, band: "Very Low" };
  const raw = String(json.features[0]?.attributes?.prob_4band || "").trim();
  const band = ["High", "Medium", "Low", "Very Low"].find((b) => b.toLowerCase() === raw.toLowerCase());
  return { ok: true, band: band || "Very Low" };
}

/** Point-in-polygon count for one Flood-Map-for-Planning layer, optional buffer. */
async function fmpCount(layerId, lat, lng, signal, distanceM = 0) {
  const params = { returnCountOnly: "true" };
  if (distanceM > 0) {
    params.distance = String(distanceM);
    params.units = "esriSRUnit_Meter";
  }
  const json = await getJson(pointQuery(`${FMP}/${layerId}`, lat, lng, params), signal);
  if (!json || typeof json.count !== "number") return null;
  return json.count;
}

/** Planning zone at the point (3 highest, else 2, else 1) + a within-buffer proximity flag. */
async function fetchPlanningZone(lat, lng, signal) {
  // Zone 3 is the more severe; check both at the point and just around it, in parallel.
  const [z3, z2, z3near, z2near] = await Promise.all([
    fmpCount(1, lat, lng, signal), // at point: Zone 3
    fmpCount(2, lat, lng, signal), // at point: Zone 2
    fmpCount(1, lat, lng, signal, PROXIMITY_BUFFER_M),
    fmpCount(2, lat, lng, signal, PROXIMITY_BUFFER_M),
  ]);
  if (z3 == null && z2 == null) return { ok: false, zone: null, proximity: null };

  let zone;
  if (z3 > 0) zone = 3;
  else if (z2 > 0) zone = 2;
  else zone = 1;

  const proximity = {
    bufferM: PROXIMITY_BUFFER_M,
    zone3Within: (z3near ?? 0) > 0,
    zone2Within: (z2near ?? 0) > 0,
  };
  return { ok: true, zone, proximity };
}

/** Nearby named flood areas (warning + alert) with computed approx distances. */
async function fetchNearbyAreas(lat, lng, signal) {
  const areaParams = {
    distance: String(NEARBY_RADIUS_M),
    units: "esriSRUnit_Meter",
    returnGeometry: "false",
    returnCentroid: "true",
    outSR: "4326",
  };
  const [warnJson, alertJson] = await Promise.all([
    getJson(pointQuery(WARNING_AREAS, lat, lng, { ...areaParams, outFields: "ta_name,river_sea" }), signal),
    getJson(pointQuery(ALERT_AREAS, lat, lng, { ...areaParams, outFields: "ta_name,river_sea" }), signal),
  ]);
  if (warnJson == null && alertJson == null) return { ok: false, areas: [] };

  const collect = (json, kind) =>
    (Array.isArray(json?.features) ? json.features : []).map((f) => {
      const c = f.centroid || {};
      const approxMeters =
        Number.isFinite(c.y) && Number.isFinite(c.x) ? haversineMeters(lat, lng, c.y, c.x) : null;
      const watercourse = String(f.attributes?.river_sea || "").trim() || null;
      return { name: String(f.attributes?.ta_name || "").trim(), watercourse, approxMeters, kind };
    });

  const areas = [...collect(warnJson, "warning"), ...collect(alertJson, "alert")]
    .filter((a) => a.name)
    .sort((a, b) => (a.approxMeters ?? Infinity) - (b.approxMeters ?? Infinity))
    .slice(0, MAX_NEARBY_AREAS);

  return { ok: true, areas };
}

/** EA severity code → label. 1=Severe Warning, 2=Warning, 3=Alert, 4=No-longer-in-force. */
function severityLabel(level) {
  return { 1: "Severe flood warning", 2: "Flood warning", 3: "Flood alert", 4: "Warning no longer in force" }[level] || null;
}

/** Active flood warnings/alerts near the point, at generation time (real-time).
 *  Runs under its OWN short timeout (chained to the parent signal) so the chronically
 *  slow flood-monitoring endpoint can't hold the whole section to the full budget. */
async function fetchActiveWarnings(lat, lng, parentSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WARNINGS_TIMEOUT_MS);
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }
  const qs = new URLSearchParams({ lat: String(lat), long: String(lng), dist: "10" });
  let json;
  try {
    json = await getJson(`${FLOOD_MONITORING}?${qs.toString()}`, controller.signal);
  } finally {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort);
  }
  // ok=false means "we couldn't get an answer" — the builder must NOT read that as
  // "no warnings in force"; it says the live picture couldn't be checked instead.
  if (json == null) return { ok: false, warnings: [] };
  const items = Array.isArray(json.items) ? json.items : [];
  const warnings = items
    // severityLevel 1–3 are in-force; 4 is "no longer in force".
    .filter((w) => Number(w?.severityLevel) >= 1 && Number(w?.severityLevel) <= 3)
    .map((w) => ({
      name: String(w?.floodArea?.riverOrSea || w?.description || "Flood warning").trim(),
      message: String(w?.message || "").trim(),
      severity: Number.isFinite(Number(w?.severityLevel)) ? Number(w.severityLevel) : null,
      severityLabel: severityLabel(Number(w?.severityLevel)),
    }));
  return { ok: true, warnings };
}

/** Historic Flood Map: has this exact point (or its immediate surroundings) flooded before? */
async function fetchHistoric(lat, lng, signal) {
  const [atPoint, nearby] = await Promise.all([
    getJson(pointQuery(HISTORIC, lat, lng, { returnCountOnly: "true" }), signal),
    getJson(pointQuery(HISTORIC, lat, lng, { returnCountOnly: "true", distance: "250", units: "esriSRUnit_Meter" }), signal),
  ]);
  if (atPoint == null && nearby == null) return { ok: false, historic: null };
  return {
    ok: true,
    historic: {
      floodedAtPoint: (atPoint?.count ?? 0) > 0,
      floodedNearby: (nearby?.count ?? 0) > 0,
    },
  };
}

/**
 * Fetch all point-wise flood signals for a validated location. Best-effort; never
 * throws. Every sub-signal is independent — a partial upstream outage still yields
 * whatever resolved, and the section builder renders the rest honestly.
 *
 * @param {{ lat:number, lng:number, outcodeOnly?:boolean }} location  the RESOLVED location
 * @param {{ signal?:AbortSignal, timeoutMs?:number }} [opts]
 * @returns {Promise<FloodClimate>}
 */
export async function fetchFloodClimate(location, opts = {}) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  const empty = {
    ok: false, partial: false, riskBand: null, planningZone: null, proximity: null,
    nearbyAreas: [], activeWarnings: [], historic: null,
    sources: { rofrs: false, planning: false, areas: false, warnings: false, historic: false },
  };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return empty;

  // Own timeout, chained to any caller signal, so a slow EA endpoint can't blow the
  // whole brief's budget. AbortController.abort() propagates to every in-flight query.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS);
  const onParentAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", onParentAbort, { once: true });
  }
  const signal = controller.signal;

  try {
    const [band, zone, areas, warnings, historic] = await Promise.all([
      fetchRiskBand(lat, lng, signal),
      fetchPlanningZone(lat, lng, signal),
      fetchNearbyAreas(lat, lng, signal),
      fetchActiveWarnings(lat, lng, signal),
      fetchHistoric(lat, lng, signal),
    ]);

    const sources = {
      rofrs: band.ok,
      planning: zone.ok,
      areas: areas.ok,
      warnings: warnings.ok,
      historic: historic.ok,
    };
    // "Core" point risk = we got at least one authoritative point read (band or zone).
    const ok = band.ok || zone.ok;
    const partial = ok && !(band.ok && zone.ok && areas.ok && warnings.ok && historic.ok);

    return {
      ok,
      partial,
      riskBand: band.band,
      planningZone: zone.zone,
      proximity: zone.proximity,
      nearbyAreas: areas.areas,
      activeWarnings: warnings.warnings,
      historic: historic.historic,
      sources,
    };
  } catch {
    return empty; // defensive — the sub-fetchers already swallow their own errors
  } finally {
    clearTimeout(timer);
    if (opts.signal) opts.signal.removeEventListener("abort", onParentAbort);
  }
}
