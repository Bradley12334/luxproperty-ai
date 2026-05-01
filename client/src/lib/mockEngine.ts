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
  };
  briefStore[id] = report;
  return report;
}

export function getBrief(id: number): BriefReport | undefined {
  return briefStore[id];
}
