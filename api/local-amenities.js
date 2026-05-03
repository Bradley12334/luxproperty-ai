// api/local-amenities.js — Vercel serverless function
// Fetches nearby shops, cafes, parks, GP surgeries via Overpass API (OpenStreetMap)

function distMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default async function handler(req, res) {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  const latF = parseFloat(lat);
  const lngF = parseFloat(lng);

  const query = `
[out:json][timeout:20];
(
  node["shop"~"supermarket|convenience|greengrocer|bakery|butcher|deli|health_food|department_store"](around:1200,${latF},${lngF});
  node["amenity"~"cafe|restaurant|fast_food"](around:700,${latF},${lngF});
  node["amenity"~"doctors|pharmacy|hospital|clinic"](around:1200,${latF},${lngF});
  way["leisure"="park"]["name"](around:1500,${latF},${lngF});
  relation["leisure"="park"]["name"](around:1500,${latF},${lngF});
);
out body center 80;
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

    const supermarkets = [];
    const cafesAndRestaurants = [];
    const health = [];
    const greenSpaces = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name;
      if (!name) continue;

      // Get lat/lng (nodes have it directly, ways/relations have center)
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) continue;

      const dist = distMetres(latF, lngF, elLat, elLng);
      const shopType = tags.shop;
      const amenity = tags.amenity;
      const leisure = tags.leisure;

      if (shopType && ["supermarket", "convenience", "greengrocer", "bakery", "butcher", "deli", "health_food", "department_store"].includes(shopType)) {
        const typeLabel = shopType === "supermarket" ? "Supermarket" :
          shopType === "convenience" ? "Convenience store" :
          shopType === "bakery" ? "Bakery" :
          shopType === "butcher" ? "Butcher" :
          shopType === "deli" ? "Deli" :
          shopType === "health_food" ? "Health food" : "Shop";
        if (supermarkets.length < 8) supermarkets.push({ name, type: typeLabel, distanceMetres: dist });
      } else if (amenity && ["cafe", "restaurant", "fast_food"].includes(amenity)) {
        const typeLabel = amenity === "cafe" ? "Café" : amenity === "restaurant" ? "Restaurant" : "Food";
        if (cafesAndRestaurants.length < 8) cafesAndRestaurants.push({ name, type: typeLabel, distanceMetres: dist });
      } else if (amenity && ["doctors", "pharmacy", "hospital", "clinic"].includes(amenity)) {
        const typeLabel = amenity === "doctors" ? "GP Surgery" :
          amenity === "pharmacy" ? "Pharmacy" :
          amenity === "hospital" ? "Hospital" : "Clinic";
        if (health.length < 6) health.push({ name, type: typeLabel, distanceMetres: dist });
      } else if (leisure === "park") {
        const walkMins = Math.ceil(dist / 80);
        if (greenSpaces.length < 6) greenSpaces.push({ name, distanceMetres: dist, walkMins });
      }
    }

    // Sort all by distance
    const sortDist = (a, b) => a.distanceMetres - b.distanceMetres;
    supermarkets.sort(sortDist);
    cafesAndRestaurants.sort(sortDist);
    health.sort(sortDist);
    greenSpaces.sort(sortDist);

    return res.status(200).json({
      supermarkets: supermarkets.slice(0, 5),
      cafesAndRestaurants: cafesAndRestaurants.slice(0, 6),
      health: health.slice(0, 4),
      greenSpaces: greenSpaces.slice(0, 4),
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch amenities", detail: err.message });
  }
}
