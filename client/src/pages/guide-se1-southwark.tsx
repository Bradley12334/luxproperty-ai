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
  Store,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";

// ─── SEO ─────────────────────────────────────────────────────────────────────
// Sets the exact title tag / meta description requested, plus canonical + OG,
// mirroring what useDocumentTitle does but with the precise title string (which
// uses " | LuxProperty.ai", not the hook's default " — LuxProperty.ai" suffix).
const PAGE_URL = "https://www.luxproperty.ai/guides/se1-southwark-buyers-guide";
const PAGE_TITLE = "Is SE1 (Southwark) a Good Place to Buy? Buyer's Guide | LuxProperty.ai";
const PAGE_DESC =
  "Thinking of buying in SE1 (Southwark/Borough)? Real sold prices, softening trend, flood risk, schools & transport — built on official UK data. Free brief.";

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
  { label: "Median sold price", value: "£458,000", note: "1,000 Land Registry records, 10 years" },
  { label: "10-year trajectory", value: "≈ −7%", note: "roughly flat to modestly down", down: true },
  { label: "Year-on-year", value: "−15.2%", note: "softened significantly", down: true },
  { label: "Comparable range", value: "£362.5k – £704k", note: "average around £522,875" },
];

const CHECKS = [
  {
    icon: GraduationCap,
    title: "Schools — good provision",
    body:
      "St Saviour's and St Olave's Church of England School is rated Good by Ofsted (about a 4-minute walk from the sampled area). Schools are one of SE1's stronger buyer signals.",
  },
  {
    icon: Store,
    title: "Amenities & walkability — excellent",
    body:
      "Good local amenity density — cafés, restaurants and daily essentials are walkable, which is a genuine day-to-day advantage of the area.",
  },
  {
    icon: Wifi,
    title: "Broadband — excellent",
    body: "Speeds around 180 Mbps in the sampled area.",
  },
  {
    icon: Train,
    title: "Transport — extremely central",
    body:
      "SE1 has strong connections into the City and West End. Coverage varies across the postcode, so confirm the exact stations and walk times for any specific property.",
  },
  {
    icon: ShieldAlert,
    title: "Crime — understand it honestly",
    body:
      "Recorded crime in Southwark runs above the national average (around 2,256 monthly incidents borough-wide), with the top category being anti-social behaviour (21%) — concentrated around high-footfall commercial streets. Residential streets are generally safer than the borough-wide figure suggests, but visit at different times of day to judge for yourself.",
  },
  {
    icon: Waves,
    title: "Flood & environmental risk — check carefully",
    body:
      "This is the key one to check. Southwark falls in Environment Agency Flood Zone 3 (High Probability) with surface-water risk rated Medium. That can restrict or significantly raise the cost of buildings insurance, so check the EA flood map for the specific plot and ask the seller for their insurance history before offering.",
  },
  {
    icon: Building2,
    title: "Planning & nearby development",
    body:
      "There's elevated planning activity (around 31 applications in the past 12 months), plus two major nearby schemes — Elephant Park (Lend Lease) and Bankside Yards — both under construction with mixed impact. New development can bring amenity and footfall but also construction disruption, so check proximity and timelines for any property you're serious about.",
  },
];

const BRIEF_INCLUDES = [
  "Real comparable sold prices near the property (HM Land Registry)",
  "A fair-value range and a pre-offer strategy for the specific property — so you know what to actually offer",
  "Risk flags — flood, crime, planning activity",
  "Schools, transport, broadband and council tax",
];

export default function GuideSE1SouthwarkPage() {
  useGuideSeo();
  const [, navigate] = useLocation();
  const goToBrief = () => navigate("/?q=SE1");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              SE1 · Southwark · Buyer's Guide
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight mb-4">
              Is SE1 (Southwark) a Good Place to Buy? A Buyer's Guide
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              SE1 — covering Southwark, Borough, Bankside and Bermondsey — is one of central London's
              most connected and characterful areas, right on the south bank of the Thames. It's a
              strong buy if you value walkability, good local amenities, and being minutes from the
              City and West End, and it suits families and commuters particularly well. But it's a
              market to approach with your eyes open: prices have softened notably over the past
              year, and much of the area sits in a flood-risk zone that affects insurance. This guide
              covers what you actually need to know before you offer — using registered sold-price
              data, not agent estimates.
            </p>
          </div>

          {/* ── What SE1 is actually like ────────────────────────────────── */}
          <Section title="What SE1 is actually like">
            <p>
              SE1 is a mid-market central-London area in the London Borough of Southwark (ward:
              Chaucer). It's a genuinely mixed, vibrant postcode — riverside cultural landmarks,
              Borough Market, converted warehouses, and a lot of ongoing regeneration. It draws
              families prioritising schools and daily commuters most strongly, thanks to central
              location and walkability.
            </p>
            <p>
              The trade-off for being this central and this connected is that it's a busy,
              higher-density area with real environmental considerations. If you're weighing it up,
              the honest questions are: does the central-London lifestyle fit, do the numbers work at
              today's softening prices, and are you paying a fair price for the specific property —
              not just for the SE1 location.
            </p>
          </Section>

          {/* ── What homes actually sell for ─────────────────────────────── */}
          <Section title="What homes in SE1 actually sell for">
            <p>Portal asking prices tell one story; registered sold prices tell the real one:</p>
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
              That −15.2% year-on-year figure is the single most useful thing for a buyer here. In a
              market where registered prices are clearly falling, a seller can't credibly argue values
              are rising — which gives an informed, patient buyer genuine negotiating leverage. A full
              brief calculates a fair-value range for the specific property type (for the sampled area
              that came out around £457,000–£537,000), so you can see what a sensible offer actually
              looks like rather than guessing from the postcode-wide average.
            </p>
          </Section>

          {/* ── Practical checks ─────────────────────────────────────────── */}
          <Section title="The practical buyer checks for SE1">
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
          <Section title="So — should you buy in SE1?">
            <p>
              SE1 rewards buyers who want a genuinely central, well-connected, amenity-rich London
              base — and who negotiate from real data. With prices down 15.2% year-on-year and
              multiple ongoing developments, patient, informed buyers have real leverage in the
              current market. Be careful where a specific property carries flood or environmental risk
              (check the insurance implications), and always confirm the comparables for that exact
              property rather than relying on the wide postcode-wide range.
            </p>
            <div className="not-prose my-5 flex items-start gap-3 rounded-lg border-l-2 border-primary bg-primary/5 p-4">
              <TrendingDown className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/90 leading-relaxed">
                The biggest mistake buyers make in SE1 is paying close to asking on a central-London
                location alone, when registered sold prices — and a clearly softening market — point
                to a more grounded, and often lower, fair offer.
              </p>
            </div>
          </Section>

          {/* ── CTA ──────────────────────────────────────────────────────── */}
          <div className="mt-12 rounded-xl border border-primary/25 bg-primary/5 px-5 py-6 sm:px-7 sm:py-7">
            <h2 className="font-serif text-2xl tracking-tight mb-2">Get the full data brief for SE1 — free</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-2xl">
              Before you view or offer on a property in SE1, get the complete picture in under 60
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
              data-testid="button-generate-se1-brief"
            >
              Generate your free SE1 brief
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground/70 mt-4 leading-relaxed">
              Built on official UK sources — HM Land Registry, police.uk, Ofsted, the Environment
              Agency. No AI estimates. No portal prices.
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground/50 mt-8 leading-relaxed">
            Figures from a July 2026 data brief (HM Land Registry, police.uk, Ofsted, Environment
            Agency, Ofcom) and refreshed periodically. Registered sold prices describe the wider SE1
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
