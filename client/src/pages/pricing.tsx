import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Check, Minus, Star } from "lucide-react";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";

const tiers = [
  {
    name: "Explorer",
    price: "Free",
    period: "",
    description: "For casual browsers and first-time visitors. Run up to 3 briefs a month and see exactly what the product does — no card required.",
    badge: null,
    style: "default",
    cta: "Start Free",
    ctaVariant: "outline" as const,
    stripeUrl: null,
  },
  {
    name: "Professional",
    price: "£4.99",
    period: "/month",
    description: "The plan most serious buyers and advisers choose. Unlimited briefs, the full pre-offer toolkit, and everything you need to move with confidence.",
    badge: "Best for Most",
    style: "professional",
    cta: "Start Professional",
    ctaVariant: "default" as const,
    stripeUrl: "https://buy.stripe.com/7sY8wRe7s9yM7ug8gI6Na00",
  },
  {
    name: "Investor",
    price: "£39.99",
    period: "/month",
    description: "For advisers and buyers tracking multiple properties. Includes portfolio tools and custom-branded PDF reports.",
    badge: "Power Users",
    style: "investor",
    cta: "Start Investor",
    ctaVariant: "default" as const,
    stripeUrl: "https://buy.stripe.com/8x200l2oKdP229WfJa6Na01",
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
  { feature: "Area intelligence report", explorer: true, professional: true, investor: true },
  { feature: "Market overview (price, YoY change, supply)", explorer: true, professional: true, investor: true },
  { feature: "Neighbourhood profile & local character", explorer: true, professional: true, investor: true },
  { feature: "What residents say", explorer: true, professional: true, investor: true },
  { feature: "1-year price trend (Land Registry)", explorer: true, professional: true, investor: true },
  { feature: "Flood & climate risk", explorer: true, professional: true, investor: true },
  { feature: "Council tax data", explorer: true, professional: true, investor: true },
  { feature: "Property type split", explorer: true, professional: true, investor: true },
  { feature: "Commute calculator", explorer: true, professional: true, investor: true },
  { feature: "Nearby schools, stations & parks", explorer: true, professional: true, investor: true },
  // ── Professional ─────────────────────────────────────────────────────────────
  { feature: "5-year price trend (Land Registry)", explorer: false, professional: true, investor: true },
  { feature: "Comparable sales & valuation range", explorer: false, professional: true, investor: true },
  { feature: "Negotiation brief & offer guidance", explorer: false, professional: true, investor: true },
  { feature: "Planning activity & risk flags", explorer: false, professional: true, investor: true },
  { feature: "Rental market snapshot", explorer: false, professional: true, investor: true },
  { feature: "Broadband & infrastructure", explorer: false, professional: true, investor: true },
  { feature: "Air quality index", explorer: false, professional: true, investor: true },
  { feature: "Export to PDF", explorer: false, professional: true, investor: true },
  { feature: "Save briefs", explorer: false, professional: true, investor: true },
  // ── Investor ─────────────────────────────────────────────────────────────────
  { feature: "Portfolio dashboard", explorer: false, professional: false, investor: true },
  { feature: "Sold prices map", explorer: false, professional: false, investor: true },
  { feature: "Development tracker", explorer: false, professional: false, investor: true },
  { feature: "Rental demand score", explorer: false, professional: false, investor: true },
  { feature: "Custom-branded PDF reports", explorer: false, professional: false, investor: true },
  { feature: "Price alerts", explorer: false, professional: false, investor: "Coming Soon" },
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
  useDocumentTitle("Pricing");
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Pricing
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mb-3">
              Clear pricing, real value
            </h1>
            <p className="text-muted-foreground text-base max-w-lg">
              Free to start — 3 briefs a month, no card required. Professional at £4.99/month is the plan most serious buyers and advisers choose: unlimited briefs, comparable sales, valuation range, negotiation brief, PDF export, and the full pre-offer toolkit.
            </p>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-6 sm:grid-cols-3 items-end">
              {tiers.map((tier) => {
                const isInvestor = tier.style === "investor";
                const isPro = tier.style === "professional";

                return (
                  <div
                    key={tier.name}
                    className={`relative flex flex-col rounded-xl p-6 ${
                      isInvestor
                        ? "bg-[#1A1410] dark:bg-[#1A1410] border border-amber-700/40 shadow-lg shadow-amber-900/10"
                        : isPro
                        ? "bg-card border-2 border-primary/40 shadow-xl shadow-primary/10 -mx-1 sm:scale-[1.04] sm:origin-bottom z-10 pb-8"
                        : "bg-card border border-border"
                    }`}
                    data-testid={`card-pricing-${tier.name.toLowerCase()}`}
                  >
                    {/* Badge */}
                    {tier.badge && (
                      <div className={`flex items-center gap-1.5 mb-4 ${isInvestor ? "" : ""}`}>
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
                          window.location.hash = "/";
                        }
                      }}
                    >
                      {tier.cta}
                    </Button>

                    {/* Gold shimmer line for Investor */}
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

        {/* Feature Comparison Table */}
        <section className="py-16 sm:py-20 border-t border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="font-serif text-2xl tracking-tight mb-8">What’s included</h2>

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
        <section className="py-16 sm:py-20 border-t border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
            <h2 className="font-serif text-2xl tracking-tight mb-3">
              Most buyers start free. Most stay on Professional.
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Try it free with no commitment. When you're ready for comparable sales, valuation range, negotiation brief, and PDF export — Professional is £4.99/month.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={`https://buy.stripe.com/7sY8wRe7s9yM7ug8gI6Na00`} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="text-sm font-semibold px-8 w-full sm:w-auto" data-testid="button-start-professional">
                  Start Professional — £4.99/month
                </Button>
              </a>
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
