// api/nearby-stations.js — Vercel serverless function
// Fetches nearby train/tube/bus stations via Overpass API (works UK-wide)
// Falls back gracefully to empty array on error

function distMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function classifyStation(tags) {
  const railway = tags.railway || "";
  const subway = tags.subway || "";
  const network = (tags.network || "").toLowerCase();
  const name = (tags.name || "").toLowerCase();

  const modes = [];
  if (railway === "station") {
    if (network.includes("london underground") || network.includes("tfl") || subway === "yes") {
      modes.push("tube");
    } else if (network.includes("elizabeth") || name.includes("crossrail")) {
      modes.push("elizabeth-line");
    } else if (network.includes("overground") || network.includes("london overground")) {
      modes.push("overground");
    } else if (network.includes("dlr")) {
      modes.push("dlr");
    } else {
      modes.push("national-rail");
    }
  } else if (railway === "halt") {
    modes.push("national-rail");
  } else if (railway === "tram_stop" || tags.tram === "yes") {
    modes.push("tram");
  } else if (tags.amenity === "bus_station") {
    modes.push("bus");
  }

  return modes;
}

export default async function handler(req, res) {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  const latF = parseFloat(lat);
  const lngF = parseFloat(lng);

  const query = `
[out:json][timeout:15];
(
  node["railway"~"station|halt"](around:1500,${latF},${lngF});
  node["railway"="tram_stop"](around:1000,${latF},${lngF});
  node["amenity"="bus_station"](around:800,${latF},${lngF});
);
out body 30;
  `.trim();

  try {
    const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!overpassRes.ok) return res.status(502).json({ error: "Overpass unavailable" });
    const data = await overpassRes.json();
    const elements = data.elements || [];

    const stations = [];
    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags["name:en"];
      if (!name) continue;

      const elLat = el.lat;
      const elLng = el.lon;
      if (!elLat || !elLng) continue;

      const dist = distMetres(latF, lngF, elLat, elLng);
      const modes = classifyStation(tags);
      if (modes.length === 0) continue;

      // Extract line info from operator/network/ref tags
      const lineRefs = [
        tags["network"] || "",
        tags["operator"] || "",
        tags["route_ref"] || "",
        tags["ref"] || "",
      ].filter(Boolean);

      const lines = lineRefs
        .flatMap(r => r.split(/[;,]/))
        .map(r => r.trim())
        .filter(r => r.length > 1 && r.length < 40)
        .slice(0, 4);

      stations.push({
        name: name.replace(/ (Railway )?Station$/, " Station"),
        lines,
        modes,
        distanceMetres: dist,
        walkMins: Math.ceil(dist / 80),
        lat: elLat,
        lng: elLng,
      });
    }

    // Deduplicate by name (keep closest)
    const seen = new Map();
    for (const s of stations) {
      const key = s.name.toLowerCase();
      if (!seen.has(key) || seen.get(key).distanceMetres > s.distanceMetres) {
        seen.set(key, s);
      }
    }

    const deduped = [...seen.values()].sort((a, b) => a.distanceMetres - b.distanceMetres);
    return res.status(200).json({ stations: deduped.slice(0, 8) });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch stations", detail: err.message });
  }
}
