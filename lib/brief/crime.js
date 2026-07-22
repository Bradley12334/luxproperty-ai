/**
 * lib/brief/crime.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CRIME SOURCE (PRO) — street-level recorded crime from data.police.uk, fetched
 * DIRECTLY at the validated coordinates. Built clean (NOT a shim of the old
 * /api/crime-stats handler) so the fabricated "vs national average" line the old
 * endpoint emitted is left behind — police.uk gives no population denominators, so a
 * fair benchmark can't be computed from it, and we don't invent one.
 *
 * ENDPOINTS (re-probed live, Phase 2e):
 *   - /api/crimes-street-dates → the months police.uk has published, newest first.
 *     The feed lags ~2 months; we anchor to its latest published month (not a
 *     computed now-minus-2, which drifts) and STATE that month in the section.
 *   - /api/crimes-street/all-crime?lat&lng&date → every street-level crime within
 *     ~1 mile of the point for that month. The section frames that radius honestly.
 *
 * England & Wales are covered by police.uk; Scotland/NI are rejected upstream at
 * resolve, so no nation branch is needed here.
 *
 * Best-effort; never throws. Runs inside generate() (no new serverless function).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const POLICE_API = "https://data.police.uk/api";

// Human labels for police.uk category slugs (their stable identifiers).
const CATEGORY_LABELS = {
  "anti-social-behaviour": "Anti-social behaviour",
  "bicycle-theft": "Bicycle theft",
  "burglary": "Burglary",
  "criminal-damage-arson": "Criminal damage & arson",
  "drugs": "Drugs",
  "other-crime": "Other crime",
  "other-theft": "Other theft",
  "possession-of-weapons": "Weapons possession",
  "public-order": "Public order",
  "robbery": "Robbery",
  "shoplifting": "Shoplifting",
  "theft-from-the-person": "Theft from the person",
  "vehicle-crime": "Vehicle crime",
  "violent-crime": "Violence & sexual offences",
};

// Cache the latest published month across warm invocations (the dates feed is stable
// for weeks; this avoids an extra round-trip per brief). No Date.now sensitivity beyond
// a TTL — a stale-by-hours month is harmless and self-heals on the next miss.
let _latestMonth = null;
let _latestMonthAt = 0;
const MONTH_TTL_MS = 6 * 60 * 60 * 1000;

async function getLatestMonth(now) {
  const t = now instanceof Date ? now.getTime() : Date.now();
  if (_latestMonth && t - _latestMonthAt < MONTH_TTL_MS) return _latestMonth;
  try {
    const res = await fetch(`${POLICE_API}/crimes-street-dates`, { headers: { Accept: "application/json" } });
    if (!res.ok) return _latestMonth; // keep any prior value
    const dates = await res.json();
    if (Array.isArray(dates) && dates.length && dates[0]?.date) {
      _latestMonth = dates[0].date; // "YYYY-MM", newest first
      _latestMonthAt = t;
    }
  } catch {
    /* keep any prior value */
  }
  return _latestMonth;
}

/**
 * @param {import("./resolve.js").ResolvedLocation} location
 * @param {{ now?: Date }} [opts]
 * @returns {Promise<{ ok:boolean, data:{ month:string, total:number, categories:Array<{key:string,label:string,count:number,pct:number}> }|null }>}
 */
export async function fetchCrime(location, opts = {}) {
  const month = await getLatestMonth(opts.now);
  if (!month) return { ok: false, data: null };

  let crimes;
  try {
    const url = `${POLICE_API}/crimes-street/all-crime?lat=${location.lat}&lng=${location.lng}&date=${month}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return { ok: false, data: null };
    crimes = await res.json();
  } catch {
    return { ok: false, data: null };
  }
  if (!Array.isArray(crimes)) return { ok: false, data: null };

  const total = crimes.length;
  const counts = {};
  for (const c of crimes) {
    const cat = c?.category || "other-crime";
    counts[cat] = (counts[cat] || 0) + 1;
  }
  const categories = Object.entries(counts)
    .map(([key, count]) => ({
      key,
      label: CATEGORY_LABELS[key] || key,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { ok: true, data: { month, total, categories } };
}
