import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Check, Minus, Star } from "lucide-react";
import { Link } from "wouter";

const tiers = [
  {
    name: "Explorer",
    price: "Free",
    period: "",
    description: "Get started with basic property intelligence",
    badge: null,
    style: "default",
    cta: "Start Free",
    ctaVariant: "outline" as const,
  },
  {
    name: "Professional",
    price: "£59",
    period: "/month",
    description: "For serious buyers and property professionals",
    badge: "Most Popular",
    style: "professional",
    cta: "Start Professional",
    ctaVariant: "default" as const,
  },
  {
    name: "Investor",
    price: "£149",
    period: "/month",
    description: "Portfolio management and advanced analytics",
    badge: "Best Value",
    style: "investor",
    cta: "Start Investor",
    ctaVariant: "default" as const,
  },
];

interface FeatureRow {
  feature: string;
  explorer: boolean | string;
  professional: boolean | string;
  investor: boolean | string;
}

const features: FeatureRow[] = [
  { feature: "Monthly briefs", explorer: "3", professional: "Unlimited", investor: "Unlimited" },
  { feature: "Area intelligence reports", explorer: true, professional: true, investor: true },
  { feature: "Market overview data", explorer: true, professional: true, investor: true },
  { feature: "Neighbourhood profile", explorer: true, professional: true, investor: true },
  { feature: "Price trend analysis", explorer: "1 year", professional: "5 years", investor: "10 years" },
  { feature: "Property deep dive", explorer: false, professional: true, investor: true },
  { feature: "Valuation assessment", explorer: false, professional: true, investor: true },
  { feature: "Comparable sales data", explorer: false, professional: true, investor: true },
  { feature: "Negotiation brief", explorer: false, professional: true, investor: true },
  { feature: "Export to PDF", explorer: false, professional: true, investor: true },
  { feature: "Portfolio dashboard", explorer: false, professional: false, investor: true },
  { feature: "Automated price alerts", explorer: false, professional: false, investor: true },
  { feature: "API access", explorer: false, professional: false, investor: true },
  { feature: "Custom report branding", explorer: false, professional: false, investor: true },
  { feature: "Priority support", explorer: false, professional: false, investor: true },
  { feature: "Dedicated account manager", explorer: false, professional: false, investor: true },
];

function CellValue({ value, col }: { value: boolean | string; col: string }) {
  const isInvestor = col === "investor";
  const isPro = col === "professional";
  if (typeof value === "string") {
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
              Invest in better decisions
            </h1>
            <p className="text-muted-foreground text-base max-w-lg">
              Every plan includes AI-powered area intelligence. Upgrade for full property
              analysis, negotiation briefs, and portfolio tools.
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
                        ? "bg-[#1A1410] dark:bg-[#1A1410] border border-amber-700/40 shadow-2xl shadow-amber-900/20 pb-8 -mx-2 sm:scale-[1.04] sm:origin-bottom z-10"
                        : isPro
                        ? "bg-card border border-primary/25 shadow-lg"
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
                    >
                      {tier.cta}
                    </Button>

                    {/* Gold shimmer line for Investor */}
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
            <h2 className="font-serif text-2xl tracking-tight mb-8">Compare plans</h2>

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
              Ready to make smarter property decisions?
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Start with a free brief and see the quality of our intelligence firsthand.
            </p>
            <Link href="/">
              <Button size="lg" className="text-sm font-semibold px-8" data-testid="button-get-started">
                Get your first brief free
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
