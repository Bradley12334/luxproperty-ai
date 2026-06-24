// api/air-quality.js — Vercel serverless function
// Handles two query types:
//   Default (?lat=&lng=)       → live air quality from DEFRA ERG API
//   ?type=tfl (?lat=&lng=)     → TfL journey times to key London destinations
//   (formerly api/tfl-commute.js — merged here to stay within Vercel Hobby 12-function limit)

// ─── TfL commute handler ──────────────────────────────────────────────────────

const TFL_DESTINATIONS = [
  { name: "City of London (EC2)", lat: 51.5155, lng: -0.0922 },
  { name: "Canary Wharf",         lat: 51.5054, lng: -0.0235 },
  { name: "West End (W1)",        lat: 51.5136, lng: -0.1386 },
  { name: "London Bridge",        lat: 51.5052, lng: -0.0864 },
];

async function getJourneyTime(fromLat, fromLng, toLat, toLng) {
  try {
    const url = `https://api.tfl.gov.uk/Journey/JourneyResults/${fromLat},${fromLng}/to/${toLat},${toLng}?mode=tube,elizabeth-line,overground,bus,walking&nationalSearch=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const journeys = data?.journeys || [];
    if (journeys.length === 0) return null;
    const fastest = journeys.sort((a, b) => a.duration - b.duration)[0];
    const modes = [...new Set(
      fastest.legs
        .map(l => l.mode?.name)
        .filter(m => m && m !== "walking")
    )];
    return {
      duration: fastest.duration,
      modes: modes.length > 0 ? modes : ["walking"],
    };
  } catch { return null; }
}

async function handleTfl(req, res) {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  const fromLat = parseFloat(lat);
  const fromLng = parseFloat(lng);

  const results = await Promise.all(
    TFL_DESTINATIONS.map(async (dest) => {
      const journey = await getJourneyTime(fromLat, fromLng, dest.lat, dest.lng);
      return {
        destination: dest.name,
        durationMins: journey?.duration ?? null,
        modes: journey?.modes ?? [],
      };
    })
  );

  const valid = results.filter(r => r.durationMins !== null).sort((a, b) => a.durationMins - b.durationMins);
  if (valid.length === 0) return res.status(200).json({ error: "No TfL journey data available", results: [] });
  return res.status(200).json({ results: valid });
}

// ─── Air quality handler ──────────────────────────────────────────────────────

async function handleAirQuality(req, res) {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  try {
    const response = await fetch(
      "https://api.erg.ic.ac.uk/AirQuality/Hourly/MonitoringIndex/GroupName=London/Json"
    );
    if (!response.ok) return res.status(502).json({ error: "DEFRA API unavailable" });

    const raw = await response.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(raw).replace(/^\uFEFF/, "");
    const data = JSON.parse(text);

    const auths = [].concat(data?.HourlyAirQualityIndex?.LocalAuthority || []);
    const targetLat = parseFloat(lat);
    const targetLng = parseFloat(lng);

    const allSites = [];
    for (const auth of auths) {
      const sites = [].concat(auth.Site || []);
      for (const site of sites) {
        const siteLat = parseFloat(site["@Latitude"]);
        const siteLng = parseFloat(site["@Longitude"]);
        if (isNaN(siteLat) || isNaN(siteLng)) continue;
        const dist = Math.sqrt(
          Math.pow(siteLat - targetLat, 2) + Math.pow(siteLng - targetLng, 2)
        );
        allSites.push({ site, auth, dist });
      }
    }

    allSites.sort((a, b) => a.dist - b.dist);

    let result = null;
    for (const { site, auth } of allSites.slice(0, 20)) {
      const species = [].concat(site.Species || []);
      const no2  = species.find((s) => s["@SpeciesCode"] === "NO2");
      const pm25 = species.find((s) => s["@SpeciesCode"] === "PM25");
      const pm10 = species.find((s) => s["@SpeciesCode"] === "PM10");

      const no2idx  = parseInt(no2?.["@AirQualityIndex"]  || "0");
      const pm25idx = parseInt(pm25?.["@AirQualityIndex"] || "0");
      const pm10idx = parseInt(pm10?.["@AirQualityIndex"] || "0");

      if (no2idx === 0 && pm25idx === 0 && pm10idx === 0) continue;

      const maxIdx = Math.max(no2idx, pm25idx, pm10idx);
      let rating;
      if (maxIdx <= 3)      rating = "Good";
      else if (maxIdx <= 6) rating = "Moderate";
      else if (maxIdx <= 9) rating = "High";
      else                  rating = "Very High";

      const no2ugm3  = no2idx  > 0 ? `${no2idx  * 20}–${no2idx  * 20 + 19} µg/m³` : "No data";
      const pm25ugm3 = pm25idx > 0 ? `${pm25idx * 3}–${pm25idx * 3  + 2}  µg/m³` : "No data";

      result = {
        siteName: site["@SiteName"],
        localAuthority: auth["@LocalAuthorityName"],
        no2Level: no2ugm3,
        pm25Level: pm25ugm3,
        no2Index: no2idx,
        pm25Index: pm25idx,
        maxIndex: maxIdx,
        rating,
        distKm: Math.round(allSites[0].dist * 111 * 10) / 10,
      };
      break;
    }

    if (!result) return res.status(200).json({ error: "No active monitoring data found" });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch air quality data", detail: err.message });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.query.type === "tfl") return handleTfl(req, res);
  return handleAirQuality(req, res);
}
