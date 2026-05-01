import type { BriefReport, AreaIntelligence, PropertyDeepDive } from "../../../shared/schema";

let briefIdCounter = 1;
const briefStore: Record<number, BriefReport> = {};

function detectQueryType(query: string): "postcode" | "address" {
  const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  const partialPostcode = /^[A-Z]{1,2}\d[A-Z\d]?$/i;
  const trimmed = query.trim();
  if (postcodePattern.test(trimmed) || partialPostcode.test(trimmed)) return "postcode";
  return "address";
}

function extractPostcode(address: string): string | null {
  const match = address.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i);
  return match ? match[1].trim().toUpperCase() : null;
}

function getOutcode(postcode: string): string {
  return postcode.trim().toUpperCase().split(" ")[0].replace(/\d[A-Z]{2}$/, "").trim();
}

function fmt(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  } catch { return dateStr; }
}

// ─── District name fixes ──────────────────────────────────────────────────────
// Postcodes.io sometimes returns district names that don't match Land Registry
const districtNormalise: Record<string, string> = {
  "WESTMINSTER":                   "CITY OF WESTMINSTER",
  "BRISTOL, CITY OF":              "BRISTOL",
  "KINGSTON UPON HULL, CITY OF":   "KINGSTON UPON HULL",
  "HEREFORDSHIRE, COUNTY OF":      "HEREFORDSHIRE",
  "DURHAM":                        "COUNTY DURHAM",
};

// Manual overrides where one outcode spans multiple boroughs
const outcodeDistrictOverride: Record<string, string> = {
  "NW3": "CAMDEN", "NW1": "CAMDEN", "NW5": "CAMDEN", "NW6": "CAMDEN",
  "NW8": "CITY OF WESTMINSTER",
  "SW1": "CITY OF WESTMINSTER",
  "W1":  "CITY OF WESTMINSTER",
  "WC1": "CAMDEN", "WC2": "CITY OF WESTMINSTER",
  "EC1": "ISLINGTON", "EC2": "CITY OF LONDON", "EC3": "CITY OF LONDON", "EC4": "CITY OF LONDON",
};

// Land Registry only covers England & Wales — these prefixes are Scotland or NI
const nonEnglandWalesPrefixes = ["EH","G","AB","DD","KY","FK","PH","HS","IV","KA","KW","ML","PA","TD","ZE","BT"];
function isOutsideEnglandWales(outcode: string): boolean {
  return nonEnglandWalesPrefixes.some(p => outcode.startsWith(p));
}

// ─── Caches ───────────────────────────────────────────────────────────────────
const outcodeDistrictCache: Record<string, string> = {};
const outcodeMetaCache: Record<string, any> = {};

// ─── Postcodes.io: get district name ─────────────────────────────────────────
async function getDistrict(postcode: string): Promise<string> {
  const outcode = getOutcode(postcode);
  if (outcodeDistrictCache[outcode]) return outcodeDistrictCache[outcode];
  if (outcodeDistrictOverride[outcode]) {
    outcodeDistrictCache[outcode] = outcodeDistrictOverride[outcode];
    return outcodeDistrictOverride[outcode];
  }
  try {
    const res = await fetch(`https://api.postcodes.io/outcodes/${outcode}`);
    if (res.ok) {
      const d = await res.json();
      const districts: string[] = d?.result?.admin_district || [];
      if (districts.length > 0) {
        let district = districts[0].toUpperCase();
        district = districtNormalise[district] || district;
        outcodeDistrictCache[outcode] = district;
        return district;
      }
    }
  } catch {}
  return "";
}

// ─── Postcodes.io: get full metadata ─────────────────────────────────────────
async function fetchPostcodeMeta(postcode: string): Promise<{
  area: string; district: string; region: string;
  constituency: string; ward: string; country: string;
  lat?: number; lng?: number;
} | null> {
  const outcode = getOutcode(postcode);
  if (outcodeMetaCache[outcode]) return outcodeMetaCache[outcode];
  try {
    const clean = postcode.trim().replace(/\s+/g, "");
    const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);
    if (res.ok) {
      const d = await res.json();
      const result = {
        area: d.result?.outcode || outcode,
        district: d.result?.admin_district || "",
        region: d.result?.region || "England",
        constituency: d.result?.parliamentary_constituency || "",
        ward: d.result?.admin_ward || "",
        country: d.result?.country || "England",
        lat: d.result?.latitude ?? undefined,
        lng: d.result?.longitude ?? undefined,
      };
      outcodeMetaCache[outcode] = result;
      return result;
    }
    // Fall back to outcode lookup
    const res2 = await fetch(`https://api.postcodes.io/outcodes/${outcode}`);
    if (res2.ok) {
      const d = await res2.json();
      const result = {
        area: outcode,
        district: (d.result?.admin_district || [])[0] || "",
        region: (d.result?.admin_county || [])[0] || (d.result?.country || [])[0] || "England",
        constituency: (d.result?.parliamentary_constituency || [])[0] || "",
        ward: (d.result?.admin_ward || [])[0] || "",
        country: (d.result?.country || [])[0] || "England",
        lat: d.result?.latitude ?? undefined,
        lng: d.result?.longitude ?? undefined,
      };
      outcodeMetaCache[outcode] = result;
      return result;
    }
  } catch {}
  return null;
}

// ─── Land Registry: prices for a district + year ─────────────────────────────
async function fetchLandRegistryYear(district: string, year: number): Promise<number[]> {
  if (!district) return [];
  try {
    const url = `https://landregistry.data.gov.uk/data/ppi/transaction-record.json?_pageSize=100&propertyAddress.district=${encodeURIComponent(district)}&min-transactionDate=${year}-01-01&max-transactionDate=${year}-12-31&_sort=-transactionDate`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.result?.items || [];
    return items.map((item: any) => item.pricePaid as number).filter((p: number) => p > 0);
  } catch { return []; }
}

// ─── Land Registry: recent transactions for comparables ──────────────────────
async function fetchRecentTransactions(district: string, outcode: string): Promise<Array<{
  address: string; price: number; date: string; type: string;
}>> {
  if (!district) return [];
  try {
    const url = `https://landregistry.data.gov.uk/data/ppi/transaction-record.json?_pageSize=50&propertyAddress.district=${encodeURIComponent(district)}&_sort=-transactionDate`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.result?.items || [];

    const filtered = items.filter((item: any) =>
      (item?.propertyAddress?.postcode || "").startsWith(outcode)
    );
    const used = filtered.length >= 3 ? filtered : items;

    return used.slice(0, 6).map((item: any) => {
      const addr = item.propertyAddress || {};
      const parts = [addr.saon, addr.paon, addr.street, addr.town].filter(Boolean);
      const propType = item.propertyType?.prefLabel?.[0]?._value || "Property";
      return {
        address: parts.join(", ") || "Address withheld",
        price: item.pricePaid,
        date: item.transactionDate || "",
        type: propType.charAt(0).toUpperCase() + propType.slice(1).toLowerCase(),
      };
    });
  } catch { return []; }
}

// ─── Median helper ────────────────────────────────────────────────────────────
function median(prices: number[]): number {
  if (prices.length < 5) return 0; // need at least 5 for reliability
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateBrief(query: string): Promise<BriefReport> {
  const queryType = detectQueryType(query);
  const postcode = queryType === "address"
    ? (extractPostcode(query) || query)
    : query.trim().toUpperCase();
  const outcode = getOutcode(postcode);

  // Scotland / NI — Land Registry doesn't cover these
  const outsideEnglandWales = isOutsideEnglandWales(outcode);

  // Fetch metadata + district in parallel
  const [meta, district] = await Promise.all([
    fetchPostcodeMeta(postcode),
    getDistrict(postcode),
  ]);

  const areaName = meta?.district || district || outcode;
  const region = meta?.region || "England";
  const ward = meta?.ward || "";
  const constituency = meta?.constituency || "";
  const country = meta?.country || "England";

  // If Scotland/NI, skip Land Registry
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear];

  let yearData: number[][] = [[], [], [], [], []];
  let recentTxns: Array<{ address: string; price: number; date: string; type: string }> = [];

  if (!outsideEnglandWales && district) {
    [yearData[0], yearData[1], yearData[2], yearData[3], yearData[4], recentTxns] =
      await Promise.all([
        fetchLandRegistryYear(district, years[0]),
        fetchLandRegistryYear(district, years[1]),
        fetchLandRegistryYear(district, years[2]),
        fetchLandRegistryYear(district, years[3]),
        fetchLandRegistryYear(district, years[4]),
        fetchRecentTransactions(district, outcode),
      ]) as any;
  }

  const yearMedians = yearData.map(median);
  const latestMedian = [...yearMedians].reverse().find(p => p > 0) || 0;
  const prevMedian = yearMedians.filter(p => p > 0).slice(-2)[0] || 0;
  const hasData = latestMedian > 0;

  // YoY change
  const yoyChange = latestMedian > 0 && prevMedian > 0
    ? `${((latestMedian - prevMedian) / prevMedian * 100) >= 0 ? "+" : ""}${((latestMedian - prevMedian) / prevMedian * 100).toFixed(1)}%`
    : "—";

  // 5-year trend
  const priceTrend = years.map((year, i) => {
    const med = yearMedians[i];
    let change = "—";
    if (i > 0 && yearMedians[i - 1] > 0 && med > 0) {
      const pct = ((med - yearMedians[i - 1]) / yearMedians[i - 1]) * 100;
      change = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
    }
    return {
      year,
      averagePrice: med > 0 ? fmt(med) : "Insufficient data",
      change,
    };
  });

  // Market tier
  const tier = latestMedian > 1500000 ? "prime"
    : latestMedian > 700000 ? "premium"
    : latestMedian > 350000 ? "mid-market"
    : latestMedian > 0 ? "emerging" : "unknown";

  const totalTxns = yearData.reduce((s, yr) => s + yr.length, 0);
  const avgDaysOnMarket = tier === "prime" ? 54 : tier === "premium" ? 44 : tier === "mid-market" ? 38 : 32;
  const rentalYield = tier === "prime" ? "2.5% – 3.2% gross" : tier === "premium" ? "3.0% – 3.8% gross" : "3.8% – 5.0% gross";
  const growthForecast = yoyChange.startsWith("+") ? "+3.0% – 5.5% p.a. (2026–2029)" : "+1.5% – 3.5% p.a. (2026–2029)";
  const isLondon = country === "England" && !!outcode.match(/^(SW|SE|EC|WC|E[0-9]|N[0-9]|NW|W[0-9]|WC)[0-9]/);
  const transportRating = isLondon ? 9.1 : country === "Wales" ? 7.0 : 7.4;

  // Comparables
  const comparables = recentTxns.slice(0, 4).map(t => ({
    address: t.address,
    price: fmt(t.price),
    date: formatDate(t.date),
    type: t.type,
  }));

  // Scotland/NI message
  const scotlandNote = outsideEnglandWales
    ? `${outcode} is in ${country}. HM Land Registry Price Paid data only covers England and Wales — price trend data is unavailable for this region. The analysis below is based on available postcode metadata.`
    : "";

  // ── Derived analytics ──────────────────────────────────────────────────────
  const firstValidMedian = yearMedians.find(p => p > 0) || 0;
  const fiveYearGrowth = (firstValidMedian > 0 && latestMedian > 0)
    ? `${(((latestMedian - firstValidMedian) / firstValidMedian) * 100).toFixed(1)}%`
    : "—";

  const totalSalesThisYear = yearData[4]?.length || 0;
  const demandSignal = totalSalesThisYear > 40 ? "High" : totalSalesThisYear > 15 ? "Moderate" : "Low";

  const pricePerSqmEstimate = latestMedian > 0
    ? tier === "prime" ? `${fmt(Math.round(latestMedian / 75))} per m²`
    : tier === "premium" ? `${fmt(Math.round(latestMedian / 85))} per m²`
    : `${fmt(Math.round(latestMedian / 95))} per m²`
    : "—";

  const buyerType = tier === "prime"
    ? "Internationally driven — HNW individuals, family offices, and relocating executives"
    : tier === "premium"
    ? "Professional buyers — equity-rich upsizers and buy-to-let investors"
    : tier === "mid-market"
    ? "Owner-occupiers and first-time buyers, with growing investor interest"
    : "First-time buyers, housing association, and value investors";

  const marketMomentum = yoyChange.startsWith("+")
    ? `Upward — ${yoyChange} YoY with ${demandSignal.toLowerCase()} recorded transaction volume`
    : yoyChange === "—"
    ? "Insufficient data to determine current momentum"
    : `Softening — ${yoyChange} YoY. Buyer leverage is above average in this cycle`;

  const schoolsRating = isLondon ? 8.4 : region.includes("South East") ? 8.1 : 7.8;
  const safetyRating  = tier === "prime" ? 8.9 : tier === "premium" ? 8.3 : 7.7;
  const walkability   = isLondon ? 9.1 : region.includes("South") ? 7.6 : 7.1;

  // ── Rich neighbourhood descriptions ───────────────────────────────────────
  const isWales = country === "Wales";
  const isMidlands = region.includes("Midlands");
  const isNorth = region.includes("North") || region.includes("Yorkshire") || region.includes("Humber");
  const isSouthEast = region.includes("South East");
  const isSouthWest = region.includes("South West");
  const isEastEngland = region.includes("East");

  const characterMap: Record<string, string> = {
    prime: `${areaName} has an unmistakable sense of prestige. Streets are lined with period architecture, independent boutiques, and art galleries. The pace is unhurried — this is a neighbourhood where residents invest in quality of life as much as property. Expect a strong sense of community among long-term residents and a quietly international flavour.`,
    premium: `${areaName} sits in a comfortable sweet spot between accessibility and aspiration. The area attracts professionals and families who want the feel of an established neighbourhood without prime-zone price tags. A mix of period conversions and newer builds creates a varied streetscape, with a distinctly residential character beyond the main high street.`,
    "mid-market": `${areaName} is a practical, well-connected area with a genuine community feel. It draws a broad mix of residents — first-time buyers, young families, and long-term locals — giving it an unpretentious energy. Regeneration activity in recent years has brought new cafes, co-working spaces, and independent shops alongside existing amenities.`,
    emerging: `${areaName} is in a period of visible transition. Pockets of regeneration sit alongside original residential streets, and independent businesses are beginning to establish themselves. Early buyers here are typically drawn by value relative to surrounding areas and the upside potential that comes with neighbourhood evolution.`,
    unknown: `${areaName} has an established residential character. The area offers a stable community environment with convenient access to local amenities and transport connections.`,
  };

  const amenitiesMap: Record<string, string> = {
    prime: `Supermarkets include Waitrose and M&S Food. The high street features independent delicatessens, wine merchants, and award-winning restaurants. Specialist food markets, artisan bakeries, and premium gym studios are well represented. Healthcare is served by private clinics and GP surgeries with short wait times.`,
    premium: `A strong mix of high-street staples and independents. Supermarkets (typically Sainsbury's or Tesco), plus a growing selection of independent cafes and restaurants. Leisure options include gyms, yoga studios, and a local cinema or arts centre. Retail parks within easy driving distance for larger shops.`,
    "mid-market": `Day-to-day amenities are well covered — supermarkets, pharmacies, post offices, and takeaways are all within walking distance. The high street has a mix of national chains and independent businesses. A local market (weekly or monthly) typically operates nearby. Leisure centres and community facilities are readily available.`,
    emerging: `Core amenities are in place — convenience stores, takeaways, and pharmacies are close by. The neighbourhood is seeing new hospitality openings as the area gentrifies. Larger retail and leisure options are available via public transport or a short drive.`,
    unknown: `Standard residential amenities are accessible. Local shops, supermarkets, and community services are within reasonable distance, with more extensive retail available in the nearest town centre.`,
  };

  const greenSpaceMap: Record<string, string> = {
    prime: isLondon
      ? `Access to premium green space is excellent. Royal Parks, private gardens, and well-maintained public parks are within walking distance. Many properties on garden squares or adjacent to communal private gardens.`
      : `${areaName} benefits from mature parkland, countryside access, and well-kept public gardens. The green infrastructure is a key quality-of-life asset for residents.`,
    premium: isLondon
      ? `Good park provision within the borough. Local recreation grounds, lido facilities, and riverside or canal paths in many parts of the area.`
      : `Parks and recreation grounds are well distributed. Countryside is accessible by car or public transport, making the area popular with dog owners and families.`,
    "mid-market": `Local parks and recreation grounds provide green relief. Playing fields and allotment sites are common. ${isNorth || isMidlands ? "The surrounding countryside is easily accessible from the area" : "Weekend green space is typically a short bus or drive away"}.`,
    emerging: `Green space provision is adequate with local parks and open land nearby. ${isSouthWest || isSouthEast ? "Proximity to countryside and coastal areas is a major draw for buyers" : "Larger parks are a short distance away by public transport"}.`,
    unknown: `Local green space is available in the area, including parks and recreation grounds.`,
  };

  const transportDescMap: Record<string, string> = {
    prime: isLondon
      ? `Exceptional connectivity. Multiple Underground lines (including at least one Zone 1–2 station), bus routes, and Overground access. Journey times to central London are typically under 20 minutes. Cycle infrastructure is well maintained.`
      : `${areaName} is served by a mainline rail station with frequent services to major cities. Road connections via the M-road network are strong. Airports are within 45–90 minutes.`,
    premium: isLondon
      ? `Strong transport links. Underground, Overground, or Elizabeth line access within 0.5 miles. Multiple bus routes. Typical central London journey time: 20–35 minutes. Good cycling infrastructure.`
      : `Regular rail services to regional centres and London. Road connections are good, with easy motorway access. Buses serve local routes, though a car remains useful for suburban journeys.`,
    "mid-market": isLondon
      ? `Reliable public transport. Bus and Overground connections to central zones. Underground access may require one interchange. Journey time to central London: 30–45 minutes. Bike lanes are improving.`
      : `${areaName} has bus connections to the nearest town centre and rail station. Driving is the primary mode for many residents. Commuter rail services are available ${region.includes("South East") ? "with direct services into London" : "to regional employment hubs"}.`,
    emerging: isLondon
      ? `Bus-dependent area with improving connectivity. Overground or Underground access is within 0.75–1 mile. TfL investment in the area is ongoing. Car ownership common among residents.`
      : `Bus services connect the area to local centres. A car is recommended for most residents. Rail access is available at the nearest town station.`,
    unknown: `Public transport connects the area to local town centres and rail stations. A car is useful for wider connectivity.`,
  };

  const schoolsDescMap: Record<string, string> = {
    prime: `School provision is a significant draw. Several Outstanding-rated primaries and secondaries are within the catchment, including both state and independent options. Independent school fees in the area range from £15,000–£25,000+ per year. Competition for catchment places is high — verify current boundaries before purchasing.`,
    premium: `A mix of Good and Outstanding-rated state schools serves the area, with independent alternatives available locally. Catchment boundaries are competitive for the most sought-after schools. Several well-regarded grammar schools operate ${isSouthEast ? "across the county" : "in the wider region"}.`,
    "mid-market": `State schooling is rated Good by Ofsted in most local schools, with some Outstanding primaries. A local secondary school serves most of the catchment. Independent options are available within a short drive. Free school or academy choices have expanded provision in recent years.`,
    emerging: `State schools in the area are rated Requires Improvement to Good. The local authority has invested in improvement plans. Families with specific school requirements should verify current Ofsted ratings and catchment boundaries independently at ofsted.gov.uk.`,
    unknown: `State schools serve the local area. Check current Ofsted ratings and catchment boundaries at ofsted.gov.uk before purchasing.`,
  };

  const demographicsMap: Record<string, string> = {
    prime: `Predominantly affluent professionals, senior executives, established families, and retirees with significant assets. A notable international contingent, particularly from Europe, North America, and the Middle East. Long average tenure — residents tend to stay for decades. Strong owner-occupier ratio.`,
    premium: `Professional couples and families aged 30–55 make up the core demographic. High proportion of homeowners with equity to spend. A growing cohort of remote-working buyers drawn by space and connectivity. Limited transient population — the area has a settled, community-minded character.`,
    "mid-market": `A genuinely mixed demographic — young professionals, families with school-age children, established locals, and buy-to-let investors attracted by rental yields. Average household income is near the national median. Active local community groups and residents' associations.`,
    emerging: `A shifting demographic as younger buyers and renters move in alongside long-term residents. Creative professionals, first-time buyers, and students often lead gentrification. Rental demand is high, supporting investor interest. Expect the demographic profile to continue evolving over the next 5–10 years.`,
    unknown: `The area has an established residential population with a mix of owner-occupiers and renters.`,
  };

  const nightlifeMap: Record<string, string> = {
    prime: `The evening offer is sophisticated rather than loud — Michelin-starred and well-reviewed restaurants, wine bars, private members' clubs, and boutique hotels dominate. The area is animated but not rowdy, attracting residents who value quality over volume.`,
    premium: `A solid dining and bar scene anchored by independent restaurants and gastropubs. Cocktail bars and wine bars are well represented. The area quietens after 11pm — it skews more dinner-and-theatre than late-night club.`,
    "mid-market": `A mix of chain pubs, independent bars, and takeaway options. The high street comes alive on Friday and Saturday evenings. A local cinema, bowling alley, or live music venue is often within reach. Family-friendly dining options are well served.`,
    emerging: `A growing independent bar and cafe culture, with new openings arriving as the area gentrifies. Some legacy pubs remain alongside newer arrivals. The nighttime economy is evolving — expect more choice within 3–5 years.`,
    unknown: `Local pubs and restaurants provide an evening out. More extensive entertainment options are available in the nearest town centre.`,
  };

  const marketCommentMap: Record<string, string> = {
    prime: `Buyers here are typically competing for a finite pool of properties — supply is structurally limited. Off-market transactions are common; cultivate relationships with local agents and solicitors to access them. Chain-free purchases and cash buyers move significantly faster in this market. Do not expect significant discounts — pricing is resilient.`,
    premium: `${areaName} rewards preparation. The best properties go quickly — often within two weeks of listing. Get a mortgage agreement in principle before viewing. Survey findings (particularly on older stock) can legitimately support a revised offer. Freehold houses outperform leasehold flats in this market over a 10-year horizon.`,
    "mid-market": `${areaName} is a buyer's market in relative terms — properties at the right price sell in 4–8 weeks. Overpriced stock sits for 60+ days, which is your negotiating window. Focus on properties needing cosmetic work rather than structural issues. The rental market is active, making the area viable for buy-to-let alongside owner-occupation.`,
    emerging: `This is a speculative-to-value play. The upside is real but the timeline is uncertain — plan for a 5–10 year hold. Focus on streets closest to regeneration activity and transport links. Avoid leasehold where the ground rent and service charge can erode yield. New-build discount on resale typically 10–15% — factor this in.`,
    unknown: `Research comparable sold prices via Rightmove and Zoopla before making an offer. Instruct a RICS-accredited surveyor before exchange.`,
  };

  const neighCharacter   = characterMap[tier] || characterMap["unknown"];
  const neighAmenities   = amenitiesMap[tier] || amenitiesMap["unknown"];
  const neighGreenSpace  = greenSpaceMap[tier] || greenSpaceMap["unknown"];
  const neighTransport   = transportDescMap[tier] || transportDescMap["unknown"];
  const neighSchools     = schoolsDescMap[tier] || schoolsDescMap["unknown"];
  const neighDemographics = demographicsMap[tier] || demographicsMap["unknown"];
  const neighNightlife   = nightlifeMap[tier] || nightlifeMap["unknown"];
  const neighMarketComment = marketCommentMap[tier] || marketCommentMap["unknown"];

  const sdltEstimate = latestMedian > 500000
    ? fmt((latestMedian - 500000) * 0.1 + 500000 * 0.05)
    : fmt(latestMedian * 0.05);
  const stampDutyNote = `Estimated SDLT on ${fmt(latestMedian)} median: ~${sdltEstimate} for primary residence`;

  const areaIntelligence: AreaIntelligence = {
    location: outcode,
    area: areaName,
    executiveSummary: outsideEnglandWales
      ? scotlandNote
      : hasData
        ? `${areaName} (${outcode}) is classified as a ${tier} residential market. Median transaction value stands at ${fmt(latestMedian)}, based on ${totalTxns} Land Registry records across five years. The 5-year price trajectory is ${fiveYearGrowth !== "—" ? `+${fiveYearGrowth}` : "—"}, with year-on-year movement of ${yoyChange}. ${ward ? `Ward: ${ward}.` : ""} ${constituency ? `Parliamentary constituency: ${constituency}.` : ""} Demand is currently ${demandSignal.toLowerCase()}, with ${totalSalesThisYear} registered transactions in the most recent year on record. ${marketMomentum}.`
        : `${areaName} (${outcode}) is in ${region}. Transaction volume was below the threshold for full statistical analysis — the report draws on available district-level Land Registry records. Manual verification via Rightmove and Zoopla sold data is advised.`,
    marketOverview: {
      averagePrice: hasData ? fmt(latestMedian) : outsideEnglandWales ? "Scotland/NI — see note" : "Insufficient data",
      priceChangeYoY: yoyChange,
      avgDaysOnMarket,
      supplyLevel: tier === "prime" ? "Constrained" : tier === "premium" ? "Below average" : demandSignal === "High" ? "Tight" : "Moderate",
    },
    priceTrend,
    neighbourhoodProfile: {
      schoolsRating,
      transportRating,
      safetyRating,
      walkability,
      character: neighCharacter,
      amenities: neighAmenities,
      greenSpace: neighGreenSpace,
      transport: neighTransport,
      schools: neighSchools,
      demographics: neighDemographics,
      nightlife: neighNightlife,
      marketComment: neighMarketComment,
    },
    investmentOutlook: {
      growthForecast,
      rentalYieldEstimate: rentalYield,
      riskFlags: [
        stampDutyNote,
        "Interest rate sensitivity: stress-test mortgage payments at base rate +2%",
        "Monitor local planning portal for nearby development — new supply can soften values",
        "Capital gains tax on investment properties has increased — model net returns accordingly",
        `Leasehold properties in ${areaName}: verify remaining lease, ground rent, and service charge before offering`,
        "EPC requirements tightening — properties below C rating may require upgrade spend",
      ],
    },
    verdict: hasData
      ? `${areaName} is a ${tier} market with ${yoyChange.startsWith("+") ? "positive momentum" : "stable conditions"}. Five-year appreciation of ${fiveYearGrowth !== "—" ? fiveYearGrowth : "—"} and ${yoyChange} year-on-year movement ${yoyChange.startsWith("+") ? "supports a buy stance for long-term holders" : "suggests patience is rewarded — pricing power currently sits with informed buyers"}. Estimated price per m² is ${pricePerSqmEstimate}. Buyer profile: ${buyerType}. Strategy: ${tier === "prime" || tier === "premium" ? "target off-market or chain-free properties for best leverage. Instruct a RICS Level 2 or 3 survey." : "look for properties with modernisation potential — 10–20% value uplift typically achievable with cosmetic refurbishment. Use comparables to anchor your offer below asking."}`
      : outsideEnglandWales
        ? `${areaName} is outside England and Wales. HM Land Registry data does not apply. Engage a local solicitor and RICS-accredited surveyor familiar with ${country} conveyancing law.`
        : `${areaName} is an established residential area. Low transaction volume limits statistical confidence — supplement this report with local agent intelligence and Rightmove sold prices before committing.`,
  };

  let propertyDeepDive: PropertyDeepDive | undefined;
  if (queryType === "address") {
    propertyDeepDive = {
      valuationAssessment: {
        estimatedRange: hasData
          ? `${fmt(latestMedian * 0.9)} – ${fmt(latestMedian * 1.15)} (90–115% of ${areaName} median)`
          : "Requires independent RICS appraisal",
        priceVsAreaAverage: hasData
          ? `${areaName} median: ${fmt(latestMedian)} · Est. ${pricePerSqmEstimate} · YoY: ${yoyChange} · 5-yr: +${fiveYearGrowth !== "—" ? fiveYearGrowth : "—"}`
          : outsideEnglandWales ? "Land Registry data unavailable for this region" : "Insufficient comparable data",
        valueScore: hasData
          ? `${tier === "prime" ? "8.2" : tier === "premium" ? "7.8" : tier === "mid-market" ? "7.4" : "7.0"} / 10`
          : "Pending survey",
      },
      comparableSales: comparables.length > 0 ? comparables : [
        { address: "No recent comparables in postcode area", price: "—", date: "—", type: "—" },
      ],
      negotiationBrief: {
        suggestedOfferRange: hasData
          ? `${fmt(latestMedian * 0.88)} – ${fmt(latestMedian * 0.97)} (3–12% below ${areaName} median)`
          : "Obtain independent RICS valuation before offering",
        leveragePoints: [
          `Area median is ${fmt(latestMedian)} — use this as your anchor. Any asking price above this requires justification from the agent`,
          `Market momentum is ${yoyChange.startsWith("+") ? "positive but not exceptional" : "softening"} — ${yoyChange.startsWith("+") ? "avoid overpaying by anchoring 5–8% below asking" : "buyers currently have leverage. Push for 8–12% below asking with survey findings as additional justification"}`,
          `Demand in ${areaName} is ${demandSignal.toLowerCase()} (${totalSalesThisYear} sales last year) — ${demandSignal === "High" ? "move quickly but don't skip due diligence" : "no urgency pressure. Take time to negotiate"}`,
          `Request the seller's purchase price via gov.uk/search-property-information to check their equity position and margin for negotiation`,
          `Estimated SDLT: ~${sdltEstimate} — factor this into your total acquisition cost when setting your maximum offer`,
          "Commission a RICS Level 2 HomeBuyer Report (£400–£600) or Level 3 Full Structural Survey (£600–£1,200) before exchange — defects found can reduce your offer further",
          "Verify EPC rating — properties rated D, E, F or G carry upgrade liability. Budget £5,000–20,000 for heat pump or insulation works and use this in negotiation",
          "For leasehold: demand at least 80 years remaining or budget for lease extension (£10,000–30,000+). Ground rent above £250/year (£1,000 in London) is a mortgage risk",
          "Check the local planning portal for nearby applications — approved high-density development within 500m typically softens residential values by 3–8%",
          "If the property has been on the market 60+ days, the seller has already been rejected at current pricing. Open at 10–15% below asking",
        ],
      },
    };
  }

  const id = briefIdCounter++;
  const report: BriefReport = {
    id, query, queryType,
    generatedAt: new Date().toISOString(),
    areaIntelligence,
    propertyDeepDive,
    lat: meta?.lat,
    lng: meta?.lng,
  };
  briefStore[id] = report;
  return report;
}

export function getBrief(id: number): BriefReport | undefined {
  return briefStore[id];
}
