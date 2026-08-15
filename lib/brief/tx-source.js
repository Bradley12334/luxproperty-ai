/**
 * lib/brief/tx-source.js
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SPINE SWITCH — chooses between the offline PPD aggregate and the legacy
 * Land Registry SPARQL scan, and normalises BOTH into one Spine object.
 *
 * Every price-derived section reads the Spine and nothing else. That is the whole
 * design: it means no section can tell which source it is reading, the two paths
 * cannot drift apart in presentation, and switching a district over is a config
 * change rather than a code change.
 *
 * ── ENV GATING ───────────────────────────────────────────────────────────────
 *   TX_SOURCE           "sparql" (default) | "aggregate" | "auto"
 *                       sparql    — legacy path only; the aggregate is never read
 *                       aggregate — aggregate only; a miss is a hard failure
 *                       auto      — aggregate where allowed, SPARQL everywhere else
 *   TX_AGG_DISTRICTS    comma-separated outcodes the aggregate may serve, e.g.
 *                       "E20,E8,SE1". "*" means every district. Ignored when
 *                       TX_SOURCE is "sparql".
 *
 * The default is deliberately the OLD path. A missing or misspelled env var rolls
 * back to the behaviour that is already in production rather than to the new one.
 *
 * ── FALLBACK POLICY ──────────────────────────────────────────────────────────
 * In "auto", a district that is in TX_AGG_DISTRICTS but absent from the aggregate
 * table falls back to SPARQL — that is a coverage gap, and the old path still works.
 * A STALE or undated aggregate does NOT fall back: falling back would paper over an
 * ops failure with a 30-second scan and nobody would ever learn the refresh had
 * stopped. Freshness failures propagate.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getTransactions } from "./transactions.js";
import { withCachedTransactions } from "./cache.js";
import { computeStats, statsFromAggregate, medianCi, withholdValuation } from "./stats.js";
import { fetchDistrictAggregate, fetchSectorAggregates, classifySector } from "./tx-agg.js";
import { BriefError, ErrorCodes } from "./errors.js";

/** How many recent sales the Spine carries. The aggregate stores 40; sections show
 *  at most 12 after the recency filter, and the surplus is headroom for
 *  property-type-matched comps without a reload. */
const RECENT_CARRY = 40;

/** Trailing calendar years counted for the pre-offer "recent sales" signal. */
const RECENT_WINDOW_YEARS = 3;

/**
 * @typedef {Object} Spine
 * @property {"aggregate"|"sparql"} source
 * @property {string} district
 * @property {{startYear:number,endYear:number}} window  ALWAYS from the data, never the clock
 * @property {{published:string,ageDays:number,label:string,refreshOverdue:boolean}|null} asOf
 * @property {Object} stats                     computeStats-shaped, from the one shared derivation
 * @property {Array<Object>} streets            {street,count,median,ciLo,ciHi,p25,p75}
 * @property {number} streetsTotal              named streets seen, including unlisted ones
 * @property {Array<Object>} recent             newest-first full transaction records
 * @property {number} totalCount
 * @property {number} recentWindowCount         sales in the trailing 3 calendar years
 * @property {Object|null} sectorContext        classifySector() verdict for the resolved sector
 * @property {Object|null} txSet                legacy raw set — SPARQL path only, may be null
 */

/** Parse TX_AGG_DISTRICTS into a matcher. */
function aggAllowList() {
  const raw = String(process.env.TX_AGG_DISTRICTS || "").trim();
  if (!raw) return { all: false, set: new Set() };
  if (raw === "*") return { all: true, set: new Set() };
  return {
    all: false,
    set: new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)),
  };
}

/** Should this district be served from the aggregate? */
export function aggregateEnabledFor(district) {
  const mode = String(process.env.TX_SOURCE || "sparql").trim().toLowerCase();
  if (mode === "sparql") return { enabled: false, mode, required: false };
  const outcode = String(district || "").trim().toUpperCase();
  const allow = aggAllowList();
  const listed = allow.all || allow.set.has(outcode);
  if (mode === "aggregate") return { enabled: listed, mode, required: true };
  if (mode === "auto") return { enabled: listed, mode, required: false };
  console.warn(`[brief] unrecognised TX_SOURCE="${mode}" — falling back to the SPARQL spine.`);
  return { enabled: false, mode, required: false };
}

/**
 * Build the Spine for a district.
 *
 * @param {string} district outcode
 * @param {number} years    trailing-window size, SPARQL path only (the aggregate
 *                          declares its own window)
 * @param {{ now?: Date, signal?: AbortSignal, sector?: string|null }} [opts]
 * @returns {Promise<Spine>}
 */
export async function getSpine(district, years, opts = {}) {
  const outcode = String(district || "").trim().toUpperCase();
  const gate = aggregateEnabledFor(outcode);

  if (gate.enabled) {
    const row = await fetchDistrictAggregate(outcode, { now: opts.now });
    if (row) return await spineFromAggregate(row, opts);

    // Absent from the aggregate. In "aggregate" mode that is fatal by design —
    // the operator asked for this district to be served from the aggregate and it
    // is not there, which is a load problem, not something to paper over.
    if (gate.required) {
      throw new BriefError(
        ErrorCodes.UPSTREAM_ERROR,
        `${outcode} is not present in the sold-price aggregate.`,
        { district: outcode, reason: "aggregate-miss", mode: gate.mode },
      );
    }
    console.warn(`[brief] ${outcode} listed for the aggregate but absent — falling back to SPARQL.`);
  }

  return await spineFromSparql(outcode, years, opts);
}

/**
 * THE WRONG-LEVEL RULE, as a pure function so it can be exercised without a database.
 *
 * When the brief tells a reader, in their own brief, that the district median is the
 * wrong level for their address, no valuation or offer range anchored to that median
 * may appear underneath it. On E20 3 the un-withheld version quoted an opening offer
 * of £582,300–£621,120 against a sector median of £741,250 — a reader following it
 * would have opened roughly £120,000 below the evidence from their own sector, and
 * the brief would have told them to.
 *
 * A caveat cannot repair that: the reader is handed a number and told in the same
 * breath not to trust it, and the number is what they act on. So the FACTS stay
 * (district median, sector median, counts, every recorded sale) and the CLAIMS go.
 *
 * @param {Object} stats
 * @param {Object|null} sectorContext classifySector() verdict
 * @param {string} district
 * @param {number|null} sectorTxCount
 */
export function applySectorPolicy(stats, sectorContext, district, sectorTxCount) {
  if (sectorContext?.verdict !== "warn") return stats;
  const dir = sectorContext.divergencePct > 0 ? "higher" : "lower";
  const mag = Math.abs(sectorContext.divergencePct).toFixed(0);
  const wrongWay = dir === "higher" ? "low" : "high";
  return withholdValuation(
    stats,
    `No fair-value or opening-offer range is quoted for this address. Sales in ${sectorContext.sector} sit about ` +
      `${mag}% ${dir} than ${district} as a whole, so a range anchored to the district median would point you roughly ` +
      `${mag}% ${wrongWay}` +
      (sectorTxCount ? ` — and with only ${sectorTxCount} sales in ${sectorContext.sector}` : " — and with too few sector sales") +
      ` there is not enough evidence to put a figure on the sector instead. ` +
      `This is a deliberate omission, not missing data: the district median and the sector's own median are both ` +
      `shown above, and every recorded sale is listed in full below.`,
  );
}

// ── aggregate path ───────────────────────────────────────────────────────────

async function spineFromAggregate(row, opts) {
  const { district, window, asOf, payload } = row;
  let stats = statsFromAggregate(payload, window);

  // Sector context is best-effort and must never fail the brief.
  let sectorContext = null;
  const wantSector = normaliseSector(opts.sector);
  if (wantSector) {
    const sectors = await fetchSectorAggregates(district);
    const match = sectors.find((s) => s.sector === wantSector) || null;
    sectorContext = classifySector(match, payload.median ?? null);

    stats = applySectorPolicy(stats, sectorContext, district, match?.txCount ?? null);
  }

  const recent = (payload.recent || []).slice(0, RECENT_CARRY).map(normaliseRecent);

  return {
    source: "aggregate",
    district,
    window,
    asOf,
    stats,
    streets: payload.streets || [],
    streetsTotal: payload.streetsTotal ?? (payload.streets || []).length,
    recent,
    totalCount: payload.txCount ?? 0,
    recentWindowCount: countRecentYears(payload.byYear || [], window.endYear),
    sectorContext,
    txSet: null,
    // Present on BOTH constructors deliberately. These were previously set only by
    // the SPARQL path, so generate.js read `spine.cached ?? true` off an object that
    // had no such field — exactly the shape of the sector bug, benign only because
    // the default happened to be right. A Spine now has one key set, whatever built it.
    cached: true,   // an aggregate read is a durable read by definition
    layer: "aggregate",
  };
}

/** The aggregate stores PPD's raw single-letter codes; the legacy Transaction shape
 *  uses labels. Normalise here so sections see one vocabulary. */
const TYPE_LABEL = { D: "Detached", S: "Semi-detached", T: "Terraced", F: "Flat", O: "Other" };
const TENURE_LABEL = { F: "Freehold", L: "Leasehold", U: "Unknown" };

function normaliseRecent(t) {
  return {
    id: t.id,
    price: t.price,
    date: t.date,
    postcode: t.postcode,
    paon: t.paon || "",
    saon: t.saon || "",
    street: t.street || "",
    town: t.town || "",
    propertyType: TYPE_LABEL[t.propertyType] || t.propertyType || "Other",
    tenure: TENURE_LABEL[t.tenure] || t.tenure || "Unknown",
    newBuild: t.newBuild === true,
    category: "standard", // the aggregate only ever holds Category A
  };
}

function countRecentYears(byYear, endYear) {
  const cutoff = endYear - RECENT_WINDOW_YEARS + 1;
  let n = 0;
  for (const y of byYear) if (y.year >= cutoff) n += y.count || 0;
  return n;
}

function normaliseSector(sector) {
  const s = String(sector || "").trim().toUpperCase();
  return /^[A-Z]{1,2}\d[A-Z\d]? \d$/.test(s) ? s : null;
}

// ── SPARQL path ──────────────────────────────────────────────────────────────
// Derives the SAME Spine fields from the raw set, so both sources converge before
// any section sees them. This is what makes an aggregate-vs-SPARQL diff meaningful:
// anything that differs is data, not presentation.

async function spineFromSparql(district, years, opts) {
  const result = await withCachedTransactions(district, years, () =>
    getTransactions(district, years, { now: opts.now, signal: opts.signal }),
  );
  const txSet = result.value;
  const stats = computeStats(txSet);
  const txns = txSet.transactions || [];

  // Streets, in the aggregate's shape and with its keep-floor, so the street
  // section applies one rule regardless of source.
  const byStreet = new Map();
  for (const t of txns) {
    const key = String(t.street || "").trim().toUpperCase().replace(/\s+/g, " ");
    if (!key) continue;
    let a = byStreet.get(key);
    if (!a) byStreet.set(key, (a = []));
    a.push(t.price);
  }
  const streets = [];
  for (const [street, prices] of byStreet) {
    if (prices.length < 8) continue; // matches MIN_STREET_KEEP in the offline build
    prices.sort((a, b) => a - b);
    streets.push({
      street,
      count: prices.length,
      median: prices.length % 2 ? prices[prices.length >> 1]
        : Math.round((prices[(prices.length >> 1) - 1] + prices[prices.length >> 1]) / 2),
      ...medianCi(prices),
      p25: prices[Math.floor(prices.length * 0.25)],
      p75: prices[Math.floor(prices.length * 0.75)],
    });
  }
  streets.sort((a, b) => b.count - a.count || b.median - a.median);

  const cutoff = txSet.window.endYear - RECENT_WINDOW_YEARS + 1;
  let recentWindowCount = 0;
  for (const t of txns) {
    if (t.category === "standard" && Number(t.date.slice(0, 4)) >= cutoff) recentWindowCount++;
  }

  return {
    source: "sparql",
    district: txSet.district,
    window: txSet.window,
    asOf: null, // the live scan has no publication vintage to report
    stats,
    streets,
    streetsTotal: byStreet.size,
    recent: txns.slice(0, RECENT_CARRY),
    totalCount: txns.length,
    recentWindowCount,
    sectorContext: null,
    txSet,
    cached: result.cached,
    layer: result.layer,
  };
}
