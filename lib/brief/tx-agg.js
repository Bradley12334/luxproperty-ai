/**
 * lib/brief/tx-agg.js
 * ─────────────────────────────────────────────────────────────────────────────
 * OFFLINE PPD AGGREGATE READER — the replacement source for the transaction spine.
 *
 * Reads brief_tx_agg_district / brief_tx_agg_sector, built offline from the HM Land
 * Registry Price Paid yearly files (~/Documents/ppd-agg) and validated against all
 * 1,906 cached SPARQL payloads by transaction GUID: every unit of divergence was
 * attributable to Land Registry deletions and amendments between snapshots, and the
 * worst district median moved 1.12%.
 *
 * WHY THIS EXISTS: the SPARQL spine's only slow step was a 16-49s table scan whose
 * cost was endpoint variance, not our row count. That variance is what clipped the
 * generation budget and returned UNAVAILABLE for routine latency. A primary-key read
 * against Postgres is ~tens of ms and has no variance tail.
 *
 * ── FRESHNESS IS PART OF THE CONTRACT, NOT A DECORATION ──────────────────────
 * An aggregate has no upstream to fail at request time, so the only way it can be
 * wrong is by being STALE — and staleness is silent unless we make it loud. Three
 * rules, in order of severity:
 *
 *   1. FAIL CLOSED ON A MISSING DATE. If source_published is absent or unparseable
 *      the read THROWS. Not "assume fresh", not "serve undated" — the absence of a
 *      date is itself a refusal, so there is no code path that can ship a brief
 *      whose price data is of unknown vintage.
 *   2. DATED ALWAYS. Every successful read carries an `asOf` the sections render
 *      whether or not the data is stale. A fresh figure is dated for the same
 *      reason a stale one is: the reader should never have to assume.
 *   3. REFUSE PAST 60 DAYS. Argued from PPD's own cadence, not inherited. LR
 *      publishes monthly, so a healthy aggregate is routinely 0-31 days old and any
 *      cap at one cycle would refuse perfectly good data. One MISSED cycle was
 *      measured across 1,844 districts: window median unchanged for 75.1%, p95
 *      0.35%, worst 1.12% — well inside the ±8% band the brief quotes, so serving
 *      it dated is right. At two missed cycles the latest year is short a full
 *      quarter of registrations and its drift crosses the ±10% criterion the byYear
 *      thresholds are built on. That is the break, and it lands at ~60 days.
 *
 * The >35-day condition is reported but NOT enforced here: it is caught by
 * load-agg.mjs, which hard-errors, because Vercel Hobby retains runtime logs for one
 * hour on a near-idle site and a warning logged at request time is written to nobody.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import { BriefError, ErrorCodes } from "./errors.js";

/** Past this many days the aggregate is refused outright (see rule 3 above). */
export const SERVE_CAP_DAYS = 60;

/** One missed monthly publication. Reported on the payload; enforced by the loader. */
export const REFRESH_WARN_DAYS = 35;

/** Cap the read so a slow database can never eat the generation budget. */
const READ_TIMEOUT_MS = 3_000;

let _client = null;
let _clientResolved = false;

function aggClient() {
  if (_clientResolved) return _client;
  _clientResolved = true;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    _client = null;
    return null;
  }
  try {
    _client = createClient(url, key, { auth: { persistSession: false } });
  } catch (err) {
    console.warn(`[brief] tx-agg disabled — client init failed: ${err?.message || err}`);
    _client = null;
  }
  return _client;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/**
 * Validate the row's publication date and turn it into the `asOf` every price
 * section renders. THROWS rather than returning a degraded value — see rule 1.
 *
 * @param {string|Date|null|undefined} sourcePublished
 * @param {string} district
 * @param {Date} now
 * @returns {{ published: string, ageDays: number, label: string, refreshOverdue: boolean }}
 */
export function readVintage(sourcePublished, district, now = new Date()) {
  if (sourcePublished == null || sourcePublished === "") {
    throw new BriefError(
      ErrorCodes.SOURCE_STALE,
      `Sold-price aggregate for ${district} carries no publication date, so its vintage cannot be established.`,
      { district, reason: "missing-source-published" },
    );
  }
  const raw = sourcePublished instanceof Date ? sourcePublished.toISOString().slice(0, 10) : String(sourcePublished).slice(0, 10);
  const ms = Date.parse(`${raw}T00:00:00Z`);
  if (!Number.isFinite(ms)) {
    throw new BriefError(
      ErrorCodes.SOURCE_STALE,
      `Sold-price aggregate for ${district} carries an unreadable publication date ("${raw}").`,
      { district, reason: "unparseable-source-published", value: raw },
    );
  }

  const ageDays = Math.floor((now.getTime() - ms) / 86_400_000);
  if (ageDays > SERVE_CAP_DAYS) {
    throw new BriefError(
      ErrorCodes.SOURCE_STALE,
      `Sold-price data for ${district} was last refreshed ${ageDays} days ago (${raw}). ` +
        `HM Land Registry publishes monthly, so this is at least two missed updates — the figures are ` +
        `withheld rather than shown at an age we cannot stand behind.`,
      { district, reason: "beyond-serve-cap", ageDays, published: raw, capDays: SERVE_CAP_DAYS },
    );
  }

  const d = new Date(ms);
  return {
    published: raw,
    ageDays,
    label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    refreshOverdue: ageDays > REFRESH_WARN_DAYS,
  };
}

/**
 * Fetch one district's aggregate.
 *
 * @param {string} district outcode, e.g. "E20"
 * @param {{ now?: Date }} [opts]
 * @returns {Promise<{
 *   district: string,
 *   window: { startYear: number, endYear: number },
 *   payload: Object,
 *   asOf: { published: string, ageDays: number, label: string, refreshOverdue: boolean },
 * } | null>} null when the district is genuinely absent from the aggregate.
 * @throws {BriefError} SOURCE_STALE on a bad/old vintage; UPSTREAM_ERROR if the
 *   aggregate is unreachable. Never returns a silently-degraded value.
 */
export async function fetchDistrictAggregate(district, opts = {}) {
  const outcode = String(district || "").trim().toUpperCase();
  const client = aggClient();
  if (!client) {
    throw new BriefError(
      ErrorCodes.UPSTREAM_ERROR,
      "Sold-price aggregate is not configured in this environment (SUPABASE_URL / SUPABASE_SERVICE_KEY absent).",
      { district: outcode, reason: "not-configured" },
    );
  }

  let data;
  try {
    const res = await withTimeout(
      client
        .from("brief_tx_agg_district")
        .select("district, window_start, window_end, tx_count, median, payload, source_published")
        .eq("district", outcode)
        .maybeSingle(),
      READ_TIMEOUT_MS,
      "aggregate read",
    );
    if (res.error) throw new Error(res.error.message);
    data = res.data;
  } catch (err) {
    throw new BriefError(
      ErrorCodes.UPSTREAM_ERROR,
      `Sold-price aggregate could not be read for ${outcode}.`,
      { district: outcode, cause: String(err?.message || err) },
    );
  }

  if (!data) return null; // genuinely not in the aggregate — the caller decides

  const asOf = readVintage(data.source_published, outcode, opts.now);

  // The window comes off the ROW. Deriving it from the clock (the old
  // latestFullYear(new Date()) approach) silently asks for a year PPD has not
  // finished publishing every January, and would make the brief claim a window its
  // own data does not cover.
  const window = { startYear: Number(data.window_start), endYear: Number(data.window_end) };
  if (!Number.isFinite(window.startYear) || !Number.isFinite(window.endYear) || window.endYear < window.startYear) {
    throw new BriefError(
      ErrorCodes.SOURCE_STALE,
      `Sold-price aggregate for ${outcode} declares an unusable window (${data.window_start}-${data.window_end}).`,
      { district: outcode, reason: "bad-window" },
    );
  }

  const payload = data.payload || {};
  return {
    district: outcode,
    window,
    asOf,
    payload: {
      ...payload,
      district: payload.district ?? outcode,
      txCount: payload.txCount ?? data.tx_count,
      median: payload.median ?? data.median,
    },
  };
}

/**
 * Fetch every sector inside a district. Best-effort: sector context enriches the
 * brief but must never be able to fail it, so this returns [] on any error rather
 * than throwing. The district aggregate is the load-bearing read.
 *
 * @param {string} district
 * @returns {Promise<Array<{ sector: string, txCount: number, median: number|null, ciLo: number|null, ciHi: number|null }>>}
 */
export async function fetchSectorAggregates(district) {
  const outcode = String(district || "").trim().toUpperCase();
  const client = aggClient();
  if (!client) return [];
  try {
    const res = await withTimeout(
      client
        .from("brief_tx_agg_sector")
        .select("sector, tx_count, median, payload")
        .eq("district", outcode),
      READ_TIMEOUT_MS,
      "sector aggregate read",
    );
    if (res.error) throw new Error(res.error.message);
    return (res.data || []).map((r) => ({
      sector: r.sector,
      txCount: r.tx_count,
      median: r.median,
      ciLo: r.payload?.ciLo ?? null,
      ciHi: r.payload?.ciHi ?? null,
    }));
  } catch (err) {
    console.warn(`[brief] sector aggregate read skipped (${outcode}) — ${err?.message || err}`);
    return [];
  }
}

// ── Sector-vs-district divergence ────────────────────────────────────────────
// ONE rule, deliberately. An earlier design had a third "serve-sector" band that
// claimed the brief's figures were for the sector — while every figure downstream
// stayed district-derived. On CR0 2AB that printed a district median of £352,500
// over 16,713 district sales under the heading "Figures are for postcode sector
// CR0 2", and quoted a negotiation range ~15% above the sector's own level. The
// copy was never true: nothing was ever implemented to swap the figures.
//
// So there is no serve band. The brief reports at DISTRICT grain, says so, and where
// a sector diverges beyond its own sampling error it states that sector's median as
// a figure in its own right and withholds any range anchored to the district median.
// Serving a genuinely sector-level brief needs sector-grain streets, recent sales and
// property-type split, which the aggregate does not carry — see BRIEF_SPEC.md.

/** Every verdict classifySector can emit. The E2E suite asserts its cases cover this
 *  set exactly, so adding a branch here fails the suite until a real postcode
 *  exercises it. The serve band shipped untested precisely because nothing forced
 *  coverage: E20 has two sectors and neither is one. */
export const SECTOR_VERDICTS = Object.freeze(["warn", "none"]);

/** A sector needs at least this many sales before its divergence is worth stating.
 *  30 aligns with the byYear `data` floor. The measured evidence ratio is 1.02x at
 *  the weakest end of every floor tested, so a higher floor buys no evidence
 *  quality — it only silences real divergences (at 100 it silenced E20 3). */
export const SECTOR_MIN_FOR_WARN = 30;

/**
 * How should this sector be described, given its parent district?
 *
 * @param {{sector:string, txCount:number, median:number|null, ciLo:number|null, ciHi:number|null}|null} sector
 * @param {number|null} districtMedian
 * @returns {{ verdict: "warn"|"none", sector: string|null, sectorMedian: number|null,
 *             txCount: number|null, ciLo: number|null, ciHi: number|null,
 *             divergencePct: number|null, errorPct: number|null, note: string|null }}
 */
export function classifySector(sector, districtMedian) {
  const none = {
    verdict: "none",
    sector: sector?.sector ?? null,
    sectorMedian: sector?.median ?? null,
    txCount: sector?.txCount ?? null,
    ciLo: sector?.ciLo ?? null,
    ciHi: sector?.ciHi ?? null,
    divergencePct: null, errorPct: null, note: null,
  };
  if (!sector || sector.median == null || districtMedian == null || districtMedian === 0) return none;

  const divergencePct = ((sector.median - districtMedian) / districtMedian) * 100;
  const errorPct =
    sector.ciLo != null && sector.ciHi != null && sector.median !== 0
      ? ((sector.ciHi - sector.ciLo) / (2 * sector.median)) * 100
      : null;

  // Divergence must clear the sector's OWN sampling error before it is a claim.
  if (errorPct == null || Math.abs(divergencePct) <= errorPct) return { ...none, divergencePct, errorPct };
  if (sector.txCount < SECTOR_MIN_FOR_WARN) return { ...none, divergencePct, errorPct };

  const dir = divergencePct > 0 ? "higher" : "lower";
  const mag = Math.abs(divergencePct).toFixed(0);
  return {
    verdict: "warn",
    sector: sector.sector,
    sectorMedian: sector.median,
    txCount: sector.txCount,
    ciLo: sector.ciLo,
    ciHi: sector.ciHi,
    divergencePct,
    errorPct,
    // States the grain plainly. Never claims the figures below are sector figures.
    note:
      `The figures below describe the whole of ${districtOf(sector.sector)}. Sales recorded specifically in ` +
      `${sector.sector} sit around ${mag}% ${dir} than that, which is more than sampling variation explains — ` +
      `its own median is shown above. Read the district figures as describing the wider area, not this address.`,
  };
}

function districtOf(sector) {
  const i = String(sector || "").indexOf(" ");
  return i === -1 ? sector : sector.slice(0, i);
}
