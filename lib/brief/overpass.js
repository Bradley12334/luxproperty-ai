/**
 * lib/brief/overpass.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SHARED OVERPASS (OpenStreetMap) CLIENT for the neighbourhood sections — stations
 * & commute (Phase 2d Unit 1), schools (Unit 3), amenities (Unit 4). Server-side,
 * best-effort, NEVER throws: a failure yields null and the calling section renders
 * an honest SPARSE/UNAVAILABLE state rather than a fabricated list.
 *
 * NO NEW SERVERLESS FUNCTION: every fetcher here runs INSIDE generate(), kicked off
 * concurrently with the long Land Registry SPARQL scan (like flood.js), so it adds
 * effectively no wall-clock.
 *
 * RATE-LIMIT / TIMEOUT GUARDS (salvaged & hardened from the old mockEngine Overpass
 * path, which the Phase 0 list names as a working integration):
 *   - Multiple public Overpass mirrors are tried in order; a 429 / 504 / network
 *     error on one falls through to the next. Overpass rate-limits per-IP, so a
 *     mirror rotation is the honest way to stay within limits without hammering.
 *   - Each attempt has its own AbortSignal timeout so one slow mirror can't hold the
 *     brief to its ceiling.
 *   - A caller can pass a parent signal (chained) to abort every in-flight attempt.
 *
 * The WALK-TIME convention is centralised here and STATED wherever a walk minute is
 * shown: 80 m/min (~4.8 km/h), a standard pedestrian planning speed. It is an
 * ESTIMATE from straight-line distance, never a routed walking time — the sections
 * label it as such (BRIEF_SPEC → "walk-time estimate at a stated m/min").
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Standard pedestrian planning speed used for every walk-time estimate. */
export const WALK_M_PER_MIN = 80;

/**
 * Walk-time estimate in whole minutes from a straight-line distance, at
 * {@link WALK_M_PER_MIN}. Always ≥1 (a 0-min walk reads as an error, not a result).
 * @param {number} distanceMeters
 * @param {number} [metersPerMin]
 * @returns {number}
 */
export function walkMinutes(distanceMeters, metersPerMin = WALK_M_PER_MIN) {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
  return Math.max(1, Math.ceil(distanceMeters / metersPerMin));
}

/** Great-circle distance in metres between two WGS84 points. */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Metres → a human distance label ("450 m" / "1.2 km"). */
export function distanceLabel(meters) {
  if (!Number.isFinite(meters)) return null;
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

// RATE-LIMIT GUARD: public Overpass instances rate-limit PER IP (~2 slots). A single
// brief fires several queries — stations, schools, amenities — and on a warm Vercel
// instance those would otherwise race into the same IP concurrently and trip 429s.
// We serialise them process-wide: one Overpass request at a time. Each is ~1–3s and
// they all run inside the ~22s SPARQL window anyway, so serialising costs no visible
// wall-clock while keeping us comfortably within Overpass's limits.
let overpassGate = Promise.resolve();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Small jittered pause between mirror attempts so a burst doesn't machine-gun the
// endpoints (which is exactly what trips the per-IP 429 limiter).
const jitter = (base) => base + Math.floor(Math.random() * base);

// ─────────────────────────────────────────────────────────────────────────────
// STATIONS (Unit 1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Station
 * @property {string} name
 * @property {string[]} modes  DEDUPED transport modes, e.g. ["Overground","National Rail"]
 * @property {string[]} lines  DEDUPED named lines where OSM records them, e.g. ["Mildmay line"]
 * @property {number} distanceMeters  straight-line from the validated coordinate
 * @property {number|null} walkMins   estimate at WALK_M_PER_MIN
 */

// OSM `network`/`operator` token → the mode label we present. Order matters only for
// readability; each station's modes are deduped afterwards.
const MODE_FROM_TOKEN = [
  [/underground|london underground|tfl|subway/i, "Underground"],
  [/elizabeth|crossrail/i, "Elizabeth line"],
  [/overground/i, "Overground"],
  [/\bdlr\b|docklands/i, "DLR"],
  [/tram|tramlink|metrolink|supertram/i, "Tram"],
  [/national rail|network rail|rail/i, "National Rail"],
];

/** Case-insensitive de-duplication that preserves first-seen order and casing. */
function dedupe(values) {
  const seen = new Set();
  const out = [];
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
  return out;
}

/** Split an OSM multi-value tag ("National Rail;London Overground") into tokens. */
function splitTag(value) {
  return String(value || "")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Derive DEDUPED modes for one station element from its OSM tags. This is the fix
 * for the old "London Overground London Overground" doubling: the previous code
 * concatenated `network` + `operator` (which are frequently identical) with no
 * de-duplication. Here every source tag is tokenised, mapped to a canonical mode,
 * and deduped.
 * @param {Object} tags
 * @param {string} railway  the `railway` tag value
 * @returns {string[]}
 */
function deriveModes(tags, railway) {
  if (railway === "tram_stop") return ["Tram"];
  if (tags.amenity === "bus_station") return ["Bus"];

  const tokens = [
    ...splitTag(tags.network),
    ...splitTag(tags.operator),
  ];
  const modes = [];
  for (const token of tokens) {
    const hit = MODE_FROM_TOKEN.find(([re]) => re.test(token));
    if (hit) modes.push(hit[1]);
  }
  if (tags.subway === "yes" || tags.station === "subway") modes.push("Underground");
  if (tags.light_rail === "yes") modes.push("DLR");
  // railway=halt and any station with no recognisable network is treated as National
  // Rail — the default for a heavy-rail stop in GB OSM data.
  if (modes.length === 0) modes.push("National Rail");
  return dedupe(modes);
}

/** Named lines OSM records for a station (e.g. the 2024 Overground line names). */
function deriveLines(tags) {
  return dedupe([...splitTag(tags.line), ...splitTag(tags.route_ref)])
    // Drop pure network echoes ("London Overground") that aren't a line name.
    .filter((l) => l.length > 1 && l.length < 40)
    .slice(0, 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PARSERS — parseStations / parseSchools / parseAmenities. EXPORTED so the
// LOCAL POI drop-in (lib/brief/poi-source.js) can feed them OSM-shaped {tags, lat, lon}
// rows from the Supabase `poi` table, keeping ALL classification (deriveModes,
// deriveLines, derivePhase, isSpecialist, SHOP/FOOD/HEALTH/LEISURE_LABELS, dedupe +
// nearest-N cap) in THIS file alone — the drop-in adds NO derive logic of its own.
//
// SELECTOR DRIFT WARNING: the raw tag keys these parsers read, and the category
// selectors above, are mirrored in the POI loader ~/Documents/osm-poi/load-poi.mjs,
// which projects those exact keys into poi.tags at load time. If you change a selector
// or a tag key read here, update that loader's REDUCED_TAG_KEYS + classify() and RE-RUN
// it, or the local POI path (poi-source.js) will silently diverge from this Overpass one.
// ─────────────────────────────────────────────────────────────────────────────

/** Parse station elements → shaped, deduped, nearest-first station list (≤6). Shared by
 *  fetchStations, the combined bundle, and the local POI drop-in — all byte-identical. */
export function parseStations(elements, lat, lng) {
  const raw = [];
  for (const el of elements) {
    const tags = el.tags || {};
    // Only rail/tram/bus-station elements are stations; ignore everything else in a
    // combined element set.
    const isStation = /^(station|halt|tram_stop)$/.test(String(tags.railway || "")) || tags.amenity === "bus_station";
    if (!isStation) continue;
    const name = tags.name || tags["name:en"];
    if (!name || !Number.isFinite(el.lat) || !Number.isFinite(el.lon)) continue;
    const railway = String(tags.railway || "");
    const dist = haversineMeters(lat, lng, el.lat, el.lon);
    raw.push({
      name: String(name).trim(),
      modes: deriveModes(tags, railway),
      lines: deriveLines(tags),
      distanceMeters: dist,
      walkMins: walkMinutes(dist),
    });
  }
  const byName = new Map();
  for (const s of raw) {
    const key = s.name.toLowerCase();
    const prev = byName.get(key);
    if (!prev || prev.distanceMeters > s.distanceMeters) byName.set(key, s);
  }
  return [...byName.values()].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 6);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHOOLS (Unit 3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} School
 * @property {string} name
 * @property {string} phase           "Nursery"|"Primary"|"Secondary"|"College / sixth form"|"School"
 * @property {boolean} specialist     true if OSM signals a special / SEND school
 * @property {number} distanceMeters
 * @property {number|null} walkMins
 * @property {string} ofstedUrl       official Ofsted report search for this school
 */

// Official Ofsted reports search — the ONLY rating source we point at (no ratings are
// asserted in-brief; there is no keyless per-school Ofsted API — the old GIAS host is
// gone). A name search lets the user read the real, current inspection outcome.
function ofstedSearchUrl(name) {
  return `https://reports.ofsted.gov.uk/search?q=${encodeURIComponent(name)}`;
}

/** Phase from ISCED level + amenity + name heuristics (never a rating). */
function derivePhase(tags) {
  if (tags.amenity === "kindergarten") return "Nursery";
  if (tags.amenity === "college") return "College / sixth form";
  const isced = String(tags["isced:level"] || "");
  const levels = isced.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  const has = (l) => levels.includes(l);
  if (has("4") || has("5")) return "College / sixth form";
  if (has("2") || has("3")) return "Secondary";
  if (has("1")) return "Primary";
  if (levels.length && levels.every((l) => l === "0")) return "Nursery";
  // Fall back to name heuristics when ISCED is absent.
  const n = String(tags.name || "").toLowerCase();
  if (/\b(sixth form|college)\b/.test(n)) return "College / sixth form";
  if (/\b(secondary|high school|academy|grammar)\b/.test(n)) return "Secondary";
  if (/\b(primary|junior|infant|prep(aratory)?)\b/.test(n)) return "Primary";
  if (/\b(nursery|pre-?school|montessori|kindergarten)\b/.test(n)) return "Nursery";
  return "School";
}

/** Does OSM signal a special / SEND school? (The "Frank Barnes" lesson — specialist
 *  schools must be identified as such, never listed as a generic under-performer.) */
function isSpecialist(tags) {
  if (tags["school:for"] || tags.special_education || tags["school:SEN"]) return true;
  const n = String(tags.name || "").toLowerCase();
  return /\b(special|sen\b|send\b|additional needs|deaf|hearing impair|blind|visual impair|autis|pupil referral|learning disabilit)\b/.test(n);
}

/** Parse school elements → shaped, deduped, nearest-first school list (≤8). Shared
 *  (fetchSchools, bundle, local POI drop-in). See the SELECTOR DRIFT warning above. */
export function parseSchools(elements, lat, lng) {
  const raw = [];
  for (const el of elements) {
    const tags = el.tags || {};
    if (!/^(school|college|kindergarten)$/.test(String(tags.amenity || ""))) continue;
    const name = tags.name || tags["name:en"];
    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (!name || !Number.isFinite(elLat) || !Number.isFinite(elLng)) continue;
    const dist = haversineMeters(lat, lng, elLat, elLng);
    raw.push({
      name: String(name).trim(),
      phase: derivePhase(tags),
      specialist: isSpecialist(tags),
      distanceMeters: dist,
      walkMins: walkMinutes(dist),
      ofstedUrl: ofstedSearchUrl(String(name).trim()),
    });
  }
  const byName = new Map();
  for (const s of raw) {
    const key = s.name.toLowerCase();
    const prev = byName.get(key);
    if (!prev || prev.distanceMeters > s.distanceMeters) byName.set(key, s);
  }
  return [...byName.values()].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// AMENITIES (Unit 4) — supermarkets, cafés/restaurants, GPs/health
// ─────────────────────────────────────────────────────────────────────────────

// shop / amenity value → the label we show. Only tags in these maps are collected.
const SHOP_LABELS = {
  supermarket: "Supermarket",
  convenience: "Convenience store",
  greengrocer: "Greengrocer",
  bakery: "Bakery",
  butcher: "Butcher",
  deli: "Deli",
  health_food: "Health food",
  department_store: "Department store",
};
const FOOD_LABELS = { cafe: "Café", restaurant: "Restaurant", fast_food: "Fast food" };
const HEALTH_LABELS = { doctors: "GP surgery", pharmacy: "Pharmacy", hospital: "Hospital", clinic: "Clinic" };
const LEISURE_LABELS = { park: "Park", garden: "Garden", nature_reserve: "Nature reserve", recreation_ground: "Recreation ground", common: "Common" };

/** Sort by distance, cap, and shape a group's items. */
function shapeGroup(items, cap) {
  const sorted = items.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return { total: sorted.length, items: sorted.slice(0, cap) };
}

/**
 * @typedef {Object} AmenityItem
 * @property {string} name
 * @property {string} type
 * @property {number} distanceMeters
 * @property {number|null} walkMins
 */

/** Parse amenity elements → the four shaped groups. Shared by fetchAmenities, the
 *  combined bundle, and the local POI drop-in. Only shop/food/health/leisure-tagged
 *  elements are collected, so it runs unchanged over a combined element set
 *  (stations/schools are simply ignored). See the SELECTOR DRIFT warning above. */
export function parseAmenities(elements, lat, lng) {
  const supermarkets = [];
  const food = [];
  const health = [];
  const parks = [];
  const seenParks = new Set();
  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name || tags["name:en"];
    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (!name || !Number.isFinite(elLat) || !Number.isFinite(elLng)) continue;
    const dist = haversineMeters(lat, lng, elLat, elLng);
    const item = { name: String(name).trim(), distanceMeters: dist, walkMins: walkMinutes(dist) };
    if (tags.shop && SHOP_LABELS[tags.shop]) supermarkets.push({ ...item, type: SHOP_LABELS[tags.shop] });
    else if (tags.amenity && FOOD_LABELS[tags.amenity]) food.push({ ...item, type: FOOD_LABELS[tags.amenity] });
    else if (tags.amenity && HEALTH_LABELS[tags.amenity]) health.push({ ...item, type: HEALTH_LABELS[tags.amenity] });
    else if (tags.leisure && LEISURE_LABELS[tags.leisure]) {
      const key = item.name.toLowerCase();
      if (seenParks.has(key)) continue;
      seenParks.add(key);
      parks.push({ ...item, type: LEISURE_LABELS[tags.leisure] });
    }
  }
  return {
    supermarkets: shapeGroup(supermarkets, 6),
    food: shapeGroup(food, 6),
    health: shapeGroup(health, 5),
    parks: shapeGroup(parks, 6),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED BUNDLE — stations + schools + amenities in ONE Overpass query (3× fewer
// calls per brief, the big rate-limit lever). Returns the SAME three sub-result shapes
// the individual fetchers do, so the section builders and the source cache are unchanged.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One Overpass query covering every element the three separate fetchers used (same
 * selectors + radii), parsed with the SAME shared parsers → byte-identical outputs.
 * @param {{lat:number,lng:number}} location
 * @param {{ signal?:AbortSignal, timeoutMs?:number, radiusM?:number }} [opts]
 * @returns {Promise<{ ok:boolean, stations:{ok:boolean,stations:Array}, schools:{ok:boolean,schools:Array}, amenities:{ok:boolean,groups:Object} }>}
 */
/** The bundle's failure shape (all three sub-results ok:false). Exported so callers can
 *  short-circuit — e.g. the circuit breaker — WITHOUT a network call, returning exactly
 *  what a real failure would, so the section builders render the honest insufficient state. */
export function overpassFailShape() {
  const emptyAmen = { supermarkets: { total: 0, items: [] }, food: { total: 0, items: [] }, health: { total: 0, items: [] }, parks: { total: 0, items: [] } };
  return {
    ok: false,
    stations: { ok: false, stations: [] },
    schools: { ok: false, schools: [] },
    amenities: { ok: false, groups: emptyAmen },
  };
}

