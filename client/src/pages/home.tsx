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
  Users,
  ExternalLink,
  Train,
  TreePine,
  GraduationCap,
  HardDrive,
  Wifi,
  AlertTriangle,
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
      description: "Try it with no commitment",
      features: ["3 briefs per month", "5-year price trend & area data", "Neighbourhood profile & local character"],
      cta: "Start Free",
      highlighted: false,
      stripeUrl: null,
    },
    {
      name: "Professional",
      price: "£4.99",
      period: "/month",
      description: "For buyers and advisers doing serious work",
      features: [
        "Unlimited briefs",
        "Comparable sales & valuation range",
        "Negotiation brief & offer guidance",
        "Planning activity & risk flags",
        "Export to PDF & save briefs",
      ],
      cta: "Start Professional",
      highlighted: true,
      stripeUrl: "https://buy.stripe.com/7sY8wRe7s9yM7ug8gI6Na00",
    },
    {
      name: "Investor",
      price: "£39.99",
      period: "/month",
      description: "For advisers tracking multiple properties or clients",
      features: [
        "Everything in Professional",
        "Portfolio dashboard",
        "Sold prices map",
        "Development tracker",
        "Custom-branded PDF reports",
      ],
      cta: "Start Investor",
      highlighted: false,
      stripeUrl: "https://buy.stripe.com/8x200l2oKdP229WfJa6Na01",
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
                    placeholder="Try SW3 1AA, RG1 2AB, or any UK address…"
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

        {/* How It Works Section */}
        <section className="py-14 sm:py-16 border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              How it works
            </p>
            <h2 className="font-serif text-2xl sm:text-[1.65rem] tracking-tight mb-10">
              A clear brief in under a minute
            </h2>
            <div className="grid gap-0 sm:grid-cols-3 relative">
              {/* connector line, desktop only */}
              <div className="hidden sm:block absolute top-5 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-border/50" aria-hidden="true" />
              {[
                {
                  step: "01",
                  heading: "Enter a postcode or address",
                  body: "Type any UK postcode or full address into the search bar. Chelsea, Reading, Manchester — any property in England or Wales.",
                },
                {
                  step: "02",
                  heading: "We pull trusted data",
                  body: "LuxProperty.ai fetches live data from HM Land Registry, the EPC Register, Environment Agency, and official UK sources.",
                },
                {
                  step: "03",
                  heading: "You get a clear brief",
                  body: "A structured report: price trends, comparable sales, neighbourhood profile, risk flags, and a negotiation summary — ready to share.",
                },
              ].map((item, i) => (
                <div key={item.step} className={`flex flex-col gap-3 px-0 sm:px-6 ${i === 0 ? "sm:pl-0" : ""} ${i === 2 ? "sm:pr-0" : ""} ${i > 0 ? "mt-8 sm:mt-0 pt-8 sm:pt-0 border-t sm:border-t-0 border-border/40" : ""}`}>
                  <div className="relative z-10 w-10 h-10 rounded-full border border-border/60 bg-card flex items-center justify-center shrink-0">
                    <span className="font-serif text-sm text-primary">{item.step}</span>
                  </div>
                  <h3 className="text-sm font-semibold leading-snug">{item.heading}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Brief Preview Section — moved up */}
        <section className="py-16 sm:py-20 border-b border-border/40 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16 items-start">

              {/* Left col — context copy */}
              <div className="lg:sticky lg:top-24">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
                  Sample brief
                </p>
                <h2 className="font-serif text-2xl sm:text-[1.65rem] tracking-tight mb-4">
                  This is what you'll receive
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  Every brief is structured, data-backed, and client-ready. Comparable sales,
                  5-year price trend, neighbourhood profile, risk flags, and a clear
                  negotiation summary — all in one place.
                </p>
                <div className="space-y-2.5 mb-8">
                  {[
                    "Real Land Registry transactions",
                    "Neighbourhood character & lifestyle data",
                    "Flood, planning & EPC risk flags",
                    "Valuation range & negotiation brief",
                    "Export to PDF or share as a link",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2.5 text-sm">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => {
                    const el = document.querySelector("[data-testid='input-search']") as HTMLInputElement | null;
                    el?.focus();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="text-sm font-semibold"
                  data-testid="button-try-it"
                >
                  Generate your free brief
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
                <p className="mt-2.5 text-xs text-muted-foreground">No sign-up required</p>
              </div>

              {/* Right col — rich brief mock */}
              <div className="relative">
                <Card className="border-border/60 shadow-md overflow-hidden">

                  {/* Report header bar */}
                  <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Area Property Report</p>
                      <h3 className="font-serif text-base tracking-tight mt-0.5">Chelsea, SW3 1AA</h3>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-0 text-[10px] font-semibold shrink-0">
                      STRONG BUY
                    </Badge>
                  </div>

                  <div className="p-5 space-y-5">

                    {/* At a Glance panel */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-2.5">At a Glance</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { icon: Train, label: "Nearest tube", value: "South Kensington · 4 min walk", colour: "bg-[#114B8B]" },
                          { icon: GraduationCap, label: "Schools nearby", value: "4 Ofsted Outstanding within 0.5mi" },
                          { icon: TreePine, label: "Green space", value: "Ranelagh Gardens · 3 min walk" },
                          { icon: Shield, label: "Safety rating", value: "Low crime · Royal Borough of K&C" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40">
                            <item.icon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground">{item.label}</p>
                              <p className="text-xs font-medium leading-snug mt-0.5 truncate">{item.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* KPI row */}
                    <div className="grid grid-cols-4 gap-3 pb-4 border-b border-border/40">
                      {[
                        { label: "Median", value: "£1.38M" },
                        { label: "5yr Change", value: "+24.7%" },
                        { label: "On Market", value: "43 days" },
                        { label: "Supply", value: "Low" },
                      ].map((kpi) => (
                        <div key={kpi.label}>
                          <p className="text-[10px] text-muted-foreground mb-0.5">{kpi.label}</p>
                          <p className="font-serif text-sm text-foreground">{kpi.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* 5-year trend */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-2.5">5-Year Price Trend</p>
                      <div className="space-y-1.5">
                        {[
                          { year: "2020", price: "£1,105,000", pct: "—", w: "64%" },
                          { year: "2021", price: "£1,168,000", pct: "+5.7%", w: "68%" },
                          { year: "2022", price: "£1,241,000", pct: "+6.3%", w: "72%" },
                          { year: "2023", price: "£1,310,000", pct: "+5.6%", w: "76%" },
                          { year: "2024", price: "£1,379,000", pct: "+5.3%", w: "80%" },
                        ].map((row) => (
                          <div key={row.year} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-8 shrink-0">{row.year}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary/40" style={{ width: row.w }} />
                            </div>
                            <span className="font-serif text-foreground w-20 text-right shrink-0">{row.price}</span>
                            <span className={`w-10 text-right shrink-0 ${row.pct === "—" ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"}`}>{row.pct}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Comparables stub — blurred bottom */}
                    <div className="relative">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-2.5">Comparable Sales</p>
                      <div className="space-y-2 blur-[2px] opacity-60 select-none pointer-events-none">
                        {[
                          { addr: "14 Onslow Square", beds: "4 bed", price: "£1.42M", date: "Jan 2025" },
                          { addr: "7 Lennox Gardens", beds: "3 bed", price: "£1.19M", date: "Dec 2024" },
                          { addr: "31 Cale Street", beds: "2 bed", price: "£875,000", date: "Nov 2024" },
                        ].map((c) => (
                          <div key={c.addr} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground truncate">{c.addr}</span>
                            <span className="text-muted-foreground shrink-0">{c.beds}</span>
                            <span className="font-serif text-foreground shrink-0">{c.price}</span>
                            <span className="text-muted-foreground shrink-0">{c.date}</span>
                          </div>
                        ))}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center gap-1.5 bg-background/90 border border-border px-3 py-1.5 rounded-full shadow-sm">
                          <Lock className="h-3 w-3 text-primary" />
                          <span className="text-[10px] font-medium">Full comparables in your brief</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </Card>

                {/* Data source footer */}
                <p className="mt-3 text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <Database className="h-3 w-3 text-primary/60" />
                  Data from HM Land Registry · EPC Register · data.police.uk · OSM
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* For Professionals Section */}
        <section className="py-16 sm:py-20 border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16 items-start">

              {/* Left — headline + intro */}
              <div className="lg:sticky lg:top-24">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary mb-5">
                  <Users className="h-3 w-3" />
                  For professionals
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-4">
                  The brief you pull up in front of a client
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  Buying agents, mortgage advisers, and wealth managers use LuxProperty.ai
                  to run live due-diligence in client meetings — then export or share the
                  brief in one click.
                </p>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary/70" />
                    <span>Export to PDF</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ExternalLink className="h-3.5 w-3.5 text-primary/70" />
                    <span>Share as a link</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Database className="h-3.5 w-3.5 text-primary/70" />
                    <span>Official data sources</span>
                  </div>
                </div>
              </div>

              {/* Right — use-case scenarios */}
              <div className="flex flex-col divide-y divide-border/40">
                {[
                  {
                    context: "First call with a new buyer",
                    heading: "Establish the market straight away",
                    body: "Pull up a brief for the buyer's target area while you're still on the call. Show them real price trends, typical comparable values, and what supply looks like — before they've even seen a property.",
                    step: "01",
                  },
                  {
                    context: "Pre-viewing research",
                    heading: "Arrive knowing the numbers",
                    body: "Run a brief on the specific postcode the night before a viewing. Check comparable sales on the same street, flag any planning activity nearby, and have the negotiation context ready before you walk through the door.",
                    step: "02",
                  },
                  {
                    context: "Comparing two shortlisted areas",
                    heading: "Give clients a clear, side-by-side picture",
                    body: "Generate briefs for both postcodes, export to PDF, and share with your client before the next meeting. Price trajectory, neighbourhood profile, and risk flags — all in the same format, ready to compare.",
                    step: "03",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="py-6 first:pt-0 last:pb-0"
                    data-testid={`card-usecase-${item.step}`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="font-serif text-2xl text-primary/20 leading-none tabular-nums shrink-0 mt-0.5 select-none">
                        {item.step}
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-1.5">
                          {item.context}
                        </p>
                        <h3 className="text-sm font-semibold text-foreground mb-2">
                          {item.heading}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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

        {/* Built on Trusted Data Section */}
        <section className="py-16 sm:py-20 border-b border-border/40 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-16 items-start">

              {/* Left — framing copy */}
              <div className="lg:sticky lg:top-24">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
                  Data sources
                </p>
                <h2 className="font-serif text-2xl sm:text-[1.65rem] tracking-tight mb-4">
                  Built on trusted data, not estimates
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  Every section of a LuxProperty brief is drawn from a named, official source.
                  No AI estimates. No made-up averages. The data behind your brief is the same
                  data used by solicitors, surveyors, and planning authorities.
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border/50 rounded-lg px-3.5 py-2.5 bg-card inline-flex w-fit">
                  <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Registered UK company · LuxProperty AI Ltd · No. 17158079</span>
                </div>
              </div>

              {/* Right — source list */}
              <div className="divide-y divide-border/40">
                {[
                  {
                    icon: Database,
                    source: "HM Land Registry",
                    covers: "Price trends, comparable sales, 5-year history",
                    note: "Actual registered transactions across England & Wales",
                  },
                  {
                    icon: HardDrive,
                    source: "EPC Register",
                    covers: "Energy efficiency ratings, property type, build year",
                    note: "MHCLG domestic energy performance data",
                  },
                  {
                    icon: AlertTriangle,
                    source: "Environment Agency",
                    covers: "Flood risk zones and surface water risk",
                    note: "Official flood mapping data for England",
                  },
                  {
                    icon: Shield,
                    source: "data.police.uk",
                    covers: "Crime statistics and category breakdown",
                    note: "Published monthly by UK police forces",
                  },
                  {
                    icon: GraduationCap,
                    source: "Ofsted",
                    covers: "School locations and inspection ratings",
                    note: "Via OpenStreetMap school data and Ofsted results",
                  },
                  {
                    icon: Train,
                    source: "Transport open data",
                    covers: "Nearest stations, TfL lines, walk times",
                    note: "OpenStreetMap transport nodes and TfL Journey Planner",
                  },
                  {
                    icon: Wifi,
                    source: "Ofcom Connected Nations",
                    covers: "Broadband availability and average speeds",
                    note: "2024 Connected Nations dataset by local authority",
                  },
                  {
                    icon: TrendingUp,
                    source: "ONS / VOA Rental Data",
                    covers: "Rental market benchmarks and demand indicators",
                    note: "ONS IPHRP and Valuation Office Agency 2024 data",
                  },
                ].map((item) => (
                  <div key={item.source} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="w-7 h-7 rounded-md bg-primary/8 border border-border/50 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-0.5">
                        <span className="text-sm font-semibold">{item.source}</span>
                        <span className="text-xs text-muted-foreground">· {item.covers}</span>
                      </div>
                      <p className="text-xs text-muted-foreground/70">{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Founder + Early Access Section */}
        <section className="py-14 sm:py-16 border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1fr_1px_1fr] items-stretch">

              {/* Founder snippet */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Who built this
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  LuxProperty.ai was built by a quantity surveying student who couldn't find a
                  clean, data-backed way to research a property before making an offer.
                  The brief is the tool I wanted to have — built on real data, structured for
                  buyers and the professionals who advise them.
                </p>
                <p className="text-xs text-muted-foreground/70">
                  QS student, University of Reading · LuxProperty AI Ltd
                </p>
              </div>

              {/* Divider — visible on lg only */}
              <div className="hidden lg:block w-px bg-border/40 self-stretch" aria-hidden="true" />

              {/* Early access note */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Early access
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  LuxProperty.ai is in early access. The core brief is live and working across
                  England and Wales. New data sources, features, and export options are being
                  added regularly.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If you run into something that doesn't look right, or have a feature you'd
                  find genuinely useful, the contact details are on the About page.
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-muted-foreground">Live &amp; actively improving</span>
                </div>
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
