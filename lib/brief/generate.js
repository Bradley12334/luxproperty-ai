/**
 * lib/brief/generate.js
 * ─────────────────────────────────────────────────────────────────────────────
 * BRIEF GENERATION ORCHESTRATOR — the server-side flow that turns a postcode into
 * a typed brief payload of SECTIONS, each carrying an explicit render state.
 *
 *   generate("E8 1NG") → { meta, sections[] }
 *
 * Flow (BRIEF_SPEC → Data spine):
 *   postcode → resolve (validation guard) → transactions (cached) → stats →
 *   section builders → tier-filtered payload.
 *
 * Two failure altitudes, deliberately different:
 *   - RESOLVE failure (invalid postcode / Scotland-NI / guard mismatch): there is
 *     no verified location, so NO brief can be built. generate() re-throws the
 *     typed BriefError; the API turns it into an honest error response and the
 *     client shows an error state — never a brief built on an unverified location.
 *   - DATA failure (Land Registry upstream/abort) AFTER a good resolve: the
 *     location is valid, so a payload IS returned — but the price section renders
 *     UNAVAILABLE with the real reason. Sections never silently disappear.
 *
 * LATENCY MITIGATION: the transaction set is fetched under a time budget
 * (`budgetMs`, default below the Vercel function ceiling) via an AbortSignal, and
 * cached per district so warm-instance repeats are instant. On budget overrun the
 * price section is UNAVAILABLE, not a 504.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { resolve } from "./resolve.js";
import { getTransactions } from "./transactions.js";
import { computeStats } from "./stats.js";
import { withCachedTransactions } from "./cache.js";
import { accountTier, trendDepthYears } from "./entitlements.js";
import { buildExecutiveSummarySection } from "./sections/executive-summary.js";
import { buildPricesSection } from "./sections/prices.js";
import { buildNearbySoldPricesSection, selectRecent } from "./sections/nearby-sold-prices.js";
import { buildStreetRankingSection } from "./sections/street-ranking.js";
import { buildSoldPricesMapSection } from "./sections/sold-prices-map.js";
import { buildFloodClimateSection } from "./sections/flood-climate.js";
import { buildStationsCommuteSection } from "./sections/stations-commute.js";
import { buildCommuteCalculatorSection } from "./sections/commute-calculator.js";
import { buildSchoolsSection } from "./sections/schools.js";
import { buildAmenitiesSection } from "./sections/amenities.js";
import { buildBroadbandSection } from "./sections/broadband.js";
import { buildAirQualitySection } from "./sections/air-quality.js";
import { buildBuyingCostsSection } from "./sections/buying-costs.js";
import { buildRentalSnapshotSection } from "./sections/rental-snapshot.js";
import { buildCrimeBreakdownSection } from "./sections/crime-breakdown.js";
import { buildNeighbourhoodSection } from "./sections/neighbourhood.js";
import { buildPreOfferQuestionsSection } from "./sections/pre-offer-questions.js";
import { geocodePostcodes } from "./geocode.js";
import { fetchFloodClimate } from "./flood.js";
import { fetchStations, fetchSchools, fetchAmenities } from "./overpass.js";
import { selectCommuteTargets } from "./commute.js";
import { fetchTflJourneys } from "./tfl.js";
import { fetchBroadband } from "./broadband.js";
import { fetchAirQuality } from "./air-quality.js";
import { fetchCouncilTax } from "./council-tax.js";
import { buildStampDuty } from "./stamp-duty.js";
import { fetchRental } from "./rental.js";
import { fetchCrime } from "./crime.js";
import { fetchPlanning } from "./planning.js";
import { buildPlanningActivitySection } from "./sections/planning-activity.js";
import { isBriefError } from "./errors.js";

// Full 10yr window is always fetched (depth-trimming is a later phase); the tier's
// entitled depth is recorded in meta so the trim step isn't bolted on later.
const FETCH_YEARS = 10;

// Time budget for the whole transaction fetch. Set just under the Vercel Hobby 60s
// function ceiling (config.maxDuration below) so an overrun yields a graceful,
// RETRYABLE UNAVAILABLE section rather than a hard 504 — leaving a few seconds of
// headroom for the durable-cache write + response serialisation. The measured cold
// SPARQL scan is ~16–49s (median ~22s), so a single attempt clears this budget for
// effectively every district; the tail is covered by the client's retry-on-warm.
const DEFAULT_BUDGET_MS = 56_000;

/**
 * Placeholder sections — every brief section not yet rebuilt in Phase 2a. They
 * ship IN the payload (never silently absent) marked `comingSoon`, so the client
 * can list what's still to come. Titles/tiers mirror BRIEF_SPEC's section table.
 */
const COMING_SOON_SECTIONS = [
  { key: "areaVerdict",        title: "Area screening verdict",        minTier: "EXP" },
  { key: "developmentTracker", title: "Development tracker",           minTier: "INV" },
  { key: "rentalDemandScore",  title: "Rental demand score",           minTier: "INV" },
].map((s) => ({ ...s, state: "COMING_SOON", comingSoon: true, data: null }));

/**
 * @param {string} rawPostcode
 * @param {{ account?: unknown, now?: Date, budgetMs?: number }} [opts]
 * @returns {Promise<{ meta: Object, sections: Object[] }>}
 * @throws {import("./errors.js").BriefError} only on RESOLVE-altitude failure
 */
export async function generate(rawPostcode, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : DEFAULT_BUDGET_MS;
  const tier = accountTier(opts.account); // stubbed INV (unlock-all) in Phase 2a

  // ── Resolve (validation guard). Failure here aborts the whole brief. ────────
  const location = await resolve(rawPostcode);

  // ── Flood/climate (EA, point-wise at the validated coordinates) ─────────────
  // Independent of Land Registry, so it is kicked off HERE — concurrently with the
  // long transaction scan below — and adds effectively no wall-clock. Best-effort
  // with its own short timeout; never throws, so it can't abort the brief.
  const floodPromise = fetchFloodClimate(location);

  // ── Neighbourhood (OSM/Overpass) — stations, kicked off concurrently too ────
  // Independent of Land Registry and of flood; its own mirror-rotation + timeout
  // guards (lib/brief/overpass.js). Best-effort, never throws.
  const stationsPromise = fetchStations(location);
  const schoolsPromise = fetchSchools(location);
  const amenitiesPromise = fetchAmenities(location);

  // ── Broadband (PRO) + Air quality (PRO) — independent, kicked off concurrently.
  // Broadband reuses the shared Ofcom source (static LA-level table + postcodes.io);
  // air quality hits the DEFRA/ERG index. Both best-effort, never throw.
  const broadbandPromise = fetchBroadband(location);
  const airQualityPromise = fetchAirQuality(location);

  // ── Council tax (EXP, Buying Costs section) — independent, kicked off concurrently.
  // Reuses the shared VOA/DLUHC source (billing-authority Band D + statutory band
  // multipliers) via a response-capture shim. Best-effort, never throws.
  const councilTaxPromise = fetchCouncilTax(location);

  // ── Rental (PRO) — independent, kicked off concurrently. Reuses the shared source
  // for REGIONAL VOA-2024 rent benchmarks (its dead live-YoY feed is dropped); gross
  // yield is computed against the live local median downstream. Best-effort, never throws.
  const rentalPromise = fetchRental(location);

  // ── Crime (PRO) — data.police.uk street-level, at the validated coordinates,
  // kicked off concurrently. Independent of Land Registry. Best-effort, never throws.
  const crimePromise = fetchCrime(location, { now });

  // ── Planning designations (PRO) — MHCLG planning.data.gov.uk, point-in-polygon at
  // the validated coordinates, kicked off concurrently. Independent of Land Registry;
  // one ~1s HTTP call, best-effort, never throws.
  const planningPromise = fetchPlanning(location);

  // ── Full commute calculator (PRO) — LIVE TfL only for London, concurrently ──
  // Non-London targets are pure straight-line estimates (no network), so TfL is
  // only queried when the location is in London. Best-effort; never throws.
  const commuteTargets = selectCommuteTargets(location);
  const tflPromise =
    commuteTargets.method === "tfl"
      ? fetchTflJourneys(location.lat, location.lng, commuteTargets.destinations)
      : Promise.resolve(null);

  // ── Transactions under a time budget, cached per district. ──────────────────
  let stats = null;
  let txSet = null; // the shared, cached transaction set every price-derived section reads
  let dataError = null;
  let cached = false;
  let cacheLayer = "live";
  let txMeta = null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    const result = await withCachedTransactions(location.outcode, FETCH_YEARS, () =>
      getTransactions(location.outcode, FETCH_YEARS, { now, signal: controller.signal }),
    );
    cached = result.cached;
    cacheLayer = result.layer;
    txSet = result.value;
    txMeta = txSet.meta;
    stats = computeStats(txSet);
  } catch (err) {
    // A good resolve already happened, so we still return a payload — the price
    // section will render UNAVAILABLE carrying this reason.
    dataError = isBriefError(err)
      ? err
      : Object.assign(new Error(String(err?.message || err)), { code: "UPSTREAM_ERROR" });
    console.warn(`[brief] generate(${location.outcode}): transaction/stats failed — ${dataError.code}: ${dataError.message}`);
  } finally {
    clearTimeout(timer);
  }

  // ── Sections ────────────────────────────────────────────────────────────────
  // Executive summary (EXP) — a pure function of the spine stats + location; renders
  // location-specific even when stats is null (price scan failed → UNAVAILABLE read).
  const executiveSummary = buildExecutiveSummarySection(stats, location, tier);

  const pricesSection = stats
    ? buildPricesSection(stats, location, tier)
    : {
        key: "pricesTrendNegotiation",
        title: "Prices, Trend & Negotiation",
        minTier: "EXP",
        state: "UNAVAILABLE",
        note:
          dataError?.code === "UPSTREAM_ERROR"
            ? "Sold-price data could not be retrieved for this postcode right now (Land Registry did not respond within the time budget). Price, trend and negotiation figures are temporarily unavailable — try again shortly."
            : "Price, trend and negotiation figures are unavailable for this postcode.",
        data: null,
      };

  // ── INV/PRO sections that read the SAME cached transaction set ──────────────
  // Built only when the shared set is present (a good resolve + successful fetch);
  // on a data-altitude failure txSet is null and they degrade to UNAVAILABLE like
  // the price section, never a silent gap.
  const nearbySoldPrices = txSet
    ? buildNearbySoldPricesSection(txSet, location, tier, stats?.medianPrice ?? null)
    : {
        key: "nearbySoldPrices",
        title: "Nearby Sold Prices",
        minTier: "PRO",
        state: "UNAVAILABLE",
        note:
          dataError?.code === "UPSTREAM_ERROR"
            ? "Sold-price data could not be retrieved for this postcode right now (Land Registry did not respond within the time budget). Recent nearby sales are temporarily unavailable — try again shortly."
            : "Recent nearby sold prices are unavailable for this postcode.",
        data: null,
      };

  const streetPriceRanking = txSet
    ? buildStreetRankingSection(txSet, location, tier, stats?.medianPrice ?? null)
    : {
        key: "streetPriceRanking",
        title: "Street Price Ranking",
        minTier: "INV",
        state: "UNAVAILABLE",
        note:
          dataError?.code === "UPSTREAM_ERROR"
            ? "Sold-price data could not be retrieved for this postcode right now (Land Registry did not respond within the time budget). The street ranking is temporarily unavailable — try again shortly."
            : "The street price ranking is unavailable for this postcode.",
        data: null,
      };

  // Sold-prices map: geocode the recent set's distinct postcodes to centroids
  // (one best-effort bulk lookup, its own short timeout; never throws), then build
  // the section. On a data-altitude failure txSet is null → UNAVAILABLE.
  let soldPricesMap;
  if (txSet) {
    const recentPostcodes = [...new Set(selectRecent(txSet).map((t) => t.postcode))];
    const centroids = await geocodePostcodes(recentPostcodes);
    soldPricesMap = buildSoldPricesMapSection(txSet, location, tier, centroids);
  } else {
    soldPricesMap = {
      key: "soldPricesMap",
      title: "Sold Prices Map",
      minTier: "INV",
      state: "UNAVAILABLE",
      note:
        dataError?.code === "UPSTREAM_ERROR"
          ? "Sold-price data could not be retrieved for this postcode right now (Land Registry did not respond within the time budget). The sold-prices map is temporarily unavailable — try again shortly."
          : "The sold-prices map is unavailable for this postcode.",
      data: null,
    };
  }

  // ── Flood, Climate & Resilience (EXP/free) — awaits the concurrent EA fetch ─
  // Runs regardless of the transaction outcome: flood risk does not depend on Land
  // Registry, so a data-altitude price failure never suppresses it.
  const flood = await floodPromise;
  const floodClimate = buildFloodClimateSection(flood, location, tier);

  // ── Stations & Commute (EXP) — awaits the concurrent Overpass fetch ─────────
  const stationsResult = await stationsPromise;
  const stationsCommute = buildStationsCommuteSection(stationsResult, location, tier);

  // ── Full commute calculator (PRO) — awaits the concurrent TfL fetch (or null) ─
  const tflResult = await tflPromise;
  const commuteCalculator = buildCommuteCalculatorSection(location, tier, tflResult);

  // ── Schools (EXP) — awaits the concurrent Overpass fetch ────────────────────
  const schoolsResult = await schoolsPromise;
  const schools = buildSchoolsSection(schoolsResult, location, tier);

  // ── Local amenities (EXP) — awaits the concurrent Overpass fetch ────────────
  const amenitiesResult = await amenitiesPromise;
  const amenities = buildAmenitiesSection(amenitiesResult, location, tier);

  // ── Broadband (PRO) + Air quality (PRO) — await their concurrent fetches ────
  const broadbandResult = await broadbandPromise;
  const broadband = buildBroadbandSection(broadbandResult, location, tier);
  const airQualityResult = await airQualityPromise;
  const airQuality = buildAirQualitySection(airQualityResult, location, tier);

  // ── Buying Costs (EXP council tax + PRO stamp duty) — awaits the concurrent
  // council-tax fetch. Stamp duty is a pure computation from the spine window median
  // at current SDLT (England/NI) or LTT (Wales) rates; null if the price scan failed.
  const councilTaxResult = await councilTaxPromise;
  const stampDuty = buildStampDuty(stats?.medianPrice ?? null, location);
  const buyingCosts = buildBuyingCostsSection(councilTaxResult, stampDuty, location, tier);

  // ── Rental Snapshot (PRO) — awaits the concurrent regional-benchmark fetch; gross
  // yield crosses those regional rents with the live local median (null-safe).
  const rentalResult = await rentalPromise;
  const rentalSnapshot = buildRentalSnapshotSection(rentalResult, location, tier, stats?.medianPrice ?? null);

  // ── Crime Breakdown (PRO) — awaits the concurrent police.uk fetch. ──────────
  const crimeResult = await crimePromise;
  const crimeBreakdown = buildCrimeBreakdownSection(crimeResult, location, tier);

  // ── Neighbourhood Profile / Lifestyle Fit (EXP) — a pure function of signals ALREADY
  // fetched above (stations, schools, amenities+parks, crime, flood, price trajectory).
  // No new fetch. Curated resident sentiment is folded in only where curation exists.
  const neighbourhood = buildNeighbourhoodSection(
    {
      stationsData: stationsCommute.data,
      amenitiesResult,
      schoolsData: schools.data,
      crimeData: crimeBreakdown.data,
      floodData: floodClimate.data,
      stats,
    },
    location,
    tier,
  );

  // ── Pre-offer Questions (PRO) — trigger-gated from this brief's own findings
  // (flood, price trajectory, tenure/new-build mix, crime composition) + a labelled
  // universal due-diligence set. Pure function of already-fetched signals.
  const preOfferQuestions = buildPreOfferQuestionsSection(
    { stats, txSet, floodData: floodClimate.data, crimeData: crimeBreakdown.data },
    location,
    tier,
  );

  // ── Planning Activity & Risk Flags (PRO) — awaits the concurrent planning.data.gov.uk
  // fetch; risk flags are pure functions of already-built signals (flood, price
  // trajectory, confidence, crime) plus the designations themselves.
  const planningResult = await planningPromise;
  const planning = buildPlanningActivitySection(
    planningResult,
    { stats, floodData: floodClimate.data, crimeData: crimeBreakdown.data },
    location,
    tier,
  );

  const sections = [executiveSummary, pricesSection, nearbySoldPrices, streetPriceRanking, soldPricesMap, floodClimate, stationsCommute, commuteCalculator, schools, amenities, broadband, airQuality, buyingCosts, rentalSnapshot, crimeBreakdown, neighbourhood, preOfferQuestions, planning, ...COMING_SOON_SECTIONS];

  return {
    meta: {
      postcode: location.postcode,
      outcode: location.outcode,
      outcodeOnly: location.outcodeOnly ?? false,
      ward: location.ward,
      localAuthority: location.localAuthority,
      region: location.region,
      country: location.country,
      lat: location.lat,
      lng: location.lng,
      tier,
      entitledTrendDepthYears: trendDepthYears(tier),
      window: stats?.window ?? { startYear: now.getUTCFullYear() - FETCH_YEARS, endYear: now.getUTCFullYear() - 1 },
      transactionCount: txMeta?.count ?? 0,
      truncated: txMeta?.truncated ?? false,
      cached,
      cacheLayer,
      generatedAt: now.toISOString(),
      // A data-altitude failure is a slow/absent SPARQL scan on a VERIFIED location,
      // so it is always worth another attempt (endpoint latency is per-request; a
      // retry usually clears, and once any attempt succeeds the durable cache serves
      // every later request). `retryable` is the client's signal to auto-retry
      // rather than present the UNAVAILABLE section as final.
      dataError: dataError ? { code: dataError.code, retryable: true } : null,
    },
    sections,
  };
}
