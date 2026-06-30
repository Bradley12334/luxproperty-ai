import { useParams, Link } from "wouter";
import { useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, MapPin, TrendingUp, Home, Train, GraduationCap, Search } from "lucide-react";

// Top 30 UK postcode areas with curated data for SEO pages
const AREA_DATA: Record<string, {
  name: string;
  region: string;
  description: string;
  medianPrice: string;
  priceChange: string;
  tier: string;
  highlights: string[];
  nearbyAreas: string[];
}> = {
  "SW1": { name: "Westminster", region: "Central London", description: "The heart of political London, home to Buckingham Palace, St James's Park and some of the UK's most prestigious residential streets. SW1 encompasses Belgravia, Pimlico, and Victoria — a prime residential market with international demand and constrained supply.", medianPrice: "£1.85M", priceChange: "+4.2%", tier: "Prime", highlights: ["Royal Parks access", "Zone 1 transport", "World-class dining", "Elite schools nearby"], nearbyAreas: ["SW3","SW7","W1","EC1"] },
  "SW3": { name: "Chelsea", region: "West London", description: "Chelsea is one of London's most enduring luxury postcodes. The Kings Road, Sloane Square, and the Chelsea Embankment define a neighbourhood that balances old money with creative energy. Strong rental demand from the international community.", medianPrice: "£1.38M", priceChange: "+5.1%", tier: "Prime", highlights: ["Kings Road shopping", "Thames riverside", "Outstanding schools", "Excellent transport"], nearbyAreas: ["SW1","SW7","SW10","W8"] },
  "SW7": { name: "South Kensington", region: "West London", description: "South Kensington's 'museum quarter' draws educated, cultured buyers from around the world. The V&A, Natural History Museum, and Science Museum sit alongside white-stucco mansion buildings and well-regarded schools. A perennially resilient market.", medianPrice: "£1.62M", priceChange: "+3.8%", tier: "Prime", highlights: ["World-class museums", "French Lycée nearby", "Hyde Park access", "Superb connectivity"], nearbyAreas: ["SW3","SW5","W8","SW1"] },
  "E1": { name: "Whitechapel & Spitalfields", region: "East London", description: "E1 has undergone a profound transformation over the past decade. Spitalfields' Georgian architecture, the creative scene around Brick Lane, and proximity to the City make this a favourite for young professionals and buyers looking for character with good City access.", medianPrice: "£568,000", priceChange: "+6.3%", tier: "Premium", highlights: ["City proximity", "Brick Lane culture", "Elizabeth line access", "Strong rental demand"], nearbyAreas: ["E2","EC2","N1","SE1"] },
  "E8": { name: "Hackney", region: "East London", description: "Hackney has established itself as one of London's most sought-after mid-market postcodes. Broadway Market, Victoria Park, and a thriving independent food scene attract a creative professional demographic. Strong 5-year price growth with further upside.", medianPrice: "£612,000", priceChange: "+7.1%", tier: "Premium", highlights: ["Victoria Park", "Broadway Market", "Creative community", "Overground links"], nearbyAreas: ["E2","E5","N16","E9"] },
  "N1": { name: "Islington", region: "North London", description: "Islington combines Georgian terraces, the boutiques of Upper Street, and the creative buzz of Angel. A perennially popular postcode with strong owner-occupier demand, good schools, and excellent transport into the City and West End.", medianPrice: "£745,000", priceChange: "+4.5%", tier: "Premium", highlights: ["Angel & Upper Street", "Georgian architecture", "Great schools", "Northern line & Overground"], nearbyAreas: ["N7","EC1","E1","N5"] },
  "SE1": { name: "Southwark & London Bridge", region: "South London", description: "SE1 has been transformed by the regeneration around London Bridge and Borough Market. The Shard, Tate Modern, and direct City access have made this one of South London's most sought-after postcodes — strong demand and a lively cultural offer.", medianPrice: "£689,000", priceChange: "+5.8%", tier: "Premium", highlights: ["Borough Market", "London Bridge station", "Thames views", "City of London access"], nearbyAreas: ["SE11","SE17","SW8","EC4"] },
  "W1": { name: "Mayfair & Marylebone", region: "Central London", description: "W1 is London's preeminent address — Mayfair, Marylebone, and Fitzrovia. From Georgian mansion blocks to Marylebone High Street's village atmosphere, this is a market driven by HNW individuals, family offices, and discreet international buyers.", medianPrice: "£2.1M", priceChange: "+3.2%", tier: "Prime", highlights: ["Mayfair prestige", "Marylebone village", "Bond Street shopping", "Hyde Park access"], nearbyAreas: ["SW1","W2","NW1","WC1"] },
  "W8": { name: "Kensington", region: "West London", description: "Kensington Palace, Holland Park, and Kensington High Street anchor one of London's most stable prime markets. The area draws established families and international buyers who value the green space, excellent schools, and Zone 1/2 transport.", medianPrice: "£1.72M", priceChange: "+3.5%", tier: "Prime", highlights: ["Kensington Palace", "Holland Park", "Outstanding schools", "Zone 1/2 tube"], nearbyAreas: ["W11","SW7","SW3","W14"] },
  "W11": { name: "Notting Hill", region: "West London", description: "Notting Hill's Portobello Road, communal garden squares, and well-documented cultural cachet make it one of London's most recognisable addresses. A tight market with limited stock, strong international demand, and consistent long-term appreciation.", medianPrice: "£1.45M", priceChange: "+4.7%", tier: "Prime", highlights: ["Portobello Market", "Garden squares", "Holland Park school", "International community"], nearbyAreas: ["W10","W8","W2","W12"] },
  "M1": { name: "Manchester City Centre", region: "Greater Manchester", description: "Manchester's city centre has seen strong price appreciation over the past decade, driven by tech sector growth, major regeneration, and a large graduate population. One of the UK's most active regional markets, with broad buyer appeal and improving national connectivity.", medianPrice: "£285,000", priceChange: "+8.2%", tier: "Mid-market", highlights: ["Tech sector hub", "Active rental market", "HS2 connectivity", "University demand"], nearbyAreas: ["M2","M4","M15","M16"] },
  "M2": { name: "Manchester Spinningfields", region: "Greater Manchester", description: "Manchester's financial district, anchored by the Spinningfields development. Professional-grade apartments, proximity to the BBC and ITV media city, and strong graduate retention make this a well-connected area with broad buyer appeal.", medianPrice: "£312,000", priceChange: "+7.8%", tier: "Mid-market", highlights: ["Financial district", "BBC Media City nearby", "High rental demand", "Metrolink access"], nearbyAreas: ["M1","M3","M50","M15"] },
  "B1": { name: "Birmingham City Centre", region: "West Midlands", description: "Birmingham's Big City Plan and Commonwealth Games legacy investment has reshaped the city centre. B1 encompasses the Jewellery Quarter and business district — a regeneration story that is still playing out, with significant upside for early buyers.", medianPrice: "£218,000", priceChange: "+9.1%", tier: "Emerging", highlights: ["HSBC UK HQ", "HS2 terminus", "Jewellery Quarter", "Active property market"], nearbyAreas: ["B3","B4","B5","B16"] },
  "LS1": { name: "Leeds City Centre", region: "Yorkshire", description: "Leeds is one of the UK's strongest regional property markets. The financial quarter, thriving hospitality scene, and two major universities generate consistent rental demand. Strong value relative to London, with improving connectivity.", medianPrice: "£198,000", priceChange: "+6.9%", tier: "Mid-market", highlights: ["Financial services hub", "Two universities", "Victoria Gate retail", "Active market"], nearbyAreas: ["LS2","LS6","LS7","LS11"] },
  "BS1": { name: "Bristol City Centre", region: "South West", description: "Bristol consistently ranks among the UK's most liveable cities. The Harbourside regeneration, tech cluster around Temple Quarter, and strong graduate retention have made BS1 one of the Southwest's most popular postcodes for buyers and movers alike.", medianPrice: "£342,000", priceChange: "+5.4%", tier: "Premium", highlights: ["Harbourside living", "Tech quarter", "Clifton proximity", "Strong rental market"], nearbyAreas: ["BS2","BS3","BS6","BS8"] },
  "EH1": { name: "Edinburgh Old Town", region: "Scotland", description: "Edinburgh's Old Town and New Town are consistently ranked among the UK's most desirable residential areas. The festival economy, financial services sector, and cultural offer create year-round demand. Note: Scottish conveyancing law differs from England.", medianPrice: "£385,000", priceChange: "+4.8%", tier: "Premium", highlights: ["UNESCO World Heritage", "Festival economy", "Financial services", "University town"], nearbyAreas: ["EH2","EH3","EH4","EH9"] },
  "OX1": { name: "Oxford City Centre", region: "South East", description: "Oxford's university heritage, biotech cluster, and green-belt constraints create a structurally undersupplied market with exceptional long-term fundamentals. A firm favourite with academics, professionals, and buyers drawn to a city that consistently holds its value.", medianPrice: "£525,000", priceChange: "+4.1%", tier: "Premium", highlights: ["University town", "Biotech cluster", "Green belt constraint", "Strong demand"], nearbyAreas: ["OX2","OX3","OX4","OX44"] },
  "CB1": { name: "Cambridge", region: "East of England", description: "Cambridge's 'Silicon Fen' tech ecosystem, world-class university, and extremely constrained housing supply have created one of the UK's most resilient property markets outside London. Prices are supported by globally mobile, high-income buyers.", medianPrice: "£498,000", priceChange: "+4.6%", tier: "Premium", highlights: ["Silicon Fen tech hub", "University prestige", "Green belt constraint", "High income buyers"], nearbyAreas: ["CB2","CB3","CB4","CB5"] },
  "GL1": { name: "Gloucester", region: "South West", description: "Gloucester offers excellent value relative to neighbouring Cheltenham and Bristol. Historic cathedral city with strong commuter demand and significant regeneration activity around the docks. An emerging market with upside potential.", medianPrice: "£235,000", priceChange: "+5.7%", tier: "Mid-market", highlights: ["Cathedral city", "Gloucester Docks regen", "Commuter value", "M5 access"], nearbyAreas: ["GL2","GL3","GL4","GL50"] },
  "RG1": { name: "Reading", region: "South East", description: "Reading's proximity to London via the Elizabeth line, strong tech employer base (Oracle, Microsoft, PwC), and relatively affordable prices compared to the capital make it one of the South East's most practical choices for buyers who want London connectivity without London prices.", medianPrice: "£368,000", priceChange: "+5.2%", tier: "Premium", highlights: ["Elizabeth line to London", "Major tech employers", "University town", "Strong rental demand"], nearbyAreas: ["RG2","RG4","RG6","RG30"] },
};

const TOP_AREAS = [
  { code: "SW1", label: "Westminster, London" },
  { code: "SW3", label: "Chelsea, London" },
  { code: "E8", label: "Hackney, London" },
  { code: "M1", label: "Manchester City Centre" },
  { code: "B1", label: "Birmingham City Centre" },
  { code: "LS1", label: "Leeds City Centre" },
  { code: "BS1", label: "Bristol Harbourside" },
  { code: "RG1", label: "Reading (Elizabeth line)" },
  { code: "CB1", label: "Cambridge" },
  { code: "OX1", label: "Oxford" },
  { code: "EH1", label: "Edinburgh Old Town" },
  { code: "W11", label: "Notting Hill" },
];

const GUIDE_SECTIONS = [
  {
    number: "01",
    title: "Check flood risk",
    body: [
      "Flood risk is one of the most overlooked checks UK buyers can make, especially if the property itself looks perfectly fine on viewing day. A street can appear completely normal and still sit within an area with elevated river, sea or surface water flood exposure.",
      "This matters because flood risk can affect insurance premiums, mortgage decisions, resale value and future maintenance costs.",
    ],
    bullets: [
      "River flooding",
      "Sea flooding",
      "Surface water flooding after heavy rain",
      "Groundwater flooding in some locations",
    ],
  },
  {
    number: "02",
    title: "Check crime levels",
    body: [
      "Crime is one of the first things buyers want to know, but many people rely too heavily on hearsay or broad assumptions about an area. It is far better to look at actual local crime data and then compare it with neighbouring postcodes.",
      "When you review crime, do not just look at the total number. Look at the type of crime as well. There is a big difference between occasional anti-social behaviour and a consistent pattern of burglary or violence.",
    ],
    bullets: [],
  },
  {
    number: "03",
    title: "Check school quality",
    body: [
      "Even if you do not have children, school quality can still affect local demand and resale value. Areas near strong schools often attract more buyers and tend to be more resilient.",
      "Look at nearby primary and secondary schools, not just the nearest one. A house can technically be close to a school without being in the catchment or without that school being particularly well rated.",
    ],
    bullets: [],
  },
  {
    number: "04",
    title: "Check transport links",
    body: [
      "A postcode can look attractive on paper, but the day-to-day reality of getting around can be very different. Check rail stations, Underground or tram access where relevant, major roads, and actual travel times to the places that matter to you.",
    ],
    bullets: [],
  },
  {
    number: "05",
    title: "Check planning and development nearby",
    body: [
      "One of the most common buyer regrets is discovering too late that something major is planned nearby. That could be a large housing development, a new block, a road scheme, a commercial site or an infrastructure project.",
      "Search the local planning portal and look not only at the property itself, but also the surrounding roads and plots.",
    ],
    bullets: [],
  },
  {
    number: "06",
    title: "Check sold prices and local price direction",
    body: [
      "It is easy to anchor on the asking price, but asking prices are only part of the picture. You want to know what people have actually paid nearby and whether the area looks stable, rising or softening.",
    ],
    bullets: [],
  },
  {
    number: "07",
    title: "Check council tax, broadband and mobile coverage",
    body: [
      "These practical details are not exciting, but they affect the cost and usability of a home. A property can seem perfect until you realise the broadband is poor, the phone signal drops out indoors, or the council tax band is higher than expected.",
    ],
    bullets: [],
  },
];

const FAQ_ITEMS = [
  {
    q: "What is the most important thing to check about an area before buying?",
    a: "There is no single answer, because it depends on your priorities. For most buyers, the main checks are flood risk, crime, schools, transport and planned development nearby.",
  },
  {
    q: "Is postcode data enough to decide whether to buy?",
    a: "No. Postcode-level data is a strong starting point, but it should be combined with physical visits, local planning checks and common sense.",
  },
  {
    q: "Do conveyancing searches tell me all of this?",
    a: "No. Conveyancing searches help uncover legal and environmental issues, but they do not give you a full picture of what everyday life in the neighbourhood will be like.",
  },
];

function GuidePage({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">

        {/* Hero */}
        <section className="border-b border-border/40 py-14 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider mb-5">
              Buyer Guide
            </Badge>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mb-5 leading-snug">
              How to Check an Area Before Buying a House in the UK
            </h1>
            <p className="text-muted-foreground leading-relaxed text-base max-w-2xl mb-2">
              Buying a house is one of the biggest financial commitments you will ever make. Most people spend time scrutinising the property itself — the rooms, the condition, the price — but pay much less attention to the area around it.
            </p>
            <p className="text-muted-foreground leading-relaxed text-base max-w-2xl mb-2">
              That is a mistake. The neighbourhood you buy into affects your insurance costs, your children's school options, your daily commute, your resale value, and your quality of life. None of that shows up in the brochure.
            </p>
            <p className="text-muted-foreground leading-relaxed text-base max-w-2xl">
              The good news is that most of the data you need is freely available if you know where to look. The challenge is that it is scattered across different government websites, local authority portals, school databases, transport tools, flood maps and planning records. This guide walks through the main checks worth doing before you buy, and how to do them properly.
            </p>
          </div>
        </section>

        {/* Guide sections */}
        <section className="py-14 border-b border-border/40">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-12">
            {GUIDE_SECTIONS.map((section) => (
              <div key={section.number} className="flex gap-5 sm:gap-8">
                <div className="shrink-0 pt-0.5">
                  <span className="font-serif text-2xl text-primary/30 leading-none select-none">
                    {section.number}
                  </span>
                </div>
                <div className="flex-1">
                  <h2 className="font-serif text-xl sm:text-2xl tracking-tight mb-3">
                    {section.title}
                  </h2>
                  {section.body.map((para, i) => (
                    <p key={i} className="text-muted-foreground leading-relaxed mb-3 text-[15px]">
                      {para}
                    </p>
                  ))}
                  {section.bullets.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {section.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-[15px] text-muted-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Extra advice */}
        <section className="py-14 border-b border-border/40 bg-muted/20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-8">
              Before you make an offer
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border/60 bg-card p-5">
                <h3 className="font-serif text-lg tracking-tight mb-2">Visit at different times</h3>
                <p className="text-[14px] text-muted-foreground leading-relaxed">
                  Data is essential, but it does not replace physically seeing the area. Visit at different times of day if you can — morning, evening, weekday and weekend. A road that feels calm at 2pm on a Tuesday may feel very different on a Friday night or during the school run.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-5">
                <h3 className="font-serif text-lg tracking-tight mb-2">Read between the lines</h3>
                <p className="text-[14px] text-muted-foreground leading-relaxed">
                  No single metric tells you whether an area is right for you. A place may have average schools but excellent transport and strong long-term demand. The goal is not to find a perfect area — it is to spot risks early, compare places properly, and avoid making a rushed decision based only on the listing.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-14 border-b border-border/40">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-8">
              Frequently asked questions
            </p>
            <div className="space-y-7">
              {FAQ_ITEMS.map((item) => (
                <div key={item.q}>
                  <h3 className="font-serif text-lg tracking-tight mb-2">{item.q}</h3>
                  <p className="text-[15px] text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="rounded-2xl border border-border/60 bg-card px-7 py-10 sm:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
                LuxProperty
              </p>
              <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-3">
                Save yourself hours of tab-switching
              </h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed mb-7 max-w-xl">
                LuxProperty pulls flood risk, crime data, school ratings, transport, broadband, council tax, and more into one buyer brief — for any UK postcode, in minutes.
              </p>
              <Button
                size="lg"
                className="font-semibold"
                onClick={() => navigate("/")}
              >
                <Search className="mr-2 h-4 w-4" />
                Check your postcode for free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Area directory */}
        <section className="py-12 border-t border-border/40 bg-muted/20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-6">
              Explore top UK property markets
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TOP_AREAS.map((a) => (
                <Link key={a.code} href={`/area/${a.code}`}>
                  <div className="text-sm px-3 py-2 rounded-md hover:bg-muted transition-colors cursor-pointer flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                    <span>{a.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}

export default function AreaPage() {
  const params = useParams<{ postcode: string }>();
  const [, navigate] = useLocation();
  const postcode = params.postcode?.toUpperCase() || "";
  const area = AREA_DATA[postcode];

  useDocumentTitle(
    area
      ? `${area.name} (${postcode}) Property Report`
      : "How to Check an Area Before Buying a House in the UK",
    area
      ? `Property market data for ${postcode} — ${area.name}. Average prices, price trends, comparable sales and buyer intelligence. Powered by HM Land Registry data.`
      : "Before you make an offer, here is how to properly check a neighbourhood in the UK — crime, flood risk, schools, transport, planning and more."
  );

  // Structured data — BreadcrumbList for area pages
  useEffect(() => {
    if (!area) return;
    const scriptId = "ld-breadcrumb-area";
    let el = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = scriptId;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.luxproperty.ai/" },
        { "@type": "ListItem", "position": 2, "name": "Area Reports", "item": "https://www.luxproperty.ai/area/guide" },
        { "@type": "ListItem", "position": 3, "name": `${area.name} (${postcode})`, "item": `https://www.luxproperty.ai/area/${postcode}` }
      ]
    });
    return () => { el?.remove(); };
  }, [postcode, area]);

  // Unknown postcode (including /area/guide) — render the editorial guide
  if (!area) {
    return <GuidePage navigate={navigate} />;
  }

  // Known postcode — render the property report page
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border/40 py-12 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                {area.tier} Market
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {area.region}
              </Badge>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mb-3">
              {area.name} ({postcode}) Property Market
            </h1>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mb-8">
              {area.description}
            </p>
            <Button
              onClick={() => navigate(`/?q=${postcode}`)}
              size="lg"
              className="font-semibold"
            >
              Generate Full Property Report
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Market Snapshot */}
        <section className="py-10 border-b border-border/40">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-6">Market Snapshot</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { label: "Median Sale Price", value: area.medianPrice, icon: Home },
                { label: "1-Year Price Change", value: area.priceChange, icon: TrendingUp },
                { label: "Market Tier", value: area.tier, icon: MapPin },
                { label: "Region", value: area.region, icon: Train },
              ].map((stat) => (
                <Card key={stat.label} className="p-4">
                  <stat.icon className="h-4 w-4 text-primary mb-2" />
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className="font-serif text-lg tracking-tight">{stat.value}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Highlights */}
        <section className="py-10 border-b border-border/40 bg-muted/20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-6">Area Highlights</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {area.highlights.map((h) => (
                <div key={h} className="flex items-center gap-2 text-sm">
                  <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 border-b border-border/40">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="max-w-xl">
              <h2 className="font-serif text-2xl tracking-tight mb-3">
                Get the full {postcode} property report
              </h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Real Land Registry data, 5-year price trends, neighbourhood profile, market outlook, and comparable sales — all in 60 seconds.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="font-semibold"
                  onClick={() => navigate(`/?q=${postcode}`)}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Generate {postcode} Report — Free
                </Button>
                <Link href="/pricing">
                  <Button variant="outline" size="lg">
                    View plans
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Nearby areas */}
        <section className="py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-6">Nearby Postcode Areas</p>
            <div className="flex flex-wrap gap-2">
              {area.nearbyAreas.map((code) => {
                const nearby = AREA_DATA[code];
                return (
                  <Link key={code} href={`/area/${code}`}>
                    <Badge
                      variant="outline"
                      className="px-3 py-1.5 text-xs cursor-pointer hover:bg-muted transition-colors"
                    >
                      {code}{nearby ? ` — ${nearby.name}` : ""}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Area directory */}
        <section className="py-12 border-t border-border/40 bg-muted/20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-6">Explore Top UK Property Markets</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TOP_AREAS.map((a) => (
                <Link key={a.code} href={`/area/${a.code}`}>
                  <div className="text-sm px-3 py-2 rounded-md hover:bg-muted transition-colors cursor-pointer flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                    <span>{a.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
