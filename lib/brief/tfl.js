/**
 * lib/brief/tfl.js
 * ─────────────────────────────────────────────────────────────────────────────
 * TfL JOURNEY TIMES — live door-to-door journey durations for the PRO full commute
 * calculator, LONDON ONLY. TfL's Journey API is a London service; this module is
 * only ever called for London locations (see commute.js → selectCommuteTargets).
 *
 * Best-effort, never throws: a failed destination yields null and the calculator
 * renders that row honestly ("time unavailable") rather than a fabricated figure.
 * NO NEW SERVERLESS FUNCTION — runs inside generate().
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TFL_JOURNEY = "https://api.tfl.gov.uk/Journey/JourneyResults";
const DEFAULT_TIMEOUT_MS = 8_000;

// Map TfL leg mode names → the short label we show. Walking legs are dropped from
// the summary (every journey starts/ends on foot; it isn't a "mode" worth listing).
const MODE_LABEL = {
  tube: "Tube",
  "elizabeth-line": "Elizabeth line",
  overground: "Overground",
  dlr: "DLR",
  "national-rail": "National Rail",
  bus: "Bus",
  tram: "Tram",
  "river-bus": "River bus",
  coach: "Coach",
};

/** One TfL journey lookup. Returns { durationMins, modes[] } or null. Never throws. */
async function oneJourney(fromLat, fromLng, dest, signal) {
  const url =
    `${TFL_JOURNEY}/${fromLat},${fromLng}/to/${dest.lat},${dest.lng}` +
    `?mode=tube,elizabeth-line,overground,dlr,national-rail,bus,tram,walking&nationalSearch=false`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal });
    if (!res.ok) return null;
    const data = await res.json();
    const journeys = Array.isArray(data?.journeys) ? data.journeys : [];
    if (journeys.length === 0) return null;
    const fastest = journeys.slice().sort((a, b) => a.duration - b.duration)[0];
    const modes = [];
    const seen = new Set();
    for (const leg of fastest.legs || []) {
      const name = leg?.mode?.name;
      if (!name || name === "walking" || seen.has(name)) continue;
      seen.add(name);
      modes.push(MODE_LABEL[name] || name);
    }
    return { durationMins: Number(fastest.duration), modes };
  } catch {
    return null;
  }
}

/**
 * Live TfL journey times from a coordinate to each London destination, concurrently.
 * @param {number} fromLat
 * @param {number} fromLng
 * @param {{name:string,lat:number,lng:number}[]} destinations
 * @param {{ signal?:AbortSignal, timeoutMs?:number }} [opts]
 * @returns {Promise<{ ok:boolean, results:{destination:string,durationMins:number|null,modes:string[]}[] }>}
 *   ok=false → every lookup failed (service unreachable). ok=true → at least one
 *   destination resolved; unresolved ones carry durationMins=null.
 */
export async function fetchTflJourneys(fromLat, fromLng, destinations, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS);
  const onParentAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", onParentAbort, { once: true });
  }
  try {
    const results = await Promise.all(
      destinations.map(async (dest) => {
        const j = await oneJourney(fromLat, fromLng, dest, controller.signal);
        return { destination: dest.name, durationMins: j?.durationMins ?? null, modes: j?.modes ?? [] };
      }),
    );
    const ok = results.some((r) => r.durationMins != null);
    return { ok, results };
  } finally {
    clearTimeout(timer);
    if (opts.signal) opts.signal.removeEventListener("abort", onParentAbort);
  }
}
