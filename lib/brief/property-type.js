/**
 * lib/brief/property-type.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PROPERTY-TYPE SPLIT (dwelling / accommodation type) — REAL ONS Census 2021 data.
 *
 * Source: ONS Census 2021 table TS044 "Accommodation type", pulled live from the
 * Nomis API (dataset NM_2062_1) at LOCAL-AUTHORITY granularity. Households in the
 * area classified as detached / semi-detached / terraced / flats (purpose-built,
 * converted, commercial) / caravan-or-other, with counts AND percentages.
 *
 * This is the housing STOCK mix of the area (per Census day, 21 March 2021) — an
 * area characteristic, deliberately labelled with its true granularity (the whole
 * local authority) and date. It is NOT the mix of what's currently for sale.
 *
 * GEOGRAPHY: uses location.laCode (GSS code, e.g. "E09000012"). For a district-wide
 * (bare-outcode) brief that carries no laCode, we reverse-geocode the centroid to a
 * representative authority via Postcodes.io. Best-effort: its own timeout, never
 * throws, so it can never abort the brief.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const NOMIS_TS044 = "https://www.nomisweb.co.uk/api/v01/dataset/NM_2062_1.data.json";
const POSTCODES_IO = "https://api.postcodes.io";
const TIMEOUT_MS = 6000;

/**
 * Fetch with an AbortSignal timeout; returns parsed JSON or null (never throws).
 */
async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve a representative LA GSS code for a location lacking laCode (outcode-wide). */
async function reverseGeocodeLaCode(location) {
  if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) return "";
  const json = await getJson(`${POSTCODES_IO}/postcodes?lon=${location.lng}&lat=${location.lat}&limit=1`);
  return String(json?.result?.[0]?.codes?.admin_district || "");
}

/**
 * @param {import("./resolve.js").ResolvedLocation} location
 * @returns {Promise<{ ok:boolean, laCode?:string, laName?:string, granularity?:string,
 *   dateLabel?:string, total?:number, categories?:Array<{key:string,label:string,count:number,percent:number}>,
 *   reason?:string }>}
 */
export async function fetchPropertyType(location) {
  const laCode = location?.laCode || (await reverseGeocodeLaCode(location));
  if (!laCode) {
    return { ok: false, reason: "no-la-code" };
  }

  // measures 20100 = count of households, 20301 = percent. One geography, ~9 cells.
  const url = `${NOMIS_TS044}?geography=${encodeURIComponent(laCode)}&measures=20100,20301&uid=0`;
  const json = await getJson(url);
  const obs = Array.isArray(json?.obs) ? json.obs : null;
  if (!obs || obs.length === 0) {
    return { ok: false, reason: "no-data", laCode };
  }

  // Fold the (category × measure) rows into one row per category with count + percent.
  // The "Total" cell (accommodation code 0) is captured separately for the denominator.
  const byCat = new Map();
  let total = 0;
  let laName = location?.localAuthority || "";
  for (const o of obs) {
    const cat = o?.c2021_acctype_9;
    const measure = o?.measures?.value; // 20100 (count) | 20301 (percent)
    const value = Number(o?.obs_value?.value);
    if (!cat || !Number.isFinite(value)) continue;
    laName = o?.geography?.description || laName;
    const code = String(cat.value);
    const label = String(cat.description || "");

    if (code === "0") {
      if (measure === 20100) total = value;
      continue; // Total — not a displayed category
    }
    if (!byCat.has(code)) byCat.set(code, { key: code, label: friendlyLabel(label), count: 0, percent: 0 });
    const row = byCat.get(code);
    if (measure === 20100) row.count = value;
    else if (measure === 20301) row.percent = value;
  }

  const categories = [...byCat.values()]
    .filter((c) => c.count > 0 || c.percent > 0)
    .sort((a, b) => b.count - a.count);

  if (categories.length === 0) {
    return { ok: false, reason: "no-data", laCode, laName };
  }

  return {
    ok: true,
    laCode,
    laName,
    granularity: "Local authority",
    dateLabel: "ONS Census 2021 (21 March 2021)",
    total,
    categories,
  };
}

/**
 * Compress the ONS category wording to a display label without losing meaning.
 * (The raw labels are e.g. "In a purpose-built block of flats or tenement".)
 */
function friendlyLabel(raw) {
  const s = raw.toLowerCase();
  if (s.includes("detached") && !s.includes("semi")) return "Detached house/bungalow";
  if (s.includes("semi-detached")) return "Semi-detached house/bungalow";
  if (s.includes("terraced")) return "Terraced house/bungalow";
  if (s.includes("purpose-built")) return "Purpose-built flat";
  // Two DISTINCT converted categories — keep them apart, don't collapse to one label.
  if (s.includes("shared") || s.includes("converted or shared") || s.includes("bedsit")) return "Converted/shared house flat";
  if (s.includes("another converted") || s.includes("former school") || s.includes("converted building")) return "Flat in a converted building";
  if (s.includes("commercial")) return "Flat in a commercial building";
  if (s.includes("caravan") || s.includes("mobile") || s.includes("temporary")) return "Caravan/other mobile or temporary";
  return raw.replace(/^In an?\s+/i, "").replace(/^Part of a\s+/i, "");
}
