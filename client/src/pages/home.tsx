import { useState } from "react";
import { useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useMutation } from "@tanstack/react-query";
import { generateBrief } from "@/lib/mockEngine";
import { getUser } from "@/lib/authStore";
import { useCheckout } from "@/hooks/use-checkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { GenerateLoadingScreen } from "@/components/generate-loading-screen";
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
  MapPin,
  HardDrive,
  Wifi,
  ChevronRight,
} from "lucide-react";
import type { BriefReport } from "@shared/schema";
import { validatePostcodeInput } from "@/lib/postcodeValidation";

export default function Home() {
  useDocumentTitle("", "AI-powered property intelligence for UK buyers. Enter any postcode or address and get a complete buyer intelligence brief in 60 seconds — built on official HM Land Registry data.");
  const [query, setQuery] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { startCheckout, authModal } = useCheckout();

  const generateBriefMutation = useMutation({
    mutationFn: async (q: string) => {
      const callerPlan = getUser()?.plan;
      return (await generateBrief(q, callerPlan)) as BriefReport;
    },
    onSuccess: (data) => {
      navigate(`/brief/${data.id}`);
    },
    // Keep the typed query in the field and surface a message — do not clear input
    onError: (err: unknown) => {
      // Errors are logged in generateBrief; query state is untouched.
      // The error message is rendered via generateBriefMutation.error below.
      void err; // suppress lint unused-var warning
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const trimmed = query.trim();
    if (!trimmed) return;
    const check = validatePostcodeInput(trimmed);
    if (!check.valid) {
      setValidationError(check.reason);
      return;
    }
    navigate(`/brief/${encodeURIComponent(trimmed)}`);
  };

  // While a brief is generating, show the loading screen (skeleton + timer) in
  // place of the home page. On success the mutation navigates to the brief; on
  // error this unmounts and the form (with its error message) renders again.
  // This changes ONLY what shows during generation — the finished brief is
  // rendered by the brief page, entirely unaffected.
  if (generateBriefMutation.isPending) {
    return <GenerateLoadingScreen />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {authModal}
      <Header />

      <main className="flex-1">

        {/* ─── HERO ──────────────────────────────────────────────────────── */}
        {/* Two-column: left = copy + search, right = mini brief preview above the fold */}
        <section className="relative overflow-hidden border-b border-border/50">
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-center">

              {/* Left — headline + search */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary mb-6">
                  Full Buyer Intelligence Brief
                </p>
                <h1
                  className="font-serif text-[2.4rem] sm:text-[3rem] leading-[1.07] tracking-tight text-foreground"
                  data-testid="text-hero-heading"
                >
                  Know what you're buying into.
                  <br />
                  <em className="text-primary not-italic">Before you offer.</em>
                </h1>
                <p className="mt-5 text-[15px] text-foreground/60 leading-relaxed max-w-[440px]">
                  See crime rates, school ratings, price trends and risks for any UK postcode — no sign-up needed for your first brief. Built on HM Land Registry, police.uk, Ofsted and the Environment Agency. No AI estimates. No portal prices.
                </p>

                <form
                  onSubmit={handleSubmit}
                  className="mt-8 flex flex-col gap-2.5"
                  data-testid="form-search"
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/30" />
                    <Input
                      type="text"
                      placeholder="SW3 1AA, LS6 2EX, RG1 2AB…"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      className="pl-11 h-12 text-[15px] bg-card border-border"
                      data-testid="input-search"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={!query.trim() || generateBriefMutation.isPending}
                    className="h-12 px-6 text-[13px] font-semibold tracking-wide shrink-0"
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
                      <>Generate Free Brief <ArrowRight className="ml-1.5 h-4 w-4" /></>
                    )}
                  </Button>
                </form>

                {validationError && (
                  <p className="mt-3 text-sm text-destructive" data-testid="text-validation-error">
                    {validationError}
                  </p>
                )}
                {!validationError && generateBriefMutation.isError && (
                  <p className="mt-3 text-sm text-destructive" data-testid="text-error">
                    {(() => {
                      const msg = generateBriefMutation.error instanceof Error
                        ? generateBriefMutation.error.message
                        : "";
                      if (msg === "NETWORK_ERROR")
                        return "Network error — check your connection and try again.";
                      if (msg === "TIMEOUT_ERROR")
                        return "The request timed out. Please try again.";
                      return "Something went wrong generating the brief. Please try again.";
                    })()}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  {[
                    { icon: Database, text: "HM Land Registry data" },
                    { icon: Shield, text: "Official sources only" },
                    { icon: MapPin, text: "All England & Wales postcodes" },
                  ].map((b) => (
                    <span key={b.text} className="flex items-center gap-1.5 text-[11px] text-foreground/40">
                      <b.icon className="h-3 w-3 text-primary/60" />
                      {b.text}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-foreground/30">
                  Free to try · No card required · Official data only · Trusted by UK buyers, advisers &amp; investors
                </p>
              </div>

              {/* Right — compact brief preview card, visible above the fold */}
              <div className="hidden lg:block">
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  {/* Card header */}
                  <div className="px-4 py-3.5 border-b border-border/60 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Intelligence Brief</p>
                      <p className="font-serif text-foreground text-[15px] mt-0.5">Chelsea, SW3 1AA</p>
                    </div>
                    <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      Good Match
                    </span>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* KPI row */}
                    <div className="grid grid-cols-4 gap-2 pb-3.5 border-b border-border/40">
                      {[
                        { l: "Median", v: "£1.38M" },
                        { l: "5yr Growth", v: "+24.7%" },
                        { l: "Days on Mkt", v: "43" },
                        { l: "Supply", v: "Tight" },
                      ].map((k) => (
                        <div key={k.l}>
                          <p className="text-[9px] text-muted-foreground mb-0.5">{k.l}</p>
                          <p className="font-serif text-[13px] text-foreground">{k.v}</p>
                        </div>
                      ))}
                    </div>

                    {/* Neighbourhood pills */}
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-primary mb-2">Neighbourhood</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { icon: Train, v: "South Kensington · 4 min" },
                          { icon: GraduationCap, v: "4 Outstanding schools" },
                          { icon: TreePine, v: "Ranelagh Gardens" },
                          { icon: Shield, v: "Low crime area" },
                        ].map((n) => (
                          <div key={n.v} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/50 text-[10px]">
                            <n.icon className="h-3 w-3 text-primary shrink-0" />
                            <span className="text-foreground/70 truncate">{n.v}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mini price trend */}
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-primary mb-2">Price Trend</p>
                      <div className="space-y-1">
                        {[
                          { y: "2023", v: "£1,310,000", w: "74%" },
                          { y: "2024", v: "£1,379,000", w: "79%" },
                          { y: "2025", v: "£1,451,000", w: "84%" },
                        ].map((r) => (
                          <div key={r.y} className="flex items-center gap-2 text-[10px]">
                            <span className="text-muted-foreground w-7 shrink-0">{r.y}</span>
                            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary/50" style={{ width: r.w }} />
                            </div>
                            <span className="font-serif text-foreground w-[72px] text-right shrink-0">{r.v}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Locked row */}
                    <div className="relative rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Comparable sales · Pre-offer strategy · Fair value range</span>
                      <Lock className="h-3 w-3 text-primary/50 shrink-0" />
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[9px] text-muted-foreground/40 text-right">
                  Sample · Actual briefs use live data
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ─── STATS STRIP ───────────────────────────────────────────────── */}
        <section className="border-b border-border/50 bg-muted/40">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { value: "18M+", label: "Land Registry transactions analysed" },
                { value: "100%", label: "England & Wales postcode coverage" },
                { value: "Official only", label: "No AI estimates — real registered data" },
                { value: "< 60s", label: "Full brief generation time" },
              ].map((stat) => (
                <div key={stat.label} className="sm:text-center">
                  <p className="font-serif text-xl sm:text-2xl text-foreground">{stat.value}</p>
                  <p className="text-[11px] text-foreground/45 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ─── SOCIAL PROOF STRIP ───────────────────────────────────────── */}
        <section className="py-10 sm:py-12 border-b border-border/50">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-6 sm:text-center">
              Used by UK buyers, advisers and investors doing proper due diligence
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  quote: "Spotted two live planning applications on the street I would never have caught on Rightmove. Used it to negotiate £12k off.",
                  name: "UK homebuyer",
                  location: "South East England",
                },
                {
                  quote: "I pull up the brief in front of clients at the first meeting. Saves me an hour of prep — and they trust the numbers before I say a word.",
                  name: "Buying agent",
                  location: "London",
                },
                {
                  quote: "The comparable sales section alone justified it. I knew exactly what fair value was before I spoke to the vendor.",
                  name: "Property investor",
                  location: "Midlands",
                },
              ].map(({ quote, name, location }) => (
                <div key={name} className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card p-5">
                  <p className="text-[13px] text-foreground/70 leading-relaxed italic">"{quote}"</p>
                  <div className="mt-auto">
                    <p className="text-[11px] font-semibold text-foreground">{name}</p>
                    <p className="text-[10px] text-muted-foreground">{location}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── WHAT IT'S FOR (Value Pillars) ─────────────────────────────── */}
        <section className="py-20 sm:py-24 border-b border-border/50">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mb-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary mb-3">
                What it's for
              </p>
              <h2 className="font-serif text-[1.75rem] sm:text-[2.1rem] tracking-tight text-foreground leading-[1.13] max-w-lg">
                Stop guessing. Start with the numbers.
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40">
              {[
                {
                  number: "01",
                  heading: "Avoid Overpaying",
                  body: "See what properties on that street actually sold for — registered prices from HM Land Registry, not what agents are asking. Know the fair value range before you negotiate.",
                },
                {
                  number: "02",
                  heading: "Spot Risks Early",
                  body: "Every brief surfaces flood risk, active planning applications, crime rates and school ratings. Catch the issues that cost you money after exchange — not after you've committed.",
                },
                {
                  number: "03",
                  heading: "Negotiate With Numbers",
                  body: "Your brief includes a pre-offer strategy: a fair value range, an opening offer figure, and seller pressure points. Walk into every negotiation with numbers, not instinct.",
                },
              ].map((item) => (
                <div key={item.number} className="flex flex-col gap-4 p-7 bg-card">
                  <span className="font-serif text-[2.2rem] text-primary/20 leading-none select-none tabular-nums">
                    {item.number}
                  </span>
                  <div>
                    <h3 className="text-[13px] font-semibold text-foreground mb-2">{item.heading}</h3>
                    <p className="text-[13px] text-foreground/55 leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FULL BRIEF PREVIEW ────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 border-b border-border/50 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-14 lg:grid-cols-[1fr_1.35fr] lg:gap-16 items-start">

              {/* Left */}
              <div className="lg:sticky lg:top-24">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary mb-4">
                  Everything in one brief
                </p>
                <h2 className="font-serif text-[1.75rem] sm:text-[2rem] tracking-tight leading-[1.13] text-foreground mb-4">
                  Everything you'd spend half a day finding — in 60 seconds.
                </h2>
                <p className="text-[13px] text-foreground/55 leading-relaxed mb-7">
                  Rightmove, Land Registry, police.uk, Ofsted, Ofcom, Environment Agency — your brief pulls from all of them automatically, cites every source, and presents the analysis you'd otherwise spend half a day assembling.
                </p>
                <ul className="space-y-2.5 mb-8">
                  {[
                    "What properties on that street actually sold for",
                    "5 or 10-year registered price trend by postcode",
                    "Flood risk, active planning applications, EPC ratings",
                    "Pre-offer strategy — fair value range and opening offer",
                    "Crime breakdown, school ratings, transport and broadband",
                    "Export to PDF — client-ready in one click",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-[13px]">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-foreground/65">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => {
                    const el = document.querySelector("[data-testid='input-search']") as HTMLInputElement | null;
                    el?.focus();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="text-[13px] font-semibold"
                  data-testid="button-try-it"
                >
                  Generate a free brief
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
                <p className="mt-2.5 text-[11px] text-foreground/35">Free · No card · No account required</p>
              </div>

              {/* Right — full mock brief */}
              <div>
                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Area Intelligence Brief</p>
                      <p className="font-serif text-foreground text-[15px] mt-0.5 tracking-tight">Chelsea, SW3 1AA</p>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      Good Match
                    </span>
                  </div>

                  <div className="p-5 space-y-5">
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

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-2.5">At a Glance</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { icon: Train, label: "Transport", value: "South Kensington · 4 min" },
                          { icon: GraduationCap, label: "Schools", value: "4 Outstanding within 0.5mi" },
                          { icon: TreePine, label: "Green space", value: "Ranelagh Gardens · 3 min" },
                          { icon: Shield, label: "Crime", value: "Low · Royal Borough K&C" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-start gap-2 p-2.5 rounded-md bg-muted/50">
                            <item.icon className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[9px] text-muted-foreground">{item.label}</p>
                              <p className="text-[11px] font-medium leading-snug mt-0.5 truncate text-foreground/80">{item.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-2.5">5-Year Price Trend</p>
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
                              <div className="h-full rounded-full bg-primary/45" style={{ width: row.w }} />
                            </div>
                            <span className="font-serif text-foreground w-20 text-right shrink-0">{row.price}</span>
                            <span className={`w-10 text-right shrink-0 ${row.pct === "—" ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"}`}>{row.pct}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-2.5">Comparable Sales</p>
                      <div className="space-y-2 blur-[2.5px] opacity-40 select-none pointer-events-none">
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
                        <div className="flex items-center gap-1.5 bg-background/95 border border-border px-3 py-1.5 rounded-full shadow-sm">
                          <Lock className="h-3 w-3 text-primary" />
                          <span className="text-[10px] font-medium text-foreground/70">Available in your full brief</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-[10px] text-foreground/35 flex items-center gap-1.5">
                  <Database className="h-3 w-3 text-primary/40" />
                  HM Land Registry · EPC Register · data.police.uk · Ofsted · Environment Agency
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── WHO IT'S FOR ──────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 border-b border-border/50">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mb-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary mb-3">
                Who uses it
              </p>
              <h2 className="font-serif text-[1.75rem] sm:text-[2.1rem] tracking-tight text-foreground leading-[1.13] max-w-lg">
                For anyone who can't afford to get it wrong.
              </h2>
            </div>

            {/* 2-column list — cleaner and more focused than the card grid */}
            <div className="grid sm:grid-cols-2 gap-x-14 gap-y-0 divide-y divide-border/40 sm:divide-y-0">
              <div className="divide-y divide-border/40">
                {[
                  {
                    audience: "Investors",
                    description: "Track which areas are gaining momentum, not just which ones have already moved. 10-year price trends, rental demand scores, and sold-price data across multiple postcodes at once.",
                  },
                  {
                    audience: "Deal Sourcers",
                    description: "Back your area thesis with real registered data. Spot pockets where prices are lagging comparable streets, track planning pipeline, and share a clean PDF brief with clients.",
                  },
                  {
                    audience: "Developers",
                    description: "Check planning context, EPC profile, and recent comps before committing to a site. Know what's been built, sold, and approved nearby — before you instruct solicitors.",
                  },
                ].map((item) => (
                  <div
                    key={item.audience}
                    className="py-5 first:pt-0"
                    data-testid={`card-audience-${item.audience.toLowerCase().replace(/[^a-z]/g, "-")}`}
                  >
                    <h3 className="text-[13px] font-semibold text-foreground mb-1.5">{item.audience}</h3>
                    <p className="text-[13px] text-foreground/55 leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
              <div className="divide-y divide-border/40">
                {[
                  {
                    audience: "Estate & Buying Agents",
                    description: "Walk into every valuation with a structured data brief. Pull up live comparables in front of a client. Share a professional PDF in one click — no manual research required.",
                  },
                  {
                    audience: "Mortgage Advisers",
                    description: "Set accurate expectations before the loan discussion. Share a comparable sales snapshot and fair value range at the first meeting — grounded in registered data, not estimates.",
                  },
                  {
                    audience: "Serious Buyers",
                    description: "Know what comparable properties actually sold for, what risk flags exist, and what a fair opening offer looks like — before you commit to a viewing, let alone an offer.",
                  },
                ].map((item) => (
                  <div
                    key={item.audience}
                    className="py-5 first:pt-0 sm:first:pt-0"
                    data-testid={`card-audience-${item.audience.toLowerCase().replace(/[^a-z]/g, "-")}`}
                  >
                    <h3 className="text-[13px] font-semibold text-foreground mb-1.5">{item.audience}</h3>
                    <p className="text-[13px] text-foreground/55 leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>


        {/* ─── MID-PAGE CTA ──────────────────────────────────────────────── */}
        <section className="py-12 sm:py-14 border-b border-border/50 bg-primary/5">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <h2 className="font-serif text-[1.4rem] sm:text-[1.6rem] tracking-tight text-foreground leading-[1.15]">
                Get your free postcode brief — no sign-up needed.
              </h2>
              <p className="text-[13px] text-foreground/50 mt-1">
                Free to try. No card. No account required.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Button
                size="lg"
                className="text-[13px] font-semibold px-7"
                data-testid="button-midpage-cta"
                onClick={() => {
                  const el = document.querySelector("[data-testid='input-search']") as HTMLInputElement | null;
                  el?.focus();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Generate a free brief
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-[13px] font-semibold px-7"
                data-testid="button-midpage-professional"
                onClick={() => startCheckout("https://buy.stripe.com/7sY8wRe7s9yM7ug8gI6Na00?success_url=https%3A%2F%2Fwww.luxproperty.ai%2Fsuccess%3Fplan%3Dprofessional")}
              >
                Start Professional — £4.99/month
              </Button>
            </div>
          </div>
        </section>

        {/* ─── DATA SOURCES ──────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 border-b border-border/50 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-14 lg:grid-cols-[1fr_1.6fr] lg:gap-16 items-start">

              <div className="lg:sticky lg:top-24">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary mb-4">
                  Data sources
                </p>
                <h2 className="font-serif text-[1.75rem] sm:text-[2rem] tracking-tight text-foreground leading-[1.13] mb-5">
                  Built on official data.
                  <br />Not estimates.
                </h2>
                <p className="text-[13px] text-foreground/55 leading-relaxed mb-6">
                  Every figure in your brief is drawn from a named official register. We don't generate AI estimates or pull from portals. If a number appears in your brief, it came from a verifiable public dataset — and we cite it.
                </p>
                <div className="inline-flex items-center gap-2 text-[11px] text-foreground/50 border border-border/60 rounded-lg px-3.5 py-2.5 bg-card mb-5">
                  <Shield className="h-3 w-3 text-primary shrink-0" />
                  LuxProperty AI Ltd · Co. No. 17158079
                </div>
                <p className="text-[12px] text-foreground/45 leading-relaxed max-w-xs">
                  Enter any UK postcode to see the full data brief for yourself.
                </p>
              </div>

              <div className="divide-y divide-border/50">
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
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <span className="text-[13px] font-semibold text-foreground">{item.source}</span>
                      <span className="text-[13px] text-foreground/45 ml-2">· {item.covers}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── EXPLORE MARKETS ───────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 border-b border-border/50">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary mb-3">
                  Explore UK markets
                </p>
                <h2 className="font-serif text-[1.75rem] sm:text-[2.1rem] tracking-tight text-foreground leading-[1.13]">
                  Area market guides
                </h2>
              </div>
              <p className="text-[13px] text-foreground/45 max-w-xs sm:text-right">
                Prices, rental demand, planning pipeline and local profile for key UK postcode districts. A faster starting point than a manual Rightmove search.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {[
                { code: "SW3", label: "Chelsea", region: "London" },
                { code: "E8", label: "Hackney", region: "London" },
                { code: "W11", label: "Notting Hill", region: "London" },
                { code: "N1", label: "Islington", region: "London" },
                { code: "SE1", label: "London Bridge", region: "London" },
                { code: "M1", label: "Manchester", region: "North West" },
                { code: "B1", label: "Birmingham", region: "Midlands" },
                { code: "LS1", label: "Leeds", region: "Yorkshire" },
                { code: "BS1", label: "Bristol", region: "South West" },
                { code: "RG1", label: "Reading", region: "Berkshire" },
                { code: "OX1", label: "Oxford", region: "Oxfordshire" },
                { code: "CB1", label: "Cambridge", region: "Cambridgeshire" },
              ].map((area) => (
                <a
                  key={area.code}
                  href={`/area/${area.code}`}
                  className="group flex flex-col gap-0.5 px-3.5 py-3 rounded-lg border border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">{area.code}</span>
                    <ChevronRight className="h-3 w-3 text-foreground/20 group-hover:text-primary/50 transition-colors" />
                  </div>
                  <span className="text-[11px] text-foreground/45">{area.label}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ─── MORE TOOLS ────────────────────────────────────────────────── */}
        <section className="py-12 sm:py-14 border-b border-border/50 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary mb-6">
              More tools
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <a href="/valuation" className="group flex items-start gap-4 p-5 rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <div className="mt-0.5 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors mb-1">Property Valuation</h3>
                  <p className="text-[12px] text-foreground/50 leading-relaxed">Instant valuation estimate for any UK address. Built on HM Land Registry Price Paid Data.</p>
                </div>
              </a>
              <a href="/compare" className="group flex items-start gap-4 p-5 rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <div className="mt-0.5 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors mb-1">Compare Postcodes</h3>
                  <p className="text-[12px] text-foreground/50 leading-relaxed">Side-by-side analysis of two UK postcodes — prices, crime, schools, transport, and flood risk.</p>
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* ─── PRICING ───────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 bg-muted/20" id="pricing">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary mb-3">
              Pricing
            </p>
            <h2 className="font-serif text-[1.75rem] sm:text-[2.1rem] tracking-tight text-foreground leading-[1.13] mb-2">
              Professional is what most buyers need.
            </h2>
            <p className="text-[13px] text-foreground/50 mb-6 max-w-md">
              Start free. Upgrade for comparable sales, pre-offer strategy and PDF export.
            </p>
            <div className="flex items-center gap-2 text-[12px] text-primary font-semibold mb-10 bg-primary/5 border border-primary/20 rounded-lg px-3.5 py-2.5 max-w-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a4 4 0 00-4-4H5.45M12 8V6a4 4 0 014-4h2.55M4 12h16" /></svg>
              First full Investor brief free when you subscribe to Professional
            </div>

            {/* Cards: Explorer and Investor sit slightly lower visually */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:items-end">
              {/* Explorer */}
              <div
                className="flex flex-col p-5 rounded-xl border border-border/50 bg-card"
                data-testid="card-pricing-explorer"
              >
                <h3 className="text-[12px] font-semibold text-foreground/70 uppercase tracking-[0.1em] mb-4">Explorer</h3>
                <div className="mb-1">
                  <span className="font-serif text-2xl tracking-tight text-foreground">Free</span>
                </div>
                <p className="text-[11px] text-foreground/40 mb-5 leading-relaxed">3 briefs/month. Good for a quick sense-check before you book a viewing.</p>
                <ul className="space-y-1.5 mb-6 flex-1">
                  {[
                    "3 briefs per month",
                    "1-year price trend",
                    "Neighbourhood profile",
                    "Flood risk & council tax",
                    "Good / Mixed / Limited verdict",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12px]">
                      <Check className="h-3 w-3 text-primary/60 mt-0.5 shrink-0" />
                      <span className="text-foreground/55">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="w-full text-[12px] font-semibold border-border/60 text-foreground/60 hover:text-foreground"
                  data-testid="button-pricing-explorer"
                  onClick={() => {
                    const el = document.querySelector("[data-testid='input-search']") as HTMLInputElement | null;
                    el?.focus();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Start Free
                </Button>
              </div>

              {/* Professional — elevated */}
              <div
                className="relative flex flex-col p-6 rounded-xl border border-primary/30 bg-card shadow-md ring-1 ring-primary/15 sm:-mt-4"
                data-testid="card-pricing-professional"
              >
                <span className="absolute -top-px left-5 text-[10px] font-semibold uppercase tracking-[0.16em] bg-primary text-primary-foreground px-2.5 py-0.5 rounded-b-md">
                  Most Popular
                </span>
                <h3 className="text-[13px] font-semibold text-foreground mb-4">Professional</h3>
                <div className="mb-1">
                  <span className="font-serif text-3xl tracking-tight text-foreground">£4.99</span>
                  <span className="text-sm text-foreground/40 ml-0.5">/month</span>
                </div>
                <p className="text-[12px] text-foreground/50 mb-5 leading-relaxed">
                  The full brief before you make an offer. Comparable sales, pre-offer strategy, 5-year price history, and PDF export.
                </p>
                <ul className="space-y-2 mb-7 flex-1">
                  {[
                    "Unlimited briefs",
                    "5-year price trend",
                    "Comparable sales & valuation range",
                    "Pre-offer strategy & opening range",
                    "Planning activity & crime breakdown",
                    "Air quality, broadband, rental data",
                    "Export to PDF",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px]">
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <span className="text-foreground/70">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full text-[13px] font-semibold"
                  data-testid="button-pricing-professional"
                  onClick={() => startCheckout("https://buy.stripe.com/7sY8wRe7s9yM7ug8gI6Na00?success_url=https%3A%2F%2Fwww.luxproperty.ai%2Fsuccess%3Fplan%3Dprofessional")}
                >
                  Get Professional — £4.99/month
                </Button>
                <p className="mt-2 text-[10px] text-foreground/30 text-center">Cancel anytime · No minimum term</p>
              </div>

              {/* Investor */}
              <div
                className="flex flex-col p-5 rounded-xl border border-border/50 bg-card"
                data-testid="card-pricing-investor"
              >
                <h3 className="text-[12px] font-semibold text-foreground/70 uppercase tracking-[0.1em] mb-4">Investor</h3>
                <div className="mb-1">
                  <span className="font-serif text-2xl tracking-tight text-foreground">£39.99</span>
                  <span className="text-[11px] text-foreground/40 ml-0.5">/month</span>
                </div>
                <p className="text-[11px] text-foreground/40 mb-5 leading-relaxed">
                  For investors running due diligence across a shortlist. 10-year trends, rental demand scores, sold prices map, portfolio dashboard.
                </p>
                <ul className="space-y-1.5 mb-6 flex-1">
                  {[
                    "Everything in Professional",
                    "10-year price trend",
                    "Rental demand score",
                    "Sold prices map",
                    "Portfolio dashboard",
                    "Custom report branding",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12px]">
                      <Check className="h-3 w-3 text-primary/60 mt-0.5 shrink-0" />
                      <span className="text-foreground/55">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="w-full text-[12px] font-semibold border-border/60 text-foreground/60 hover:text-foreground"
                  data-testid="button-pricing-investor"
                  onClick={() => startCheckout("https://buy.stripe.com/8x200l2oKdP229WfJa6Na01?success_url=https%3A%2F%2Fwww.luxproperty.ai%2Fsuccess%3Fplan%3Dinvestor")}
                >
                  Start Investor
                </Button>
              </div>
            </div>

            <p className="mt-6 text-center text-[11px] text-foreground/35">
              No card required to start · Cancel anytime · No minimum term
            </p>
          </div>
        </section>

        {/* ─── BOTTOM CTA ────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24 border-t border-border/50">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary mb-5">
              Start now
            </p>
            <h2 className="font-serif text-[2rem] sm:text-[2.4rem] tracking-tight text-foreground leading-[1.1] mb-4 max-w-lg mx-auto">
              Know what you're buying into. Before you offer.
            </h2>
            <p className="text-[14px] text-foreground/45 mb-9 max-w-xs mx-auto leading-relaxed">
              Free to try. Any UK postcode. No account required.
            </p>
            <Button
              size="lg"
              onClick={() => {
                const el = document.querySelector("[data-testid='input-search']") as HTMLInputElement | null;
                el?.focus();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-[13px] font-semibold px-8"
              data-testid="button-bottom-cta"
            >
              Generate a Free Brief
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="mt-4 text-[11px] text-foreground/30">
              England &amp; Wales · 18M+ Land Registry transactions · Built on official data only
            </p>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
