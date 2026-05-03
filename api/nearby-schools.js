// api/nearby-schools.js — Vercel serverless function
// Fetches nearby schools via Overpass (OpenStreetMap) + GIAS Ofsted ratings

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

// Map GIAS ofstedRating numeric codes to text
function mapGiasOfsted(code) {
  const map = { "1": "Outstanding", "2": "Good", "3": "Requires Improvement", "4": "Inadequate" };
  return map[String(code)] || null;
}

// Attempt to get Ofsted rating from GIAS for a school name
async function getOfstedRating(schoolName) {
  try {
    // GIAS search by name
    const q = encodeURIComponent(schoolName.slice(0, 40));
    const res = await fetch(
      `https://api.get-information-schools.service.gov.uk/api/v1/establishments?Name=${q}&StatusCode=1&pageSize=5`,
      { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const establishments = json?.Establishments || json?.Data || json?.establishments || [];
    if (!Array.isArray(establishments) || establishments.length === 0) return null;

    // Find best name match
    const nameLower = schoolName.toLowerCase().trim();
    let best = null;
    let bestScore = 0;
    for (const est of establishments) {
      const estName = (est.Name || est.EstablishmentName || "").toLowerCase().trim();
      // Simple overlap scoring
      const overlap = estName.split(" ").filter(w => nameLower.includes(w) && w.length > 3).length;
      if (overlap > bestScore) {
        bestScore = overlap;
        best = est;
      }
    }

    if (!best || bestScore === 0) return null;

    // Get Ofsted rating
    const ofstedCode = best.OfstedRating?.Code || best.Ofsted || best.OfstedRatingName;
    if (!ofstedCode) return null;

    // If it's already text
    if (typeof ofstedCode === "string" && isNaN(parseInt(ofstedCode))) {
      const valid = ["Outstanding", "Good", "Requires Improvement", "Inadequate"];
      if (valid.includes(ofstedCode)) return ofstedCode;
      return null;
    }

    return mapGiasOfsted(ofstedCode);
  } catch {
    return null;
  }
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

      // Prefer OSM ofsted tag, then try GIAS
      let ofstedRating = tags["ofsted:rating"] || null;
      schools.push({ name, type, ofstedRating, distanceMetres: dist, walkMins, lat: elLat, lng: elLng, _rawName: name });
    }

    schools.sort((a, b) => a.distanceMetres - b.distanceMetres);
    const top8 = schools.slice(0, 8);

    // Attempt GIAS Ofsted lookup for schools that don't have it yet (closest 4 only to avoid timeout)
    const giasResults = await Promise.allSettled(
      top8.slice(0, 4).map((s) =>
        s.ofstedRating ? Promise.resolve(null) : getOfstedRating(s._rawName)
      )
    );

    top8.slice(0, 4).forEach((s, i) => {
      if (!s.ofstedRating) {
        const result = giasResults[i];
        s.ofstedRating = (result.status === "fulfilled" && result.value) ? result.value : "Not rated by Ofsted";
      }
    });

    // Defaults for the rest
    top8.slice(4).forEach((s) => {
      if (!s.ofstedRating) s.ofstedRating = "Not rated by Ofsted";
    });

    const output = top8.map(({ _rawName, lat, lng, ...rest }) => ({ ...rest, lat, lng }));
    return res.status(200).json({ schools: output });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch schools", detail: err.message });
  }
}
