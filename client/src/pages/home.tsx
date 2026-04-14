import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { generateBrief } from "@/lib/mockEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Search, MapPin, TrendingUp, BarChart3, ArrowRight, Check } from "lucide-react";
import type { BriefReport } from "@shared/schema";

export default function Home() {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  const generateBriefMutation = useMutation({
    mutationFn: async (q: string) => {
      return await generateBrief(q) as BriefReport;
    },
    onSuccess: (data) => {
      navigate(`/brief/${data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      generateBriefMutation.mutate(query.trim());
    }
  };

  const features = [
    {
      icon: MapPin,
      title: "Area Intelligence",
      description:
        "Neighbourhood data, price trends, school ratings, transport links, and local amenity analysis.",
    },
    {
      icon: BarChart3,
      title: "Property Deep Dive",
      description:
        "Valuation assessment, comparable sales analysis, and negotiation leverage points.",
    },
    {
      icon: TrendingUp,
      title: "Investment Outlook",
      description:
        "Yield projections, growth trajectory forecasts, and risk flags for informed decision-making.",
    },
  ];

  const pricingTiers = [
    {
      name: "Explorer",
      price: "Free",
      period: "",
      description: "Get started with basic property intelligence",
      features: ["3 briefs per month", "Area intelligence reports", "Basic market data"],
      cta: "Start Free",
      highlighted: false,
    },
    {
      name: "Professional",
      price: "£59",
      period: "/month",
      description: "For serious buyers and property professionals",
      features: [
        "Unlimited briefs",
        "Property deep dive analysis",
        "Comparable sales data",
        "Negotiation briefs",
        "Export to PDF",
      ],
      cta: "Start Professional",
      highlighted: true,
    },
    {
      name: "Investor",
      price: "£149",
      period: "/month",
      description: "Portfolio management and advanced analytics",
      features: [
        "Everything in Professional",
        "Portfolio dashboard",
        "Automated alerts",
        "API access",
        "Priority support",
        "Custom report branding",
      ],
      cta: "Start Investor",
      highlighted: false,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 sm:py-28 lg:py-36">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h1
                className="font-serif text-4xl sm:text-5xl lg:text-[3.25rem] leading-[1.1] tracking-tight text-foreground"
                data-testid="text-hero-heading"
              >
                Property Intelligence.{" "}
                <span className="text-primary italic">Instantly.</span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
                Enter any UK postcode or property address. Get a complete buyer
                intelligence brief in 60 seconds.
              </p>

              {/* Search Form */}
              <form
                onSubmit={handleSubmit}
                className="mt-8 flex flex-col sm:flex-row gap-3"
                data-testid="form-search"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="e.g. SW7 1AL or 12 Onslow Gardens, London"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 h-12 text-base bg-card border-border/80"
                    data-testid="input-search"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!query.trim() || generateBriefMutation.isPending}
                  className="h-12 px-6 text-sm font-semibold tracking-wide"
                  data-testid="button-generate"
                >
                  {generateBriefMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="flex gap-1">
                        <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-current" />
                        <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-current" />
                        <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-current" />
                      </span>
                      Generating
                    </span>
                  ) : (
                    <>
                      Generate Brief
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {generateBriefMutation.isError && (
                <p className="mt-3 text-sm text-destructive" data-testid="text-error">
                  Something went wrong. Please try again.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 sm:py-20 border-t border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              What you get
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-12">
              Everything a buyer needs to know
            </h2>

            <div className="grid gap-6 sm:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group"
                  data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <feature.icon className="h-5 w-5 text-primary mb-4" />
                  <h3 className="text-sm font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-16 sm:py-20 border-t border-border/40" id="pricing">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Pricing
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground text-sm mb-12 max-w-lg">
              Start free. Upgrade when you need deeper intelligence and unlimited access.
            </p>

            <div className="grid gap-6 sm:grid-cols-3">
              {pricingTiers.map((tier) => (
                <Card
                  key={tier.name}
                  className={`p-6 flex flex-col ${
                    tier.highlighted
                      ? "ring-1 ring-primary/30 bg-card"
                      : ""
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
                    <span className="font-serif text-3xl tracking-tight">
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span className="text-sm text-muted-foreground">
                        {tier.period}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-5">
                    {tier.description}
                  </p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={tier.highlighted ? "default" : "outline"}
                    className="w-full text-sm"
                    data-testid={`button-pricing-${tier.name.toLowerCase()}`}
                  >
                    {tier.cta}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
