import { useState } from "react";
import { useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useMutation } from "@tanstack/react-query";
import { generateBrief } from "@/lib/mockEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import {
  Search,
  MapPin,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Check,
  Shield,
  Database,
  FileText,
  Lock,
  Star,
  Building2,
  ChevronRight,
} from "lucide-react";
import type { BriefReport } from "@shared/schema";

export default function Home() {
  useDocumentTitle("");
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  const generateBriefMutation = useMutation({
    mutationFn: async (q: string) => {
      return (await generateBrief(q)) as BriefReport;
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

  const trustBadges = [
    { icon: Database, text: "HM Land Registry Data" },
    { icon: Shield, text: "Verified Market Prices" },
    { icon: FileText, text: "Instant PDF Reports" },
    { icon: Building2, text: "All UK Postcodes" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 sm:py-28 lg:py-36">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="max-w-2xl">
              {/* Trust pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary mb-6">
                <Database className="h-3 w-3" />
                Powered by HM Land Registry · Official UK property data
              </div>

              <h1
                className="font-serif text-4xl sm:text-5xl lg:text-[3.25rem] leading-[1.1] tracking-tight text-foreground"
                data-testid="text-hero-heading"
              >
                Property Intelligence.{" "}
                <span className="text-primary italic">Instantly.</span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
                Enter any UK postcode or property address. Get a complete buyer
                intelligence brief in 60 seconds — built on real sales data, not
                estimates.
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

              {/* Trust badges row */}
              <div className="mt-8 flex flex-wrap gap-3">
                {trustBadges.map((badge) => (
                  <div
                    key={badge.text}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <badge.icon className="h-3.5 w-3.5 text-primary/70" />
                    <span>{badge.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof / Stats Strip */}
        <section className="border-y border-border/40 bg-muted/30 py-6">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { value: "18M+", label: "Land Registry transactions" },
                { value: "100%", label: "England & Wales coverage" },
                { value: "5 years", label: "Historical price data" },
                { value: "60s", label: "Average brief time" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-serif text-xl sm:text-2xl text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 sm:py-20 border-b border-border/40">
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

        {/* Sample Report Preview Section */}
        <section className="py-16 sm:py-20 border-b border-border/40 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Sample report
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-3">
              See exactly what you'll receive
            </h2>
            <p className="text-sm text-muted-foreground mb-10 max-w-lg">
              Every brief includes real Land Registry data, a 5-year price trend, and an
              investment verdict — all in one clean document.
            </p>

            {/* Mock report card */}
            <div className="relative max-w-2xl">
              <Card className="p-6 border-border/60 shadow-sm overflow-hidden">
                {/* Report header */}
                <div className="flex items-start justify-between mb-5 pb-4 border-b border-border/40">
                  <div>
                    <Badge variant="outline" className="text-[10px] mb-2">
                      Area Brief
                    </Badge>
                    <h3 className="font-serif text-lg tracking-tight">
                      Area Intelligence Brief — Chelsea, SW3
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Generated from HM Land Registry · Postcodes.io
                    </p>
                  </div>
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] shrink-0">
                    STRONG BUY
                  </Badge>
                </div>

                {/* Executive Summary stub */}
                <div className="mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-2">
                    Executive Summary
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Chelsea (SW3) remains one of London's most resilient prime markets.
                    Median prices have climbed from £1.1M in 2020 to £1.38M in 2024,
                    representing a 25% uplift over five years. Supply is constrained,
                    demand is internationally driven, and fundamentals remain robust.
                  </p>
                </div>

                {/* KPI grid */}
                <div className="grid grid-cols-4 gap-4 mb-5 pb-5 border-b border-border/40">
                  {[
                    { label: "Median Price", value: "£1.38M" },
                    { label: "YoY Change", value: "+5.2%" },
                    { label: "Days on Market", value: "43" },
                    { label: "Supply Level", value: "Low" },
                  ].map((kpi) => (
                    <div key={kpi.label}>
                      <p className="text-[10px] text-muted-foreground mb-1">{kpi.label}</p>
                      <p className="font-serif text-base text-foreground">{kpi.value}</p>
                    </div>
                  ))}
                </div>

                {/* 5-year trend stub */}
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-3">
                    5-Year Price Trend
                  </p>
                  <div className="space-y-2">
                    {[
                      { year: "2020", price: "£1,105,000", change: "—" },
                      { year: "2021", price: "£1,168,000", change: "+5.7%" },
                      { year: "2022", price: "£1,241,000", change: "+6.3%" },
                      { year: "2023", price: "£1,310,000", change: "+5.6%" },
                      { year: "2024", price: "£1,379,000", change: "+5.3%" },
                    ].map((row) => (
                      <div key={row.year} className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground w-8">{row.year}</span>
                        <span className="font-serif text-sm flex-1">{row.price}</span>
                        <span
                          className={
                            row.change === "—"
                              ? "text-muted-foreground"
                              : "text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {row.change}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Blur overlay for bottom sections */}
                <div className="relative mt-4">
                  <div className="space-y-3 blur-sm opacity-60 select-none pointer-events-none">
                    <div className="h-4 bg-muted rounded w-32" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-5/6" />
                    <div className="h-3 bg-muted rounded w-4/6" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </div>
                  {/* Unlock overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-2 bg-background/90 border border-border px-4 py-2 rounded-full shadow-sm">
                      <Lock className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium">
                        Negotiation brief + investment verdict in full reports
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* CTA below card */}
              <div className="mt-5 flex items-center gap-3">
                <Button
                  onClick={() => {
                    const el = document.querySelector("[data-testid='input-search']") as HTMLInputElement | null;
                    el?.focus();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="text-sm font-semibold"
                >
                  Generate your free brief
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  No sign-up required
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials / Trust Section */}
        <section className="py-16 sm:py-20 border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Why LuxProperty.ai
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-10">
              Built on official data. No guesswork.
            </h2>

            <div className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  icon: Database,
                  title: "HM Land Registry",
                  body: "Every price trend is calculated from actual registered transactions — the same data solicitors and surveyors rely on.",
                },
                {
                  icon: Shield,
                  title: "No AI hallucinations",
                  body: "Market data is fetched live from official APIs. Prices, trends, and district data are real — never made up.",
                },
                {
                  icon: FileText,
                  title: "Professional-grade output",
                  body: "Reports follow the same structure used by property analysts. Export to branded PDF. Share with your solicitor or agent.",
                },
              ].map((item) => (
                <div key={item.title} className="flex flex-col gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Company trust line */}
            <div className="mt-10 pt-8 border-t border-border/40 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Registered UK company · Based in England
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-16 sm:py-20" id="pricing">
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
                    tier.highlighted ? "ring-1 ring-primary/30 bg-card" : ""
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
                    <span className="font-serif text-3xl tracking-tight">{tier.price}</span>
                    {tier.period && (
                      <span className="text-sm text-muted-foreground">{tier.period}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-5">{tier.description}</p>
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

            {/* Trust line under pricing */}
            <p className="mt-8 text-center text-xs text-muted-foreground">
              No credit card required to start ·{" "}
              <ChevronRight className="inline h-3 w-3" /> Cancel anytime
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
