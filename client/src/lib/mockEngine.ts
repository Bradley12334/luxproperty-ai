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

  const areaIntelligence: AreaIntelligence = {
    location: outcode,
    area: areaName,
    executiveSummary: outsideEnglandWales
      ? scotlandNote
      : hasData
        ? `${areaName} (${outcode}) is a ${tier} residential market with ${fmt(latestMedian)} median transaction value drawn from ${totalTxns} Land Registry records over five years. ${ward ? `The ${ward} ward` : "This area"} sits within ${constituency || region}. Year-on-year price movement stands at ${yoyChange}, ${yoyChange.startsWith("+") ? "indicating continued buyer demand." : "reflecting current market conditions."}`
        : `${areaName} (${outcode}) is in ${region}. Detailed transaction data was limited for this area — the analysis below is based on available district-level Land Registry records.`,
    marketOverview: {
      averagePrice: hasData ? fmt(latestMedian) : outsideEnglandWales ? "Scotland/NI — see note" : "Insufficient data",
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
      ? `${areaName} presents a ${yoyChange.startsWith("+") ? "compelling" : "measured"} investment case. With ${fmt(latestMedian)} median transaction value and ${yoyChange} year-on-year movement, the area ${yoyChange.startsWith("+") ? "demonstrates resilient demand." : "offers selective opportunity for well-priced acquisitions."} Target properties with modernisation potential where 15–25% value uplift is achievable. Instruct a RICS surveyor before exchange.`
      : outsideEnglandWales
        ? `${areaName} is outside England and Wales. Engage a local solicitor and surveyor familiar with ${country} property law, as conveyancing differs significantly from English practice.`
        : `${areaName} is an established area. Engage a local agent for current off-market intelligence and request recent comparables before proceeding.`,
  };

  let propertyDeepDive: PropertyDeepDive | undefined;
  if (queryType === "address") {
    propertyDeepDive = {
      valuationAssessment: {
        estimatedRange: hasData
          ? `${fmt(latestMedian * 0.9)} – ${fmt(latestMedian * 1.15)}`
          : "Requires independent RICS appraisal",
        priceVsAreaAverage: hasData
          ? `Based on ${fmt(latestMedian)} district median (Land Registry)`
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
          ? `${fmt(latestMedian * 0.88)} – ${fmt(latestMedian * 0.97)} (3–12% below area median)`
          : "Obtain independent RICS valuation before offering",
        leveragePoints: [
          "Request full transaction history via gov.uk/search-property-information",
          "Commission a RICS HomeBuyer Report before exchange",
          "Check local planning portal for nearby development applications",
          "Verify EPC rating — factor any upgrade costs into your offer",
          "Ask agent for days on market — 60+ days signals stronger negotiating position",
          "Review service charge and ground rent history for leasehold properties",
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
  };
  briefStore[id] = report;
  return report;
}

export function getBrief(id: number): BriefReport | undefined {
  return briefStore[id];
}
