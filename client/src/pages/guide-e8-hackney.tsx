import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  Train,
  GraduationCap,
  Wifi,
  ShieldAlert,
  Waves,
  ShoppingBag,
  Wind,
  FileText,
  Wallet,
  Building2,
  TrendingDown,
} from "lucide-react";

// ─── SEO ─────────────────────────────────────────────────────────────────────
// Sets the exact title tag / meta description, canonical + OG, and a JSON-LD
// Article schema. Mirrors the SW3 / SE1 guides (with the precise title string,
// which uses " | LuxProperty AI") and adds structured data for rich results.
const PAGE_URL = "https://www.luxproperty.ai/guides/e8-hackney-buyers-guide";
const PAGE_TITLE = "Is E8 (Hackney) a Good Place to Buy? 2026 Guide | LuxProperty AI";
const PAGE_DESC =
  "Buying in E8? Real Land Registry sold prices — median £585k across 4,040 sales — plus schools, transport, crime, flood risk and negotiation guidance.";

const ARTICLE_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Is E8 (Hackney) a Good Place to Buy? The 2026 Buyer's Guide",
  description: PAGE_DESC,
  datePublished: "2026-07-01",
  dateModified: "2026-07-29",
  author: { "@type": "Organization", name: "LuxProperty AI" },
  publisher: {
    "@type": "Organization",
    name: "LuxProperty AI",
    url: "https://www.luxproperty.ai",
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": PAGE_URL },
  about: "Buying property in E8 (London Fields, Hackney), London",
};

function useGuideSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = PAGE_TITLE;

    const setMeta = (selector: string, attr: string, value: string) => {
      const el = document.querySelector<HTMLMetaElement>(selector);
      const prev = el?.getAttribute(attr) ?? null;
      if (el) el.setAttribute(attr, value);
      return { el, attr, prev };
    };

    const restores = [
      setMeta('meta[name="description"]', "content", PAGE_DESC),
      setMeta('meta[property="og:title"]', "content", PAGE_TITLE),
      setMeta('meta[property="og:description"]', "content", PAGE_DESC),
      setMeta('meta[property="og:url"]', "content", PAGE_URL),
      setMeta('meta[name="twitter:title"]', "content", PAGE_TITLE),
      setMeta('meta[name="twitter:description"]', "content", PAGE_DESC),
    ];

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", PAGE_URL);

    // JSON-LD Article schema
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.setAttribute("data-guide-ld", "e8");
    ld.textContent = JSON.stringify(ARTICLE_LD);
    document.head.appendChild(ld);

    return () => {
      document.title = prevTitle;
      restores.forEach(({ el, attr, prev }) => {
        if (el && prev !== null) el.setAttribute(attr, prev);
      });
      ld.remove();
    };
  }, []);
}

// ─── Data (from the E8 brief generated 28 July 2026 — refresh periodically) ──
const HEADLINE_STATS = [
  { label: "Median, 2016–2025", value: "£585,000", note: "4,040 Land Registry sales" },
  { label: "Median, 2025", value: "£604,000", note: "426 sales" },
  { label: "Year-on-year", value: "−3.4%", note: "softening at the top of an upward decade", down: true },
  { label: "Confidence", value: "High", note: "based on registered sold prices" },
];

const PRICE_HISTORY = [
  { year: "2016", sales: "472", price: "£537,168", change: "—" },
  { year: "2017", sales: "473", price: "£560,000", change: "+4.3%" },
  { year: "2018", sales: "394", price: "£583,500", change: "+4.2%" },
  { year: "2019", sales: "361", price: "£545,000", change: "−6.6%" },
  { year: "2020", sales: "261", price: "£610,000", change: "+11.9%" },
  { year: "2021", sales: "483", price: "£585,000", change: "−4.1%" },
  { year: "2022", sales: "394", price: "£620,000", change: "+6.0%" },
  { year: "2023", sales: "332", price: "£600,000", change: "−3.2%" },
  { year: "2024", sales: "444", price: "£625,000", change: "+4.2%" },
  { year: "2025", sales: "426", price: "£604,000", change: "−3.4%" },
];

const STREETS_HIGH = [
  { street: "Albion Square", sales: "14", median: "£2,450,000" },
  { street: "Elrington Road", sales: "9", median: "£1,700,000" },
  { street: "Lenthall Road", sales: "10", median: "£1,535,000" },
  { street: "Lavender Grove", sales: "30", median: "£1,502,000" },
  { street: "St Philip's Road", sales: "14", median: "£1,396,500" },
];

const STREETS_LOW = [
  { street: "Livermere Road", sales: "12", median: "£336,250" },
  { street: "Triangle Road", sales: "7", median: "£264,000" },
  { street: "Samuel Street", sales: "6", median: "£250,375" },
  { street: "Pamela Street", sales: "36", median: "£240,125" },
  { street: "Dunston Road", sales: "15", median: "£152,250" },
];

const CHECKS = [
  {
    icon: GraduationCap,
    title: "Schools",
    body:
      "Eight schools within walking range. Mossbourne Parkside Academy (primary) is a five-minute walk at 342m; The Excelsior Academy (secondary) six minutes; Halley House School and Mossbourne Community Academy both seven. Note that proximity is not admission — catchments and criteria change yearly and the distances here are straight-line, not the admissions measure. Confirm current catchments with Hackney, and check each school's current Ofsted position at reports.ofsted.gov.uk, before relying on any school.",
  },
  {
    icon: Train,
    title: "Transport",
    body:
      "Six stations within walking range: Hackney Downs (6 min, National Rail and Overground), Dalston Kingsland and Dalston Junction (8 min each), Hackney Central (10 min), London Fields (13 min) and Haggerston (15 min). Journey times: King's Cross 31 minutes, Bank 33, Canary Wharf 35, Oxford Circus 36. The honest caveat is line diversity — this is Overground country, so you're reliant on one network for most journeys.",
  },
  {
    icon: ShieldAlert,
    title: "Crime — the number, and the context",
    body:
      "1,746 street-level crimes recorded within roughly a mile in May 2026, led by violence and sexual offences (482, 28%) and anti-social behaviour (364, 21%). That's a high share of violent offences and worth taking seriously rather than explaining away. The context that matters: recorded-crime totals concentrate on high-footfall commercial streets and transport hubs, and police.uk points snap to representative map locations rather than exact addresses. Walk the specific street at different times of day — a residential Lavender Grove is not Dalston Junction on a Saturday night.",
  },
  {
    icon: Waves,
    title: "Flood — genuinely low",
    body:
      "Flood Zone 1, with a Very Low Environment Agency risk band — below a 1 in 1,000 annual chance. Three EA flood warning areas within 3km, nearest around 2.8km, and no recorded historic flood outline. At this level, insurance and lending are not usually affected. This is a genuine strength of E8.",
  },
  {
    icon: ShoppingBag,
    title: "Everyday convenience",
    body:
      "37 shops and food outlets and 54 cafés and restaurants in range, with the nearest food shop five minutes' walk and a Sainsbury's at the same distance. 18 GP and health facilities in range, the nearest a minute away. Green space is excellent: Dalston Eastern Curve Garden six minutes away and 11 named parks in range.",
  },
  {
    icon: Wallet,
    title: "Buying costs",
    body:
      "Hackney Band D council tax is £1,836/year (2024/25), running £1,224 to £3,672. SDLT at the area median of £585,000 comes to around £19,250 — an effective rate of 3.3% on a main residence.",
  },
  {
    icon: Wifi,
    title: "Broadband",
    body:
      "Hackney averages 174 Mbps, with 73% full-fibre and 96% superfast coverage. Openreach, Virgin Media and CityFibre — three providers, which is better competition than most London boroughs.",
  },
  {
    icon: Wind,
    title: "Air quality",
    body:
      "Low across NO2, PM10 and PM2.5 (index 1/10) at the nearest DEFRA monitor, 2.5km away in Victoria Park.",
  },
  {
    icon: FileText,
    title: "Leasehold",
    body:
      "83% of recent registered in-district sales with known tenure were leasehold (998 of 1,202). Treat lease length, ground rent, service-charge history, Section 20 notices and EWS1 status as core due diligence.",
  },
];

const SCHEMES = [
  {
    name: "London Fields Lido",
    body:
      "Hackney Council's £5m refurbishment completed in 2024. A significant value driver for London Fields-adjacent property, and well received locally.",
  },
  {
    name: "Hackney Walk",
    body:
      "approved expansion of the designer outlet on Mare Street, strengthening the retail offer along the E8/E9 corridor.",
  },
];

const RELATED_GUIDES = [
  { href: "/guides/sw3-chelsea-buyers-guide", label: "SW3 — Chelsea buyer's guide" },
];

export default function GuideE8HackneyPage() {
  useGuideSeo();
  const [, navigate] = useLocation();
  const goToBrief = () => navigate("/?q=E8");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              E8 · Hackney · Buyer's Guide 2026
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight mb-4">
              Is E8 (Hackney) a Good Place to Buy? — The 2026 Buyer's Guide
            </h1>
            <p className="text-sm text-muted-foreground/80 italic leading-relaxed">
              Data-led buyer's guide to E8 — London Fields, Broadway Market, Dalston and Hackney
              Central. Sold prices, schools, crime, flood risk and negotiating position, built from
              HM Land Registry, the Environment Agency, data.police.uk, Ofcom and OpenStreetMap.
              Generated 28 July 2026.
            </p>
          </div>

          {/* ── The short answer ─────────────────────────────────────────── */}
          <Section title="The short answer">
            <p>
              <strong className="text-foreground font-semibold">Yes — with your eyes open.</strong> E8
              is one of the strongest lifestyle purchases in east London, and the underlying data
              backs the reputation rather than contradicting it: eight schools within walking range
              with the nearest primary five minutes away, six stations within walking range, 37 shops
              and 54 cafés and restaurants in range, 11 named parks, and genuinely low flood risk.
            </p>
            <p>
              The median sold price across{" "}
              <strong className="text-foreground font-semibold">4,040 registered transactions</strong>{" "}
              in E8 over 2016–2025 is{" "}
              <strong className="text-foreground font-semibold">£585,000</strong>. The 2025 median is{" "}
              <strong className="text-foreground font-semibold">£604,000</strong>, down{" "}
              <strong className="text-foreground font-semibold">3.4%</strong> on 2024 — a softening at
              the top of a decade that has otherwise been strongly upward. E8 has risen from a
              £537,168 median in 2016 to £604,000 in 2025, and is still trading <em>above</em> its
              ten-year median.
            </p>
            <p>
              The trade-offs are real: recorded crime runs high and is led by violence and sexual
              offences, and{" "}
              <strong className="text-foreground font-semibold">
                83% of recent registered sales were leasehold
              </strong>
              . Neither is a dealbreaker. Both should shape how you view, negotiate and survey.
            </p>
          </Section>

          {/* ── What E8 is actually like ─────────────────────────────────── */}
          <Section title="What E8 is actually like">
            <p>
              E8 covers London Fields, Broadway Market and the streets running between Dalston and
              Hackney Central. It's the part of Hackney people mean when they say Hackney has changed,
              and residents here are famously evangelical about it. Broadway Market on a Saturday
              comes up in almost every buyer and resident account as the reason people bought locally,
              and the £5m refurbishment of London Fields Lido — completed 2024 — has strengthened the
              park's pull further.
            </p>
            <p>
              The recurring criticisms are worth knowing too: weekend noise from Dalston affecting the
              northern E8 streets, and a widely-shared feeling that the area has priced out the people
              who made it interesting. Both are real, and both are audible on a Saturday evening walk.
            </p>
          </Section>

          {/* ── Prices ───────────────────────────────────────────────────── */}
          <Section title="Prices: what's actually selling">
            <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-3 my-2">
              {HEADLINE_STATS.map((s) => (
                <Card key={s.label} className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                    {s.label}
                  </p>
                  <p
                    className={`font-serif text-2xl tracking-tight ${
                      s.down ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                    }`}
                  >
                    {s.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{s.note}</p>
                </Card>
              ))}
            </div>

            <h3 className="font-serif text-xl tracking-tight text-foreground mt-6 mb-1">
              Ten-year trend
            </h3>
            <DataTable
              caption="Median price by year (HM Land Registry)"
              head={["Year", "Sales", "Median", "Change"]}
              rows={PRICE_HISTORY.map((r) => [r.year, r.sales, r.price, r.change])}
              alignLast
            />

            <p>
              Read that as a market that has climbed roughly 12% over the decade and is now
              consolidating rather than falling. Sales volume has held up too: 426 transactions in
              2025 against 472 in 2016.
            </p>
            <p>
              The most recent 12 registered sales ran{" "}
              <strong className="text-foreground font-semibold">£415,000 to £1,042,500</strong>,
              median <strong className="text-foreground font-semibold">£508,075</strong> — below the
              longer-run window median, but the batch is flat-heavy, with a single Grand Union
              Crescent terrace at the top.
            </p>

            <h3 className="font-serif text-xl tracking-tight text-foreground mt-6 mb-1">
              Where the value sits
            </h3>
            <p>
              Streets ranked by the median of at least five recorded sales;{" "}
              <strong className="text-foreground font-semibold">
                138 of 200 named streets in E8 qualify.
              </strong>
            </p>
            <DataTable
              caption="Highest median by street (HM Land Registry)"
              head={["Highest median", "Sales", "Median"]}
              rows={STREETS_HIGH.map((r) => [r.street, r.sales, r.median])}
              alignLast
            />
            <DataTable
              caption="Lowest median by street (HM Land Registry)"
              head={["Lowest median", "Sales", "Median"]}
              rows={STREETS_LOW.map((r) => [r.street, r.sales, r.median])}
              alignLast
            />
          </Section>

          {/* ── The negotiating position ─────────────────────────────────── */}
          <Section title="The negotiating position">
            <div className="not-prose my-2 flex items-start gap-3 rounded-lg border-l-2 border-primary bg-primary/5 p-4">
              <TrendingDown className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/90 leading-relaxed">
                Fair value is a per-property calculation, not a headline. But the district context is
                useful: medians fell 3.4% over the last full year, so{" "}
                <strong className="font-semibold">
                  a seller cannot argue that local values are currently rising
                </strong>{" "}
                — even though the longer trend is upward. In a consolidating market, anchoring your
                offer to registered sold prices rather than the asking price is defensible without
                being dismissed as unrealistic.
              </p>
            </div>
          </Section>

          {/* ── Practical checks ─────────────────────────────────────────── */}
          <Section title="The practical checks">
            <div className="not-prose space-y-3 mt-2">
              {CHECKS.map(({ icon: Icon, title, body }) => (
                <Card key={title} className="p-4 flex items-start gap-3">
                  <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                  </div>
                </Card>
              ))}
            </div>
          </Section>

          {/* ── Planning and what's being built ──────────────────────────── */}
          <Section title="Planning and what's being built">
            <p>
              The location tested sits within the{" "}
              <strong className="text-foreground font-semibold">
                Graham Road and Mapledene conservation area
              </strong>{" "}
              (designated 1997). That cuts both ways: extra control over alterations, demolition,
              materials and tree work protects the area's character and can support resale values, but
              permitted-development rights are narrower than normal, so budget for consent on anything
              structural.
            </p>
            <p>Two schemes worth knowing:</p>
            <ul className="not-prose space-y-2 mt-1">
              {SCHEMES.map((s) => (
                <li
                  key={s.name}
                  className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed"
                >
                  <Building2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-foreground font-medium">{s.name}</strong> — {s.body}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* ── Verdict ──────────────────────────────────────────────────── */}
          <Section title="So should you buy in E8?">
            <p>
              <strong className="text-foreground font-semibold">
                E8 suits a buyer who wants genuine neighbourhood life within around 35 minutes of the
                City, and who values schools, parks and walkable amenities over a short Tube ride.
              </strong>{" "}
              The data supports the reputation on almost every practical measure, flood risk is
              genuinely low, and the ten-year price trend is upward.
            </p>
            <p>
              <strong className="text-foreground font-semibold">Be cautious if</strong> the crime
              profile matters to you — a 28% share of violence and sexual offences is high and
              shouldn't be waved away — or if you need line diversity for your commute. And be careful
              with leasehold: at 83% of sales, the lease is the deal in most E8 purchases.
            </p>
            <div className="not-prose my-2 flex items-start gap-3 rounded-lg border-l-2 border-primary bg-primary/5 p-4">
              <TrendingDown className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/90 leading-relaxed">
                <strong className="font-semibold">
                  The single biggest mistake buyers make here
                </strong>{" "}
                is buying the Broadway Market Saturday and not the Tuesday night. Visit twice, at
                different times, on the specific street.
              </p>
            </div>
          </Section>

          {/* ── CTA ──────────────────────────────────────────────────────── */}
          <div className="mt-12 rounded-xl border border-primary/25 bg-primary/5 px-5 py-6 sm:px-7 sm:py-7">
            <h2 className="font-serif text-2xl tracking-tight mb-2">Get your free E8 area brief</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-2xl">
              Before you view or offer, get the complete picture in under 60 seconds: comparable sold
              prices, a fair-value range and pre-offer strategy, risk flags, schools, transport,
              broadband and council tax.
            </p>
            <Button
              size="lg"
              className="w-full sm:w-auto font-semibold gap-1.5"
              onClick={goToBrief}
              data-testid="button-generate-e8-brief"
            >
              Generate your free E8 area brief
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground/70 mt-4 leading-relaxed">
              Built on official UK sources — HM Land Registry, the Environment Agency, police.uk,
              Ofcom, DEFRA and ONS. No AI estimates. No portal prices.
            </p>
          </div>

          {/* ── Related guides (internal links) ──────────────────────────── */}
          <div className="mt-10 border-t border-border/40 pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-3">
              More area guides
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {RELATED_GUIDES.map((g) => (
                <Link key={g.href} href={g.href}>
                  <span className="text-sm text-primary underline underline-offset-2 hover:no-underline">
                    {g.label} →
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/50 mt-8 leading-relaxed">
            Data sources: HM Land Registry Price Paid data, Environment Agency, data.police.uk,
            Ofsted, Ofcom Connected Nations 2024, ONS, DEFRA, TfL. Figures correct as of July 2026 and
            refreshed periodically. A due-diligence reference, not a substitute for a RICS survey,
            legal or financial advice.
          </p>
        </article>
      </main>

      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl tracking-tight mb-3">{title}</h2>
      <div className="space-y-4 text-base text-muted-foreground leading-relaxed [&_p]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function DataTable({
  caption,
  head,
  rows,
  alignLast = false,
}: {
  caption: string;
  head: string[];
  rows: string[][];
  alignLast?: boolean;
}) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-muted/40 text-left">
            {head.map((h, i) => (
              <th
                key={h}
                className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground ${
                  alignLast && i === head.length - 1 ? "text-right" : ""
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-border/40">
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-2.5 ${
                    ci === 0 ? "font-medium text-foreground" : "text-muted-foreground"
                  } ${alignLast && ci === r.length - 1 ? "text-right" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
