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
  Quote,
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
      title: "Neighbourhood Profile",
      description:
        "Schools, transport links, crime data, local amenities, flood risk, and 5-year price trends — all in one place.",
    },
    {
      icon: BarChart3,
      title: "Comparable Sales",
      description:
        "Real Land Registry transactions for the street and surrounding area, with a valuation range and negotiation context.",
    },
    {
      icon: TrendingUp,
      title: "Market Context",
      description:
        "Regional rental benchmarks, broadband ratings, planning activity, and key risk flags before you make an offer.",
    },
  ];

  const pricingTiers = [
    {
      name: "Explorer",
      price: "Free",
      period: "",
      description: "Try it before you commit to anything",
      features: ["3 briefs per month", "Area profile & price trends", "Neighbourhood & crime data"],
      cta: "Start Free",
      highlighted: false,
      stripeUrl: null,
    },
    {
      name: "Professional",
      price: "£4.99",
      period: "/month",
      description: "For active buyers and the advisers who support them",
      features: [
        "Unlimited briefs",
        "Comparable sales & valuation range",
        "Negotiation brief",
        "Planning activity & risk flags",
        "Export to PDF",
      ],
      cta: "Start Professional",
      highlighted: true,
      stripeUrl: "https://buy.stripe.com/test_4gM5kw7tS0sv0Kq4Fd1gs02",
    },
    {
      name: "Investor",
      price: "£39.99",
      period: "/month",
      description: "For professionals managing multiple properties or clients",
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
      stripeUrl: "https://buy.stripe.com/test_28EbIU8xWfnp0Kq6Nl1gs03",
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
                Know the property before{" "}
                <span className="text-primary italic">you make an offer.</span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
                Turn any UK postcode or address into a clear, client-ready brief
                in under a minute — built on official Land Registry data, not estimates.
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
              What's inside every brief
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-12">
              The detail buyers and advisers actually need
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

        {/* Who It's For Section */}
        <section className="py-16 sm:py-20 border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Who it's for
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-4">
              Built for buyers and the professionals who advise them
            </h2>
            <p className="text-sm text-muted-foreground mb-10 max-w-lg">
              Whether you're viewing your first home or advising a client on a complex purchase,
              LuxProperty.ai gives you the data to act with confidence.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  audience: "Homebuyers",
                  description: "Understand any property and its area before you commit. Check prices, risk flags, and comparable sales — before instructing a solicitor.",
                  icon: "\uD83C\uDFE1",
                },
                {
                  audience: "Buying Agents",
                  description: "Generate a clear PDF brief for every property you shortlist. Present clients with structured due-diligence in minutes, not hours.",
                  icon: "\uD83E\uDD1D",
                },
                {
                  audience: "Mortgage Advisers",
                  description: "Set accurate expectations before discussing loan amounts. Share a comparable sales snapshot and valuation range with every client.",
                  icon: "\uD83D\uDCCB",
                },
                {
                  audience: "Brokers",
                  description: "Accelerate your pre-application process. Pull market context and planning history for any UK postcode in seconds.",
                  icon: "\uD83D\uDCCA",
                },
                {
                  audience: "Wealth Managers",
                  description: "Monitor multiple properties across a portfolio. Identify risk flags and market movements for client reporting.",
                  icon: "\uD83D\uDCBC",
                },
                {
                  audience: "First-Time Buyers",
                  description: "Navigate an unfamiliar market with confidence. Get the same depth of information as experienced buyers, without needing an agent.",
                  icon: "\uD83D\uDD11",
                },
              ].map((item) => (
                <div
                  key={item.audience}
                  className="flex flex-col gap-2.5 p-5 rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors"
                  data-testid={`card-audience-${item.audience.toLowerCase().replace(/[^a-z]/g, "-")}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg" role="img" aria-label={item.audience}>{item.icon}</span>
                    <h3 className="text-sm font-semibold">{item.audience}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sample Report Preview Section */}
        <section className="py-16 sm:py-20 border-b border-border/40 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Sample brief
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-3">
              See exactly what you'll receive
            </h2>
            <p className="text-sm text-muted-foreground mb-10 max-w-lg">
              Every brief includes real Land Registry data, a 5-year price trend, comparable
              sales, and a clear verdict — structured so you can share it with your agent or adviser.
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

        {/* Why LuxProperty / Trust Section */}
        <section className="py-16 sm:py-20 border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Why LuxProperty.ai
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-10">
              Built on official data. No guesswork.
            </h2>

            <div className="grid gap-6 sm:grid-cols-3 mb-12">
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
                  body: "Briefs are structured, client-ready, and exportable to PDF. Share directly with your solicitor, mortgage adviser, or buying agent.",
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

            {/* Early user quotes */}
            <div className="grid gap-4 sm:grid-cols-3 mb-10">
              {[
                {
                  quote: "I used it before viewing a flat in Hackney. The negotiation brief saved me at least £12,000 off the asking price.",
                  name: "James R.",
                  role: "First-time buyer, East London",
                },
                {
                  quote: "The neighbourhood profile is better than anything I've seen on Rightmove. Actual detail, not a list of nearby postcodes.",
                  name: "Priya M.",
                  role: "Homebuyer, Birmingham",
                },
                {
                  quote: "As a mortgage broker, I send the PDF reports to clients before we discuss loan amounts. It sets the right expectations immediately.",
                  name: "Tom W.",
                  role: "Independent mortgage broker",
                },
              ].map((t) => (
                <Card key={t.name} className="p-5 flex flex-col gap-3">
                  <Quote className="h-4 w-4 text-primary/40 shrink-0" />
                  <p className="text-sm text-muted-foreground leading-relaxed italic flex-1">{t.quote}</p>
                  <div>
                    <p className="text-xs font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Company trust line */}
            <div className="pt-8 border-t border-border/40 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-muted-foreground">Registered UK company · LuxProperty AI Ltd</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-muted-foreground">Data from HM Land Registry &amp; official UK sources</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-muted-foreground">Used by buyers, advisers &amp; mortgage brokers</span>
              </div>
            </div>
          </div>
        </section>

        {/* Explore Markets */}
        <section className="py-16 sm:py-20 border-b border-border/40 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Explore UK Markets
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-8">
              Deep-dive guides for top UK postcodes
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {[
                { code: "SW3", label: "Chelsea" },
                { code: "E8", label: "Hackney" },
                { code: "W11", label: "Notting Hill" },
                { code: "N1", label: "Islington" },
                { code: "SE1", label: "London Bridge" },
                { code: "M1", label: "Manchester" },
                { code: "B1", label: "Birmingham" },
                { code: "LS1", label: "Leeds" },
                { code: "BS1", label: "Bristol" },
                { code: "RG1", label: "Reading" },
                { code: "OX1", label: "Oxford" },
                { code: "CB1", label: "Cambridge" },
              ].map((area) => (
                <a
                  key={area.code}
                  href={`/#/area/${area.code}`}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border/40 bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm"
                >
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  <span className="font-medium">{area.code}</span>
                  <span className="text-muted-foreground text-xs">{area.label}</span>
                </a>
              ))}
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
              Start free with 3 briefs a month. Upgrade for unlimited access and the full pre-offer toolkit.
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
                    onClick={() => {
                      if (tier.stripeUrl) {
                        window.open(tier.stripeUrl, "_blank", "noopener,noreferrer");
                      } else {
                        const el = document.querySelector("[data-testid='input-search']") as HTMLInputElement | null;
                        el?.focus();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
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
