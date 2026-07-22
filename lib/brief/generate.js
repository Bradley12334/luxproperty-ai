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
import { buildPricesSection } from "./sections/prices.js";
import { buildNearbySoldPricesSection } from "./sections/nearby-sold-prices.js";
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
  { key: "executiveSummary",   title: "Executive summary",             minTier: "EXP" },
  { key: "neighbourhood",      title: "Neighbourhood profile",         minTier: "EXP" },
  { key: "amenities",          title: "Schools, stations & amenities", minTier: "EXP" },
  { key: "floodClimate",       title: "Flood & climate risk",          minTier: "EXP" },
  { key: "councilTax",         title: "Council tax band",              minTier: "EXP" },
  { key: "commute",            title: "Commute",                       minTier: "EXP" },
  { key: "preOfferQuestions",  title: "Pre-offer questions",           minTier: "PRO" },
  { key: "crimeBreakdown",     title: "Crime breakdown",               minTier: "PRO" },
  { key: "planning",           title: "Planning activity & risk",      minTier: "PRO" },
  { key: "broadband",          title: "Broadband & fibre coverage",    minTier: "PRO" },
  { key: "rentalContext",      title: "Rental market context",         minTier: "PRO" },
  { key: "airQuality",         title: "Air quality",                   minTier: "PRO" },
  { key: "soldPricesMap",      title: "Sold prices map",               minTier: "INV" },
  { key: "streetPriceRanking", title: "Street price ranking",          minTier: "INV" },
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

  const sections = [pricesSection, nearbySoldPrices, ...COMING_SOON_SECTIONS];

  return {
    meta: {
      postcode: location.postcode,
      outcode: location.outcode,
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
