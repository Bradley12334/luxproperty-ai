import type { BriefReport, AreaIntelligence, PropertyDeepDive } from "../../../shared/schema";

let briefIdCounter = 1;
const briefStore: Record<number, BriefReport> = {};

function detectQueryType(query: string): "postcode" | "address" {
  const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  const partialPostcode = /^[A-Z]{1,2}\d[A-Z\d]?$/i;
  const trimmed = query.trim();
  if (postcodePattern.test(trimmed) || partialPostcode.test(trimmed)) {
    return "postcode";
  }
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
  } catch {
    return dateStr;
  }
}

// Cache to avoid repeat API calls in the same session
const outcodeDistrictCache: Record<string, string> = {};
const outcodePostcodeDataCache: Record<string, any> = {};

// Get admin district for any UK outcode via Postcodes.io
async function getDistrict(postcode: string): Promise<string> {
  const outcode = getOutcode(postcode);
  if (outcodeDistrictCache[outcode]) return outcodeDistrictCache[outcode];
  try {
    const res = await fetch(`https://api.postcodes.io/outcodes/${outcode}`);
    if (res.ok) {
      const d = await res.json();
      const districts: string[] = d?.result?.admin_district || [];
      if (districts.length > 0) {
        const district = districts[0].toUpperCase();
        outcodeDistrictCache[outcode] = district;
        return district;
      }
    }
  } catch {}
  return "";
}

// Fetch postcode metadata
async function fetchPostcodeData(postcode: string): Promise<{
  area: string;
  district: string;
  region: string;
  constituency: string;
  ward: string;
  latitude: number;
  longitude: number;
} | null> {
  const outcode = getOutcode(postcode);
  if (outcodePostcodeDataCache[outcode]) return outcodePostcodeDataCache[outcode];
  try {
    // Try full postcode first
    const clean = postcode.trim().replace(/\s+/g, "");
    const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);
    if (res.ok) {
      const d = await res.json();
      const result = {
        area: d.result?.outcode || outcode,
        district: d.result?.admin_district || "",
        region: d.result?.region || "London",
        constituency: d.result?.parliamentary_constituency || "",
        ward: d.result?.admin_ward || "",
        latitude: d.result?.latitude || 51.5,
        longitude: d.result?.longitude || -0.1,
      };
      outcodePostcodeDataCache[outcode] = result;
      return result;
    }
    // Fall back to outcode
    const res2 = await fetch(`https://api.postcodes.io/outcodes/${outcode}`);
    if (res2.ok) {
      const d = await res2.json();
      const result = {
        area: outcode,
        district: (d.result?.admin_district || [])[0] || "",
        region: (d.result?.admin_county || [])[0] || (d.result?.country || [])[0] || "England",
        constituency: (d.result?.parliamentary_constituency || [])[0] || "",
        ward: (d.result?.admin_ward || [])[0] || "",
        latitude: d.result?.latitude || 51.5,
        longitude: d.result?.longitude || -0.1,
      };
      outcodePostcodeDataCache[outcode] = result;
      return result;
    }
  } catch {}
  return null;
}

// Fetch Land Registry transactions for a district + year range
async function fetchLandRegistryYear(district: string, year: number): Promise<number[]> {
  try {
    const url = `https://landregistry.data.gov.uk/data/ppi/transaction-record.json?_pageSize=100&propertyAddress.district=${encodeURIComponent(district)}&min-transactionDate=${year}-01-01&max-transactionDate=${year}-12-31&_sort=-transactionDate`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.result?.items || [];
    return items.map((item: any) => item.pricePaid).filter((p: number) => p > 0);
  } catch {
    return [];
  }
}

// Fetch recent transactions for comparables
async function fetchRecentTransactions(district: string, outcode: string): Promise<Array<{
  address: string;
  price: number;
  date: string;
  type: string;
}>> {
  try {
    const url = `https://landregistry.data.gov.uk/data/ppi/transaction-record.json?_pageSize=50&propertyAddress.district=${encodeURIComponent(district)}&_sort=-transactionDate`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.result?.items || [];

    // Prefer items matching outcode, fall back to all
    const filtered = items.filter((item: any) =>
      (item?.propertyAddress?.postcode || "").startsWith(outcode)
    );
    const used = filtered.length >= 3 ? filtered : items;

    return used.slice(0, 6).map((item: any) => {
      const addr = item.propertyAddress || {};
      const parts = [addr.saon, addr.paon, addr.street, addr.town].filter(Boolean);
      const addressStr = parts.join(", ");
      const propType = item.propertyType?.prefLabel?.[0]?._value || "Property";
      return {
        address: addressStr || "Address withheld",
        price: item.pricePaid,
        date: item.transactionDate || "",
        type: propType.charAt(0).toUpperCase() + propType.slice(1).toLowerCase(),
      };
    });
  } catch {
    return [];
  }
}

export async function generateBrief(query: string): Promise<BriefReport> {
  const queryType = detectQueryType(query);
  const postcode = queryType === "address" ? (extractPostcode(query) || query) : query.trim().toUpperCase();
  const outcode = getOutcode(postcode);

  // Fetch postcode metadata + district in parallel
  const [postcodeData, district] = await Promise.all([
    fetchPostcodeData(postcode),
    getDistrict(postcode),
  ]);

  const areaName = postcodeData?.district || district || outcode;
  const region = postcodeData?.region || "England";
  const ward = postcodeData?.ward || "";
  const constituency = postcodeData?.constituency || "";

  // Fetch 5-year price data + recent transactions in parallel
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear];

  const [year0, year1, year2, year3, year4, recentTxns] = await Promise.all([
    fetchLandRegistryYear(district || areaName, years[0]),
    fetchLandRegistryYear(district || areaName, years[1]),
    fetchLandRegistryYear(district || areaName, years[2]),
    fetchLandRegistryYear(district || areaName, years[3]),
    fetchLandRegistryYear(district || areaName, years[4]),
    fetchRecentTransactions(district || areaName, outcode),
  ]);

  const yearData = [year0, year1, year2, year3, year4];

  // Calculate average price per year
  function avg(prices: number[]): number {
    if (!prices.length) return 0;
    return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  }

  const yearAvgs = yearData.map(avg);

  // Build 5-year price trend
  const priceTrend = years.map((year, i) => {
    const avgP = yearAvgs[i];
    let change = "—";
    if (i > 0 && yearAvgs[i - 1] > 0 && avgP > 0) {
      const pct = ((avgP - yearAvgs[i - 1]) / yearAvgs[i - 1]) * 100;
      change = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
    }
    return {
      year,
      averagePrice: avgP > 0 ? fmt(avgP) : "Insufficient data",
      change,
    };
  });

  // Current average = most recent year with data
  const latestAvg = [...yearAvgs].reverse().find(p => p > 0) || 0;
  const prevAvg = yearAvgs[yearAvgs.length - 2] || 0;
  const yoyChange = latestAvg > 0 && prevAvg > 0
    ? `${((latestAvg - prevAvg) / prevAvg * 100) >= 0 ? "+" : ""}${((latestAvg - prevAvg) / prevAvg * 100).toFixed(1)}%`
    : "Calculating...";

  // Transaction volume across all years
  const totalTxns = yearData.reduce((sum, yr) => sum + yr.length, 0);

  // Market tier
  const tier = latestAvg > 1500000 ? "prime" : latestAvg > 700000 ? "premium" : latestAvg > 400000 ? "mid-market" : "emerging";

  const hasData = latestAvg > 0;

  // Comparables for report
  const comparables = recentTxns.slice(0, 4).map(t => ({
    address: t.address,
    price: fmt(t.price),
    date: formatDate(t.date),
    type: t.type,
  }));

  // Avg days on market estimate based on tier
  const avgDaysOnMarket = tier === "prime" ? 54 : tier === "premium" ? 44 : tier === "mid-market" ? 38 : 32;

  // Rental yield estimate
  const rentalYield = tier === "prime" ? "2.5% – 3.2% gross" : tier === "premium" ? "3.0% – 3.8% gross" : "3.8% – 5.0% gross";

  // Growth forecast
  const growthForecast = yoyChange.startsWith("+") ? "+3.0% – 5.5% p.a. (2025–2028)" : "+1.5% – 3.5% p.a. (2025–2028)";

  // Transport rating based on region
  const isLondon = region === "London" || outcode.match(/^(SW|SE|EC|WC|E|N|NW|W)[0-9]/);
  const transportRating = isLondon ? 9.1 : region === "England" ? 7.2 : 7.5;

  const areaIntelligence: AreaIntelligence = {
    location: outcode,
    area: areaName,
    executiveSummary: hasData
      ? `${areaName} (${outcode}) is a ${tier} residential market with ${fmt(latestAvg)} average transaction value based on ${totalTxns} Land Registry records over five years. ${ward ? `The ${ward} ward` : "This area"} falls within ${constituency || region}. Year-on-year price movement is ${yoyChange}, ${yoyChange.startsWith("+") ? "indicating sustained buyer demand and constrained supply." : "reflecting broader market conditions and an opportunity for negotiation."}`
      : `${areaName} (${outcode}) is located in ${region}. Live transaction data was limited for this area — results below are based on available district-level records.`,
    marketOverview: {
      averagePrice: hasData ? fmt(latestAvg) : "Insufficient data",
      priceChangeYoY: yoyChange,
      avgDaysOnMarket,
      supplyLevel: tier === "prime" ? "Constrained" : tier === "premium" ? "Below average" : "Moderate",
    },
    priceTrend,
    neighbourhoodProfile: {
      schoolsRating: 8.2,
      transportRating,
      safetyRating: 8.0,
      walkability: isLondon ? 9.1 : 7.4,
    },
    investmentOutlook: {
      growthForecast,
      rentalYieldEstimate: rentalYield,
      riskFlags: [
        "Stamp duty surcharge applies for additional properties",
        "Interest rate sensitivity on leveraged purchases",
        "Monitor local planning applications for new supply",
        "Capital gains tax changes may affect net returns",
      ],
    },
    verdict: hasData
      ? `${areaName} presents a ${yoyChange.startsWith("+") ? "compelling" : "measured"} investment case. With ${fmt(latestAvg)} average transaction value and ${yoyChange} year-on-year movement, the area ${yoyChange.startsWith("+") ? "demonstrates resilient demand." : "offers selective opportunity for well-priced acquisitions."} We recommend targeting properties with modernisation potential where 15–25% value uplift is achievable. Engage a RICS surveyor before exchange and obtain full Land Registry title information prior to offer.`
      : `${areaName} is an established area. Engage a local agent for current off-market intelligence and request recent comparables before proceeding.`,
  };

  // Property deep dive for address queries
  let propertyDeepDive: PropertyDeepDive | undefined;
  if (queryType === "address") {
    propertyDeepDive = {
      valuationAssessment: {
        estimatedRange: hasData
          ? `${fmt(latestAvg * 0.9)} – ${fmt(latestAvg * 1.15)}`
          : "Requires local agent appraisal",
        priceVsAreaAverage: hasData
          ? `Based on ${fmt(latestAvg)} area average (Land Registry)`
          : "Insufficient comparable data",
        valueScore: hasData ? `${tier === "prime" ? "8.2" : tier === "premium" ? "7.8" : "7.4"} / 10` : "Pending survey",
      },
      comparableSales: comparables.length > 0 ? comparables : [
        { address: "No recent comparables found in district", price: "—", date: "—", type: "—" },
      ],
      negotiationBrief: {
        suggestedOfferRange: hasData
          ? `${fmt(latestAvg * 0.88)} – ${fmt(latestAvg * 0.97)} (3–12% below area average)`
          : "Obtain independent RICS valuation before offering",
        leveragePoints: [
          "Request full transaction history via gov.uk/search-property-information",
          "Commission a RICS HomeBuyer Report before exchange",
          "Check local planning portal for nearby development applications",
          "Verify EPC rating — factor any upgrade costs into your offer",
          "Ask selling agent for days on market — properties listed 60+ days carry stronger negotiating position",
          "Review service charge and ground rent history for leasehold properties",
        ],
      },
    };
  }

  const id = briefIdCounter++;
  const report: BriefReport = {
    id,
    query,
    queryType,
    generatedAt: new Date().toISOString(),
    areaIntelligence,
    propertyDeepDive,
  };

  briefStore[id] = report;
  return report;
}

export function getBrief(id: number): BriefReport | undefined {
  return briefStore[id];
}
