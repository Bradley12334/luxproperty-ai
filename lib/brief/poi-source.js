/**
 * lib/brief/poi-source.js
 * ─────────────────────────────────────────────────────────────────────────────
 * LOCAL POI SOURCE — a drop-in for fetchOverpassBundle() backed by the Supabase
 * `poi` table (GB-wide OSM POIs, compound GiST on (category, geog)) instead of the
 * public Overpass API. Removes the 4–13 s, rate-limited, sometimes-wrong Overpass
 * dependency for the neighbourhood sections (stations & commute, schools, amenities,
 * green space) with a single indexed query.
 *
 * HOW IT STAYS BYTE-IDENTICAL TO OVERPASS:
 *   - Calls the additive Postgres function nearby_poi(lat,lng) via supabase.rpc()
 *     (the SAME service-key client the rest of lib/brief uses — no new env var, no
 *     new dependency). nearby_poi applies the EXACT per-type radii the Overpass query
 *     used (station 1500 / tram 1200 / bus 825 / school+college 1500 / kindergarten
 *     1050 / shop 1200 / food 800 / health 1500 / park 1000) and returns every match
 *     within radius (no caps — the parsers cap).
 *   - Reshapes each row into an OSM-like element { tags, lat, lon } and feeds the
 *     SHARED, exported overpass.js parsers (parseStations / parseSchools /
 *     parseAmenities). Classification (deriveModes, deriveLines, derivePhase,
 *     isSpecialist, the label maps, dedupe + nearest-N cap) lives in overpass.js
 *     ALONE — this module adds NO derive logic. It only supplies real tags.
 *
 * The tag keys fed to the parsers come from the poi.tags column populated by the
 * loader ~/Documents/osm-poi/load-poi.mjs — see the SELECTOR DRIFT warning in
 * overpass.js: change a selector/tag-key there and the loader must be updated + re-run.
 *
 * FAILURE BEHAVIOUR: never throws. Any failure (missing env, RPC error, bad shape)
 * → overpassFailShape(), so the section builders render their honest UNAVAILABLE
 * state. A genuine "nothing nearby" (rural) is NOT a failure — it returns ok:true with
 * empty lists, exactly as fetchOverpassBundle distinguished null from []. There is NO
 * fallback to public Overpass (that would reintroduce the latency/rate-limit/N1-class
 * failures this migration removes); fetchOverpassBundle stays in overpass.js as a
 * one-line revert in generate.js, not an automatic fallback.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import { parseStations, parseSchools, parseAmenities, overpassFailShape } from "./overpass.js";

// Lazily-built service-key client, cached across warm invocations (mirrors cache.js).
let _client = null;
let _resolved = false;
function poiClient() {
  if (_resolved) return _client;
  _resolved = true;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    _client = null; // no durable layer here — caller renders honest UNAVAILABLE
    return null;
  }
  try {
    _client = createClient(url, key, { auth: { persistSession: false } });
  } catch (err) {
    console.warn(`[brief] poi source disabled — client init failed: ${err?.message || err}`);
    _client = null;
  }
  return _client;
}

/**
 * Local replacement for fetchOverpassBundle(location): identical return shape, backed
 * by the `poi` table. Feeds the shared overpass.js parsers OSM-shaped { tags, lat, lon }
 * rows so the three sub-results are byte-identical to the Overpass path.
 * @param {{ lat:number, lng:number }} location
 * @returns {Promise<{ ok:boolean, stations:{ok:boolean,stations:Array}, schools:{ok:boolean,schools:Array}, amenities:{ok:boolean,groups:Object} }>}
 */
export async function fetchPoiBundle(location) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return overpassFailShape();

  const supabase = poiClient();
  if (!supabase) return overpassFailShape();

  let rows;
  try {
    const { data, error } = await supabase.rpc("nearby_poi", { in_lat: lat, in_lng: lng });
    if (error || !Array.isArray(data)) return overpassFailShape();
    rows = data;
  } catch {
    return overpassFailShape(); // never throw — honest UNAVAILABLE, no Overpass fallback
  }

  // Reshape poi rows → OSM-like elements the shared parsers expect. The parsers read
  // tags.name || tags["name:en"], so we fold the row's `name` column into tags.name.
  // Every element carries lat/lon (parsers read el.lat/el.lon, or el.center as fallback).
  const elements = rows.map((r) => ({
    tags: { ...(r.tags || {}), name: r.name },
    lat: r.lat,
    lon: r.lng,
  }));

  // Each parser self-filters to its own elements (isStation / amenity in school-set /
  // shop|food|health|leisure), exactly as the combined Overpass bundle did, so a single
  // mixed element set yields all three shaped, deduped, capped sub-results.
  return {
    ok: true,
    stations: { ok: true, stations: parseStations(elements, lat, lng) },
    schools: { ok: true, schools: parseSchools(elements, lat, lng) },
    amenities: { ok: true, groups: parseAmenities(elements, lat, lng) },
  };
}
