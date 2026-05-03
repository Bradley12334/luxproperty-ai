// api/tfl-commute.js — Vercel serverless function
// Returns journey times from a postcode to key London destinations via TfL

const DESTINATIONS = [
  { name: "City of London (EC2)", lat: 51.5155, lng: -0.0922 },
  { name: "Canary Wharf", lat: 51.5054, lng: -0.0235 },
  { name: "West End (W1)", lat: 51.5136, lng: -0.1386 },
  { name: "London Bridge", lat: 51.5052, lng: -0.0864 },
];

async function getJourneyTime(fromLat, fromLng, toLat, toLng) {
  try {
    const url = `https://api.tfl.gov.uk/Journey/JourneyResults/${fromLat},${fromLng}/to/${toLat},${toLng}?mode=tube,elizabeth-line,overground,bus,walking&nationalSearch=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const journeys = data?.journeys || [];
    if (journeys.length === 0) return null;
    // Return fastest journey
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

export default async function handler(req, res) {
  const { lat, lng, outcode } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  const fromLat = parseFloat(lat);
  const fromLng = parseFloat(lng);

  const results = await Promise.all(
    DESTINATIONS.map(async (dest) => {
      const journey = await getJourneyTime(fromLat, fromLng, dest.lat, dest.lng);
      return {
        destination: dest.name,
        durationMins: journey?.duration ?? null,
        modes: journey?.modes ?? [],
      };
    })
  );

  // Filter out nulls and sort by duration
  const valid = results.filter(r => r.durationMins !== null).sort((a, b) => a.durationMins - b.durationMins);

  if (valid.length === 0) return res.status(200).json({ error: "No TfL journey data available", results: [] });

  return res.status(200).json({ results: valid });
}
