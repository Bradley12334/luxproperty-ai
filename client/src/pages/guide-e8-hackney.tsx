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
  Building2,
  Wallet,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";

// ─── SEO ─────────────────────────────────────────────────────────────────────
// Sets the exact title tag / meta description, canonical + OG, and a JSON-LD
// Article schema. Mirrors the SW3 / SE1 guides (with the precise title string,
// which uses " | LuxProperty AI") and adds structured data for rich results.
const PAGE_URL = "https://www.luxproperty.ai/guides/e8-hackney-buyers-guide";
const PAGE_TITLE = "Is E8 (Hackney) a Good Place to Buy? Buyer's Guide 2026 | LuxProperty AI";
const PAGE_DESC =
  "E8 (London Fields, Hackney): £519k median, prices down 1% YoY, an Outstanding primary 4 min away and low flood risk. A data-led 2026 buyer's guide.";

const ARTICLE_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Is E8 (Hackney) a Good Place to Buy? The 2026 Buyer's Guide",
  description: PAGE_DESC,
  datePublished: "2026-07-01",
  dateModified: "2026-07-21",
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

// ─── Data (from the July 2026 brief — refresh periodically) ──────────────────
const HEADLINE_STATS = [
  { label: "Median sold price", value: "£519,000", note: "1,000 Land Registry records, 10 years" },
  { label: "Year-on-year", value: "−1.0%", note: "prices have softened slightly", down: true },
  { label: "10-year trajectory", value: "−5.1%", note: "a volatile decade, not a steady climb", down: true },
  { label: "Est. price per m²", value: "£5,463", note: "flats cluster £425k–£590k" },
];

const PRICE_HISTORY = [
  { year: "2016", price: "£547,125", change: "—" },
  { year: "2019", price: "£607,500", change: "+28.4%" },
  { year: "2022", price: "£500,000", change: "−16.7%" },
  { year: "2023", price: "£592,500", change: "+18.5%" },
  { year: "2024", price: "£524,138", change: "−11.5%" },
  { year: "2025", price: "£519,000", change: "−1.0%" },
];

const RECENT_SALES = [
  { address: "47 Grand Union Crescent", price: "£1,042,500", type: "Terraced", date: "Dec 2025" },
  { address: "Graham House, 68 Lansdowne Drive", price: "£565,000", type: "Terraced", date: "Dec 2025" },
  { address: "21 Blackburn House, Prodigal Square", price: "£590,000", type: "Flat", date: "Dec 2025" },
  { address: "Flat 2, 159 Graham Road", price: "£496,150", type: "Flat", date: "Dec 2025" },
  { address: "Flat 46, Cordwainer House, 43 Mare Street", price: "£491,000", type: "Flat", date: "Dec 2025" },
  { address: "Flat 13, Sledge Tower, Dalston Square", price: "£425,000", type: "Flat", date: "Dec 2025" },
];

const COMMUTES = [
  { dest: "London Bridge", time: "28 min" },
  { dest: "City of London (EC2)", time: "30 min" },
  { dest: "Canary Wharf", time: "31 min" },
  { dest: "West End (W1)", time: "42 min" },
];

const CHECKS = [
  {
    icon: GraduationCap,
    title: "Schools — E8's strongest card",
    body:
      "3 Outstanding and 3 Good-rated schools within a 20-minute walk — Gayhurst Community School (Outstanding, 4 minutes), Morningside and St John & St James CofE (both Outstanding), plus Mossbourne Parkside Academy (Good) for secondary. Proximity doesn't guarantee catchment placement — confirm with the school or Hackney Council.",
  },
  {
    icon: Train,
    title: "Commuting — excellent, even without a tube",
    body:
      "London Fields Overground is a 2-minute walk, with Hackney Central (8 min) and Hackney Downs (10 min, National Rail) close behind — three stations within ten minutes. Walk Score 85, Very Walkable.",
  },
  {
    icon: Wifi,
    title: "Broadband — excellent",
    body:
      "174 Mbps average download, with full fibre available to 73% of premises (Ofcom 2024). Check your specific address at checker.ofcom.org.uk.",
  },
  {
    icon: ShieldAlert,
    title: "Crime — the number, and the context",
    body:
      "1,786 crimes recorded in the Hackney area in May 2026 — significantly above the national average, led by violence and sexual offences (25%) and anti-social behaviour (22%). Incidents concentrate on high-footfall commercial streets (the Dalston nightlife corridor); residential streets are generally safer than the aggregate suggests. Visit the specific street at different times, including weekend evenings.",
  },
  {
    icon: Waves,
    title: "Flood & climate — low flood risk, watch subsidence",
    body:
      "Flood risk is Low — E8 is predominantly Environment Agency Flood Zone 1, a genuine plus for insurability and resale (confirm at property level via the EA Flood Map). But E8 sits on London clay: subsidence sensitivity is moderate, mature trees within 10m of foundations are the classic watch-out, so commission a RICS Level 3 Building Survey and get a buildings-insurance quote before exchange.",
  },
  {
    icon: Building2,
    title: "Developments worth knowing about",
    body:
      "London Fields Lido's £5m refurbishment (completed 2024) is a value driver for park-adjacent streets. Hackney Walk's designer-outlet expansion on Mare Street has planning approval. 31 planning applications were recorded nearby in the past 12 months — check Hackney's planning portal before exchange.",
  },
  {
    icon: Wallet,
    title: "Running costs & the rental angle",
    body:
      "Council tax is typically Band C–D (~£1,632–£2,244/yr). SDLT on the £519k median is around £26,900 for a primary residence. Rents run ~£1,950 (1-bed) to ~£3,400 (3-bed) pcm with very high demand; gross yields 3.8–5.0%. Stress-test your mortgage at base rate +2%, and verify lease terms if leasehold.",
  },
];

const BRIEF_INCLUDES = [
  "Real comparable sold prices near the property (HM Land Registry)",
  "A fair-value range and a pre-offer strategy for the specific property — so you know what to actually offer",
  "Risk flags — flood, crime, planning activity",
  "Schools, transport, broadband and council tax",
];

const RELATED_GUIDES = [
  { href: "/guides/sw3-chelsea-buyers-guide", label: "SW3 — Chelsea buyer's guide" },
  { href: "/guides/se1-southwark-buyers-guide", label: "SE1 — Southwark buyer's guide" },
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
              Is E8 (Hackney) a Good Place to Buy? The 2026 Buyer's Guide
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              <strong className="text-foreground font-semibold">Yes — with your eyes open.</strong> E8
              is one of the strongest lifestyle purchases in East London: London Fields station is on
              the doorstep, Broadway Market anchors the weekend, an Outstanding-rated primary is a
              four-minute walk, and flood risk is genuinely low. The median transaction price sits at
              £519,000, and prices have softened slightly (−1.0% year-on-year), which puts negotiating
              power with the buyer rather than the seller right now. The trade-offs are real — crime
              runs above the national average (concentrated on commercial streets), and the recent
              dip means you should benchmark comparables carefully — but neither is a dealbreaker.
            </p>
          </div>

          {/* ── What E8 is actually like ─────────────────────────────────── */}
          <Section title="What E8 is actually like">
            <p>
              E8 covers London Fields, Broadway Market, and the streets between Dalston and Hackney
              Central. It's the part of Hackney people mean when they say Hackney has changed — and
              residents here are famously evangelical about it. Broadway Market on a Saturday comes up
              in almost every buyer and resident review as the reason people bought locally, and the
              £5m refurbishment of London Fields Lido (completed 2024) has only strengthened the
              park's pull.
            </p>
            <p>
              The recurring criticisms are worth knowing too: weekend noise from Dalston reaches the
              northern E8 streets, and there's genuine local anxiety that rising prices and commercial
              pressure on Broadway Market are eroding the independent character that made the area
              desirable in the first place. Who it suits best: families prioritising schools, and
              daily commuters — the two strongest buyer signals in the data.
            </p>
          </Section>

          {/* ── Prices ───────────────────────────────────────────────────── */}
          <Section title="Prices: what homes in E8 actually sell for">
            <p>
              The median transaction value in E8 is £519,000, based on 1,000 Land Registry records
              over ten years. The market has softened — −1.0% year-on-year, with a 10-year trajectory
              of −5.1% — a volatile decade rather than a steady climb.
            </p>
            <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
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

            <DataTable
              caption="Median price by year (HM Land Registry)"
              head={["Year", "Median price", "Change"]}
              rows={PRICE_HISTORY.map((r) => [r.year, r.price, r.change])}
              alignLast
            />

            <DataTable
              caption="Recent sold prices — completed sales (HM Land Registry)"
              head={["Address", "Price", "Type", "Date"]}
              rows={RECENT_SALES.map((r) => [r.address, r.price, r.type, r.date])}
            />

            <p>
              The spread is wide — from a £425k Dalston Square flat to a £1m+ terraced house near the
              park — so anchor your offer to sales of the same property type, not the area average.
              Flats cluster around £425k–£590k; period terraces near London Fields command a
              significant premium.
            </p>

            <div className="not-prose my-5 rounded-lg border border-border/50 bg-muted/30 p-4">
              <p className="text-sm font-semibold text-foreground mb-2">Your negotiating position</p>
              <ul className="space-y-2">
                {[
                  "Prices are trending −1.0% YoY — a seller can't credibly argue values are rising.",
                  "100 transactions in the most recent year with soft demand means competing offers are less likely.",
                  "Fair value on a median-type property sits around £503k–£590k, with a sensible opening range of £470k–£514k.",
                  "Ask the agent about time on market and prior price reductions — both signal motivation.",
                  "Look up the seller's original purchase price at gov.uk/search-property-information — their equity position guides their floor.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                    <TrendingDown className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          {/* ── Commuting table ──────────────────────────────────────────── */}
          <Section title="Commuting: live TfL journey times from E8">
            <DataTable
              caption="Live TfL journey times from E8"
              head={["Destination", "Time"]}
              rows={COMMUTES.map((r) => [r.dest, r.time])}
              alignLast
            />
          </Section>

          {/* ── Practical checks ─────────────────────────────────────────── */}
          <Section title="The practical buyer checks for E8">
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

          {/* ── Verdict ──────────────────────────────────────────────────── */}
          <Section title="The honest verdict">
            <p>
              E8 delivers what most inner-London postcodes only promise: a genuinely walkable
              neighbourhood (Walk Score 85), an Outstanding school four minutes away, three stations
              within ten minutes, low flood risk, and one of the strongest community identities in the
              capital. What you're pricing in: above-average crime concentrated on the commercial
              corridors, a market that's dipped −1.0% over the past year, and London-clay subsidence
              sensitivity that makes a Level 3 survey non-negotiable.
            </p>
            <div className="not-prose my-5 flex items-start gap-3 rounded-lg border-l-2 border-primary bg-primary/5 p-4">
              <TrendingDown className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/90 leading-relaxed">
                For a patient buyer, that softening is arguably the opportunity — pricing power
                currently sits with informed buyers. Anchor your offer to comparables, raise the
                market trend in negotiation, and do the street-level homework on crime and subsidence
                before exchange. Bottom line: proceed — carefully, and from a position of leverage.
              </p>
            </div>
          </Section>

          {/* ── CTA ──────────────────────────────────────────────────────── */}
          <div className="mt-12 rounded-xl border border-primary/25 bg-primary/5 px-5 py-6 sm:px-7 sm:py-7">
            <h2 className="font-serif text-2xl tracking-tight mb-2">Get the full data brief for E8 — free</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-2xl">
              This guide covers E8 at area level — but street-level risk, catchments and comparables
              vary. Get the complete picture for the specific property in under 60 seconds:
            </p>
            <ul className="grid grid-cols-1 gap-2 mb-6">
              {BRIEF_INCLUDES.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="w-full sm:w-auto font-semibold gap-1.5"
              onClick={goToBrief}
              data-testid="button-generate-e8-brief"
            >
              Generate your free E8 brief
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground/70 mt-4 leading-relaxed">
              Built on official UK sources — HM Land Registry, police.uk, Ofsted, the Environment
              Agency. No AI estimates. No portal prices.
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
