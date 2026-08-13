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
import { withCachedTransactions, withCachedSource, shouldSkipUpstream, recordUpstreamSuccess, recordUpstreamFailure } from "./cache.js";
import { trendDepthYears } from "./entitlements.js";
import { gateSections } from "./gate.js";
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
import { fetchOverpassBundle, overpassFailShape } from "./overpass.js";
import { fetchPoiBundle } from "./poi-source.js";
import { selectCommuteTargets } from "./commute.js";
import { fetchTflJourneys } from "./tfl.js";
import { fetchBroadband } from "./broadband.js";
import { fetchAirQuality } from "./air-quality.js";
import { fetchCouncilTax } from "./council-tax.js";
import { buildStampDuty } from "./stamp-duty.js";
import { fetchRental } from "./rental.js";
import { fetchCrime } from "./crime.js";
import { fetchPlanning } from "./planning.js";
import { fetchPropertyType } from "./property-type.js";
import { buildPropertyTypeSplitSection } from "./sections/property-type-split.js";
import { buildPlanningActivitySection } from "./sections/planning-activity.js";
import { buildDevelopmentTrackerSection } from "./sections/development-tracker.js";
import { buildRentalDemandSection } from "./sections/rental-demand.js";
import { buildAreaVerdictSection } from "./sections/verdict.js";
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
 * @param {string} rawPostcode
 * @param {{ tier?: "EXP"|"PRO"|"INV", now?: Date, budgetMs?: number }} [opts]
 * @returns {Promise<{ meta: Object, sections: Object[] }>}
 * @throws {import("./errors.js").BriefError} only on RESOLVE-altitude failure
 */
export async function generate(rawPostcode, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const budgetMs = Number.isFinite(opts.budgetMs) ? opts.budgetMs : DEFAULT_BUDGET_MS;
  // The caller (api/brief.js) resolves the REAL tier via resolveAccountTier(userId)
  // and passes it in. Direct callers (test harnesses) that omit it get INV so the
  // full payload is built for inspection — api/brief.js NEVER omits it in production.
  const tier = opts.tier === "EXP" || opts.tier === "PRO" || opts.tier === "INV" ? opts.tier : "INV";

  // ── Resolve (validation guard). Failure here aborts the whole brief. ────────
  const location = await resolve(rawPostcode);

  // ── Per-source evidence cache (Fix 1) ───────────────────────────────────────
  // Each best-effort live source is wrapped so a refresh serves the last GOOD result
  // instead of re-rolling flaky endpoints every request (the section-flicker fix).
  // `okCache` = the source RESPONDED (incl. legitimately-empty {ok:true,...}); a
  // failure ({ok:false} / null) is never cached, so a district converges on complete
  // data. Point sources key by postcode (coordinate-specific); area sources by outcode.
  // The wrapper resolves to { value, fetchedAt, cached } — fetchedAt lets a served-
  // stale section be aged/caveated (real-time signals stay honest).
  const okCache = (r) => r?.ok === true;
  // NOTE: withCachedSource uses a numeric clock (Date.now()); `now` here is a Date, so
  // we do NOT thread it in — the cache's own default clock is correct for TTLs.
  const src = (name, produce, { key = location.postcode, isCacheable = okCache } = {}) =>
    withCachedSource(`${key}:${name}`, name, produce, { isCacheable });

  // Fix 3: a single SHARED deadline for the best-effort source awaits. Each source
  // already has its own leash, but a single slow one (e.g. Overpass rotating mirrors)
  // could still stack toward the 60s function ceiling. A source not resolved by this
  // deadline yields a null value → its section renders UNAVAILABLE (honest) and is NOT
  // cached, so a later refresh retries it. Sources run concurrently with the ~56s tx
  // scan, so in practice they resolve well before this fires.
  const SOURCE_DEADLINE_MS = 52_000; // < the 60s Vercel maxDuration, with margin
  const deadlineFallback = new Promise((resolve) => {
    const t = setTimeout(() => resolve({ value: null, fetchedAt: null, cached: false, deadline: true }), SOURCE_DEADLINE_MS);
    if (typeof t?.unref === "function") t.unref(); // don't hold the event loop open (tests / warm reuse)
  });
  const byDeadline = (p) => Promise.race([p, deadlineFallback]);

  // ── Flood/climate (EA, point-wise at the validated coordinates) ─────────────
  // Independent of Land Registry, so it is kicked off HERE — concurrently with the
  // long transaction scan below — and adds effectively no wall-clock. Best-effort
  // with its own short timeout; never throws, so it can't abort the brief.
  const floodPromise = src("flood", () => fetchFloodClimate(location), { isCacheable: (r) => !!(r && r.ok) });

  // ── Neighbourhood (OSM/Overpass) — stations, kicked off concurrently too ────
  // Independent of Land Registry and of flood; its own mirror-rotation + timeout
  // guards (lib/brief/overpass.js). Best-effort, never throws.
  // Overpass: ONE combined query, memoised — fetched at most once per generation, and
  // only if at least one of the three sources misses its cache. Each is still cached
  // under its own source key, so an all-warm brief skips the Overpass call entirely.
  // This is the 3×-fewer-calls lever against the per-IP rate limit.
  // WARMING skip: a cache-warming run (api/brief?skipOverpass=1) populates the SPARQL
  // transaction cache + the non-rate-limited source caches WITHOUT touching Overpass —
  // organic traffic fills the Overpass sources via the combined query. This never calls
  // Overpass and never feeds the breaker (an intentional skip is not a failure).
  const skipOverpass = opts.skipOverpass === true;
  let _overpassBundle = null;
  const overpassBundle = () =>
    (_overpassBundle ??= (async () => {
      if (skipOverpass) return overpassFailShape();
      // Anti-spiral guard: if the breaker is OPEN (Overpass in a failure burst) or this
      // exact location failed recently, skip the live call and return the honest failure
      // shape — never re-hit a rate-limited endpoint. Success/failure feed the breaker.
      const gkey = `overpass:${location.postcode}`;
      if (shouldSkipUpstream("overpass", gkey)) return overpassFailShape();
      // LOCAL POI SOURCE: neighbourhood POIs now come from the Supabase `poi` table via
      // fetchPoiBundle (same bundle shape), not public Overpass — no rate limit, ~ms not
      // 4–13 s, and it fixes the N1-class "empty section" failures. overpassFailShape() on
      // error (no Overpass fallback). ONE-LINE REVERT: swap fetchPoiBundle → fetchOverpassBundle
      // below (fetchOverpassBundle is kept imported and intact for exactly this).
      const bundle = await fetchPoiBundle(location);
      if (bundle.ok) recordUpstreamSuccess("overpass", gkey);
      else recordUpstreamFailure("overpass", gkey);
      return bundle;
    })());
  const stationsPromise = src("stations", async () => (await overpassBundle()).stations);
  const schoolsPromise = src("schools", async () => (await overpassBundle()).schools);
  const amenitiesPromise = src("amenities", async () => (await overpassBundle()).amenities);

  // ── Broadband (PRO) + Air quality (PRO) — independent, kicked off concurrently.
  // Broadband reuses the shared Ofcom source (static LA-level table + postcodes.io);
  // air quality hits the DEFRA/ERG index. Both best-effort, never throw.
  const broadbandPromise = fetchBroadband(location);
  const airQualityPromise = src("airQuality", () => fetchAirQuality(location));

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
  const crimePromise = src("crime", () => fetchCrime(location, { now }));

  // ── Planning designations (PRO) — MHCLG planning.data.gov.uk, point-in-polygon at
  // the validated coordinates, kicked off concurrently. Independent of Land Registry;
  // one ~1s HTTP call, best-effort, never throws.
  const planningPromise = src("planning", () => fetchPlanning(location));

  // ── Property-type split (PRO) — ONS Census 2021 TS044 via Nomis, LA-level,
  // kicked off concurrently. Independent of Land Registry; best-effort, never throws.
  const propertyTypePromise = src("propertyType", () => fetchPropertyType(location), {
    key: location.outcode, // LA-level (via laCode); reuse across a district
    // Cache genuine responses INCLUDING legitimately-empty ones (ONS has no TS044 for
    // this LA / no LA code) — those won't change on refresh; only a fetch failure retries.
    isCacheable: (r) => r?.ok === true || r?.reason === "no-data" || r?.reason === "no-la-code",
  });

  // ── Full commute calculator (PRO) — LIVE TfL only for London, concurrently ──
  // Non-London targets are pure straight-line estimates (no network), so TfL is
  // only queried when the location is in London. Best-effort; never throws.
  const commuteTargets = selectCommuteTargets(location);
  const tflPromise =
    commuteTargets.method === "tfl"
      ? src("tfl", () => fetchTflJourneys(location.lat, location.lng, commuteTargets.destinations), { isCacheable: (r) => r != null })
      : Promise.resolve({ value: null, fetchedAt: null, cached: false });

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
  const { value: flood, fetchedAt: floodFetchedAt } = await byDeadline(floodPromise);
  const floodClimate = buildFloodClimateSection(flood, location, tier, floodFetchedAt);

  // ── Stations & Commute (EXP) — awaits the concurrent Overpass fetch ─────────
  const { value: stationsResult, fetchedAt: stationsFetchedAt } = await byDeadline(stationsPromise);
  const stationsCommute = buildStationsCommuteSection(stationsResult, location, tier);

  // ── Full commute calculator (PRO) — awaits the concurrent TfL fetch (or null) ─
  const { value: tflResult } = await byDeadline(tflPromise);
  const commuteCalculator = buildCommuteCalculatorSection(location, tier, tflResult);

  // ── Schools (EXP) — awaits the concurrent Overpass fetch ────────────────────
  const { value: schoolsResult, fetchedAt: schoolsFetchedAt } = await byDeadline(schoolsPromise);
  const schools = buildSchoolsSection(schoolsResult, location, tier);

  // ── Local amenities (EXP) — awaits the concurrent Overpass fetch ────────────
  const { value: amenitiesResult, fetchedAt: amenitiesFetchedAt } = await byDeadline(amenitiesPromise);
  const amenities = buildAmenitiesSection(amenitiesResult, location, tier);

  // ── Broadband (PRO) + Air quality (PRO) — await their concurrent fetches ────
  // byDeadline: these three (broadband/councilTax/rental) fetchers lack their own
  // request timeout, so without the shared 52s net a single hung upstream could stack
  // toward the 60s function ceiling and 504 the whole brief. Unlike the src()-wrapped
  // sources they resolve to a RAW { ok, data } shape (consumed directly, not destructured);
  // byDeadline is shape-agnostic, and on deadline its { value:null } sentinel has no `ok`,
  // so each builder's `!result?.ok` guard renders an honest UNAVAILABLE section (never blank,
  // never a placeholder figure) that a later warm refresh retries — same as an upstream miss.
  const broadbandResult = await byDeadline(broadbandPromise);
  const broadband = buildBroadbandSection(broadbandResult, location, tier);
  const { value: airQualityResult, fetchedAt: airQualityFetchedAt } = await byDeadline(airQualityPromise);
  const airQuality = buildAirQualitySection(airQualityResult, location, tier);

  // ── Buying Costs (EXP council tax + PRO stamp duty) — awaits the concurrent
  // council-tax fetch. Stamp duty is a pure computation from the spine window median
  // at current SDLT (England/NI) or LTT (Wales) rates; null if the price scan failed.
  const councilTaxResult = await byDeadline(councilTaxPromise); // 52s net (see broadband note above)
  const stampDuty = buildStampDuty(stats?.medianPrice ?? null, location);
  const buyingCosts = buildBuyingCostsSection(councilTaxResult, stampDuty, location, tier);

  // ── Rental Snapshot (PRO) — awaits the concurrent regional-benchmark fetch; gross
  // yield crosses those regional rents with the live local median (null-safe).
  const rentalResult = await byDeadline(rentalPromise); // 52s net (see broadband note above)
  const rentalSnapshot = buildRentalSnapshotSection(rentalResult, location, tier, stats?.medianPrice ?? null);

  // ── Crime Breakdown (PRO) — awaits the concurrent police.uk fetch. ──────────
  const { value: crimeResult, fetchedAt: crimeFetchedAt } = await byDeadline(crimePromise);
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
  const { value: planningResult, fetchedAt: planningFetchedAt } = await byDeadline(planningPromise);
  const planning = buildPlanningActivitySection(
    planningResult,
    { stats, floodData: floodClimate.data, crimeData: crimeBreakdown.data },
    location,
    tier,
  );

  // ── Property Type Split (PRO) — awaits the concurrent ONS/Nomis TS044 fetch. ──
  const { value: propertyTypeResult, fetchedAt: propertyTypeFetchedAt } = await byDeadline(propertyTypePromise);
  const propertyTypeSplit = buildPropertyTypeSplitSection(propertyTypeResult, location, tier);

  // ── Development Tracker (INV) — curated-where-exists, honest omission elsewhere.
  // Pure lookup (outcode-keyed curation), no network.
  const developmentTracker = buildDevelopmentTrackerSection(location, tier);

  // ── Letting Economics / Rental Demand (INV) — two REAL inputs (gross-yield range +
  // sales velocity), no collapsed demand score. Pure function of the rental section +
  // spine stats already computed.
  const rentalDemand = buildRentalDemandSection({ rentalData: rentalSnapshot.data, stats }, location, tier);

  // Fix 1: stamp each cached-source section with the source's fetched-at (epoch ms, or
  // null when this request fetched it live). A served-stale section can then be aged /
  // caveated downstream; a null means "verified this request". Non-verdict section
  // objects are plain literals (not frozen), so this attaches cleanly.
  floodClimate.evidenceFetchedAt = floodFetchedAt ?? null;
  stationsCommute.evidenceFetchedAt = stationsFetchedAt ?? null;
  schools.evidenceFetchedAt = schoolsFetchedAt ?? null;
  amenities.evidenceFetchedAt = amenitiesFetchedAt ?? null;
  airQuality.evidenceFetchedAt = airQualityFetchedAt ?? null;
  crimeBreakdown.evidenceFetchedAt = crimeFetchedAt ?? null;
  planning.evidenceFetchedAt = planningFetchedAt ?? null;
  propertyTypeSplit.evidenceFetchedAt = propertyTypeFetchedAt ?? null;

  // ── Area Screening Verdict (EXP) — THE SYNTHESIS ENGINE. Pure function of the
  // sections already built above + meta; fetches nothing, adds ~0 wall-clock. Built
  // last so it can read every evidence section, then placed FIRST in the payload.
  const evidenceSections = [executiveSummary, pricesSection, nearbySoldPrices, streetPriceRanking, soldPricesMap, floodClimate, stationsCommute, commuteCalculator, schools, amenities, broadband, airQuality, buyingCosts, rentalSnapshot, crimeBreakdown, neighbourhood, preOfferQuestions, planning, propertyTypeSplit, developmentTracker, rentalDemand];
  const areaVerdict = buildAreaVerdictSection(evidenceSections, {
    postcode: location.postcode,
    outcode: location.outcode,
    outcodeOnly: location.outcodeOnly ?? false,
    region: location.region,
  }, tier);

  // ── TIER GATE (server-side, at generation) ─────────────────────────────────
  // The verdict above was synthesised from the FULL, un-gated evidence, so the free
  // Explorer verdict stays high-quality. NOW reduce the payload to what this plan is
  // entitled to: locked sections have their data DROPPED (→ LOCKED preview stub) and
  // the price-trend is trimmed to the entitled depth. Nothing locked survives past
  // this line — verified by scripts/test-gating.mjs greppng the serialized payload.
  const sections = gateSections([areaVerdict, ...evidenceSections], tier);

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
