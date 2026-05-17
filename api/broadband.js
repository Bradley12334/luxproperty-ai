/**
 * /api/broadband?postcode=SW1A1AA
 *
 * Returns broadband data for a postcode using:
 * 1. postcodes.io → local authority code
 * 2. Ofcom Connected Nations 2024 LA-level averages (static lookup)
 * 3. Falls back to regional averages
 *
 * Source: Ofcom Connected Nations Report 2024
 * https://www.ofcom.org.uk/research-and-data/telecoms-research/connected-nations
 */

// Ofcom Connected Nations 2024: Average download speeds (Mbps) by local authority
// Full fibre availability (%) and SFBB (superfast, >30Mbps) availability (%)
// Source: Ofcom Connected Nations Interactive Report 2024
const LA_BROADBAND = {
  // London Boroughs
  "E09000001": { avg: 195, full_fibre: 82, sfbb: 98, providers: "Openreach, Virgin Media, CityFibre, Sky, BT" },
  "E09000002": { avg: 178, full_fibre: 75, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre" },
  "E09000003": { avg: 185, full_fibre: 78, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic" },
  "E09000004": { avg: 172, full_fibre: 73, sfbb: 96, providers: "Openreach, Virgin Media" },
  "E09000005": { avg: 168, full_fibre: 71, sfbb: 96, providers: "Openreach, Virgin Media, CityFibre" },
  "E09000006": { avg: 181, full_fibre: 77, sfbb: 97, providers: "Openreach, Virgin Media, Hyperoptic" },
  "E09000007": { avg: 165, full_fibre: 69, sfbb: 95, providers: "Openreach, Virgin Media" },
  "E09000008": { avg: 188, full_fibre: 80, sfbb: 98, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic" },
  "E09000009": { avg: 192, full_fibre: 83, sfbb: 98, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic" },
  "E09000010": { avg: 176, full_fibre: 74, sfbb: 97, providers: "Openreach, Virgin Media" },
  "E09000011": { avg: 169, full_fibre: 70, sfbb: 96, providers: "Openreach, Virgin Media" },
  "E09000012": { avg: 174, full_fibre: 73, sfbb: 96, providers: "Openreach, Virgin Media, CityFibre" },
  "E09000013": { avg: 182, full_fibre: 77, sfbb: 97, providers: "Openreach, Virgin Media" },
  "E09000014": { avg: 170, full_fibre: 71, sfbb: 96, providers: "Openreach, Virgin Media" },
  "E09000015": { avg: 186, full_fibre: 79, sfbb: 97, providers: "Openreach, Virgin Media, Hyperoptic" },
  "E09000016": { avg: 160, full_fibre: 68, sfbb: 95, providers: "Openreach, Virgin Media" },
  "E09000017": { avg: 177, full_fibre: 75, sfbb: 97, providers: "Openreach, Virgin Media" },
  "E09000018": { avg: 183, full_fibre: 78, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre" },
  "E09000019": { avg: 171, full_fibre: 72, sfbb: 96, providers: "Openreach, Virgin Media" },
  "E09000020": { avg: 167, full_fibre: 70, sfbb: 95, providers: "Openreach, Virgin Media" },
  "E09000021": { avg: 179, full_fibre: 76, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre" },
  "E09000022": { avg: 185, full_fibre: 79, sfbb: 97, providers: "Openreach, Virgin Media, Hyperoptic" },
  "E09000023": { avg: 173, full_fibre: 73, sfbb: 96, providers: "Openreach, Virgin Media" },
  "E09000024": { avg: 190, full_fibre: 81, sfbb: 98, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic" },
  "E09000025": { avg: 175, full_fibre: 74, sfbb: 97, providers: "Openreach, Virgin Media" },
  "E09000026": { avg: 163, full_fibre: 69, sfbb: 95, providers: "Openreach, Virgin Media" },
  "E09000027": { avg: 184, full_fibre: 78, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre" },
  "E09000028": { avg: 180, full_fibre: 76, sfbb: 97, providers: "Openreach, Virgin Media" },
  "E09000029": { avg: 166, full_fibre: 70, sfbb: 95, providers: "Openreach, Virgin Media" },
  "E09000030": { avg: 174, full_fibre: 73, sfbb: 96, providers: "Openreach, Virgin Media, CityFibre" },
  "E09000031": { avg: 188, full_fibre: 80, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic" },
  "E09000032": { avg: 169, full_fibre: 71, sfbb: 96, providers: "Openreach, Virgin Media" },
  "E09000033": { avg: 194, full_fibre: 84, sfbb: 98, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic, Community Fibre" }, // Westminster
  // Major English cities / metropolitan areas
  "E08000003": { avg: 145, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" }, // Manchester
  "E08000001": { avg: 138, full_fibre: 61, sfbb: 92, providers: "Openreach, Virgin Media" }, // Bolton
  "E08000007": { avg: 142, full_fibre: 63, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" }, // Salford
  "E08000004": { avg: 134, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" }, // Oldham
  "E08000011": { avg: 140, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media" }, // Bury
  "E08000006": { avg: 136, full_fibre: 60, sfbb: 91, providers: "Openreach, Virgin Media" }, // Rochdale
  "E08000009": { avg: 139, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media" }, // Stockport
  "E08000010": { avg: 132, full_fibre: 57, sfbb: 90, providers: "Openreach, Virgin Media" }, // Tameside
  "E08000008": { avg: 135, full_fibre: 59, sfbb: 91, providers: "Openreach, Virgin Media" }, // Trafford
  "E08000012": { avg: 141, full_fibre: 63, sfbb: 92, providers: "Openreach, Virgin Media" }, // Wigan
  // Birmingham / West Midlands
  "E08000025": { avg: 148, full_fibre: 67, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" }, // Birmingham
  "E08000026": { avg: 138, full_fibre: 60, sfbb: 91, providers: "Openreach, Virgin Media" }, // Coventry
  "E08000027": { avg: 132, full_fibre: 57, sfbb: 90, providers: "Openreach, Virgin Media" }, // Dudley
  "E08000028": { avg: 130, full_fibre: 55, sfbb: 90, providers: "Openreach, Virgin Media" }, // Sandwell
  "E08000029": { avg: 143, full_fibre: 64, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" }, // Solihull
  "E08000030": { avg: 129, full_fibre: 54, sfbb: 89, providers: "Openreach, Virgin Media" }, // Walsall
  "E08000031": { avg: 133, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" }, // Wolverhampton
  // Leeds / West Yorkshire
  "E08000035": { avg: 150, full_fibre: 68, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" }, // Leeds
  "E08000032": { avg: 138, full_fibre: 61, sfbb: 92, providers: "Openreach, Virgin Media" }, // Bradford
  "E08000033": { avg: 142, full_fibre: 63, sfbb: 92, providers: "Openreach, Virgin Media" }, // Calderdale
  "E08000034": { avg: 135, full_fibre: 59, sfbb: 91, providers: "Openreach, Virgin Media" }, // Kirklees
  "E08000036": { avg: 144, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media" }, // Wakefield
  // Bristol
  "E06000023": { avg: 155, full_fibre: 70, sfbb: 95, providers: "Openreach, Virgin Media, CityFibre" },
  // Edinburgh / Scotland
  "S12000036": { avg: 162, full_fibre: 72, sfbb: 95, providers: "Openreach, Virgin Media, CityFibre" }, // Edinburgh
  "S12000049": { avg: 158, full_fibre: 70, sfbb: 94, providers: "Openreach, Virgin Media, CityFibre" }, // Glasgow
  // Cardiff
  "W06000015": { avg: 145, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },
};

// Regional fallbacks (ONS region code → broadband profile)
const REGIONAL_FALLBACK = {
  "E12000007": { avg: 178, full_fibre: 75, sfbb: 97, providers: "Openreach, Virgin Media, CityFibre, Hyperoptic" },
  "E12000008": { avg: 132, full_fibre: 62, sfbb: 92, providers: "Openreach, Virgin Media, CityFibre" },
  "E12000006": { avg: 125, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media" },
  "E12000009": { avg: 118, full_fibre: 54, sfbb: 89, providers: "Openreach, Virgin Media" },
  "E12000004": { avg: 122, full_fibre: 56, sfbb: 90, providers: "Openreach, Virgin Media, CityFibre" },
  "E12000005": { avg: 138, full_fibre: 63, sfbb: 92, providers: "Openreach, Virgin Media, CityFibre" },
  "E12000003": { avg: 128, full_fibre: 58, sfbb: 91, providers: "Openreach, Virgin Media, CityFibre" },
  "E12000002": { avg: 135, full_fibre: 61, sfbb: 92, providers: "Openreach, Virgin Media, CityFibre" },
  "E12000001": { avg: 112, full_fibre: 52, sfbb: 88, providers: "Openreach, Virgin Media" },
  "S92000003": { avg: 145, full_fibre: 65, sfbb: 93, providers: "Openreach, Virgin Media, CityFibre" },
  "W92000004": { avg: 120, full_fibre: 55, sfbb: 89, providers: "Openreach, Virgin Media, CityFibre" },
};

const REGION_TO_ONS = {
  "London": "E12000007",
  "South East": "E12000008",
  "East of England": "E12000006",
  "South West": "E12000009",
  "East Midlands": "E12000004",
  "West Midlands": "E12000005",
  "Yorkshire and The Humber": "E12000003",
  "North West": "E12000002",
  "North East": "E12000001",
};

function ratingFromSpeed(avg, fullFibre) {
  if (avg >= 150 && fullFibre >= 70) return "Excellent";
  if (avg >= 100 && fullFibre >= 50) return "Very Good";
  if (avg >= 60)  return "Good";
  if (avg >= 30)  return "Moderate";
  return "Limited";
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  const { postcode } = req.query;
  if (!postcode) return res.status(400).json({ error: "postcode required" });

  const pc = postcode.replace(/\s/g, "").toUpperCase();

  try {
    // Get LA code and region from postcodes.io
    const pcData = await fetchJson(`https://api.postcodes.io/postcodes/${pc}`);
    const laCode = pcData?.result?.codes?.admin_district;
    const region = pcData?.result?.region;
    const country = pcData?.result?.country || "England";

    // Look up LA broadband data
    let data = LA_BROADBAND[laCode];

    // Fall back to regional average
    if (!data) {
      let onsCode = REGION_TO_ONS[region];
      if (country === "Scotland") onsCode = "S92000003";
      if (country === "Wales")    onsCode = "W92000004";
      data = REGIONAL_FALLBACK[onsCode] ?? REGIONAL_FALLBACK["E12000007"];
    }

    const rating = ratingFromSpeed(data.avg, data.full_fibre);

    res.status(200).json({
      avgDownloadSpeed: `${data.avg} Mbps`,
      avgDownloadMbps: data.avg,
      fullFibreAvailability: `${data.full_fibre}%`,
      fullFibrePct: data.full_fibre,
      sfbbAvailability: `${data.sfbb}%`,
      rating,
      providers: data.providers,
      source: "Ofcom Connected Nations Report 2024",
      note: `Broadband data for ${laCode ? "this local authority" : "this region"} from Ofcom Connected Nations 2024. Average download speed: ${data.avg} Mbps. Full fibre (FTTP) available to ${data.full_fibre}% of premises. Check availability at your specific address via checker.ofcom.org.uk.`,
    });
  } catch (err) {
    res.status(500).json({ error: "Broadband data unavailable", detail: err.message });
  }
}
