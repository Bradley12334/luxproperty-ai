import { useState } from "react";
import { useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useMutation } from "@tanstack/react-query";
import { generateBrief } from "@/lib/mockEngine";
import { getUser } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import {
  Search,
  ArrowRight,
  Check,
  Shield,
  Database,
  Lock,
  Train,
  GraduationCap,
  TreePine,
  AlertTriangle,
  TrendingUp,
  FileText,
  MapPin,
  BarChart3,
  HardDrive,
  Wifi,
  ChevronRight,
} from "lucide-react";
import type { BriefReport } from "@shared/schema";

export default function Home() {
  useDocumentTitle("", "AI-powered property intelligence for UK buyers. Enter any postcode or address and get a complete buyer intelligence brief in 60 seconds — built on official HM Land Registry data.");
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  const generateBriefMutation = useMutation({
    mutationFn: async (q: string) => {
      const callerPlan = getUser()?.plan;
      return (await generateBrief(q, callerPlan)) as BriefReport;
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">

        {/* ─── HERO ──────────────────────────────────────────────────────── */}
        <section className="relative bg-[#1F1F1F] overflow-hidden">
          {/* Subtle architectural grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(rgba(200,169,107,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(200,169,107,0.04) 1px, transparent 1px)`,
              backgroundSize: "64px 64px",
            }}
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
            <div className="max-w-[640px]">

              {/* Eyebrow */}
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B] mb-7">
                UK Property Intelligence
              </p>

              {/* Headline */}
              <h1
                className="font-serif text-[2.6rem] sm:text-[3.4rem] leading-[1.08] tracking-tight text-[#F5F1E8]"
                data-testid="text-hero-heading"
              >
                Know where to look.
                <br />
                <span className="text-[#C8A96B]">Before anyone else does.</span>
              </h1>

              {/* Sub */}
              <p className="mt-6 text-[15px] text-[#F5F1E8]/60 leading-relaxed max-w-[480px]">
                Enter any UK postcode. Get a full intelligence brief — price history, comparable sales, risk flags, neighbourhood profile — built on HM Land Registry data, not estimates.
              </p>

              {/* Search */}
              <form
                onSubmit={handleSubmit}
                className="mt-9 flex flex-col sm:flex-row gap-3"
                data-testid="form-search"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#F5F1E8]/30" />
                  <Input
                    type="text"
                    placeholder="Postcode or address — try SW3 1AA, LS6 2EX…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-11 h-12 text-[15px] bg-white/5 border-white/10 text-[#F5F1E8] placeholder:text-[#F5F1E8]/30 focus:border-[#C8A96B]/50 focus:ring-[#C8A96B]/20"
                    data-testid="input-search"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!query.trim() || generateBriefMutation.isPending}
                  className="h-12 px-7 text-[13px] font-semibold tracking-wide bg-[#C8A96B] hover:bg-[#b8985e] text-[#1F1F1F] border-0"
                  data-testid="button-generate"
                >
                  {generateBriefMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
                      </span>
                      Generating
                    </span>
                  ) : (
                    <>
                      Run Brief
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {generateBriefMutation.isError && (
                <p className="mt-3 text-sm text-red-400" data-testid="text-error">
                  Something went wrong. Please try again.
                </p>
              )}

              <p className="mt-4 text-[11px] text-[#F5F1E8]/30 tracking-wide">
                Free to try · No card required · England &amp; Wales
              </p>
            </div>
          </div>
        </section>

        {/* ─── STATS STRIP ───────────────────────────────────────────────── */}
        <section className="border-b border-border/40 bg-[#F5F1E8]">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { value: "18M+", label: "Land Registry transactions" },
                { value: "100%", label: "England & Wales coverage" },
                { value: "10 years", label: "Price history (Investor)" },
                { value: "60s", label: "Brief generation time" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-serif text-xl text-[#1F1F1F]">{stat.value}</p>
                  <p className="text-[11px] text-[#1F1F1F]/50 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── BRIEF PREVIEW ─────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-14 lg:grid-cols-[1fr_1.35fr] lg:gap-20 items-start">

              {/* Left */}
              <div className="lg:sticky lg:top-24">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B] mb-4">
                  Sample output
                </p>
                <h2 className="font-serif text-[1.7rem] sm:text-[2rem] tracking-tight leading-[1.15] text-foreground mb-4">
                  A clear picture of any area, instantly.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-7">
                  Every brief is built from official sources — not estimates, not averages, not AI-generated numbers. Price history from Land Registry. Crime from data.police.uk. Schools from Ofsted. Flood risk from the Environment Agency.
                </p>
                <ul className="space-y-2.5 mb-8">
                  {[
                    "Real comparable sales on the same street",
                    "5 or 10-year price trend by postcode",
                    "Flood risk, planning flags, EPC data",
                    "Pre-offer strategy with fair value range",
                    "Neighbourhood profile — schools, transport, crime",
                    "Export to PDF or share as a link",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-[13px]">
                      <Check className="h-3.5 w-3.5 text-[#C8A96B] shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => {
                    const el = document.querySelector("[data-testid='input-search']") as HTMLInputElement | null;
                    el?.focus();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="bg-[#1F1F1F] hover:bg-[#1F1F1F]/80 text-[#F5F1E8] text-[13px] font-semibold"
                  data-testid="button-try-it"
                >
                  Generate your free brief
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
                <p className="mt-2.5 text-[11px] text-muted-foreground/60">No sign-up required</p>
              </div>

              {/* Right — mock brief card */}
              <div>
                <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-md">

                  {/* Header bar */}
                  <div className="px-5 py-4 border-b border-border/40 bg-[#1F1F1F] flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#F5F1E8]/40">Area Intelligence Brief</p>
                      <p className="font-serif text-[#F5F1E8] text-base mt-0.5 tracking-tight">Chelsea, SW3 1AA</p>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      Good Match
                    </span>
                  </div>

                  <div className="p-5 space-y-5">

                    {/* KPIs */}
                    <div className="grid grid-cols-4 gap-3 pb-4 border-b border-border/40">
                      {[
                        { label: "Median", value: "£1.38M" },
                        { label: "5yr Growth", value: "+24.7%" },
                        { label: "Avg DOM", value: "43 days" },
                        { label: "Supply", value: "Tight" },
                      ].map((kpi) => (
                        <div key={kpi.label}>
                          <p className="text-[10px] text-muted-foreground mb-0.5">{kpi.label}</p>
                          <p className="font-serif text-sm text-foreground">{kpi.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Glance grid */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B] mb-2.5">At a Glance</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { icon: Train, label: "Transport", value: "South Kensington · 4 min" },
                          { icon: GraduationCap, label: "Schools", value: "4 Outstanding within 0.5mi" },
                          { icon: TreePine, label: "Green space", value: "Ranelagh Gardens · 3 min" },
                          { icon: Shield, label: "Crime", value: "Low · Royal Borough K&C" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40">
                            <item.icon className="h-3.5 w-3.5 text-[#C8A96B] mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground">{item.label}</p>
                              <p className="text-xs font-medium leading-snug mt-0.5 truncate">{item.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Price trend */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B] mb-2.5">5-Year Price Trend</p>
                      <div className="space-y-1.5">
                        {[
                          { year: "2021", price: "£1,168,000", pct: "—", w: "64%" },
                          { year: "2022", price: "£1,241,000", pct: "+6.3%", w: "69%" },
                          { year: "2023", price: "£1,310,000", pct: "+5.6%", w: "74%" },
                          { year: "2024", price: "£1,379,000", pct: "+5.3%", w: "79%" },
                          { year: "2025", price: "£1,451,000", pct: "+5.2%", w: "84%" },
                        ].map((row) => (
                          <div key={row.year} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-8 shrink-0">{row.year}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-[#C8A96B]/50" style={{ width: row.w }} />
                            </div>
                            <span className="font-serif text-foreground w-20 text-right shrink-0">{row.price}</span>
                            <span className={`w-10 text-right shrink-0 ${row.pct === "—" ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"}`}>{row.pct}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Comparables — locked */}
                    <div className="relative">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B] mb-2.5">Comparable Sales</p>
                      <div className="space-y-2 blur-[2.5px] opacity-50 select-none pointer-events-none">
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
                          <Lock className="h-3 w-3 text-[#C8A96B]" />
                          <span className="text-[10px] font-medium">Available in your full brief</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-[10px] text-muted-foreground/50 flex items-center gap-1.5">
                  <Database className="h-3 w-3" />
                  HM Land Registry · EPC Register · data.police.uk · Ofsted · Environment Agency
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── THREE VALUE PILLARS ───────────────────────────────────────── */}
        <section className="py-20 sm:py-24 bg-[#F5F1E8] border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B] mb-4">
              What it's for
            </p>
            <h2 className="font-serif text-[1.7rem] sm:text-[2rem] tracking-tight text-[#1F1F1F] leading-[1.15] mb-14 max-w-xl">
              Spot opportunity and risk in a location — before you commit.
            </h2>

            <div className="grid gap-0 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#1F1F1F]/10">
              {[
                {
                  number: "01",
                  heading: "Area Discovery",
                  body: "Find postcodes that match your criteria before you waste time on viewings. Compare price trajectories, supply levels, and neighbourhood signals across areas side by side.",
                },
                {
                  number: "02",
                  heading: "Fast Due Diligence",
                  body: "Run a full brief on any postcode in under a minute. Comparable sales, flood risk, planning activity, EPC data, Ofsted ratings, crime breakdown — all in one place.",
                },
                {
                  number: "03",
                  heading: "Offer Confidence",
                  body: "Arrive at every negotiation knowing the numbers. Pre-offer strategy, fair value range, opening range, and seller pressure points — structured and ready to act on.",
                },
              ].map((item, i) => (
                <div
                  key={item.number}
                  className={`flex flex-col gap-4 py-8 sm:py-0 ${i === 0 ? "sm:pr-10" : i === 1 ? "sm:px-10" : "sm:pl-10"}`}
                >
                  <span className="font-serif text-[2.5rem] text-[#1F1F1F]/10 leading-none select-none">{item.number}</span>
                  <h3 className="text-[13px] font-semibold text-[#1F1F1F] tracking-tight">{item.heading}</h3>
                  <p className="text-[13px] text-[#1F1F1F]/55 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── WHO IT'S FOR ──────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B] mb-4">
              Who uses it
            </p>
            <h2 className="font-serif text-[1.7rem] sm:text-[2rem] tracking-tight leading-[1.15] mb-12 max-w-lg">
              Built for people making serious property decisions.
            </h2>

            <div className="grid gap-px bg-border/30 sm:grid-cols-2 lg:grid-cols-3 rounded-xl overflow-hidden border border-border/30">
              {[
                {
                  audience: "Investors",
                  description: "Identify areas with momentum before prices move. Compare 10-year trends, rental demand scores, and supply signals across multiple postcodes at once.",
                },
                {
                  audience: "Deal Sourcers",
                  description: "Build your area thesis with real data. Spot undervalued pockets, track planning activity, and present clean evidence to investors and clients.",
                },
                {
                  audience: "Developers",
                  description: "Check planning context, comparable sales, and EPC profile before committing to a site. Understand what's been built, sold, and approved nearby.",
                },
                {
                  audience: "Estate Agents",
                  description: "Generate a structured brief for every listing or valuation appointment. Share with clients as a PDF in one click, branded with your firm's details.",
                },
                {
                  audience: "Buying Agents",
                  description: "Run due-diligence in real time. Pull up a postcode brief in front of a client, compare shortlisted areas side by side, and export the summary.",
                },
                {
                  audience: "Serious Buyers",
                  description: "Understand any area as well as an experienced investor would. Check comparable sales, crime, schools, transport, and risk flags before you offer.",
                },
              ].map((item) => (
                <div
                  key={item.audience}
                  className="flex flex-col gap-3 p-6 bg-card"
                  data-testid={`card-audience-${item.audience.toLowerCase().replace(/[^a-z]/g, "-")}`}
                >
                  <h3 className="text-[13px] font-semibold text-foreground">{item.audience}</h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── DATA SOURCES ──────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 bg-[#1F1F1F] border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-14 lg:grid-cols-[1fr_1.6fr] lg:gap-20 items-start">

              <div className="lg:sticky lg:top-24">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B] mb-4">
                  Data sources
                </p>
                <h2 className="font-serif text-[1.7rem] sm:text-[2rem] tracking-tight text-[#F5F1E8] leading-[1.15] mb-5">
                  Official sources only.
                  <br />
                  No estimates.
                </h2>
                <p className="text-[13px] text-[#F5F1E8]/50 leading-relaxed mb-6">
                  Every number in a LuxProperty brief is sourced from a named official dataset — the same data used by solicitors, surveyors, and planning authorities.
                </p>
                <div className="inline-flex items-center gap-2 text-[11px] text-[#F5F1E8]/40 border border-[#F5F1E8]/10 rounded-lg px-3.5 py-2.5">
                  <Shield className="h-3 w-3 text-[#C8A96B] shrink-0" />
                  LuxProperty AI Ltd · Co. No. 17158079
                </div>
              </div>

              <div className="divide-y divide-[#F5F1E8]/8">
                {[
                  { icon: Database, source: "HM Land Registry", covers: "Price history, comparable sales, postcode-level trends" },
                  { icon: HardDrive, source: "EPC Register", covers: "Energy ratings, property type, construction year" },
                  { icon: AlertTriangle, source: "Environment Agency", covers: "Flood risk zones and surface water mapping" },
                  { icon: Shield, source: "data.police.uk", covers: "Crime statistics and category breakdown" },
                  { icon: GraduationCap, source: "Ofsted", covers: "School ratings and location data" },
                  { icon: Train, source: "OpenStreetMap / TfL", covers: "Transport nodes, stations, walk times" },
                  { icon: Wifi, source: "Ofcom Connected Nations", covers: "Broadband availability and speeds" },
                  { icon: TrendingUp, source: "ONS / VOA", covers: "Rental benchmarks and demand indicators" },
                ].map((item) => (
                  <div key={item.source} className="flex items-start gap-4 py-3.5 first:pt-0 last:pb-0">
                    <item.icon className="h-4 w-4 text-[#C8A96B]/70 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[13px] font-semibold text-[#F5F1E8]">{item.source}</span>
                      <span className="text-[13px] text-[#F5F1E8]/35 ml-2">· {item.covers}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── EXPLORE MARKETS ───────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 border-b border-border/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B] mb-4">
              Explore UK markets
            </p>
            <h2 className="font-serif text-[1.7rem] sm:text-[2rem] tracking-tight leading-[1.15] mb-10">
              Deep-dive guides for key UK areas
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
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-border/40 bg-card hover:border-[#C8A96B]/30 hover:bg-[#C8A96B]/5 transition-colors text-[13px]"
                >
                  <MapPin className="h-3 w-3 text-[#C8A96B] shrink-0" />
                  <span className="font-semibold">{area.code}</span>
                  <span className="text-muted-foreground text-xs">{area.label}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PRICING ───────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 bg-[#F5F1E8]" id="pricing">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B] mb-4">
              Pricing
            </p>
            <h2 className="font-serif text-[1.7rem] sm:text-[2rem] tracking-tight text-[#1F1F1F] leading-[1.15] mb-3">
              Professional is what most buyers need.
            </h2>
            <p className="text-[13px] text-[#1F1F1F]/50 mb-12 max-w-md">
              Start free. Upgrade when you need comparable sales, pre-offer strategy, and PDF export.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  name: "Explorer",
                  price: "Free",
                  period: "",
                  highlight: false,
                  description: "3 briefs per month. Area profile, 1-year price trend, neighbourhood overview.",
                  features: [
                    "3 briefs per month",
                    "1-year price trend",
                    "Neighbourhood profile",
                    "Flood risk & council tax",
                    "Good fit / Mixed / Limited verdict",
                  ],
                  cta: "Start Free",
                  stripeUrl: null,
                },
                {
                  name: "Professional",
                  price: "£4.99",
                  period: "/month",
                  highlight: true,
                  description: "Unlimited briefs. Comparable sales, 5-year trend, pre-offer strategy, PDF export.",
                  features: [
                    "Unlimited briefs",
                    "5-year price trend",
                    "Comparable sales & valuation range",
                    "Pre-offer strategy & opening range",
                    "Planning activity & crime breakdown",
                    "Air quality, broadband, rental data",
                    "Export to PDF",
                  ],
                  cta: "Start Professional",
                  stripeUrl: "https://buy.stripe.com/7sY8wRe7s9yM7ug8gI6Na00",
                },
                {
                  name: "Investor",
                  price: "£39.99",
                  period: "/month",
                  highlight: false,
                  description: "10-year trends, rental demand scores, sold prices map, and portfolio dashboard.",
                  features: [
                    "Everything in Professional",
                    "10-year price trend",
                    "Rental demand score",
                    "Sold prices map",
                    "Portfolio dashboard",
                    "Custom report branding",
                  ],
                  cta: "Start Investor",
                  stripeUrl: "https://buy.stripe.com/8x200l2oKdP229WfJa6Na01",
                },
              ].map((tier) => (
                <div
                  key={tier.name}
                  className={`relative flex flex-col p-6 rounded-xl border ${
                    tier.highlight
                      ? "border-[#1F1F1F]/20 bg-[#1F1F1F]"
                      : "border-[#1F1F1F]/10 bg-white/60"
                  }`}
                  data-testid={`card-pricing-${tier.name.toLowerCase()}`}
                >
                  {tier.highlight && (
                    <span className="absolute -top-px left-6 text-[10px] font-semibold uppercase tracking-[0.18em] bg-[#C8A96B] text-[#1F1F1F] px-2.5 py-0.5 rounded-b-md">
                      Most Popular
                    </span>
                  )}
                  <h3 className={`text-[13px] font-semibold mb-3 ${tier.highlight ? "text-[#F5F1E8]" : "text-[#1F1F1F]"}`}>
                    {tier.name}
                  </h3>
                  <div className="mb-1">
                    <span className={`font-serif text-3xl tracking-tight ${tier.highlight ? "text-[#F5F1E8]" : "text-[#1F1F1F]"}`}>
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span className={`text-sm ml-0.5 ${tier.highlight ? "text-[#F5F1E8]/50" : "text-[#1F1F1F]/50"}`}>
                        {tier.period}
                      </span>
                    )}
                  </div>
                  <p className={`text-[12px] mb-5 leading-relaxed ${tier.highlight ? "text-[#F5F1E8]/50" : "text-[#1F1F1F]/50"}`}>
                    {tier.description}
                  </p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px]">
                        <Check className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${tier.highlight ? "text-[#C8A96B]" : "text-[#C8A96B]"}`} />
                        <span className={tier.highlight ? "text-[#F5F1E8]/70" : "text-[#1F1F1F]/65"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`w-full text-[13px] font-semibold py-2.5 rounded-lg transition-colors ${
                      tier.highlight
                        ? "bg-[#C8A96B] hover:bg-[#b8985e] text-[#1F1F1F]"
                        : "bg-[#1F1F1F]/8 hover:bg-[#1F1F1F]/12 text-[#1F1F1F] border border-[#1F1F1F]/10"
                    }`}
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
                  </button>
                </div>
              ))}
            </div>

            <p className="mt-7 text-center text-[11px] text-[#1F1F1F]/40">
              No credit card required to start · Cancel anytime
            </p>
          </div>
        </section>

        {/* ─── BOTTOM CTA ────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 bg-[#1F1F1F]">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B] mb-5">
              Start now
            </p>
            <h2 className="font-serif text-[2rem] sm:text-[2.5rem] tracking-tight text-[#F5F1E8] leading-[1.12] mb-5 max-w-xl mx-auto">
              Run your first brief in under a minute.
            </h2>
            <p className="text-[14px] text-[#F5F1E8]/45 mb-9 max-w-sm mx-auto">
              Free to try. Any UK postcode. No account required.
            </p>
            <button
              onClick={() => {
                const el = document.querySelector("[data-testid='input-search']") as HTMLInputElement | null;
                el?.focus();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 bg-[#C8A96B] hover:bg-[#b8985e] text-[#1F1F1F] text-[13px] font-semibold px-7 py-3 rounded-lg transition-colors"
              data-testid="button-bottom-cta"
            >
              Generate a Free Brief
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-4 text-[11px] text-[#F5F1E8]/25">
              England &amp; Wales · Built on official data · LuxProperty AI Ltd
            </p>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
