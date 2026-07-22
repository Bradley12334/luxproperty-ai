/**
 * lib/brief/commute.js
 * ─────────────────────────────────────────────────────────────────────────────
 * REGION-ADAPTIVE COMMUTE TARGETING — turns a validated location into the right
 * commute destination(s) for its part of the country, so a Cornwall brief never
 * quotes a Canary Wharf time (BRIEF_SPEC → "commute destinations adapt to region").
 *
 * SELECTION MODEL (agreed in Phase 2d): a curated list of major UK employment
 * centres with coordinates; the headline destination is the NEAREST centre by
 * straight-line distance. London postcodes always resolve to Central London (and,
 * for the PRO calculator, the London destination set powered by live TfL times).
 * This is structural — there is no region→city lookup table to get wrong at the
 * edges; distance decides.
 *
 * DEPTH:
 *   - Unit 1 (EXP): buildSimpleCommute() → ONE honest headline note.
 *   - Unit 2 (PRO): selectCommuteTargets() → the multi-destination set the full
 *     calculator resolves (TfL for London; labelled straight-line estimates
 *     elsewhere). This module only PICKS targets and frames distance; it does no
 *     network itself.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { haversineMeters } from "./overpass.js";

/**
 * Major UK employment / travel centres. Coordinates are the principal city-centre
 * rail hub (the natural commute anchor). Deliberately broad so every English & Welsh
 * region has a genuinely-near centre; London is represented by its financial core.
 * @type {{ name:string, lat:number, lng:number, london?:boolean }[]}
 */
export const CENTRES = [
  { name: "Central London", lat: 51.5155, lng: -0.0922, london: true }, // City / Bank
  { name: "Birmingham", lat: 52.4778, lng: -1.8987 },       // New Street
  { name: "Manchester", lat: 53.4775, lng: -2.2311 },       // Piccadilly
  { name: "Leeds", lat: 53.7947, lng: -1.5477 },
  { name: "Liverpool", lat: 53.4055, lng: -2.9779 },        // Lime Street
  { name: "Sheffield", lat: 53.3782, lng: -1.4620 },
  { name: "Newcastle", lat: 54.9686, lng: -1.6174 },        // Central
  { name: "Bristol", lat: 51.4490, lng: -2.5810 },          // Temple Meads
  { name: "Nottingham", lat: 52.9470, lng: -1.1462 },
  { name: "Leicester", lat: 52.6312, lng: -1.1250 },
  { name: "Cardiff", lat: 51.4759, lng: -3.1791 },          // Central
  { name: "Swansea", lat: 51.6255, lng: -3.9410 },
  { name: "Reading", lat: 51.4585, lng: -0.9720 },
  { name: "Brighton", lat: 50.8290, lng: -0.1410 },
  { name: "Southampton", lat: 50.9077, lng: -1.4130 },      // Central
  { name: "Portsmouth", lat: 50.7980, lng: -1.0920 },       // & Southsea
  { name: "Cambridge", lat: 52.1943, lng: 0.1372 },
  { name: "Oxford", lat: 51.7534, lng: -1.2700 },
  { name: "Norwich", lat: 52.6270, lng: 1.3060 },
  { name: "Plymouth", lat: 50.3770, lng: -4.1430 },
  { name: "Exeter", lat: 50.7290, lng: -3.5435 },           // St Davids
  { name: "Derby", lat: 52.9160, lng: -1.4630 },
  { name: "Coventry", lat: 52.4008, lng: -1.5130 },
  { name: "York", lat: 53.9580, lng: -1.0930 },
  { name: "Preston", lat: 53.7560, lng: -2.7080 },
  { name: "Hull", lat: 53.7443, lng: -0.3450 },             // Paragon
  { name: "Middlesbrough", lat: 54.5760, lng: -1.2350 },
  { name: "Peterborough", lat: 52.5745, lng: -0.2500 },
  { name: "Ipswich", lat: 52.0500, lng: 1.1450 },
];

/**
 * The London destination set for the PRO full commute calculator (live TfL times).
 * The four anchors most London commuters travel to.
 * @type {{name:string,lat:number,lng:number}[]}
 */
export const LONDON_DESTINATIONS = [
  { name: "City of London (Bank)", lat: 51.5133, lng: -0.0886 },
  { name: "West End (Oxford Circus)", lat: 51.5152, lng: -0.1418 },
  { name: "Canary Wharf", lat: 51.5054, lng: -0.0235 },
  { name: "King's Cross", lat: 51.5308, lng: -0.1238 },
];

// A loose Greater London bounding box: any coordinate inside it is treated as a
// London postcode (TfL-eligible, headline = Central London) even when Postcodes.io's
// `region` string is imprecise at the fringe.
const GREATER_LONDON = { minLat: 51.28, maxLat: 51.70, minLng: -0.53, maxLng: 0.30 };

/** Is this location within Greater London (region string OR bounding box)? */
export function isLondon(location) {
  if (location?.region === "London") return true;
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= GREATER_LONDON.minLat && lat <= GREATER_LONDON.maxLat &&
    lng >= GREATER_LONDON.minLng && lng <= GREATER_LONDON.maxLng
  );
}

/** km label from metres, one decimal under 100 km. */
export function kmLabel(meters) {
  if (!Number.isFinite(meters)) return null;
  const km = meters / 1000;
  return km < 100 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/**
 * The nearest centre to a location by straight-line distance. For a London location
 * this is Central London by construction (it sits inside the city). Returns the
 * centre plus the straight-line distance in metres.
 * @param {{lat:number,lng:number}} location
 * @returns {{ centre:{name:string,lat:number,lng:number,london?:boolean}, distanceMeters:number }}
 */
export function nearestCentre(location) {
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  let best = null;
  let bestDist = Infinity;
  for (const c of CENTRES) {
    const d = haversineMeters(lat, lng, c.lat, c.lng);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return { centre: best, distanceMeters: bestDist };
}

/**
 * The N nearest centres to a location, excluding the location's own immediate city
 * (anything within `minM` — a "0 km to where you already are" row is not a commute).
 * @param {{lat:number,lng:number}} location
 * @param {number} n
 * @param {number} [minM]
 * @returns {{ name:string, lat:number, lng:number, distanceMeters:number }[]}
 */
export function nearestCentres(location, n, minM = 3000) {
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  return CENTRES.map((c) => ({ ...c, distanceMeters: haversineMeters(lat, lng, c.lat, c.lng) }))
    .filter((c) => c.distanceMeters >= minM)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, n);
}

/**
 * The destination set + method for the PRO full commute calculator.
 *   - London  → live TfL door-to-door times to the four London anchors.
 *   - elsewhere → the nearest major centres, resolved as clearly-labelled
 *     straight-line estimates (no keyless national journey API exists).
 * @param {import("./resolve.js").ResolvedLocation} location
 * @returns {{ method:"tfl"|"estimate", destinations:{name:string,lat:number,lng:number,distanceMeters?:number}[] }}
 */
export function selectCommuteTargets(location) {
  if (isLondon(location)) {
    return { method: "tfl", destinations: LONDON_DESTINATIONS };
  }
  return { method: "estimate", destinations: nearestCentres(location, 4) };
}

/**
 * The EXP "simple commute note": one honest headline destination + a straight-line
 * distance, explicitly labelled as straight-line (not a routed journey time). London
 * gets Central London; elsewhere the nearest major centre.
 *
 * @param {import("./resolve.js").ResolvedLocation} location
 * @returns {{ destination:string, distanceMeters:number, distanceLabel:string, london:boolean, text:string }}
 */
export function buildSimpleCommute(location) {
  const london = isLondon(location);
  // In London the headline is always Central London; the nearestCentre() call
  // returns it anyway, but pin it explicitly so a fringe London coordinate whose
  // nearest listed centre happened to be, say, Reading still reads "Central London".
  const { centre, distanceMeters } = london
    ? { centre: CENTRES[0], distanceMeters: haversineMeters(location.lat, location.lng, CENTRES[0].lat, CENTRES[0].lng) }
    : nearestCentre(location);

  const dLabel = kmLabel(distanceMeters);
  const fromWhere = location.outcodeOnly
    ? `the ${location.outcode} district centre`
    : location.postcode;

  let text;
  if (london) {
    text =
      `${fromWhere} is a London postcode — the natural commute anchor is Central London ` +
      `(the City / West End), about ${dLabel} away in a straight line. Journey times depend on ` +
      `your nearest station and line; the stations listed above are the practical starting point.`;
  } else {
    text =
      `The nearest major employment centre is ${centre.name}, about ${dLabel} away in a straight line ` +
      `from ${fromWhere}. Actual travel time depends on road and rail connections — check National Rail ` +
      `or a mapping app for door-to-door times.`;
  }

  return {
    destination: centre.name,
    distanceMeters,
    distanceLabel: dLabel,
    london,
    text,
  };
}
