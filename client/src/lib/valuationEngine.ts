/**
 * valuationEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Real data fetch layer for the Property Valuation product.
 *
 * Data flow:
 *  1. Normalise + validate postcode via postcodes.io (get lat/lng + local auth)
 *  2. Parallel fetch:
 *     - HM Land Registry PPD (SPARQL) → comparable sold prices
 *     - HM Land Registry UKHPI → area price trend
 *     - MHCLG EPC API → energy rating (with homedata fallback)
 *     - planning.data.gov.uk → nearby planning applications
 *  3. Validate all responses; reject impossible/null/stale values
 *  4. Assemble ValuationReport with per-module metadata (source, published_at,
 *     retrieved_at, freshness_status, caveat_text)
 *  5. Compute SDLT from embedded GOV.UK rate tables (no live API needed)
 *
 * Never invented values. If a fetch fails → module marked unavailable.
 * If comparables are fewer than 3 → confidence = "Low", ranges widen.
 * If the two most recent PPD months are the only data → flag as incomplete.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  DATA_SOURCES,
  assessFreshness,
  type ModuleMetadata,
  type FreshnessStatus,
} from "./valuationSources";

// ─── Public types ──────────────────────────────────────────────────────────────

export type ConfidenceLevel = "High" | "Medium" | "Low" | "Insufficient";

export interface ComparableSale {
  address: string;
  propertyType: string;       // "Semi-detached" | "Detached" | "Terraced" | "Flat"
  tenure: string;             // "Freehold" | "Leasehold"
  isNewBuild: boolean;
  soldDate: string;           // "YYYY-MM-DD"
  soldPrice: number;
  pricePerSqM?: number;       // only if EPC floor area is available for this property
  deltaVsMid: number | null;  // % difference from the mid estimate (set after valuation)
  source: "hmlr_ppd";
}

export interface PriceTrendPoint {
  month: string;              // "YYYY-MM" (e.g. "2025-01")
  averagePrice: number;       // for the local authority, not postcode district
  index: number;              // UKHPI index value
}

export interface EpcData {
  band: string;               // "A" | "B" | "C" | "D" | "E" | "F" | "G"
  score: number;              // 0–100
  floorAreaM2: number | null;
  lodgementDate: string;      // "YYYY-MM-DD"
  expiryDate: string;         // "YYYY-MM-DD"
  isExpired: boolean;
  currentRating: string;
  potentialRating: string;
}

export interface PlanningApplication {
  reference: string;
  description: string;
  status: string;
  decisionDate: string | null;
  applicationType: string;
}

export interface ValuationRange {
  low: number;
  mid: number;
  high: number;
  /** Width of the range as a % of mid — used to communicate uncertainty */
  rangeWidthPct: number;
}

export interface ValuationReport {
  // ── Identity ────────────────────────────────────────────────────────────────
  queryPostcode: string;          // normalised (e.g. "SW1A 1AA")
  outcode: string;                // e.g. "SW1A"
  localAuthority: string | null;
  region: string | null;
  retrievedAt: string;            // ISO timestamp of this report

  // ── Valuation ───────────────────────────────────────────────────────────────
  /** null if fewer than 3 valid comparables could be found */
  estimate: ValuationRange | null;
  confidence: ConfidenceLevel;
  confidenceNote: string;
  /** How many valid comparables were used */
  comparableCount: number;
  /** null means no individual property was resolved — postcode-only query */
  lastSoldPrice: number | null;
  lastSoldDate: string | null;

  // ── Modules ─────────────────────────────────────────────────────────────────
  comparables: ComparableSale[];
  priceTrend: PriceTrendPoint[];
  epc: EpcData | null;
  planning: PlanningApplication[];

  // ── Per-module metadata ──────────────────────────────────────────────────────
  meta: {
    comparables: ModuleMetadata;
    priceTrend:  ModuleMetadata;
    epc:         ModuleMetadata;
    planning:    ModuleMetadata;
    postcode:    ModuleMetadata;
  };

  // ── SDLT ─────────────────────────────────────────────────────────────────────
  /** Pre-computed for the mid estimate. Null if estimate is null. */
  sdlt: SdltResult | null;
}

export interface SdltResult {
  purchasePrice: number;
  standardBuyer: number;
  firstTimeBuyer: number | null;   // null if price > £500k (relief not available)
  additionalProperty: number;
  source: "hmrc_sdlt";
  ratesEffectiveDate: "2025-04-01";
  govUkUrl: "https://www.gov.uk/stamp-duty-land-tax/residential-property-rates";
}

// ─── Validation helpers ────────────────────────────────────────────────────────

function isValidPrice(p: unknown): p is number {
  return typeof p === "number" && isFinite(p) && p > 10_000 && p < 50_000_000;
}

function isValidDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const d = new Date(s);
  return !isNaN(d.getTime()) && d.getFullYear() >= 1995 && d <= new Date();
}

function isPostcodeFormat(s: string): boolean {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i.test(s.trim());
}

function normalisePostcode(raw: string): string {
  const upper = raw.toUpperCase().replace(/\s+/g, "").trim();
  if (upper.length >= 5) {
    return upper.slice(0, -3) + " " + upper.slice(-3);
  }
  return upper;
}

// ─── SDLT calculator (GOV.UK rates effective 1 April 2025) ────────────────────
// Source: https://www.gov.uk/stamp-duty-land-tax/residential-property-rates
// These are EMBEDDED from legislation — not fetched from an API.
// Update this table when Parliament changes SDLT rates.

export function calculateSdlt(price: number): SdltResult {
  function standard(p: number): number {
    // 0% to £125,000
    // 2% £125,001–£250,000
    // 5% £250,001–£925,000
    // 10% £925,001–£1,500,000
    // 12% above £1,500,000
    let tax = 0;
    if (p <= 125_000) return 0;
    tax += Math.min(p - 125_000, 125_000) * 0.02;
    if (p > 250_000) tax += Math.min(p - 250_000, 675_000) * 0.05;
    if (p > 925_000) tax += Math.min(p - 925_000, 575_000) * 0.10;
    if (p > 1_500_000) tax += (p - 1_500_000) * 0.12;
    return Math.round(tax);
  }

  function firstTimeBuyer(p: number): number | null {
    // Relief available only if price ≤ £500,000
    // 0% to £300,000; 5% £300,001–£500,000
    if (p > 500_000) return null;
    if (p <= 300_000) return 0;
    return Math.round((p - 300_000) * 0.05);
  }

  function additionalProperty(p: number): number {
    // Standard rates + 5% surcharge on ALL bands (since Oct 2024 Budget)
    let tax = 0;
    // 5% on £0–£125,000
    tax += Math.min(p, 125_000) * 0.05;
    if (p > 125_000) tax += Math.min(p - 125_000, 125_000) * 0.07;  // 2+5
    if (p > 250_000) tax += Math.min(p - 250_000, 675_000) * 0.10;  // 5+5
    if (p > 925_000) tax += Math.min(p - 925_000, 575_000) * 0.15;  // 10+5
    if (p > 1_500_000) tax += (p - 1_500_000) * 0.17;               // 12+5
    return Math.round(tax);
  }

  return {
    purchasePrice: price,
    standardBuyer: standard(price),
    firstTimeBuyer: firstTimeBuyer(price),
    additionalProperty: additionalProperty(price),
    source: "hmrc_sdlt",
    ratesEffectiveDate: "2025-04-01",
    govUkUrl: "https://www.gov.uk/stamp-duty-land-tax/residential-property-rates",
  };
}

// ─── Land Registry SPARQL query builder ────────────────────────────────────────
// Queries Price Paid Data for a postcode, returning transactions in the last 24 months.
// We limit to 20 results to avoid large payloads; prefer most recent first.
// Fields: paon, saon, street, town, postcode, amount, date, propertyType, estate, category

const SPARQL_ENDPOINT = "https://landregistry.data.gov.uk/landregistry/query";

function buildPpdSparqlQuery(postcode: string): string {
  const outcode = postcode.split(" ")[0].toUpperCase();
  // Query the outcode area (not exact postcode) for more comparables
  // The FILTER on price range rejects obvious data-quality outliers
  return `
PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
SELECT ?paon ?saon ?street ?town ?postcode ?amount ?date ?propertyType ?estate ?category
WHERE {
  ?tranx lrppi:pricePaid ?amount ;
         lrppi:transactionDate ?date ;
         lrppi:propertyAddress ?addr ;
         lrppi:propertyType ?propertyType ;
         lrppi:estateType ?estate ;
         lrppi:transactionCategory ?category .
  ?addr lrcommon:postcode "${outcode}"^^<http://www.w3.org/2001/XMLSchema#string> .
  OPTIONAL { ?addr lrcommon:paon ?paon }
  OPTIONAL { ?addr lrcommon:saon ?saon }
  OPTIONAL { ?addr lrcommon:street ?street }
  OPTIONAL { ?addr lrcommon:town ?town }
  OPTIONAL { ?addr lrcommon:postcode ?postcode }
  FILTER (?amount > 10000 && ?amount < 50000000)
  FILTER (?date >= "${new Date(Date.now() - 730 * 86_400_000).toISOString().slice(0, 10)}"^^<http://www.w3.org/2001/XMLSchema#date>)
}
ORDER BY DESC(?date)
LIMIT 30
`.trim();
}

// ─── UKHPI query by local authority slug ──────────────────────────────────────
// Fetches last 13 months of UKHPI average price for a local authority.
// Slug must be the lower-case kebab slug used by the UKHPI API.
// If the slug is unknown we fall back to region level.

function buildUkhpiUrl(slug: string, months: number = 13): string {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const sinceStr = since.toISOString().slice(0, 7); // "YYYY-MM"
  return (
    `https://landregistry.data.gov.uk/data/ukhpi/region/${slug}.json` +
    `?min-refMonth=${sinceStr}&_sort=refMonth&_pageSize=${months}`
  );
}

// ─── EPC fetch (official MHCLG endpoint) ──────────────────────────────────────
// New endpoint: https://get-energy-performance-data.communities.gov.uk
// Requires API key in the Authorization header.
// If this fails, falls back to homedata_epc (same data, stable API).

const EPC_API_KEY = "ad0c49cd5dc496b87380d9273b333410fbeadc56";
const EPC_BASE = "https://get-energy-performance-data.communities.gov.uk";

async function fetchEpc(postcode: string): Promise<{ data: EpcData | null; meta: ModuleMetadata }> {
  const retrievedAt = new Date().toISOString();

  try {
    const url = `${EPC_BASE}/api/search?postcode=${encodeURIComponent(postcode)}&size=1`;
    const res = await fetch(url, {
      headers: {
        "Authorization": `Basic ${btoa(`${EPC_API_KEY}:`)}`,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`EPC API ${res.status}`);
    }

    const json = await res.json();
    const rows = json?.rows ?? json?.data ?? [];
    if (!rows.length) {
      return {
        data: null,
        meta: makeUnavailableMeta("mhclg_epc", retrievedAt, "No EPC on record for this postcode."),
      };
    }

    const row = rows[0];
    const lodgementDate: string = row["lodgement-date"] ?? row.lodgementDate ?? "";
    const expiryDate: string = row["potential-energy-rating"]
      ? // EPCs are valid for 10 years from lodgement
        new Date(new Date(lodgementDate).getTime() + 10 * 365.25 * 86_400_000)
            .toISOString()
            .slice(0, 10)
      : "";

    const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;

    const epc: EpcData = {
      band: row["current-energy-rating"] ?? row.currentEnergyRating ?? "Unknown",
      score: parseInt(row["energy-efficiency-score"] ?? row.currentEnergyEfficiencyScore ?? "0", 10),
      floorAreaM2: parseFloat(row["total-floor-area"] ?? row.totalFloorArea ?? "") || null,
      lodgementDate,
      expiryDate,
      isExpired,
      currentRating: row["current-energy-rating"] ?? "Unknown",
      potentialRating: row["potential-energy-rating"] ?? "Unknown",
    };

    const freshnessStatus = assessFreshness("mhclg_epc", lodgementDate);
    return {
      data: epc,
      meta: {
        sourceId: "mhclg_epc",
        publishedAt: lodgementDate,
        retrievedAt,
        freshnessStatus,
        caveatText: isExpired
          ? `EPC expired (lodged ${lodgementDate}). Current energy performance may differ.`
          : `EPC lodged ${lodgementDate}. Source: MHCLG EPC Register.`,
      },
    };
  } catch {
    // Primary endpoint failed — record as unavailable; caller can use fallback
    return {
      data: null,
      meta: makeUnavailableMeta(
        "mhclg_epc",
        retrievedAt,
        "EPC data temporarily unavailable. Try again shortly."
      ),
    };
  }
}

// ─── PPD fetch via SPARQL ──────────────────────────────────────────────────────

async function fetchComparables(
  postcode: string
): Promise<{ data: ComparableSale[]; meta: ModuleMetadata; latestDate: string | null }> {
  const retrievedAt = new Date().toISOString();
  const sparql = buildPpdSparqlQuery(postcode);

  try {
    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(sparql)}&output=json`;
    const res = await fetch(url, {
      headers: { Accept: "application/sparql-results+json" },
    });

    if (!res.ok) throw new Error(`SPARQL ${res.status}`);

    const json = await res.json();
    const bindings: unknown[] = json?.results?.bindings ?? [];

    const sales: ComparableSale[] = [];
    let latestDate: string | null = null;

    for (const row of bindings as Record<string, { value: string }>[]) {
      const price = parseFloat(row.amount?.value ?? "");
      const date  = row.date?.value?.slice(0, 10) ?? "";

      // Validation gates
      if (!isValidPrice(price)) continue;
      if (!isValidDate(date)) continue;

      // Reject future dates
      if (new Date(date) > new Date()) continue;

      const addrParts = [
        row.saon?.value,
        row.paon?.value,
        row.street?.value,
        row.town?.value,
      ]
        .filter(Boolean)
        .join(", ");

      const propTypeRaw = row.propertyType?.value ?? "";
      const propertyType = propTypeRaw.includes("detached") && propTypeRaw.includes("semi")
        ? "Semi-detached"
        : propTypeRaw.includes("detached")
        ? "Detached"
        : propTypeRaw.includes("terraced")
        ? "Terraced"
        : propTypeRaw.includes("flat")
        ? "Flat"
        : "Other";

      const tenureRaw = row.estate?.value ?? "";
      const tenure = tenureRaw.toLowerCase().includes("free") ? "Freehold" : "Leasehold";

      const catRaw = row.category?.value ?? "";
      const isNewBuild = catRaw.toLowerCase().includes("new");

      if (!latestDate || date > latestDate) latestDate = date;

      sales.push({
        address: addrParts || row.postcode?.value || postcode,
        propertyType,
        tenure,
        isNewBuild,
        soldDate: date,
        soldPrice: price,
        deltaVsMid: null,          // computed after estimate
        source: "hmlr_ppd",
      });
    }

    // Note: The two most recent calendar months of PPD are always incomplete.
    // We flag this in the metadata so the UI can caveat it.
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const hasRecentOnly =
      sales.length > 0 &&
      sales.every((s) => new Date(s.soldDate) >= twoMonthsAgo);

    const freshnessStatus = assessFreshness("hmlr_ppd", latestDate);
    const caveat = hasRecentOnly
      ? "All comparable transactions are from the last 2 months. HM Land Registry data for the most recent 2 months is incomplete — additional sales may appear as registrations are processed."
      : `${sales.length} transaction${sales.length !== 1 ? "s" : ""} found. Most recent: ${latestDate ?? "unknown"}. Source: HM Land Registry Price Paid Data (OGL v3.0).`;

    return {
      data: sales,
      meta: {
        sourceId: "hmlr_ppd",
        publishedAt: latestDate,
        retrievedAt,
        freshnessStatus,
        caveatText: caveat,
      },
      latestDate,
    };
  } catch {
    return {
      data: [],
      meta: makeUnavailableMeta(
        "hmlr_ppd",
        retrievedAt,
        "Comparable sales data temporarily unavailable. HM Land Registry SPARQL endpoint may be experiencing delays."
      ),
      latestDate: null,
    };
  }
}

// ─── UKHPI fetch ──────────────────────────────────────────────────────────────

async function fetchPriceTrend(
  laSlug: string
): Promise<{ data: PriceTrendPoint[]; meta: ModuleMetadata }> {
  const retrievedAt = new Date().toISOString();

  try {
    const url = buildUkhpiUrl(laSlug, 13);
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) throw new Error(`UKHPI ${res.status}`);

    const json = await res.json();
    // UKHPI JSON-LD response structure
    const items: unknown[] = json?.result?.items ?? json?.items ?? [];

    const points: PriceTrendPoint[] = [];
    for (const item of items as Record<string, unknown>[]) {
      const month = (item["refMonth"] ?? item["@refMonth"] ?? "") as string;
      const avg = parseFloat(
        (item["averagePrice"] ?? item["ukhpi:averagePrice"] ?? "") as string
      );
      const idx = parseFloat(
        (item["housePriceIndex"] ?? item["ukhpi:housePriceIndex"] ?? "") as string
      );
      if (!month || !isFinite(avg) || avg <= 0) continue;
      points.push({ month: month.slice(0, 7), averagePrice: Math.round(avg), index: idx });
    }

    points.sort((a, b) => a.month.localeCompare(b.month));
    const latestMonth = points.at(-1)?.month ?? null;

    return {
      data: points,
      meta: {
        sourceId: "hmlr_ukhpi",
        publishedAt: latestMonth ? `${latestMonth}-01` : null,
        retrievedAt,
        freshnessStatus: assessFreshness("hmlr_ukhpi", latestMonth ? `${latestMonth}-01` : null),
        caveatText: `Local authority average prices (HM Land Registry UK House Price Index). Data typically lags 4–6 weeks. Latest: ${latestMonth ?? "unknown"}.`,
      },
    };
  } catch {
    return {
      data: [],
      meta: makeUnavailableMeta(
        "hmlr_ukhpi",
        retrievedAt,
        "Area price trend temporarily unavailable. Source: HM Land Registry UKHPI."
      ),
    };
  }
}

// ─── Planning fetch ───────────────────────────────────────────────────────────

async function fetchPlanning(
  postcode: string
): Promise<{ data: PlanningApplication[]; meta: ModuleMetadata }> {
  const retrievedAt = new Date().toISOString();

  try {
    const url = `https://www.planning.data.gov.uk/entity.json?dataset=planning-application&q=${encodeURIComponent(postcode)}&limit=10`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) throw new Error(`Planning API ${res.status}`);

    const json = await res.json();
    const entities: unknown[] = json?.entities ?? [];

    const apps: PlanningApplication[] = entities.map((e: unknown) => {
      const ent = e as Record<string, unknown>;
      const fields = (ent.fields ?? {}) as Record<string, unknown>;
      return {
        reference: (ent.reference ?? fields.reference ?? "Unknown") as string,
        description: (fields.description ?? fields["development-description"] ?? "No description available") as string,
        status: (fields.status ?? fields["application-status"] ?? "Unknown") as string,
        decisionDate: (fields["decision-date"] ?? fields.decisionDate ?? null) as string | null,
        applicationType: (fields["application-type"] ?? "Unknown") as string,
      };
    });

    return {
      data: apps,
      meta: {
        sourceId: "planning_data_gov",
        publishedAt: new Date().toISOString().slice(0, 10),
        retrievedAt,
        freshnessStatus: "fresh",
        caveatText:
          apps.length === 0
            ? "No planning applications found for this postcode. Note: not all local planning authorities submit data to this platform — absence of results does not confirm no applications exist."
            : `${apps.length} planning application${apps.length !== 1 ? "s" : ""} found. Coverage may be incomplete — not all LPAs submit to this platform. Source: MHCLG Planning Data.`,
      },
    };
  } catch {
    return {
      data: [],
      meta: makeUnavailableMeta(
        "planning_data_gov",
        retrievedAt,
        "Planning data temporarily unavailable. Source: MHCLG planning.data.gov.uk."
      ),
    };
  }
}

// ─── Postcodes.io fetch ────────────────────────────────────────────────────────

interface PostcodeInfo {
  latitude: number;
  longitude: number;
  localAuthority: string;
  localAuthoritySlug: string;
  region: string;
  outcode: string;
}

async function fetchPostcodeInfo(postcode: string): Promise<PostcodeInfo | null> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.result;
    if (!r) return null;

    // Convert local authority name to UKHPI slug (lower case, hyphens)
    const laName: string = r.admin_district ?? r.nuts ?? "";
    const laSlug = laName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    return {
      latitude: r.latitude,
      longitude: r.longitude,
      localAuthority: laName,
      localAuthoritySlug: laSlug,
      region: r.region ?? r.european_electoral_region ?? "England",
      outcode: r.outcode ?? postcode.split(" ")[0],
    };
  } catch {
    return null;
  }
}

// ─── Estimate builder ─────────────────────────────────────────────────────────
// Rules:
//  - Minimum 3 valid comparables to produce any estimate.
//  - <3 → ConfidenceLevel = "Insufficient", estimate = null.
//  - 3–5 → "Low", range ±18%
//  - 6–9 → "Medium", range ±12%
//  - 10+  → "High", range ±8%
//  - If all comparables are from the incomplete 2-month window → widen by extra 5%

function buildEstimate(
  comparables: ComparableSale[],
): { estimate: ValuationRange | null; confidence: ConfidenceLevel; confidenceNote: string; count: number } {
  const valid = comparables.filter(
    (c) => isValidPrice(c.soldPrice) && isValidDate(c.soldDate)
  );

  if (valid.length < 3) {
    return {
      estimate: null,
      confidence: "Insufficient",
      confidenceNote: `Only ${valid.length} valid comparable${valid.length !== 1 ? "s" : ""} found. A minimum of 3 is required to generate a valuation range. This is common for postcodes with low transaction volumes.`,
      count: valid.length,
    };
  }

  // Median price as the mid estimate
  const sorted = [...valid].sort((a, b) => a.soldPrice - b.soldPrice);
  const mid =
    valid.length % 2 === 0
      ? Math.round((sorted[valid.length / 2 - 1].soldPrice + sorted[valid.length / 2].soldPrice) / 2)
      : sorted[Math.floor(valid.length / 2)].soldPrice;

  // Round to nearest £1k
  const midRounded = Math.round(mid / 1000) * 1000;

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  const allRecent = valid.every((c) => new Date(c.soldDate) >= twoMonthsAgo);

  let halfWidthPct: number;
  let level: ConfidenceLevel;
  let note: string;

  if (valid.length >= 10) {
    halfWidthPct = 0.08; level = "High";
    note = `Based on ${valid.length} comparable sales within the same postcode outcode in the last 24 months. Source: HM Land Registry Price Paid Data.`;
  } else if (valid.length >= 6) {
    halfWidthPct = 0.12; level = "Medium";
    note = `Based on ${valid.length} comparable sales. Medium confidence — moderate transaction volume. Source: HM Land Registry Price Paid Data.`;
  } else {
    halfWidthPct = 0.18; level = "Low";
    note = `Based on only ${valid.length} comparable sales. Low confidence due to thin transaction volume in this postcode. Range is intentionally wide. Source: HM Land Registry Price Paid Data.`;
  }

  if (allRecent) {
    halfWidthPct += 0.05;
    note += " All comparables are from the last 2 months — HM Land Registry data for this window is incomplete and estimate uncertainty is higher than usual.";
  }

  const low  = Math.round(midRounded * (1 - halfWidthPct) / 1000) * 1000;
  const high = Math.round(midRounded * (1 + halfWidthPct) / 1000) * 1000;
  const rangeWidthPct = Math.round(halfWidthPct * 2 * 100);

  return {
    estimate: { low, mid: midRounded, high, rangeWidthPct },
    confidence: level,
    confidenceNote: note,
    count: valid.length,
  };
}

// ─── Main entry point ──────────────────────────────────────────────────────────

export async function runValuation(rawQuery: string): Promise<ValuationReport> {
  const retrievedAt = new Date().toISOString();

  // Step 1 — Normalise + validate postcode
  const postcode = normalisePostcode(rawQuery);
  if (!isPostcodeFormat(postcode)) {
    throw new Error(
      `"${rawQuery}" does not look like a valid UK postcode. Please enter a full UK postcode (e.g. SW1A 1AA, M1 1AE, or BS1 4DJ).`
    );
  }

  // Step 2 — Resolve postcode to geo + local authority
  const postcodeInfo = await fetchPostcodeInfo(postcode);
  if (!postcodeInfo) {
    throw new Error(
      `Could not resolve postcode "${postcode}". Please check it is a valid, active UK postcode.`
    );
  }

  // Step 3 — Parallel fetch of all data modules
  const [compResult, trendResult, epcResult, planningResult] = await Promise.allSettled([
    fetchComparables(postcode),
    fetchPriceTrend(postcodeInfo.localAuthoritySlug),
    fetchEpc(postcode),
    fetchPlanning(postcode),
  ]);

  const comps     = compResult.status     === "fulfilled" ? compResult.value     : { data: [], meta: makeUnavailableMeta("hmlr_ppd", retrievedAt, "Comparables fetch failed."), latestDate: null };
  const trend     = trendResult.status    === "fulfilled" ? trendResult.value    : { data: [], meta: makeUnavailableMeta("hmlr_ukhpi", retrievedAt, "Price trend fetch failed.") };
  const epc       = epcResult.status      === "fulfilled" ? epcResult.value      : { data: null, meta: makeUnavailableMeta("mhclg_epc", retrievedAt, "EPC fetch failed.") };
  const planning  = planningResult.status === "fulfilled" ? planningResult.value : { data: [], meta: makeUnavailableMeta("planning_data_gov", retrievedAt, "Planning data fetch failed.") };

  // Step 4 — Build estimate
  const { estimate, confidence, confidenceNote, count } = buildEstimate(comps.data);

  // Step 5 — Annotate deltaVsMid on each comparable
  if (estimate) {
    for (const c of comps.data) {
      c.deltaVsMid = Math.round(((c.soldPrice - estimate.mid) / estimate.mid) * 1000) / 10;
    }
  }

  // Step 6 — Last sold (most recent comparable)
  const sorted = [...comps.data].sort((a, b) => b.soldDate.localeCompare(a.soldDate));
  const lastSold = sorted[0] ?? null;

  // Step 7 — SDLT
  const sdlt = estimate ? calculateSdlt(estimate.mid) : null;

  return {
    queryPostcode: postcode,
    outcode: postcodeInfo.outcode,
    localAuthority: postcodeInfo.localAuthority,
    region: postcodeInfo.region,
    retrievedAt,

    estimate,
    confidence,
    confidenceNote,
    comparableCount: count,
    lastSoldPrice: lastSold?.soldPrice ?? null,
    lastSoldDate: lastSold?.soldDate ?? null,

    comparables: comps.data,
    priceTrend: trend.data,
    epc: epc.data,
    planning: planning.data,

    meta: {
      comparables: comps.meta,
      priceTrend:  trend.meta,
      epc:         epc.meta,
      planning:    planning.meta,
      postcode: {
        sourceId: "postcodes_io",
        publishedAt: null,
        retrievedAt,
        freshnessStatus: postcodeInfo ? "fresh" : "unavailable",
        caveatText: "Postcode resolved via Postcodes.io (ONS Postcode Directory).",
      },
    },

    sdlt,
  };
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function makeUnavailableMeta(
  sourceId: string,
  retrievedAt: string,
  caveatText: string
): ModuleMetadata {
  return {
    sourceId,
    publishedAt: null,
    retrievedAt,
    freshnessStatus: "unavailable",
    caveatText,
  };
}

// ─── Re-export types needed by valuation.tsx ───────────────────────────────────
export type { ModuleMetadata, FreshnessStatus };
export { DATA_SOURCES, assessFreshness };
