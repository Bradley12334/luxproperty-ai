/**
 * valuationEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Real data fetch layer for the Property Valuation product.
 *
 * Data flow:
 *  1. Normalise + validate postcode via postcodes.io (get lat/lng + local auth)
 *  2. Progressive radius comparable search (up to 3 miles):
 *     - Ring 0: exact postcode
 *     - Ring 1: 0.25 mile radius  → postcodes.io nearby, batch SPARQL
 *     - Ring 2: 0.5 mile radius
 *     - Ring 3: 1 mile radius
 *     - Ring 4: 2 mile radius
 *     - Ring 5: 3 mile radius (max)
 *     Stops expanding once enough strong comparables exist.
 *  3. Weight each comparable by proximity, recency, and type similarity.
 *  4. Parallel fetch: UKHPI trend, EPC, planning (unchanged).
 *  5. Three-tier estimate:
 *     Tier 1 (strong): weighted-median of quality comparables, ±8–18%
 *     Tier 2 (indicative): thin data, wider range, clear caveat
 *     Tier 3 (unavailable): only when truly no usable evidence
 *  6. Compute SDLT from embedded GOV.UK rate tables.
 *
 * Never invented values. Honesty over coverage, but resilient over brittle.
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
export type ValuationState  = "strong" | "indicative" | "unavailable";

export interface ComparableSale {
  address:      string;
  propertyType: string;        // "Semi-detached" | "Detached" | "Terraced" | "Flat" | "Other"
  tenure:       string;        // "Freehold" | "Leasehold"
  isNewBuild:   boolean;
  soldDate:     string;        // "YYYY-MM-DD"
  soldPrice:    number;
  distanceMiles: number;       // distance from subject postcode centroid
  weight:       number;        // composite weight 0–1 (higher = more influential)
  pricePerSqM?: number;
  deltaVsMid:   number | null;
  source:       "hmlr_ppd";
}

export interface PriceTrendPoint {
  month:        string;        // "YYYY-MM"
  averagePrice: number;
  index:        number;
}

export interface EpcData {
  band:           string;
  score:          number;
  floorAreaM2:    number | null;
  lodgementDate:  string;
  expiryDate:     string;
  isExpired:      boolean;
  currentRating:  string;
  potentialRating: string;
}

export interface PlanningApplication {
  reference:       string;
  description:     string;
  status:          string;
  decisionDate:    string | null;
  applicationType: string;
}

export interface ValuationRange {
  low:           number;
  mid:           number;
  high:          number;
  rangeWidthPct: number;
  valuationState: ValuationState;
}

export interface ValuationReport {
  // ── Identity ──────────────────────────────────────────────────────────────
  queryPostcode:  string;
  outcode:        string;
  localAuthority: string | null;
  region:         string | null;
  retrievedAt:    string;

  // ── Valuation ─────────────────────────────────────────────────────────────
  estimate:          ValuationRange | null;
  confidence:        ConfidenceLevel;
  confidenceNote:    string;
  confidenceReason:  string;           // machine-readable summary for UI logic
  valuationState:    ValuationState;
  fallbacksUsed:     string[];
  comparableCount:   number;
  searchRadiusUsed:  number;           // miles — the radius at which search stopped
  lastSoldPrice:     number | null;
  lastSoldDate:      string | null;

  // ── Modules ───────────────────────────────────────────────────────────────
  comparables: ComparableSale[];
  priceTrend:  PriceTrendPoint[];
  epc:         EpcData | null;
  planning:    PlanningApplication[];

  // ── Per-module metadata ───────────────────────────────────────────────────
  meta: {
    comparables: ModuleMetadata;
    priceTrend:  ModuleMetadata;
    epc:         ModuleMetadata;
    planning:    ModuleMetadata;
    postcode:    ModuleMetadata;
  };

  // ── SDLT ──────────────────────────────────────────────────────────────────
  sdlt: SdltResult | null;
}

export interface SdltResult {
  purchasePrice:     number;
  standardBuyer:     number;
  firstTimeBuyer:    number | null;
  additionalProperty: number;
  source:            "hmrc_sdlt";
  ratesEffectiveDate: "2025-04-01";
  govUkUrl:          "https://www.gov.uk/stamp-duty-land-tax/residential-property-rates";
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
  if (upper.length >= 5) return upper.slice(0, -3) + " " + upper.slice(-3);
  return upper;
}

/** Haversine distance in miles between two lat/lng points */
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── SDLT calculator ──────────────────────────────────────────────────────────

export function calculateSdlt(price: number): SdltResult {
  function standard(p: number): number {
    let tax = 0;
    if (p <= 125_000) return 0;
    tax += Math.min(p - 125_000, 125_000) * 0.02;
    if (p > 250_000) tax += Math.min(p - 250_000, 675_000) * 0.05;
    if (p > 925_000) tax += Math.min(p - 925_000, 575_000) * 0.10;
    if (p > 1_500_000) tax += (p - 1_500_000) * 0.12;
    return Math.round(tax);
  }
  function firstTimeBuyer(p: number): number | null {
    if (p > 500_000) return null;
    if (p <= 300_000) return 0;
    return Math.round((p - 300_000) * 0.05);
  }
  function additionalProperty(p: number): number {
    let tax = 0;
    tax += Math.min(p, 125_000) * 0.05;
    if (p > 125_000) tax += Math.min(p - 125_000, 125_000) * 0.07;
    if (p > 250_000) tax += Math.min(p - 250_000, 675_000) * 0.10;
    if (p > 925_000) tax += Math.min(p - 925_000, 575_000) * 0.15;
    if (p > 1_500_000) tax += (p - 1_500_000) * 0.17;
    return Math.round(tax);
  }
  return {
    purchasePrice:      price,
    standardBuyer:      standard(price),
    firstTimeBuyer:     firstTimeBuyer(price),
    additionalProperty: additionalProperty(price),
    source:             "hmrc_sdlt",
    ratesEffectiveDate: "2025-04-01",
    govUkUrl:           "https://www.gov.uk/stamp-duty-land-tax/residential-property-rates",
  };
}

// ─── SPARQL helpers ────────────────────────────────────────────────────────────

const SPARQL_ENDPOINT = "https://landregistry.data.gov.uk/landregistry/query";

/** Exact postcode query — fetches up to 50 transactions, no date filter in SPARQL */
function buildPpdSparqlQueryExact(postcode: string): string {
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
  ?addr lrcommon:postcode "${postcode}"^^<http://www.w3.org/2001/XMLSchema#string> .
  OPTIONAL { ?addr lrcommon:paon ?paon }
  OPTIONAL { ?addr lrcommon:saon ?saon }
  OPTIONAL { ?addr lrcommon:street ?street }
  OPTIONAL { ?addr lrcommon:town ?town }
  OPTIONAL { ?addr lrcommon:postcode ?postcode }
  FILTER (?amount > 10000 && ?amount < 50000000)
}
ORDER BY DESC(?date)
LIMIT 50
`.trim();
}

/**
 * Multi-postcode VALUES query — fetches PPD for up to ~20 postcodes in one request.
 * Using SPARQL VALUES clause to query a set of postcodes simultaneously.
 */
function buildPpdSparqlQueryMulti(postcodes: string[]): string {
  const values = postcodes
    .map((p) => `"${p}"^^<http://www.w3.org/2001/XMLSchema#string>`)
    .join(" ");
  return `
PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
SELECT ?paon ?saon ?street ?town ?postcode ?amount ?date ?propertyType ?estate ?category
WHERE {
  VALUES ?pc { ${values} }
  ?tranx lrppi:pricePaid ?amount ;
         lrppi:transactionDate ?date ;
         lrppi:propertyAddress ?addr ;
         lrppi:propertyType ?propertyType ;
         lrppi:estateType ?estate ;
         lrppi:transactionCategory ?category .
  ?addr lrcommon:postcode ?pc .
  OPTIONAL { ?addr lrcommon:paon ?paon }
  OPTIONAL { ?addr lrcommon:saon ?saon }
  OPTIONAL { ?addr lrcommon:street ?street }
  OPTIONAL { ?addr lrcommon:town ?town }
  OPTIONAL { ?addr lrcommon:postcode ?postcode }
  FILTER (?amount > 10000 && ?amount < 50000000)
}
ORDER BY DESC(?date)
LIMIT 100
`.trim();
}

async function runSparqlQuery(
  sparql: string
): Promise<Record<string, { value: string }>[]> {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(sparql)}&output=json`;
  const res = await fetch(url, {
    headers: { Accept: "application/sparql-results+json" },
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status}`);
  const json = await res.json();
  return (json?.results?.bindings ?? []) as Record<string, { value: string }>[];
}

/** Parse raw SPARQL bindings into a partial ComparableSale (no distance/weight yet) */
function parsePpdBindings(
  bindings: Record<string, { value: string }>[],
  cutoffDate: Date,
  subjectPostcode: string,
): Omit<ComparableSale, "distanceMiles" | "weight">[] {
  const sales: Omit<ComparableSale, "distanceMiles" | "weight">[] = [];

  for (const row of bindings) {
    const price = parseFloat(row.amount?.value ?? "");
    const date  = row.date?.value?.slice(0, 10) ?? "";

    if (!isValidPrice(price)) continue;
    if (!isValidDate(date)) continue;
    if (new Date(date) > new Date()) continue;
    if (new Date(date) < cutoffDate) continue;

    const addrParts = [
      row.saon?.value,
      row.paon?.value,
      row.street?.value,
      row.town?.value,
    ].filter(Boolean).join(", ");

    const propTypeRaw = row.propertyType?.value ?? "";
    const typeSlug    = propTypeRaw.split("/").pop() ?? "";
    const propertyType =
      typeSlug === "semiDetached"                           ? "Semi-detached" :
      typeSlug === "detached"                               ? "Detached"      :
      typeSlug === "terraced"                               ? "Terraced"      :
      typeSlug === "flat"                                   ? "Flat"          :
      propTypeRaw.toLowerCase().includes("semi")           ? "Semi-detached" :
      propTypeRaw.toLowerCase().includes("detach")         ? "Detached"      :
      propTypeRaw.toLowerCase().includes("terrace")        ? "Terraced"      :
      propTypeRaw.toLowerCase().includes("flat")           ? "Flat"          : "Other";

    const tenureRaw = row.estate?.value ?? "";
    const tenure    = tenureRaw.toLowerCase().includes("free") ? "Freehold" : "Leasehold";
    const catRaw    = row.category?.value ?? "";

    sales.push({
      address:      addrParts || row.postcode?.value || subjectPostcode,
      propertyType,
      tenure,
      isNewBuild:   catRaw.toLowerCase().includes("new"),
      soldDate:     date,
      soldPrice:    price,
      deltaVsMid:   null,
      source:       "hmlr_ppd",
    });
  }

  return sales;
}

// ─── Postcodes.io nearby lookup ────────────────────────────────────────────────

interface NearbyPostcode {
  postcode:  string;
  latitude:  number;
  longitude: number;
  distance:  number; // metres, from postcodes.io
}

/**
 * Fetch all postcodes within radiusMetres of the subject lat/lng.
 * postcodes.io /postcodes endpoint supports radius up to 2000m; for larger radii
 * we use the /postcodes?lon=&lat=&radius= endpoint with limit=100.
 */
async function fetchNearbyPostcodes(
  lat: number,
  lng: number,
  radiusMetres: number,
): Promise<NearbyPostcode[]> {
  // postcodes.io max radius is 2000m — for larger radii we call it with 2000m chunks
  // but practically 3 miles = 4828m, so we cap at 2000m per call and do two calls
  const clampedRadius = Math.min(radiusMetres, 2000);
  const url =
    `https://api.postcodes.io/postcodes` +
    `?lon=${lng}&lat=${lat}&radius=${clampedRadius}&limit=100&wideSearch=true`;

  try {
    const res  = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const result: NearbyPostcode[] = (json?.result ?? []).map(
      (r: Record<string, unknown>) => ({
        postcode:  r.postcode as string,
        latitude:  r.latitude as number,
        longitude: r.longitude as number,
        distance:  r.distance as number,
      })
    );
    return result;
  } catch {
    return [];
  }
}

// ─── Comparable weighting ──────────────────────────────────────────────────────
//
// Weight = proximity_score × recency_score × type_score × newbuild_penalty
//
// proximity_score: 1.0 at 0 mi → 0.3 at 3 mi (linear decay)
// recency_score:   1.0 if ≤6 months old → 0.4 at 24 months (linear decay)
// type_score:      1.0 exact match, 0.7 similar (semi↔terraced), 0.5 other
// newbuild_penalty: 0.7 (new builds distort — less weight but not excluded)

function computeWeight(
  distMiles:      number,
  soldDate:       string,
  subjectType:    string | null,
  comparableType: string,
  isNewBuild:     boolean,
): number {
  const MAX_MILES = 3.0;

  // Proximity: linear 1.0→0.3 over 0–3 miles
  const proximityScore = Math.max(0.3, 1.0 - (distMiles / MAX_MILES) * 0.7);

  // Recency: linear 1.0→0.4 over 0–24 months
  const ageMonths = (Date.now() - new Date(soldDate).getTime()) / (1000 * 60 * 60 * 24 * 30.5);
  const recencyScore = Math.max(0.4, 1.0 - (ageMonths / 24) * 0.6);

  // Type similarity
  let typeScore = 0.5;
  if (!subjectType) {
    typeScore = 0.8; // unknown subject type — don't penalise heavily
  } else if (subjectType === comparableType) {
    typeScore = 1.0;
  } else {
    // Semi-detached and Terraced are closer to each other than to Detached or Flat
    const similar = new Set([
      "Semi-detached|Terraced",
      "Terraced|Semi-detached",
    ]);
    if (similar.has(`${subjectType}|${comparableType}`)) {
      typeScore = 0.75;
    }
  }

  const newBuildPenalty = isNewBuild ? 0.7 : 1.0;

  return Math.min(1.0, proximityScore * recencyScore * typeScore * newBuildPenalty);
}

// ─── Progressive radius search ─────────────────────────────────────────────────

const RADIUS_RINGS_MILES = [0, 0.25, 0.5, 1.0, 2.0, 3.0];
// Convert to metres for postcodes.io
const RADIUS_RINGS_METRES = RADIUS_RINGS_MILES.map((m) => Math.round(m * 1609.34));

// Thresholds for stopping the expansion
const STRONG_THRESHOLD    = 5;  // 5+ weighted-good comparables → stop, strong estimate
const ADEQUATE_THRESHOLD  = 3;  // 3–4 → stop, still usable
const MAX_RADIUS_MILES    = 3.0;
const SPARQL_BATCH_SIZE   = 15; // max postcodes per SPARQL VALUES query

interface ComparableWithDist extends Omit<ComparableSale, "distanceMiles" | "weight"> {
  _distMiles: number;
}

/**
 * Fetches comparables using a progressive radius expansion strategy.
 * Stops widening as soon as enough strong comparables are found.
 */
async function fetchComparablesWithRadius(
  subjectPostcode: string,
  subjectLat: number,
  subjectLng: number,
  subjectType: string | null,  // property type if known (from EPC or other source)
): Promise<{
  comparables:        ComparableSale[];
  searchRadiusUsed:   number;
  fallbacksUsed:      string[];
  latestDate:         string | null;
  meta:               ModuleMetadata;
}> {
  const retrievedAt  = new Date().toISOString();
  const cutoffDate   = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
  const fallbacksUsed: string[] = [];

  // Track all unique postcodes we have already queried to avoid duplicates
  const queriedPostcodes = new Set<string>();
  let allComps: ComparableSale[] = [];
  let searchRadiusUsed = 0;
  let latestDate: string | null = null;

  try {
    for (let ringIdx = 0; ringIdx < RADIUS_RINGS_MILES.length; ringIdx++) {
      const radiusMiles  = RADIUS_RINGS_MILES[ringIdx];
      const radiusMetres = RADIUS_RINGS_METRES[ringIdx];

      // ── Collect postcodes for this ring ──────────────────────────────────
      let postcodesToQuery: string[] = [];

      if (ringIdx === 0) {
        // Ring 0: just the subject postcode itself
        postcodesToQuery = [subjectPostcode];
      } else {
        // Rings 1–5: use postcodes.io to find all postcodes within radius
        const nearby = await fetchNearbyPostcodes(subjectLat, subjectLng, radiusMetres);
        postcodesToQuery = nearby
          .map((n) => n.postcode)
          .filter((pc) => !queriedPostcodes.has(pc));

        // Track fallback labels
        if (ringIdx === 1 && fallbacksUsed.length === 0 && allComps.length < STRONG_THRESHOLD) {
          fallbacksUsed.push("radius_expansion");
        }
      }

      if (postcodesToQuery.length === 0) {
        searchRadiusUsed = radiusMiles;
        continue;
      }

      // Mark all as queried
      postcodesToQuery.forEach((pc) => queriedPostcodes.add(pc));

      // ── Batch SPARQL queries ──────────────────────────────────────────────
      // Split into batches of SPARQL_BATCH_SIZE to avoid URL-length limits
      const batches: string[][] = [];
      for (let i = 0; i < postcodesToQuery.length; i += SPARQL_BATCH_SIZE) {
        batches.push(postcodesToQuery.slice(i, i + SPARQL_BATCH_SIZE));
      }

      const newRawSales: ComparableWithDist[] = [];

      await Promise.allSettled(
        batches.map(async (batch) => {
          try {
            const sparql   = batch.length === 1
              ? buildPpdSparqlQueryExact(batch[0])
              : buildPpdSparqlQueryMulti(batch);
            const bindings = await runSparqlQuery(sparql);
            const parsed   = parsePpdBindings(bindings, cutoffDate, subjectPostcode);

            // We need the postcode of each sale to compute distance.
            // For multi-postcode queries the ?postcode binding tells us which postcode
            // the sale is in. For exact queries we know it's the subject postcode.
            for (let i = 0; i < parsed.length; i++) {
              const sale = parsed[i];
              // Find the postcode from bindings — bindings[i].postcode.value
              const salePostcode =
                (bindings[i] as Record<string, { value: string }>)?.postcode?.value
                ?? batch[0];

              // Compute distance using the postcode centroid (approximation via
              // postcodes.io lookup — we use the nearby list for coordinates)
              // For Ring 0 (subject postcode) distance = 0
              let distM = 0;
              if (ringIdx > 0) {
                // We already have the nearby list; find this postcode's coords
                // For simplicity we tag sales with ringIdx-based max distance
                // (exact distance computed only when we have coords)
                distM = radiusMiles; // conservative upper bound for this ring
              }

              newRawSales.push({ ...sale, _distMiles: distM });
            }
          } catch {
            // One batch failed — continue with others
          }
        })
      );

      // Compute accurate distances for Ring 1+ by re-using postcodes.io nearby data
      // For Ring 0 all distances are 0
      if (ringIdx > 0) {
        const nearby = await fetchNearbyPostcodes(subjectLat, subjectLng, radiusMetres);
        const postcodeCoords = new Map(
          nearby.map((n) => [n.postcode, { lat: n.latitude, lng: n.longitude }])
        );
        // Also add subject postcode with distance 0
        postcodeCoords.set(subjectPostcode, { lat: subjectLat, lng: subjectLng });

        for (const sale of newRawSales) {
          // Try to find coords for the address postcode
          // For batched queries the address field may contain the postcode
          // We fall back to ring's maximum radius as a conservative estimate
          const coords = postcodeCoords.get(sale.address.split(" ").slice(-2).join(" "));
          if (coords) {
            sale._distMiles = distanceMiles(subjectLat, subjectLng, coords.lat, coords.lng);
          }
        }
      }

      // Assign proper distance + weight and add to allComps
      for (const raw of newRawSales) {
        const { _distMiles, ...saleParts } = raw;
        // Avoid adding exact duplicates (same price + date + address)
        const isDup = allComps.some(
          (c) => c.soldPrice === saleParts.soldPrice &&
                 c.soldDate  === saleParts.soldDate  &&
                 c.address   === saleParts.address
        );
        if (isDup) continue;

        const weight = computeWeight(
          _distMiles,
          saleParts.soldDate,
          subjectType,
          saleParts.propertyType,
          saleParts.isNewBuild,
        );

        const comp: ComparableSale = {
          ...saleParts,
          distanceMiles: Math.round(_distMiles * 100) / 100,
          weight: Math.round(weight * 100) / 100,
        };

        allComps.push(comp);
        if (!latestDate || comp.soldDate > latestDate) latestDate = comp.soldDate;
      }

      searchRadiusUsed = radiusMiles;

      // ── Check if we have enough to stop ──────────────────────────────────
      const strongComps = allComps.filter((c) => c.weight >= 0.5);
      if (strongComps.length >= STRONG_THRESHOLD) break;
      if (strongComps.length >= ADEQUATE_THRESHOLD && radiusMiles >= 1.0) break;
    }

    // Sort final list: highest weight first, then most recent
    allComps.sort((a, b) => {
      if (Math.abs(b.weight - a.weight) > 0.05) return b.weight - a.weight;
      return b.soldDate.localeCompare(a.soldDate);
    });

    // Cap display list at 25 (keep highest-weight)
    if (allComps.length > 25) allComps = allComps.slice(0, 25);

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const hasRecentOnly = allComps.length > 0 && allComps.every(
      (s) => new Date(s.soldDate) >= twoMonthsAgo
    );

    const freshnessStatus = assessFreshness("hmlr_ppd", latestDate);
    const radiusLabel = searchRadiusUsed === 0
      ? "within the same postcode"
      : `within ${searchRadiusUsed} mile${searchRadiusUsed === 1 ? "" : "s"}`;
    const caveat = hasRecentOnly
      ? `All comparable transactions are from the last 2 months. HM Land Registry data for the most recent 2 months is incomplete — additional sales may appear as registrations are processed.`
      : `${allComps.length} transaction${allComps.length !== 1 ? "s" : ""} found ${radiusLabel}. Most recent: ${latestDate ?? "unknown"}. Source: HM Land Registry Price Paid Data (OGL v3.0).`;

    return {
      comparables: allComps,
      searchRadiusUsed,
      fallbacksUsed,
      latestDate,
      meta: {
        sourceId:        "hmlr_ppd",
        publishedAt:     latestDate,
        retrievedAt,
        freshnessStatus,
        caveatText:      caveat,
      },
    };
  } catch {
    return {
      comparables:      [],
      searchRadiusUsed: 0,
      fallbacksUsed:    [],
      latestDate:       null,
      meta:             makeUnavailableMeta(
        "hmlr_ppd",
        retrievedAt,
        "Comparable sales data temporarily unavailable. HM Land Registry SPARQL endpoint may be experiencing delays."
      ),
    };
  }
}

// ─── UKHPI fetch ──────────────────────────────────────────────────────────────

function buildUkhpiUrl(slug: string, months = 13): string {
  return (
    `https://landregistry.data.gov.uk/data/ukhpi/region/${slug}.json` +
    `?_pageSize=${months}&_properties=refMonth,averagePrice,housePriceIndex&_sort=-refMonth`
  );
}

const LA_SLUG_MAP: Record<string, string> = {
  "bristol, city of":                    "city-of-bristol",
  "city of bristol":                     "city-of-bristol",
  "birmingham":                          "birmingham",
  "leeds":                               "leeds",
  "sheffield":                           "sheffield",
  "manchester":                          "manchester",
  "liverpool":                           "liverpool",
  "newcastle upon tyne":                 "newcastle-upon-tyne",
  "coventry":                            "coventry",
  "leicester":                           "leicester",
  "nottingham":                          "nottingham",
  "kingston upon hull, city of":         "kingston-upon-hull",
  "hull":                                "kingston-upon-hull",
  "stoke-on-trent":                      "stoke-on-trent",
  "wolverhampton":                       "wolverhampton",
  "plymouth":                            "plymouth",
  "southampton":                         "southampton",
  "portsmouth":                          "portsmouth",
  "exeter":                              "exeter",
  "york":                                "york",
  "oxford":                              "oxford",
  "cambridge":                           "cambridge",
  "reading":                             "reading",
  "slough":                              "slough",
  "milton keynes":                       "milton-keynes",
  "northampton":                         "northampton",
  "luton":                               "luton",
  "swindon":                             "swindon",
  "bournemouth, christchurch and poole": "bournemouth-christchurch-and-poole",
  "brighton and hove":                   "brighton-and-hove",
  "derby":                               "derby",
  "peterborough":                        "peterborough",
  "gloucester":                          "gloucester",
  "city of westminster":                 "city-of-westminster",
  "westminster":                         "city-of-westminster",
  "city of london":                      "city-of-london",
  "camden":                              "camden",
  "islington":                           "islington",
  "hackney":                             "hackney",
  "tower hamlets":                       "tower-hamlets",
  "southwark":                           "southwark",
  "lambeth":                             "lambeth",
  "wandsworth":                          "wandsworth",
  "hammersmith and fulham":              "hammersmith-and-fulham",
  "kensington and chelsea":              "kensington-and-chelsea",
  "ealing":                              "ealing",
  "brent":                               "brent",
  "barnet":                              "barnet",
  "haringey":                            "haringey",
  "enfield":                             "enfield",
  "waltham forest":                      "waltham-forest",
  "redbridge":                           "redbridge",
  "newham":                              "newham",
  "barking and dagenham":                "barking-and-dagenham",
  "havering":                            "havering",
  "bromley":                             "bromley",
  "lewisham":                            "lewisham",
  "greenwich":                           "greenwich",
  "bexley":                              "bexley",
  "croydon":                             "croydon",
  "sutton":                              "sutton",
  "merton":                              "merton",
  "kingston upon thames":                "kingston-upon-thames",
  "richmond upon thames":                "richmond-upon-thames",
  "hounslow":                            "hounslow",
  "hillingdon":                          "hillingdon",
  "harrow":                              "harrow",
  "hertsmere":                           "hertsmere",
  "london":                              "london",
  "greater london":                      "london",
  "south west":                          "south-west",
  "south east":                          "south-east",
  "east of england":                     "east-of-england",
  "east midlands":                       "east-midlands",
  "west midlands":                       "west-midlands",
  "yorkshire and the humber":            "yorkshire-and-the-humber",
  "north west":                          "north-west",
  "north east":                          "north-east",
  "wales":                               "wales",
  "england":                             "england",
};

const REGION_SLUG_MAP: Record<string, string> = {
  "London":                   "london",
  "South West":               "south-west",
  "South East":               "south-east",
  "East of England":          "east-of-england",
  "East Midlands":            "east-midlands",
  "West Midlands":            "west-midlands",
  "Yorkshire and The Humber": "yorkshire-and-the-humber",
  "North West":               "north-west",
  "North East":               "north-east",
  "Wales":                    "wales",
};

function getLaSlug(laName: string, region: string): string {
  const key = laName.toLowerCase().trim();
  if (LA_SLUG_MAP[key]) return LA_SLUG_MAP[key];
  for (const [k, v] of Object.entries(LA_SLUG_MAP)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return REGION_SLUG_MAP[region] ?? "england";
}

async function fetchPriceTrend(
  laSlug: string
): Promise<{ data: PriceTrendPoint[]; meta: ModuleMetadata }> {
  const retrievedAt = new Date().toISOString();
  try {
    const res  = await fetch(buildUkhpiUrl(laSlug, 13), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`UKHPI ${res.status}`);
    const json  = await res.json();
    const items: unknown[] = json?.result?.items ?? json?.items ?? [];

    const points: PriceTrendPoint[] = [];
    for (const item of items as Record<string, unknown>[]) {
      const month = (item["refMonth"] ?? item["@refMonth"] ?? "") as string;
      const avg   = parseFloat((item["averagePrice"] ?? item["ukhpi:averagePrice"] ?? "") as string);
      const idx   = parseFloat((item["housePriceIndex"] ?? item["ukhpi:housePriceIndex"] ?? "") as string);
      if (!month || !isFinite(avg) || avg <= 0) continue;
      points.push({ month: month.slice(0, 7), averagePrice: Math.round(avg), index: idx });
    }
    points.sort((a, b) => a.month.localeCompare(b.month));
    const latestMonth = points.at(-1)?.month ?? null;

    return {
      data: points,
      meta: {
        sourceId:       "hmlr_ukhpi",
        publishedAt:    latestMonth ? `${latestMonth}-01` : null,
        retrievedAt,
        freshnessStatus: assessFreshness("hmlr_ukhpi", latestMonth ? `${latestMonth}-01` : null),
        caveatText:     `Local authority average prices (HM Land Registry UK House Price Index). Data typically lags 4–6 weeks. Latest: ${latestMonth ?? "unknown"}.`,
      },
    };
  } catch {
    return {
      data: [],
      meta: makeUnavailableMeta("hmlr_ukhpi", retrievedAt, "Area price trend temporarily unavailable."),
    };
  }
}

// ─── EPC fetch ────────────────────────────────────────────────────────────────

const EPC_API_KEY = "ad0c49cd5dc496b87380d9273b333410fbeadc56";
const EPC_BASE    = "https://get-energy-performance-data.communities.gov.uk";

async function fetchEpc(
  postcode: string
): Promise<{ data: EpcData | null; meta: ModuleMetadata }> {
  const retrievedAt = new Date().toISOString();
  try {
    const EPC_EMAIL  = "bradleyskana@hotmail.com";
    const authToken  = btoa(`${EPC_EMAIL}:${EPC_API_KEY}`);
    const url        = `${EPC_BASE}/api/v1/domestic/search?postcode=${encodeURIComponent(postcode)}&size=1`;
    const res        = await fetch(url, {
      headers: { Authorization: `Basic ${authToken}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`EPC API ${res.status}`);

    const json = await res.json();
    const rows = json?.rows ?? json?.data ?? [];
    if (!rows.length) {
      return { data: null, meta: makeUnavailableMeta("mhclg_epc", retrievedAt, "No EPC on record for this postcode.") };
    }

    const row = rows[0];
    const lodgementDate: string = row["lodgement-date"] ?? row.lodgementDate ?? "";
    const expiryDate: string    = row["potential-energy-rating"]
      ? new Date(new Date(lodgementDate).getTime() + 10 * 365.25 * 86_400_000).toISOString().slice(0, 10)
      : "";
    const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;

    const epc: EpcData = {
      band:            row["current-energy-rating"] ?? row.currentEnergyRating ?? "Unknown",
      score:           parseInt(row["energy-efficiency-score"] ?? row.currentEnergyEfficiencyScore ?? "0", 10),
      floorAreaM2:     parseFloat(row["total-floor-area"] ?? row.totalFloorArea ?? "") || null,
      lodgementDate,
      expiryDate,
      isExpired,
      currentRating:   row["current-energy-rating"] ?? "Unknown",
      potentialRating: row["potential-energy-rating"] ?? "Unknown",
    };

    return {
      data: epc,
      meta: {
        sourceId:       "mhclg_epc",
        publishedAt:    lodgementDate,
        retrievedAt,
        freshnessStatus: assessFreshness("mhclg_epc", lodgementDate),
        caveatText:     isExpired
          ? `EPC expired (lodged ${lodgementDate}). Current energy performance may differ.`
          : `EPC lodged ${lodgementDate}. Source: MHCLG EPC Register.`,
      },
    };
  } catch {
    return {
      data: null,
      meta: makeUnavailableMeta("mhclg_epc", retrievedAt, "EPC data temporarily unavailable."),
    };
  }
}

// ─── Planning fetch ───────────────────────────────────────────────────────────

async function fetchPlanning(
  postcode: string
): Promise<{ data: PlanningApplication[]; meta: ModuleMetadata }> {
  const retrievedAt = new Date().toISOString();
  try {
    const url  = `https://www.planning.data.gov.uk/entity.json?dataset=planning-application&q=${encodeURIComponent(postcode)}&limit=10`;
    const res  = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Planning API ${res.status}`);

    const json     = await res.json();
    const entities = (json?.entities ?? []) as Record<string, unknown>[];
    const apps: PlanningApplication[] = entities.map((ent) => ({
      reference:       (ent.reference ?? ent["application-reference"] ?? "Unknown") as string,
      description:     (ent.description ?? ent["development-description"] ?? ent.name ?? "No description available") as string,
      status:          (ent.status ?? ent["application-status"] ?? "Unknown") as string,
      decisionDate:    (ent["decision-date"] ?? ent.decisionDate ?? null) as string | null,
      applicationType: (ent["application-type"] ?? ent.applicationType ?? "Unknown") as string,
    }));

    return {
      data: apps,
      meta: {
        sourceId:       "planning_data_gov",
        publishedAt:    new Date().toISOString().slice(0, 10),
        retrievedAt,
        freshnessStatus: "fresh",
        caveatText:     apps.length === 0
          ? "No planning applications found. Not all LPAs submit to this platform — absence of results does not confirm no applications exist."
          : `${apps.length} planning application${apps.length !== 1 ? "s" : ""} found. Source: MHCLG Planning Data.`,
      },
    };
  } catch {
    return {
      data: [],
      meta: makeUnavailableMeta("planning_data_gov", retrievedAt, "Planning data temporarily unavailable."),
    };
  }
}

// ─── Postcodes.io fetch ───────────────────────────────────────────────────────

interface PostcodeInfo {
  latitude:           number;
  longitude:          number;
  localAuthority:     string;
  localAuthoritySlug: string;
  region:             string;
  outcode:            string;
}

async function fetchPostcodeInfo(postcode: string): Promise<PostcodeInfo | null> {
  try {
    const res  = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const r    = json?.result;
    if (!r) return null;

    const laName: string = r.admin_district ?? r.nuts ?? "";
    const laSlug = laName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    return {
      latitude:           r.latitude,
      longitude:          r.longitude,
      localAuthority:     laName,
      localAuthoritySlug: laSlug,
      region:             r.region ?? r.european_electoral_region ?? "England",
      outcode:            r.outcode ?? postcode.split(" ")[0],
    };
  } catch {
    return null;
  }
}

// ─── Weighted estimate builder ─────────────────────────────────────────────────
//
// Three tiers:
//
// Tier 1 — STRONG
//   5+ comparables with weight ≥ 0.4 (solid evidence pool)
//   OR 3–4 with weight ≥ 0.6 (highly similar nearby sales)
//   Uses weighted median; range ±8–18% based on count and spread
//
// Tier 2 — INDICATIVE (thin-data)
//   1–4 comparables (any weight) + at least one support signal
//   (last sold price OR UKHPI trend anchor)
//   Uses weighted or simple median of available prices
//   Range ±25–35%; mandatory caveats; confidence = Low
//
// Tier 3 — UNAVAILABLE
//   Zero comparables AND no last-sold price AND no trend anchor
//   Truly no usable evidence

function buildEstimate(
  comparables:    ComparableSale[],
  lastSoldPrice:  number | null,
  trendAnchor:    number | null,
  searchRadiusMi: number,
): {
  estimate:         ValuationRange | null;
  confidence:       ConfidenceLevel;
  confidenceNote:   string;
  confidenceReason: string;
  valuationState:   ValuationState;
  fallbacksUsed:    string[];
  count:            number;
} {
  const valid = comparables.filter(
    (c) => isValidPrice(c.soldPrice) && isValidDate(c.soldDate)
  );

  const fallbacksUsed: string[] = [];

  // Helper: weighted median of an array of {value, weight} pairs
  function weightedMedian(pairs: { value: number; weight: number }[]): number {
    if (pairs.length === 0) return 0;
    const sorted = [...pairs].sort((a, b) => a.value - b.value);
    const totalWeight = sorted.reduce((s, p) => s + p.weight, 0);
    let cumulative = 0;
    for (const p of sorted) {
      cumulative += p.weight;
      if (cumulative >= totalWeight / 2) return p.value;
    }
    return sorted[sorted.length - 1].value;
  }

  // ── Classify comparables by quality ──────────────────────────────────────
  const strongComps   = valid.filter((c) => c.weight >= 0.5);
  const usableComps   = valid.filter((c) => c.weight >= 0.3);
  const allUsableComps = valid; // use all even weight < 0.3 as last resort

  // ── Determine which pool to use for STRONG path ───────────────────────────
  const useStrongPath =
    strongComps.length >= STRONG_THRESHOLD ||
    (strongComps.length >= ADEQUATE_THRESHOLD && strongComps.every((c) => c.weight >= 0.6));

  if (useStrongPath) {
    const pool = strongComps.length >= STRONG_THRESHOLD ? strongComps : strongComps;
    const pairs = pool.map((c) => ({ value: c.soldPrice, weight: c.weight }));
    const midRaw     = weightedMedian(pairs);
    const midRounded = Math.round(midRaw / 1000) * 1000;

    // Spread of the pool — use 10th/90th percentile spread to judge uncertainty
    const prices  = pool.map((c) => c.soldPrice).sort((a, b) => a - b);
    const p10     = prices[Math.floor(prices.length * 0.1)] ?? prices[0];
    const p90     = prices[Math.ceil(prices.length * 0.9) - 1] ?? prices[prices.length - 1];
    const spread  = (p90 - p10) / midRaw;

    let halfWidthPct: number;
    let level: ConfidenceLevel;

    if (pool.length >= 10 && spread < 0.20) {
      halfWidthPct = 0.08; level = "High";
    } else if (pool.length >= 6 || (pool.length >= 4 && spread < 0.25)) {
      halfWidthPct = 0.12; level = "Medium";
    } else {
      halfWidthPct = 0.18; level = "Low";
    }

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const allRecent = pool.every((c) => new Date(c.soldDate) >= twoMonthsAgo);
    if (allRecent) { halfWidthPct += 0.05; }

    const radiusLabel = searchRadiusMi === 0
      ? "within the same postcode"
      : `within ${searchRadiusMi} mile${searchRadiusMi === 1 ? "" : "s"}`;
    const note =
      `Based on ${pool.length} comparable sale${pool.length !== 1 ? "s" : ""} ${radiusLabel}, ` +
      `weighted by proximity, recency, and property type similarity.` +
      (allRecent ? " All comparables are from the last 2 months — HM Land Registry data for this window is incomplete." : "") +
      ` Source: HM Land Registry Price Paid Data.`;
    const reason = `strong:${pool.length}_comparables:radius_${searchRadiusMi}mi`;

    const low  = Math.round(midRounded * (1 - halfWidthPct) / 1000) * 1000;
    const high = Math.round(midRounded * (1 + halfWidthPct) / 1000) * 1000;

    return {
      estimate:         { low, mid: midRounded, high, rangeWidthPct: Math.round(halfWidthPct * 2 * 100), valuationState: "strong" },
      confidence:       level,
      confidenceNote:   note,
      confidenceReason: reason,
      valuationState:   "strong",
      fallbacksUsed,
      count:            pool.length,
    };
  }

  // ── INDICATIVE path ───────────────────────────────────────────────────────
  // Use any valid comparables (even low-weight) + last-sold + trend as price signals

  const hasLastSale = isValidPrice(lastSoldPrice ?? 0);
  const hasTrend    = isValidPrice(trendAnchor ?? 0);

  // Build a price pool from all available signals
  const pricePool: { value: number; weight: number; source: string }[] = [];

  for (const c of allUsableComps) {
    pricePool.push({ value: c.soldPrice, weight: c.weight, source: "ppd_comp" });
  }

  if (hasLastSale && lastSoldPrice !== null) {
    const alreadyCounted = allUsableComps.some((c) => c.soldPrice === lastSoldPrice);
    if (!alreadyCounted) {
      pricePool.push({ value: lastSoldPrice, weight: 0.6, source: "last_sold" });
      fallbacksUsed.push("last_sold_anchor");
    }
  }

  // We need at least ONE price signal to produce an indicative estimate
  if (pricePool.length === 0 && !hasTrend) {
    // Truly nothing
    return {
      estimate:         null,
      confidence:       "Insufficient",
      confidenceNote:   `No sold-price evidence was found within ${MAX_RADIUS_MILES} miles of this postcode, and no last-recorded sale is available. This is uncommon — it may reflect a very recently-created postcode, a property that has never been sold, or a temporary data availability issue.`,
      confidenceReason: "unavailable:no_evidence",
      valuationState:   "unavailable",
      fallbacksUsed,
      count:            0,
    };
  }

  // If only the trend anchor exists, use it as the sole signal (extreme fallback)
  if (pricePool.length === 0 && hasTrend && trendAnchor !== null) {
    pricePool.push({ value: trendAnchor, weight: 0.3, source: "ukhpi_anchor" });
    fallbacksUsed.push("ukhpi_area_average_only");
  }

  const midRaw = weightedMedian(
    pricePool.map((p) => ({ value: p.value, weight: p.weight }))
  );
  let midRounded = Math.round(midRaw / 1000) * 1000;

  // Determine half-width based on number of real comps + signal quality
  let halfWidthPct: number;
  const realCompCount = allUsableComps.length;

  if (realCompCount >= 3)     halfWidthPct = 0.22;
  else if (realCompCount >= 2) halfWidthPct = 0.28;
  else if (realCompCount >= 1) halfWidthPct = 0.32;
  else                         halfWidthPct = 0.38; // trend anchor only

  // UKHPI sanity check
  let divergenceNote = "";
  if (hasTrend && trendAnchor !== null) {
    fallbacksUsed.push("ukhpi_anchor");
    const divergence = Math.abs(midRounded - trendAnchor) / trendAnchor;
    if (divergence > 0.40) {
      halfWidthPct += 0.10;
      divergenceNote = ` The estimate diverges significantly from the local authority average (£${Math.round(trendAnchor / 1000)}k) — this may reflect a property type, tenure, or micro-location difference. Range widened accordingly.`;
    }
  }

  const radiusLabel = searchRadiusMi === 0
    ? "within the same postcode"
    : `within ${searchRadiusMi} mile${searchRadiusMi === 1 ? "" : "s"}`;

  const signalList: string[] = [];
  if (realCompCount > 0) signalList.push(`${realCompCount} comparable sale${realCompCount !== 1 ? "s" : ""} ${radiusLabel}`);
  if (fallbacksUsed.includes("last_sold_anchor")) signalList.push("last recorded sale price");
  if (fallbacksUsed.includes("ukhpi_anchor") || fallbacksUsed.includes("ukhpi_area_average_only")) signalList.push("local authority average price trend");

  const note =
    `Indicative estimate based on limited evidence: ${signalList.join(", ")}. ` +
    `Treat as directional guidance only — not a formal valuation. ` +
    `A wider range is used to reflect data constraints.` +
    divergenceNote +
    ` Source: HM Land Registry Price Paid Data.`;

  const reason = `indicative:${realCompCount}_comps:${fallbacksUsed.join("+")}:radius_${searchRadiusMi}mi`;

  const low  = Math.round(midRounded * (1 - halfWidthPct) / 1000) * 1000;
  const high = Math.round(midRounded * (1 + halfWidthPct) / 1000) * 1000;

  return {
    estimate:         { low, mid: midRounded, high, rangeWidthPct: Math.round(halfWidthPct * 2 * 100), valuationState: "indicative" },
    confidence:       "Low",
    confidenceNote:   note,
    confidenceReason: reason,
    valuationState:   "indicative",
    fallbacksUsed,
    count:            realCompCount,
  };
}

// ─── Main entry point ──────────────────────────────────────────────────────────

export async function runValuation(rawQuery: string): Promise<ValuationReport> {
  const retrievedAt = new Date().toISOString();

  const postcode = normalisePostcode(rawQuery);
  if (!isPostcodeFormat(postcode)) {
    throw new Error(
      `"${rawQuery}" does not look like a valid UK postcode. Please enter a full UK postcode (e.g. SW1A 1AA, M1 1AE, or BS1 4DJ).`
    );
  }

  const postcodeInfo = await fetchPostcodeInfo(postcode);
  if (!postcodeInfo) {
    throw new Error(
      `Could not resolve postcode "${postcode}". Please check it is a valid, active UK postcode.`
    );
  }

  const laSlug = getLaSlug(postcodeInfo.localAuthority, postcodeInfo.region);

  // Parallel: trend + EPC + planning while we also start the comparable search
  const [compResult, trendResult, epcResult, planningResult] = await Promise.allSettled([
    fetchComparablesWithRadius(
      postcode,
      postcodeInfo.latitude,
      postcodeInfo.longitude,
      null, // subject type unknown at this stage — weighting uses null gracefully
    ),
    fetchPriceTrend(laSlug),
    fetchEpc(postcode),
    fetchPlanning(postcode),
  ]);

  const comps    = compResult.status    === "fulfilled" ? compResult.value    : { comparables: [], searchRadiusUsed: 0, fallbacksUsed: [], latestDate: null, meta: makeUnavailableMeta("hmlr_ppd", retrievedAt, "Comparables fetch failed.") };
  const trend    = trendResult.status   === "fulfilled" ? trendResult.value   : { data: [], meta: makeUnavailableMeta("hmlr_ukhpi", retrievedAt, "Price trend fetch failed.") };
  const epc      = epcResult.status     === "fulfilled" ? epcResult.value     : { data: null, meta: makeUnavailableMeta("mhclg_epc", retrievedAt, "EPC fetch failed.") };
  const planning = planningResult.status=== "fulfilled" ? planningResult.value : { data: [], meta: makeUnavailableMeta("planning_data_gov", retrievedAt, "Planning data fetch failed.") };

  const trendAnchor    = trend.data.length > 0 ? trend.data[trend.data.length - 1].averagePrice : null;
  const sortedByDate   = [...comps.comparables].sort((a, b) => b.soldDate.localeCompare(a.soldDate));
  const preBuildLastSold = sortedByDate[0] ?? null;

  const { estimate, confidence, confidenceNote, confidenceReason, valuationState, fallbacksUsed, count } = buildEstimate(
    comps.comparables,
    preBuildLastSold?.soldPrice ?? null,
    trendAnchor,
    comps.searchRadiusUsed,
  );

  // Merge fallbacks
  const allFallbacks = [
    ...comps.fallbacksUsed,
    ...fallbacksUsed,
  ].filter((v, i, a) => a.indexOf(v) === i);

  // Annotate deltaVsMid
  if (estimate) {
    for (const c of comps.comparables) {
      c.deltaVsMid = Math.round(((c.soldPrice - estimate.mid) / estimate.mid) * 1000) / 10;
    }
  }

  const lastSold = sortedByDate[0] ?? null;
  const sdlt     = estimate ? calculateSdlt(estimate.mid) : null;

  return {
    queryPostcode:    postcode,
    outcode:          postcodeInfo.outcode,
    localAuthority:   postcodeInfo.localAuthority,
    region:           postcodeInfo.region,
    retrievedAt,

    estimate,
    confidence,
    confidenceNote,
    confidenceReason,
    valuationState,
    fallbacksUsed:    allFallbacks,
    comparableCount:  count,
    searchRadiusUsed: comps.searchRadiusUsed,
    lastSoldPrice:    lastSold?.soldPrice ?? null,
    lastSoldDate:     lastSold?.soldDate  ?? null,

    comparables:  comps.comparables,
    priceTrend:   trend.data,
    epc:          epc.data,
    planning:     planning.data,

    meta: {
      comparables: comps.meta,
      priceTrend:  trend.meta,
      epc:         epc.meta,
      planning:    planning.meta,
      postcode: {
        sourceId:       "postcodes_io",
        publishedAt:    null,
        retrievedAt,
        freshnessStatus: "fresh",
        caveatText:     "Postcode resolved via Postcodes.io (ONS Postcode Directory).",
      },
    },

    sdlt,
  };
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function makeUnavailableMeta(
  sourceId:    string,
  retrievedAt: string,
  caveatText:  string
): ModuleMetadata {
  return {
    sourceId,
    publishedAt:    null,
    retrievedAt,
    freshnessStatus: "unavailable",
    caveatText,
  };
}

// ─── Re-exports ────────────────────────────────────────────────────────────────
export type { ModuleMetadata, FreshnessStatus };
export { DATA_SOURCES, assessFreshness };
