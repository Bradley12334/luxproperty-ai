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
  "E1": { name: "Whitechapel & Spitalfields", region: "East London", description: "E1 has undergone a profound transformation over the past decade. Spitalfields' Georgian architecture, the creative scene around Brick Lane, and proximity to the City make this a favourite for young professionals and investors seeking value with upside.", medianPrice: "£568,000", priceChange: "+6.3%", tier: "Premium", highlights: ["City proximity", "Brick Lane culture", "Elizabeth line access", "Strong rental demand"], nearbyAreas: ["E2","EC2","N1","SE1"] },
  "E8": { name: "Hackney", region: "East London", description: "Hackney has established itself as one of London's most sought-after mid-market postcodes. Broadway Market, Victoria Park, and a thriving independent food scene attract a creative professional demographic. Strong 5-year price growth with further upside.", medianPrice: "£612,000", priceChange: "+7.1%", tier: "Premium", highlights: ["Victoria Park", "Broadway Market", "Creative community", "Overground links"], nearbyAreas: ["E2","E5","N16","E9"] },
  "N1": { name: "Islington", region: "North London", description: "Islington combines Georgian terraces, the boutiques of Upper Street, and the creative buzz of Angel. A perennially popular postcode with strong owner-occupier demand, good schools, and excellent transport into the City and West End.", medianPrice: "£745,000", priceChange: "+4.5%", tier: "Premium", highlights: ["Angel & Upper Street", "Georgian architecture", "Great schools", "Northern line & Overground"], nearbyAreas: ["N7","EC1","E1","N5"] },
  "SE1": { name: "Southwark & London Bridge", region: "South London", description: "SE1 has been transformed by the regeneration around London Bridge and Borough Market. The Shard, Tate Modern, and direct City access have made this one of South London's most dynamic investment areas, with strong rental yields.", medianPrice: "£689,000", priceChange: "+5.8%", tier: "Premium", highlights: ["Borough Market", "London Bridge station", "Thames views", "City of London access"], nearbyAreas: ["SE11","SE17","SW8","EC4"] },
  "W1": { name: "Mayfair & Marylebone", region: "Central London", description: "W1 is London's preeminent address — Mayfair, Marylebone, and Fitzrovia. From Georgian mansion blocks to Marylebone High Street's village atmosphere, this is a market driven by HNW individuals, family offices, and discreet international buyers.", medianPrice: "£2.1M", priceChange: "+3.2%", tier: "Prime", highlights: ["Mayfair prestige", "Marylebone village", "Bond Street shopping", "Hyde Park access"], nearbyAreas: ["SW1","W2","NW1","WC1"] },
  "W8": { name: "Kensington", region: "West London", description: "Kensington Palace, Holland Park, and Kensington High Street anchor one of London's most stable prime markets. The area draws established families and international buyers who value the green space, excellent schools, and Zone 1/2 transport.", medianPrice: "£1.72M", priceChange: "+3.5%", tier: "Prime", highlights: ["Kensington Palace", "Holland Park", "Outstanding schools", "Zone 1/2 tube"], nearbyAreas: ["W11","SW7","SW3","W14"] },
  "W11": { name: "Notting Hill", region: "West London", description: "Notting Hill's Portobello Road, communal garden squares, and well-documented cultural cachet make it one of London's most recognisable addresses. A tight market with limited stock, strong international demand, and consistent long-term appreciation.", medianPrice: "£1.45M", priceChange: "+4.7%", tier: "Prime", highlights: ["Portobello Market", "Garden squares", "Holland Park school", "International community"], nearbyAreas: ["W10","W8","W2","W12"] },
  "M1": { name: "Manchester City Centre", region: "Greater Manchester", description: "Manchester's city centre has seen dramatic price appreciation over the past decade, driven by tech sector growth, major regeneration, and strong university-driven rental demand. A leading investment postcode outside London with growing international interest.", medianPrice: "£285,000", priceChange: "+8.2%", tier: "Mid-market", highlights: ["Tech sector hub", "Strong rental yields", "HS2 connectivity", "University demand"], nearbyAreas: ["M2","M4","M15","M16"] },
  "M2": { name: "Manchester Spinningfields", region: "Greater Manchester", description: "Manchester's financial district, anchored by the Spinningfields development. Professional-grade apartments, proximity to the BBC and ITV media city, and strong buy-to-let fundamentals driven by graduate retention make this a credible investment area.", medianPrice: "£312,000", priceChange: "+7.8%", tier: "Mid-market", highlights: ["Financial district", "BBC Media City nearby", "High rental demand", "Metrolink access"], nearbyAreas: ["M1","M3","M50","M15"] },
  "B1": { name: "Birmingham City Centre", region: "West Midlands", description: "Birmingham's Big City Plan and Commonwealth Games legacy investment has reshaped the city centre. B1 encompasses the Jewellery Quarter and business district — a regeneration story that is still playing out, with significant upside for early buyers.", medianPrice: "£218,000", priceChange: "+9.1%", tier: "Emerging", highlights: ["HSBC UK HQ", "HS2 terminus", "Jewellery Quarter", "Strong rental yields"], nearbyAreas: ["B3","B4","B5","B16"] },
  "LS1": { name: "Leeds City Centre", region: "Yorkshire", description: "Leeds is one of the UK's strongest regional property markets. The financial quarter, thriving hospitality scene, and two major universities generate consistent rental demand. Strong value relative to London, with improving connectivity.", medianPrice: "£198,000", priceChange: "+6.9%", tier: "Mid-market", highlights: ["Financial services hub", "Two universities", "Victoria Gate retail", "Strong yields"], nearbyAreas: ["LS2","LS6","LS7","LS11"] },
  "BS1": { name: "Bristol City Centre", region: "South West", description: "Bristol consistently ranks among the UK's most liveable cities. The Harbourside regeneration, tech cluster around Temple Quarter, and strong graduate retention have made BS1 one of the Southwest's most compelling investment postcodes.", medianPrice: "£342,000", priceChange: "+5.4%", tier: "Premium", highlights: ["Harbourside living", "Tech quarter", "Clifton proximity", "Strong rental market"], nearbyAreas: ["BS2","BS3","BS6","BS8"] },
  "EH1": { name: "Edinburgh Old Town", region: "Scotland", description: "Edinburgh's Old Town and New Town are consistently ranked among the UK's most desirable residential areas. The festival economy, financial services sector, and cultural offer create year-round demand. Note: Scottish conveyancing law differs from England.", medianPrice: "£385,000", priceChange: "+4.8%", tier: "Premium", highlights: ["UNESCO World Heritage", "Festival economy", "Financial services", "University town"], nearbyAreas: ["EH2","EH3","EH4","EH9"] },
  "OX1": { name: "Oxford City Centre", region: "South East", description: "Oxford's university heritage, biotech cluster, and green-belt constraints create a structurally undersupplied market with exceptional long-term fundamentals. A favourite with academics, professionals, and investors who can access the price point.", medianPrice: "£525,000", priceChange: "+4.1%", tier: "Premium", highlights: ["University town", "Biotech cluster", "Green belt constraint", "Strong demand"], nearbyAreas: ["OX2","OX3","OX4","OX44"] },
  "CB1": { name: "Cambridge", region: "East of England", description: "Cambridge's 'Silicon Fen' tech ecosystem, world-class university, and extremely constrained housing supply have created one of the UK's most resilient property markets outside London. Prices are supported by globally mobile, high-income buyers.", medianPrice: "£498,000", priceChange: "+4.6%", tier: "Premium", highlights: ["Silicon Fen tech hub", "University prestige", "Green belt constraint", "High income buyers"], nearbyAreas: ["CB2","CB3","CB4","CB5"] },
  "GL1": { name: "Gloucester", region: "South West", description: "Gloucester offers excellent value relative to neighbouring Cheltenham and Bristol. Historic cathedral city with strong commuter demand and significant regeneration activity around the docks. An emerging market with upside potential.", medianPrice: "£235,000", priceChange: "+5.7%", tier: "Mid-market", highlights: ["Cathedral city", "Gloucester Docks regen", "Commuter value", "M5 access"], nearbyAreas: ["GL2","GL3","GL4","GL50"] },
  "RG1": { name: "Reading", region: "South East", description: "Reading's proximity to London via the Elizabeth line, strong tech employer base (Oracle, Microsoft, PwC), and relatively affordable prices compared to the capital make it one of the South East's strongest investment markets.", medianPrice: "£368,000", priceChange: "+5.2%", tier: "Premium", highlights: ["Elizabeth line to London", "Major tech employers", "University town", "Strong rental demand"], nearbyAreas: ["RG2","RG4","RG6","RG30"] },
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

export default function AreaPage() {
  const params = useParams<{ postcode: string }>();
  const [, navigate] = useLocation();
  const postcode = params.postcode?.toUpperCase() || "";
  const area = AREA_DATA[postcode];

  useDocumentTitle(area ? `${area.name} (${postcode}) Property Intelligence` : `${postcode} Property Market`);

  if (!area) {
    // Unknown postcode — redirect to home with the postcode pre-filled
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <MapPin className="h-8 w-8 text-primary mx-auto mb-4" />
            <h1 className="font-serif text-2xl tracking-tight mb-3">
              {postcode} Property Intelligence
            </h1>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Generate a full intelligence brief for {postcode} — including real Land Registry price data, 5-year trends, and neighbourhood analysis.
            </p>
            <Button onClick={() => navigate(`/?q=${postcode}`)} className="font-semibold">
              Generate {postcode} Brief
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

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
              Generate Full Intelligence Brief
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
                { label: "YoY Price Change", value: area.priceChange, icon: TrendingUp },
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
                Get the full {postcode} intelligence report
              </h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Real Land Registry data, 5-year price trends, neighbourhood profile, investment outlook, and negotiation brief — all in 60 seconds.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="font-semibold"
                  onClick={() => navigate(`/?q=${postcode}`)}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Generate {postcode} Brief — Free
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
