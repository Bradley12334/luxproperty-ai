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
  Building2,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";

// ─── SEO ─────────────────────────────────────────────────────────────────────
// Sets the exact title tag / meta description requested, plus canonical + OG,
// mirroring what useDocumentTitle does but with the precise title string (which
// uses " | LuxProperty.ai", not the hook's default " — LuxProperty.ai" suffix).
const PAGE_URL = "https://www.luxproperty.ai/guides/sw3-chelsea-buyers-guide";
const PAGE_TITLE = "Is SW3 (Chelsea) a Good Place to Buy? Buyer's Guide | LuxProperty.ai";
const PAGE_DESC =
  "Thinking of buying in SW3 (Chelsea)? Real sold prices, softening trend, risk flags, schools & transport — built on official UK data. Get your free brief.";

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

// ─── Data (from a July 2026 brief — refresh periodically) ────────────────────
const HEADLINE_STATS = [
  { label: "Median sold price", value: "£910,000", note: "1,000 Land Registry records, 10 years" },
  { label: "10-year trajectory", value: "+19.4%", note: "registered price growth" },
  { label: "Year-on-year", value: "−11.6%", note: "the market has softened", down: true },
  { label: "Comparable range", value: "£450k – £4.83M", note: "an enormously wide spread" },
];

const CHECKS = [
  {
    icon: Train,
    title: "Transport — excellent",
    body:
      "Knightsbridge Underground is a 1-minute walk from the sampled area, putting central London and the City within easy reach. Transport is one of SW3's strongest buyer signals.",
  },
  {
    icon: GraduationCap,
    title: "Schools — strong",
    body:
      "More House School is rated Outstanding by Ofsted (about a 6-minute walk), and the area is well-served for education generally — a key reason SW3 works for families.",
  },
  {
    icon: Wifi,
    title: "Broadband — excellent",
    body: "Speeds around 167 Mbps in the sampled area.",
  },
  {
    icon: ShieldAlert,
    title: "Crime — understand it honestly",
    body:
      "Recorded crime in Kensington and Chelsea runs above the national average (around 1,580 monthly incidents borough-wide), with the top category being shoplifting (18%) — concentrated around high-footfall commercial streets. Residential streets are generally safer than the borough-wide figure suggests, but visit at different times of day to judge for yourself.",
  },
  {
    icon: Waves,
    title: "Flood & environmental risk — check carefully",
    body:
      "This is the one to check property-by-property. Parts of the borough fall in Environment Agency Flood Zone 3 (High Probability) with surface-water risk rated Medium. That can restrict or raise the cost of buildings insurance, so check the EA flood map for the specific plot and ask the seller for their insurance history before offering.",
  },
  {
    icon: Building2,
    title: "Planning & nearby development",
    body:
      "There's elevated planning activity (around 19 applications in the past 12 months), and two notable nearby schemes — Lots Road Power Station and the Royal Brompton Hospital Site — with mixed/uncertain impact. Worth checking proximity and construction timelines for any property you're serious about.",
  },
];

const BRIEF_INCLUDES = [
  "Real comparable sold prices near the property (HM Land Registry)",
  "A fair-value range and a pre-offer strategy for the specific property — so you know what to actually offer",
  "Risk flags — flood, crime, planning activity",
  "Schools, transport, broadband and council tax",
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
              SW3 · Chelsea · Buyer's Guide
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight mb-4">
              Is SW3 (Chelsea) a Good Place to Buy? A Buyer's Guide
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              SW3 — Chelsea, in the Royal Borough of Kensington and Chelsea — is one of London's
              genuine prime markets: prestigious, established, and priced accordingly. It's a strong
              buy if you value excellent transport, top-rated schools and a settled prime-London
              base. But it rewards buyers who do their homework: prices have softened over the past
              year, and parts of the borough carry flood and environmental risk that affects
              insurance. This guide covers what you actually need to know before you view or offer —
              using registered sold-price data, not agent estimates.
            </p>
          </div>

          {/* ── What SW3 is actually like ────────────────────────────────── */}
          <Section title="What SW3 is actually like">
            <p>
              SW3 sits in the ward of Brompton &amp; Hans Town, within the Royal Borough of
              Kensington and Chelsea. It's a premium, mature residential market — not an
              up-and-coming area but an established one, which means fewer surprises and a high price
              of entry. It suits families prioritising schools and daily commuters most strongly,
              given the transport and education on offer. The trade-off for that prestige is cost
              and, in places, environmental risk worth checking property-by-property.
            </p>
            <p>
              If you're weighing it up, the honest questions are: does the lifestyle fit, do the
              numbers work at today's softening prices, and are you paying a fair price for the
              specific property — not just for the SW3 postcode.
            </p>
          </Section>

          {/* ── What homes actually sell for ─────────────────────────────── */}
          <Section title="What homes in SW3 actually sell for">
            <p>
              Most buyers look at portal asking prices. The registered reality — what people
              actually paid — tells a more grounded story:
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
            <p>
              That −11.6% year-on-year softening is the single most useful fact for a buyer here: in
              a market where registered prices are falling, a seller can't credibly argue values are
              rising — which gives a well-informed buyer real negotiating room. A full brief
              calculates a fair-value range for the specific property type you're looking at, rather
              than the whole-postcode median, so you can see what a sensible offer actually looks
              like.
            </p>
          </Section>

          {/* ── Practical checks ─────────────────────────────────────────── */}
          <Section title="The practical buyer checks for SW3">
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
          <Section title="So — should you buy in SW3?">
            <p>
              SW3 rewards buyers who want a settled, prime-London base with excellent transport and
              schools — and who negotiate from real data rather than paying asking price on prestige
              alone. With prices down 11.6% year-on-year, patient, informed buyers have genuine
              leverage in the current market. Be cautious where a specific property carries flood or
              environmental risk (check insurance implications), and always confirm the comparables
              for that exact property rather than relying on the wide postcode-wide range.
            </p>
            <div className="not-prose my-5 flex items-start gap-3 rounded-lg border-l-2 border-primary bg-primary/5 p-4">
              <TrendingDown className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/90 leading-relaxed">
                The biggest mistake buyers make in SW3 is paying the asking price on reputation, when
                registered sold prices — and a softening market — tell a more grounded story.
              </p>
            </div>
          </Section>

          {/* ── CTA ──────────────────────────────────────────────────────── */}
          <div className="mt-12 rounded-xl border border-primary/25 bg-primary/5 px-5 py-6 sm:px-7 sm:py-7">
            <h2 className="font-serif text-2xl tracking-tight mb-2">Get the full data brief for SW3 — free</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-2xl">
              Before you view or offer on a property in SW3, get the complete picture in under 60
              seconds:
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
              data-testid="button-generate-sw3-brief"
            >
              Generate your free SW3 brief
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground/70 mt-4 leading-relaxed">
              Built on official UK sources — HM Land Registry, police.uk, Ofsted, the Environment
              Agency. No AI estimates. No portal prices.
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground/50 mt-8 leading-relaxed">
            Figures from a July 2026 data brief (HM Land Registry, police.uk, Ofsted, Environment
            Agency, Ofcom) and refreshed periodically. Registered sold prices describe the wider SW3
            postcode; a full brief resolves the fair-value range for a specific property.
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
