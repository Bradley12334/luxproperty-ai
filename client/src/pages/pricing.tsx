import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Minus } from "lucide-react";
import { Link } from "wouter";

const tiers = [
  {
    name: "Explorer",
    price: "Free",
    period: "",
    description: "Get started with basic property intelligence",
    highlighted: false,
    cta: "Start Free",
  },
  {
    name: "Professional",
    price: "£59",
    period: "/month",
    description: "For serious buyers and property professionals",
    highlighted: true,
    cta: "Start Professional",
  },
  {
    name: "Investor",
    price: "£149",
    period: "/month",
    description: "Portfolio management and advanced analytics",
    highlighted: false,
    cta: "Start Investor",
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

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-sm text-foreground">{value}</span>;
  }
  return value ? (
    <Check className="h-4 w-4 text-primary mx-auto" />
  ) : (
    <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
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
            <div className="grid gap-6 sm:grid-cols-3">
              {tiers.map((tier) => (
                <Card
                  key={tier.name}
                  className={`p-6 flex flex-col ${
                    tier.highlighted ? "ring-1 ring-primary/30" : ""
                  }`}
                  data-testid={`card-pricing-${tier.name.toLowerCase()}`}
                >
                  {tier.highlighted && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary mb-3">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-sm font-semibold">{tier.name}</h3>
                  <div className="mt-3 mb-1">
                    <span className="font-serif text-4xl tracking-tight">{tier.price}</span>
                    {tier.period && (
                      <span className="text-sm text-muted-foreground">{tier.period}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-6">{tier.description}</p>
                  <Button
                    variant={tier.highlighted ? "default" : "outline"}
                    className="w-full text-sm mt-auto"
                    data-testid={`button-pricing-${tier.name.toLowerCase()}`}
                  >
                    {tier.cta}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="py-16 sm:py-20 border-t border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="font-serif text-2xl tracking-tight mb-8">
              Compare plans
            </h2>

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
                    <th className="text-center font-medium text-muted-foreground py-3 px-2 w-[20%]">
                      Investor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((row) => (
                    <tr
                      key={row.feature}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="py-3 pr-4 pl-4 sm:pl-0 text-foreground/90">
                        {row.feature}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <CellValue value={row.explorer} />
                      </td>
                      <td className="py-3 px-2 text-center bg-primary/[0.03] dark:bg-primary/[0.05]">
                        <CellValue value={row.professional} />
                      </td>
                      <td className="py-3 px-2 text-center">
                        <CellValue value={row.investor} />
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
