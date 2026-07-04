import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Check, Minus, Star, Gift, Lock } from "lucide-react";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";

const tiers = [
  {
    name: "Explorer",
    price: "Free",
    period: "",
    description: "Run any UK postcode and get an instant area screen: good fit, mixed, or limited. No card required, no commitment. Good for deciding whether an area is worth your time before you book a viewing.",
    badge: null,
    style: "default",
    cta: "Try Free — No Card Needed",
    ctaVariant: "outline" as const,
    stripeUrl: null,
    reassurance: null,
  },
  {
    name: "Professional",
    price: "£4.99",
    period: "/month",
    description: "The full brief before you make an offer. Real comparable sold prices, a pre-offer strategy with fair value range and opening offer, 5-year price trend, crime breakdown, planning activity and PDF export. Any UK postcode, unlimited briefs.",
    badge: "Most Popular",
    style: "professional",
    cta: "Get Professional — £4.99/month",
    ctaVariant: "default" as const,
    stripeUrl: "https://buy.stripe.com/7sY8wRe7s9yM7ug8gI6Na00?success_url=https%3A%2F%2Fwww.luxproperty.ai%2Fsuccess%3Fplan%3Dprofessional",
    reassurance: "Cancel anytime. No minimum term. No contracts. Secure checkout via Stripe.",
  },
  {
    name: "Investor",
    price: "£39.99",
    period: "/month",
    description: "For investors running due diligence across a shortlist. Everything in Professional, plus 10-year price trends, rental demand and yield tracking, a sold prices map, and a portfolio dashboard.",
    badge: "Analyse More",
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
  professional: boolean | string;
  investor: boolean | string;
}

const features: FeatureRow[] = [
  // ── Explorer (free) ─────────────────────────────────────────────────────────
  { feature: "Briefs per month", explorer: "3", professional: "Unlimited", investor: "Unlimited" },
  { feature: "Area screening brief — Good fit / Mixed / Limited fit verdict", explorer: true, professional: true, investor: true },
  { feature: "Executive summary", explorer: true, professional: true, investor: true },
  { feature: "Market overview (average price, YoY change)", explorer: true, professional: true, investor: true },
  { feature: "1-year price trend (Land Registry)", explorer: true, professional: true, investor: true },
  { feature: "Neighbourhood profile — schools, transport, safety, walkability", explorer: true, professional: true, investor: true },
  { feature: "Named schools, stations, parks & amenities", explorer: true, professional: true, investor: true },
  { feature: "Flood & climate risk", explorer: true, professional: true, investor: true },
  { feature: "Council tax band", explorer: true, professional: true, investor: true },
  { feature: "Simple commute note", explorer: true, professional: true, investor: true },
  // ── Professional ─────────────────────────────────────────────────────────────
  { feature: "5-year price trend — full Land Registry history (not just 1-year)", explorer: false, professional: true, investor: true },
  { feature: "Property type split", explorer: false, professional: true, investor: true },
  { feature: "Full commute calculator — times to multiple destinations", explorer: false, professional: true, investor: true },
  { feature: "Crime breakdown by category (police.uk)", explorer: false, professional: true, investor: true },
  { feature: "Comparable sales & valuation range", explorer: false, professional: true, investor: true },
  { feature: "Pre-offer strategy — fair value range, opening range & seller pressure points", explorer: false, professional: true, investor: true },
  { feature: "Pre-offer questions — what to ask before committing", explorer: false, professional: true, investor: true },
  { feature: "Planning activity & risk flags", explorer: false, professional: true, investor: true },
  { feature: "Broadband speed & fibre coverage (Ofcom)", explorer: false, professional: true, investor: true },
  { feature: "Rental market context — rents & demand", explorer: false, professional: true, investor: true },
  { feature: "Air quality index", explorer: false, professional: true, investor: true },
  { feature: "Export to PDF — client-ready format", explorer: false, professional: true, investor: true },
  { feature: "Save & revisit briefs", explorer: false, professional: true, investor: true },
  // ── Investor ─────────────────────────────────────────────────────────────────
  { feature: "10-year price trend — long-run Land Registry history for cross-area comparison", explorer: false, professional: false, investor: true },
  { feature: "Rental demand score — letting potential rated across areas", explorer: false, professional: false, investor: true },
  { feature: "Sold prices map — visual layout of recent transactions nearby", explorer: false, professional: false, investor: true },
  { feature: "Street price ranking — relative pricing within the area", explorer: false, professional: false, investor: true },
  { feature: "Development tracker — pipeline and local change signals", explorer: false, professional: false, investor: true },
  { feature: "Portfolio dashboard — save, compare, and revisit multiple briefs", explorer: false, professional: false, investor: true },
  { feature: "Custom report branding — add your name and firm to PDFs", explorer: false, professional: false, investor: true },
];

const faqs = [
  {
    q: "Can I cancel anytime?",
    a: "Yes — cancel instantly from your account page, no questions asked, and you won't be charged again.",
  },
  {
    q: "Does Explorer really not need a card?",
    a: "Correct. Explorer is completely free with no payment details required — just enter a postcode and go.",
  },
  {
    q: "Is the data based on official UK sources?",
    a: "Yes — sold prices come from HM Land Registry, crime from police.uk, flood risk from the Environment Agency and planning from local authority records.",
  },
  {
    q: "Who is Professional best for?",
    a: "Anyone making a serious offer on a UK property — homebuyers, relocators and advisers who need the full picture before committing.",
  },
  {
    q: "What if I'm evaluating multiple properties or areas?",
    a: "Investor is designed for that — it adds side-by-side area comparison, rental yield tracking and a portfolio dashboard for heavier use.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes — upgrade or downgrade at any time from your account page, and the change takes effect immediately.",
  },
];

function CellValue({ value, col }: { value: boolean | string; col: string }) {
  const isInvestor = col === "investor";
  const isPro = col === "professional";
  if (typeof value === "string") {
    if (value === "Coming Soon") {
      return (
        <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-400/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 whitespace-nowrap">
          Coming Soon
        </span>
      );
    }
    return (
      <span className={`text-sm font-medium ${isInvestor ? "text-amber-600 dark:text-amber-400" : isPro ? "text-primary" : "text-foreground"}`}>
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

export default function PricingPage() {
  useDocumentTitle("Pricing", "Compare LuxProperty.ai plans. Free Explorer tier with 3 briefs/month. Professional at £4.99/month. Investor at £39.99/month. No contracts, cancel anytime.");
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Pricing
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mb-3">
              Know what you're buying into. Before you offer.
            </h1>
            <p className="text-muted-foreground text-base max-w-xl">
              Property intelligence for any UK postcode. Real comparable sales, risk flags, price history and a pre-offer strategy — in under 60 seconds. Start free. Upgrade when you need the full picture.
            </p>
          </div>
        </section>

        {/* Intro incentive bar */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 mb-6">
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <Gift className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm text-foreground/80">
              <span className="font-semibold text-primary">First full Investor brief free.</span>{" "}
              Subscribe to Professional and your very first postcode brief is automatically upgraded to Investor level — 10-year price history, rental demand, sold prices map and more. After that, your plan continues as Professional.
            </p>
          </div>
        </div>

        {/* Pricing Cards */}
        <section className="pb-10 sm:pb-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-3 sm:items-end">
              {tiers.map((tier) => {
                const isInvestor = tier.style === "investor";
                const isPro = tier.style === "professional";

                return (
                  <div
                    key={tier.name}
                    className={`relative flex flex-col rounded-xl p-5 sm:p-6 ${
                      isInvestor
                        ? "bg-[#1A1410] dark:bg-[#1A1410] border border-amber-700/40 shadow-lg shadow-amber-900/10"
                        : isPro
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
                          window.open(tier.stripeUrl, "_blank", "noopener,noreferrer");
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
                    {isPro && (
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
                    <th className="text-center font-medium text-primary py-3 px-2 w-[20%]">
                      Professional
                    </th>
                    <th className="text-center font-bold text-amber-600 dark:text-amber-400 py-3 px-2 w-[20%]">
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
                        <CellValue value={row.professional} col="professional" />
                      </td>
                      <td className="py-3 px-2 text-center bg-amber-500/[0.04] dark:bg-amber-500/[0.06]">
                        <CellValue value={row.investor} col="investor" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-12 sm:py-16 border-t border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
            <h2 className="font-serif text-2xl tracking-tight mb-3">
              Know what you're buying into. Before you offer.
            </h2>
            <p className="text-sm text-muted-foreground mb-2 max-w-md mx-auto">
              Comparable sales, pre-offer strategy, 5-year price history, crime and planning context, and a PDF you can keep or share. Any UK postcode. Unlimited briefs. First full Investor brief free when you subscribe.
            </p>
            <p className="text-sm font-semibold text-primary mb-6">
              £4.99/month. Cancel anytime. No minimum term.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <div className="flex flex-col items-center gap-1.5">
                <a href="https://buy.stripe.com/7sY8wRe7s9yM7ug8gI6Na00?success_url=https%3A%2F%2Fwww.luxproperty.ai%2Fsuccess%3Fplan%3Dprofessional" target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="text-sm font-semibold px-8 w-full sm:w-auto" data-testid="button-start-professional">
                    Get Professional — £4.99/month
                  </Button>
                </a>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Secure checkout via Stripe. Cancel anytime from your account.
                </span>
              </div>
              <Link href="/">
                <Button size="lg" variant="outline" className="text-sm px-8 w-full sm:w-auto" data-testid="button-get-started">
                  Try free first
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
