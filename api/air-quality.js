// api/air-quality.js — Vercel serverless function
// Fetches live London air quality from DEFRA ERG API (nearest monitoring site)

export default async function handler(req, res) {
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

    // Collect all sites with coordinates
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

    // Sort by distance, find nearest with actual readings
    allSites.sort((a, b) => a.dist - b.dist);

    let result = null;
    for (const { site, auth } of allSites.slice(0, 20)) {
      const species = [].concat(site.Species || []);
      const no2 = species.find((s) => s["@SpeciesCode"] === "NO2");
      const pm25 = species.find((s) => s["@SpeciesCode"] === "PM25");
      const pm10 = species.find((s) => s["@SpeciesCode"] === "PM10");

      const no2idx = parseInt(no2?.["@AirQualityIndex"] || "0");
      const pm25idx = parseInt(pm25?.["@AirQualityIndex"] || "0");
      const pm10idx = parseInt(pm10?.["@AirQualityIndex"] || "0");

      if (no2idx === 0 && pm25idx === 0 && pm10idx === 0) continue;

      const maxIdx = Math.max(no2idx, pm25idx, pm10idx);
      let rating;
      if (maxIdx <= 3) rating = "Good";
      else if (maxIdx <= 6) rating = "Moderate";
      else if (maxIdx <= 9) rating = "High";
      else rating = "Very High";

      // Convert index to approximate µg/m³
      const no2ugm3 = no2idx > 0 ? `${no2idx * 20}–${no2idx * 20 + 19} µg/m³` : "No data";
      const pm25ugm3 = pm25idx > 0 ? `${pm25idx * 3}–${pm25idx * 3 + 2} µg/m³` : "No data";

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
