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
const PAGE_URL = "https://www.luxproperty.ai/guides/n1-islington-buyers-guide";
const PAGE_TITLE = "Is N1 (Islington) a Good Place to Buy? Buyer's Guide 2026 | LuxProperty AI";
const PAGE_DESC =
  "N1 (Islington): £675k median, down 7.9% YoY, King's Cross 4 min, an Outstanding school nearby — but medium flood risk. A data-led 2026 buyer's guide.";

const ARTICLE_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Is N1 (Islington) a Good Place to Buy? The 2026 Buyer's Guide",
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
  about: "Buying property in N1 (Islington), London",
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

    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.setAttribute("data-guide-ld", "n1");
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

// ─── Data (from the July 2026 N1 area report — refresh periodically) ─────────
const HEADLINE_STATS = [
  { label: "Median sold price", value: "£675,000", note: "1,000 Land Registry records, 10 years" },
  { label: "Year-on-year", value: "−7.9%", note: "the market has softened", down: true },
  { label: "10-year trajectory", value: "−3.6%", note: "a volatile decade, not a steady climb", down: true },
  { label: "Est. SDLT on median", value: "~£42,500", note: "primary residence, at £675k" },
];

const PRICE_HISTORY = [
  { year: "2016", price: "£700,000", change: "—" },
  { year: "2017", price: "£770,625", change: "+10.1%" },
  { year: "2018", price: "£883,250", change: "+14.6%" },
  { year: "2019", price: "£767,250", change: "−13.1%" },
  { year: "2020", price: "£786,700", change: "+2.5%" },
  { year: "2021", price: "£855,000", change: "+8.7%" },
  { year: "2022", price: "£889,500", change: "+4.0%" },
  { year: "2023", price: "£715,000", change: "−19.6%" },
  { year: "2024", price: "£732,750", change: "+2.5%" },
  { year: "2025", price: "£675,000", change: "−7.9%" },
];

const CHECKS = [
  {
    icon: GraduationCap,
    title: "Schools — an Outstanding option nearby",
    body:
      "Frank Barnes School for Deaf Children is rated Outstanding by Ofsted, about a 6-minute walk. Overall school provision in the area is reasonable, but it's a specialist setting — confirm mainstream catchment options with Islington Council before relying on any single school.",
  },
  {
    icon: Train,
    title: "Commuting — one of the stronger positions in London",
    body:
      "London King's Cross (National Rail) is a 4-minute walk, with multiple stations in range — a genuinely strong commuter position. Coverage varies across N1, so confirm the exact stations and walk times for any specific property.",
  },
  {
    icon: Wifi,
    title: "Broadband — excellent",
    body:
      "Average download speeds around 171 Mbps, with 72% full-fibre availability. Check your specific address at checker.ofcom.org.uk.",
  },
  {
    icon: ShieldAlert,
    title: "Crime — understand it honestly",
    body:
      "Around 2,401 crimes were recorded in the Islington area in May 2026 — significantly above the national average, led by violence and sexual offences (20%). Incidents concentrate on high-footfall commercial streets; residential streets are generally safer than the borough-wide figure suggests. Visit the specific street at different times, including weekend evenings.",
  },
  {
    icon: Waves,
    title: "Flood & environmental risk — the key check for N1",
    body:
      "N1 carries medium flood risk — Environment Agency Flood Zone 2 (Medium Probability). This can raise buildings-insurance excess and premiums, so request the seller's insurance renewal history, check the EA flood map for the specific plot, and factor a specialist quote in before you offer. This is the single most important due-diligence item here.",
  },
  {
    icon: Building2,
    title: "Planning & nearby development",
    body:
      "45 planning applications were recorded nearby in the past 12 months. Two notable schemes: Angel Central (commercial refurbishment, mixed impact) and the King's Cross ripple effect (regeneration-led, likely upside). New development can add amenity but also construction disruption — check proximity and timelines on Islington's planning portal.",
  },
  {
    icon: Wallet,
    title: "Running costs & the market",
    body:
      "Estimated SDLT on the £675k median is around £42,500 for a primary residence. Supply is tight and homes take ~38 days to sell on average. Stress-test your mortgage at base rate +2%, and if buying leasehold, verify remaining lease length, ground rent and service charges before offering.",
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
  { href: "/guides/e8-hackney-buyers-guide", label: "E8 — Hackney buyer's guide" },
];

export default function GuideN1IslingtonPage() {
  useGuideSeo();
  const [, navigate] = useLocation();
  const goToBrief = () => navigate("/?q=N1");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              N1 · Islington · Buyer's Guide 2026
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight mb-4">
              Is N1 (Islington) a Good Place to Buy? The 2026 Buyer's Guide
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              N1 — Islington, Barnsbury and the Angel — is one of central-north London's most
              connected postcodes, minutes from King's Cross and the City. It suits families
              prioritising schools and daily commuters most strongly. The median transaction price
              sits at £675,000, and prices have fallen sharply over the past year (−7.9%
              year-on-year), which puts negotiating power firmly with the buyer right now. Two things
              to price in with your eyes open: much of the area carries medium flood risk that affects
              insurance, and recorded crime runs above the national average. Neither is a dealbreaker
              — but both should shape how you view, negotiate and survey.
            </p>
          </div>

          {/* ── What N1 is actually like ─────────────────────────────────── */}
          <Section title="What N1 is actually like">
            <p>
              N1 is a mid-market central-London market in the London Borough of Islington (ward:
              Caledonian; constituency: Islington South and Finsbury). It's a genuinely mixed,
              well-established postcode — Georgian and Victorian terraces around Barnsbury, the
              canal and Angel's shopping and nightlife, and the regeneration pull of neighbouring
              King's Cross. Demand is currently high, with 100 registered transactions in the most
              recent year, yet prices are softening — an unusual combination that favours a prepared
              buyer.
            </p>
            <p>
              The honest questions are: does the central-London lifestyle fit, do the numbers work at
              today's falling prices, and are you paying a fair price for the specific property — not
              just for the N1 postcode. Because N1 straddles borough boundaries, always confirm
              comparables from genuine N1 sales rather than the wider area.
            </p>
          </Section>

          {/* ── Prices ───────────────────────────────────────────────────── */}
          <Section title="Prices: what homes in N1 actually sell for">
            <p>
              The median transaction value in N1 is £675,000, based on 1,000 Land Registry records
              over ten years. The market has softened notably — −7.9% year-on-year, with a 10-year
              trajectory of −3.6%. As the year-by-year figures show, this has been a volatile decade
              rather than a steady climb.
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

            <div className="not-prose my-5 rounded-lg border border-border/50 bg-muted/30 p-4">
              <p className="text-sm font-semibold text-foreground mb-2">Your negotiating position</p>
              <ul className="space-y-2">
                {[
                  "Prices are trending −7.9% YoY — a seller can't credibly argue values are rising.",
                  "Fair value on a median-type property sits around £595k–£698k, with a sensible opening range of £556k–£608k (based on registered comparables and 100 recent transactions).",
                  "Demand is soft: sellers are unlikely to receive competing offers, giving patient buyers real room to negotiate.",
                  "Medium flood risk and above-average crime are legitimate pricing points — an insurance uplift and survey findings can support a lower offer.",
                  "Ask the agent about time on market and prior price reductions, and look up the seller's original purchase price at gov.uk/search-property-information — their equity position guides their floor.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                    <TrendingDown className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p>
              N1's registered sales span an enormous range once you look borough-wide, so anchor your
              offer to sales of the same property type on genuinely N1 streets — a full brief resolves
              those street-level comparables for the specific property.
            </p>
          </Section>

          {/* ── Practical checks ─────────────────────────────────────────── */}
          <Section title="The practical buyer checks for N1">
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
              N1 rewards buyers who want a genuinely central, superbly connected London base — minutes
              from King's Cross and the City — and who negotiate from real data rather than paying
              asking on location alone. With prices down 7.9% year-on-year and soft demand, patient,
              informed buyers have real leverage in the current market. What you're pricing in: medium
              flood risk that affects insurance, and above-average crime concentrated on the
              commercial corridors.
            </p>
            <div className="not-prose my-5 flex items-start gap-3 rounded-lg border-l-2 border-primary bg-primary/5 p-4">
              <TrendingDown className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/90 leading-relaxed">
                Proceed — carefully, and from a position of leverage. Commission an independent flood
                risk assessment and confirm insurance terms before exchange, anchor your offer to
                genuine N1 comparables, and use the softening market in negotiation.
              </p>
            </div>
          </Section>

          {/* ── CTA ──────────────────────────────────────────────────────── */}
          <div className="mt-12 rounded-xl border border-primary/25 bg-primary/5 px-5 py-6 sm:px-7 sm:py-7">
            <h2 className="font-serif text-2xl tracking-tight mb-2">Get the full data brief for N1 — free</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-2xl">
              This guide covers N1 at area level — but street-level risk, catchments and comparables
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
              data-testid="button-generate-n1-brief"
            >
              Generate your free N1 brief
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
