import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Check, Minus, Star, Lock, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useCheckout } from "@/hooks/use-checkout";
import { VerdictCard, LockedSection, type BriefSection } from "@/pages/brief";

// Three offers. Full Brief (£14.99 one-off) is the hero for buyer traffic; Explorer is
// the free taste; Investor is the professional tier. Professional (£4.99/mo) is RETIRED —
// removed from the page, no new signups (existing subscribers grandfathered elsewhere).
const tiers = [
  {
    name: "Explorer",
    price: "Free",
    period: "",
    description: "Screen any UK postcode and get an instant area verdict: good fit, mixed, or limited. 2 free screens a month, no card. The fast way to decide if an area is worth your time before you book a viewing.",
    badge: null,
    style: "default",
    cta: "Try Free — No Card Needed",
    ctaVariant: "outline" as const,
    stripeUrl: null, // routes to the app to screen a postcode
    reassurance: null,
  },
  {
    name: "Full Brief",
    price: "£14.99",
    period: "one-off · one postcode",
    description: "The complete brief for one postcode at full Investor depth — comparable sold prices, pre-offer strategy, 10-year trend, letting economics, sold-prices map and more. Yours permanently, auto-saved to your account. Screen free, then unlock the postcode you're serious about.",
    badge: "Most buyers start here",
    style: "fullbrief",
    cta: "Screen a postcode",
    ctaVariant: "default" as const,
    stripeUrl: null, // a Full Brief is bought per-postcode from its brief, so route to the app first
    reassurance: "One-off payment. No subscription. Owned forever — revisit and regenerate free.",
  },
  {
    name: "Investor",
    price: "£39.99",
    period: "/month",
    description: "For due diligence across a shortlist. Unlimited full briefs on every postcode, plus a portfolio dashboard, cross-area comparison, sold-prices maps and 10-year trends.",
    badge: "For professionals",
    style: "investor",
    cta: "Get Investor — £39.99/month",
    ctaVariant: "default" as const,
    stripeUrl: "https://buy.stripe.com/8x200l2oKdP229WfJa6Na01?success_url=https%3A%2F%2Fwww.luxproperty.ai%2Fsuccess%3Fplan%3Dinvestor",
    reassurance: "Cancel anytime. Switch plans whenever you like.",
  },
];

interface FeatureRow {
  feature: string;
  explorer: boolean | string;
  fullBrief: boolean | string;
  investor: boolean | string;
}

// Full Brief serves the FULL Investor-depth brief for the ONE postcode you buy — so it
// gets every per-brief data row. Only unlimited-across-every-postcode + the portfolio
// toolkit are Investor-exclusive (see the footnote under the table).
const features: FeatureRow[] = [
  // ── The model ───────────────────────────────────────────────────────────────
  { feature: "Free area screens each month", explorer: "2", fullBrief: "2", investor: "Unlimited" },
  { feature: "Full brief at Investor depth", explorer: false, fullBrief: "1 postcode, owned", investor: "Every postcode" },
  // ── Explorer (free) ─────────────────────────────────────────────────────────
  { feature: "Area screening brief — Good fit / Mixed / Limited fit verdict", explorer: true, fullBrief: true, investor: true },
  { feature: "Executive summary", explorer: true, fullBrief: true, investor: true },
  { feature: "Market overview (average price, YoY change)", explorer: true, fullBrief: true, investor: true },
  { feature: "1-year price trend (Land Registry)", explorer: true, fullBrief: true, investor: true },
  { feature: "Neighbourhood profile — schools, transport, safety, walkability", explorer: true, fullBrief: true, investor: true },
  { feature: "Named schools, stations, parks & amenities", explorer: true, fullBrief: true, investor: true },
  { feature: "Flood & climate risk", explorer: true, fullBrief: true, investor: true },
  { feature: "Council tax band", explorer: true, fullBrief: true, investor: true },
  { feature: "Simple commute note", explorer: true, fullBrief: true, investor: true },
  // ── Unlocked by the Full Brief (full Investor depth for the owned postcode) ──
  { feature: "5-year price trend — full Land Registry history (not just 1-year)", explorer: false, fullBrief: true, investor: true },
  { feature: "10-year price trend — long-run history for cross-area comparison", explorer: false, fullBrief: true, investor: true },
  { feature: "Property type split", explorer: false, fullBrief: true, investor: true },
  { feature: "Full commute calculator — times to multiple destinations", explorer: false, fullBrief: true, investor: true },
  { feature: "Crime breakdown by category (police.uk)", explorer: false, fullBrief: true, investor: true },
  { feature: "Comparable sales & valuation range", explorer: false, fullBrief: true, investor: true },
  { feature: "Pre-offer strategy — fair value range, opening range & seller pressure points", explorer: false, fullBrief: true, investor: true },
  { feature: "Pre-offer questions — what to ask before committing", explorer: false, fullBrief: true, investor: true },
  { feature: "Planning activity & risk flags", explorer: false, fullBrief: true, investor: true },
  { feature: "Broadband speed & fibre coverage (Ofcom)", explorer: false, fullBrief: true, investor: true },
  { feature: "Rental market context — rents & demand", explorer: false, fullBrief: true, investor: true },
  { feature: "Air quality index", explorer: false, fullBrief: true, investor: true },
  { feature: "Stamp duty & buying costs — SDLT / LTT", explorer: false, fullBrief: true, investor: true },
  { feature: "Letting economics — indicative gross yield & sales velocity", explorer: false, fullBrief: true, investor: true },
  { feature: "Sold prices map — visual layout of recent transactions nearby", explorer: false, fullBrief: true, investor: true },
  { feature: "Street price ranking — relative pricing within the area", explorer: false, fullBrief: true, investor: true },
  { feature: "Development tracker — pipeline and local change signals", explorer: false, fullBrief: true, investor: true },
  { feature: "Save & revisit — owned briefs stay in your account", explorer: false, fullBrief: true, investor: true },
  // ── Investor only (across every postcode + the portfolio toolkit) ────────────
  { feature: "Unlimited full briefs — every postcode, not just one", explorer: false, fullBrief: false, investor: true },
  { feature: "Portfolio dashboard — save, compare, and track multiple areas", explorer: false, fullBrief: false, investor: true },
  { feature: "Custom report branding — add your name and firm", explorer: false, fullBrief: false, investor: true },
];

const faqs = [
  {
    q: "Is the Full Brief a subscription?",
    a: "No. It's a one-off £14.99 payment for one postcode, and you own that brief forever — revisit and regenerate it free any time. Nothing recurring, nothing to cancel.",
  },
  {
    q: "Who is the Full Brief for?",
    a: "Anyone serious about a specific UK property. You've screened the area free — now you want the complete picture, at Investor depth, before you make an offer.",
  },
  {
    q: "Does Explorer really not need a card?",
    a: "Correct. Explorer is completely free with no payment details required — screen up to 2 postcodes a month, no card, no commitment.",
  },
  {
    q: "Is the data based on official UK sources?",
    a: "Yes — sold prices come from HM Land Registry, crime from police.uk, flood risk from the Environment Agency and planning from local authority records.",
  },
  {
    q: "What if I'm evaluating multiple properties or areas?",
    a: "Investor is designed for that — unlimited full briefs on every postcode, plus side-by-side comparison, yield tracking and a portfolio dashboard. Cancel anytime.",
  },
  {
    q: "Do I keep a Full Brief if I never subscribe?",
    a: "Yes. A Full Brief is yours permanently — it stays in your account under \"My briefs\" and opens instantly whenever you need it, whether or not you're ever on a paid plan.",
  },
];

function CellValue({ value, col }: { value: boolean | string; col: string }) {
  const isInvestor = col === "investor";
  const isFullBrief = col === "fullbrief";
  if (typeof value === "string") {
    return (
      <span className={`text-sm font-medium ${isInvestor ? "text-amber-600 dark:text-amber-400" : isFullBrief ? "text-primary" : "text-foreground"}`}>
        {value}
      </span>
    );
  }
  return value ? (
    <Check className={`h-4 w-4 mx-auto ${isInvestor ? "text-amber-500" : "text-primary"}`} />
  ) : (
    <Minus className="h-4 w-4 text-muted-foreground/30 mx-auto" />
  );
}

// ── Real product showcase ────────────────────────────────────────────────────
// Live-fetches a real, warm sample postcode (E8) ANONYMOUSLY — so it returns the
// genuine Explorer-tier payload: the real area verdict every visitor gets, plus the
// real LOCKED previews of the sections a Full Brief unlocks. No mockups, no invented
// claims — this is the actual product output. Fails closed: if the fetch is slow or
// errors, the whole section hides rather than showing anything fake.
const SHOWCASE_POSTCODE = "E8 1NG";
// A few high-value locked sections to preview (in the order we'd like to show them).
const SHOWCASE_LOCKED_KEYS = ["nearbySoldPrices", "soldPricesMap", "rentalDemandScore"];

function RealProductShowcase() {
  const [verdict, setVerdict] = useState<BriefSection | null>(null);
  const [locked, setLocked] = useState<BriefSection[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Anonymous fetch (no auth header) → Explorer payload: real verdict + locked previews.
        // preview=1 exempts this background demo from the anonymous soft gate, so viewing
        // the pricing page never spends the visitor's one free brief.
        const res = await fetch(`/api/brief?postcode=${encodeURIComponent(SHOWCASE_POSTCODE)}&preview=1`);
        const json = await res.json().catch(() => null);
        if (!alive) return;
        const sections: BriefSection[] = json?.ok && Array.isArray(json.sections) ? json.sections : [];
        const v = sections.find((s) => s.key === "areaVerdict" && s.state !== "LOCKED") ?? null;
        const lockedByKey = new Map(sections.filter((s) => s.state === "LOCKED").map((s) => [s.key, s]));
        const picks = SHOWCASE_LOCKED_KEYS.map((k) => lockedByKey.get(k)).filter((s): s is BriefSection => !!s);
        // Fallback: any locked sections if our preferred keys weren't present.
        const previews = picks.length ? picks : Array.from(lockedByKey.values()).slice(0, 3);
        if (v && previews.length) {
          setVerdict(v);
          setLocked(previews.slice(0, 3));
          setState("ready");
        } else {
          setState("failed");
        }
      } catch {
        if (alive) setState("failed");
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state === "failed") return null; // fail closed — never show a fake

  return (
    <section className="pb-12 sm:pb-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="font-serif text-2xl tracking-tight mb-1">This is the real product</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xl">
          A live brief for <span className="font-mono text-foreground/70">{SHOWCASE_POSTCODE}</span> — the actual free
          verdict every visitor gets, and real previews of the sections a Full Brief unlocks. No mockups.
        </p>

        {state === "loading" ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-4 py-10 text-sm text-muted-foreground justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading a live sample brief…
          </div>
        ) : (
          <div className="space-y-4">
            {verdict && <VerdictCard section={verdict} />}
            {locked.map((s) => (
              <LockedSection key={s.key} section={s} />
            ))}
            <p className="text-xs text-muted-foreground">
              Every locked section above is included in the full brief — unlocked at Investor depth for the postcode you buy.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function PricingPage() {
  useDocumentTitle("Pricing", "Compare LuxProperty.ai plans. Free Explorer tier with 2 briefs/month. Full Brief £14.99 one-off. Investor at £39.99/month. No contracts, cancel anytime.");
  const { startCheckout, authModal } = useCheckout();
  return (
    <div className="flex min-h-screen flex-col">
      {authModal}
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Pricing
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mb-3">
              Screen free. Own the brief that matters.
            </h1>
            <p className="text-muted-foreground text-base max-w-xl">
              Screen any UK postcode free. When you're serious about one, unlock its complete brief — comparable sales, pre-offer strategy, risk flags and more — for £14.99, yours permanently. No subscription needed.
            </p>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="pb-10 sm:pb-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-3 sm:items-end">
              {tiers.map((tier) => {
                const isInvestor = tier.style === "investor";
                const isFullBrief = tier.style === "fullbrief";

                return (
                  <div
                    key={tier.name}
                    className={`relative flex flex-col rounded-xl p-5 sm:p-6 ${
                      isInvestor
                        ? "bg-[#1A1410] dark:bg-[#1A1410] border border-amber-700/40 shadow-lg shadow-amber-900/10"
                        : isFullBrief
                        ? "bg-card border-2 border-primary/40 shadow-xl shadow-primary/10 sm:-mx-1 sm:scale-[1.04] sm:origin-bottom z-10 sm:pb-8"
                        : "bg-card border border-border"
                    }`}
                    data-testid={`card-pricing-${tier.name.toLowerCase()}`}
                  >
                    {/* Badge */}
                    {tier.badge && (
                      <div className={`flex items-center gap-1.5 mb-4`}>
                        {isInvestor && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                        <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                          isInvestor ? "text-amber-400" : "text-primary"
                        }`}>
                          {tier.badge}
                        </span>
                      </div>
                    )}

                    {/* Name */}
                    <h3 className={`text-sm font-semibold ${isInvestor ? "text-amber-100" : ""}`}>
                      {tier.name}
                    </h3>

                    {/* Price */}
                    <div className="mt-3 mb-1 flex items-baseline gap-1">
                      <span className={`font-serif text-4xl tracking-tight ${
                        isInvestor ? "text-white" : ""
                      }`}>
                        {tier.price}
                      </span>
                      {tier.period && (
                        <span className={`text-sm ${isInvestor ? "text-amber-200/60" : "text-muted-foreground"}`}>
                          {tier.period}
                        </span>
                      )}
                    </div>

                    <p className={`text-xs mb-6 leading-relaxed ${
                      isInvestor ? "text-amber-200/50" : "text-muted-foreground"
                    }`}>
                      {tier.description}
                    </p>

                    <Button
                      variant={tier.ctaVariant}
                      className={`w-full text-sm mt-auto font-semibold ${
                        isInvestor
                          ? "bg-amber-600 hover:bg-amber-500 text-white border-0 shadow-lg shadow-amber-900/30"
                          : ""
                      }`}
                      data-testid={`button-pricing-${tier.name.toLowerCase()}`}
                      onClick={() => {
                        if (tier.stripeUrl) {
                          startCheckout(tier.stripeUrl);
                        } else {
                          window.location.href = "/";
                        }
                      }}
                    >
                      {tier.cta}
                    </Button>

                    {/* Reassurance line */}
                    {tier.reassurance && (
                      <p className={`text-[11px] mt-2 text-center ${isInvestor ? "text-amber-200/40" : "text-muted-foreground"}`}>
                        {tier.reassurance}
                      </p>
                    )}

                    {/* Shimmer line */}
                    {isFullBrief && (
                      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/70 to-transparent rounded-t-xl" />
                    )}
                    {isInvestor && (
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent rounded-t-xl" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Real product showcase — live E8 verdict + real locked previews */}
        <RealProductShowcase />

        {/* Social proof */}
        <section className="pb-12 sm:pb-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="border border-border/50 rounded-xl p-6 bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
                Trusted by UK buyers &amp; advisers
              </p>
              <p className="text-sm text-foreground/70 mb-5 max-w-2xl">
                LuxProperty.ai is used by UK homebuyers, property advisers and investors who want verified data — not agent estimates — before they make an offer. All data is drawn from official UK sources including HM Land Registry, police.uk, Ofcom and the Environment Agency.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <blockquote className="border-l-2 border-primary/30 pl-4">
                  <p className="text-sm text-foreground/80 italic mb-1">
                    "Exactly what I needed before making an offer — I could see what similar properties actually sold for, not just what was listed."
                  </p>
                  <cite className="text-xs text-muted-foreground not-italic">— UK homebuyer, South East England</cite>
                </blockquote>
                <blockquote className="border-l-2 border-primary/30 pl-4">
                  <p className="text-sm text-foreground/80 italic mb-1">
                    "I run due diligence across multiple areas at once. The side-by-side comparison saves me hours every week."
                  </p>
                  <cite className="text-xs text-muted-foreground not-italic">— Property investor, Midlands</cite>
                </blockquote>
              </div>
            </div>
          </div>
        </section>

        {/* Why buyers use LuxProperty.ai */}
        <section className="pb-12 sm:pb-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="font-serif text-2xl tracking-tight mb-6">What buyers use it for</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  heading: "Avoid overpaying",
                  body: "See what properties in that postcode have actually sold for, not what agents are asking.",
                },
                {
                  heading: "Spot risks before you're committed",
                  body: "Crime rates, flood zone, school ratings and planning applications in one brief.",
                },
                {
                  heading: "Compare two areas before you waste a viewing",
                  body: "Run side-by-side postcode reports to decide where to focus.",
                },
                {
                  heading: "Go into negotiations informed",
                  body: "Get a fair value range and an opening offer figure backed by real sold data.",
                },
              ].map(({ heading, body }) => (
                <li key={heading} className="flex gap-3">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-foreground/90">
                    <span className="font-semibold">{heading}</span>
                    {" — "}{body}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-12 sm:pb-16 border-t border-border/40 pt-12 sm:pt-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="font-serif text-2xl tracking-tight mb-2">Common questions</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-lg">Straight answers, no small print.</p>
            <div className="grid gap-5 sm:grid-cols-2">
              {faqs.map(({ q, a }) => (
                <div key={q} className="border border-border/40 rounded-lg p-4 bg-card">
                  <p className="text-sm font-semibold mb-1">{q}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="py-12 sm:py-16 border-t border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="font-serif text-2xl tracking-tight mb-2">What's included</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-lg">Every data point in your brief comes from a named official source. Here's what each plan includes.</p>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[600px]" data-testid="table-feature-comparison">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left font-medium text-muted-foreground py-3 pr-4 pl-4 sm:pl-0 w-[40%]">
                      Feature
                    </th>
                    <th className="text-center font-medium text-muted-foreground py-3 px-2 w-[20%]">
                      Explorer
                    </th>
                    <th className="text-center font-bold text-primary py-3 px-2 w-[20%]">
                      Full Brief
                    </th>
                    <th className="text-center font-medium text-amber-600 dark:text-amber-400 py-3 px-2 w-[20%]">
                      Investor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((row) => (
                    <tr
                      key={row.feature}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-3 pr-4 pl-4 sm:pl-0 text-foreground/90">{row.feature}</td>
                      <td className="py-3 px-2 text-center">
                        <CellValue value={row.explorer} col="explorer" />
                      </td>
                      <td className="py-3 px-2 text-center bg-primary/[0.03] dark:bg-primary/[0.05]">
                        <CellValue value={row.fullBrief} col="fullbrief" />
                      </td>
                      <td className="py-3 px-2 text-center bg-amber-500/[0.04] dark:bg-amber-500/[0.06]">
                        <CellValue value={row.investor} col="investor" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted-foreground max-w-2xl">
              The <span className="font-medium text-primary">Full Brief</span> unlocks every section at Investor depth for the <span className="font-medium">one postcode</span> you buy — yours permanently. <span className="font-medium text-amber-600 dark:text-amber-400">Investor</span> unlocks them for every postcode, plus unlimited briefs and the portfolio toolkit.
            </p>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-12 sm:py-16 border-t border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
            <h2 className="font-serif text-2xl tracking-tight mb-3">
              Know what you're buying into. Before you offer.
            </h2>
            <p className="text-sm text-muted-foreground mb-2 max-w-md mx-auto">
              Screen any UK postcode free. When you find the one, unlock its complete brief — comparable sales, pre-offer strategy, price history, risk flags and more — yours permanently.
            </p>
            <p className="text-sm font-semibold text-primary mb-6">
              £14.99, one-off. No subscription. Owned forever.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <div className="flex flex-col items-center gap-1.5">
                <Link href="/">
                  <Button size="lg" className="text-sm font-semibold px-8 w-full sm:w-auto" data-testid="button-start-full-brief">
                    Screen a postcode free
                  </Button>
                </Link>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  No card to screen. Unlock the full brief for £14.99 when you're ready.
                </span>
              </div>
              <a
                href="https://buy.stripe.com/8x200l2oKdP229WfJa6Na01?success_url=https%3A%2F%2Fwww.luxproperty.ai%2Fsuccess%3Fplan%3Dinvestor"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  startCheckout(e.currentTarget.href);
                }}
              >
                <Button size="lg" variant="outline" className="text-sm px-8 w-full sm:w-auto" data-testid="button-get-investor">
                  Or go unlimited — Investor
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
