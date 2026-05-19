import type { BriefReport, AreaIntelligence, PropertyDeepDive } from "../../../shared/schema";
import { enrichmentProfiles } from "./enrichment_data";
import { incrementBriefUsage } from "../hooks/use-brief-usage";

let briefIdCounter = 1;
const briefStore: Record<number, BriefReport> = {};

function detectQueryType(query: string): "postcode" | "address" {
  const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  const partialPostcode = /^[A-Z]{1,2}\d[A-Z\d]?$/i;
  const trimmed = query.trim();
  if (postcodePattern.test(trimmed) || partialPostcode.test(trimmed)) return "postcode";
  return "address";
}

function extractPostcode(address: string): string | null {
  const match = address.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i);
  return match ? match[1].trim().toUpperCase() : null;
}

function getOutcode(postcode: string): string {
  return postcode.trim().toUpperCase().split(" ")[0].replace(/\d[A-Z]{2}$/, "").trim();
}

function fmt(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  } catch { return dateStr; }
}

// ─── District name fixes ──────────────────────────────────────────────────────
// Postcodes.io sometimes returns district names that don't match Land Registry
const districtNormalise: Record<string, string> = {
  "WESTMINSTER":                   "CITY OF WESTMINSTER",
  "BRISTOL, CITY OF":              "BRISTOL",
  "KINGSTON UPON HULL, CITY OF":   "KINGSTON UPON HULL",
  "HEREFORDSHIRE, COUNTY OF":      "HEREFORDSHIRE",
  "DURHAM":                        "COUNTY DURHAM",
};

// Manual overrides where one outcode spans multiple boroughs
const outcodeDistrictOverride: Record<string, string> = {
  "NW3": "CAMDEN", "NW1": "CAMDEN", "NW5": "CAMDEN", "NW6": "CAMDEN",
  "NW8": "CITY OF WESTMINSTER",
  "SW1": "CITY OF WESTMINSTER",
  "W1":  "CITY OF WESTMINSTER",
  "WC1": "CAMDEN", "WC2": "CITY OF WESTMINSTER",
  "EC1": "ISLINGTON", "EC2": "CITY OF LONDON", "EC3": "CITY OF LONDON", "EC4": "CITY OF LONDON",
};

// Land Registry only covers England & Wales — these prefixes are Scotland or NI
const nonEnglandWalesPrefixes = ["EH","G","AB","DD","KY","FK","PH","HS","IV","KA","KW","ML","PA","TD","ZE","BT"];
function isOutsideEnglandWales(outcode: string): boolean {
  return nonEnglandWalesPrefixes.some(p => outcode.startsWith(p));
}

// ─── Caches ───────────────────────────────────────────────────────────────────
const outcodeDistrictCache: Record<string, string> = {};
const outcodeMetaCache: Record<string, any> = {};

// ─── Postcodes.io: get district name ─────────────────────────────────────────
async function getDistrict(postcode: string): Promise<string> {
  const outcode = getOutcode(postcode);
  if (outcodeDistrictCache[outcode]) return outcodeDistrictCache[outcode];
  if (outcodeDistrictOverride[outcode]) {
    outcodeDistrictCache[outcode] = outcodeDistrictOverride[outcode];
    return outcodeDistrictOverride[outcode];
  }
  try {
    const res = await fetch(`https://api.postcodes.io/outcodes/${outcode}`);
    if (res.ok) {
      const d = await res.json();
      const districts: string[] = d?.result?.admin_district || [];
      if (districts.length > 0) {
        let district = districts[0].toUpperCase();
        district = districtNormalise[district] || district;
        outcodeDistrictCache[outcode] = district;
        return district;
      }
    }
  } catch {}
  return "";
}

// ─── Postcodes.io: get full metadata ─────────────────────────────────────────
async function fetchPostcodeMeta(postcode: string): Promise<{
  area: string; district: string; region: string;
  constituency: string; ward: string; country: string;
  lat?: number; lng?: number;
} | null> {
  const outcode = getOutcode(postcode);
  if (outcodeMetaCache[outcode]) return outcodeMetaCache[outcode];
  try {
    const clean = postcode.trim().replace(/\s+/g, "");
    const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);
    if (res.ok) {
      const d = await res.json();
      const result = {
        area: d.result?.outcode || outcode,
        district: d.result?.admin_district || "",
        region: d.result?.region || "England",
        constituency: d.result?.parliamentary_constituency || "",
        ward: d.result?.admin_ward || "",
        country: d.result?.country || "England",
        lat: d.result?.latitude ?? undefined,
        lng: d.result?.longitude ?? undefined,
      };
      outcodeMetaCache[outcode] = result;
      return result;
    }
    // Fall back to outcode lookup
    const res2 = await fetch(`https://api.postcodes.io/outcodes/${outcode}`);
    if (res2.ok) {
      const d = await res2.json();
      const result = {
        area: outcode,
        district: (d.result?.admin_district || [])[0] || "",
        region: (d.result?.admin_county || [])[0] || (d.result?.country || [])[0] || "England",
        constituency: (d.result?.parliamentary_constituency || [])[0] || "",
        ward: (d.result?.admin_ward || [])[0] || "",
        country: (d.result?.country || [])[0] || "England",
        lat: d.result?.latitude ?? undefined,
        lng: d.result?.longitude ?? undefined,
      };
      outcodeMetaCache[outcode] = result;
      return result;
    }
  } catch {}
  return null;
}

// ─── Land Registry: prices for a district + year ─────────────────────────────
async function fetchLandRegistryYear(district: string, year: number): Promise<number[]> {
  if (!district) return [];
  try {
    const url = `https://landregistry.data.gov.uk/data/ppi/transaction-record.json?_pageSize=100&propertyAddress.district=${encodeURIComponent(district)}&min-transactionDate=${year}-01-01&max-transactionDate=${year}-12-31&_sort=-transactionDate`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.result?.items || [];
    return items.map((item: any) => item.pricePaid as number).filter((p: number) => p > 0);
  } catch { return []; }
}

// ─── Land Registry: recent transactions for comparables ──────────────────────
async function fetchRecentTransactions(district: string, outcode: string): Promise<Array<{
  address: string; price: number; date: string; type: string;
}>> {
  if (!district) return [];
  try {
    const url = `https://landregistry.data.gov.uk/data/ppi/transaction-record.json?_pageSize=50&propertyAddress.district=${encodeURIComponent(district)}&_sort=-transactionDate`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.result?.items || [];

    const filtered = items.filter((item: any) =>
      (item?.propertyAddress?.postcode || "").startsWith(outcode)
    );
    const used = filtered.length >= 3 ? filtered : items;

    return used.slice(0, 6).map((item: any) => {
      const addr = item.propertyAddress || {};
      const parts = [addr.saon, addr.paon, addr.street, addr.town].filter(Boolean);
      const propType = item.propertyType?.prefLabel?.[0]?._value || "Property";
      return {
        address: parts.join(", ") || "Address withheld",
        price: item.pricePaid,
        date: item.transactionDate || "",
        type: propType.charAt(0).toUpperCase() + propType.slice(1).toLowerCase(),
      };
    });
  } catch { return []; }
}


// ─── Live Flood Risk (Environment Agency) ────────────────────────────────────
async function fetchFloodRisk(lat: number, lng: number): Promise<{
  zone: string; surfaceWater: string; riskBadge: "Low" | "Medium" | "High" | "Very High"; detail: string;
} | null> {
  try {
    const url = `https://environment.data.gov.uk/flood-monitoring/id/floodAreas?lat=${lat}&long=${lng}&dist=1.5`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const areas: any[] = data?.items || [];
    const count = areas.length;

    // Also check for active warnings
    const warnUrl = `https://environment.data.gov.uk/flood-monitoring/id/floods?lat=${lat}&long=${lng}&dist=2`;
    const warnRes = await fetch(warnUrl);
    const warnData = warnRes.ok ? await warnRes.json() : { items: [] };
    const activeWarnings: any[] = warnData?.items || [];
    const hasActiveWarning = activeWarnings.some((w: any) => w.severityLevel <= 2);
    const hasSevereWarning = activeWarnings.some((w: any) => w.severityLevel === 1);

    let zone: string;
    let riskBadge: "Low" | "Medium" | "High" | "Very High";
    let surfaceWater: string;

    if (hasSevereWarning) {
      zone = "Flood Warning Area (Active)";
      riskBadge = "Very High";
      surfaceWater = "High";
    } else if (hasActiveWarning) {
      zone = "Flood Alert Area (Active)";
      riskBadge = "High";
      surfaceWater = "High";
    } else if (count >= 4) {
      zone = "Zone 3 (High Probability)";
      riskBadge = "High";
      surfaceWater = "Medium";
    } else if (count >= 2) {
      zone = "Zone 2 (Medium Probability)";
      riskBadge = "Medium";
      surfaceWater = "Low";
    } else if (count === 1) {
      zone = "Zone 2 (Low-Medium)";
      riskBadge = "Low";
      surfaceWater = "Low";
    } else {
      zone = "Zone 1 (Low Probability)";
      riskBadge = "Low";
      surfaceWater = "Low";
    }

    const riverNames = [...new Set(areas.slice(0, 3).map((a: any) => a.riverOrSea).filter(Boolean))];
    const detail = count > 0
      ? `${count} Environment Agency flood area${count > 1 ? "s" : ""} identified within 1.5km. ${riverNames.length > 0 ? `Watercourses: ${riverNames.join(", ")}.` : ""} ${hasActiveWarning ? "Active flood alert in effect — check gov.uk/check-flood-risk." : "No active warnings at time of report. Always verify at flood-map-for-planning.service.gov.uk."}`
      : `No Environment Agency flood areas identified within 1.5km. Low flood probability at area level — verify at flood-map-for-planning.service.gov.uk for property-specific risk.`;

    return { zone, surfaceWater, riskBadge, detail };
  } catch { return null; }
}

// ─── Live Sold Prices with Geocoding (Land Registry + postcodes.io) ───────────
async function fetchSoldPricesWithCoords(district: string, outcode: string): Promise<Array<{
  address: string; price: string; date: string; type: string; lat: number; lng: number;
}>> {
  if (!district) return [];
  try {
    const url = `https://landregistry.data.gov.uk/data/ppi/transaction-record.json?_pageSize=50&propertyAddress.district=${encodeURIComponent(district)}&_sort=-transactionDate`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.result?.items || [];

    const filtered = items.filter((item: any) =>
      (item?.propertyAddress?.postcode || "").startsWith(outcode)
    );
    const used = (filtered.length >= 4 ? filtered : items).slice(0, 12);

    // Collect unique postcodes for batch geocoding
    const postcodes = [...new Set(used.map((item: any) => item?.propertyAddress?.postcode).filter(Boolean))] as string[];

    let coordsMap: Record<string, { lat: number; lng: number }> = {};
    if (postcodes.length > 0) {
      try {
        const geoRes = await fetch("https://api.postcodes.io/postcodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postcodes: postcodes.slice(0, 100) }),
        });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          for (const r of geoData?.result || []) {
            if (r?.result?.latitude && r?.result?.longitude) {
              // Jitter slightly so pins don't stack perfectly on same postcode
              coordsMap[r.query] = {
                lat: r.result.latitude + (Math.random() - 0.5) * 0.002,
                lng: r.result.longitude + (Math.random() - 0.5) * 0.002,
              };
            }
          }
        }
      } catch {}
    }

    const fmt2 = (n: number) => "£" + n.toLocaleString("en-GB");
    const fmtDate = (d: string) => {
      if (!d) return "";
      const dt = new Date(d);
      return dt.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    };

    const results: Array<{ address: string; price: string; date: string; type: string; lat: number; lng: number }> = [];
    for (const item of used) {
      const addr = item.propertyAddress || {};
      const pc = addr.postcode || "";
      const coords = coordsMap[pc];
      if (!coords) continue; // skip if no coords — map pins need lat/lng
      const parts = [addr.saon, addr.paon, addr.street].filter(Boolean);
      const propType = item.propertyType?.prefLabel?.[0]?._value || "Property";
      results.push({
        address: parts.join(", ") || pc || "Address withheld",
        price: fmt2(item.pricePaid),
        date: fmtDate(item.transactionDate || ""),
        type: propType.charAt(0).toUpperCase() + propType.slice(1).toLowerCase(),
        lat: coords.lat,
        lng: coords.lng,
      });
    }
    return results;
  } catch { return []; }
}


// ─── Live EPC Data (via /api/epc serverless proxy) ───────────────────────────
async function fetchEpcData(outcode: string): Promise<{
  mostCommonRating: string;
  avgEfficiencyScore: number | null;
  pctRatedCOrAbove: number | null;
  mostCommonPropertyType: string;
  mostCommonConstructionEra: string;
  totalRecords: number;
} | null> {
  try {
    const res = await fetch(`/api/epc?postcode=${encodeURIComponent(outcode)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.totalRecords || data.totalRecords === 0) return null;
    return {
      mostCommonRating: data.mostCommonRating || "D",
      avgEfficiencyScore: data.avgEfficiencyScore ?? null,
      pctRatedCOrAbove: data.pctRatedCOrAbove ?? null,
      mostCommonPropertyType: data.mostCommonPropertyType || "Flat",
      mostCommonConstructionEra: data.mostCommonConstructionEra || "",
      totalRecords: data.totalRecords,
    };
  } catch { return null; }
}


// ─── Live Air Quality (DEFRA ERG via /api/air-quality) ───────────────────────
async function fetchAirQuality(lat: number, lng: number): Promise<{
  siteName: string; localAuthority: string; no2Level: string; pm25Level: string;
  rating: "Good" | "Moderate" | "High" | "Very High"; maxIndex: number;
} | null> {
  try {
    const res = await fetch(`/api/air-quality?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return {
      siteName: data.siteName,
      localAuthority: data.localAuthority,
      no2Level: data.no2Level,
      pm25Level: data.pm25Level,
      rating: data.rating as "Good" | "Moderate" | "High" | "Very High",
      maxIndex: data.maxIndex,
    };
  } catch { return null; }
}

// ─── Live TfL Commute Times (via /api/tfl-commute) ───────────────────────────
async function fetchTflCommute(lat: number, lng: number): Promise<Array<{
  destination: string; durationMins: number; modes: string[];
}> | null> {
  try {
    const res = await fetch(`/api/tfl-commute?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !data.results?.length) return null;
    return data.results;
  } catch { return null; }
}


// ─── Live TfL Stations (via TfL StopPoint API) ───────────────────────────────
function distMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function overpassQuery(query: string): Promise<any[] | null> {
  const ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.elements) return data.elements;
    } catch { continue; }
  }
  return null;
}

async function fetchNearbyStations(lat: number, lng: number): Promise<Array<{
  name: string; lines: string[]; modes: string[]; distanceMetres: number; walkMins: number; lat?: number; lng?: number;
}>> {
  try {
    const query = `[out:json][timeout:15];(
  node["railway"~"station|halt"](around:1500,${lat},${lng});
  node["railway"="tram_stop"](around:1000,${lat},${lng});
  node["amenity"="bus_station"](around:800,${lat},${lng});
);out body 30;`;
    const elements = await overpassQuery(query);
    if (!elements) return [];

    const stations: Array<{ name: string; lines: string[]; modes: string[]; distanceMetres: number; walkMins: number; lat: number; lng: number }> = [];
    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags["name:en"];
      if (!name || !el.lat || !el.lon) continue;
      const dist = distMetres(lat, lng, el.lat, el.lon);
      const railway = tags.railway || "";
      const network = (tags.network || "").toLowerCase();
      const modes: string[] = [];
      if (railway === "station") {
        if (network.includes("london underground") || network.includes("tfl") || tags.subway === "yes") modes.push("tube");
        else if (network.includes("elizabeth") || (tags.name || "").toLowerCase().includes("crossrail")) modes.push("elizabeth-line");
        else if (network.includes("overground")) modes.push("overground");
        else if (network.includes("dlr")) modes.push("dlr");
        else modes.push("national-rail");
      } else if (railway === "halt") modes.push("national-rail");
      else if (railway === "tram_stop") modes.push("tram");
      else if (tags.amenity === "bus_station") modes.push("bus");
      if (modes.length === 0) continue;
      const lineRefs = [tags.network || "", tags.operator || "", tags.route_ref || "", tags.ref || ""].filter(Boolean);
      const lines = lineRefs.flatMap((r: string) => r.split(/[;,]/)).map((r: string) => r.trim()).filter((r: string) => r.length > 1 && r.length < 40).slice(0, 4);
      stations.push({ name: name.replace(/ (Railway )?Station$/, " Station"), lines, modes, distanceMetres: dist, walkMins: Math.ceil(dist / 80), lat: el.lat, lng: el.lon });
    }
    const seen = new Map<string, typeof stations[0]>();
    for (const s of stations) {
      const key = s.name.toLowerCase();
      if (!seen.has(key) || seen.get(key)!.distanceMetres > s.distanceMetres) seen.set(key, s);
    }
    return [...seen.values()].sort((a, b) => a.distanceMetres - b.distanceMetres).slice(0, 8);
  } catch { return []; }
}

// ─── Live Planning Activity ───────────────────────────────────────────────────
async function fetchPlanningActivity(postcode: string, lat: number, lng: number, district: string): Promise<{
  recentApplications: number;
  majorDevelopments: string;
  developments: Array<{ name: string; type: string; status: string; impact: "Positive" | "Neutral" | "Monitor"; detail: string }>;
  councilPortalUrl: string;
  note: string;
} | null> {
  try {
    const res = await fetch(`/api/planning-activity?postcode=${encodeURIComponent(postcode)}&lat=${lat}&lng=${lng}&district=${encodeURIComponent(district)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ─── Live Nearby Schools (direct Overpass, client-side) ──────────────────────
function classifySchoolType(tags: Record<string, string>): string {
  const type = (tags["school:type"] || tags["operator:type"] || "").toLowerCase();
  const name = (tags.name || "").toLowerCase();
  if (type.includes("independent") || type.includes("private")) return "Independent";
  if (name.includes("primary") || name.includes("junior") || name.includes("infant") || name.includes("prep")) return "Primary";
  if (name.includes("secondary") || name.includes("academy") || name.includes("high") || name.includes("college") || name.includes("sixth form")) return "Secondary";
  if (name.includes("nursery") || name.includes("montessori")) return "Nursery";
  return "School";
}

async function fetchNearbySchools(lat: number, lng: number): Promise<Array<{
  name: string; type: string; ofstedRating: string; distanceMetres: number; walkMins: number; lat?: number; lng?: number;
}>> {
  try {
    const query = `[out:json][timeout:15];(
  node["amenity"="school"](around:1500,${lat},${lng});
  way["amenity"="school"](around:1500,${lat},${lng});
  node["amenity"="kindergarten"](around:1000,${lat},${lng});
  way["amenity"="kindergarten"](around:1000,${lat},${lng});
);out body center 25;`;
    const elements = await overpassQuery(query);
    if (!elements) return [];
    const schools: Array<{ name: string; type: string; ofstedRating: string; distanceMetres: number; walkMins: number; lat: number; lng: number }> = [];
    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name;
      if (!name) continue;
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) continue;
      const dist = distMetres(lat, lng, elLat, elLng);
      const type = tags.amenity === "kindergarten" ? "Nursery" : classifySchoolType(tags);
      const ofstedRating = tags["ofsted:rating"] || "Not rated";
      schools.push({ name, type, ofstedRating, distanceMetres: dist, walkMins: Math.ceil(dist / 80), lat: elLat, lng: elLng });
    }
    return schools.sort((a, b) => a.distanceMetres - b.distanceMetres).slice(0, 8);
  } catch { return []; }
}

// ─── Live Nearby Amenities (direct Overpass, client-side) ─────────────────────
async function fetchNearbyAmenities(lat: number, lng: number): Promise<{
  supermarkets: Array<{ name: string; type: string; distanceMetres: number; lat?: number; lng?: number }>;
  cafesAndRestaurants: Array<{ name: string; type: string; distanceMetres: number; lat?: number; lng?: number }>;
  health: Array<{ name: string; type: string; distanceMetres: number; lat?: number; lng?: number }>;
  greenSpaces: Array<{ name: string; distanceMetres: number; walkMins: number; lat?: number; lng?: number }>;
} | null> {
  try {
    const query = `[out:json][timeout:20];(
  node["shop"~"supermarket|convenience|greengrocer|bakery|butcher|deli|health_food|department_store"](around:1200,${lat},${lng});
  node["amenity"~"cafe|restaurant|fast_food"](around:700,${lat},${lng});
  node["amenity"~"doctors|pharmacy|hospital|clinic"](around:1200,${lat},${lng});
  way["leisure"="park"]["name"](around:1500,${lat},${lng});
  relation["leisure"="park"]["name"](around:1500,${lat},${lng});
);out body center 80;`;
    const elements = await overpassQuery(query);
    if (!elements) return null;

    const supermarkets: Array<{ name: string; type: string; distanceMetres: number; lat: number; lng: number }> = [];
    const cafesAndRestaurants: Array<{ name: string; type: string; distanceMetres: number; lat: number; lng: number }> = [];
    const health: Array<{ name: string; type: string; distanceMetres: number; lat: number; lng: number }> = [];
    const greenSpaces: Array<{ name: string; distanceMetres: number; walkMins: number; lat: number; lng: number }> = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name;
      if (!name) continue;
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) continue;
      const dist = distMetres(lat, lng, elLat, elLng);
      const shopType = tags.shop;
      const amenity = tags.amenity;
      const leisure = tags.leisure;
      if (shopType && ["supermarket","convenience","greengrocer","bakery","butcher","deli","health_food","department_store"].includes(shopType)) {
        const typeLabel = shopType === "supermarket" ? "Supermarket" : shopType === "convenience" ? "Convenience store" : shopType === "bakery" ? "Bakery" : shopType === "butcher" ? "Butcher" : "Shop";
        if (supermarkets.length < 8) supermarkets.push({ name, type: typeLabel, distanceMetres: dist, lat: elLat, lng: elLng });
      } else if (amenity && ["cafe","restaurant","fast_food"].includes(amenity)) {
        const typeLabel = amenity === "cafe" ? "Café" : amenity === "restaurant" ? "Restaurant" : "Food";
        if (cafesAndRestaurants.length < 8) cafesAndRestaurants.push({ name, type: typeLabel, distanceMetres: dist, lat: elLat, lng: elLng });
      } else if (amenity && ["doctors","pharmacy","hospital","clinic"].includes(amenity)) {
        const typeLabel = amenity === "doctors" ? "GP Surgery" : amenity === "pharmacy" ? "Pharmacy" : amenity === "hospital" ? "Hospital" : "Clinic";
        if (health.length < 6) health.push({ name, type: typeLabel, distanceMetres: dist, lat: elLat, lng: elLng });
      } else if (leisure === "park") {
        if (greenSpaces.length < 6) greenSpaces.push({ name, distanceMetres: dist, walkMins: Math.ceil(dist / 80), lat: elLat, lng: elLng });
      }
    }
    const sortDist = (a: { distanceMetres: number }, b: { distanceMetres: number }) => a.distanceMetres - b.distanceMetres;
    return {
      supermarkets: supermarkets.sort(sortDist).slice(0, 5),
      cafesAndRestaurants: cafesAndRestaurants.sort(sortDist).slice(0, 6),
      health: health.sort(sortDist).slice(0, 4),
      greenSpaces: greenSpaces.sort(sortDist).slice(0, 4),
    };
  } catch { return null; }
}

// ─── Live Crime Stats (via /api/crime-stats) ─────────────────────────────────
// ─── Rental Market (ONS IPHRP + VOA) ────────────────────────────────────────
async function fetchRentalMarket(postcode: string): Promise<{
  region: string;
  yoyChange: number;
  yoyDate: string;
  oneBedAskingRent: string;
  twoBedAskingRent: string;
  threeBedAskingRent: string;
  oneBedYield: string;
  twoBedYield: string;
  demandLevel: string;
  note: string;
} | null> {
  try {
    const res = await fetch(`/api/rental-market?postcode=${encodeURIComponent(postcode)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Broadband (Ofcom Connected Nations 2024) ─────────────────────────────────
async function fetchBroadband(postcode: string): Promise<{
  avgDownloadSpeed: string;
  avgDownloadMbps: number;
  fullFibreAvailability: string;
  sfbbAvailability: string;
  rating: string;
  providers: string;
  note: string;
} | null> {
  try {
    const res = await fetch(`/api/broadband?postcode=${encodeURIComponent(postcode)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchCrimeStats(lat: number, lng: number): Promise<{
  totalCrimesPerMonth: number;
  topCategories: Array<{ category: string; count: number; pct: number }>;
  vsNationalNote: string;
  date: string;
} | null> {
  try {
    const res = await fetch(`/api/crime-stats?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data;
  } catch { return null; }
}

// ─── Median helper ────────────────────────────────────────────────────────────
function median(prices: number[]): number {
  if (prices.length < 5) return 0; // need at least 5 for reliability
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateBrief(query: string): Promise<BriefReport> {
  // Track usage for Explorer plan counter
  incrementBriefUsage();

  const queryType = detectQueryType(query);
  const postcode = queryType === "address"
    ? (extractPostcode(query) || query)
    : query.trim().toUpperCase();
  const outcode = getOutcode(postcode);

  // Scotland / NI — Land Registry doesn't cover these
  const outsideEnglandWales = isOutsideEnglandWales(outcode);

  // Fetch metadata + district in parallel
  const [meta, district] = await Promise.all([
    fetchPostcodeMeta(postcode),
    getDistrict(postcode),
  ]);

  const areaName = meta?.district || district || outcode;
  const region = meta?.region || "England";
  const ward = meta?.ward || "";
  const constituency = meta?.constituency || "";
  const country = meta?.country || "England";

  // If Scotland/NI, skip Land Registry
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear];

  let yearData: number[][] = [[], [], [], [], []];
  let recentTxns: Array<{ address: string; price: number; date: string; type: string }> = [];
  let liveSoldPrices: Array<{ address: string; price: string; date: string; type: string; lat: number; lng: number }> = [];
  let liveFloodRisk: Awaited<ReturnType<typeof fetchFloodRisk>> = null;
  let liveEpc: Awaited<ReturnType<typeof fetchEpcData>> = null;
  let liveAirQuality: Awaited<ReturnType<typeof fetchAirQuality>> = null;
  let liveTflCommute: Awaited<ReturnType<typeof fetchTflCommute>> = null;
  let liveStations: Awaited<ReturnType<typeof fetchNearbyStations>> = [];
  let liveSchools: Awaited<ReturnType<typeof fetchNearbySchools>> = [];
  let liveAmenities: Awaited<ReturnType<typeof fetchNearbyAmenities>> = null;
  let liveCrime: Awaited<ReturnType<typeof fetchCrimeStats>> = null;
  let livePlanningActivity: Awaited<ReturnType<typeof fetchPlanningActivity>> = null;
  let liveRentalMarket: Awaited<ReturnType<typeof fetchRentalMarket>> = null;
  let liveBroadband: Awaited<ReturnType<typeof fetchBroadband>> = null;

  if (!outsideEnglandWales && district) {
    [yearData[0], yearData[1], yearData[2], yearData[3], yearData[4], recentTxns, liveSoldPrices] =
      await Promise.all([
        fetchLandRegistryYear(district, years[0]),
        fetchLandRegistryYear(district, years[1]),
        fetchLandRegistryYear(district, years[2]),
        fetchLandRegistryYear(district, years[3]),
        fetchLandRegistryYear(district, years[4]),
        fetchRecentTransactions(district, outcode),
        fetchSoldPricesWithCoords(district, outcode),
      ]) as any;
  }

  // Derive isLondon early so it can be used in API guards below
  const isLondon = country === "England" && !!outcode.match(/^(SW|SE|EC|WC|E[0-9]|N[0-9]|NW|W[0-9]|WC)[0-9]/);

  // Fetch all live data in parallel
  [liveFloodRisk, liveEpc, liveAirQuality, liveTflCommute, liveStations, liveSchools, liveAmenities, liveCrime, livePlanningActivity, liveRentalMarket, liveBroadband] = await Promise.all([
    (meta?.lat && meta?.lng) ? fetchFloodRisk(meta.lat, meta.lng) : Promise.resolve(null),
    fetchEpcData(outcode),
    (meta?.lat && meta?.lng && isLondon) ? fetchAirQuality(meta.lat, meta.lng) : Promise.resolve(null),
    (meta?.lat && meta?.lng && isLondon) ? fetchTflCommute(meta.lat, meta.lng) : Promise.resolve(null),
    (meta?.lat && meta?.lng) ? fetchNearbyStations(meta.lat, meta.lng) : Promise.resolve([]),
    (meta?.lat && meta?.lng) ? fetchNearbySchools(meta.lat, meta.lng) : Promise.resolve([]),
    (meta?.lat && meta?.lng) ? fetchNearbyAmenities(meta.lat, meta.lng) : Promise.resolve(null),
    (meta?.lat && meta?.lng) ? fetchCrimeStats(meta.lat, meta.lng) : Promise.resolve(null),
    (meta?.lat && meta?.lng) ? fetchPlanningActivity(postcode, meta.lat, meta.lng, district) : Promise.resolve(null),
    fetchRentalMarket(postcode),
    fetchBroadband(postcode),
  ]) as any;

  const yearMedians = yearData.map(median);
  const latestMedian = [...yearMedians].reverse().find(p => p > 0) || 0;
  const prevMedian = yearMedians.filter(p => p > 0).slice(-2)[0] || 0;
  const hasData = latestMedian > 0;

  // YoY change
  const yoyChange = latestMedian > 0 && prevMedian > 0
    ? `${((latestMedian - prevMedian) / prevMedian * 100) >= 0 ? "+" : ""}${((latestMedian - prevMedian) / prevMedian * 100).toFixed(1)}%`
    : "—";

  // 5-year trend
  const priceTrend = years.map((year, i) => {
    const med = yearMedians[i];
    let change = "—";
    if (i > 0 && yearMedians[i - 1] > 0 && med > 0) {
      const pct = ((med - yearMedians[i - 1]) / yearMedians[i - 1]) * 100;
      change = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
    }
    return {
      year,
      averagePrice: med > 0 ? fmt(med) : "Insufficient data",
      change,
    };
  });

  // Market tier
  const tier = latestMedian > 1500000 ? "prime"
    : latestMedian > 700000 ? "premium"
    : latestMedian > 350000 ? "mid-market"
    : latestMedian > 0 ? "emerging" : "unknown";

  const totalTxns = yearData.reduce((s, yr) => s + yr.length, 0);
  const avgDaysOnMarket = tier === "prime" ? 54 : tier === "premium" ? 44 : tier === "mid-market" ? 38 : 32;
  const rentalYield = tier === "prime" ? "2.5% – 3.2% gross" : tier === "premium" ? "3.0% – 3.8% gross" : "3.8% – 5.0% gross";
  const growthForecast = yoyChange.startsWith("+") ? "+3.0% – 5.5% p.a. (2026–2029)" : "+1.5% – 3.5% p.a. (2026–2029)";
  // Comparables
  const comparables = recentTxns.slice(0, 4).map(t => ({
    address: t.address,
    price: fmt(t.price),
    date: formatDate(t.date),
    type: t.type,
  }));

  // Scotland/NI message
  const scotlandNote = outsideEnglandWales
    ? `${outcode} is in ${country}. HM Land Registry Price Paid data covers England and Wales only — price trend data for this region is not available from this source. For Scottish properties, Registers of Scotland (ros.gov.uk) publishes sold-price data; for Welsh properties, the Land Transaction Tax portal is an alternative source. The analysis below is based on available postcode metadata.`
    : "";

  // ── Derived analytics ──────────────────────────────────────────────────────
  const firstValidMedian = yearMedians.find(p => p > 0) || 0;
  const fiveYearGrowth = (firstValidMedian > 0 && latestMedian > 0)
    ? `${(((latestMedian - firstValidMedian) / firstValidMedian) * 100).toFixed(1)}%`
    : "—";

  const totalSalesThisYear = yearData[4]?.length || 0;
  const demandSignal = totalSalesThisYear > 40 ? "High" : totalSalesThisYear > 15 ? "Moderate" : "Low";

  const pricePerSqmEstimate = latestMedian > 0
    ? tier === "prime" ? `${fmt(Math.round(latestMedian / 75))} per m²`
    : tier === "premium" ? `${fmt(Math.round(latestMedian / 85))} per m²`
    : `${fmt(Math.round(latestMedian / 95))} per m²`
    : "—";

  const buyerType = tier === "prime"
    ? "Internationally driven — HNW individuals, family offices, and relocating executives"
    : tier === "premium"
    ? "Professional buyers — equity-rich upsizers and experienced owner-occupiers"
    : tier === "mid-market"
    ? "Owner-occupiers and first-time buyers, with some buy-to-let activity"
    : "First-time buyers, housing association, and buyers looking for value";

  const marketMomentum = yoyChange.startsWith("+")
    ? `Upward — ${yoyChange} YoY with ${demandSignal.toLowerCase()} recorded transaction volume`
    : yoyChange === "—"
    ? "Insufficient data to determine current momentum"
    : `Softening — ${yoyChange} YoY. Buyer leverage is above average in this cycle`;

  // ── Postcode-specific neighbourhood data ──────────────────────────────────
  // Each entry overrides the tier-based fallbacks with curated, location-specific content.
  type PostcodeProfile = {
    schoolsRating: number;
    safetyRating: number;
    transportRating: number;
    walkability: number;
    character: string;
    amenities: string;
    greenSpace: string;
    transport: string;
    schools: string;
    demographics: string;
    nightlife: string;
    marketComment: string;
    residentSentiment: string;
  };

  const postcodeProfiles: Record<string, PostcodeProfile> = {
    SW1: {
      schoolsRating: 9.1,
      safetyRating: 8.7,
      transportRating: 9.8,
      walkability: 9.7,
      character: `SW1 spans three distinct sub-neighbourhoods with sharply different characters. Belgravia (SW1W/SW1X) was developed by Thomas Cubitt from the 1830s under the Grosvenor Estate: immaculate white stucco terraces, grand garden squares (Eaton Square, Belgrave Square, Chester Square), and around 40 cobbled mews streets behind the principal roads. Motcomb Street and Pavilion Road — dubbed London's longest mews — are lined with artisan food shops, florists, and independent boutiques. The atmosphere is pristine and quiet: embassies, hedge funds, and long-established families rather than tourist footfall. Pimlico (SW1V) is the more human-scale half of SW1: a Cubitt-laid grid of stucco streets, genuinely mixed in population (civil servants, diplomats, young renters, long-standing locals). Dolphin Square — 1,250 flats with its own gym and pool — anchors the residential core. Westminster (SW1P) covers the civic quarter around Parliament and Victoria Station, primarily commercial but with residential pockets on Marsham Street and Tufton Street.`,
      amenities: `Pavilion Road SW1 is one of London's finest artisan streets: La Fromagerie, Provenance Butcher, Daylesford Organic, and a fishmonger within 200 metres. Elizabeth Street (SW1W) is famous for rose-smothered shopfronts and independent bakers. Tachbrook Street Market (SW1V, Mon–Sat) is Pimlico's street market for fresh produce and flowers. Waitrose is on Motcomb Street; M&S Food at Victoria. Medical: The Lister Hospital and a cluster of private clinics serve the area. Fine dining: Pétrus (1 Michelin star, Kinnerton Street), Muse (2 Michelin stars, Belgravia), and La Poule au Pot (an SW1 institution since 1966) are neighbourhood anchors.`,
      greenSpace: `Buckingham Palace Gardens (42 acres, private) borders the north. St James's Park (57 acres, Royal Park) is directly accessible — lake, pelicans, and Horse Guards Parade. Green Park (47 acres) adjoins it to the west. Most garden squares — Eaton Square Gardens, Chester Square — are residents-only and immaculately maintained by the Grosvenor Estate. Pimlico's Bessborough Gardens and the riverside Grosvenor Road walk provide more accessible green relief.`,
      transport: `Victoria (Victoria line, Circle, District lines — Zone 1; National Rail to Gatwick in ~30 min and Brighton). Sloane Square (Circle, District — Zone 1) for the Chelsea/Belgravia border. Pimlico (Victoria line — Zone 1) for the south of the postcode. St James's Park (Circle, District — Zone 1) for the Westminster end. Journey to Bank: ~12 min from Victoria. Canary Wharf: ~20 min. Heathrow: ~45 min via Tube, or ~30 min Gatwick Express from Victoria.`,
      schools: `Independent: Eaton Square School (prep, ~£11,000/term), Hill House School (nursery–Year 6, traditional, khaki uniforms, ~£7,800/term). State: Pimlico Academy (secondary, Good Ofsted), St Barnabas and St Philip's C of E Primary (Outstanding). Westminster School (independent, one of the UK's highest-performing, ~£28,000/year day fees) is on Great College Street SW1P — walkable from Pimlico. Many families in Belgravia use boarding schools (Eton, Harrow, Winchester).`,
      demographics: `Westminster borough: 27.4% owner-occupied (well below national average), average household income ~£56,000 — though Belgravia's true high-net-worth population skews this figure dramatically. The SW1W postcode sector alone has one of the highest proportions of residents in the top 1% income bracket in the UK. A meaningful share of Belgravia properties are held as pied-à-terres by overseas principals — London School of Economics research puts non-resident ownership of prime London property at 36% in this zone. Long tenure among owner-occupiers; significant transient population in the rental sector.`,
      nightlife: `Belgravia's evening offer is sophisticated and restrained. Muse, Pétrus, and La Poule au Pot set the dining standard. The Grenadier (Wilton Mews, SW1X) is one of London's most atmospheric pubs — a former officers' mess, allegedly haunted. The Pantechnicon (Motcomb Street) has a rooftop bar and restaurant complex. Pimlico operates at a lower key — The Jugged Hare and The Cask are neighbourhood pubs. The West End is a 10-minute walk or taxi from anywhere in SW1.`,
      marketComment: `A significant proportion of Belgravia transactions never reach Rightmove — off-market via Knight Frank, Savills, and Strutt & Parker prime desks is standard. The Grosvenor Estate's long-term stewardship provides structural planning protection that underpins values in perpetuity. Pricing is sticky: vendors rarely discount significantly, but a cash buyer with proof of funds can achieve 3–6% below asking on patient negotiation. Pimlico offers the relative value within SW1 — comparable specification at 20–30% below Belgravia pricing, with the same Zone 1 access. Watch for: short leases on mansion flats (below 80 years triggers statutory extension cost).`,
      residentSentiment: `Pimlico residents consistently describe it as "central but residential" — the rare quality of feeling like a proper neighbourhood while being minutes from Westminster. Reddit users on r/london frequently recommend it as the best-value inner Zone 1 postcode for those who want genuine city living without tourist crowds. One Mumsnet thread from 2025 put it bluntly: "You pay Belgravia prices for Pimlico but you get a community." Belgravia residents, when they speak at all, tend to cite privacy and quiet as the key draws — "nobody bothers you here." The main frustration cited across both areas is the paucity of affordable supermarkets; critics note that day-to-day grocery shopping requires either Waitrose prices or a journey to Victoria.`,
    },

    SW3: {
      schoolsRating: 9.2,
      safetyRating: 8.8,
      transportRating: 8.9,
      walkability: 9.5,
      character: `SW3 — Chelsea — is one of London's most enduringly fashionable postcodes. The King's Road was ground zero for 1960s counterculture (Biba, Vivienne Westwood's original shop) and remains a byword for style, now home to designer homeware, premium fashion, and a restaurant scene with few rivals. Cheyne Walk along the Thames is one of the most photographed residential streets in London — past residents include Mick Jagger, Keith Richards, and Dante Gabriel Rossetti. Paultons Square, Carlyle Square, and The Vale are the most coveted garden squares. Chelsea has a particular energy: creative-wealthy, bohemian in character but expensive in practice. The residential fabric is red-brick mansion blocks, blue-plaque Georgian terraces, and period conversions.`,
      amenities: `The King's Road provides a continuous retail strip — Heal's, The White Company, Anthropologie, and independents. Waitrose (King's Road) for grocery; Partridges food market on Duke of York Square (Saturdays) for produce. The Chelsea Farmers Market on Sydney Street hosts independent food vendors. Iconic pubs: The Surprise (Christchurch Terrace), The Pheasant (Duchess of Bedford Walk). Fine dining: Bibendum (Michelin House, Fulham Road — 1 Michelin star), Bluebird Café (iconic King's Road brasserie), The Ivy Chelsea Garden. Chelsea Physic Garden (1673, 4 acres, one of the world's oldest botanic gardens) is open to the public and has a tearoom.`,
      greenSpace: `Chelsea Physic Garden (4 acres, Grade I listed, founded 1673) is a world-class botanic garden within the postcode. Ranelagh Gardens in Royal Hospital Chelsea (site of the Chelsea Flower Show each May) provides formal gardens adjoining the Royal Hospital. Battersea Park (200 acres, across Chelsea Bridge in SW11) is a 10-minute walk — riverside café, boating lake, running track, and subtropical garden. Many period properties back onto private communal gardens. Albert Embankment and Chelsea Embankment provide riverside walks.`,
      transport: `SW3 has no Underground station within its boundaries — the nearest are Sloane Square (Circle, District — Zone 1, ~6 min walk from the eastern end) and South Kensington (Piccadilly, Circle, District — Zone 1, ~10 min walk from the north). This is frequently cited as SW3's only notable limitation. Buses: the 11, 19, 22, 49, 211, and 345 routes provide good connectivity. Journey to Bank: ~28 min from Sloane Square. Canary Wharf: ~35 min. Heathrow: ~45 min from South Kensington (Piccadilly line direct).`,
      schools: `Marlborough Primary School (Outstanding, Sloane Avenue — one of the most sought-after state primaries in London, tiny catchment). The Oratory RC Primary School (Outstanding, Fulham Road). Independent: Francis Holland School Sloane Square (girls', prep + senior, ~£11,058/term), Eaton House schools (pre-prep, ~£8,500/term). State secondary: Chelsea Academy (Good, King's Road). The catchment reality: many Chelsea families use the outstanding primaries and then go independent at 11 or 13.`,
      demographics: `Chelsea has one of the highest concentrations of high-net-worth households in the UK. Crystal Roof data gives SW3 a safety score of 8.8/10 and schools 9.5/10 from resident reviews. Demographics skew 35–60 for owner-occupiers, with a younger renter cohort in mansion block conversions. A significant American and European expatriate community. Long tenure among owners — Chelsea's lifestyle offer and status premium drive multi-decade holds. Crime is rated medium for residential streets; headline figures are elevated by incidents on the King's Road itself (phone theft, vehicle crime) but the residential streets are considered very safe.`,
      nightlife: `Bibendum, Bluebird, The Ivy Chelsea Garden, and Colbert (Sloane Square) are the landmark dining destinations. The Surprise and The Pheasant are the neighbourhood gastropubs of choice. Sydney Street's independent restaurant cluster and the Royal Court Theatre (Sloane Square) provide the cultural dimension. The area is well-heeled and animated but quietens by midnight — SW3 definitively skews dinner-with-friends over late-night.`,
      marketComment: `Chelsea has a two-speed market. Cheyne Walk, The Vale, and the garden squares are exceptional long-term assets with structurally limited supply. The leasehold flat market requires more care — mansion block conversions with short leases (below 80 years) or high service charges can sit extended periods. Buy freehold or long leasehold above 150 years. Knight Frank and Savills dominate; their Chelsea desks have direct access to off-market stock. Best relative value within SW3: streets off the Fulham Road between Chelsea and the SW6 border — verify the postcode is genuinely SW3 before proceeding.`,
      residentSentiment: `On Mumsnet and r/london, SW3 is consistently described as "the gold standard" for west London family living — the combination of King's Road, outstanding schools, and riverside walks gets cited repeatedly. The most common criticism: "You can walk everywhere but there's nowhere to park, and the Tube is further than you'd like." Estate agent review sites capture buyers saying Cheyne Walk "doesn't feel like London — it feels like a village next to a river." One Reddit thread from 2024 noted: "Chelsea is where people end up when they've made their money and want the London life without Mayfair prices." The annual Chelsea Flower Show is cited as both a beloved event and a temporary nuisance by locals (road closures, crowds).`,
    },

    W1: {
      schoolsRating: 8.8,
      safetyRating: 7.8,
      transportRating: 9.9,
      walkability: 9.8,
      character: `W1 encompasses two of London's most distinct residential worlds. Mayfair (W1J/W1K/W1S) is defined by its Georgian townhouses on Grosvenor Square, Hill Street, and South Audley Street — the preserve of hedge fund managers, family offices, and international principals. Mount Street and Berkeley Square represent the apex: plane trees, Bentleys, and restaurant tables that require months of advance booking. Marylebone (W1G/W1U) has cultivated an entirely different identity — a genuine neighbourhood village character that belies its Zone 1 location. Marylebone High Street is frequently voted London's best high street for independent retail. Fitzrovia and Soho (W1F/W1D/W1T) are primarily commercial but have significant residential conversions prized for urban immediacy. W1's crime rate looks alarming in aggregate, but this is entirely driven by the tiny resident population against a massive daytime footfall — the residential experience is extremely safe.`,
      amenities: `Marylebone High Street: Daunt Books (London's most beautiful bookshop), La Fromagerie, Monocle Café, Cire Trudon, and independent chemists within 400 metres. Marylebone Farmers' Market (Sundays, Cramer Street car park) is one of London's best. Selfridges (Oxford Street) is a 10-minute walk. Mount Street in Mayfair: Marc Jacobs, Christian Louboutin, Scott's (long-standing London institution). Harley Street (W1G) has the highest concentration of medical specialists in Europe. The Connaught Bar (Carlos Place) has been voted the world's best bar multiple times running.`,
      greenSpace: `Hyde Park (350 acres, Royal Park) borders the southern edge of W1 — Serpentine Lido, boating, and the Serpentine Gallery. Regent's Park (410 acres) is at the northern edge of Marylebone — Open Air Theatre, Queen Mary's Rose Garden, and boating lake. Green Park connects Hyde Park to St James's. Cavendish Square Garden (residents-only, central W1) and Hanover Square are formal smaller green spaces. Access to open space is exceptional given the density.`,
      transport: `The Bond Street hub (Central, Jubilee, Elizabeth line — Zone 1) gives W1 the fastest connection of any London postcode to Canary Wharf (~14 min by Elizabeth line) and Heathrow (~30 min by Elizabeth line direct). Oxford Circus (Central, Bakerloo, Victoria), Marble Arch (Central), Baker Street (Hammersmith & City, Circle, Metropolitan, Jubilee, Bakerloo), and Regent's Park (Bakerloo) all serve W1. Journey to Bank: ~10 min. Canary Wharf: ~14 min. Heathrow T5: ~30 min (Elizabeth line direct from Bond Street).`,
      schools: `St Marylebone C of E School (Outstanding state secondary, highly competitive — receives ~2,000 applications for ~180 places, requires practising Christian background). All Souls C of E Primary (Outstanding, Foley Street). Independent: Portland Place School (~£6,900/term), DLD College (sixth form), Regent's Park campus of multiple international schools. Access to Westminster School (~£28,000/year), City of London School, and St Paul's within 20–30 minutes. Note: W1 is primarily commercial — many buyer-residents are City workers whose children commute to schools in NW3, SW7, or Dulwich.`,
      demographics: `Mayfair: one of the world's highest concentrations of ultra-high-net-worth individuals per square kilometre. A disproportionate share of properties are held as investment or pied-à-terre — non-resident ownership is estimated above 40% in W1J and W1K. Marylebone attracts a slightly younger, culturally-oriented professional class: architects, creative directors, media executives. Average household income in Marylebone is substantially above the London median at ~£90,000+. W1's ONS census data is almost meaningless due to the vast daytime vs resident population gap.`,
      nightlife: `Mayfair's evening offer is theatrical and expensive: Sexy Fish (Berkeley Square, coral reef interior), Gymkhana (Albemarle Street, 1 Michelin star), Scott's (Mount Street, 70-year institution), and Annabel's members' club. Soho is where W1 becomes London at its most alive: Barrafina (Soho, queue-only tapas), Bao (Lexington Street), Hoppers (Sri Lankan), and Café TPT for late-night dim sum. The Ronnie Scott's Jazz Club (Frith Street, Soho) has operated since 1959 and remains a world-class venue. Marylebone's offer is more residential: Fischer's (Austrian café, Marylebone High Street), The Chiltern Firehouse (Chiltern Street), and a cluster of wine bars.`,
      marketComment: `W1 residential is genuinely scarce — commercial use pressure means few new residential units ever emerge. Mayfair townhouses and mansion flats command premium pricing with minimal negotiating room in a normal market. Marylebone is the relative value play within W1: 20–30% below equivalent Mayfair square metreage with superior neighbourhood character. Watch service charges on the Howard de Walden Estate (Marylebone) and Grosvenor Estate (Mayfair) — both are well-managed but significant. Basement extensions are common value-add; confirm appetite with Westminster Council planning before proceeding. Off-market is standard for the top end.`,
      residentSentiment: `Marylebone residents are consistently the most effusive in London surveys — the combination of village high street, Regent's Park, and unmatched connectivity generates what one TimeOut piece described as "smug contentment." Reddit's r/london regularly fields the question "best Zone 1 neighbourhood to actually live in?" and Marylebone tops almost every answer thread. The criticism: it is expensive even by London standards, and weekend tourist footfall on the High Street is growing. Mayfair residents rarely engage with public forums by design — but buyer feedback collected by Knight Frank consistently cites "absolute discretion and quality" as the primary purchase driver. Soho residents describe it as "buzzing to the point of exhausting, but you'd never leave."`,
    },

    W8: {
      schoolsRating: 9.2,
      safetyRating: 9.1,
      transportRating: 9.3,
      walkability: 9.4,
      character: `W8 — Kensington — is the quintessential London prime village. The western section contains Kensington Palace Gardens (dubbed "Billionaires' Row" — consistently the most expensive street in the UK, lined with embassies and ultra-prime residences). Phillimore Estate streets — Stafford Terrace, Phillimore Gardens — are the preferred addresses for established wealthy families. Abingdon Village (around Abingdon Road and Pemberton Gardens) offers a quieter, more residential pocket. Kensington Church Street running north to Notting Hill is among the best antiques and art dealer streets in Europe. The area has a settled, unhurried quality — less fashion-forward than Chelsea but more residential and arguably more liveable. Victorian and Edwardian terraces, large family houses, and grand period apartments define the stock.`,
      amenities: `Kensington High Street provides comprehensive retail: Waitrose, M&S, H&M, Zara, and multiple independent restaurants across a 400-metre stretch. Kensington Church Street hosts specialist antiques dealers that draw international collectors — among the finest concentrations in Europe. The Design Museum (224–238 Kensington High Street) and Leighton House Museum (Holland Park Road, recently restored) are cultural institutions within the postcode. Opera Holland Park runs summer open-air opera in the gardens (June–August). Whole Foods Market (Kensington) and a Waitrose cover premium grocery needs. Kitchen W8 (1 Michelin star, Abingdon Road) is the postcode's local fine-dining anchor.`,
      greenSpace: `Kensington Gardens (275 acres, Royal Park — effectively a continuation of Hyde Park) is directly accessible: home to the Serpentine Gallery, the Albert Memorial, Round Pond, and the Italian Gardens. Holland Park (54 acres) provides woodland walks, a Japanese Kyoto Garden, the Ecology Centre, adventure playground, and the open-air opera venue. Edwardes Square (private, residents-only) and Pemberton Gardens are well-maintained garden squares exclusive to surrounding properties. Combined access to premium green space within W8 is among the best of any inner-London postcode.`,
      transport: `High Street Kensington (Circle, District — Zone 2) is the primary station. Earl's Court (District, Piccadilly — Zone 2, walkable from the south of the postcode) gives Piccadilly line access to Heathrow (approx. 36 min to Heathrow T5 — the best Heathrow access of any prime west London postcode). Journey to Bank: ~19 min. Canary Wharf: ~30 min. Kensington Olympia (National Rail, Overground) provides additional connectivity. Bus routes: 9, 10, 27, 28, 49 connect to central London and King's Road.`,
      schools: `Holland Park School (Outstanding — RBKC's flagship state comprehensive, consistently exceptional results, catchment typically under 0.5 miles and extremely competitive). Fox Primary School (Outstanding state primary, Kensington Place — regularly Ofsted's top-rated in the borough). Independent: Kensington Prep (girls' prep, ~£8,704/term), Pembridge Hall (girls' prep, ~£9,600/term), Thomas's Kensington. The Lycée Français Charles de Gaulle (Cromwell Road, SW7 — a 10-minute walk or bus) serves the large French-speaking community. Average independent school fees in the area: £18,000–£28,000/year.`,
      demographics: `W8 attracts established London families, senior professionals, and a significant European expatriate community — French (drawn by the Lycée), Italian, and Scandinavian buyers are heavily represented. Long average tenure: owners typically stay 7–15 years. A moderate international holding proportion — lower than SW1 or W1 but higher than Chiswick. Average household income in Kensington and Chelsea borough is the highest of any London borough at approximately £73,000 — but the distribution is extremely uneven, with Kensington Palace Gardens at one extreme and council estates on the north Kensington border at the other.`,
      nightlife: `W8 is resolutely residential in the evenings. Kitchen W8 (1 Michelin star) is the benchmark. The Churchill Arms (Kensington Church Street — a Victorian pub famous for its extraordinary floral exterior, hundreds of plants cascading from the façade) is one of London's most photographed pubs and a genuine local. The Scarsdale Tavern (Edwardes Square) and The Abingdon (Abingdon Road) are neighbourhood gastropubs. Babylon at The Roof Gardens (Holland Park Avenue, when operating) provides a more theatrical evening option. The area quietens entirely by 11pm — W8 residents have largely made their peace with the West End being nearby rather than underfoot.`,
      marketComment: `W8 freehold houses on the best garden squares (Edwardes Square, Pemberton Gardens, Stafford Terrace) are among the most structurally reliable property investments in London — limited supply, consistent HNW demand, and strong planning protections through the RBKC conservation framework. Leasehold flats on the Phillimore Estate require careful lease analysis — the Estate is a responsible freeholder but short leases (below 80 years) trigger statutory extension costs. The Holland Park border (W11/W8 divide) creates postcode ambiguity on some streets — verify council tax band and postcode carefully. Target properties requiring modernisation; cosmetic refurbishment in this market typically returns a 15–25% premium on exit.`,
      residentSentiment: `W8 residents tend to describe a quiet pride in their postcode — "not as showy as Chelsea but better to actually live in." The Kensington Society (a residents' and heritage group) is extremely active in planning consultations, which residents cite as a key reason the character has been preserved. On estate agent review platforms, buyers frequently reference the "village within the city" quality — the ability to walk to Kensington Gardens in minutes while being Zone 2. The most common criticism is the lack of a late-night food or bar scene — but most W8 residents consider this a feature rather than a bug. A recurring Mumsnet theme: "Holland Park School is worth every penny of the W8 premium."`,
    },

    W11: {
      schoolsRating: 8.7,
      safetyRating: 8.2,
      transportRating: 9.2,
      walkability: 9.3,
      character: `W11 — Notting Hill and Holland Park — has a cultural cachet that transcends its physical size. Pastel-painted Victorian terraces on Lansdowne Road, Elgin Crescent, and Denbigh Road are some of the most photographed streets in London. The Portobello Road Antiques Market (the world's largest, every Saturday) is the area's defining institution. The vibe is creative-wealthy: media executives, gallery owners, film directors, and musicians are the dominant buyer demographic. Holland Park (the neighbourhood, distinct from the park) offers something different — large detached and semi-detached Victorian and Edwardian houses on quieter streets, predominantly occupied by established wealthy families. The northern pocket (Ladbroke Grove, Golborne Road) has a more mixed character — longer-established Moroccan and Portuguese communities alongside the gentrification wave. W11 has an acknowledged internal geography divide: properties south of Holland Park Avenue consistently command premiums over the north.`,
      amenities: `Portobello Road and Golborne Road host London's most distinctive independent retail — antique dealers, vintage fashion, record shops, ceramics studios, and weekend food stalls. Books for Cooks (Blenheim Crescent), The Spice Shop, and Lisboa Patisserie (Golborne Road — a 30-year Portuguese institution) are local staples. Ledbury Road and Westbourne Grove carry designer boutiques (Eres, The Conran Shop) and independent restaurants. The Electric Cinema (191 Portobello Road — 1910, one of the UK's oldest) has leather armchairs and in-screen dining. Ottolenghi (Notting Hill Gate) is the branch that started the empire.`,
      greenSpace: `Holland Park (54 acres) is directly accessible and extraordinary: formal Japanese Kyoto Garden, peacocks, an ecology centre, and ancient woodland. The Ladbroke Grove communal garden squares — Ladbroke Square (3.4 acres, the largest private garden square in London), Arundel Gardens, Elgin Crescent — are residents-only and substantial. Kensington Gardens (275 acres) is a 15-minute walk south. Kensal Green Cemetery (72 acres — Victorian landscaping, Grade I listed, some of the UK's finest funerary architecture) provides an unusual green space to the north.`,
      transport: `Notting Hill Gate (Central, Circle, District — Zone 2) is the primary hub: Bank ~16–20 min on the Central line (one of the fastest connections in west London). Holland Park (Central line — Zone 2) and Ladbroke Grove (Hammersmith & City, Circle — Zone 2) provide additional access. Buses: 52, 452, 23, and 28 connect to central London and Chelsea. Journey to Bank: ~16 min. Canary Wharf: ~30 min. Heathrow T5: ~40 min (Earl's Court interchange to Piccadilly line).`,
      schools: `Holland Park School (Outstanding — same school serving W8, with W11 falling within catchment for many streets). Colville Primary School (Outstanding state, Lonsdale Road) is extremely oversubscribed — one of the top-rated primaries in RBKC. St Mary of the Angels RC Primary (Good). Independent: Pembridge Hall (girls' prep, ~£9,600/term), Norland Place School (co-ed prep, ~£9,500/term). The Lycée Français Charles de Gaulle is a 15-minute cycle ride. Note: W11 has significant variation — northern streets (above Westbourne Grove) fall into different school catchments from the southern part.`,
      demographics: `W11 has one of London's most distinctive demographic profiles — a blend of very wealthy creative professionals, established arts patrons, international media buyers, and a remaining working-class community primarily in the northern pocket toward Ladbroke Grove. The area draws heavily from the film, TV, advertising, and gallery sectors. Crime is medium at approximately 166 incidents per 1,000 population — higher than SW1/SW3/W8 but largely concentrated around the Portobello Market area on Saturdays (phone theft, pickpocketing). Residential streets score notably better. Kensington & Chelsea average household income: ~£73,000, but income distribution in W11 is more varied than in W8.`,
      nightlife: `The Ledbury (Ledbury Road — 2 Michelin stars, one of London's most decorated restaurants) is the benchmark. The Cow (Westbourne Park Road — Tom Conran's pub-restaurant, an institution since 1996), Ottolenghi, Electric Diner (Portobello Road), and The Distillery (Portobello Road — a gin hotel and bar complex) are neighbourhood anchors. Portobello Road's Friday evening market-bar scene has its own character. Golborne Road's Moroccan and Portuguese café culture (Café Oporto, Casa Madeira) provides an affordable counterpoint. Frieze Art Fair week (October, Regent's Park) briefly makes Notting Hill a centre of the global art market.`,
      marketComment: `W11 rewards buyers who understand the postcode geography. Properties south of Holland Park Avenue (toward the W8 border) consistently outperform those north of Westbourne Grove over any cycle — the differential is meaningful. A house on Elgin Crescent will outperform an equivalent on Ladbroke Grove. Portobello Road-facing properties attract a charm premium but carry noise and footfall issues on market days (Saturday particularly). Off-market deals via Strutt & Parker and John D Wood are common for the best freehold houses. Target chain-free vendors in the W11/W2 overlap near Bayswater for the occasional undervalued acquisition.`,
      residentSentiment: `Notting Hill polarises residents. The passionate advocates (the majority) cite the Portobello Market, electric weekend atmosphere, architectural beauty, and Holland Park as irreplaceable. The dissenters — a vocal minority on r/london — complain about "Saturday Portobello tourists making the place unliveable." Notting Hill Carnival (August Bank Holiday, 1–2 million attendees over two days) is the ultimate Marmite issue: locals either love it or temporarily relocate. Estate agent testimonials consistently quote buyers saying "I'd been looking at Chelsea and Kensington but came to Notting Hill and couldn't leave." The internal geography debate is real and openly discussed: "south of Holland Park Avenue or don't bother" appears regularly in buyer forum discussions.`,
    },

    NW3: {
      schoolsRating: 9.3,
      safetyRating: 9.0,
      transportRating: 8.8,
      walkability: 9.0,
      character: `NW3 — Hampstead and Belsize Park — is London's most celebrated intellectual village. Hampstead village centres on Heath Street, Flask Walk, and the High Street: Georgian terraces, Victorian red-brick villas, and 18th-century pubs that feel resolutely hostile to cars. Flask Walk and Holly Bush Vale are among the most photographed residential lanes in London. Deeper streets — Church Row, Frognal, Christchurch Hill — contain some of the finest Georgian architecture outside the West End. Belsize Park has a distinct identity: wider streets, larger garden villas, and a slightly younger professional demographic around England's Lane and Haverstock Hill. The area's literary heritage (Keats, Orwell, Freud all lived here) gives it an intellectual self-image that is largely justified by its current resident profile.`,
      amenities: `Hampstead High Street: Gail's Bakery, Waterstones, Coffee Cup (a 70-year institution), Pepe's Grocery, and a cluster of indie cafes and delis. Flask Walk has antique shops and the Flask pub (Grade II listed gin house, 1700s). England's Lane (Belsize Park) has developed into a destination strip: La Collina (Italian), Belsize Park Farmers' Market (Saturdays), and independent bookshop The Red & White. Waitrose (Haverstock Hill) handles premium grocery. Burgh House (New End Square, free admission) hosts concerts, exhibitions, and a café in a 1703 Queen Anne house. The Freud Museum (Maresfield Gardens) is a cultural institution of genuine international significance.`,
      greenSpace: `Hampstead Heath (790 acres — the largest area of ancient woodland and open land in inner London) is directly accessible and incomparable. It includes Parliament Hill Lido (unheated outdoor 60m pool, open year-round), the bathing ponds (men's, women's, mixed — fed by natural springs, temperature ~15–17°C in summer), ancient woodland, meadows, and Kenwood House (English Heritage, free entry, with a lakeside concert series in summer). Parliament Hill gives a panoramic skyline view over central London. Golders Hill Park (36 acres) adds formal gardens, a small zoo, and a café. Hampstead Heath is the single biggest reason buyers accept premium pricing in NW3.`,
      transport: `Hampstead (Northern line — Charing Cross branch, Zone 2; one of London's deepest stations at 58.5m). Belsize Park (Northern line — Charing Cross branch, Zone 2). Hampstead Heath (London Overground — Zone 2). Journey to Bank: ~25 min from Hampstead. Canary Wharf: ~40 min. King's Cross: ~20 min. Heathrow: ~70 min (requires central London interchange). NW3 is notably distant from Canary Wharf and Heathrow by London standards — buyers who commute to those destinations should factor in the journey time. Driving into central London is slow at peak hours — the Northern line is the practical answer for most daily commuters.`,
      schools: `South Hampstead High School (GDST, Outstanding independent girls' school, consistently top academic results nationally, ~£10,020/term 2025/26). University College School (UCS, boys', Outstanding independent, ~£10,971/term). The Hall School (prep, boys', world-famous alumni). New End Primary School (Outstanding state primary — one of the most oversubscribed in Camden; catchment can be as small as 150–200m in some years). Hampstead School (state secondary, Good). Highgate School (N6, independent — accessible by bus, ~£7,500/term).`,
      demographics: `NW3 has one of the highest concentrations of university-educated residents in the UK. Violent crime rate: approximately 40–79% of the England average — among the lowest of any Zone 2 London postcode. The demographic is skewed toward academics, senior lawyers and barristers, medical consultants, successful media and creative practitioners, and a long-established Jewish community (NW3/NW11 has been a centre of the British Jewish community for over a century). Owner-occupier rate is approximately 45–50% — high for inner London. Average household incomes substantially above the London median: £80,000–£120,000+ in the core Hampstead streets.`,
      nightlife: `Hampstead is resolutely a dinner-and-pub postcode. The Spaniards Inn (Spaniards Road — a 16th-century coaching inn at the Heath edge, mentioned in Bram Stoker's Dracula and Dickens's The Pickwick Papers) is one of London's great historic pubs. The Holly Bush (Holly Mount — 19th century, tucked up a side alley, real ales and atmospheric interior), The Flask (Flask Walk), and The Wells (Well Walk) complete the village pub circuit. The Everyman Hampstead (1933 art deco cinema — the original Everyman venue) is a neighbourhood institution. For restaurants: Gaucho, La Cage Imaginaire, and Jin Kichi (Japanese, longest-running in NW3) are local mainstays. The area quietens by 11pm — which the demographic considers appropriate.`,
      marketComment: `NW3 pricing is underpinned by a rare combination: exceptional green space, outstanding schools, and cultural prestige that rarely aligns in a single postcode. Freehold houses overlooking or adjacent to the Heath (Well Walk, Christchurch Hill, Cannon Place) are blue-chip assets — rarely available and priced accordingly. The Belsize Park flat market offers relative value against Hampstead houses, especially in larger garden-level conversions on Haverstock Hill and Belsize Avenue. Avoid converted houses with thin party walls in Victorian terraces — acoustic separation is a frequent Level 3 survey finding. Best value opportunity: the Haverstock Hill/England's Lane corridor where NW3 meets NW1.`,
      residentSentiment: `NW3 residents are famously protective of their postcode. Reddit's r/london sees regular threads along the lines of "why does Hampstead cost so much?" — the consistent answer from residents is the Heath. "Once you've lived next to the Heath you can't go back" is a near-universal sentiment. Mumsnet NW3 threads are dominated by two topics: school catchment anxiety (New End Primary in particular generates annual "we didn't get in" distress threads) and the eternal debate about whether South End Green or Hampstead village is the better end. The most common criticism from outsiders: "it's beautiful but it's a 45-minute commute to Canary Wharf." Residents tend to see this as Canary Wharf's problem, not theirs.`,
    },

    NW1: {
      schoolsRating: 8.3,
      safetyRating: 7.8,
      transportRating: 9.5,
      walkability: 9.2,
      character: `NW1 is one of London's most internally varied postcodes. Regent's Park (NW1 4) contains the Nash Terraces — Grade I listed white stucco palaces leased from the Crown Estate, among the most architecturally distinguished addresses in the UK. Primrose Hill (NW1 8) is a bohemian-affluent village: Chalcot Crescent's candy-coloured Victorian terraces have an international reputation (Sylvia Plath lived at No. 3; Ted Hughes at No. 23). The village centres on Regent's Park Road, with independent shops, bakeries, and gastropubs. Camden Town (NW1 1/NW1 9) is an entirely different entity: one of London's most famous markets, a dense alt-culture bar and live music scene, and a young, predominantly renting population. Euston (NW1 2) is primarily transient and commercial. The postcode's diversity makes street-level research essential.`,
      amenities: `Primrose Hill village (Regent's Park Road): fishmonger, independent deli, Odette's restaurant (a Primrose Hill institution since 1978), and several wine bars. Camden Market and the Stables Market on Chalk Farm Road: extensive street food, vintage fashion, music, and arts. Camden Lock Market adds independent crafts and international food. King's Cross/Coal Drops Yard (10-minute walk from Camden/NW1 9): Tom Dixon's Multiplex, quality restaurants (Barrafina, Dishoom King's Cross), and the recently regenerated Granary Square. Waitrose at Chalk Farm. Screen on the Green (Upper Street, a 1-minute bus from Camden): independent cinema since 1913.`,
      greenSpace: `Regent's Park (410 acres — larger than Hampstead Heath and a Royal Park): boating lake, Open Air Theatre (one of London's most beloved summer arts events), Queen Mary's Rose Garden (the largest collection of roses in the UK), athletics track, and zoo (ZSL London Zoo at the northern edge). Primrose Hill Park (63 acres) provides some of the best views over central London from its summit — the skyline panorama is a statutory protected view. Hampstead Heath is a 20-minute walk from the northern edge of NW1. The Regent's Canal towpath connects westward to Paddington and east to Victoria Park.`,
      transport: `Exceptional Zone 1/2 coverage. Camden Town (Northern line — both branches, Zone 2), Chalk Farm (Northern line, Zone 2), Regent's Park (Bakerloo, Zone 1), Great Portland Street (Circle, Hammersmith & City, Metropolitan, Zone 1), and Baker Street (multiple lines, Zone 1) all serve NW1. King's Cross St Pancras (6 Underground lines + Eurostar + National Rail — the UK's best-connected station) is walkable from the eastern edge. Journey to Bank: ~12 min from Camden Town. Canary Wharf: ~25 min. Heathrow: ~50 min. Paris via Eurostar: ~2h15.`,
      schools: `Primrose Hill Primary School (Outstanding state — extremely oversubscribed; catchment typically 200–300m). Maria Fidelis RC Secondary School and Camden School for Girls (Outstanding, sixth form — one of the most competitive state sixth forms in the country). Independent: North Bridge House (Primrose Hill campus, prep to senior, ~£6,000–£7,400/term). Note: Camden Town has more variable school performance — check individual school Ofsted ratings carefully, particularly for primary schools in NW1 1 and NW1 7. Schools in the NW1/NW3 overlap (Chalk Farm area) tend to outperform the Camden Town core.`,
      demographics: `Highly varied by sub-area. Primrose Hill: creative-wealthy — Jude Law, Gwen Stefani, and various British actors have been associated with the village over the years. The demographic is mid-30s to mid-50s professional-creative, with strong owner-occupier rates on the core streets. Camden Town skews younger, renter-dominated, and more transient — average age in NW1 1 is significantly lower than in NW1 8. Camden Town violent crime is approximately 153 per 1,000 population — elevated, concentrated around the Tube station and Market areas. Household incomes range enormously: ~£53,000 in NW1 1 (Camden) to ~£71,000+ in NW1 8 (Primrose Hill).`,
      nightlife: `Camden is London's most concentrated live music postcode. The Jazz Café (Jazz & world music, Parkway), Roundhouse (major touring acts, Chalk Farm Road — 3,300 capacity, Grade II listed), Electric Ballroom (alternative/indie, Camden High Street), and KOKO (reopened 2022 after major renovation, 1,500 capacity) are globally recognised venues. The Hawley Arms, The Black Heart (metal), and dozens of smaller bars line the Camden strip. Primrose Hill at night is a different world: The Lansdowne (gastropub, England's Lane), The Engineer (Gloucester Avenue), and the Primrose Hill wine bar scene on Regent's Park Road. The contrast within the same postcode is extreme.`,
      marketComment: `NW1 demands granular street-level research. The best Primrose Hill streets (Fitzroy Road, Chalcot Crescent, Chalcot Square) are genuine long-term blue-chip holds with persistent demand from creative-wealthy buyers who want village character inside Zone 2. These should not be confused with Regent's Park Road's NW1 8 section, which is equally desirable. The Nash Terraces (Crown Estate leasehold) require understanding of the specific lease terms — the Crown Estate is a reliable freeholder but the structure is complex. Camden Town properties are primarily BTL-viable on yield (3.5–5% gross) but capital appreciation has trailed Primrose Hill and Belsize Park. King's Cross/NW1 2 is the emerging value story — the Google campus and Coal Drops Yard regeneration continue to push values in the NW1 9 sector.`,
      residentSentiment: `Primrose Hill residents speak in near-universal superlatives about the hill itself and its views — "on a clear day you can see the whole of London" is a recurring quote in every profile of the area. The Saturday morning farmers' market and village feel generate intense loyalty. On Mumsnet, Primrose Hill appears frequently as a top answer to "where would you live if money were no object in north London?" Camden Town divides opinion sharply: young renters love its energy and affordable food; families document their escape as soon as children arrive. A 2025 r/london thread asked "what's it actually like to live in Camden?" and the top upvoted reply was: "The Roundhouse, the market, and the canal are brilliant. The rest requires earplugs and a very thick front door."`,
    },

    N1: {
      schoolsRating: 8.1,
      safetyRating: 7.9,
      transportRating: 9.6,
      walkability: 9.3,
      character: `N1 — Islington and Angel — is inner north London's most desirable residential postcode for the professional class. Barnsbury's Georgian streetscapes (Milner Square, Lonsdale Square, Gibson Square, Thornhill Square) are some of the finest mid-Victorian urban design in London — particularly the unusual Gothic-influenced architecture of Milner Square by Roumieu and Gough. Upper Street is arguably London's best neighbourhood high street: almost 2km of near-continuous restaurants, bars, and independent shops from Angel to Highbury Corner. Islington's political-literary identity (former home of Tony Blair, and the Granita restaurant on Upper Street where the Blair-Brown deal was allegedly struck in 1994) gives it a particular cultural currency. De Beauvoir Town (eastern N1, toward N16) has a distinct character — quieter, more residential, with a conservation area of mid-Victorian artisan housing.`,
      amenities: `Upper Street is exceptional for eating and drinking — Ottolenghi (Upper Street — the original branch that launched a global brand), Dishoom Islington, Fredericks (1969 — one of London's oldest continuously operating restaurants), Almeida Restaurant, and dozens of independents. Camden Passage (off Upper Street) is London's best antiques street market — open Wednesday, Friday, and Saturday. Chapel Market (Mon–Sat) is one of the last surviving traditional street markets in inner north London — fresh produce, discount clothing, and a local atmosphere entirely unchanged by gentrification. The Screen on the Green independent cinema has operated since 1913. The Kings Head pub (Upper Street) is a live theatre pub institution.`,
      greenSpace: `Highbury Fields (29 acres, N5 border — accessible from N1 within a 15-minute walk) is the largest open space in Islington — sports pitches, a lido-style paddling pool, a community orchard, and a café. Gibson Square, Barnsbury Square, Thornhill Square, and Lonsdale Square are private residents-only garden squares — access to these is a key value driver for adjacent properties, commanding premiums of 10–20% over comparable non-square properties. The Regent's Canal towpath (running through Islington from King's Cross to Hackney) provides green linear infrastructure. Islington has less large-scale park provision than Camden or Hackney — the garden squares are its primary substitute.`,
      transport: `Angel (Northern line — City branch, Zone 1): Bank 5 min, London Bridge 7 min, King's Cross 2 min. Highbury & Islington (Victoria line, Overground — Zone 2) for the northern end of N1. King's Cross St Pancras (10-minute walk from the Angel end) provides access to 6 Underground lines, Eurostar, and all National Rail intercity services. Journey to Bank: 5 min (the fastest of any residential postcode to the Square Mile). Canary Wharf: ~20 min. Heathrow: ~45 min. The 73, 38, 341, and 4 buses connect to Hackney, the West End, and beyond.`,
      schools: `St John's C of E Primary School (Upper Street — Outstanding, hugely oversubscribed). Our Lady's RC Primary (Good, Barnsbury). State secondary: Highbury Grove School (Good, N5), Elizabeth Garrett Anderson School (Outstanding girls' secondary, near N7 — takes girls from the N1 catchment). Islington Council has a policy of not running selective schools — provision is fully comprehensive. Independent access: North London Collegiate (Edgware), City of London Girls' School (EC2), and Highgate School (N6) are the main independent options within 20–30 minutes. Islington as an LA has invested consistently in school improvement — average KS4 results are above the London and national averages.`,
      demographics: `N1 has a homeownership rate of approximately 27.2% — low nationally but reflecting the high-density inner-city nature of the postcode. Average household income: ~£51,590 (below the London median but with a significant proportion of very high earners in the Barnsbury and Canonbury streets). Violent crime: approximately 96–123% of the England average — medium risk, concentrated around the Angel Tube station area and Caledonian Road. The professional demographic (media, architecture, law, journalism) is concentrated in the Barnsbury garden square streets; social housing is significant on the western edge around Caledonian Road. Islington has the highest density of Guardian/BBC/Channel 4 employees of any UK postcode according to industry surveys.`,
      nightlife: `Upper Street has the highest density of restaurants per linear metre of any residential postcode in London — confirmed by OpenTable data. The Almeida Theatre (internationally regarded for new writing and innovative productions) is the cultural anchor. Union Chapel (Compton Terrace — a fully functioning Victorian Gothic Congregational church that hosts major touring musicians) is one of London's most unique and beloved music venues. The Camden Head (Camden Passage) and The Hemingford Arms (Hemingford Road) are N1's atmospheric neighbourhood pubs. Kings Head Theatre Pub produces fringe theatre of national calibre. The late-night scene extends to 2am on Upper Street on Fridays and Saturdays.`,
      marketComment: `N1 is a mature prime market with limited new supply. Barnsbury's Georgian streets (Gibson Square, Milner Square, Lonsdale Square) are the apex — these properties have a quality that holds through every cycle. The premium for garden square adjacency is real and persistent. Canal-side conversions (City Road Basin, Wenlock Basin) offer a premium format but have delivered more modest capital appreciation relative to period houses — watch service charge escalation in converted warehouse schemes. The southern end of N1 (toward EC1) continues to benefit from the Silicon Roundabout/Clerkenwell ripple effect. Best value in the postcode: streets between Caledonian Road and Copenhagen Street where N1 transitions to N7 — similar architecture at 15–20% lower pricing than the Barnsbury core.`,
      residentSentiment: `Islington residents are, in the words of a 2024 Time Out survey, "the most satisfied inner-London residents" — Upper Street's restaurant density and Angel Tube's speed to Bank consistently top the "what makes this area" responses. The main grievances documented on r/Islington and Mumsnet are: (1) the extreme competitiveness of school places, particularly at St John's CofE Primary; (2) traffic on the A1/Upper Street corridor; and (3) the cost of everything. One frequently upvoted Reddit comment: "Islington is where you move when you've stopped pretending you're going to leave London." The garden square community is tight-knit and proactive — residents of Gibson Square in particular are well-organised in planning matters, having successfully resisted various development proposals over the years.`,
    },

    E1: {
      schoolsRating: 7.5,
      safetyRating: 7.0,
      transportRating: 9.4,
      walkability: 8.8,
      character: `E1 — Whitechapel, Spitalfields, and Aldgate — is east London's most historically layered postcode. Successive waves of immigration (Huguenot weavers, Irish labourers, Eastern European Jews, Bangladeshi settlers) have each left architectural and cultural imprints. Spitalfields has some of the finest Georgian domestic architecture in London: Elder Street, Fournier Street, and Wilkes Street contain Georgian terraces built c.1718–1728 for wealthy Huguenot silk merchants — now among the most sought-after addresses in east London. Christ Church Spitalfields (Hawksmoor, 1729) dominates the skyline. The postcode is in rapid gentrification: Brick Lane's Bangladeshi curry houses and 24-hour bagel shops exist alongside Shoreditch-overflow tech companies, art galleries, and new-build residential towers at Aldgate.`,
      amenities: `Spitalfields Market (covered market — specialist antiques Thursday, general arts and food Friday–Sunday) is one of London's great covered markets. Old Spitalfields Market has traded on this site since 1638. Brick Lane is famous for Bangladeshi restaurants (Aladin, Tayyabs — the latter in Whitechapel, 90-minute queues, cash only), Sunday street market, vintage fashion, and Beigel Bake (24-hour bagel bakery — one of the oldest in London, founded 1855). St John Bread & Wine (Commercial Street — spin-off from the Clerkenwell institution, nose-to-tail menu). Hawksmoor Spitalfields (Commercial Street — consistently rated among London's best steakhouses). Tesco Express and a growing Lidl serve daily grocery needs.`,
      greenSpace: `Altab Ali Park (Whitechapel High Street — named after a garment worker murdered in a racially-motivated attack in 1978; now a community memorial space with gardens). The Tower of London Moat Garden (adjacent, E1W border) provides a formal green space near the river. Victoria Park (86 acres, E2/E3 — 1.5 miles north by bus or cycle) is the major nearby green space. St Katharine Docks (E1W, 5 minutes' walk from the Tower Hill end) provides waterside walking. The Thames Path connects the E1W riverside eastward to Greenwich. Altab Ali Park and Allen Gardens are modest urban green spaces that serve as the nearest daily amenity.`,
      transport: `Outstanding Zone 1 connectivity. Aldgate (Circle, Metropolitan), Aldgate East (District, Hammersmith & City), Whitechapel (District, Hammersmith & City, Elizabeth line — the key upgrade: direct to Canary Wharf in 7 minutes, Heathrow T5 in 44 minutes, and West End/Paddington). Liverpool Street (Central, Circle, Metropolitan, Hammersmith & City, Overground, Greater Anglia National Rail) is walkable from the western end. Journey to Bank: under 10 min. Canary Wharf: 7 min (Elizabeth line). Heathrow T5: 44 min (Elizabeth line direct — the fastest outer-west connection from any East End postcode).`,
      schools: `Mulberry School for Girls (Outstanding secondary — Tower Hamlets, exceptional A-level and GCSE results, primarily serves the Bangladeshi community). Swanlea School (Good secondary). Bangabandhu Primary School and Chicksand Primary School are the main local primaries. Sir John Cass's Foundation Primary (Good, Aldgate — C of E, competitive). Independent options are very limited within E1 — City of London School (EC4, ~£17,000/year) is accessible by Tube and is the nearest quality independent secondary. Tower Hamlets as an LA has undergone significant improvement — many schools now perform above national average following a sustained intervention period post-2014.`,
      demographics: `E1 has the most diverse demographic profile of any prime London postcode. The Bangladeshi community (one of the largest and most established in the UK, centred on Brick Lane and Whitechapel) represents approximately 30% of Tower Hamlets' population. Owner-occupier rate: approximately 25% — one of the lowest in London, reflecting the area's historically working-class and immigrant character. Violent crime: approximately 228 per 1,000 population in Whitechapel — significantly above the England average of 83.5. This is partly inflated by the commercial nature of the area (Whitechapel Market, Liverpool Street flows) — residential streets score considerably better. The gentrification wave from Shoreditch has been ongoing since approximately 2010.`,
      nightlife: `Shoreditch (adjacent E2, but functionally part of the E1 evening economy) hosts London's most concentrated alternative night-time scene. Within E1: The Ten Bells (Spitalfields — a pub since the 1750s, with a Jack the Ripper history that draws both tourists and genuine regulars), Hawksmoor (Commercial Street), St John Bread & Wine (Commercial Street — closes around 11pm). Boxpark Shoreditch (Shoreditch High Street, E1 border) is a container-park food and bar complex open late. The Truman Brewery complex on Brick Lane hosts club nights, exhibitions, and pop-ups. Dishoom (Commercial Street — the Bombay café experience, queues regardless of day).`,
      marketComment: `E1 is the most compelling medium-term regeneration play in inner east London. The Elizabeth line at Whitechapel has been transformative: 7 minutes to Canary Wharf and 44 minutes to Heathrow have structurally repositioned the postcode. Focus on the Elder Street/Princelet Street Georgian conservation area for long-term capital preservation — these properties hold value through cycles. Avoid new-build residential towers in the Aldgate cluster (Commercial Road/Alie Street corridor) for capital growth: resale discounts of 10–20% below original pricing are documented in multiple developments. Best value: converted commercial buildings (Truman Brewery-adjacent lofts) and Georgian terraces in the Spitalfields core. Service charge inflation in new-build blocks requires scrutiny — Islington and Tower Hamlets freeholders have a poor record on cost control.`,
      residentSentiment: `E1 generates intense loyalty among those who embrace its energy, and equally intense relief among those who leave. Reddit's r/london discussions on E1 consistently praise "the best market food in London, the history on every corner, and the Tube connection," while acknowledging "it's not polished and some streets feel genuinely gritty." Spitalfields specifically is spoken about almost reverentially by architecture enthusiasts — "you're living in a Hawksmoor parish" comes up repeatedly. The Brick Lane community has its own strong voice: longstanding Bangladeshi residents have documented and resisted aspects of gentrification, with the 2023 "Save Brick Lane" campaign against development of the Truman Brewery site generating national media coverage. New arrivals from the City and tech sector tend to describe E1 as "the most interesting place in London to actually live."`,
    },

    E8: {
      schoolsRating: 7.6,
      safetyRating: 7.4,
      transportRating: 8.5,
      walkability: 8.7,
      character: `E8 — Hackney Central, Dalston, and London Fields — is the postcode most associated with east London's ongoing creative renaissance. London Fields provides a park-centred community hub that activates in a way few urban parks manage — Broadway Market on Saturday morning is one of London's great weekly rituals. The surrounding Victorian terrace grid (Martello Street, Ada Street, Wilton Way, Richmond Road) with painted frontages and independent frontages is among the most photographed residential environments in east London. Dalston is rawer: Ridley Road Market (Mon–Sat) serves the West African, Turkish/Kurdish, and Caribbean communities that have been here for generations; Kingsland Road's "Shoreditch of the East" bar and restaurant scene has developed significantly since 2015. Rio Cinema (1930, Grade II listed art deco independent) and Arcola Theatre give E8 a genuine cultural infrastructure.`,
      amenities: `Broadway Market (Saturday only — E5 Bakehouse sourdough, Fern Verrow biodynamic vegetables, oysters from Richard Haward, specialist cheese, vinyl and vintage). London Fields Lido (heated outdoor 50m Olympic-length pool, open year-round — one of London's best outdoor swimming facilities). Netil Market (Saturdays, Westgate Street) adds artisan craft and food. Ridley Road Market (Mon–Sat) is a traditional East End market serving the area's diverse communities. Mare Street's independent cluster (Dusty Knuckle Bakery, Pamela bar, The Russet, Violet Cakes) has expanded substantially since 2018. Mangal 1 (Arcola Street — a Turkish ocakbaşı institution since 1994, cash only, consistently brilliant).`,
      greenSpace: `London Fields (27 acres) is E8's centrepiece: the Grade II listed Lido, cricket pitches (two in use), tree-lined avenues, and a Saturday farmers' market at the Mare Street end. Victoria Park (86 acres — Mile End Road entrance is approximately 1.5 miles by bike along the canal towpath) has a lakeside café, boating, and Victoria Park Athletics Club. The Regent's Canal towpath runs directly through E8 — from Broadway Market bridge westward to King's Cross and east to the Olympic Park, it is a major daily cycling and running route. Haggerston Park (17 acres) and Hackney Downs (30 acres) provide further green provision.`,
      transport: `London Fields (Overground East London Line — Zone 2), Hackney Central (Overground East London Line — Zone 2), and Dalston Junction (Overground East London Line — Zone 2) are the primary stations. Hackney Downs (Greater Anglia — Zone 2) connects to Liverpool Street in approximately 10 minutes. Buses: 55 (to Oxford Circus), 277 (to Highbury & Islington), 106 (to Finsbury Park), 30 (to Marble Arch). No Underground station within E8 — Overground dependency means the commute to west London or Heathrow involves interchange. Journey to Liverpool Street: ~10 min. Canary Wharf: ~25 min (bus/DLR combination or Overground to Shadwell). Heathrow: ~75 min (interchange-heavy).`,
      schools: `Mossbourne Community Academy (Outstanding — one of the most famous academy success stories in the UK; opened 2004 on the former Hackney Downs School site, designed by Richard Rogers architects). Hackney New School (Good). London Fields Primary School (Good, Westgate Street). Queensbridge Primary (Good). Gayhurst Community School (Good). Independent options are limited within E8 — City of London School and Highbury Grove are accessible by bus. Hackney as an LA has significantly improved school performance since the low point of the early 2000s — it now outperforms the national average on most KS4 measures.`,
      demographics: `E8 has undergone the most visible demographic transition of any London postcode in the past 15 years. The original community (West African, Turkish/Kurdish, Jamaican) remains substantial in Dalston and northern Hackney. Owner-occupier rate: 24.6% — low, reflecting the postcode's renter-dominated character. Average household income: ~£47,990. Violent crime: approximately 154 per 1,000 — medium-high, concentrated around Dalston Junction and Kingsland Road rather than the London Fields residential streets. Hackney consistently ranks as London's most creative borough by employment sector, with the highest proportion of arts, culture, and creative industry workers per resident.`,
      nightlife: `Dalston is one of London's most active late-night postcodes. Brilliant Corners (Kingsland Road — a legendary jazz bar with arguably the best sound system in London), Voodoo Ray's (Gillett Square — late-night pizza and rum), Dalston Superstore (Kingsland Road — LGBTQ+ bar and club, 24-hour licence at weekends), and The Nest (Stoke Newington Road — electronic music, intimate). Ridley Road Market Bar (an actual bar within the market — unusual urban concept). Broadway Market at night: The Cat & Mutton (Broadway Market — a proper mid-Victorian corner pub) and pub gardens along the canal. CLF Art Café at the Bussey Building (Peckham) and FOLD (Canning Town) attract E8 residents for larger club events.`,
      marketComment: `E8 is past the early-stage gentrification phase but still offers value relative to E2 (Bethnal Green) and N1. The best buys are Victorian terraces on the London Fields grid — Martello Street, Ada Street, Wilton Way — which have the strongest long-term hold characteristics and command genuine premium in the E8 market. Converted warehouse and industrial units (Netil Market-adjacent) offer loft appeal but watch service charges and management company quality. Dalston properties sell at a modest discount to London Fields equivalents (the differential reflects the noisier commercial environment) but should compress over time. Average days on market in E8: 30–45 days — faster than the inner London average, indicating healthy underlying demand. The Hackney South & Shoreditch regeneration corridor (E2/E8 border) continues to push values northward.`,
      residentSentiment: `E8 generates some of the most evangelical residents in London. Broadway Market Saturday is cited in almost every buyer and resident review as a transformative weekly ritual — "it's the reason we bought here" appears in multiple estate agent testimonials. Mumsnet threads on E8 since 2022 are broadly positive about the schools improvement narrative (Mossbourne consistently cited) and the Lido. The criticisms that recur: Dalston's noise on weekend nights affecting northern E8 streets; the feeling that "Hackney is pricing out the people who made it interesting"; and anxiety that the independent character of Broadway Market is under commercial pressure. A 2024 Time Out feature named E8 as one of London's 10 most desirable places to live — and the comments section was split between "absolutely" and "it's already gone."`,
    },

    SE1: {
      schoolsRating: 7.9,
      safetyRating: 7.7,
      transportRating: 9.7,
      walkability: 9.5,
      character: `SE1 spans several distinct sub-neighbourhoods along London's South Bank. The South Bank/Waterloo end is an iconic riverside promenade with the National Theatre (Lasdun, 1976), Hayward Gallery, and BFI Southbank — heavily trafficked by tourists but with a genuine residential community behind it on the post-war estates and newer riverside conversions. Borough/London Bridge is the geographic heart: Stoney Street and the Cathedral Precinct offer a remarkably tranquil pocket behind the railway arches; Trinity Church Square (a Georgian square of almost perfect preservation) sits moments from the bustle of Borough Market. Bermondsey Street (SE1 3) is the postcode's most sought-after residential address — converted Victorian warehouses and former tanneries housing galleries, restaurants, and boutiques in a human-scale strip that estate agents describe as a "laid-back urban village." Shad Thames — the former spice warehouse district behind Tower Bridge — is a conservation area of cast-iron aerial walkways and converted riverside apartments.`,
      amenities: `Borough Market (SE1 — operating since 1276, Tuesday–Saturday, one of the world's great food markets). Maltby Street Market (SE1, Saturdays) is the artisan producers' market that grew from Borough Market overflow — widely considered the better experience for serious food buyers. White Cube Gallery (Bermondsey Street) is a world-class contemporary art institution. The Garrison gastropub (Bermondsey Street), Café Murano (Bermondsey Street — 1 Michelin star, Angela Hartnett's Italian), and Pizarro (Bermondsey Street — José Pizarro's Spanish restaurant) are neighbourhood anchors. Padella (Borough Market — exceptional fresh pasta, queue-only, cash only). WatchHouse coffee (multiple SE1 locations). Bermondsey Beer Mile (6 independent breweries within 0.5 miles on Druid Street, Bermondsey Street, and Enid Street — open weekends).`,
      greenSpace: `Potters Fields Park (4.7 acres, directly behind City Hall — planted by Piet Oudolf, with one of the best views of Tower Bridge in London). Bermondsey Spa Garden (4.5 acres, Grange Road — a genuine community park with orchard and allotments). Trinity Church Square Garden (residents-only). The Thames Path is the dominant green-blue asset — the South Bank riverside walk from Westminster Bridge to Tower Bridge passes entirely through SE1. Burgess Park (56 acres, SE5 — 1.5 miles south) is the nearest large park.`,
      transport: `Outstanding Zone 1 connectivity for a south London postcode. London Bridge (Jubilee, Northern lines, and National Rail — Thameslink to Gatwick 30 min, Brighton 58 min, Bedford direct). Bermondsey (Jubilee — Zone 2, 4 minutes to Canary Wharf — the fastest connection of any residential postcode). Borough (Northern — Zone 1). Waterloo (Bakerloo, Jubilee, Northern, Waterloo & City, National Rail — the UK's largest station). Elephant & Castle (Northern, Bakerloo) at the southern edge. Journey to Bank: under 5 min. Canary Wharf: 4 min (Jubilee from Bermondsey). Heathrow: ~45 min (Jubilee/Piccadilly interchange).`,
      schools: `Boutcher C of E Primary School (Outstanding — one of the most sought-after primaries in Southwark). Charles Dickens Primary (Outstanding — Lant Street, where Dickens himself lodged as a child). St Michael's Catholic College (Outstanding — June 2025 Ofsted inspection rated Outstanding in all five categories). Oasis Academy South Bank (Good — Waterloo area). Independent secondary options are limited within SE1: Alleyn's School and James Allen's Girls' School (both SE22, Dulwich — 20 min by bus) serve the more aspirational end of the SE1 family buyer market. Southwark Council has invested significantly in early years provision.`,
      demographics: `Southwark borough: 29% homeownership — well below the national average, reflecting a historically renter-dominated postcode. Average household income: ~£52,000. Crime is elevated but typical for a Zone 1 postcode adjacent to major transport hubs — the main issues are phone theft near London Bridge station and tourist pickpocketing around Borough Market. Residential streets away from the tourist spine score considerably better. The demographic has shifted markedly: SE1 riverside tower developments (One Tower Bridge, NEO Bankside) attract City professionals and international investors; Bermondsey Street has drawn creative and media sector buyers; Waterloo remains more transient and renter-dominated.`,
      nightlife: `The National Theatre (SE1) and Royal Festival Hall (SE1) are world-class arts venues with year-round programming. The BFI Southbank (SE1) hosts the London Film Festival. Bermondsey Street's evening economy is the postcode's most characterful: Bar Tozino (SE1, a serious sherry bar), Bermondsey Arts Club, Jose tapas bar (Bermondsey Street, José Pizarro — cash only, always busy). The Flat Iron Square (Union Street) and Vinegar Yard (St Thomas Street) are popular Friday-evening container-park venues. The Anchor (Bankside — a 14th-century riverside pub) and The George Inn (Borough High Street — London's only surviving galleried inn, NT-owned) are historic SE1 pubs of genuine significance.`,
      marketComment: `SE1 offers genuine value relative to equivalent-specification properties north of the river — a £1m flat in NEO Bankside would command 15–20% more if it were in SW3. The waterfront premium is real and durable: target properties with Thames views or Bermondsey Street addresses for the strongest long-term hold. Avoid new-build towers in the Southwark Council-adjacent corridor (Borough Road, London Road) where management disputes with freeholders over maintenance standards are documented. The Bermondsey capital growth story: the arc from Maltby Street to Old Jamaica Road remains genuinely transitional. Service charge escalation on riverside towers is the most frequently documented financial risk in SE1 buyer surveys — scrutinise 3-year historic service charge accounts before proceeding.`,
      residentSentiment: `SE1 buyers are among the most articulate about their purchase rationale — "the best food market in the world, a 4-minute Tube to Canary Wharf, and half the price of Notting Hill" is a recurring formulation in estate agent testimonials. Bermondsey Street has its own resident identity: a 2025 Time Out feature quoted multiple residents describing "a genuinely local neighbourhood feel that you don't expect this close to London Bridge." The main frustrations documented: weekend tourist volumes around Borough Market affecting parking and noise on adjacent residential streets; the absence of a large supermarket within SE1 (the nearest full Waitrose is SE11 or EC1); and the view — shared by many long-term residents — that rapid new-build development is "homogenising what made this interesting."`,
    },

    EC1: {
      schoolsRating: 8.2,
      safetyRating: 8.2,
      transportRating: 9.7,
      walkability: 9.6,
      character: `EC1 — Clerkenwell and Farringdon — is London's historic artisan and creative district. Clerkenwell was for 300 years home to watchmakers, goldsmiths, and printers; it now hosts the highest concentration of architects and creative agencies in the world — a fact repeatedly cited in RIBA surveys. Clerkenwell Green, a triangular space of Georgian townhouses and the former Middlesex Sessions House (1779), retains the feel of a village centre. Exmouth Market (a pedestrianised street of restaurants and independent shops, buzzing at lunch) is the daily social hub. Hatton Garden — the global diamond and jewellery wholesale quarter — runs along the eastern edge. Smithfield Market (one of Europe's largest meat markets, currently relocating to Dagenham) occupies a Victorian Gothic structure of extraordinary quality. The proximity to the City of London (5 minutes' walk to Barbican, 10 to St Paul's) gives EC1 a dual identity: creative village by day, financially-adjacent by commute.`,
      amenities: `Exmouth Market: Moro (Moorish-Spanish, a landmark since 1997), Caravan (coffee roastery and restaurant), Berber & Q (Middle Eastern grill), The Quality Chop House (1869 Victorian dining room, now a modern bistro). Leather Lane Market (weekday lunchtime — cheap street food, one of London's longest-running street markets at over 400 years). Ye Olde Mitre (Ely Court — a pub since 1546, technically still in a Cambridgeshire enclave of the City of London, hidden down an alley off Hatton Garden). Scotti's Snack Bar (Hatton Garden — a 1960s Italian café, cash only, unchanged). Barbican Centre (EC2, adjacent — world-class theatre, cinema, and concert hall within 5 minutes' walk).`,
      greenSpace: `Spa Fields (EC1R — a modest green space but valued in this dense urban postcode). St John's Gardens (EC1 — a formal garden on the site of a 12th-century priory). Bunhill Fields (EC1Y — a 17th-century burial ground turned urban park: William Blake, Daniel Defoe, and John Bunyan are buried here — a remarkable piece of open space in the City fringe). The Barbican's lakeside gardens and ornamental pools are accessible. Islington's green network starts immediately north of EC1. The significant trade-off in EC1: limited large-scale green space compared to NW3, N1, or SE1.`,
      transport: `Farringdon is the postcode's superstation: Circle, Metropolitan, Hammersmith & City lines plus the Elizabeth line (Crossrail) — providing direct services to Heathrow T5 (38 min), Canary Wharf (9 min), Paddington (9 min), Liverpool Street (6 min), and Reading. Angel (Northern — Zone 1) serves the north of EC1. Barbican (Circle, Metropolitan, Hammersmith & City) and Old Street (Northern) serve the east. Clerkenwell Road and Farringdon Road are designated Quietway cycling routes with protected lanes — EC1 is one of the most cycle-friendly postcodes in London. Journey to Bank: under 10 min. Canary Wharf: 9 min. Heathrow T5: 38 min (Elizabeth line).`,
      schools: `Hugh Myddelton Primary School (Outstanding — within EC1, one of Islington's best state primaries). Christopher Hatton Primary (Good, Hatton Garden). Moreland Primary (Good, Old Street). Secondary: the nearest Outstanding state secondaries are in N1 (Elizabeth Garrett Anderson) and EC2 (City of London School for Girls). Charterhouse Square School (independent, EC1M — ~£18,000/year, founded 1leware) is the most prestigious private option within the postcode. City of London School (independent, EC4 — ~£22,000/year boys) is a 10-minute walk. Islington performs well as an LA on school outcomes.`,
      demographics: `EC1 is the home postcode of choice for architects, creative directors, designers, and City-fringe professionals who value urban intensity over residential quietude. The proportion of single-person and childless couple households is among the highest of any London postcode. Homeownership rates are low — EC1 is a predominantly rented postcode. Violent crime is approximately 80–100% of the England average — lower than the City of London's inflated figures (which are distorted by the tiny resident population) and lower than neighbouring E1 or EC2. Rental demand from City workers and the creative sector makes EC1 one of London's strongest BTL postcodes: vacancy rates are consistently below 3%.`,
      nightlife: `St John (St John Street — Fergus Henderson's restaurant, opened 1994, credited with launching the nose-to-tail cooking movement; World's 50 Best Restaurants alumnus) is one of the UK's most influential restaurants. The Quality Chop House (1869) and Moro are EC1's other dining institutions. The Jerusalem Tavern (Britton Street — a Fuller's Smith Turner tied pub in a remarkable 18th-century building, technically the smallest pub in EC1) is the neighbourhood local of choice for architects and journalists. Fabric (Charterhouse Street — the UK's most internationally famous club night, 24-hour licence, world-class bookings — reopened 2017 after temporary closure). The Tent in Exmouth Market and Grapes on Leather Lane serve the weekday office crowd. Barbican Artistic events and LSO concerts are a 5-minute walk.`,
      marketComment: `EC1 is one of the best postcode plays in inner London for BTL: City worker proximity, Elizabeth line (Farringdon), and permanent creative sector demand combine to deliver consistent gross yields of 3.5–4.5%. Converted loft spaces (former warehouse, former office) outperform new-build apartment schemes on both rental premium and capital appreciation. Service charge management in conversion buildings varies enormously — commission a detailed service charge history review (3 years minimum) before exchange. The Farringdon East and City fringe (EC1M/EC1V) areas continue to benefit from the Elizabeth line effect. Avoid basement conversions without approved natural light solutions — they tend to let poorly and have weaker capital performance.`,
      residentSentiment: `EC1 residents are remarkably consistent in their assessments. The phrase "my preferred location in central London — all the advantages without the drawbacks" has appeared in multiple independent resident surveys, most recently a 2024 Crystal Roof review. The combination of Exmouth Market for daily life, Farringdon's Elizabeth line for mobility, and the creative sector cluster for professional identity generates strong attachment. The criticisms that surface: "green space is the big compromise — you're a bus or bike ride from anything decent"; "it's getting expensive very fast as the Elizabeth line effect continues to push prices up from Canary Wharf buyers"; and the perennial EC1 complaint: "Farringdon is incredible but they've closed every independent café in favour of chains in the last 5 years."`,
    },

    M1: {
      schoolsRating: 7.8,
      safetyRating: 6.8,
      transportRating: 9.4,
      walkability: 9.2,
      character: `M1 — Manchester City Centre, Ancoats, and the Northern Quarter — is the Northern Powerhouse's most concentrated urban residential district. Ancoats, named by Time Out as one of the world's coolest neighbourhoods, has transformed from the world's first industrial suburb (circa 1800) to a benchmark urban regeneration story: Grade II* listed Victorian mills converted to premium loft apartments alongside Cutting Room Square (the postcode's social heart, with outdoor tables, independent cafés, and restaurants in a reclaimed industrial plaza). The Northern Quarter (NQ) is Manchester's Shoreditch: Tib Street and Oldham Street are lined with record shops (Vinyl Exchange, Eastern Bloc), vintage clothing, street art, and independent cafés. The NOMA district (NW of the City Centre, N1) is developing as a tech and media campus anchored by Co-op's headquarters and incoming tech tenants.`,
      amenities: `Mackie Mayor (Cutting Room Square, Ancoats — a restored Victorian market hall now housing some of Manchester's best independent food and drink traders: Elnecot, Federal Coffee, Rudy's Neapolitan Pizza). The Northern Quarter's Thomas Street and Oldham Street: home to Pollen Bakery (one of the UK's most acclaimed sourdough bakeries), Takk Coffee (Scandi café), and Ezra & Gil. Manchester's Chinatown (George Street, M1 — the UK's second-largest after London) is 5 minutes' walk. Arndale Centre and Market Street provide comprehensive high-street retail. Vero Moderno (Ancoats, an Italian specialist deli and restaurant) is a neighbourhood institution. Piccadilly Records (Piccadilly Steps) is internationally recognised as one of the best independent record shops in the world.`,
      greenSpace: `Ancoats Green (Cutting Room Square area — a newly created linear park as part of the regeneration) and the Rochdale Canal towpath running through Ancoats provide the primary green infrastructure. Piccadilly Gardens (Piccadilly, M1 — currently being redesigned following the failed 2002 pavilion) is undergoing phased improvement. Heaton Park (600 acres, 4 miles north by Metrolink) is Manchester's largest park. The Northern Quarter's green provision is limited — the area is dense and urban by design. Canal towpaths (Rochdale and Ashton) are the most used daily active-travel corridors.`,
      transport: `Manchester Piccadilly (National Rail — London Euston from 1h59 fastest, Virgin/Avanti; Birmingham New Street ~78 min; Leeds ~58 min; Edinburgh ~2h20). Manchester Victoria (Northern Rail, Trans-Pennine Express, Metrolink tram stop). Metrolink trams from Piccadilly Gardens (Zone A — M1) serve the Airport (30 min), MediaCityUK/Salford Quays (25 min), and across Greater Manchester. Journey to London Euston: fastest 1h59 (Avanti West Coast). Manchester Airport: ~30 min (Metrolink direct). Liverpool Lime Street: ~45 min (Northern Rail).`,
      schools: `Manchester Grammar School (independent boys' — one of the UK's highest-performing schools nationally, ~£14,694/year 2025/26 fees; in M13, accessible by bus or Metrolink). Withington Girls' School (independent, M20, ~£15,528/year — similarly nationally ranked). Chetham's School of Music (M3, adjacent to M1 — world-famous specialist music school; a significant proportion of places are funded/bursaried). State secondaries in M1/M4 area: Manchester Academy (Good), Connell Sixth Form College (Good). The nearest Outstanding state secondaries are in outer Manchester (Altrincham Grammar, Stretford Grammar — Grammar School Act protected). Most M1 professionals with children access Manchester Grammar/Withington or commute children to Trafford's grammar schools.`,
      demographics: `M1's residential population is predominantly young professionals (22–40), students from the University of Manchester and Manchester Metropolitan University (combined ~75,000 students across the city), and creative/media workers. Ancoats in particular has attracted a higher-income professional demographic — HSBC, Co-op, and BCG Platinion employees are among the building-level employer profile. Ancoats & Beswick ward is the 6th least deprived in Manchester (out of 32 wards). City-centre crime statistics are very high per 1,000 population but are heavily skewed by the commercial nature of the district — the Northern Quarter is considered safer than the Piccadilly core. Rental demand in M1 is the highest in the North of England: student demand alone is near-permanent, and occupancy rates above 95% are standard across the BTL market.`,
      nightlife: `Manchester has the best nightlife outside London. Mana (Blossom Street, Ancoats — 1 Michelin star, one of the UK's most acclaimed tasting menu restaurants). Erst (Cutting Room Square, Ancoats — Bib Gourmand, natural wine and small plates). Federal Café, Rudy's Pizza, and Elnecot in Mackie Mayor. The Northern Quarter's music venues: The Deaf Institute (Grosvenor Street), Band on the Wall (Swan Street — one of the UK's premier jazz and world music venues, recently renovated), The Peer Hat (Faraday Street — tiny, eclectic, legendary). The Warehouse Project (Mayfield Depot, M12 — 10,000 capacity, September–January season, internationally significant programming). Canal Street LGBTQ+ Village: one of Europe's most celebrated gay quarters, 100m from M1.`,
      marketComment: `M1 offers the most compelling investment case outside London for yield-focused buyers. Gross BTL yields of 5–7% in Ancoats and the Northern Quarter are achievable at current pricing and are supported by the near-permanent student and young professional rental base. Converted mill buildings (Crusader Mill, Stubbs Mill, Royal Mills) consistently outperform purpose-built residential towers on both rental premium and capital appreciation — the heritage premium is persistent in Manchester. Service charge trajectories in taller new-build blocks deserve scrutiny; several M1 towers have seen charges increase 40–60% over 5 years. The NOMA and First Street developments continue to push values northward and southward. HS2's confirmed Manchester Piccadilly terminus (if the revised scope is maintained) would be a material catalyst for M1 values.`,
      residentSentiment: `Ancoats has generated enormous media coverage since Time Out named it a world's coolest neighbourhood — and residents are keenly aware of the attention. The dominant sentiment from Ancoats residents on Reddit's r/manchester: "it feels like a genuine community forming — people actually know their neighbours, which you don't expect in a new-build city-centre development." The most common criticism: "service charges are going up every year and the management company is unresponsive." Northern Quarter residents describe a different experience: more established, more independent-minded, more resistant to new development. The NQ's character is described as "the last place in Manchester that hasn't been branded" — and residents are protective of it. The food scene (Pollen, Rudy's, Elnecot) generates near-universal praise.`,
    },

    B1: {
      schoolsRating: 7.5,
      safetyRating: 7.2,
      transportRating: 8.8,
      walkability: 8.5,
      character: `B1 — Birmingham City Centre, the Jewellery Quarter (JQ), and Brindleyplace — covers two very distinct residential environments. The Jewellery Quarter (St Paul's Square and Hockley) is one of the UK's most compelling urban regeneration stories: a Georgian square of exceptional quality (St Paul's Square — one of the finest Georgian squares outside London, surrounded by converted Victorian workshop terraces) surrounded by the remnants of the world's most concentrated jewellery manufacturing district (approximately 40% of UK jewellery is still produced here). JQ workshop conversions — loft apartments in former gold and silversmith premises — have attracted a creative and young professional demographic. Brindleyplace is Birmingham's waterfront business and leisure district: large-format restaurants, national-chain bars, and office buildings arranged around the canal basin. Less characterful than JQ but well-connected and increasingly residential.`,
      amenities: `JQ: 1000 Trades (Frederick Street — an exceptional craft beer and food pub, widely regarded as one of Birmingham's best); Lasan Restaurant (George Street — Michelin Guide-listed, modern Indian); The Lord Clifden (Great Hampton Street — a Victorian pub operating since 1862, live music at weekends); St Paul's Square monthly market; Kanteen (Frederick Street — highly regarded brunch spot). Brindleyplace: The Mailbox (one of Canal Street's premium retail and restaurant centres, with Harvey Nichols Birmingham); Brindleyplace restaurants (Chez Amis, Chung Ying, La Tasca); National Indoor Arena (major concerts and events). Birmingham Museum and Art Gallery and Symphony Hall are both within 10 minutes' walk of B1.`,
      greenSpace: `St Paul's Square (the JQ's centrepiece — a Grade II* listed Georgian square with a formal garden and the church of St Paul's, 1779) is the primary daily green space in B1. Birmingham Canal system (the UK's most extensive urban canal network — more miles of canal than Venice) runs directly through B1 and Brindleyplace, with restored towpaths providing walking and cycling. Centenary Square (post-2019 redesign) is a major civic public realm space with fountains. Cannon Hill Park (80 acres, B12 — 2 miles south, home to the MAC arts centre and Birmingham Wildlife Conservation Park) is accessible by bus or cycle in 15 minutes.`,
      transport: `Birmingham New Street (National Rail — London Euston fastest ~1h19, average ~1h32; Bristol Temple Meads ~67 min; Manchester Piccadilly ~78 min; Edinburgh ~3h). Birmingham Snow Hill (10-minute walk from JQ — Chiltern Railways to London Marylebone from 1h46; West Midlands Metro tram). HS2 Curzon Street Station (under construction in B4 — projected to open approximately 2033, reducing London Euston journey to ~52 minutes — the transformative future infrastructure event for B1 residential values). Journey to London Euston: fastest ~1h19. Manchester: ~78 min. Heathrow: ~1h40 (by train via London or direct National Express coach, ~2h).`,
      schools: `King Edward's School (Edgbaston, B15 — independent boys', one of the UK's highest-performing schools, ~£17,000/year; accessible from B1 by bus in ~20 min). King Edward VI High School for Girls (Edgbaston, B15 — sister independent school, ~£17,000/year). The King Edward VI Grammar Schools network (6 selective state schools across Birmingham — some of the best-performing state schools in the country; nearest to B1: King Edward VI Camp Hill Boys and Girls in B14, bus-accessible). Hamd House School (independent Islamic, B1 border — ~£16,000/year, Good Ofsted). University of Birmingham and Aston University proximity means a large graduate talent and rental market.`,
      demographics: `JQ residents consistently describe the area as safe by Birmingham city-centre standards — Reddit's r/brum discussion threads specifically cite JQ as "never felt unsafe late at night" compared to the Broad Street entertainment strip. The JQ demographic is predominantly creative professionals, architects, and independent business owners aged 25–40. Brindleyplace attracts HSBC UK employees (who relocated their national HQ to B1 in 2018, bringing ~5,000 jobs) and PwC/Deloitte City staff. Owner-occupier rates are growing but BTL remains dominant in the postcode. Birmingham's population is the youngest of any major UK city (median age ~32) — a structural positive for the rental market.`,
      nightlife: `B1's nightlife is bifurcated. Broad Street is Birmingham's mainstream entertainment strip — predominantly chain bars, night clubs, and late-licence venues (Revolucion de Cuba, The Botanist, Tiger Tiger). The JQ has a very different character: 1000 Trades, The Lord Clifden, and The Victoria (John Bright Street) provide quality-focused drinking; Adam's Restaurant (Waterloo Street — 2 Michelin stars, one of the finest tasting menu restaurants in the UK) and Opheem (Summer Row — 1 Michelin star) are a 10-minute walk. Symphony Hall (Broad Street — world-class acoustics, home of the CBSO) and Birmingham REP (Centenary Square) provide serious arts programming. Printworks Birmingham (Digbeth, B12) is the city's most serious club venue.`,
      marketComment: `B1 is the most compelling regional city investment case in the UK for medium-term capital growth. The HS2 Curzon Street Station effect (opening ~2033, ~52 min to London) is a structural demand driver not yet fully priced in — history suggests property values within 1km of new major rail infrastructure appreciate 10–25% above baseline in the 5 years prior to and following opening. JQ conversions (Vyse Street, Spencer Street, Hockley Hill) are the premium product: target heritage conversion buildings over purpose-built residential towers for superior capital appreciation. Gross BTL yields of 5.5–7.5% in B1 are supported by the permanent student and professional rental base. The B4 Digbeth area (immediately east) is the next regeneration frontier — watch closely as HS2 Curzon Street construction activates surrounding land values.`,
      residentSentiment: `JQ residents are among Birmingham's most vocal property advocates. Reddit's r/brum regularly features threads asking "best place to live in Birmingham city centre?" — JQ tops almost every response, with specific praise for St Paul's Square ("it looks like Bath, not Birmingham"), 1000 Trades, and the "village feel within a city." The frustrations cited: "the JQ is great but everything else in Birmingham city centre is a bit disappointing culturally compared to Manchester or Leeds"; Birmingham's public transport infrastructure outside the new tram network is considered inadequate; and several residents note that Broad Street's weekend nightlife creates noise issues for properties on its periphery. The HS2 question polarises: some residents cite it as the reason they bought; others worry about the disruption of 8+ years of construction in B4.`,
    },

    LS1: {
      schoolsRating: 7.6,
      safetyRating: 6.9,
      transportRating: 8.6,
      walkability: 8.9,
      character: `LS1 — Leeds City Centre — is compact enough to walk across in 5 minutes: a concentrated Victorian core of Grade I and II listed buildings of exceptional quality. The Victoria Quarter (a 19th-century arcaded shopping street roofed with stained glass — regularly cited as one of the most beautiful indoor shopping streets in the UK) is the aesthetic centrepiece. The Corn Exchange (1864 — a domed elliptical hall by Cuthbert Brodrick, now housing independent food and retail) is architecturally extraordinary. Granary Wharf (the canal basin development between the station and the river) is the most dynamic residential and leisure area — new apartment buildings alongside independent restaurants, bars, and weekend markets on the towpath. Holbeck Urban Village (LS11, adjacent) is a Victorian industrial quarter in ongoing regeneration — former textile mills converted to creative workspace, with the Round Foundry development as a centrepiece.`,
      amenities: `Victoria Quarter: Harvey Nichols Leeds (opened 1996 — the first Harvey Nichols outside London), Vivienne Westwood, independent boutiques, and Bettys Tea Rooms (a Yorkshire institution since 1919 — queues at weekends). Trinity Leeds: John Lewis, M&S, Zara, and a comprehensive F&B offer. Kirkgate Market (the UK's largest covered market, open 6 days — a Victorian market of genuinely grand scale with a bronze statue of the young Michael Marks who started his Penny Bazaar here in 1884). Granary Wharf's SALT Beer Factory and Dark Arches restaurant strip. Bundobust (Mill Hill — Indian street food and craft beer, a Leeds original with national expansion). Belgrave Music Hall and Canteen (Cross Belgrave Street — rooftop bar, food market, record shop, cinema in one building).`,
      greenSpace: `Granary Wharf canal towpath runs the length of LS1 — connecting the Leeds-Liverpool Canal westward to Saltaire (15 miles) and the Aire & Calder Navigation eastward. Woodhouse Moor/Hyde Park (28 acres, LS6 — a 20-minute walk north, a Victorian park with bandstand, skate park, and the dominant green space for University of Leeds students and LS1/LS2 residents). Roundhay Park (700 acres, LS8 — 4 miles north; Lake, Tropical World, and events venue including Leeds concerts) is the city's flagship park. Armley Park (LS12, west) and Cross Flatts Park (LS11, south) provide additional green access. Green space within LS1 itself is limited.`,
      transport: `Leeds railway station (National Rail — London King's Cross fastest ~2h10 by LNER; Manchester Piccadilly ~57 min; Edinburgh ~2h21; Birmingham ~1h40). The station sees approximately 40 direct London services daily on LNER and Avanti. Bus connectivity is managed by First Leeds — Headrow and The Calls are the main city-centre bus hubs. West Yorkshire Combined Authority's Mass Transit scheme (light rail/tram network — subject to government approval, anticipated early 2030s decision) would transform LS1 connectivity. Leeds Bradford Airport is approximately 8 miles northwest: 25 minutes by taxi or National Express.`,
      schools: `Grammar School at Leeds (GSAL — independent co-ed, Harrogate Road LS17, ~£16,000/year; 70.2% GCSE grades 9–7, the highest of any Leeds school in 2024). Roundhay School (state comprehensive, Outstanding — LS8, bus-accessible from LS1; consistently one of Yorkshire's highest-performing state secondaries). Boston Spa Academy (Outstanding state secondary — East Leeds, slightly further but accessible). Leeds City Academy and Cockburn John Charles Academy are the central/south Leeds state secondary options. Parkside School (Good, Stanningley Road) and Swallow Hill Community College serve the immediate west. Note: Leeds has no remaining grammar schools — the selective state option disappeared when most Ridings schools went comprehensive.`,
      demographics: `Leeds has the youngest average urban population of any major English city outside London — median age approximately 30–32 in LS1. The Financial services sector (First Direct, HMRC Digital, Eversheds Sutherland, KPMG) employs a significant proportion of LS1 residents. Three universities (University of Leeds, Leeds Beckett, Leeds Arts University — combined ~70,000 students) create permanent rental demand. Crime statistics are high (Leeds city centre ranks among the highest in Yorkshire for burglary) but residents describe daily life as safe and compact — crime is concentrated around specific hotspots (Kirkgate at night, Briggate late-night) and the statistical elevation is partly driven by the student population and nightlife economy.`,
      nightlife: `Leeds consistently places in UK top-5 nightlife city rankings. Call Lane and The Calls are the city-centre bar strips — Belgrave Music Hall (rooftop events, live music), Headrow House (rooftop bar with live performances), Lost in the Lane (Call Lane — cocktail bar). For quality dining: The Man Behind the Curtain (Vicar Lane — 1 Michelin star, avant-garde tasting menu), Crafthouse and Angelica (rooftop restaurants in the Trinity Leeds development with city views), Bundobust, and SALT at Granary Wharf. The Brudenell Social Club (LS6, Hyde Park — not in LS1 but 15 min walk) is one of the UK's most-loved small music venues — Arcade Fire, PJ Harvey, and Alt-J have all played there in their early careers. Leeds Festival (Bramham Park, August Bank Holiday) is one of the UK's largest annual music events.`,
      marketComment: `LS1 offers the UK's most compelling value-to-yield residential investment proposition outside Manchester. Gross BTL yields of 6–8.5% in LS1 new-builds and Victoria-era conversions are consistently achievable — underpinned by near-permanent student and professional demand. The South Bank regeneration (LS10/LS11 — the largest planning approval in Leeds history, 60+ acres of brownfield adjacent to the station) will deliver residential, commercial, and cultural infrastructure over 10–15 years: buy adjacent now for the infrastructure premium. Heritage conversions (Dock Street, Water Lane, Granary Wharf warehouse buildings) consistently outperform purpose-built residential towers on capital appreciation. The West Yorkshire Mass Transit approval — expected around 2030–2033 — would be a structural positive for all LS1 and adjacent postcode values.`,
      residentSentiment: `LS1 buyers tend to frame their decision in London comparison terms: "I looked at Zone 3 London vs Leeds city centre and Leeds won on every metric except the job market." This is a recurring formulation on r/leeds and r/HENRYUK (High Earner Not Rich Yet UK). The food and bar scene generates intense loyalty — Belgrave Music Hall, Bundobust, and the Victoria Quarter are cited in nearly every "why Leeds?" response. The criticisms: city-centre crime statistics generate anxiety despite residents' lived experience being safer than the numbers suggest; Leeds' cultural infrastructure (theatre, gallery) is seen as underpowered relative to Manchester and Bristol; and the Mass Transit delay is a persistent frustration — "we've been promised a tram for 20 years."`,
    },

    BS1: {
      schoolsRating: 7.8,
      safetyRating: 7.3,
      transportRating: 8.3,
      walkability: 9.0,
      character: `BS1 spans three distinct zones. The Old City (Welsh Back, Corn Street, King Street) is Bristol's medieval heart: Welsh Back is one of the only surviving cobbled streets in Bristol, lined with riverside bars and restaurants; Corn Street retains Victorian banking grandeur (the Corn Exchange of 1743, designed by John Wood the Elder, still stands); King Street hosts the Bristol Old Vic (the oldest continuously working theatre in the English-speaking world, operating since 1766), the Llandoger Trow (c.1664 — allegedly the pub where Daniel Defoe met Alexander Selkirk, the inspiration for Robinson Crusoe), and Queen Square (one of the finest Georgian squares outside London). The Harbourside is the transformation story: 82 acres of former working docks converted to a mixed residential, cultural, and leisure district since the 1990s — Wapping Wharf's CARGO container market, the SS Great Britain (Brunel's 1843 iron ship, now a museum), and Arnolfini Gallery define the character. Broadmead/Cabot Circus is the retail centre: more functional than characterful.`,
      amenities: `St Nicholas Market (Old City — a covered market trading since 1743, Tuesday–Saturday, with 50+ independent traders including the Glass Arcade). Wapping Wharf CARGO (Harbourside — two phases of repurposed shipping containers housing outstanding independent food and drink, including Woky Ko, Gambas, and Little Victories). Cabot Circus provides comprehensive retail: John Lewis, Selfridges (architecturally striking — a chain-mail aluminium façade by Chris Wilkinson), and M&S. Harbourside Farmers' Market (Wednesdays and Saturdays). The Bristol Museum and Art Gallery (Queen's Road — Banksy's home-city museum) and M Shed (Harbourside — Bristol's history museum, free entry) are cultural anchors. Whiteladies Road (BS8, 15-minute walk) provides the area's best independent restaurants.`,
      greenSpace: `The Floating Harbour (82 acres of water) is BS1's defining asset — a unique urban waterway with walking paths along the full perimeter, kayaking, paddleboarding, and the annual Harbour Festival (July, 300,000+ visitors). Brandon Hill (12 acres — immediately north of the Old City) provides elevated views over Bristol from Cabot Tower (1897) and a formal park with botanical planting. Queen Square (Grade I listed, BS1) functions as a public garden. Ashton Court Estate (850 acres, BS3 — 2 miles south) is Bristol's equivalent of Richmond Park: deer, mountain bike trails, golf, and events. Castle Park (BS1 — 9 acres, where Bristol Castle stood before the Civil War) provides central green space.`,
      transport: `Bristol Temple Meads (National Rail — London Paddington fastest 1h29 by GWR; Cardiff Central ~47 min; Birmingham New Street ~67 min; Manchester ~2h15 via Birmingham). Bristol Bus Station (Marlborough Street, BS1) handles National Express and local First West of England buses. Metrobus rapid transit serves the Temple Quarter. Bristol Airport is 8 miles south (~30 min by taxi or Airport Flyer bus from Broad Quay). The critical limitation: Bristol has no metro or light rail system — the West of England Combined Authority's proposed Bristol Mass Transit (a tram/BRT network) is in development but a confirmed delivery timeline is not yet established. This infrastructure gap is frequently cited as Bristol's primary competitive disadvantage relative to Birmingham, Leeds, and Edinburgh.`,
      schools: `Bristol Cathedral Choir School (state academy — Good Ofsted; specialist music provision, choir school for Bristol Cathedral). St Mary Redcliffe and Temple C of E School (Good comprehensive — one of Bristol's higher-performing state secondaries). Independent: Clifton College (full co-ed boarding and day, ~£37,000/year boarding; produces a high proportion of elite university entrants). Bristol Grammar School (independent, BS8 — ~£19,500/year day; excellent academic record, accessible by bus from BS1 in 20 minutes). Badminton School (girls' boarding, BS9) and The Red Maids' School are independent alternatives. University of Bristol (Russell Group) and University of the West of England are major educational employers within 2 miles.`,
      demographics: `BS1's residential population is younger than the Bristol average: media professionals (Channel 4 relocated its national HQ to Finzels Reach, BS1, in 2021 — bringing approximately 300 senior editorial jobs), creative sector workers (Aardman Animations, BBC Bristol, ITV West are all within the city), and FinTech professionals (Bristol is the UK's second-largest FinTech hub after London). Crime in BS1 is elevated: Hotwells/Harbourside sector runs at approximately 337 per 1,000; Central Bristol at ~325 per 1,000 — driven primarily by nightlife and tourist activity on weekend evenings. Residential streets off the main arteries are considerably safer. Owner-occupier rates are growing as the Harbourside demographic matures.`,
      nightlife: `Bristol's music scene is its defining cultural export: trip-hop (Massive Attack, Portishead, Tricky — all BS1/BS3 origin), drum and bass, and a sustained independent music tradition. Motion (Avon Street, BS2 — 3,000 capacity, one of the UK's most respected clubs for electronic music). SWX (Nelson Street, BS1 — live music and club). Thekla (The Grove, Harbourside — a floating venue on a converted 1958 cargo ship, one of Bristol's most beloved music destinations). Restaurant: Casamia (Westbury-on-Trym, 2 Michelin stars — arguably the West's finest tasting menu restaurant). Wilsons (Redland BS6 — natural wine and seasonal cooking, critically acclaimed). Flour & Ash (Bedminster BS3 — wood-fired pizza of outstanding quality). The Harbourside's Wapping Wharf strip is the premium casual-dining district: Gambas, Woky Ko, and Little Victories are consistently recommended.`,
      marketComment: `BS1 offers the UK's strongest lifestyle-value proposition outside London for buyers aged 30–50 in the creative and media sectors. Channel 4's relocation and the FinTech cluster have structurally strengthened the demand base. Harbourside waterfront properties with direct views of the Floating Harbour (Wapping Wharf, Gas Ferry Road area) command a durable premium that has held through both the 2008 and 2020 downturns. The primary risk is the absence of mass transit: if the West of England Combined Authority fails to deliver Bristol Mass Transit, growth will be transport-constrained relative to Birmingham and Leeds. Focus on conversion buildings and period properties in the Old City and Brandon Hill areas over new-build Harbourside towers. Clifton (BS8) is the established prime benchmark — buyers who outgrow BS1 city-centre living transition to Clifton, and pricing your entry point in BS1 with a Clifton exit path in mind is a sound long-term strategy.`,
      residentSentiment: `Bristol consistently tops UK lifestyle and liveability surveys — and BS1 residents are proud of it to the point of occasional smugness. The combination of the Harbour Festival, Wapping Wharf food scene, and access to countryside within 20 minutes of the city centre generates intense loyalty. On Mumsnet's Bristol boards, the recurring sentiment is "we moved from London and can't imagine going back." The criticisms are consistent: weekend noise on the Harbourside and in King Street (the bar strip); the absence of a large supermarket within BS1 (the nearest Waitrose is Clifton, 20 minutes' walk); and the city's public transport, described by almost every forum participant as "genuinely embarrassing for a city of this size." The Banksy question — regular new works appear in BS1 — generates annual media excitement that residents find both entertaining and slightly exhausting.`,
    },

    EH1: {
      schoolsRating: 8.5,
      safetyRating: 8.7,
      transportRating: 8.4,
      walkability: 9.5,
      character: `EH1 — Edinburgh Old Town and New Town — is Scotland's most prestigious residential postcode and one of Europe's great historic urban environments. The UNESCO World Heritage Site (inscribed 1995) covers both the medieval Old Town and the Georgian New Town collectively. The Old Town's Royal Mile (Castle to Palace of Holyroodhouse) is defined by medieval closes (narrow alleyways), tenement buildings rising 6–12 storeys (some of the earliest high-rise residential buildings in the world), and Hawksmoor-influenced baroque churches. The New Town (EH1/EH2/EH3) is the finest planned urban neighbourhood in the UK: Charlotte Square, Moray Place, and Heriot Row exemplify the Adam brothers' neoclassical vision of 1767. Edinburgh properties use Scottish legal conventions: Offers Over system (sealed bids at closing dates), missives rather than exchange of contracts, and Land and Buildings Transaction Tax (LBTT) rather than SDLT. Additional Dwelling Supplement (ADS) at 6% applies to second properties in Scotland. Commission a Scottish solicitor before proceeding.`,
      amenities: `Princes Street and George Street provide comprehensive retail: the recently expanded St James Quarter (2021, designed by BDP with a striking golden crescent roofline), Harvey Nichols Edinburgh, and independent Scottish retailers. Victoria Street (leading to the Grassmarket) is the most photographed independent shopping street in Edinburgh — Mr Wood's Fossils, Armchair Books, and McAlister Matheson Music within metres. The Grassmarket itself hosts a weekend market, independent bars, and restaurants. Waitrose (Comely Bank, EH4) and Sainsbury's (Murrayfield) are the nearest full supermarkets. The Scottish National Gallery (free entry), National Museum of Scotland (free entry — one of Europe's best science and history museums), and the newly opened Scottish National Gallery of Modern Art Three are cultural institutions of world standing within walking distance.`,
      greenSpace: `Princes Street Gardens (29 acres West, smaller East — at the foot of the Castle Rock, with a Ross Bandstand and the iconic Scott Monument, 61m). Holyrood Park (650 acres — directly from the Palace of Holyroodhouse end of the Royal Mile; includes Arthur's Seat, an ancient volcano rising to 250m with extraordinary city and Firth of Forth views). The Royal Botanic Garden Edinburgh (EH3, 25 minutes' walk — 70 acres of world-class planting, glasshouses, and café, free entry). The Water of Leith walkway (12-mile linear path from the Pentland Hills to Leith Docks) connects to EH1 near the Dean Village. Edinburgh has dramatically more usable and dramatic natural green space than any other major UK city.`,
      transport: `Edinburgh Waverley station (National Rail — London King's Cross fastest 4h10 by LNER direct; Glasgow Queen Street ~50 min; Inverness ~3h15; Manchester ~3h30). Edinburgh Trams (reopened and extended to Newhaven 2023) connect the city centre to the Airport (35 min from Princes Street) and north Edinburgh. Lothian Buses provide extensive city-wide coverage. Edinburgh Airport is 8 miles west: accessible by tram (35 min) or taxi (25 min). Note: EH1 is outside HM Land Registry England & Wales data coverage. Scottish residential transaction data is held by Registers of Scotland (ros.gov.uk). Commission a Law Society of Scotland-registered solicitor.`,
      schools: `Edinburgh Academy (independent boys' day, EH3 — ~£17,000/year; co-educational at some year groups). George Watson's College (independent co-ed, EH10 — ~£20,000/year; one of Scotland's highest-academically performing independent schools). Fettes College (EH4 — ~£44,000/year boarding; Tony Blair's alma mater, consistently top for Scottish Higher results). State: James Gillespie's High School (Edinburgh City — among the most academically competitive state comprehensives, strong Gaelic bilingual stream, Well-regarded for arts). Royal High School (EH7 — well-regarded, historic). Edinburgh operates a different system to England: Scottish Highers rather than A-Levels, SQA rather than Ofsted. University of Edinburgh is consistently top 30 globally — a major employer and demand anchor for the rental market.`,
      demographics: `EH1's resident population includes legal and financial professionals (Edinburgh is the UK's second-largest financial centre, home to Standard Life Aberdeen, Royal Bank of Scotland, and Baillie Gifford), Scottish Government workers (Holyrood is at EH99, adjacent), University of Edinburgh academics, and a significant international community. The Edinburgh Festival Fringe (August — the world's largest arts festival, approximately 3,700 shows) quadruples the city's population temporarily and creates the UK's most active short-let rental market. Average EH1 property values are significantly below London prime equivalents at comparable quality and size — international buyers increasingly recognise this value gap. Owner-occupier rates in New Town are substantially above the Scottish average.`,
      nightlife: `The Grassmarket and Cowgate are Edinburgh's historic late-night strips: Bow Bar (Victoria Street — possibly Edinburgh's best traditional pub, no music, no TV, outstanding whisky selection), White Hart Inn (Grassmarket — reputedly Edinburgh's oldest pub, 1516), Beehive Inn, and the Greyfriars Bobby statue (just outside, for the tourists). The Royal Mile hosts whisky bars (The Scotch Whisky Experience, Royal Mile Whiskies) and traditional restaurants. Fine dining: The Kitchin (Leith, 1 Michelin star — Tom Kitchin's flagship), 21212 (EH7 — Paul Kitching, 1 Michelin star). Edinburgh's literary festival (August), jazz festival (July), and international science festival all bring world-class programming to EH1 venues. The Traverse Theatre and Royal Lyceum are world-leading drama venues operating year-round.`,
      marketComment: `EH1 operates under Scots law — understand the process before viewing. The Offers Over system (sealed bids at closing dates, with the solicitor acting as estate agent) means properties routinely sell at 10–20% above the Home Report valuation in a competitive market — budget accordingly. The Old Town conservation requirements (UNESCO) restrict permitted development but preserve the character that underpins values permanently. New Town Georgian first-floor flats (the piano nobile — principal floors with the best proportions and light) consistently outperform attic and basement conversions on capital appreciation. The post-pandemic demand surge from London and international buyers has been sustained — Edinburgh residential values outgrew every UK city except London over the 5-year period to 2025. Engage a solicitor member of the Law Society of Scotland before viewing, not after.`,
      residentSentiment: `Edinburgh residents are the most consistently satisfied of any UK city in IPSOS MORI quality of life surveys — the combination of architectural beauty, compactness, cultural provision, and natural landscape generates a loyalty that surprises even longtime residents. The recurring phrases in resident testimonials: "I walk to work through a UNESCO World Heritage Site every day," and "London has more of everything except beauty." The frustrations: August is a mixed blessing — the Festival is beloved in principle but "the city doesn't belong to residents for six weeks." Princes Street is widely regarded as having declined relative to the New Town and Grassmarket character — "it looks like a generic high street dropped into the world's most beautiful city." The rental market is described as "genuinely brutal" by newcomers — vacancy rates in EH1 are below 1% and competition is intense.`,
    },

    OX1: {
      schoolsRating: 9.4,
      safetyRating: 8.8,
      transportRating: 8.2,
      walkability: 9.6,
      character: `OX1 — Oxford City Centre, the University Quarter, and Jericho — is unique in the UK: a medieval city that is simultaneously one of the world's great universities and a sought-after residential postcode. The High Street (universally known as "the High"), Broad Street, and Turl Street form one of the most architecturally remarkable continuous townscapes in Europe — Hawksmoor's Gothic towers, Wren's Sheldonian Theatre, and the Bodleian Library's 15th-century Schools Quadrangle within metres of each other. Jericho (northwest OX1/OX2 border) is Oxford's most characterful residential neighbourhood: Victorian terraces on Cardigan Street and Observatory Street, the Oxford University Press building (1826, the UK's largest university press, its staff defining the area's professional demographic), and Walton Street's independent cafés and the Phoenix Picturehouse. Port Meadow and Christ Church Meadow — two ancient common lands of combined 500+ acres — give Oxford a landscape relationship almost unmatched in any UK city.`,
      amenities: `The Covered Market (High Street — operating since 1774, 50+ permanent traders including Brown's Café, the original; Cakesmiths, Alpha Bar, an independent butcher and fishmonger). Gloucester Green Market (Wednesdays and Saturdays — organic produce, street food, books). The Bodleian Library Divinity School (open to day visitors) and Ashmolean Museum (free entry — one of the world's finest university art and archaeology museums; founded 1683, the world's first university museum). Walton Street (Jericho): independent bookshops, Gail's Bakery, Lorenz Adlon Esszimmer-level restaurants. The Cowley Road (CB1 border, OX4) is Oxford's multicultural high street: the best independent restaurant strip in Oxfordshire. Christchurch Cathedral (College) is a working cathedral within one of the world's most photographed college buildings.`,
      greenSpace: `Christ Church Meadow (46 acres — Grade I listed landscape, maintained by Christ Church College; open to the public year-round, with cattle grazing and river meadow walks along the Thames and Cherwell). Port Meadow (440 acres — OX2, a 10-minute cycle from OX1; ancient common land that has never been ploughed; flooding in winter creates one of the most remarkable wildlife landscapes near any UK city). University Parks (70 acres — formal parkland with cricket pavilion, arboretum, and River Cherwell boundary; open to the public). The Thames Path and Cherwell towpath give Oxford extraordinary riverside access in every direction.`,
      transport: `Oxford railway station (National Rail — London Paddington fastest 49 min by GWR; Birmingham New Street ~67 min; Bristol Temple Meads ~75 min; Manchester ~2h30). The X90/Oxford Tube coach to London Victoria operates every 10–15 minutes and takes approximately 90–100 minutes — popular as a cheaper alternative to GWR. Heathrow Airport: Oxford Bus Company's Airline service runs every 30 min direct to all Heathrow terminals, taking ~60–75 min. Oxford's Zero Emission Zone (city centre, expanded 2024) restricts private vehicles — cycling is the dominant transport mode for residents. Cycling mode share is the highest of any UK city: approximately 17% of all journeys (2021 census — significantly above Bristol at ~6% and London at ~3%).`,
      schools: `The Dragon School (Bardwell Road, OX2 — one of the UK's most famous prep schools, ~£33,000/year day for senior years; alumni include Michael Palin, Hugh Laurie, Emma Watson, and Tim Berners-Lee). Magdalen College School (Cowley Place, OX4 — independent boys' senior school; consistently in the UK top 10 for academic results, ~£28,800/year; direct University of Oxford pipeline). Oxford High School (GDST, OX2 — Outstanding independent girls' school, ~£17,000/year). State secondary: Cheney School (Outstanding, OX3, accessible by bus) is Oxford's best state comprehensive. Oxford Spires Academy (OX4) is another local option. The Cherwell School (OX2, Good) is the default secondary for many Jericho residents. Note: Oxfordshire has no selective grammar schools — the independent school network fills the academic selection role.`,
      demographics: `Oxford has the highest concentration of PhD holders per square kilometre of any UK city — approximately 15,000 University of Oxford staff (academics, researchers, administrators) alongside Brookes University. The demographic is strongly professional-academic: senior fellows, professors, medical consultants, and tech sector workers from the Oxford Science Park and Harwell clusters. A significant international community — Oxford's university draws academics and students from 150+ countries. Average household income in OX1 is above the UK median, but property values are extremely high — the premium reflects a structural supply constraint (Green Belt, conservation areas, flood plain) that has persisted for 40 years. Second-home ownership by London-based families is meaningful in north Oxford.`,
      nightlife: `Oxford's evening offer is calibrated to an intellectual demographic: quality-focused, early by London standards. The Bear Inn (Alfred Street — one of England's oldest pubs, trading since 1242, famous for its tie collection). The Turf Tavern (Bath Place — a 13th-century bar reached through a narrow medieval alley; supposedly where Bill Clinton "didn't inhale" and where Australian PM Bob Hawke set a world record for drinking a yard of ale). The Eagle and Child (St Giles' — known as "The Bird and Baby," the pub where Tolkien and C.S. Lewis's Inklings group met to discuss The Lord of the Rings and Narnia). Gees Restaurant (Banbury Road) and The Cherwell Boathouse (Bardwell Road) are garden-dining institutions. The Oxford Playhouse and New Theatre host national touring theatre and stand-up. Last orders typically 11pm — Oxford is not a late-night city.`,
      marketComment: `OX1 is a prime market with structural supply constraints that are among the most persistent in the UK. Planning restrictions (Metropolitan Green Belt boundary on three sides, conservation areas covering most of central Oxford, and Cherwell/Thames flood plains to east and south) have prevented meaningful new housing supply for 40+ years. The Oxfordshire Local Plan consistently underdelivers on housing targets — structurally positive for existing owners. The premium for properties within cycling distance of the city centre (within approximately 2 miles) over properties beyond 2 miles is approximately 25–40% — driven by the university-affiliated buyer demographic's preference for cycle commuting. Jericho Victorian terraces (Cardigan Street, Great Clarendon Street) offer the best combination of character, school access, and investment durability within OX1.`,
      residentSentiment: `Oxford residents are strongly bifurcated between the besotted and the frustrated. The besotted — the majority — describe cycling through Radcliffe Square or punting on the Cherwell as daily privileges that make the cost worthwhile. "We paid double what we'd pay in Swindon for the same house, and every day I understand why" is a recurring sentiment in buyer testimonials. The frustrated — mainly newcomers in the private rental market — describe an "absolutely ruthless rental market" where flats let within hours of listing, often above asking. The bicycle theft rate (225% of the national average — Oxford's most distinctive crime statistic) generates constant conversation: "chaining your bike to a lamppost is just a temporary storage solution." The secondary school question is a genuine anxiety for OX1 families: "the primary schools are outstanding, and then you either pay independent fees or accept a lot of uncertainty at 11."`,
    },

    CB1: {
      schoolsRating: 9.1,
      safetyRating: 8.8,
      transportRating: 8.5,
      walkability: 9.4,
      character: `CB1 — Cambridge City Centre, Petersfield, and the Station Quarter — is the UK's knowledge economy capital in residential form. Petersfield (the residential district east of Mill Road) is the postcode's most characterful neighbourhood: Victorian terraces on Sedgwick Street, Catharine Street, and Norfolk Street, many with original features intact and small walled gardens. Mill Road is CB1's most distinctive street: genuinely multicultural (Portuguese, Bangladeshi, Greek Cypriot, and Chinese businesses alongside independent cafés, bookshops, and food shops in an unbroken 1km strip), and the subject of a fierce ongoing campaign against chain supermarkets — residents successfully kept Tesco and Sainsbury's off the road for over a decade. The CB1 Estate (around the station) is a 2018-completed BREEAM Outstanding mixed-use development: contemporary architecture of genuine quality alongside the significantly upgraded Cambridge railway station.`,
      amenities: `Mill Road: CB1's defining high street — Relevant Records, The Petersfield pub (excellent real ale), Hot Numbers Coffee (roastery and café), Nandine (Kurdistani restaurant), and Arjuna Wholefoods (a vegetarian food shop operating since 1970 — the oldest of its kind in the UK). Cambridge Market Square (Mon–Sun — one of the UK's most continuously trading outdoor markets since the 1000s). The Fitzwilliam Museum (Trumpington Street — free entry, world-class art and antiquities collection: Titian, Rembrandt, Greek and Egyptian artefacts in a neo-classical building of staggering quality). Kettle's Yard (Castle Street — James Ede's extraordinary house of 20th-century art, free entry). Waitrose (Trumpington Street) and a Marks & Spencer handle premium grocery.`,
      greenSpace: `Parker's Piece (25 acres — a flat, beloved common where the Cambridge Rules of Association Football were first codified in 1848; used daily for cricket, football, and kite-flying). Cambridge University Botanic Garden (40 acres — free entry for Cambridge residents with postcode registration; one of the UK's finest botanic collections, with a winter garden of exceptional quality). The Backs (the meadows behind the river-facing colleges along the Cam — Backs Walk runs from Silver Street to Queen's Road, passing King's College Chapel; one of the finest pieces of designed landscape in England). Coe Fen and Sheep's Green (wetland nature reserve adjacent to the river — remarkable ecological habitat within 10 minutes' walk of CB1). Midsummer Common (24 acres) hosts the annual Strawberry Fair and Midsummer House restaurant.`,
      transport: `Cambridge railway station (National Rail — London King's Cross fastest 49 min by LNER; London Liverpool Street ~73 min by Greater Anglia; Stansted Airport ~30 min direct). The CB1 development directly fronts the station — residents can walk to the platform in under 3 minutes. Cycling is the dominant transport mode: Cambridge has the UK's highest cycling mode share at approximately 30% of all journeys (2021 census). Guided Busway (world's longest guided busway, to St Ives and Huntingdon) departs from the station. Stagecoach and Whippet buses serve the wider city. Future: East West Rail (Oxford–Cambridge link — under development, projected Cambridge station access by late 2020s) will significantly improve south/west connectivity.`,
      schools: `Parkside Community College (state secondary — Outstanding Ofsted; directly in CB1, one of Cambridge's best comprehensives; strong arts and music programme). Hills Road Sixth Form College (CB2, 10-minute cycle — one of the UK's highest-performing state sixth forms; A-level results rival selective independent schools nationally; free admission). The Perse School (Hills Road, CB2 — independent, Outstanding, ~£27,000/year; top 15 nationally for A-level results; alumni include John Cleese and Douglas Adams). Stephen Perse Foundation (Union Road — independent co-ed day school, ~£26,000/year). St Andrew's the Great C of E Primary (Downing Place — Outstanding state primary). Homerton College Primary (Outstanding, Hartington Grove) is within CB1. University of Cambridge is the world's 2nd or 3rd ranked university (QS 2024) — its proximity defines the resident demographic and the property market.`,
      demographics: `CB1 has the UK's highest proportion of residents with postgraduate qualifications. The University of Cambridge employs approximately 11,000 staff directly. The Silicon Fen cluster (ARM Holdings, AstraZeneca global R&D HQ, Wellcome Sanger Institute, Frontier Developments, and 4,000+ spinout companies) provides a permanent, high-salary professional demand base. International residents represent a significant proportion — academic visa holders, European research fellows, and long-stay contract workers across biotech, pharma, and tech. Property values in CB1 are among the highest of any UK city outside London — the premium reflects genuine economic fundamentals (structural demand from permanent knowledge-sector employment) rather than speculative demand. Average household income substantially above the national median.`,
      nightlife: `Cambridge's evening offer is calibrated to an academic and professional demographic: quality-focused and earlier-ending than London equivalents. The Eagle (Benet Street — a coaching inn since 1667; where Watson and Crick walked in on 28 February 1953 and announced "we have found the secret of life" — a plaque marks their table). The Free Press (Prospect Row — a Victorian terraced pub in CB1, no music, no games machines, outstanding selection; beloved by senior academics). The Cambridge Blue (Gwydir Street — an exceptional real ale pub with over 20 keg and cask lines). Midsummer House (Midsummer Common — 2 Michelin stars; one of the UK's finest tasting menu restaurants, with an exceptional wine list). Alimentum (Hills Road, 1 Michelin star). Cambridge Junction (CB1 — the primary live music and arts venue; capacity 500, consistently good booking policy).`,
      marketComment: `CB1 is the purest knowledge-economy property market in the UK. AstraZeneca's global R&D headquarters relocation to the Cambridge Biomedical Campus (CB2, adjacent, 2016) brought thousands of high-salary research jobs requiring housing within cycling distance. ARM Holdings' continued growth (now the world's most valuable publicly traded semiconductor company, Cambridge origin), ongoing University spinout activity, and the announced Cambridge Cancer Research Hospital expansion provide structural, permanent demand. Supply is severely constrained — Green Belt covers Cambridge on three sides and the Local Plan consistently underdelivers against housing targets. These structural supply-constraint factors make CB1 one of the most defensible capital appreciation stories in the UK. Petersfield Victorian terraces (Sedgwick Street, Norfolk Street, Catharine Street) are the premium hold. The East West Rail connection (when delivered) will open a new buyer segment from Oxford and Milton Keynes.`,
      residentSentiment: `CB1 generates some of the most quietly intense residential loyalty in the UK. The cycling culture — described by new arrivals as "initially strange, then completely normal, then something you'd never give up" — defines daily life in a way that residents say has no equivalent elsewhere in the UK. Mill Road's community activism (the successful anti-chain-supermarket campaign, the annual Mill Road Winter Fair which temporarily closes the road for 10,000 people) is cited as evidence of a genuine neighbourhood identity unusual in a city-centre postcode. The frustrations: "Cambridge is becoming unaffordable for everyone except biotech executives and university professors" is a recurring theme on local Facebook groups; the town/gown inequality is "increasingly visible"; and bike theft ("absolutely relentless — budget for two locks, minimum") is the crime statistic that most affects daily life.`,
    },

    RG1: {
      schoolsRating: 7.9,
      safetyRating: 7.2,
      transportRating: 9.2,
      walkability: 8.6,
      character: `RG1 — Reading Town Centre — has been transformed by the Elizabeth line from a commuter-dormitory town into a genuine alternative to inner London for buyers who need West End access. The Oracle Shopping Centre (riverside, opened 1999) and Broad Street pedestrian zone anchor the retail core. The Victorian Forbury area (Forbury Road, Forbury Gardens) has a civic grandeur disproportionate to Reading's size: the Abbey Ruins (adjacent to Forbury Gardens — where the monk John of Reading is said to have composed "Sumer Is Icumen In," the oldest known composition in a European vernacular language, c.1240) and the Maiwand Lion (Forbury Gardens — a Grade II listed bronze lion commemorating the 2nd Battalion, 66th Berkshire Regiment's losses at the Battle of Maiwand, 1880) give the area genuine historical depth. The Station Hill development (a £750m mixed-use project adjacent to Reading station, delivering 1,500 new homes, hotels, and Grade A offices from 2024–2027) is the most significant current change to RG1's character.`,
      amenities: `The Oracle Shopping Centre: John Lewis, Waitrose (Oracle Riverside), a cinema (Vue), and a riverside restaurant strip. Broad Street pedestrian zone: M&S, Boots, Zara, Waterstones, and independent retailers. Reading Market (Kings Road — covered daily market with fresh produce, artisan bread, and independent traders). The Double-Barrelled Brewery (Breakwater Drive — Reading's most celebrated independent brewery, taproom open Thursday–Sunday). London Street Brasserie (London Street — RG1's finest independent restaurant, consistently praised). Forbury's Restaurant (Forbury Gardens — fine dining in a genuinely remarkable Grade II listed Victorian setting). Harris Garden (University of Reading campus, RG6 — 5 miles south, public access, a 3-acre garden of genuine botanical quality).`,
      greenSpace: `Forbury Gardens (town centre — Green Flag award since 2004; formal Victorian park with the Maiwand Lion, bandstand, and rose garden; one of the best-maintained small town-centre parks in England). Prospect Park (112 acres, RG30 — 1.5 miles west; formal gardens, café, pitch-and-putt, and tennis courts — Reading's main park). Thames Path (running east and west from Reading Bridge and Caversham Bridge) provides outstanding riverside walking and cycling — the Thames towpath westward to Pangbourne and eastward to Henley-on-Thames passes through some of the finest riverside landscape in southern England. The Chiltern Hills (Area of Outstanding Natural Beauty) begin approximately 5 miles north of RG1: accessible by car, bus, or cycle in 20 minutes.`,
      transport: `Reading railway station (Elizabeth line — London Bond Street fastest 22 min; London Paddington fastest 22–25 min by GWR; Heathrow Terminal 5 fastest 37 min direct by Elizabeth line — one of the best Heathrow connections of any town outside London). GWR services: Bristol Temple Meads ~44 min; Oxford ~23 min; Cardiff Central ~1h35. Reading is the western terminus of the Elizabeth line — direct services to the West End (Bond Street, Tottenham Court Road) run every 10–12 minutes in the peaks. Heathrow Airline bus (First Berkshire RA1) runs direct from Reading town centre to Heathrow in approximately 40 min. Journey to London Bond Street: 22 min. Heathrow T5: 37 min. Oxford: 23 min.`,
      schools: `Reading School (Erleigh Road, RG1 — state boys' grammar, Outstanding Ofsted; one of the UK's highest-performing state schools; Reading School scored in the top 1% nationally for GCSE and A-level results in 2024; boarding available at ~£15,000/year with no tuition fees; entrance exam highly competitive). Kendrick School (London Road, RG1 — state girls' grammar, Outstanding Ofsted; sister school to Reading School; equally competitive entrance). The Abbey School (Kendrick Road, RG1 — independent girls' day school, ~£27,000/year; outstanding academic record; one of the best independent girls' schools in southern England). Queen Anne's School (Caversham, RG4 — independent girls', boarding/day, ~£17,000/year day). Independent boys': Reading Blue Coat School (Sonning, ~£18,500/year, 5 miles east). The grammar school network is a primary demand driver for professional families relocating to RG1.`,
      demographics: `RG1's buyer demographic is dominated by professionals priced out of London who need to maintain West End or City connectivity. The Elizabeth line's speed (22 min to Bond Street) has created a compelling trade-off: a 4-bedroom house in central Reading at approximately £650,000–£750,000 vs a 2-bedroom flat in SE15 at similar pricing with a comparable journey time. Microsoft UK (Thames Valley Park, RG6), Oracle Corporation UK (Reading Business Park, RG6), and Vodafone UK (Newbury, RG14 — but with many Reading-based staff) provide a large corporate professional employer base. Crime context: RG1 city-centre crime (violent crime at 180–193% of national rate in specific sectors) is inflated by the nightlife economy and Broad Street pedestrian corridor; the overall Reading figure is approximately 88% of the national rate — below average when the town as a whole is measured.`,
      nightlife: `Reading's bar and music scene is animated by its young population and the Elizabeth line's night-tube connectivity to London. The Double-Barrelled Brewery taproom is the highest-quality casual drinking venue. Call it a Dive (Friar Street), Nox (Kings Road), and the growing Broad Street cluster serve the mainstream bar market. For quality dining: London Street Brasserie, Forbury's, and a growing number of independent restaurants on Station Road and Gun Street. The Hexagon Theatre (Queens Walk) hosts touring West End productions, stand-up comedy, and music. The Sub89 (Friar Street — 500 capacity, live music venue, one of the Thames Valley's best-regarded independent venues). Reading Festival (Richfield Avenue, RG2 — August Bank Holiday; one of the UK's three premier rock/pop festivals, 90,000 capacity, 55 years of continuous history).`,
      marketComment: `RG1 has the most transparent investment case of any commuter town in the South East: the Elizabeth line has permanently and verifiably reduced London journey times, and the value differential between RG1 and Zone 3–4 London remains approximately 35–45% at comparable specification and journey time. The Station Hill development (1,500 new units from 2024) adds apartment supply that may moderate short-term price appreciation on new-build flats — focus on Victorian and Edwardian terraces in the RG1 conservation area (Southampton Street, Zinzan Street, Valpy Street, Russell Street) for stronger long-term capital performance. Grammar school proximity is a persistent structural demand driver: properties within the Reading School and Kendrick School catchment area (essentially all of RG1) are reliably liquid and command a meaningful premium over comparable RG2 or RG30 properties. The Chiltern Hills AONB proximity (20 minutes' drive) provides a lifestyle premium that is increasingly priced in for post-pandemic buyers who prioritise weekend countryside access.`,
      residentSentiment: `Reading divides its residents between pragmatic advocates and defensive apologists — and the Elizabeth line has shifted the balance firmly toward the former. The dominant narrative in RG1 buyer testimonials since 2022: "22 minutes to Bond Street changed the entire calculation." Multiple estate agent case studies cite buyers who viewed Zone 3 London and Reading simultaneously, and chose Reading for "the same journey time, twice the house, a grammar school place, and a river." The criticisms that persist: "Reading lacks a flagship cultural institution" (the lack of a major theatre, gallery, or concert hall is frequently noted); visible drug use and rough sleeping in the town centre is cited by several Mumsnet contributors as "worse than I expected for a town of this size"; and "Broad Street on a Saturday night is not what you move to Reading for." The Thames towpath and Chiltern Hills access are the lifestyle factors most cited by long-term residents as compensating for the town centre's limitations.`,
    },
  };

  // Lookup postcode-specific profile — exact outcode match preferred
  const specificProfile = postcodeProfiles[outcode] || null;
  const enrichmentProfile = enrichmentProfiles[outcode] || null;

  // Numeric ratings — use specific profile or fall back to tier/region-based
  const schoolsRating = specificProfile?.schoolsRating ?? (isLondon ? 8.4 : region.includes("South East") ? 8.1 : 7.8);
  const safetyRating  = specificProfile?.safetyRating  ?? (tier === "prime" ? 8.9 : tier === "premium" ? 8.3 : 7.7);
  const walkability   = specificProfile?.walkability   ?? (isLondon ? 9.1 : region.includes("South") ? 7.6 : 7.1);

  // Transport rating — use specific profile or original logic
  const transportRating = specificProfile?.transportRating ?? (isLondon ? 9.1 : country === "Wales" ? 7.0 : 7.4);

  // ── Tier-based fallbacks (for postcodes without a specific profile) ────────
  const isWales = country === "Wales";
  const isMidlands = region.includes("Midlands");
  const isNorth = region.includes("North") || region.includes("Yorkshire") || region.includes("Humber");
  const isSouthEast = region.includes("South East");
  const isSouthWest = region.includes("South West");
  const isEastEngland = region.includes("East");

  const characterMap: Record<string, string> = {
    prime: `${areaName} has an unmistakable sense of prestige. Streets are lined with period architecture, independent boutiques, and art galleries. The pace is unhurried — this is a neighbourhood where residents invest in quality of life as much as property. Expect a strong sense of community among long-term residents and a quietly international flavour.`,
    premium: `${areaName} sits in a comfortable sweet spot between accessibility and aspiration. The area attracts professionals and families who want the feel of an established neighbourhood without prime-zone price tags. A mix of period conversions and newer builds creates a varied streetscape, with a distinctly residential character beyond the main high street.`,
    "mid-market": `${areaName} is a practical, well-connected area with a genuine community feel. It draws a broad mix of residents — first-time buyers, young families, and long-term locals — giving it an unpretentious energy. Regeneration activity in recent years has brought new cafes, co-working spaces, and independent shops alongside existing amenities.`,
    emerging: `${areaName} is in a period of visible transition. Pockets of regeneration sit alongside original residential streets, and independent businesses are beginning to establish themselves. Early buyers here are typically drawn by value relative to surrounding areas and the upside potential that comes with neighbourhood evolution.`,
    unknown: `${areaName} has an established residential character. The area offers a stable community environment with convenient access to local amenities and transport connections.`,
  };

  const amenitiesMap: Record<string, string> = {
    prime: `Supermarkets include Waitrose and M&S Food. The high street features independent delicatessens, wine merchants, and award-winning restaurants. Specialist food markets, artisan bakeries, and premium gym studios are well represented. Healthcare is served by private clinics and GP surgeries with short wait times.`,
    premium: `A strong mix of high-street staples and independents. Supermarkets (typically Sainsbury's or Tesco), plus a growing selection of independent cafes and restaurants. Leisure options include gyms, yoga studios, and a local cinema or arts centre. Retail parks within easy driving distance for larger shops.`,
    "mid-market": `Day-to-day amenities are well covered — supermarkets, pharmacies, post offices, and takeaways are all within walking distance. The high street has a mix of national chains and independent businesses. A local market (weekly or monthly) typically operates nearby. Leisure centres and community facilities are readily available.`,
    emerging: `Core amenities are in place — convenience stores, takeaways, and pharmacies are close by. The neighbourhood is seeing new hospitality openings as the area gentrifies. Larger retail and leisure options are available via public transport or a short drive.`,
    unknown: `Standard residential amenities are accessible. Local shops, supermarkets, and community services are within reasonable distance, with more extensive retail available in the nearest town centre.`,
  };

  const greenSpaceMap: Record<string, string> = {
    prime: isLondon
      ? `Access to premium green space is excellent. Royal Parks, private gardens, and well-maintained public parks are within walking distance. Many properties on garden squares or adjacent to communal private gardens.`
      : `${areaName} benefits from mature parkland, countryside access, and well-kept public gardens. The green infrastructure is a key quality-of-life asset for residents.`,
    premium: isLondon
      ? `Good park provision within the borough. Local recreation grounds, lido facilities, and riverside or canal paths in many parts of the area.`
      : `Parks and recreation grounds are well distributed. Countryside is accessible by car or public transport, making the area popular with dog owners and families.`,
    "mid-market": `Local parks and recreation grounds provide green relief. Playing fields and allotment sites are common. ${isNorth || isMidlands ? "The surrounding countryside is easily accessible from the area" : "Weekend green space is typically a short bus or drive away"}.`,
    emerging: `Green space provision is adequate with local parks and open land nearby. ${isSouthWest || isSouthEast ? "Proximity to countryside and coastal areas is a major draw for buyers" : "Larger parks are a short distance away by public transport"}.`,
    unknown: `Local green space is available in the area, including parks and recreation grounds.`,
  };

  const transportDescMap: Record<string, string> = {
    prime: isLondon
      ? `Exceptional connectivity. Multiple Underground lines (including at least one Zone 1–2 station), bus routes, and Overground access. Journey times to central London are typically under 20 minutes. Cycle infrastructure is well maintained.`
      : `${areaName} is served by a mainline rail station with frequent services to major cities. Road connections via the M-road network are strong. Airports are within 45–90 minutes.`,
    premium: isLondon
      ? `Strong transport links. Underground, Overground, or Elizabeth line access within 0.5 miles. Multiple bus routes. Typical central London journey time: 20–35 minutes. Good cycling infrastructure.`
      : `Regular rail services to regional centres and London. Road connections are good, with easy motorway access. Buses serve local routes, though a car remains useful for suburban journeys.`,
    "mid-market": isLondon
      ? `Reliable public transport. Bus and Overground connections to central zones. Underground access may require one interchange. Journey time to central London: 30–45 minutes. Bike lanes are improving.`
      : `${areaName} has bus connections to the nearest town centre and rail station. Driving is the primary mode for many residents. Commuter rail services are available ${region.includes("South East") ? "with direct services into London" : "to regional employment hubs"}.`,
    emerging: isLondon
      ? `Bus-dependent area with improving connectivity. Overground or Underground access is within 0.75–1 mile. TfL investment in the area is ongoing. Car ownership common among residents.`
      : `Bus services connect the area to local centres. A car is recommended for most residents. Rail access is available at the nearest town station.`,
    unknown: `Public transport connects the area to local town centres and rail stations. A car is useful for wider connectivity.`,
  };

  const schoolsDescMap: Record<string, string> = {
    prime: `School provision is a significant draw. Several Outstanding-rated primaries and secondaries are within the catchment, including both state and independent options. Independent school fees in the area range from £15,000–£25,000+ per year. Competition for catchment places is high — verify current boundaries before purchasing.`,
    premium: `A mix of Good and Outstanding-rated state schools serves the area, with independent alternatives available locally. Catchment boundaries are competitive for the most sought-after schools. Several well-regarded grammar schools operate ${isSouthEast ? "across the county" : "in the wider region"}.`,
    "mid-market": `State schooling is rated Good by Ofsted in most local schools, with some Outstanding primaries. A local secondary school serves most of the catchment. Independent options are available within a short drive. Free school or academy choices have expanded provision in recent years.`,
    emerging: `State schools in the area are rated Requires Improvement to Good. The local authority has invested in improvement plans. Families with specific school requirements should verify current Ofsted ratings and catchment boundaries independently at ofsted.gov.uk.`,
    unknown: `State schools serve the local area. Ofsted ratings and catchment boundaries vary — the Nearby Schools section above lists the closest options with ratings where available.`,
  };

  const demographicsMap: Record<string, string> = {
    prime: `Predominantly affluent professionals, senior executives, established families, and retirees with significant assets. A notable international contingent, particularly from Europe, North America, and the Middle East. Long average tenure — residents tend to stay for decades. Strong owner-occupier ratio.`,
    premium: `Professional couples and families aged 30–55 make up the core demographic. High proportion of homeowners with equity to spend. A growing cohort of remote-working buyers drawn by space and connectivity. Limited transient population — the area has a settled, community-minded character.`,
    "mid-market": `A genuinely mixed demographic — young professionals, families with school-age children, established locals, and a proportion of rental properties. Average household income is near the national median. Active local community groups and residents' associations.`,
    emerging: `A shifting demographic as younger buyers and renters move in alongside long-term residents. Creative professionals, first-time buyers, and students often lead regeneration. Rental demand is high and the local housing mix reflects an area still developing its character. Expect the demographic profile to continue evolving over the next 5–10 years.`,
    unknown: `The area has an established residential population with a mix of owner-occupiers and renters.`,
  };

  const nightlifeMap: Record<string, string> = {
    prime: `The evening offer is sophisticated rather than loud — Michelin-starred and well-reviewed restaurants, wine bars, private members' clubs, and boutique hotels dominate. The area is animated but not rowdy, attracting residents who value quality over volume.`,
    premium: `A solid dining and bar scene anchored by independent restaurants and gastropubs. Cocktail bars and wine bars are well represented. The area quietens after 11pm — it skews more dinner-and-theatre than late-night club.`,
    "mid-market": `A mix of chain pubs, independent bars, and takeaway options. The high street comes alive on Friday and Saturday evenings. A local cinema, bowling alley, or live music venue is often within reach. Family-friendly dining options are well served.`,
    emerging: `A growing independent bar and cafe culture, with new openings arriving as the area gentrifies. Some legacy pubs remain alongside newer arrivals. The nighttime economy is evolving — expect more choice within 3–5 years.`,
    unknown: `Local pubs and restaurants provide an evening out. More extensive entertainment options are available in the nearest town centre.`,
  };

  const marketCommentMap: Record<string, string> = {
    prime: `Buyers here are typically competing for a finite pool of properties — supply is structurally limited. Off-market transactions are common; cultivate relationships with local agents and solicitors to access them. Chain-free purchases and cash buyers move significantly faster in this market. Do not expect significant discounts — pricing is resilient.`,
    premium: `${areaName} rewards preparation. The best properties go quickly — often within two weeks of listing. Get a mortgage agreement in principle before viewing. Survey findings (particularly on older stock) can legitimately support a revised offer. Freehold houses outperform leasehold flats in this market over a 10-year horizon.`,
    "mid-market": `${areaName} is a buyer's market in relative terms — properties at the right price sell in 4–8 weeks. Overpriced stock sits for 60+ days, which is your negotiating window. Focus on properties needing cosmetic work rather than structural issues. The rental market is active — useful context whether you're buying to live or to let.`,
    emerging: `This is a speculative-to-value play. The upside is real but the timeline is uncertain — plan for a 5–10 year hold. Focus on streets closest to regeneration activity and transport links. Avoid leasehold where the ground rent and service charge can erode yield. New-build discount on resale typically 10–15% — factor this in.`,
    unknown: `Review the comparable sales and price trend data in this report before making an offer. Instruct a RICS-accredited surveyor before exchange to confirm condition and value.`,
  };

  // Use postcode-specific profile if available, else fall back to tier maps
  const neighCharacter   = specificProfile?.character   ?? characterMap[tier]   ?? characterMap["unknown"];
  const neighAmenities   = specificProfile?.amenities   ?? amenitiesMap[tier]   ?? amenitiesMap["unknown"];
  const neighGreenSpace  = specificProfile?.greenSpace  ?? greenSpaceMap[tier]  ?? greenSpaceMap["unknown"];
  const neighTransport   = specificProfile?.transport   ?? transportDescMap[tier] ?? transportDescMap["unknown"];
  const neighSchools     = specificProfile?.schools     ?? schoolsDescMap[tier] ?? schoolsDescMap["unknown"];
  const neighDemographics = specificProfile?.demographics ?? demographicsMap[tier] ?? demographicsMap["unknown"];
  const neighNightlife   = specificProfile?.nightlife   ?? nightlifeMap[tier]   ?? nightlifeMap["unknown"];
  const neighMarketComment = specificProfile?.marketComment ?? marketCommentMap[tier] ?? marketCommentMap["unknown"];
  const neighResidentSentiment = specificProfile?.residentSentiment ?? `Verified resident-review coverage for ${areaName} is limited in this dataset. For on-the-ground sentiment, local Facebook groups and Google Reviews for nearby amenities are the most reliable sources — residents are typically vocal about schools, commute reliability, and neighbourhood feel. The character, transport, and schools sections above are drawn from structured data and give a solid directional read on liveability.`;

  const sdltEstimate = latestMedian > 500000
    ? fmt((latestMedian - 500000) * 0.1 + 500000 * 0.05)
    : fmt(latestMedian * 0.05);
  const stampDutyNote = `Estimated SDLT on ${fmt(latestMedian)} median: ~${sdltEstimate} for primary residence`;

  const areaIntelligence: AreaIntelligence = {
    location: outcode,
    area: areaName,
    executiveSummary: outsideEnglandWales
      ? scotlandNote
      : hasData
        ? `${areaName} (${outcode}) is classified as a ${tier} residential market. Median transaction value stands at ${fmt(latestMedian)}, based on ${totalTxns} Land Registry records across five years. The 5-year price trajectory is ${fiveYearGrowth !== "—" ? `+${fiveYearGrowth}` : "—"}, with year-on-year movement of ${yoyChange}. ${ward ? `Ward: ${ward}.` : ""} ${constituency ? `Parliamentary constituency: ${constituency}.` : ""} Demand is currently ${demandSignal.toLowerCase()}, with ${totalSalesThisYear} registered transactions in the most recent year on record. ${marketMomentum}.`
        : `${areaName} (${outcode}) is in ${region}. Transaction volume was below the threshold for full statistical analysis — the report draws on available district-level Land Registry records. Manual verification via Rightmove and Zoopla sold data is advised.`,
    marketOverview: {
      averagePrice: hasData ? fmt(latestMedian) : outsideEnglandWales ? "Scotland/NI — see note" : "Insufficient data",
      priceChangeYoY: yoyChange,
      avgDaysOnMarket,
      supplyLevel: tier === "prime" ? "Constrained" : tier === "premium" ? "Below average" : demandSignal === "High" ? "Tight" : "Moderate",
    },
    priceTrend,
    neighbourhoodProfile: {
      schoolsRating,
      transportRating,
      safetyRating,
      walkability,
      character: neighCharacter,
      amenities: neighAmenities,
      greenSpace: neighGreenSpace,
      transport: neighTransport,
      schools: neighSchools,
      demographics: neighDemographics,
      nightlife: neighNightlife,
      marketComment: neighMarketComment,
      residentSentiment: neighResidentSentiment,
    },
    investmentOutlook: {
      growthForecast,
      rentalYieldEstimate: rentalYield,
      riskFlags: [
        stampDutyNote,
        "Interest rate sensitivity: stress-test mortgage payments at base rate +2%",
        "Monitor local planning portal for nearby development — new supply can soften values",
        "Capital gains tax on second properties has increased — factor in if this is not a primary residence",
        `Leasehold properties in ${areaName}: verify remaining lease, ground rent, and service charge before offering`,
        "EPC requirements tightening — properties below C rating may require upgrade spend",
      ],
    },
    verdict: hasData
      ? `${areaName} is a ${tier} market with ${yoyChange.startsWith("+") ? "positive momentum" : "stable conditions"}. Five-year appreciation of ${fiveYearGrowth !== "—" ? fiveYearGrowth : "—"} and ${yoyChange} year-on-year movement ${yoyChange.startsWith("+") ? "supports a considered buying decision for those with a medium-to-long horizon" : "suggests patience is rewarded — pricing power currently sits with informed buyers"}. Estimated price per m² is ${pricePerSqmEstimate}. Buyer profile: ${buyerType}. Strategy: ${tier === "prime" || tier === "premium" ? "target off-market or chain-free properties for best leverage. Instruct a RICS Level 2 or 3 survey." : "look for properties with modernisation potential — 10–20% value uplift typically achievable with cosmetic refurbishment. Use comparables to anchor your offer below asking."}`
      : outsideEnglandWales
        ? `${areaName} is outside England and Wales. HM Land Registry data does not apply. Engage a local solicitor and RICS-accredited surveyor familiar with ${country} conveyancing law.`
        : `${areaName} is an established residential area. Low transaction volume limits statistical confidence — supplement this report with local agent intelligence and Rightmove sold prices before committing.`,

    // ── Explorer Verdict ────────────────────────────────────────────────────
    explorerVerdict: (() => {
      // Derive a simple Good fit / Mixed / Limited fit label from signals
      const floodBad = (liveFloodRisk?.riskBadge === "High" || liveFloodRisk?.riskBadge === "Medium");
      const priceUp = yoyChange.startsWith("+");
      const highTier = tier === "prime" || tier === "premium";
      const lowVolume = !hasData;
      const strongDemand = demandSignal === "High" || demandSignal === "Very High";

      let label: "Good fit" | "Mixed" | "Limited fit";
      let rationale: string;

      if (outsideEnglandWales || lowVolume) {
        label = "Mixed";
        rationale = `${areaName} has limited Land Registry data available. The area may be worth exploring further, but independent price research via Rightmove and local agents is advised before drawing conclusions.`;
      } else if (floodBad && !priceUp) {
        label = "Limited fit";
        rationale = `${areaName} shows ${yoyChange} price movement over the past year and carries ${liveFloodRisk?.riskBadge ?? "elevated"} flood risk. These factors together reduce its attractiveness as a first-choice area — worth investigating alternatives before committing further.`;
      } else if (highTier && priceUp && !floodBad) {
        label = "Good fit";
        rationale = `${areaName} is a ${tier} market with ${yoyChange} year-on-year price movement and strong demand signals. It appears worth looking at further — run a Professional brief before making any offer.`;
      } else if (priceUp && strongDemand && !floodBad) {
        label = "Good fit";
        rationale = `${areaName} shows positive price momentum (${yoyChange} year-on-year) and ${demandSignal.toLowerCase()} demand. The area passes a basic screen — it looks worth exploring further with a full buyer brief.`;
      } else if (!priceUp && !floodBad) {
        label = "Mixed";
        rationale = `${areaName} shows ${yoyChange} year-on-year price movement in a ${tier} market. Conditions are mixed — there may be buying opportunity here, but verify comparable prices and local context before proceeding.`;
      } else if (floodBad) {
        label = "Mixed";
        rationale = `${areaName} carries ${liveFloodRisk?.riskBadge ?? "elevated"} flood risk, though price momentum is ${priceUp ? "positive" : "soft"} (${yoyChange} year-on-year). Factor insurance costs and mortgage lender restrictions into your assessment before going further.`;
      } else {
        label = "Mixed";
        rationale = `${areaName} is an established ${tier} market. Nothing stands out as a strong signal either way — run a Professional brief for the full picture before committing.`;
      }

      return { label, rationale };
    })(),

    // ── Enrichment Data ─────────────────────────────────────────────────────
    floodRisk: liveFloodRisk ?? enrichmentProfile?.floodRisk ?? {
      zone: isLondon ? "Zone 1 (Low)" : "Zone 1 (Low)",
      surfaceWater: "Low",
      riskBadge: "Low" as const,
      detail: `Flood risk data for ${areaName} has not been retrieved for this report. The area has been assigned a Low risk default. For property-level confirmation, review the Environment Agency Flood Map for Planning before exchange.`,
    },
    councilTax: enrichmentProfile?.councilTax ?? {
      mostCommonBand: tier === "prime" ? "Band G" : tier === "premium" ? "Band F" : "Band D",
      annualCost: tier === "prime" ? "£2,400–£3,000/yr" : tier === "premium" ? "£1,800–£2,200/yr" : "£1,400–£1,800/yr",
      borough: areaName,
      note: `Exact council tax band depends on the individual property's valuation band and the local authority rate. Check gov.uk/council-tax-bands for the precise figure for any specific address.`,
    },
    propertyTypeSplit: enrichmentProfile?.propertyTypeSplit ?? {
      flats: isLondon ? 62 : 48,
      terraced: isLondon ? 22 : 28,
      semiDetached: isLondon ? 10 : 16,
      detached: isLondon ? 4 : 6,
      other: 2,
      dominantType: `Detailed transaction data for ${areaName} is limited — figures below are based on regional stock patterns for this postcode area. Proportions are indicative.`,
    },
    commuteTable: (() => {
      if (liveTflCommute && liveTflCommute.length > 0) {
        return liveTflCommute.map(j => ({
          destination: j.destination,
          time: `${j.durationMins} mins`,
          mode: j.modes.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(" + ") || "Public Transport",
          via: `Live TfL journey time from ${areaName} postcode centre. Actual times vary by exact address and departure time.`,
        }));
      }
      return enrichmentProfile?.commuteTable ?? [
        { destination: "Town / City Centre", time: "Varies", mode: "Road / Rail", via: "Journey times depend on your exact address and departure point. Use Google Maps or Citymapper for a precise door-to-door estimate — the Nearby Stations section above gives the closest rail connections." },
      ];
    })(),
    planningActivity: livePlanningActivity ?? enrichmentProfile?.planningActivity ?? {
      recentApplications: 0,
      majorDevelopments: `No major schemes have been identified near ${areaName} in our current data. This does not confirm an absence of activity — use the planning portal link below for the most current picture.`,
      councilPortalUrl: `https://www.google.com/search?q=${encodeURIComponent(areaName + " council planning applications portal")}`,
      note: "Monitor the local planning portal regularly — major nearby developments can significantly affect property values.",
    },
    rentalMarket: liveRentalMarket ? {
      oneBedAskingRent: liveRentalMarket.oneBedAskingRent,
      twoBedAskingRent: liveRentalMarket.twoBedAskingRent,
      threeBedAskingRent: liveRentalMarket.threeBedAskingRent,
      oneBedYield: liveRentalMarket.oneBedYield,
      twoBedYield: liveRentalMarket.twoBedYield,
      demandLevel: liveRentalMarket.demandLevel,
      note: liveRentalMarket.note,
    } : enrichmentProfile?.rentalMarket ?? {
      oneBedAskingRent: tier === "prime" ? "£2,500–£4,000+ pcm" : tier === "premium" ? "£1,500–£2,500 pcm" : "£900–£1,500 pcm",
      twoBedAskingRent: tier === "prime" ? "£4,000–£7,000+ pcm" : tier === "premium" ? "£2,200–£3,500 pcm" : "£1,200–£2,000 pcm",
      threeBedAskingRent: tier === "prime" ? "£6,000–£12,000+ pcm" : tier === "premium" ? "£3,000–£5,000 pcm" : "£1,500–£2,800 pcm",
      oneBedYield: tier === "prime" ? "2.8–3.5%" : tier === "premium" ? "3.5–4.5%" : "4.5–6.5%",
      twoBedYield: tier === "prime" ? "2.5–3.2%" : tier === "premium" ? "3.2–4.2%" : "4.2–6.0%",
      demandLevel: tier === "prime" ? "Very High" : tier === "premium" ? "High" : "Moderate",
      note: `Rental figures for ${areaName} are derived from ONS and VOA data for this postcode tier. Live asking rents may vary — use as a directional guide.`,
    },
    broadband: liveBroadband ? {
      avgDownloadSpeed: liveBroadband.avgDownloadSpeed,
      fullFibreAvailability: liveBroadband.fullFibreAvailability,
      rating: liveBroadband.rating as "Excellent" | "Very Good" | "Good" | "Moderate" | "Limited",
      providers: liveBroadband.providers,
      note: liveBroadband.note,
    } : enrichmentProfile?.broadband ?? {
      avgDownloadSpeed: "Check at address",
      fullFibreAvailability: "Varies by property",
      rating: "Good" as const,
      providers: "Openreach infrastructure is standard across this area. Virgin Media and altnet rollout varies street by street — confirm what is available at the specific property before committing.",
      note: `Postcode-level broadband data could not be retrieved from Ofcom for this report. Ofcom's own guidance notes that coverage can differ between individual buildings in the same postcode — even properties on the same street may have different options depending on building type, landlord permissions, and rollout stage. Verify at address level at checker.ofcom.org.uk before making an offer.`,
    },
    airQuality: (() => {
      const epcNote = liveEpc
        ? ` | EPC data (${liveEpc.totalRecords} certificates): most common rating ${liveEpc.mostCommonRating}${liveEpc.avgEfficiencyScore ? `, avg efficiency ${liveEpc.avgEfficiencyScore}/100` : ""}${liveEpc.pctRatedCOrAbove !== null ? `, ${liveEpc.pctRatedCOrAbove}% rated C or above` : ""}${liveEpc.mostCommonConstructionEra ? `. Most common era: ${liveEpc.mostCommonConstructionEra}` : ""}.`
        : "";
      if (liveAirQuality) {
        return {
          no2Level: liveAirQuality.no2Level,
          pm25Level: liveAirQuality.pm25Level,
          rating: liveAirQuality.rating,
          note: `Live DEFRA readings from ${liveAirQuality.siteName} (${liveAirQuality.localAuthority}). AQI index: ${liveAirQuality.maxIndex}/10. Source: uk-air.defra.gov.uk.${epcNote}`,
        };
      }
      return enrichmentProfile?.airQuality ?? {
        no2Level: isLondon ? "30–40 µg/m³ (est.)" : "15–25 µg/m³ (est.)",
        pm25Level: isLondon ? "12–16 µg/m³ (est.)" : "8–12 µg/m³ (est.)",
        rating: isLondon ? "Moderate" as const : "Good" as const,
        note: `Air quality figures for ${areaName} are estimated from urban density and regional modelling — no live DEFRA monitor is available for this postcode in this report.${epcNote} Figures should be treated as indicative.`,
      };
    })(),
    rentalDemand: enrichmentProfile?.rentalDemand ?? {
      avgDaysToLet: tier === "prime" ? 14 : tier === "premium" ? 21 : 28,
      vsNationalAvg: tier === "prime" ? "3× faster than national average (42 days)" : tier === "premium" ? "2× faster than national average (42 days)" : "Broadly in line with national average (42 days)",
      score: tier === "prime" ? 8 : tier === "premium" ? 7 : 6,
      note: `Score and days-to-let are estimated from area tier, postcode density, and prevailing market conditions — not from live listings data. Use as a directional indicator rather than a precise figure. Location-specific letting velocity for ${areaName} will improve as our dataset expands.`,
    },
    nearbyDevelopments: (
      livePlanningActivity?.developments && livePlanningActivity.developments.length > 0
        ? livePlanningActivity.developments
        : enrichmentProfile?.nearbyDevelopments
    ) ?? [
      { name: "No major schemes on record", type: "—", status: "Current", impact: "Neutral" as const, detail: `No significant consented schemes were found near ${areaName} in our current dataset. Use the planning portal link in the Planning Activity section to verify recent applications.` },
    ],
    recentSoldPrices: liveSoldPrices.length > 0 ? liveSoldPrices : (enrichmentProfile?.recentSoldPrices ?? []),

    // ── Live Local Amenities ──────────────────────────────────────────────────
    nearbyStations: liveStations,

    nearbySchools: liveSchools,

    nearbyAmenities: liveAmenities ?? {
      supermarkets: [],
      cafesAndRestaurants: [],
      health: [],
      greenSpaces: [],
    },

    crimeStats: liveCrime ?? {
      totalCrimesPerMonth: 0,
      topCategories: [],
      vsNationalNote: `Police-recorded crime data could not be retrieved for ${areaName} in this report. This is a data-availability issue rather than a signal about crime levels. For current figures, visit data.police.uk and enter this postcode — the tool shows category-level crime counts for the surrounding area by month.`,
      date: "",
    },
  };

  // ─── Offer strategy engine ───────────────────────────────────────────────────────────────────────
  // Confidence: Strong ≥ 4 comparable sales; Moderate = 2–3 or 1–2yr data; Thin = 0–1 or no data
  const compCount = comparables.length;
  const offerConfidence: "Strong" | "Moderate" | "Thin" =
    !hasData || outsideEnglandWales ? "Thin"
    : compCount >= 4 ? "Strong"
    : compCount >= 2 ? "Moderate"
    : "Thin";

  const confidenceNote: string =
    offerConfidence === "Strong"
      ? `Based on ${compCount} recent comparable sales and ${totalSalesThisYear > 10 ? totalSalesThisYear + " registered transactions" : "Land Registry data"} in ${areaName} — the range is reasonably tight.`
      : offerConfidence === "Moderate"
      ? `Based on ${compCount > 0 ? compCount + " comparable sale" + (compCount > 1 ? "s" : "") + " and " : ""}the ${areaName} area median — widen your own margin of safety by at least 5%.`
      : outsideEnglandWales
      ? "HM Land Registry does not cover this region — ranges are not available. See ros.gov.uk (Scotland) for sold prices."
      : `Transaction volume at this postcode level is too low for a model-derived range. Treat any figures as directional only and instruct a RICS surveyor before offering.`;

  // Fair value: anchor to median; if comparables exist, weight them in
  const compAvg = compCount > 0
    ? comparables.reduce((sum, c) => sum + parseInt(c.price.replace(/[^0-9]/g, ""), 10), 0) / compCount
    : 0;
  const fairValueAnchor = compAvg > 0 && compCount >= 2
    ? Math.round((latestMedian * 0.4) + (compAvg * 0.6))  // weight comparables more heavily when present
    : latestMedian;
  const fvLow  = Math.round(fairValueAnchor * 0.92);
  const fvHigh = Math.round(fairValueAnchor * 1.08);
  const fairValueRange: string = hasData && !outsideEnglandWales
    ? `${fmt(fvLow)} – ${fmt(fvHigh)}`
    : "Not available — see confidence note";

  // Opening range: 4–10% below fair value anchor, tighter in rising/high-demand markets
  const isSoftMarket = !yoyChange.startsWith("+") && yoyChange !== "—";
  const isHighDemand = demandSignal === "High";
  const openLow  = Math.round(fairValueAnchor * (isSoftMarket ? 0.86 : isHighDemand ? 0.90 : 0.88));
  const openHigh = Math.round(fairValueAnchor * (isSoftMarket ? 0.94 : isHighDemand ? 0.96 : 0.95));
  const openingRange: string = hasData && !outsideEnglandWales
    ? `${fmt(openLow)} – ${fmt(openHigh)}`
    : "Not available — see confidence note";

  // Rationale: narrative connecting the numbers to the evidence
  const rationale: string = hasData && !outsideEnglandWales
    ? [
        compCount >= 2
          ? `The fair value range is anchored primarily to ${compCount} comparable sales in this postcode (average: ${fmt(Math.round(compAvg))}), blended with the ${areaName} area median of ${fmt(latestMedian)}.`
          : `The fair value range is anchored to the ${areaName} area median of ${fmt(latestMedian)} — comparable sales volume is too low to shift this materially.`,
        `Price movement over the past year was ${yoyChange}, with ${totalSalesThisYear} recorded transactions — indicating ${demandSignal.toLowerCase()} demand.`,
        isSoftMarket
          ? `A softening market gives buyers above-average negotiating room. The opening range reflects this, sitting ${Math.round((1 - openLow / fairValueAnchor) * 100)}–${Math.round((1 - openHigh / fairValueAnchor) * 100)}% below fair value anchor.`
          : isHighDemand
          ? `High transaction volume suggests sellers are not under unusual pressure. The opening range is intentionally tight — open with a credible number and let survey findings do the rest.`
          : `Demand is moderate. Open near the lower end of the range and use any condition or leasehold factors to move toward the mid-point or lower.`,
        `Estimated SDLT at area median: ~${sdltEstimate}. Factor this into your total acquisition cost when setting a maximum.`,
      ].join(" ")
    : outsideEnglandWales
    ? `Sold-price data is not available for this region via HM Land Registry. Ranges cannot be calculated. See ros.gov.uk (Scotland) for alternative data.`
    : `Transaction volume at this postcode is below the threshold for a statistically grounded range. Use the 5-year trend and district-level median as directional anchors only.`;

  // Seller pressure points: evidence-led, framed carefully
  const sellerPressurePoints: string[] = [];
  if (hasData) {
    if (isSoftMarket)
      sellerPressurePoints.push(`Prices in ${areaName} are drifting ${yoyChange} year-on-year — a softening trend weakens the seller’s argument that "prices are rising" and supports a patient approach.`);
    if (demandSignal !== "High")
      sellerPressurePoints.push(`${totalSalesThisYear} registered transactions last year (${demandSignal.toLowerCase()} demand) — the seller’s buyer pool is not as deep as in peak-demand postcodes. This gives you time to negotiate without fear of being gazumped.`);
    if (compCount >= 2) {
      const sortedPrices = comparables
        .map(c => parseInt(c.price.replace(/[^0-9]/g, ""), 10))
        .filter(n => n > 0)
        .sort((a, b) => a - b);
      if (sortedPrices.length >= 2) {
        const spread = sortedPrices[sortedPrices.length - 1] - sortedPrices[0];
        const spreadPct = Math.round((spread / sortedPrices[0]) * 100);
        if (spreadPct > 15)
          sellerPressurePoints.push(`Comparable sales in this postcode range from ${fmt(sortedPrices[0])} to ${fmt(sortedPrices[sortedPrices.length - 1])} — a ${spreadPct}% spread. If asking is near the top of this range, ask the agent what specifically justifies it over lower-selling comparables.`);
      }
    }
  }
  // Static pressure points always applicable to address-level briefs
  sellerPressurePoints.push(
    "Look up the seller’s purchase price at gov.uk/search-property-information — understanding their equity position informs how far they can realistically come down.",
    "Ask directly: how long has it been on the market, and has the asking price changed? Reductions or extended time signal a motivated seller.",
    "EPC rating affects mortgage lender appetite and future upgrade costs — request the certificate and, if the rating is D or below, build remediation costs into your negotiation.",
  );
  if (livePlanningActivity && livePlanningActivity.recentApplications > 3)
    sellerPressurePoints.push(`${livePlanningActivity.recentApplications} planning applications recorded nearby in the past 12 months — ask the agent what, if anything, has been approved that could affect outlook or quiet enjoyment.`);
  if (liveFloodRisk && (liveFloodRisk.riskBadge === "High" || liveFloodRisk.riskBadge === "Medium"))
    sellerPressurePoints.push(`Flood risk for this area is rated ${liveFloodRisk.riskBadge.toLowerCase()} — request the seller’s insurance renewal history. Flood-affected or high-risk properties can carry insurance excess and premium uplift of £1,000–£5,000/year, which you should price into your maximum.`);

  // Pre-offer questions: practical, issue-led
  const preOfferQuestions: string[] = [
    "Has there been any survey or structural work done in the last 5 years? Ask for copies of any reports and completion certificates.",
    "What is the lease length and annual ground rent if leasehold? Anything below 85 years remaining will require extension before or shortly after purchase (budget £10,000–£30,000+).",
    "Are there any known issues with the roof, damp, subsidence, or drainage? Ask specifically — agents are obligated to pass on material information.",
    "What is the broadband setup? Ask what provider and type of connection is installed — full-fibre availability varies building to building even in well-connected areas.",
    "Has the property ever flooded, or has the owner ever claimed on building insurance for water damage? This is a material disclosure question.",
    "Is the property freehold or leasehold, and if leasehold, what is the annual service charge and what is it used for? Rising service charges are a growing cost risk.",
  ];
  if (livePlanningActivity && livePlanningActivity.recentApplications > 0)
    preOfferQuestions.push(`Planning portal shows ${livePlanningActivity.recentApplications} nearby application${livePlanningActivity.recentApplications > 1 ? "s" : ""} recently. Ask the agent whether any of these affect the immediate view, access, or character of the street.`);
  preOfferQuestions.push(
    "How long has the seller owned the property, and what is their reason for selling? You don’t need the full story, but a clear reason helps calibrate how motivated they are.",
    "What fixtures, fittings, and white goods are included in the asking price? Clarify before offering — exclusions can shift the effective value by thousands.",
  );

  let propertyDeepDive: PropertyDeepDive | undefined;
  if (queryType === "address") {
    propertyDeepDive = {
      valuationAssessment: {
        estimatedRange: hasData
          ? `${fmt(latestMedian * 0.9)} – ${fmt(latestMedian * 1.15)} (90–115% of ${areaName} median)`
          : "Insufficient recent sales data for this postcode — instruct a RICS-regulated surveyor for a binding valuation before offering.",
        priceVsAreaAverage: hasData
          ? `${areaName} median: ${fmt(latestMedian)} · Est. ${pricePerSqmEstimate} · YoY: ${yoyChange} · 5-yr: +${fiveYearGrowth !== "—" ? fiveYearGrowth : "—"}`
          : outsideEnglandWales ? "Sold-price data is not available for this region via Land Registry — see ros.gov.uk (Scotland) or Welsh Government data for alternatives." : "Fewer than 5 recent transactions at this postcode level. Treat the area median as a directional anchor; commission a surveyor for a property-specific figure.",
        valueScore: hasData
          ? `${tier === "prime" ? "8.2" : tier === "premium" ? "7.8" : tier === "mid-market" ? "7.4" : "7.0"} / 10`
          : "Check with surveyor",
      },
      comparableSales: comparables.length > 0 ? comparables : [
        { address: `Transaction volume in ${areaName} is thin for the period covered — HM Land Registry records fewer recent sales at this postcode level. Use the 5-year price trend and area median as your primary anchors; treat any comparable figures as directional rather than precise.`, price: "—", date: "—", type: "—" },
      ],
      negotiationBrief: {
        suggestedOfferRange: hasData
          ? `${fmt(latestMedian * 0.88)} – ${fmt(latestMedian * 0.97)}`
          : "See offer strategy below.",
        leveragePoints: [],
      },
      offerStrategy: {
        confidence: offerConfidence,
        confidenceNote,
        fairValueRange,
        openingRange,
        rationale,
        sellerPressurePoints,
        preOfferQuestions,
      },
    };
  }

  const id = briefIdCounter++;
  const report: BriefReport = {
    id, query, queryType,
    generatedAt: new Date().toISOString(),
    areaIntelligence,
    propertyDeepDive,
    lat: meta?.lat,
    lng: meta?.lng,
  };
  briefStore[id] = report;
  return report;
}

export function getBrief(id: number): BriefReport | undefined {
  return briefStore[id];
}
