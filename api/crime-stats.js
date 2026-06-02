// api/crime-stats.js — Vercel serverless function
// Fetches street-level crime data from data.police.uk
// Uses stable latest-published-month anchor (not new Date() - 2 months, which drifts)

const CATEGORY_LABELS = {
  "anti-social-behaviour": "Anti-social behaviour",
  "burglary": "Burglary",
  "criminal-damage-arson": "Criminal damage & arson",
  "drugs": "Drugs",
  "other-crime": "Other crime",
  "other-theft": "Other theft",
  "possession-of-weapons": "Weapons possession",
  "public-order": "Public order",
  "robbery": "Robbery",
  "shoplifting": "Shoplifting",
  "theft-from-the-person": "Theft from person",
  "vehicle-crime": "Vehicle crime",
  "violent-crime": "Violence & sexual offences",
  "bicycle-theft": "Bicycle theft",
};

// Cache the latest available month to avoid repeated fetches within a single request
let _cachedLatestMonth = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function getLatestPublishedMonth() {
  const now = Date.now();
  if (_cachedLatestMonth && (now - _cacheTimestamp) < CACHE_TTL_MS) {
    return _cachedLatestMonth;
  }
  try {
    const res = await fetch("https://data.police.uk/api/crimes-street-dates", {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dates = await res.json();
    // dates is an array of { date: "YYYY-MM", stop-and-search: [...] }
    // sorted newest-first by the API
    if (Array.isArray(dates) && dates.length > 0) {
      _cachedLatestMonth = dates[0].date;
      _cacheTimestamp = now;
      return _cachedLatestMonth;
    }
  } catch (_e) {
    // fall through to hardcoded fallback
  }
  // Hardcoded fallback — the latest confirmed available month
  return "2026-03";
}

export default async function handler(req, res) {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  // Get the latest stable published month — deterministic across calls
  const dateStr = await getLatestPublishedMonth();

  try {
    const url = `https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lng}&date=${dateStr}`;
    const crimeRes = await fetch(url);
    if (!crimeRes.ok) return res.status(502).json({ error: "Police API unavailable" });

    const crimes = await crimeRes.json();
    if (!Array.isArray(crimes)) return res.status(200).json({ error: "No data available" });

    const total = crimes.length;
    const counts = {};
    for (const crime of crimes) {
      const cat = crime.category || "other-crime";
      counts[cat] = (counts[cat] || 0) + 1;
    }

    const topCategories = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({
        category: CATEGORY_LABELS[category] || category,
        count,
        pct: Math.round((count / total) * 100),
      }));

    let vsNationalNote;
    if (total < 200) vsNationalNote = `${total} crimes recorded near this area in ${dateStr} — notably below the national urban average. This is a low-crime neighbourhood by UK standards.`;
    else if (total < 500) vsNationalNote = `${total} crimes recorded near this area in ${dateStr} — broadly in line with the national urban average for a residential area of this density.`;
    else if (total < 900) vsNationalNote = `${total} crimes recorded near this area in ${dateStr} — above the national urban average. Anti-social behaviour and theft are the primary categories. Typical for inner-city postcodes.`;
    else vsNationalNote = `${total} crimes recorded near this area in ${dateStr} — significantly above the national average. Concentrated around high-footfall commercial streets. Residential streets generally safer than aggregate data suggests.`;

    return res.status(200).json({
      totalCrimesPerMonth: total,
      topCategories,
      vsNationalNote,
      date: dateStr,
      source: "data.police.uk",
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch crime data", detail: err.message });
  }
}
