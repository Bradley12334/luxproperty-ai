// api/epc.js — Vercel serverless function
// Proxies EPC Register API to avoid CORS and keep credentials server-side
// New endpoint: https://get-energy-performance-data.communities.gov.uk (old opendatacommunities.org retired)

export default async function handler(req, res) {
  const { postcode } = req.query;
  if (!postcode) return res.status(400).json({ error: "postcode required" });

  const email = process.env.EPC_EMAIL;
  const apiKey = process.env.EPC_API_KEY;
  if (!email || !apiKey) return res.status(500).json({ error: "EPC credentials not configured" });

  const token = Buffer.from(`${email}:${apiKey}`).toString("base64");
  const clean = postcode.trim().replace(/\s+/g, "");

  try {
    // New endpoint — communities.gov.uk (opendatacommunities.org retired 2024)
    const url = `https://get-energy-performance-data.communities.gov.uk/api/v1/domestic/search?postcode=${encodeURIComponent(clean)}&size=50`;
    const epcRes = await fetch(url, {
      headers: {
        Authorization: `Basic ${token}`,
        Accept: "application/json",
      },
    });

    if (!epcRes.ok) {
      return res.status(epcRes.status).json({ error: "EPC API error", status: epcRes.status });
    }

    const data = await epcRes.json();
    const rows = data.rows || [];

    const ratings = rows.map(r => r["current-energy-rating"]).filter(Boolean);
    const efficiencies = rows.map(r => parseFloat(r["current-energy-efficiency"])).filter(n => !isNaN(n));
    const propertyTypes = rows.map(r => r["property-type"]).filter(Boolean);
    const constructionBands = rows.map(r => r["construction-age-band"]).filter(Boolean);

    const ratingCounts = {};
    for (const r of ratings) ratingCounts[r] = (ratingCounts[r] || 0) + 1;

    const mostCommonRating = Object.entries(ratingCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "D";

    const avgEfficiency = efficiencies.length > 0
      ? Math.round(efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length)
      : null;

    const typeCounts = {};
    for (const t of propertyTypes) typeCounts[t] = (typeCounts[t] || 0) + 1;
    const mostCommonType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Flat";

    const eraCounts = {};
    for (const e of constructionBands) eraCounts[e] = (eraCounts[e] || 0) + 1;
    const mostCommonEra = Object.entries(eraCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    const goodRatings = ratings.filter(r => ["A", "B", "C"].includes(r)).length;
    const pctGoodRating = ratings.length > 0 ? Math.round((goodRatings / ratings.length) * 100) : null;

    return res.status(200).json({
      postcode: clean,
      totalRecords: rows.length,
      mostCommonRating,
      avgEfficiencyScore: avgEfficiency,
      pctRatedCOrAbove: pctGoodRating,
      mostCommonPropertyType: mostCommonType,
      mostCommonConstructionEra: mostCommonEra,
      ratingDistribution: ratingCounts,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch EPC data", detail: err.message });
  }
}
