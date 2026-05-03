// api/nearby-schools.js — Vercel serverless function
// Fetches nearby schools via Overpass (OpenStreetMap) + maps type to plain English

function distMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function classifySchoolType(tags) {
  const type = (tags["school:type"] || tags["operator:type"] || "").toLowerCase();
  const name = (tags.name || "").toLowerCase();
  const isced = tags["isced:level"] || "";

  if (type.includes("independent") || type.includes("private")) return "Independent";
  if (type.includes("community") || type.includes("voluntary")) {
    if (isced.includes("1") || name.includes("primary") || name.includes("junior") || name.includes("infant")) return "Primary";
    if (isced.includes("2") || isced.includes("3") || name.includes("secondary") || name.includes("college") || name.includes("academy") || name.includes("high school")) return "Secondary";
    return "State";
  }
  if (name.includes("primary") || name.includes("junior") || name.includes("infant") || name.includes("prep")) return "Primary";
  if (name.includes("secondary") || name.includes("academy") || name.includes("high") || name.includes("college") || name.includes("sixth form")) return "Secondary";
  if (name.includes("nursery") || name.includes("montessori")) return "Nursery";
  if (type.includes("special")) return "Special";
  return "School";
}

export default async function handler(req, res) {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  const latF = parseFloat(lat);
  const lngF = parseFloat(lng);

  const query = `
[out:json][timeout:15];
(
  node["amenity"="school"](around:1500,${latF},${lngF});
  way["amenity"="school"](around:1500,${latF},${lngF});
  node["amenity"="kindergarten"](around:1000,${latF},${lngF});
  way["amenity"="kindergarten"](around:1000,${latF},${lngF});
);
out body center 25;
  `.trim();

  try {
    const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!overpassRes.ok) return res.status(502).json({ error: "Overpass API unavailable" });
    const data = await overpassRes.json();
    const elements = data.elements || [];

    const schools = [];
    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name;
      if (!name) continue;

      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) continue;

      const dist = distMetres(latF, lngF, elLat, elLng);
      const type = tags.amenity === "kindergarten" ? "Nursery" : classifySchoolType(tags);
      const walkMins = Math.ceil(dist / 80);

      // Ofsted rating — OSM rarely has this, so we use "Not yet rated" as default
      // Real Ofsted data would need GIAS API with URN lookup (complex)
      const ofstedRating = tags["ofsted:rating"] || "Not rated by Ofsted";

      schools.push({ name, type, ofstedRating, distanceMetres: dist, walkMins });
    }

    schools.sort((a, b) => a.distanceMetres - b.distanceMetres);

    return res.status(200).json({ schools: schools.slice(0, 8) });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch schools", detail: err.message });
  }
}
