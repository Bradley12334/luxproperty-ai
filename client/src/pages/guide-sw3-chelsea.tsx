import { useEffect } from "react";
import { useLocation } from "wouter";
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
  Percent,
  TrendingDown,
} from "lucide-react";

// ─── SEO ─────────────────────────────────────────────────────────────────────
// Sets the exact title tag / meta description requested, plus canonical + OG,
// mirroring what useDocumentTitle does but with the precise title string (which
// uses " | LuxProperty.ai", not the hook's default " — LuxProperty.ai" suffix).
const PAGE_URL = "https://www.luxproperty.ai/guides/sw3-chelsea-buyers-guide";
const PAGE_TITLE = "Is SW3 (Chelsea) a Good Place to Buy? Buyer's Guide | LuxProperty.ai";
const PAGE_DESC =
  "Buying in SW3? Real Land Registry sold prices — median £1.55m across 2,903 sales — plus schools, transport, crime, flood risk and negotiation guidance.";

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

    return () => {
      // Restore text-based tags so navigating away doesn't flash stale content.
      // Canonical / og:url are owned by the next route's effect — not restored.
      document.title = prevTitle;
      restores.forEach(({ el, attr, prev }) => {
        if (el && prev !== null) el.setAttribute(attr, prev);
      });
    };
  }, []);
}

// ─── Data (from the SW3 brief generated 29 July 2026 — refresh periodically) ──
const HEADLINE_STATS = [
  { label: "Median, 2016–2025", value: "£1,550,000", note: "2,903 Land Registry sales" },
  { label: "Median, 2025", value: "£1,500,000", note: "288 sales" },
  { label: "Year-on-year", value: "−3.5%", note: "below its own ten-year median", down: true },
  { label: "Confidence", value: "High", note: "based on registered sold prices" },
];

const PRICE_HISTORY = [
  { year: "2016", sales: "272", price: "£1,437,500", change: "—" },
  { year: "2017", sales: "270", price: "£1,475,000", change: "+2.6%" },
  { year: "2018", sales: "243", price: "£1,575,000", change: "+6.8%" },
  { year: "2019", sales: "256", price: "£1,642,500", change: "+4.3%" },
  { year: "2020", sales: "224", price: "£1,752,500", change: "+6.7%" },
  { year: "2021", sales: "340", price: "£1,500,000", change: "−14.4%" },
  { year: "2022", sales: "383", price: "£1,650,000", change: "+10.0%" },
  { year: "2023", sales: "300", price: "£1,620,000", change: "−1.8%" },
  { year: "2024", sales: "327", price: "£1,555,000", change: "−4.0%" },
  { year: "2025", sales: "288", price: "£1,500,000", change: "−3.5%" },
];

const STREETS_HIGH = [
  { street: "Chelsea Square", sales: "13", median: "£12,300,000" },
  { street: "Egerton Crescent", sales: "13", median: "£12,161,660" },
  { street: "The Vale", sales: "10", median: "£11,850,000" },
  { street: "Manresa Road", sales: "8", median: "£10,332,437" },
  { street: "Carlyle Square", sales: "14", median: "£8,875,000" },
];

const STREETS_LOW = [
  { street: "Wiltshire Close", sales: "8", median: "£717,500" },
  { street: "Chelsea Manor Street", sales: "119", median: "£650,000" },
  { street: "Britten Street", sales: "12", median: "£625,000" },
  { street: "Sloane Avenue", sales: "217", median: "£505,000" },
  { street: "Mulberry Close", sales: "8", median: "£290,000" },
];

const CHECKS = [
  {
    icon: GraduationCap,
    title: "Schools",
    body:
      "Six mainstream schools sit within a seven-minute walk: Oratory Roman Catholic Primary (3 min, 232m), Marlborough Primary (5 min), The Hampshire School Chelsea (6 min, independent), St Joseph's Catholic Primary (6 min), St Thomas More Language College (secondary, 7 min) and Christ Church C of E Primary (7 min). Proximity is not admission — catchments and criteria change yearly and these distances are straight-line, not the admissions measure. Confirm current catchments with Kensington and Chelsea, and check each school's current position at reports.ofsted.gov.uk, before relying on any of them.",
  },
  {
    icon: Train,
    title: "Transport",
    body:
      "This is SW3's genuine weak point, and the one thing the area's reputation oversells. Four stations in walking range: South Kensington (8 min, Piccadilly/District/Circle), Sloane Square (11 min, District/Circle), Gloucester Road (16 min) and Knightsbridge (18 min). Journey times: Oxford Circus 32 minutes, King's Cross 36, Bank 37, Canary Wharf 48. Three lines total, and nothing on the doorstep. If your commute is east, factor it properly.",
  },
  {
    icon: ShieldAlert,
    title: "Crime",
    body:
      "1,081 street-level crimes recorded within roughly a mile in May 2026, led by anti-social behaviour (250, 23%) and violence and sexual offences (195, 18%). Vehicle crime at 109 (10%) runs noticeably higher than comparable inner London districts — worth weighing if you'll park on-street. As everywhere, recorded totals concentrate on high-footfall commercial streets: King's Road on a Saturday is not a Chelsea garden square on a Tuesday.",
  },
  {
    icon: Waves,
    title: "Flood",
    body:
      "Flood Zone 1, with a Very Low Environment Agency risk band — below a 1 in 1,000 annual chance. Six EA flood warning areas within 3km, nearest around 1.4km at the tidal Thames, and no recorded historic flood outline. At this level, insurance and lending are not usually affected.",
  },
  {
    icon: ShoppingBag,
    title: "Everyday convenience",
    body:
      "65 shops and food outlets and 165 cafés and restaurants in range, the nearest food shop two minutes' walk. 44 GP and health facilities in range, including the Royal Brompton four minutes away. Green space is excellent: Markham Square Gardens three minutes away and 48 named parks in range.",
  },
  {
    icon: Wallet,
    title: "Buying costs",
    body:
      "Here SW3 is genuinely exceptional. Kensington and Chelsea Band D council tax is £1,135/year (2024/25), running £757 to £2,270 — among the lowest in England, and roughly 40% below neighbouring boroughs. Stamp duty is the opposite story: at the area median of £1,550,000, SDLT comes to around £99,750, an effective rate of 6.4% on a main residence. Budget for it early; it is the single largest transaction cost you will face.",
  },
  {
    icon: Wifi,
    title: "Broadband",
    body:
      "Kensington and Chelsea averages 167 Mbps, with 70% full-fibre and 95% superfast coverage. Two providers — Openreach and Virgin Media — so less competition than boroughs further east.",
  },
  {
    icon: Wind,
    title: "Air quality",
    body:
      "Low across NO2, PM10 and PM2.5 (index 1/10) at the nearest DEFRA monitor, 2.1km away in Battersea.",
  },
  {
    icon: FileText,
    title: "Leasehold",
    body:
      "71% of recent registered in-district sales with known tenure were leasehold (651 of 915). Lower than most inner London districts, but still the majority — and in Chelsea's mansion blocks, service charges and Section 20 major-works bills can be substantial. Treat lease length, ground rent, service-charge history, Section 20 notices and EWS1 status as core due diligence.",
  },
  {
    icon: Percent,
    title: "Yield, if you're asking",
    body:
      "Indicative gross yield is 1.5–2.6%, calculated against London-region rent benchmarks. That is low enough that SW3 does not work as a rental investment on income alone. Recorded sales velocity is around 290 a year across 2,903 sales in a decade — a liquid enough market to exit, but not a fast one.",
  },
];

const SCHEMES = [
  {
    name: "Lots Road Power Station",
    body:
      "740 residential units plus retail and community space on the former power station site at the SW3/SW10 border, completing 2025–26. Adds meaningful supply to Chelsea World's End; watch for short-term softening in the SW10 overlap.",
  },
  {
    name: "Royal Brompton Hospital site",
    body:
      "NHS England's long-term plan to consolidate heart and lung services may release the Fulham Road site for residential development. Timeline uncertain, 5+ years.",
  },
];

export default function GuideSW3ChelseaPage() {
  useGuideSeo();
  const [, navigate] = useLocation();
  const goToBrief = () => navigate("/?q=SW3");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              SW3 · Chelsea · Buyer's Guide 2026
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight mb-4">
              Is SW3 (Chelsea) a Good Place to Buy? — The 2026 Buyer's Guide
            </h1>
            <p className="text-sm text-muted-foreground/80 italic leading-relaxed">
              Data-led buyer's guide to SW3 — Chelsea, King's Road, Sloane Avenue and the streets
              running down to Cheyne Walk. Sold prices, schools, crime, flood risk and negotiating
              position, built from HM Land Registry, the Environment Agency, data.police.uk, Ofcom
              and OpenStreetMap. Generated 29 July 2026.
            </p>
          </div>

          {/* ── The short answer ─────────────────────────────────────────── */}
          <Section title="The short answer">
            <p>
              <strong className="text-foreground font-semibold">
                Yes — if you're buying it to live in, not to earn from.
              </strong>{" "}
              SW3 delivers on almost everything its reputation promises: six mainstream schools within
              a seven-minute walk, 65 shops and 165 cafés and restaurants in range, 48 named parks,
              Flood Zone 1, and one of the lowest council tax bills in the country.
            </p>
            <p>
              The median sold price across{" "}
              <strong className="text-foreground font-semibold">2,903 registered transactions</strong>{" "}
              in SW3 over 2016–2025 is{" "}
              <strong className="text-foreground font-semibold">£1,550,000</strong>. The 2025 median
              is <strong className="text-foreground font-semibold">£1,500,000</strong>, down{" "}
              <strong className="text-foreground font-semibold">3.5%</strong> on 2024 — and, unlike
              much of London, that leaves SW3 trading <em>below</em> its own ten-year median. Prices
              peaked in 2020 at £1,752,500 and are down roughly 14% from that high.
            </p>
            <p>
              Two numbers shape every decision here. Stamp duty at the area median is around{" "}
              <strong className="text-foreground font-semibold">£99,750</strong>. Indicative gross
              yield is <strong className="text-foreground font-semibold">1.5–2.6%</strong> — the
              lowest of any outcode we cover. SW3 is a place to own, not a place to earn a return.
            </p>
          </Section>

          {/* ── What SW3 is actually like ────────────────────────────────── */}
          <Section title="What SW3 is actually like">
            <p>
              SW3 is Chelsea proper: King's Road running the length of it, Sloane Square at one end,
              Cheyne Walk and the river at the bottom. Residents describe it consistently as the gold
              standard for west London family living — the combination of the schools, the walkability
              and the riverside is what people say they bought.
            </p>
            <p>
              The criticisms are equally consistent, and both are structural rather than fixable.
              Parking is genuinely difficult. And the Tube is further away than newcomers expect: the
              nearest station is an eight-minute walk, and there is no station in the heart of SW3 at
              all. The annual Chelsea Flower Show is loved and resented in roughly equal measure —
              expect road closures and crowds for a week each May.
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
              This is the honest shape of prime central London: a strong run to a 2020 peak of
              £1,752,500, then a sharp correction and four years of drift. The 2025 median sits{" "}
              <strong className="text-foreground font-semibold">
                4.3% above where it started in 2016
              </strong>{" "}
              — nine years of holding, for a gain that stamp duty alone would consume several times
              over.
            </p>
            <p>
              That is not an argument against buying in SW3. It is an argument against buying in SW3 on
              a short horizon.
            </p>
            <p>
              The most recent 12 registered sales ran{" "}
              <strong className="text-foreground font-semibold">£360,000 to £4,950,000</strong>,
              median <strong className="text-foreground font-semibold">£1,175,000</strong> — around
              24% below the longer-run window median. Read that as a flat-heavy batch rather than a
              market move: the same twelve sales include two freehold terraces at £4,825,000 and
              £4,950,000, and a Chelsea Cloisters flat at £360,000.
            </p>

            <h3 className="font-serif text-xl tracking-tight text-foreground mt-6 mb-1">
              Where the value sits
            </h3>
            <p>
              Street variation in SW3 is more extreme than anywhere else we cover. Streets ranked by
              the median of at least five recorded sales;{" "}
              <strong className="text-foreground font-semibold">
                112 of 151 named streets in SW3 qualify.
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
            <p>
              Top to bottom, that is a{" "}
              <strong className="text-foreground font-semibold">
                42-fold range inside a single postcode district
              </strong>
              . The area median is close to meaningless as a guide to any specific street — Sloane
              Avenue alone carries 217 recorded sales at a £505,000 median, driven by mansion-block
              flats, while Chelsea Square's thirteen sales are whole houses. Always compare
              like-for-like, on the street.
            </p>
          </Section>

          {/* ── The negotiating position ─────────────────────────────────── */}
          <Section title="The negotiating position">
            <div className="not-prose my-2 flex items-start gap-3 rounded-lg border-l-2 border-primary bg-primary/5 p-4">
              <TrendingDown className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/90 leading-relaxed">
                Fair value is a per-property calculation, not a headline. But the district context is
                unusually favourable to buyers right now: medians fell 3.5% over the last full year and
                remain below the ten-year median, so{" "}
                <strong className="font-semibold">
                  a seller cannot argue that local values are currently rising
                </strong>{" "}
                — and unlike most of London, they cannot point to a rising longer trend either.
              </p>
            </div>
            <p>
              Anchoring an offer to registered sold prices on the specific street, rather than to the
              asking price, is straightforwardly defensible here.
            </p>
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
              <strong className="text-foreground font-semibold">Chelsea conservation area</strong>{" "}
              (designated 1971), and is also covered by an Article 4 direction and an area tree
              preservation order. Between them: extra control over alterations, demolition, materials
              and tree work; permitted-development rights narrower than normal; and council consent
              needed for cutting, topping or removing trees, with unauthorised work an offence. Budget
              for planning consent on anything you would elsewhere do automatically.
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
          <Section title="So should you buy in SW3?">
            <p>
              <strong className="text-foreground font-semibold">
                SW3 suits a buyer with a long horizon who wants the schools, the walkability and the
                river, and who is buying a home rather than a position.
              </strong>{" "}
              The everyday-life data is as strong as the reputation suggests, flood risk is low, and
              the council tax is remarkably cheap for what you get.
            </p>
            <p>
              <strong className="text-foreground font-semibold">Be cautious if</strong> your horizon
              is short — nine years of price history returned 4.3%, and stamp duty at this level takes
              around 6.4% off the top on day one.{" "}
              <strong className="text-foreground font-semibold">Be cautious if</strong> you need a
              fast commute east; Canary Wharf is 48 minutes.{" "}
              <strong className="text-foreground font-semibold">
                And be careful with the area median
              </strong>{" "}
              — at a 42-fold spread between the top and bottom streets, £1,550,000 describes almost
              nobody's actual purchase.
            </p>
            <div className="not-prose my-2 flex items-start gap-3 rounded-lg border-l-2 border-primary bg-primary/5 p-4">
              <TrendingDown className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/90 leading-relaxed">
                <strong className="font-semibold">
                  The single biggest mistake buyers make here
                </strong>{" "}
                is negotiating against the district median instead of the street. Pull the sold prices
                for the specific street before you offer.
              </p>
            </div>
          </Section>

          {/* ── CTA ──────────────────────────────────────────────────────── */}
          <div className="mt-12 rounded-xl border border-primary/25 bg-primary/5 px-5 py-6 sm:px-7 sm:py-7">
            <h2 className="font-serif text-2xl tracking-tight mb-2">Get your free SW3 area brief</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-2xl">
              Before you view or offer, get the complete picture in under 60 seconds: comparable sold
              prices, a fair-value range and pre-offer strategy, risk flags, schools, transport,
              broadband and council tax.
            </p>
            <Button
              size="lg"
              className="w-full sm:w-auto font-semibold gap-1.5"
              onClick={goToBrief}
              data-testid="button-generate-sw3-brief"
            >
              Generate your free SW3 area brief
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground/70 mt-4 leading-relaxed">
              Built on official UK sources — HM Land Registry, the Environment Agency, police.uk,
              Ofcom, DEFRA and ONS. No AI estimates. No portal prices.
            </p>
          </div>
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
