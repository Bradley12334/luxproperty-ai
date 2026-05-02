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

  // ── Postcode-specific neighbourhood data ──────────────────────────────────
  // Each entry overrides the tier-based fallbacks with curated, location-specific content.
  type PostcodeProfile = {
    schoolsRating: number;
    safetyRating: number;
    transportRating: number;
    walkability: number;
    character: string;
    amenities: string;
    greenSpace: string;
    transport: string;
    schools: string;
    demographics: string;
    nightlife: string;
    marketComment: string;
  };

  const postcodeProfiles: Record<string, PostcodeProfile> = {
    SW1: {
      schoolsRating: 9.1,
      safetyRating: 9.2,
      transportRating: 9.8,
      walkability: 9.7,
      character: `SW1 — spanning Belgravia, Pimlico, Westminster, and Victoria — is among the most prestigious addresses in the world. Stucco-fronted townhouses and white-painted terraces line garden squares maintained by private residents' associations. The area moves at a considered pace; it is the preserve of embassies, private members' clubs, and long-established families rather than tourist footfall. Chester Square, Eaton Square, and Belgravia's formal garden estates define the streetscape. A quietly international character — European old money, Gulf investors, and British establishment — gives the area a cosmopolitan but discreet energy.`,
      amenities: `Waitrose on Motcomb Street and Pimlico Road anchor day-to-day shopping alongside independent delicatessens, wine merchants, and specialist food importers. Sloane Street and Belgravia's Elizabeth Street host designer fashion, luxury florists, and artisan bakeries. Private medical clinics and Harley Street-adjacent GP practices serve residents. The Goring Hotel and Rib Room at the Carlton Tower represent the dining upper tier. Eccleston Yards hosts curated independent retail and wellness studios.`,
      greenSpace: `Green Park (Royal Park, 47 acres) and St James's Park (57 acres) are both walkable, providing direct access to The Mall, lake, and Horse Guards Parade. Buckingham Palace Gardens are visible but private. Most garden squares — Eaton Square Gardens, Chester Square — are residents-only and immaculately maintained. The Thames Embankment is accessible via Pimlico within 10 minutes' walk.`,
      transport: `Victoria Station (Victoria line, Circle, District, National Rail to Gatwick and Brighton) is the primary hub — Zone 1. Sloane Square (Circle, District) and St James's Park (Circle, District) stations are within walking distance. Pimlico Underground (Victoria line) serves the southern pocket. Multiple TfL bus routes connect the area. Gatwick Express runs from Victoria in approximately 30 minutes. Heathrow is 40–50 minutes via Tube or taxi.`,
      schools: `The area is exceptional for independent schooling. Westminster School (one of the top-performing in the UK, fees ~£28,000/year) is within walking distance of SW1P. Francis Holland School (Sloane Square) and Eaton House are among the sought-after prep and primary options. State provision is led by St Barnabas and St Philip's C of E Primary and Pimlico Academy secondary. Boarding options at Eton, Harrow, and Winchester are typically used by the primary resident demographic.`,
      demographics: `Largely affluent professionals, senior diplomats, hereditary wealth, and international high-net-worth families. Owner-occupier rate is high for inner London. A meaningful share of properties are held as pied-à-terres by overseas principals. Average household income in Belgravia and Westminster is among the top 1% nationally. Long average tenure among owner-occupiers — residents who arrive typically remain for decades.`,
      nightlife: `SW1 operates at the refined end of London's hospitality spectrum. Dinner at Marcus (The Berkeley), Outlaw's (Capital Hotel), or Kerridge's Bar and Grill at Corinthia are typical evenings. Beauchamp Place gastropubs, the Grenadier pub in Wilton Mews, and the Pantechnicon on Motcomb Street represent the more relaxed offer. The late-night scene is quiet relative to neighbouring Chelsea — residents here value discretion over volume.`,
      marketComment: `SW1 is one of the deepest off-market postcodes in London — a significant proportion of transactions in Belgravia and Pimlico never reach Rightmove. Cultivate relationships with Knight Frank, Savills, and Strutt & Parker prime London desks. Cash buyers and chain-free purchasers command a material advantage. Pricing is sticky — vendors rarely capitulate significantly, but a well-prepared buyer with proof of funds can achieve 3–6% below asking in a patient negotiation. The Grosvenor Estate's long-term stewardship of Belgravia provides structural planning protection and quality assurance that underpins values.`,
    },

    SW3: {
      schoolsRating: 9.0,
      safetyRating: 9.0,
      transportRating: 9.2,
      walkability: 9.5,
      character: `SW3 — Chelsea — is one of London's most enduringly fashionable postcodes. The King's Road was the epicentre of 1960s Swinging London and remains a byword for style, though it has evolved into a destination for designer homeware, boutique fashion, and premium dining rather than counterculture. Cheyne Walk along the Thames Embankment is one of the most photographed residential streets in London. Chelsea has a particular energy — creative but wealthy, bohemian in character but expensive in practice. Red-brick mansion blocks, blue-plaque Georgian terraces, and garden squares define the residential fabric.`,
      amenities: `The King's Road provides a continuous stretch of quality retail — from Heal's and The White Company to independent concept stores and artisan florists. Waitrose (King's Road) handles daily grocery needs alongside Partridges food market on Saturdays. Bluebird Café and Colbert on Sloane Square are neighbourhood institution-level dining. The Chelsea Farmers Market hosts independent food vendors and plant nurseries. Private gym provision is exceptional — KXU, 1Rebel, and KX gym are all within the postcode.`,
      greenSpace: `Ranelagh Gardens in Royal Hospital Chelsea (site of the Chelsea Flower Show each May) provides beautifully maintained formal gardens adjacent to the river. Battersea Park is a 10-minute walk across Chelsea Bridge — 200 acres of riverside parkland with a running track, boating lake, and cafés. Chelsea Embankment provides a tree-lined riverside walk. Many period properties back onto private communal gardens.`,
      transport: `Sloane Square (Circle, District lines, Zone 1) is the primary Underground station, serving King's Road and central Chelsea. South Kensington (Piccadilly, Circle, District) is walkable from the northern part of the postcode. The area is well-served by TfL bus routes including the 11, 19, 22, 49, 211, 319, and 345. Chelsea has no direct Overground link, making it slightly less well-connected than Fulham or Clapham — but the Tube proximity compensates. Journey to central London (Bank/Liverpool St): 25–35 minutes.`,
      schools: `Outstanding independent provision. Chelsea Academy is a well-regarded state secondary. Royal Hospital School at Chelsea and Francis Holland (Sloane Square) are within walking distance. Bousfield Primary School (Outstanding, state) is highly sought-after with competitive catchment. The Oratory and Finton House are respected prep options. Independent schools accessible within 20 minutes include Latymer Upper, Godolphin & Latymer, and Chelsea Independent College for sixth-form.`,
      demographics: `Chelsea attracts a mix of old-money British families, successful creative and media professionals, international buyers (American and European particularly), and equity-rich upsizers from other London postcodes. The demographic skews 35–60 for owner-occupiers, with a younger renter cohort in mansion block conversions. Residency tenure is high — the area's lifestyle offer and status value drive long holds.`,
      nightlife: `Some of London's best restaurant-focused dining is concentrated here. Rabbit, Bluebird, Colbert, The Ivy Chelsea Garden, and Bibendum (in the art nouveau Michelin House on Fulham Road) set the quality bar. Guys Bar and The Goat gastropub represent the relaxed end. Sydney Street and the area around Beauchamp Place are popular for Friday evenings. The scene is well-heeled and sociable but quietens by midnight — Chelsea skews dinner over nightclub.`,
      marketComment: `Chelsea has a two-speed market: the best properties (Cheyne Walk, The Vale, the garden squares) are exceptional assets that rarely disappoint over any 10-year horizon. The flat market is more nuanced — leasehold mansion block flats with short leases or high service charges can sit for extended periods. Buy freehold or long leasehold above 150 years where possible. Knight Frank and Savills operate the dominant prime agencies here; relationship-building with their Chelsea desks is worth the investment. Best value relative to SW1: the streets off the Fulham Road between Chelsea and SW6 border — check the postcode carefully before committing.`,
    },

    W1: {
      schoolsRating: 8.8,
      safetyRating: 8.5,
      transportRating: 9.9,
      walkability: 9.8,
      character: `W1 — spanning Mayfair, Marylebone, Fitzrovia, and Soho — is the commercial and cultural heart of London. Residential pockets within W1 are among the most valuable per square metre in the world. Mayfair's Georgian townhouses on Grosvenor Square, Hill Street, and South Audley Street represent the apex. Marylebone Village has cultivated a very different energy — independent shops, café culture, and a settled neighbourhood feel that belies its Zone 1 location. Fitzrovia and Soho are primarily commercial but have significant residential conversions prized for urban immediacy.`,
      amenities: `Marylebone High Street is London's finest neighbourhood high street — Daunt Books, La Fromagerie, Monocle Café, Cire Trudon, and independent chemists all within 400 metres. Selfridges and the Oxford Street corridor are 10 minutes' walk. Mount Street in Mayfair hosts Marc Jacobs, Christian Louboutin, and Connaught Bar. For daily grocery: Waitrose (Marylebone), Whole Foods (Piccadilly), and multiple specialist food shops. The private healthcare corridor on Harley Street (W1G) offers the highest concentration of medical specialists in Europe.`,
      greenSpace: `Hyde Park (350 acres) borders the southern edge of W1 — a direct connection from Park Lane to Kensington. Regent's Park is within 10 minutes' walk of northern Marylebone. Green Park provides a transit to St James's Park and the Royal Parks circuit. Cavendish Square Garden (residents-only) and Hanover Square are smaller formal green spaces within the postcode. Access to open space is exceptional given the density of the urban environment.`,
      transport: `W1 has the highest density of Underground stations in London. Bond Street (Central, Jubilee, Elizabeth line — Zone 1), Oxford Circus (Central, Bakerloo, Victoria), Marble Arch (Central), Baker Street (Hammersmith & City, Circle, Metropolitan, Jubilee, Bakerloo), and Regent's Park (Bakerloo) all serve the postcode. The Elizabeth line at Bond Street provides direct services to Heathrow (27 minutes), Canary Wharf (18 minutes), and Reading. Journey time to Canary Wharf: under 20 minutes. Heathrow: under 30 minutes.`,
      schools: `Marylebone is served by St Marylebone C of E School (Outstanding secondary, highly competitive), Portland Place School, and St Vincent's Catholic Primary. In Mayfair: South Hampstead High School is a short commute. The area is proximate to some of London's most prestigious independent schools including Westminster, City of London School, and University College School (Hampstead). Harrow and Eton are accessible for boarding. Note: W1 is primarily commercial — many buyers are city workers who schoolchildren commute to Hampstead, Dulwich, or Kensington.`,
      demographics: `W1 commands a rare blend of residents. Mayfair is dominated by HNW individuals, hedge fund managers, family offices, and international principals (Middle Eastern, Russian, and Far Eastern buyers are historically prominent). Marylebone attracts a slightly younger, culturally-oriented professional class — architects, media executives, creative directors. Fitzrovia and Soho skew towards younger professionals and creative-sector workers in converted loft and warehouse spaces. Turnover in W1 is higher than SW1 due to the proportion of investment holdings.`,
      nightlife: `Soho and Fitzrovia anchor London's most concentrated restaurant and bar scene. Bao, Barrafina, Hoppers, and Berners Tavern are among the West End's most-booked tables. For Mayfair: Sexy Fish, Gymkhana, Scotts, The Connaught Bar (voted world's best bar multiple times). Marylebone's evening offer is more residential — Fischer's, The Chiltern Firehouse, and Chiltern Street wine bars. Soho's nightlife is late and dense — nearby Ronnie Scott's Jazz Club has operated since 1959. The area transitions from dining to club from 11pm in Soho.`,
      marketComment: `W1 residential is a rare commodity — commercial use pressure means few new residential units ever come to market. Mayfair townhouses and mansion flats command premium pricing with minimal negotiating room in a normal market. Marylebone is the relative value play: high walkability and neighbourhood credentials at 20–30% below Mayfair comparable square metreage. Watch for service charges on the Howard de Walden Estate (Marylebone) and Grosvenor Estate (Mayfair) buildings — both are well-managed but significant. Basement extensions are common value-add works; confirm planning appetite with Westminster Council before proceeding.`,
    },

    W8: {
      schoolsRating: 9.2,
      safetyRating: 9.1,
      transportRating: 9.5,
      walkability: 9.4,
      character: `W8 — Kensington — is the quintessential London prime village. Garden squares (Pemberton, Victoria Grove, Edwardes Square) with residents-only private gardens line the residential streets. Kensington Church Street is among the best antiques and art dealer streets in Europe. The neighbourhood has a settled, unhurried quality — it is less fashion-forward than Chelsea but more residential and arguably more liveable. Victorian and Edwardian terraces, large family houses, and grand period apartments define the stock. Kensington Palace and the formal grounds of Kensington Gardens establish the western character of the postcode.`,
      amenities: `Kensington High Street provides comprehensive retail: M&S, Waitrose, H&M, Zara, and independent restaurants across a 400-metre stretch. Kensington Church Street hosts specialist antiques and art dealers that draw international collectors. The Design Museum (Holland Park Avenue) and Leighton House (Holland Park Road) are cultural institutions within the postcode. Holland Park's Opera House hosts summer open-air performances. Whole Foods Market (Kensington) handles premium grocery needs.`,
      greenSpace: `Kensington Gardens (275 acres, Royal Park) is directly accessible — home to the Serpentine Gallery, the Albert Memorial, and the Round Pond. Holland Park (54 acres) provides woodland walks, a Japanese Kyoto Garden, an ecology centre, and an open-air opera venue. Edwardes Square and Pemberton Gardens are private garden squares exclusive to residents. The combined access to green space within W8 is among the best of any inner-London postcode.`,
      transport: `High Street Kensington (Circle, District lines — Zone 2) is the primary station. Kensington (Olympia) provides National Rail connections. Earl's Court (District, Piccadilly) is accessible on foot or by bus. The 9, 10, 27, 28, and 49 bus routes connect the area to central London and the King's Road. Journey to Canary Wharf: approximately 40 minutes. Heathrow: 30 minutes via Piccadilly from Earl's Court. Central London (Bank): 25–30 minutes.`,
      schools: `Exceptional independent provision. Thomas's Kensington (prep), Norland Place School, and Pembridge Hall are top-rated primaries. Holland Park School (Outstanding state secondary) is among the best comprehensives in London and is highly oversubscribed — catchment typically extends less than 0.5 miles. The Lycée Français Charles de Gaulle on Cromwell Road serves the large French-speaking community. Kensington Prep, Garden House School, and Sussex House are all within the postcode or adjacent. Average independent school fee: £19,000–£28,000/year.`,
      demographics: `W8 attracts established London families, senior professionals, and a significant European expatriate community (French, Italian, Scandinavian) drawn by the French lycée and quality of life. Long average tenure — owners typically stay 7–15 years. A moderate proportion of international holding — lower than SW1 but higher than Chiswick or Richmond. Average household income is substantially above the London median.`,
      nightlife: `The evening offer is curated and quality-focused. Babylon at The Roof Gardens (Holland Park), Clarke's Restaurant (Kensington Church Street), and Yashin Ocean House (Argyll Road) are local dining institutions. The Milestone Hotel bar offers a polished late-evening option. Kensington High Street provides more accessible options — local gastropubs including The Churchill Arms and The Scarsdale Tavern are neighbourhood fixtures. The area is calm after 11pm — Kensington skews dinner-with-friends over late-night.`,
      marketComment: `W8 freehold houses on the best garden squares (Edwardes Square, Pemberton Gardens) are among the most structurally reliable property investments in London — limited supply, consistent HNW demand, and strong planning protections. Leasehold flats on the Phillimore Estate require careful lease analysis — the Estate is a responsible freeholder but short leases (below 80 years) trigger statutory extension costs. The Holland Park border (W11/W8 divide) can create postcode ambiguity — check council tax band and postcode carefully. Target properties requiring modernisation; cosmetic refurbishment in this market typically returns 15–25% premium on exit.`,
    },

    W11: {
      schoolsRating: 8.7,
      safetyRating: 8.4,
      transportRating: 9.3,
      walkability: 9.3,
      character: `W11 — Notting Hill and Holland Park — occupies a cultural position in London that few postcodes match. The Portobello Road Antiques Market (the world's largest, operating every Saturday) defines the area's character — creative, eclectic, internationally aware. Pastel-painted Victorian terraces on Lansdowne Road, Elgin Crescent, and Denbigh Road are some of the most photographed streets in London. The vibe is creative-wealthy: media executives, artists, gallery owners, and film industry figures are the core demographic. Holland Park itself provides 54 acres of formal woodland and the Kyoto Garden. The Julia Roberts film 'Notting Hill' (1999) codified the area's cultural brand internationally — and prices have reflected it ever since.`,
      amenities: `Portobello Road and Golborne Road provide the most distinctive independent retail in west London — antique dealers, vintage clothes, record shops, ceramics studios, and weekend food stalls. Books for Cooks, The Spice Shop, and Lisboa Patisserie are local institutions. Wholefoods and Planet Organic handle premium grocery. Ledbury Road and Westbourne Grove host designer boutiques and independent restaurants. The Electric Cinema (Portobello Road) is one of London's oldest and most distinctive independent cinemas.`,
      greenSpace: `Holland Park (54 acres) is directly accessible — formal Japanese gardens (Kyoto Garden), peacocks, an ecology centre, and woodland walks. Kensal Green Cemetery (72 acres) is a hidden green space with Victorian landscaping and significant cultural heritage. The communal garden squares of Ladbroke Grove are private but extensive. Kensington Gardens is a 15-minute walk. The area has unusually good green space for its inner-London location.`,
      transport: `Notting Hill Gate (Central, Circle, District lines — Zone 2) is the primary hub. Holland Park (Central line) and Ladbroke Grove (Hammersmith & City, Circle) provide additional access. The 52, 452, 23, and 28 bus routes connect to central London and Chelsea. Cycling infrastructure on the Royal Borough of Kensington & Chelsea network is excellent. Journey to Bank: 25 minutes. Heathrow: 40 minutes. Canary Wharf: 35 minutes.`,
      schools: `Holland Park School (Outstanding state secondary, RBKC) is the local comprehensive — extremely competitive catchment, typically under 0.4 miles. Notting Hill & Ealing High School (GDST) is an excellent independent girls' school accessible by bus. St Mary of the Angels RC Primary and Colville Primary are well-regarded local primaries. The French lycée on Cromwell Road is within cycling distance. Pembridge Hall and Norland Place are the dominant prep schools for the area's professional family demographic.`,
      demographics: `W11 has one of London's most distinctive demographic profiles — a blend of very wealthy creative professionals, established arts patrons, international media buyers, and long-term working-class residents (mainly in the northern pocket toward Ladbroke Grove and Kensal). The latter creates a social mix that many residents prize. Average property values and demographics vary significantly between the northern (more mixed) and southern (prime) parts of the postcode. The area draws heavily from the film, TV, advertising, and gallery sectors.`,
      nightlife: `Notting Hill's evening offer is distinctive and quality-driven. The Ledbury (two Michelin stars, Ledbury Road), The Cow (Westbourne Park Road), Lucky 7 American diner, and Julie's (Holland Park Avenue) are local institutions. The Electric (Portobello Road) does excellent burgers and has a bar beneath the cinema. Golborne Road is emerging as a restaurant strip with Moroccan and Portuguese influences. Frieze Art Fair week (October) turns the area briefly into the centre of the global art world.`,
      marketComment: `W11 rewards buyers who understand the postcode geography. Properties south of Holland Park Avenue (toward the W8 border) consistently outperform those north of Westbourne Grove over any cycle. The gradient is meaningful — a house on Elgin Crescent will outperform an equivalent on Ladbroke Grove over 10 years. Portobello Road-facing properties attract premium for charm but can have noise and footfall issues on market days. Off-market deals via Strutt & Parker and John D Wood are common for the best freehold houses. Target chain-free vendors in the W11/W2 overlap near Bayswater for the occasional undervalued acquisition.`,
    },

    NW3: {
      schoolsRating: 9.3,
      safetyRating: 8.9,
      transportRating: 8.8,
      walkability: 9.0,
      character: `NW3 — Hampstead and Belsize Park — is London's most celebrated intellectual village. Hampstead Village's Georgian terraces and hilltop position over the Heath give it a physical and psychological separation from the city below. The area has been home to John Keats, Sigmund Freud, George Orwell, and a litany of cultural figures — a heritage that persists in its bookshops, independent cinema, and literary café culture. Belsize Park has its own distinct identity: wider streets, larger garden villas, and a slightly younger professional demographic. The Heath itself — 790 acres of ancient woodland and open grassland — defines the area's extraordinary quality of life.`,
      amenities: `Hampstead High Street is one of the best village high streets in London — Waterstones, Gail's Bakery, Coffee Cup (a 70-year institution), indie cafes, and specialist retailers. Flask Walk hosts antique shops and the Flask pub (a Grade II listed gin house). Belsize Park has developed its own strip along England's Lane with independent restaurants and the excellent Belsize Park Farmers' Market. Waitrose (Haverstock Hill) and Whole Foods (Hampstead) handle premium grocery. Primrose Hill, a 20-minute walk south, adds further dining and boutique retail.`,
      greenSpace: `Hampstead Heath (790 acres) is directly accessible — the best urban open space in London outside the Royal Parks. It includes Parliament Hill Lido (outdoor unheated swimming pool, open year-round), bathing ponds (men's, women's, mixed), ancient woodland, meadows, and Kenwood House (English Heritage, free entry). The views from Parliament Hill over central London are exceptional. Golders Hill Park (an extension of the Heath) adds formal gardens and a small zoo. Hampstead Heath is a primary reason buyers accept higher prices here.`,
      transport: `Hampstead (Northern line, Zone 2) is one of London's deepest Underground stations (60m below street level). Belsize Park (Northern line, Zone 2) serves the southern part of the postcode. Hampstead Heath (Overground, London Overground) provides an alternative rail link. The 168, 46, and 268 bus routes connect to central London. Journey to Bank: 25–30 minutes. Canary Wharf: 45 minutes. Note: driving into central London from NW3 is slow during peaks — Tube-first households have the best daily commute.`,
      schools: `NW3 may have the most competitive school landscape outside SW1. South Hampstead High School (GDST, Outstanding), Hampstead School (Good comprehensive), The Hall School (prep), and University College School (UCS) are all within the postcode or a short walk. New End Primary (Outstanding, state) is the most oversubscribed primary in Camden — catchment can be under 300 metres. Highgate School (independent) and St Paul's Girls' School are accessible by bus. Freud Museum and Burgh House contribute to the area's cultural education offer.`,
      demographics: `NW3 has one of the highest concentrations of university-educated residents in the UK. The demographic is skewed toward academics, media professionals, senior lawyers and barristers, medical consultants, and successful creative practitioners. A significant Jewish community has been established in NW3/NW11 for generations. Average household income is substantially above the London median. Many residents have chosen NW3 specifically for the Heath and school access — family ties to the area are strong.`,
      nightlife: `Hampstead's evening scene is characterised by gastropubs, neighbourhood restaurants, and the Flask and Spaniards Inn (17th-century coaching inn on the Heath edge). Gail's and the Louis Patisserie represent the unhurried café culture. The Everyman Hampstead cinema is a local institution — one of the original Everyman venues. For more active evenings: Primrose Hill restaurants (L'Absinthe, Lemonia) are a short walk or cab. The area is resolutely residential after 11pm — this suits the demographic perfectly.`,
      marketComment: `NW3 pricing is supported by three factors that rarely align in London: exceptional green space, outstanding schools, and cultural prestige. The combination creates structurally resilient values. Freehold houses overlooking the Heath (Christchurch Hill, Well Walk, Cannon Place) are the apex — rarely available and priced accordingly. The Belsize Park flat market is more fluid and offers relative value against Hampstead houses, especially in larger garden-level and basement flats. Avoid converted houses with thin party walls in Victorian terraces — acoustic separation is a common survey finding. Value uplift opportunity: the Haverstock Hill/England's Lane corridor where NW3 meets NW1.`,
    },

    NW1: {
      schoolsRating: 8.3,
      safetyRating: 8.0,
      transportRating: 9.5,
      walkability: 9.2,
      character: `NW1 — Regent's Park, Primrose Hill, and Camden Town — is one of London's most varied postcodes. At its southern end, Regent's Park's Grade I listed Nash Terraces (private residences leased from the Crown Estate) are among the most architecturally distinguished addresses in the UK. Primrose Hill, to the north, is a bohemian-affluent village — a magnet for actors, musicians, and media personalities drawn by its village atmosphere and hilltop park views. Camden Town contrasts sharply: one of London's most famous street markets and alternative cultural hubs. This diversity makes NW1 genuinely interesting but also requires careful street-level research.`,
      amenities: `Primrose Hill Village (Regent's Park Road) is compact but excellent — a bookshop, fine bakeries, fishmonger, Odette's restaurant, and independent cafes within a 200-metre stretch. Camden Market (Chalk Farm Road) is one of London's most-visited tourist destinations — extensive street food, vintage fashion, and alternative retail. The nearby Stables Market houses established antiques and arts dealers. King's Cross St Pancras (15 minutes' walk or one Tube stop) provides international Eurostar connections and the regenerated Coal Drops Yard retail and restaurant district.`,
      greenSpace: `Regent's Park (395 acres, Royal Park) is directly accessible from the southern half of the postcode — boating lake, Queen Mary's Rose Garden, open-air theatre, and athletics track. Primrose Hill Park (63 acres) provides some of the best views in London — the city skyline visible from the summit on a clear day. Primrose Hill residents use the park daily for dog walking, running, and picnicking. Hampstead Heath is 20 minutes' walk from the northern edge.`,
      transport: `Exceptional Zone 1/2 connectivity. Regent's Park (Bakerloo), Great Portland Street (Circle, Hammersmith & City, Metropolitan), and Baker Street (multiple lines) serve the southern half. Chalk Farm (Northern) and Camden Town (Northern) serve the north. King's Cross St Pancras (6 lines including Elizabeth, Metropolitan, Hammersmith & City, Circle, Northern, Piccadilly, and Victoria) is accessible by bus or a short walk from the eastern edge. Euston (National Rail, High Speed 2 future terminus, Northern, Victoria) is adjacent. International: Paris St Pancras in 2 hours 15 minutes via Eurostar.`,
      schools: `Maria Fidelis RC School and Camden School for Girls (Outstanding, state selective sixth form) are the flagship state options. Primrose Hill Primary School (Outstanding) is oversubscribed with competitive catchment. Independent options include North Bridge House (multiple campuses), Chalkhill Primary, and the many schools accessible within 10 minutes in NW3. School provision in the Camden Town part of NW1 is more variable — verify specific school addresses against ofsted.gov.uk before purchasing if schools are a primary criterion.`,
      demographics: `Highly varied by neighbourhood. Regent's Park terraces house some of the wealthiest families in London. Primrose Hill is a creative-wealthy enclave — Jude Law, Jamie Oliver, and Blur's Damon Albarn have all been associated with the village. Camden Town is younger, renter-dominated, and more transient. Overall NW1 has a high proportion of single-person households and young professionals alongside established families in the southern and western pockets.`,
      nightlife: `Camden Town has London's densest concentration of live music venues — The Jazz Café, Roundhouse (national touring acts), Electric Ballroom, and KOKO are all within NW1. The Hawley Arms, Edinburgh Castle, and numerous bar-restaurants form the Camden late-night strip. Primrose Hill in contrast offers quiet gastropub dinners — The Lansdowne, The Engineer — and early-evening wine bars. King's Cross and Coal Drops Yard (15 minutes) add a premium restaurant and cocktail bar tier that has transformed the eastern NW1/N1C interface.`,
      marketComment: `NW1 is a postcode where street-level due diligence matters more than in most of London. Three streets in Primrose Hill will significantly outperform three streets in Camden Town over any 10-year horizon. Target: Fitzroy Road, Chalcot Crescent, and Princess Road in Primrose Hill for the best long-term hold. The Regent's Park Nash Terraces are Crown Estate leasehold — understand the lease structure before proceeding. King's Cross regeneration (N1C border) continues to drive values northward: properties in the NW1 8/NW1 9 area have seen above-average appreciation from the Google campus and Coal Drops Yard effect.`,
    },

    E1: {
      schoolsRating: 7.5,
      safetyRating: 7.2,
      transportRating: 9.4,
      walkability: 8.8,
      character: `E1 — Whitechapel, Shoreditch border, Aldgate, and Spitalfields — is east London's most historically layered postcode. The Huguenot weavers, the Jewish East End, the Bangladeshi community of Brick Lane, and now the tech and creative industries have each left their mark. Spitalfields has some of London's most remarkable Georgian architecture (Elder Street, Fournier Street) alongside the covered market and Hawksmoor's Christ Church. The postcode is currently in a period of rapid gentrification — significant new residential development alongside deeply established communities. A postcode of genuine contrasts and extraordinary energy.`,
      amenities: `Spitalfields Market (open daily, specialist markets Thursday–Sunday) is one of London's great covered markets — organic food, independent fashion, vintage, and arts. Brick Lane is famous for its Bangladeshi curry houses, Sunday market, and bagel bakeries (open 24 hours). Whitechapel Market on the High Street is one of London's oldest and busiest street markets. Aldgate's cluster includes large Tesco and Marks & Spencer outlets. The Truman Brewery complex on Brick Lane hosts independent retail, pop-ups, and weekend arts fairs. Premier Inn Aldgate and The Hoxton Hotel are quality hospitality options.`,
      greenSpace: `Altab Ali Park (formerly St Mary's Gardens) on Whitechapel High Street provides a modest but well-maintained green space with significant community significance. Victoria Park (Tower Hamlets, adjacent to E2) is 1.5 miles north — 86 acres of formal parkland with a café and boating lake. The Thames riverside walk at Wapping and St Katharine Docks (5 minutes' walk from the E1W border) provides excellent riverside access. Shoreditch Park (N1 border) is another option northward.`,
      transport: `Outstanding Zone 1/2 connectivity. Aldgate (Circle, Metropolitan), Aldgate East (District, Hammersmith & City), Whitechapel (District, Hammersmith & City, Elizabeth line — Crossrail), Liverpool Street (Central, Circle, Metropolitan, Hammersmith & City, Overground, Greater Anglia rail) all serve E1. The Elizabeth line at Whitechapel connects to Heathrow (35 minutes), Canary Wharf (7 minutes), and Reading. National Rail from Liverpool Street serves East Anglia. Journey to Canary Wharf: under 10 minutes. Bank: under 10 minutes.`,
      schools: `Swanlea Secondary School and Stepney Green School are the main state secondaries. Whitechapel Academy has improved significantly under academy trust governance. Islamic state schools (Mulberry School for Girls, rated Outstanding) serve the area's significant Muslim community. Bangabandhu Primary and Sir John Cass Primary are local primaries. Independent options are limited within E1 — the closest quality independents are in the City (City of London School) or Islington (Highbury Grove area). Significant state school improvement under Tower Hamlets Local Authority — check current Ofsted ratings at ofsted.gov.uk.`,
      demographics: `E1 has one of London's most diverse demographic profiles — a large established Bangladeshi community (particularly around Brick Lane and Whitechapel), a rapidly growing cohort of tech and creative professionals, young renters in new-build developments, and City workers in the Aldgate/E1W area. Gentrification pressure is significant and accelerating. The demographic shift is most visible on the northern edge (Shoreditch border) and around the tech cluster of Silicon Roundabout. Rental demand is exceptionally high.`,
      nightlife: `E1 and the adjacent Shoreditch/Bethnal Green area constitute London's most dynamic night-time economy outside the West End. Hawksmoor Spitalfields, St John Bread & Wine, and Dishoom (Commercial Street) represent the higher dining tier. The Ten Bells (Jack the Ripper historic pub), Ye Olde Cheshire Cheese, and the Pride of Spitalfields are long-established pubs. 93 Feet East, The Nest (E8 border), and fabric (farther west in EC1) are the late-night club anchors. Boxpark Shoreditch (container park) adds casual dining and event space.`,
      marketComment: `E1 is the most compelling medium-term regeneration story in inner east London. The Elizabeth line at Whitechapel has materially reduced journey times to the West End and Heathrow, driving demand from buyers previously priced out of EC1/E2. Focus on the Elder Street/Princelet Street Georgian conservation area for long-term capital preservation. The Aldgate tower cluster (new-build high-rises) delivers worse resale performance than period conversions — avoid new-build tower flats as a capital growth vehicle. The best buys are converted commercial buildings (loft-style) and Georgian terraces in the Spitalfields core. Service charge inflation is a concern in new-build blocks — scrutinise closely before committing.`,
    },

    E8: {
      schoolsRating: 7.6,
      safetyRating: 7.4,
      transportRating: 8.5,
      walkability: 8.7,
      character: `E8 — Hackney and Dalston — is the postcode most associated with east London's ongoing creative renaissance. London Fields provides a park-centred community hub that activates daily in a way few urban parks manage. Broadway Market on Saturday is arguably London's best weekly food and antiques market — and the surrounding streets of Victorian terraces with painted frontages are among the most photographed in east London. Dalston is rawer, denser, and more commercially active — the Ridley Road Market, independent music venues, and diverse restaurants reflect Hackney's genuinely multicultural community. Rio Cinema (a 1930s independent), Hackney Picturehouse, and the Arcola Theatre make E8 a genuine cultural district.`,
      amenities: `Broadway Market (Saturday) is the community focal point — sourdough from E5 Bakehouse, oysters, specialist cheese, vinyl, and vintage clothing. London Fields Lido (heated outdoor Olympic-length pool, open year-round) is a significant lifestyle asset. Netil Market (Saturdays) on Westgate Street adds more independent food and craft. Dalston's Ridley Road Market (Mon–Sat) is one of east London's great traditional markets — Afro-Caribbean produce, fish, and street food. Mare Street's cluster of independent cafes and restaurants has expanded substantially in the past five years. Hackney Council Leisure Centre on Wick Road provides budget gym access.`,
      greenSpace: `London Fields (27 acres) is E8's centrepiece — a flat park with the historic Lido, tree-lined avenues, a cricket ground (London Fields Cricket Club), and a Saturday farmers' market. Victoria Park (86 acres), accessed via Well Street or by cycling along the towpath, is a 15-minute cycle. Haggerston Park and Hackney Downs provide further green space in the northern and western parts of the postcode. The Regent's Canal towpath runs through E8, connecting to King's Cross westward and Victoria Park eastward — a major daily cycling and running route.`,
      transport: `London Fields (Overground, Zone 2), Hackney Central (Overground, Zone 2), and Dalston Junction (Overground, Zone 2) are the primary stations on the East London Line. Hackney Downs (Greater Anglia, Zone 2) provides National Rail services to Liverpool Street (10 minutes) and Cambridge. Bus routes include the 55, 277, 106, and 30, connecting to Liverpool Street, Bethnal Green, and Islington. No Underground station within E8 — Overground dependency means journey times extend slightly for non-City/Liverpool Street destinations. Journey to Liverpool Street: 10 minutes. Canary Wharf: 25 minutes via bus and DLR at Shadwell.`,
      schools: `E8 has benefited significantly from the academy trust improvements in Hackney. Hackney New School and Mossbourne Community Academy (Outstanding, state secondary) are local options. Kingsland School and Petchey Academy are other local secondaries. primary highlights: London Fields Primary School, Queensbridge Primary, and Gayhurst Community School are among Hackney's better-rated primaries. Independent options are limited within E8 — the market is dominated by state school reliance. Check current Ofsted ratings as performance has been variable across the borough.`,
      demographics: `E8 has undergone a significant demographic transition over the past 15 years. The original community (West African, Turkish/Kurdish, Jamaican) remains substantial in Dalston and northern Hackney. A wave of creative professionals, artists, and tech workers (priced out of Shoreditch) now dominates the owner-occupier base along Broadway Market and London Fields. The area has a young average age — mid-30s — and a high proportion of renters and recent movers. Hackney continues to top surveys as London's most creative borough by employment sector.`,
      nightlife: `Dalston is one of London's most active late-night postcodes. Brilliant Corners (jazz bar), Nest (club/DJ bar), Voodoo Ray's (pizza), Ridley Road Market Bar, and Dalston Superstore (LGBTQ+ bar and club) are neighbourhood anchors. Broadway Market's Friday evening scene is more relaxed — outdoor tables at The Cat & Mutton and pub gardens along the canal. The CLF Art Café (Bussey Building, adjacent to Peckham) and XOYO (EC1) attract E8 residents for larger events. Hackney Arts Centre and Hackney Empire host theatre and comedy. The diversity of the evening offer — from market-stall beers to craft cocktail bars — is a genuine lifestyle draw.`,
      marketComment: `E8 is past the early-stage gentrification phase but still offers value relative to E2 and N1. The best buys are the Victorian terraces on the London Fields grid (Martello Street, Ada Street, Wilton Way) — these have the strongest long-term hold characteristics. Converted warehouse/industrial units offer loft appeal but watch service charges and management company quality carefully. Dalston properties sell at a modest discount to London Fields equivalents — the gap reflects the noisier street environment but should compress over time as Overground improvements and further regeneration around Dalston Junction take effect. Average days on market: 30–45 days — faster than many London postcodes, indicating healthy demand.`,
    },

    N1: {
      schoolsRating: 8.1,
      safetyRating: 8.0,
      transportRating: 9.6,
      walkability: 9.3,
      character: `N1 — Islington, Angel, and Barnsbury — is one of inner north London's most desirable residential postcodes. Barnsbury's Georgian terraces (Milner Square, Lonsdale Square, Gibson Square) are some of the finest Victorian streetscapes in London. Upper Street's continuous strip of restaurants, bars, and independent shops from Angel to Highbury Corner is arguably London's best neighbourhood high street. Islington has a literary-political identity — it was home to Tony Blair and the New Labour project, and retains an intellectual, culturally engaged character. Canal-side living on the Regent's Canal (between King's Cross and Angel) is a premium sub-market. Chapel Market, the last remaining traditional street market in inner north London, runs on Fridays and Saturdays.`,
      amenities: `Upper Street is exceptional — almost 2km of near-continuous independent and quality-chain restaurants and bars from Angel to Highbury & Islington. Camden Passage (off Upper Street) is London's best antiques street market. The Almeida Theatre (internationally regarded, Upper Street) and King's Head Theatre are cultural anchors. Chapel Market provides fresh produce and traditional market goods mid-week. The Screen on the Green independent cinema has operated since 1913. Waitrose (Upper Street) and a cluster of independent food shops cover daily grocery needs. Coal Drops Yard and King's Cross are 10 minutes' walk from the southern edge.`,
      greenSpace: `Highbury Fields (29 acres) in the northern part of the postcode provides a significant green space with sports pitches, a lido paddling pool, and community orchard. Gibson Square, Barnsbury Square, and Lonsdale Square are private residents-only garden squares — access is a key value driver for adjacent properties. The Regent's Canal towpath (running south to King's Cross and north to Camden) provides green active-travel infrastructure. Waterloo Playing Fields and Islington's network of smaller parks and open spaces add further green provision.`,
      transport: `Angel (Northern line — City branch, Zone 1) provides direct access to Bank (5 minutes), London Bridge (7 minutes), and King's Cross (2 minutes). Highbury & Islington (Overground, Victoria line, Zone 2) serves the northern end. King's Cross St Pancras (all major lines, Eurostar) is a 10-minute walk from the southern edge of N1. The 73, 38, 341, and 4 bus routes connect to central London, Hackney, and Essex Road. Journey to Canary Wharf: 20 minutes. Heathrow: 40 minutes.`,
      schools: `St Mary Magdalene Academy (state secondary, N7 border) and Elizabeth Garrett Anderson School (Outstanding girls' secondary, near N7) serve the north. Highbury Grove School is a respected local state secondary. St John's C of E Primary (Upper Street, Outstanding) and Our Lady's RC Primary are oversubscribed local primaries. Independent options: North London Collegiate (Edgware, bus-accessible), City of London Girls' School, and Highgate School (N6, 20 minutes by bus). Ofsted ratings for N1 primaries are generally Good to Outstanding — Islington has been a Local Authority that invests meaningfully in education.`,
      demographics: `N1 attracts media professionals, architects, lawyers, and academics — the area has a notably high proportion of Guardian and BBC employees. The demographic is solidly professional, 30–55, with strong owner-occupier rates in the Barnsbury and Canonbury streets. Gentrification in N1 is mature — the working-class community that gave rise to social housing estates on the western edge remains, creating the characteristic social mix that gives Islington its political reputation. Average household income is well above the London median.`,
      nightlife: `Upper Street has London's highest density of restaurants per linear metre in any residential postcode. Ottolenghi (the original), Dishoom Islington, Fredericks (1969 institution), The Almeida Restaurant, and Granita (Tony Blair's New Labour kitchen table restaurant) are part of Islington's dining canon. The Kings Head pub hosts regular theatre and comedy. The Union Chapel (Compton Terrace) is one of London's most unique music venues — a fully functioning Victorian Gothic church that hosts touring artists. The late-night scene stretches up to 2am on Upper Street but the broader area quietens by midnight.`,
      marketComment: `N1 is a mature prime market with relatively limited new supply. Barnsbury's Georgian streets (Gibson Square, Milner Square) represent the apex — these properties have a blue-chip quality that holds through cycles. The premium for properties on garden squares is real and persistent — expect 10–20% above equivalent non-square properties. Canal-side conversions (City Road Basin, Eagle Wharf) offer a premium lifestyle format with modest capital growth relative to houses. The southern end of N1 (toward EC1) continues to benefit from the Silicon Roundabout/Clerkenwell effect. Best value: the streets between Caledonian Road and Copenhagen Street where N1 transitions to N7.`,
    },

    SE1: {
      schoolsRating: 7.9,
      safetyRating: 7.8,
      transportRating: 9.7,
      walkability: 9.5,
      character: `SE1 — Southwark, Bermondsey, and London Bridge — is the South Bank's premier postcode. The Tate Modern, Shakespeare's Globe, Borough Market, and the Shard define the area's cultural and commercial profile globally. SE1 is one of London's most transformed postcodes — the railway arches from Bermondsey to London Bridge now house galleries, restaurants, and designer studios where previously there was light industry. The riverside walk from Westminster Bridge to Tower Bridge passes through SE1 and is one of the most extraordinary urban promenades in Europe. Bermondsey Street has developed into a design and food district of genuine international standing.`,
      amenities: `Borough Market (operated since 1276, Thursday–Saturday) is the UK's oldest and most celebrated food market — a world-class grocery and prepared food destination. Bermondsey Street hosts specialist food importers, Le Pont de la Tour, and White Cube Gallery. Maltby Street Market (Saturdays) is the producers' market that overflowed from Borough. The Tate Modern (free) and Shakespeare's Globe are world-class cultural assets within the postcode. London Bridge City and the More London riverside development provide comprehensive business and retail amenity. The Shard's Aqua Shard and HUTONG restaurants offer premium dining with views.`,
      greenSpace: `Potters Fields Park (4.7 acres) sits directly behind City Hall with views of Tower Bridge — a quality small park in an otherwise urban environment. Bermondsey Spa Garden and Leathermarket Gardens are well-maintained community spaces. The river is the dominant green/blue asset — the Thames Path is a world-class linear park connecting SE1 to the City, Westminster, and Greenwich. Burgess Park (56 acres, SE5) is accessible by bus or short cycle and provides the nearest major open space.`,
      transport: `SE1 has exceptional connectivity for a south London postcode. London Bridge (Northern, Jubilee, and National Rail — thameslink to Gatwick, Bedford, Brighton) is a major hub. Waterloo (Bakerloo, Jubilee, Northern, Waterloo & City, National Rail — largest station in the UK) serves the western end. Bermondsey (Jubilee, Zone 2) and Borough (Northern, Zone 1) serve the middle. Elephant & Castle (Northern, Bakerloo) is at the southern edge. Journey to Canary Wharf: 8 minutes (Jubilee). Heathrow: 40 minutes. Bank: 5 minutes.`,
      schools: `Borough School (state primary, Outstanding) and Cathedral School of St Saviour and St Mary Overie are well-regarded local primaries. Notre Dame RC Girls' School (Outstanding secondary, Lambeth border) serves SE1 girls. Ark Globe Academy is a well-performing academy secondary. Independent options are limited within SE1 — parents typically look to Dulwich College, James Allen's Girls' School, and the Alleyn's cluster in SE21/SE22 for independent provision. King's College London and Guy's Hospital (SE1) provide a significant student and professional community.`,
      demographics: `SE1 has undergone dramatic demographic change in 20 years — from a light-industrial and social housing postcode to one of the most sought-after inner London addresses. The riverside tower market (One Tower Bridge, NEO Bankside) attracts international investors and City professionals. Bermondsey's loft conversions draw creative-sector buyers. A significant proportion of SE1 residents are single-person households under 40. Rental demand is extremely high given the City/Canary Wharf proximity and cultural amenities. Owner-occupier rate is growing as values stabilise.`,
      nightlife: `SE1 has the South Bank's internationally recognised arts and entertainment infrastructure. The National Theatre, BFI Southbank, and Royal Festival Hall anchor the cultural offer. Bermondsey Street at night — Bar Tozino (sherry bar), Bermondsey Arts Club, Pizarro — is one of the most animated streets in London. The areas around London Bridge Station (Flat Iron Square, Vinegar Yard) have become major Friday-evening destinations. Maltby Street after dark is an extension of the weekend market scene. The late-night market is quieter than N1 or E8 but the daytime and early-evening offer is unmatched.`,
      marketComment: `SE1 offers genuine value relative to equivalent-specification properties north of the river. A £1m flat in NEO Bankside (Tate Modern-adjacent) would command 15–20% more if it were in SW3. The waterfront premium is real and durable — target properties with Thames views or Bermondsey Street addresses. Avoid overpriced new-build towers with declining service charges and weak management; Southwark Council has several ongoing disputes with freehold landlords over maintenance. The best capital growth story in SE1 is Bermondsey: the arc from Maltby Street to Old Jamaica Road is still genuinely transitional and offers value against Borough Market-adjacent pricing.`,
    },

    EC1: {
      schoolsRating: 8.2,
      safetyRating: 8.3,
      transportRating: 9.7,
      walkability: 9.6,
      character: `EC1 — Clerkenwell and Farringdon — is London's historic artisan and creative district. Clerkenwell was home to watchmakers, goldsmiths, and printers for 300 years; today it hosts the highest concentration of architects and creative agencies in the world. The area's industrial heritage (warehouses, former print works, Georgian terraces with large windows) makes it the natural habitat for live-work lofts and converted industrial spaces. Exmouth Market is one of inner London's best neighbourhood streets — compact, high-quality, and intensely local. The proximity to the City of London (five minutes' walk to Barbican, St Paul's) gives EC1 a dual identity: creative village by day, financially-adjacent by commute.`,
      amenities: `Exmouth Market (Mon–Fri lunch, food stalls and restaurants) is EC1's high street in miniature — Moro, Caravan, Berber & Q, and GRIND coffee are local institutions. Smithfield Market (the UK's largest wholesale meat market, gradually relocating to Dagenham) is a historic EC1 landmark. The Barbican Centre (EC2 border) provides world-class theatre, cinema, and art gallery facilities. Spa Fields park and the Ironmonger Row Baths (Victorian public baths, Grade II listed) serve leisure needs. Multiple independent coffee shops, design studios, and gallery spaces along Farringdon Road and St John Street.`,
      greenSpace: `Spa Fields (EC1R) is the primary green space — a modest but well-maintained park with playground and open lawn. The Barbican's lakeside gardens and ornamental pools are a short walk (accessible to non-residents). Bunhill Fields burial ground (EC1Y) is a remarkable 17th-century garden cemetery — William Blake and Daniel Defoe are buried here — and functions as a quiet urban green space. Highbury Fields and Islington's wider green network are accessible by bus or cycle northward.`,
      transport: `Farringdon (Circle, Metropolitan, Hammersmith & City — and Elizabeth line Crossrail) is the area's superstation — providing direct services to Heathrow (29 minutes), Canary Wharf (13 minutes), and Paddington (9 minutes). Angel (Northern) is a 10-minute walk. Barbican (Circle, Metropolitan, Hammersmith & City) serves the eastern boundary. Clerkenwell Road and Farringdon Road are major cycling routes with protected lanes. Journey to Canary Wharf: under 15 minutes. Heathrow: 29 minutes. Gatwick: 35 minutes (via Thameslink from Farringdon).`,
      schools: `Hugh Myddelton Primary School (Outstanding) and Moreland Primary School are the main local primaries. St Luke's C of E Primary (EC1V) is highly rated. Clerkenwell Parochial C of E Primary is another Good-rated option. Secondary provision within EC1 is limited — most families look to N1 (St Mary Magdalene Academy), EC2 (City of London School), or farther north (Highbury Grove, Islington). Independent access: City of London School (£22,000/year, EC4, walkable) and JAGS in SE22 by bus.`,
      demographics: `EC1 is the home postcode of choice for architects, designers, creative directors, and City-adjacent professionals who value urban living over residential quietude. A high proportion of single-person and childless couple households. Younger skew than most prime postcodes — average resident age is approximately 35–45. A growing tech and startup community has migrated from Shoreditch into Clerkenwell as rents in E1/E2 increased. Rental demand is extremely high — EC1 is a strong BTL postcode for City worker proximity.`,
      nightlife: `Exmouth Market and St John Street host several of London's most respected restaurants — St John (Fergus Henderson's nose-to-tail institution), Moro, and The Quality Chop House are national dining landmarks. The Craft Beer Co (Leather Lane), Jerusalem Tavern (Britton Street, 17th century, Fuller's Smith Turner), and Vinoteca (St John Street) are neighbourhood pub institutions. The Barbican Cinema and Barbican Theatre provide serious cultural programming. Fabric (Charterhouse Street) is one of the world's most respected electronic music clubs — 24-hour licence, world-class bookings.`,
      marketComment: `EC1 is one of the best postcode plays in inner London for buy-to-let — City worker proximity, exceptional transport (Farringdon Elizabeth line), and a built-in rental demand from the creative sector combine to deliver consistent yields of 3.5–4.5% gross. Converted loft spaces (former warehouse, former office) outperform new-build in this market. Service charge management in conversion buildings is highly variable — commission a detailed service charge review (Leasehold Advisory Service) before exchange. Farringdon East and the City fringe (EC1M/EC1V) are the current value-growth frontier as the Elizabeth line effect continues to diffuse northward. Avoid basements without planning-approved natural light solutions.`,
    },

    M1: {
      schoolsRating: 7.8,
      safetyRating: 7.0,
      transportRating: 9.4,
      walkability: 9.2,
      character: `M1 — Manchester City Centre — is the Northern Powerhouse's most concentrated residential and commercial hub. The postcode spans Piccadilly, Ancoats, the Northern Quarter, and the southern fringe of NOMA (the developing tech and media district anchored by BBC MediaCityUK's city-centre operations). The Northern Quarter is Manchester's equivalent of London's Shoreditch — independent record shops, vintage fashion, street art, and creative agencies on every corner. Ancoats, once the world's first industrial suburb, is now one of the UK's most admired urban regeneration stories: Victorian mills converted to premium loft apartments, with a restaurant scene (Elnecot, Rudy's, NOMA) that rivals London. Piccadilly Gardens marks the civic heart.`,
      amenities: `The Northern Quarter's Tib Street and Oldham Street host record shops (Vinyl Exchange, Eastern Bloc), independent clothing, and the best independent café cluster in the North of England. Mackie Mayor (the Edwardian market hall in Ancoats) and Vero Moderno anchor a premium food-and-drink destination. The Arndale Centre provides comprehensive high-street retail. Manchester's Chinatown (adjacent to M1) is the UK's largest outside London. First Street (HOME cinema/arts complex) and the Science and Industry Museum (free entry, Castlefield) are significant cultural assets within reach.`,
      greenSpace: `St John's Gardens (M3 border, 15 minutes' walk) and Piccadilly Gardens (undergoing redesign) provide the nearest formal green space. Ancoats' Cutting Room Square is a high-quality public realm space at the heart of the regeneration zone. Heaton Park (Manchester's largest park, 600 acres) is 4 miles north by tram — the biggest open space in the city. The Medlock River walk and canal towpaths (Rochdale Canal, Ashton Canal) provide active-travel green corridors directly through M1 into the wider Greater Manchester cycle network.`,
      transport: `Manchester Piccadilly (National Rail — fastest UK intercity route to London Euston, 2h02 by Avanti West Coast) is the primary rail hub. Manchester Victoria (Northern Rail, Trans-Pennine Express) provides additional connectivity. The Metrolink tram network connects Piccadilly to the Airport (30 minutes), Salford Quays/MediaCity, and across Greater Manchester. Journey to London Euston: 2 hours 2 minutes. Manchester Airport: 25 minutes by Metrolink. Liverpool Lime Street: 45 minutes. Leeds: 55 minutes.`,
      schools: `Manchester Grammar School (one of the UK's highest-performing independent schools, fees ~£14,500/year) is in M13 — accessible by bus from M1. Xaverian College (sixth form, free) has a strong A-level track record. Chetham's School of Music (M3, adjacent) is world-renowned for specialist music education (funded places available). State secondaries in M1 include Manchester Academy and Manchester Communication Academy. Independent prep schools: Withington Girls' School (M20) and Cheadle Hulme School are accessible by tram and rail respectively.`,
      demographics: `M1's residential population is predominantly young professionals (22–40), students from the University of Manchester and Manchester Metropolitan University, and creative/media sector workers. The Northern Quarter in particular is the natural habitat of designers, musicians, DJs, and independent business owners. Ancoats' new-build premium has attracted City-equivalent earners relocating from London or seeking a second city base. Rental demand in M1 is the strongest in the North of England — university proximity and business district adjacency deliver occupancy rates above 95%.`,
      nightlife: `Manchester's night-time economy is the best outside London. The Northern Quarter (NQ) alone has over 100 bars and restaurants. Elnecot (Ancoats), Hawksmoor Manchester (Deansgate), Bundobust (vegetarian street food), and Mackie Mayor provide the quality dining anchor. The gay village on Canal Street (200 metres from M1) is one of Europe's most celebrated LGBTQ+ nightlife districts. The Warehouse Project (Mayfield Depot, M12) is Manchester's largest electronic music venue — 10,000 capacity, nationally significant programming. Band on the Wall (Swan Street) and YES (Charles Street) are respected live music venues within M1.`,
      marketComment: `M1 offers the most compelling investment case outside London for yield-focused buyers. Gross BTL yields of 5–7% in Ancoats and the Northern Quarter are achievable at current pricing — underpinned by permanent student demand and a young professional rental market. The new-build premium in Ancoats (Crusader Mill, Stubbs Mill) is supported by genuine lifestyle product, but the service charge trajectory deserves scrutiny on taller blocks. Focus on converted mill buildings over purpose-built residential towers for superior capital appreciation — the heritage conversion premium is persistent in Manchester. The NOMA and First Street developments (M3/M15 adjacent) continue to drive values northward and southward from M1. HS2's proposed Manchester Piccadilly terminus (if confirmed) would be a material catalyst.`,
    },

    B1: {
      schoolsRating: 7.5,
      safetyRating: 6.9,
      transportRating: 8.8,
      walkability: 8.5,
      character: `B1 — Birmingham City Centre — is the UK's second-largest urban economy undergoing its most significant transformation in 40 years. The 2022 Commonwealth Games delivered HSBC UK's national headquarters relocation to Centenary Square and catalysed regeneration from Digbeth to the Jewellery Quarter. Broad Street (B1's entertainment spine) and Brindleyplace (waterside business and leisure district) anchor the commercial identity. The Jewellery Quarter — Birmingham's historic manufacturing hub — has become one of the most compelling urban residential and creative neighbourhoods in the UK outside London, with Victorian workshops converted to loft living and independent studios. B1 is simultaneously old Birmingham and new Birmingham.`,
      amenities: `Brindleyplace hosts restaurants (La Tasca, Canalside), bars, and the National Indoor Arena. Broad Street is B1's entertainment corridor — primarily late-night venues and chain restaurants. The Bullring and Grand Central (adjacent, B5) provide John Lewis, Selfridges (architecturally iconic), and comprehensive retail. The Jewellery Quarter has independent cafes (Quarter Horse Coffee, Kanteen), creative studios, and a Saturday antiques and maker's market on Vyse Street. Birmingham Museum and Art Gallery (free entry) and Symphony Hall (world-class classical programming) are cultural assets within walking distance.`,
      greenSpace: `Centenary Square (B1) is a major civic public realm space — reopened post-regeneration with the Library of Birmingham and Repertory Theatre as anchors. Chamberlain Square provides additional urban civic space. The Birmingham Canal network runs through B1 with towpath walking and cycling accessible from Gas Street Basin. Cannon Hill Park (2.5 miles south, B12) is Birmingham's premier park — 80 acres with a boating lake and the MAC arts centre. The towpath links northward to Smethwick and the broader canal network.`,
      transport: `Birmingham New Street (National Rail — London Euston from 82 minutes, Bristol from 67 minutes, Manchester from 78 minutes) is the UK's busiest rail interchange outside London. Birmingham Snow Hill (Chiltern Railways to London Marylebone from 1h46, West Midlands Metro) and Moor Street (Chiltern Railways, Cross-City) provide additional service. West Midlands Metro trams connect B1 to Wolverhampton. Journey to London: from 82 minutes (Avanti West Coast). Manchester: from 78 minutes. The HS2 Curzon Street Station (under construction in B4) will transform Birmingham-London journey times to 52 minutes when operational.`,
      schools: `King Edward VI Grammar Schools (multiple selective state schools in Birmingham — including King Edward VI Five Ways in B32) are nationally top-ranked and accessible from B1 by public transport. Birmingham University School (B15) is Outstanding. King Edward's School (independent, B15, ~£15,000/year) and Edgbaston High School for Girls are the dominant independent options. State secondary provision within B1 itself is limited — most families look to the outstanding selective grammar network across the wider city. University of Birmingham (B15) and Aston University (B4) are major graduate employment anchors nearby.`,
      demographics: `B1 is a young, economically diverse postcode. HSBC UK's relocation (5,000 employees), the growth of the Jewellery Quarter creative economy, and Birmingham's large student population (70,000+ across the city's universities) drive a predominantly 22–40 demographic. The Commonwealth Games effect has accelerated out-of-London relocation — professionals from London, Manchester, and Leeds are increasingly choosing Birmingham for space, lower cost, and improving cultural offer. Owner-occupier rates are growing in Jewellery Quarter but remain modest in B1 overall. Rental demand is strong, particularly from HSBC UK and PwC/Deloitte employees based at Centenary Square.`,
      nightlife: `Broad Street and the Arcadian Centre (B5) anchor Birmingham's mainstream night-time economy. For quality dining: Adam's Restaurant (Waterloo Street, Michelin-starred), Simpsons (Edgbaston, Michelin-starred), Baked in Brummie. The Jewellery Quarter's Friday evening scene — The Lord Clifden, The Anchor, 1000 Trades (craft beer) — is the city's most independent and quality-focused bar strip. Symphony Hall is among the UK's acoustically finest concert venues. Birmingham REP (Centenary Square) produces nationally touring theatre. Printworks and Venue 54 serve the late-night club market.`,
      marketComment: `B1 is the most compelling regional city investment case in the UK for medium-term capital growth. The HS2 Curzon Street Station (due approximately 2033) will reduce Birmingham-London journey time to 52 minutes — this is a structural demand driver not yet fully priced in. Jewellery Quarter conversions are the premium product: target Vyse Street, Spencer Street, and Hockley Hill for the best heritage-premium assets. Service charge management in the newer Brindleyplace towers has been inconsistent — check historical service charge accounts (3 years) before proceeding. Gross BTL yields of 5.5–7.5% in B1 are supported by the student and professional rental base. Monitor B4 Digbeth closely — the HS2 Curzon Street effect will radiate outward.`,
    },

    LS1: {
      schoolsRating: 7.6,
      safetyRating: 7.1,
      transportRating: 8.6,
      walkability: 8.9,
      character: `LS1 — Leeds City Centre — is the financial, legal, and retail hub of West Yorkshire. Leeds has the UK's highest proportion of young professionals outside London, driven by a booming financial services sector (HSBC, First Direct, NHS Digital, Eversheds Sutherland), three universities (University of Leeds, Leeds Beckett, Leeds Arts University), and improving cultural infrastructure. The historic Victorian arcades (Thorntons Arcade, Grand Arcade, Victoria Quarter — the UK's finest shopping arcade, Grade II listed) are a remarkable urban heritage asset. The waterfront at Granary Wharf (LS1/LS2 border) has become the most vibrant residential and leisure district in Yorkshire.`,
      amenities: `The Victoria Quarter is the North's answer to Burlington Arcade — Harvey Nichols, Vivienne Westwood, and luxury independents in a Grade I listed Victorian arcade. Trinity Leeds (John Lewis, M&S, Zara, and extensive F&B) provides comprehensive high-street retail. Granary Wharf's Dark Arches house independent restaurants, craft beer bars, and a weekend food market. Kirkgate Market (the UK's largest covered market, open 6 days a week) provides excellent fresh produce and variety retail. Headrow House (rooftop bar and restaurant complex) and EAST (Merrion Street) represent the premium evening offer.`,
      greenSpace: `Woodhouse Moor (Hyde Park, LS6) is the nearest significant park — 28 acres, 20 minutes' walk from LS1. Roundhay Park (700 acres, Leeds' largest, LS8) is 4 miles north by bus — one of the UK's finest urban parks with a lakeside café, tropical world, and events venue. The Leeds-Liverpool Canal towpath runs through LS1 at Granary Wharf, providing active-travel green infrastructure westward toward Saltaire and Skipton. Armley Park and Cross Flatts Park (south Leeds) provide additional green access by bus.`,
      transport: `Leeds railway station (National Rail — London King's Cross from 2h08 by LNER, Manchester Piccadilly from 57 minutes, Edinburgh from 2h21) is the UK's second-busiest rail station outside London by footfall. Bus connectivity across West Yorkshire is managed by West Yorkshire Combined Authority. Airedale and Wharfedale lines serve surrounding towns. Planned Leeds Mass Transit scheme (West Yorkshire Combined Authority, decision pending) will add tram/light rail connectivity across LS postcodes. Leeds Bradford Airport is 8 miles northwest — 25 minutes by car or taxi.`,
      schools: `Grammar school provision: the nearest selective state schools are in Calderdale and Kirklees — Leeds itself has no remaining grammar schools. Leeds Grammar School (Alwoodley, LS17, independent, ~£14,000/year) and Leeds Girls' High School (Headingley, LS6, independent) are the dominant independent options. Lawnswood School (Outstanding comprehensive, LS16) is the leading state secondary for LS1/LS6 residents. Roundhay School (Outstanding, LS8) is another well-regarded state option. University of Leeds proximity means an unusually high concentration of outstanding maintained school performance in LS6 and LS7 adjacent postcodes.`,
      demographics: `Leeds city centre has the youngest urban population in England by median age outside London. Financial services (First Direct, HMRC Digital, law firms on Park Row), the NHS Digital headquarters, and three universities combine to create a rental market unlike most Northern cities. A significant number of young professionals have chosen LS1 as a long-term buy (rather than rent) base given the value proposition — a two-bedroom flat in central Leeds costs less than a comparable studio in zone 3 London. Owner-occupier rates in LS1's new-build market are growing, particularly in Granary Wharf and the South Bank.`,
      nightlife: `Leeds is consistently rated one of the UK's top cities for nightlife. Merrion Street and The Call Lane (LS1) are the city's main bar and club strips. Belgrave Music Hall (Meanwood Road) and Stylus (University of Leeds) host quality live music. Crafthouse (Trinity Leeds) and The Man Behind the Curtain (Vicar Lane, Michelin-starred) represent the fine dining offer. The Corn Exchange (Grade I listed, Kirkgate) hosts arts events and independent food vendors. Bramham Park (6 miles south) hosts Leeds Festival — one of the UK's largest music festivals — in August.`,
      marketComment: `LS1 offers the UK's most compelling value-to-yield residential investment proposition outside Manchester. Gross BTL yields of 6–8.5% in LS1 new-builds are backed by persistent student and professional rental demand. The South Bank regeneration (LS10/LS11 adjacent) is the city's decade-defining infrastructure project — model units along the new waterfront will drive values northward from Granary Wharf. Heritage conversions in the city's Victorian warehouse cluster (around Dock Street and Waterloo Street) consistently outperform purpose-built residential towers on capital appreciation. Watch for: West Yorkshire Mass Transit approval — a confirmed tram network would be a material upward catalyst for LS1 residential pricing.`,
    },

    BS1: {
      schoolsRating: 7.8,
      safetyRating: 7.5,
      transportRating: 8.3,
      walkability: 9.0,
      character: `BS1 — Bristol City Centre, Harbourside, and Old City — is England's most acclaimed urban regeneration story of the past 20 years. The Harbourside transformation — from working docks to a mixed residential, cultural, and leisure district — has created one of the most liveable city-centre environments in the UK. The SS Great Britain (Brunel's masterpiece, now a museum at Great Western Dockyard), the M Shed Museum, Watershed media centre, and Arnolfini gallery create a cultural density that few UK cities match outside London. Bristol consistently tops UK liveability and sustainability rankings, and its creative economy (Channel 4's national HQ relocated here in 2021, Aardman Animations, ITV West) has attracted a dynamic professional base.`,
      amenities: `St Nick's Market (daily, Grade II listed Victorian market) is the city centre's covered market — street food traders, independent stalls, and the Glass Arcade with independent retailers. Cabot Circus and Broadmead provide comprehensive retail including John Lewis. Wapping Wharf's container market (CARGO) hosts independent food vendors and artisan producers in repurposed shipping containers. Clifton Village (BS8, 20 minutes' walk) is one of the UK's great neighbourhood high streets — Waitrose, Michelin Guide restaurants, art galleries, and boutique shops. Harbourside farmers' market (Wednesday and Saturday) provides premium produce.`,
      greenSpace: `The Floating Harbour itself is BS1's defining green-blue asset — 82 acres of water with walking paths along the entire perimeter, annual Harbour Festival (300,000 visitors), and kayaking clubs. Brandon Hill (12 acres) provides elevated city views from Cabot Tower and a formal park with botanical gardens. Queen Square (a Grade I listed Georgian square with equestrian statue) is a residents' urban garden. Ashton Court Estate (850 acres, BS3) is 2 miles south — Bristol's equivalent of Hyde Park, with mountain bike trails, deer, and a golf course.`,
      transport: `Bristol Temple Meads railway station (20-minute walk or bus from BS1) connects to London Paddington from 1h33 (GWR), Cardiff Central from 47 minutes, and Birmingham New Street from 67 minutes. Bristol Bus Station (Marlborough Street) serves National Express and local First West of England buses. Metrobus rapid transit serves the temple quarter. Bristol Airport is 8 miles south — 30 minutes by taxi. A significant limitation: Bristol does not have a metro or light rail system — this is the most frequently cited infrastructure gap and is subject to ongoing West of England Combined Authority planning.`,
      schools: `Bristol Grammar School (independent, BS8, ~£16,000/year) and Clifton College (full boarding available, ~£40,000/year) are Bristol's flagship independent schools. Bristol Cathedral Choir School (Outstanding state) is a rare music-specialist free school in the city centre. St Mary Redcliffe and Temple Church of England School (Outstanding comprehensive) serves BS1 and adjacent south Bristol. Independent alternatives: Badminton School (girls' boarding, BS9), The Red Maids' School (BS9). University of Bristol and University of the West of England are significant graduate talent anchors.`,
      demographics: `BS1 attracts a younger-than-national-average professional demographic — media, creative, and tech workers drawn by Bristol's cultural reputation and significantly lower living costs than London. Channel 4's national HQ (Finzels Reach, BS1) has brought an influx of broadcast and media professionals. Aardman, Hargreaves Lansdown (FS sector), and a growing FinTech cluster (Bristol is the UK's second-largest FinTech hub) create a diverse professional base. Average household income in BS1 is above the Bristol median but below equivalent London postcodes — this is a relative value story.`,
      nightlife: `Bristol has one of the UK's most distinctive nightlife scenes — credited as the birthplace of trip-hop (Portishead, Massive Attack, Tricky) and a key node in the UK's drum and bass, grime, and indie music heritage. SWX (CS Lewis Square), Motion (Avon Street, 3,000 capacity), and the Thekla (floating vessel nightclub on the Harbourside) are the club anchors. For dining: Casamia (Westbury-on-Trym, Michelin-starred), Wilsons (Redland), and Flour & Ash (Bedminster) represent the quality dining scene. Stokes Croft (BS2) is the alternative arts and cultural strip — live music, murals, and independent bars. Harbourside's restaurants along Wapping Wharf and Welsh Back are the premium casual-dining district.`,
      marketComment: `BS1 is the UK's strongest-performing regional city postcode for lifestyle-driven long-term holds. Channel 4's relocation and Bristol's growing FinTech cluster have structurally strengthened the demand base. Harbourside waterfront properties — particularly those with direct harbour views from Wapping Wharf and the Gas Ferry Road area — command a premium that has proved remarkably durable through cycles. The primary risk is the lack of a mass transit system: if the West of England Combined Authority fails to deliver a metro scheme, Bristol's growth in BS1 will be transport-constrained relative to Leeds or Manchester. Clifton (BS8) is the established prime neighbourhood benchmark — BS1 buyers who outgrow city-centre living transition to Clifton; pricing your entry point in BS1 with a Clifton exit path in mind is a sound long-term strategy.`,
    },

    EH1: {
      schoolsRating: 8.5,
      safetyRating: 8.7,
      transportRating: 8.4,
      walkability: 9.5,
      character: `EH1 — Edinburgh Old Town and New Town — is Scotland's most prestigious residential postcode and one of Europe's great historic urban environments. The Royal Mile (Castle to Palace of Holyroodhouse) defines the Old Town's spine; the Georgian New Town (EH1/EH2/EH3, collectively a UNESCO World Heritage Site) is the finest planned urban neighbourhood in the UK and arguably in Europe. Charlotte Square, Moray Place, and Heriot Row represent the apex of Georgian residential design. Edinburgh's property market operates under Scots law (offers over system, no gazumping) and Scottish Land and Buildings Transaction Tax (LBTT) — different from England and requiring specialist legal advice. EH1 is both a tourist city (13 million visitors annually, World Heritage Site) and a deeply residential community.`,
      amenities: `Princes Street and George Street provide comprehensive retail — Jenners (Grade A listed department store), Harvey Nichols, and the recently expanded St James Quarter (2021 opening). Victoria Street (leading to the Grassmarket) is Edinburgh's most photographed independent retail street — independent cheese shops, wine merchants, and design studios. The Grassmarket itself hosts weekly markets and is a hub of independent bars and brasseries. Waitrose and Sainsbury's serve the New Town. The Scottish National Gallery and National Museum of Scotland (free entry) are world-class cultural institutions within EH1.`,
      greenSpace: `Princes Street Gardens (West and East) sit at the foot of Edinburgh Castle Rock — one of the most dramatically situated public parks in the world. Holyrood Park (260 acres) is directly accessible from the Royal Mile — includes Arthur's Seat (250m peak, ancient volcano) with extraordinary city and sea views. The Royal Botanic Garden (EH3, 20 minutes' walk) provides 70 acres of formal planting. The Water of Leith walkway runs through Edinburgh from the Pentland Hills to the Firth of Forth — a 12-mile linear green corridor. Edinburgh is uniquely endowed with dramatic natural topography within its urban fabric.`,
      transport: `Edinburgh Waverley station (National Rail — London King's Cross from 4h30 by LNER direct, Glasgow Queen Street from 50 minutes) is at the base of the New Town. Edinburgh Airport is 8 miles west — approximately 25 minutes by tram (Edinburgh Trams, which now serve central Edinburgh through a rebuilt network). Lothian Buses provide extensive city coverage. Note: EH1 is outside Land Registry England and Wales data coverage — Scottish property data is held by Registers of Scotland and follows different legal conventions. Commission a Scottish solicitor qualified in Scots conveyancing before proceeding.`,
      schools: `The Edinburgh Academy (independent, EH3, ~£17,000/year) and George Watson's College (independent, EH10, ~£15,000/year) are Edinburgh's most established independent schools. Edinburgh High School (state, Parkside) and James Gillespie's High School (state, EH10) are the most competitive state comprehensives for EH1 catchment. Boroughmuir High School (state, EH10) is also highly regarded. Royal High School (state, EH7) has a strong arts and music tradition. Scottish independent school fees are broadly lower than their London equivalents. Gaelic medium education available through Tollcross Primary (EH3).`,
      demographics: `EH1's resident population is a blend of legal and financial professionals (the Edinburgh legal and financial services sector is the UK's second largest), Scottish government workers (Scottish Parliament is at Holyrood, EH99), academic staff from the University of Edinburgh (EH8), and a significant international community drawn by Edinburgh's UNESCO World Heritage status. The Edinburgh Festival Fringe (August) temporarily quadruples the population and creates a short-let rental market unlike any other city. Average property values in EH1 are significantly below London prime equivalents at equivalent quality level — international buyers increasingly recognise this.`,
      nightlife: `The Grassmarket and Cowgate (EH1) are Edinburgh's historic pub and bar strips — The Last Drop, White Hart Inn (Edinburgh's oldest pub, 1516), and Bow Bar are local institutions. The Royal Mile hosts whisky bars and traditional Scottish restaurants. For quality dining: Restaurant Martin Wishart (Leith, Michelin-starred), The Witchery by the Castle, and 21212 (EH7, Michelin-starred) are the fine dining anchors. Edinburgh's jazz and blues scene (Henry's Cellar Bar), live folk music (Royal Oak), and Traverse Theatre (EH1, world-leading new writing theatre) provide rich cultural programming year-round. Edinburgh Festival August — the world's largest arts festival — transforms every available venue.`,
      marketComment: `EH1 property operates under Scots law — offers over system, no binding contracts until missives are concluded, and LBTT (Scottish Land and Buildings Transaction Tax) applies instead of SDLT. Additional Dwelling Supplement (ADS) at 6% applies to second properties in Scotland. Commission a solicitor member of the Law Society of Scotland before viewing. The Old Town conservation requirements (UNESCO World Heritage Site) restrict permitted development but preserve the character that underpins long-term values. New Town Georgian flats (first-floor preferred — the piano nobile — for height and proportion) consistently outperform attic and basement conversions on capital appreciation. The post-pandemic demand surge for EH1 from London and international buyers has been sustained — Edinburgh residential values have grown faster than any UK city outside London over 5 years.`,
    },

    OX1: {
      schoolsRating: 9.4,
      safetyRating: 8.8,
      transportRating: 8.2,
      walkability: 9.6,
      character: `OX1 — Oxford City Centre, Jericho, and the University Quarter — is unique in the UK: a medieval city that is simultaneously one of the world's great universities and one of its most desirable residential postcodes. Dreaming Spires defines the skyline; Broad Street, the High Street, and Turl Street form one of the most architecturally remarkable townscapes in Europe. Jericho (northwest OX1/OX2 border) is Oxford's bohemian residential village — the Jericho Café, Oxford University Press (a Jericho institution), and Victorian terraces on Cardigan Street and Observatory Street. North Oxford (OX2/OX3) commands the highest residential values; OX1 contains the civic and academic heart.`,
      amenities: `The Covered Market (High Street, operating since 1774) is one of England's finest indoor markets — butchers, cheesemongers, florists, cobblers, and the original Brown's Café. Gloucester Green market (Wednesdays and Saturdays) adds organic produce and artisan goods. Cowley Road (E of OX1) is Oxford's multicultural high street — the best independent restaurant strip in Oxfordshire. Waitrose and M&S on Queen Street. The Bodleian Library (open to day visitors) and Ashmolean Museum (free entry, world's finest university museum of art and archaeology) are cultural treasures within walking distance of any OX1 address.`,
      greenSpace: `University Parks (70 acres, OX1/OX2) are the jewel — 70 acres of formal parkland with cricket pitch, arboretum, and the Cherwell River running through them. Christ Church Meadow (90 acres, maintained by Christ Church College) is a city-centre meadow of extraordinary quality — accessible to the public and used for cattle grazing. Port Meadow (350 acres, OX2) is an ancient common meadow that has never been ploughed — open year-round for walking and horse riding. The River Cherwell provides punting access from Magdalen Bridge. Oxford has more usable green space per resident than almost any UK city.`,
      transport: `Oxford railway station (National Rail — London Paddington from 56 minutes by GWR, Birmingham New Street from 67 minutes, Manchester from 2h30) connects OX1 nationally. The Oxford Tube and X90 coach services to London Victoria (from 90 minutes) are popular alternatives to rail. Oxford Brookes Bus and Park & Ride sites ring the city (residents are encouraged to avoid driving into the city centre). Heathrow Airport is 55 miles southeast — approximately 60–75 minutes by car or the Oxford to Heathrow coach (running every 30 minutes). HS2's proposed connection via Cherwell Valley line is subject to ongoing planning uncertainty.`,
      schools: `Oxford has an extraordinary independent school provision. Oxford High School (GDST, Outstanding, one of the UK's top girls' schools), Magdalen College School (Outstanding, one of the UK's top day schools), and Dragon School (Bardwell Road, the UK's most famous prep school) are within OX2/OX4 — accessible from OX1 by cycle or bus. St Edward's School and Headington School offer boarding and day options. State provision: Cheney School (Outstanding, OX3) and Oxford Spires Academy are the leading comprehensives. The Cherwell School (OX2) is also well-regarded. Oxford's grammar school provision: Oxfordshire phased out selective state schools — independent schools fill this role for academic families.`,
      demographics: `OX1 has the highest concentration of PhD holders per square mile in the UK (University of Oxford employs approximately 15,000 staff). The academic-professional demographic is strong: fellows, professors, visiting scholars, and university administrators alongside legal, medical, and financial professionals. A significant international community drawn by the university. Average household income in OX1 is above the UK median but property values are very high — the premium is driven by aspiration and institutional demand. Second-home ownership by London-based families is meaningful in north Oxford; many OX1 residents maintain a London pied-à-terre.`,
      nightlife: `Oxford's evening offer reflects its character — intellectual, quality-focused, and early by London standards. The Bear Inn (Alfred Street, 1242 — one of England's oldest pubs), The Turf Tavern (a back-alley institution), and The Eagle and Child (Tolkien and C.S. Lewis's pub) are historic highlights. For dining: Old Bank Hotel's Quod brasserie, Manos (Lebanese, Walton Street), and Branca (Jericho, Italian) are neighbourhood reliables. The Oxford Playhouse and New Theatre stage national touring productions. The Said Business School and Balliol College host public lectures that are a feature of Oxford's intellectual nightlife. Last orders at most pubs by 11pm — Oxford is not a late-night city.`,
      marketComment: `OX1 is a prime market with structural demand constraints: planning restrictions (Green Belt, conservation areas, and flood plain around the Cherwell and Thames) severely limit new housing supply. This supply constraint is the dominant long-term value support mechanism. The premium for Victorian terraces in Jericho and North Oxford (OX2 border) over equivalent-specification properties in Reading or Swindon is approximately 40–60% — and has persisted through every property cycle since the 1980s. The Oxfordshire Local Plan's ambition for new housing consistently underperforms against delivery — this is structurally positive for existing owners. Buy within cycling distance of the city centre — properties beyond 2 miles lose significant desirability relative to the inner core for the university-affiliated buyer demographic.`,
    },

    CB1: {
      schoolsRating: 9.1,
      safetyRating: 8.8,
      transportRating: 8.5,
      walkability: 9.4,
      character: `CB1 — Cambridge City Centre, Petersfield, and CB1 Technology Quarter — is the UK's knowledge economy capital. The University of Cambridge and its 31 colleges define the architectural and intellectual character. The CB1 development around Cambridge Station (completed 2018) has transformed the southern approach — a mixed-use quarter of BREEAM Outstanding office buildings, residential, and retail built to exceptional quality standards. Petersfield and the streets east of the city centre (CB1) provide Victorian terraced housing within cycling distance of the university and science parks. Cambridge's economic fundamentals are among the best in Europe: the Silicon Fen cluster (ARM Holdings, AstraZeneca, Sanger Institute, hundreds of spinouts) is a permanent, structural driver of skilled professional demand.`,
      amenities: `The Grand Arcade and Lion Yard provide comprehensive city-centre retail — John Lewis, M&S, independent Cambridge bookshops (G. David Bookseller, Heffers). The Cambridge Market Square (daily, Monday–Sunday) is one of England's most continuously trading outdoor markets. The Fitzwilliam Museum (free entry, world-class art and antiquities collection), Kettle's Yard (contemporary art), and the Museum of Technology provide cultural depth. The Mill Road neighbourhood (CB1/CB2 border) is Cambridge's most characterful street — independent food shops, an annual winter fair, and the city's most diverse restaurant offer. Waitrose on Trumpington Street serves the southern residential area.`,
      greenSpace: `The Backs (the meadows behind the rear-facing buildings of the university colleges along the River Cam) are one of England's most celebrated landscapes — accessible to the public year-round. Midsummer Common (24 acres) hosts the annual Strawberry Fair and Midsummer House dining. Parker's Piece (25 acres, a flat recreation ground with historical significance for the Cambridge Rules of football) is directly accessible from CB1. Fen Ditton and Grantchester Meadows (accessible by punt or cycle) add the extraordinary Cambridgeshire countryside within 30 minutes of the centre.`,
      transport: `Cambridge railway station (National Rail — London King's Cross from 45 minutes by LNER, London Liverpool Street from 73 minutes by Greater Anglia, Stansted Airport from 30 minutes) provides exceptional London connectivity. The CB1 development directly fronts the station — residents can walk to platforms in under 3 minutes. Stagecoach and guided busway (Cambridgeshire) provide suburban and Park & Ride connectivity. Cycling is the dominant transport mode — Cambridge has the UK's highest cycle mode share (29% of all journeys). Stansted Airport: 30 minutes by train (international European connections). Heathrow: 90 minutes by National Express coach.`,
      schools: `Cambridge has exceptional independent school provision. The Perse School (independent, Outstanding, ~£18,500/year), St John's College School (prep, Outstanding), and King's College School (prep, Outstanding) are Cambridge institutions. The Stephen Perse Foundation (independent, day) provides a strong girls' option. State secondary: Parkside Community College (Good) and the Hills Road Sixth Form College (one of the UK's top state sixth forms — A-level results rival independent schools nationally) are the flagship state options. Cambridge Preservation Society and local conservation groups vigorously protect the building character — planning consent for alterations is managed carefully.`,
      demographics: `CB1 has the UK's highest proportion of residents with postgraduate qualifications. University academics, researchers, biotech executives, and technology-sector professionals dominate. The proportion of international residents (academic visa holders, EEA nationals, and long-stay research fellows) is among the highest of any UK city outside London. Average incomes in the Silicon Fen corridor (CB1/CB2/CB4) are substantially above the national median. Cambridge house prices are among the highest of any UK city outside London — the premium reflects genuine economic fundamentals rather than speculative demand.`,
      nightlife: `Cambridge's evening offer is calibrated to an academic and professional demographic. The Eagle (Benet Street, where Watson and Crick announced the structure of DNA in 1953), The Free Press (Prospect Row), and The Cambridge Blue (Gwydir Street, CB1) are pub institutions. For quality dining: Midsummer House (Midsummer Common, two Michelin stars), Alimentum (Hills Road, one Michelin star), and Cotto are the fine dining leaders. The Cambridge Junction (CB1, live music and arts venue) and Arts Theatre (theatre and comedy) provide cultural programming. The city quietens significantly after midnight — not a late-night city in the London sense.`,
      marketComment: `CB1 is the purest knowledge-economy property market in the UK. AstraZeneca's global R&D headquarters relocation to the Cambridge Biomedical Campus (CB2, adjacent) in 2016 was a decade-long demand catalyst — the £1bn investment brought thousands of high-salary research jobs that required housing within cycling distance of the campus and university. ARM Holdings' continued growth, the planned Sanger Institute expansion, and ongoing spinout activity from the University's Cambridge Enterprise office provide structural, permanent demand. Supply is severely constrained — Cambridge sits in a Green Belt and Local Plan targets consistently underdeliver. These factors make CB1 one of the most defensible capital appreciation stories in the UK. Target Victorian terraces in Petersfield and New Town (CB1) over new-build apartments — the heritage premium is consistent and durable. CB1 Technology Quarter (station-facing) new-builds are quality but service charges require careful scrutiny.`,
    },

    RG1: {
      schoolsRating: 7.9,
      safetyRating: 7.3,
      transportRating: 8.9,
      walkability: 8.6,
      character: `RG1 — Reading Town Centre — is England's most significant commuter and tech hub outside the capital. The Elizabeth line's arrival at Reading in 2022 transformed the town's connectivity — a direct service to London Bond Street takes 27 minutes. Reading's economic base is genuinely diversified: Microsoft, Oracle, Vodafone, and PwC all have major UK operations here, creating a highly skilled resident professional class. The Oracle Shopping Centre (riverside, two levels) and Broad Street pedestrian zone anchor the retail offer. Reading's town centre has undergone meaningful regeneration since 2015 — Station Hill (the £750m mixed-use development adjacent to the station) adds 1,500 new homes, hotels, and Grade A office space to the centre. The market town character persists despite the corporate overlay.`,
      amenities: `The Oracle Shopping Centre (John Lewis, Waitrose, cinema, riverside restaurants) is the retail anchor. Broad Street pedestrian zone provides high-street retail including M&S, Boots, Zara, and independent shops. Reading Market (Butts Centre) hosts a weekly market with fresh produce and artisan goods. Harris Garden (University of Reading campus, public access) provides botanical garden quality within 15 minutes. Caversham (across the Thames, RG4) has the feel of an independent village — independent cafes, butchers, and a Saturday farmers' market on Prospect Street.`,
      greenSpace: `Forbury Gardens (town centre, Grade II listed Victorian park with the Reading Gaol memorial) is directly accessible from RG1. Thames Path runs along the southern edge of Reading, connecting Caversham Lock westward to Pangbourne and eastward to Henley. Prospect Park (87 acres, RG30) provides a major green space 1.5 miles west — formal gardens, café, and sports pitches. The wider Thames Valley — Mapledurham, Purley, and the Chiltern Hills — provides exceptional countryside access within 20 minutes by car.`,
      transport: `Reading railway station (Elizabeth line — London Bond Street from 27 minutes, Paddington from 23 minutes, Heathrow Terminal 5 from 37 minutes) is the postcode's defining asset. GWR services connect to Bristol Temple Meads (44 minutes), Oxford (23 minutes), and Cardiff (1h35). Reading has one of the most significant rail interchanges outside London — the Cross-Country, GWR mainline, and Elizabeth line all converge here. South Western Railway connects to Basingstoke and Southampton. Journey to Heathrow Terminal 5: 37 minutes direct (Elizabeth line). Gatwick: 40 minutes (via Blackfriars by Elizabeth line then Thameslink).`,
      schools: `Reading School (state grammar, Outstanding — one of the UK's highest-performing, Year 7 competitive entrance exam) is the flagship state school. Kendrick School (state grammar, girls', Outstanding) is its female equivalent. Both have Oxbridge entry rates comparable to selective independent schools. Independent alternatives: Queen Anne's School (Caversham, girls', boarding/day, ~£17,000/year day), Reading Blue Coat School (Sonning, boys', ~£18,500/year). The University of Reading (RG6, ranked top 200 globally) is a significant local employer and graduate talent pool. Thames Valley Berkshire's grammar school network is a major draw for professional families from London and beyond.`,
      demographics: `RG1 is the home of choice for professionals priced out of London who need to maintain West End or City connectivity. The Elizabeth line effect has accelerated this — a commuter who can reach Bond Street in 27 minutes by direct train faces a choice between a flat in SE15 and a house in RG1 at significantly better value. Microsoft, Oracle, Vodafone, and the tech cluster around Thames Valley Park (RG1/RG2) attract a mid-to-senior tech professional demographic who choose Reading for family space, grammar school access, and value. Average household income in RG1 is above the national median. Rental demand from corporate occupiers — Vodafone, Microsoft, and the Oracle campus require substantial housing for incoming professionals.`,
      nightlife: `Reading has a vibrant bar and music scene relative to its size — historically anchored around Broad Street, Friar Street, and the Caversham riverside. The Alehouse (traditional real ale), Revolution, and the growing cluster of bars around the Oracle lakeside represent the mainstream offer. For quality dining: London Street Brasserie, Forbury's (Forbury Gardens), and Côte Brasserie are local go-tos. Nando's and the Oracle food court serve casual needs. Reading Festival (Richfield Avenue, RG2) is one of the UK's premier music festivals — a August Bank Holiday institution bringing 90,000 visitors annually. The Hexagon Theatre hosts touring productions and comedy.`,
      marketComment: `RG1 has the most compelling commuter-value proposition in the South East following the Elizabeth line. A £650,000 house in central Reading delivers 27-minute door-to-platform access to Bond Street — the same journey from SE22 (Dulwich) would cost £1.2–1.5m. This value gap is partially closing as the Elizabeth line effect diffuses, but RG1 still offers approximately 35–45% discount to equivalent London postcodes at comparable specification and journey time. The Station Hill development (1,500 new units, 2024–2027 delivery) adds new-build supply that may moderate short-term appreciation on apartments — focus on Victorian and Edwardian terraces in the RG1 core (Southampton Street, Zinzan Street, Valpy Street conservation area) for better long-term capital performance. Grammar school proximity (Reading School in RG1, Kendrick in RG1) is a structural demand driver that makes school-catchment properties reliably liquid.`,
    },
  };

  // Lookup postcode-specific profile — exact outcode match preferred
  const specificProfile = postcodeProfiles[outcode] || null;

  // Numeric ratings — use specific profile or fall back to tier/region-based
  const schoolsRating = specificProfile?.schoolsRating ?? (isLondon ? 8.4 : region.includes("South East") ? 8.1 : 7.8);
  const safetyRating  = specificProfile?.safetyRating  ?? (tier === "prime" ? 8.9 : tier === "premium" ? 8.3 : 7.7);
  const walkability   = specificProfile?.walkability   ?? (isLondon ? 9.1 : region.includes("South") ? 7.6 : 7.1);

  // Transport rating — use specific profile or original logic
  const transportRating = specificProfile?.transportRating ?? (isLondon ? 9.1 : country === "Wales" ? 7.0 : 7.4);

  // ── Tier-based fallbacks (for postcodes without a specific profile) ────────
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

  // Use postcode-specific profile if available, else fall back to tier maps
  const neighCharacter   = specificProfile?.character   ?? characterMap[tier]   ?? characterMap["unknown"];
  const neighAmenities   = specificProfile?.amenities   ?? amenitiesMap[tier]   ?? amenitiesMap["unknown"];
  const neighGreenSpace  = specificProfile?.greenSpace  ?? greenSpaceMap[tier]  ?? greenSpaceMap["unknown"];
  const neighTransport   = specificProfile?.transport   ?? transportDescMap[tier] ?? transportDescMap["unknown"];
  const neighSchools     = specificProfile?.schools     ?? schoolsDescMap[tier] ?? schoolsDescMap["unknown"];
  const neighDemographics = specificProfile?.demographics ?? demographicsMap[tier] ?? demographicsMap["unknown"];
  const neighNightlife   = specificProfile?.nightlife   ?? nightlifeMap[tier]   ?? nightlifeMap["unknown"];
  const neighMarketComment = specificProfile?.marketComment ?? marketCommentMap[tier] ?? marketCommentMap["unknown"];

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
