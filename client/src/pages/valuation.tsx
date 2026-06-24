/**
 * valuation.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Property Valuation page — /valuation
 *
 * Every number shown here comes from a real data source via valuationEngine.ts.
 * No invented values. No silent fallbacks to demo data.
 * Modules that fail to load show a transparent unavailable state, not zeroes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/hooks/use-auth";
import { postcodeToOutcode, type PlanTier } from "@/lib/postcodeUtils";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Lock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Home,
  ArrowRight,
  ChevronRight,
  Info,
  AlertTriangle,
  MapPin,
  Building,
  Scale,
  Zap,
  Clock,
  WifiOff,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  runValuation,
  calculateSdlt,
  type ValuationReport,
  type FreshnessStatus,
  type ModuleMetadata,
} from "@/lib/valuationEngine";
import { DATA_SOURCES } from "@/lib/valuationSources";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "£" + n.toLocaleString("en-GB");
}

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMonthYear(yyyyMM: string) {
  const [y, m] = yyyyMM.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// ─── Freshness badge ──────────────────────────────────────────────────────────

function FreshnessBadge({ status }: { status: FreshnessStatus }) {
  if (status === "fresh") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" /> Up to date
      </span>
    );
  }
  if (status === "delayed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
        <Clock className="h-3 w-3" /> Delayed data
      </span>
    );
  }
  if (status === "stale") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
        <AlertTriangle className="h-3 w-3" /> Stale data
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
      <WifiOff className="h-3 w-3" /> Unavailable
    </span>
  );
}

// ─── Source attribution ───────────────────────────────────────────────────────

function SourceLine({ meta }: { meta: ModuleMetadata }) {
  const source = DATA_SOURCES[meta.sourceId];
  return (
    <p className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
      <FreshnessBadge status={meta.freshnessStatus} />
      <span className="text-muted-foreground/50">·</span>
      {source && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 hover:underline hover:text-foreground transition-colors"
        >
          {source.displayName} <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
      {meta.publishedAt && (
        <>
          <span className="text-muted-foreground/50">·</span>
          <span>Published {fmtDate(meta.publishedAt)}</span>
        </>
      )}
    </p>
  );
}

// ─── Unavailable module state ─────────────────────────────────────────────────

function UnavailableModule({ meta, label }: { meta: ModuleMetadata; label: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 text-center">
      <WifiOff className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
      <p className="text-sm font-medium text-muted-foreground mb-1">{label} unavailable</p>
      <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">{meta.caveatText}</p>
    </div>
  );
}

// ─── Price trend SVG chart ────────────────────────────────────────────────────

function PriceTrendChart({
  data,
}: {
  data: { month: string; averagePrice: number }[];
}) {
  if (!data.length) return null;
  const prices = data.map((d) => d.averagePrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const W = 600;
  const H = 120;
  const PAD = { t: 16, r: 8, b: 28, l: 8 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;
  const step = data.length > 1 ? cW / (data.length - 1) : cW;

  const points = data.map((d, i) => ({
    x: PAD.l + i * step,
    y: PAD.t + cH - ((d.averagePrice - min) / range) * cH,
    label: fmtMonthYear(d.month),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const fillD = `${pathD} L ${points[points.length - 1].x} ${H - PAD.b} L ${PAD.l} ${H - PAD.b} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-label="Area price trend chart">
      <defs>
        <linearGradient id="val-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => (
        <line
          key={t}
          x1={PAD.l}
          x2={W - PAD.r}
          y1={PAD.t + cH * (1 - t)}
          y2={PAD.t + cH * (1 - t)}
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />
      ))}
      <path d={fillD} fill="url(#val-fill)" />
      <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) =>
        i % 2 === 0 ? (
          <text key={i} x={p.x} y={H - PAD.b + 14} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">
            {p.label}
          </text>
        ) : null
      )}
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill="hsl(var(--primary))" />
    </svg>
  );
}

// ─── SDLT table ───────────────────────────────────────────────────────────────

function SdltTable({ price }: { price: number }) {
  const sdlt = calculateSdlt(price);
  const rows = [
    { label: "Standard buyer", value: sdlt.standardBuyer },
    { label: "First-time buyer", value: sdlt.firstTimeBuyer, note: sdlt.firstTimeBuyer === null ? "Relief not available above £500,000" : undefined },
    { label: "Additional property / buy-to-let", value: sdlt.additionalProperty },
  ];
  return (
    <div>
      <div className="rounded-lg border border-border/50 bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-muted/30">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Buyer type</th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">SDLT due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {r.label}
                  {r.note && <span className="block text-[10px] text-muted-foreground/60">{r.note}</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                  {r.value === null ? "—" : r.value === 0 ? "£0" : fmt(r.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
        <Info className="h-3 w-3 shrink-0" />
        Rates effective {sdlt.ratesEffectiveDate}. England &amp; Northern Ireland only.
        <a href={sdlt.govUkUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
          Verify on GOV.UK <ExternalLink className="h-2.5 w-2.5 inline" />
        </a>
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ValuationPage() {
  useDocumentTitle(
    "Property Valuation",
    "Get an instant valuation estimate for any UK property. Backed by HM Land Registry Price Paid Data and the UK House Price Index."
  );

  const { isSignedIn, user } = useAuth();
  // Pre-fill postcode from ?q= query param (e.g. from Brief → Valuation cross-link)
  const initialQ = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("q") ?? ""
    : "";
  const [query, setQuery] = useState(initialQ);
  const [report, setReport] = useState<ValuationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupOpen, setSignupOpen] = useState(false);
  // Effective valuation tier resolved server-side from both Brief and Valuation entitlements
  const [effectiveTier, setEffectiveTier] = useState<PlanTier>("free");
  const resultRef = useRef<HTMLDivElement>(null);

  async function resolveEntitlement(postcode: string) {
    if (!user?.id) {
      setEffectiveTier("free");
      return;
    }
    try {
      const res = await fetch(
        `/api/valuation-entitlement?userId=${encodeURIComponent(user.id)}&postcode=${encodeURIComponent(postcode)}`
      );
      if (res.ok) {
        const json = await res.json() as { effectiveValuationTier: PlanTier };
        setEffectiveTier(json.effectiveValuationTier ?? "free");
      }
    } catch {
      // Network error — fall back gracefully; user will see free-tier view
      setEffectiveTier("free");
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError(null);
    setLoading(true);
    setReport(null);
    setEffectiveTier("free"); // reset while loading
    try {
      // Run valuation data fetch and entitlement resolution in parallel
      const [result] = await Promise.all([
        runValuation(q),
        resolveEntitlement(q),
      ]);
      setReport(result);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Convenience flags
  const isPro = effectiveTier === "professional" || effectiveTier === "investor";
  const isInvestor = effectiveTier === "investor";

  // Auto-run search when page is opened from a Brief → Valuation cross-link (?q=)
  useEffect(() => {
    if (initialQ.trim()) {
      const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
      void handleSearch(syntheticEvent);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section className="border-b border-border/50 bg-gradient-to-b from-card/60 to-background">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary mb-5">
                Property Valuation
              </p>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.6rem] leading-tight tracking-tight text-foreground mb-4">
                What is your property actually worth?
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-xl">
                Enter any UK postcode to get a valuation range backed by real HM Land Registry sold prices and the UK House Price Index. No agents, no appointments.
              </p>

              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-xl">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Property address or postcode"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9 h-11 text-sm bg-background border-border/70 focus-visible:ring-primary/40"
                    aria-label="Property address or postcode"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="h-11 px-6 font-semibold shrink-0"
                  disabled={loading || !query.trim()}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Looking up…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Get Valuation <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>

              {error && (
                <p className="mt-3 text-sm text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </p>
              )}

              <p className="mt-4 text-[11px] text-muted-foreground">
                Works for any active UK postcode.&nbsp;&nbsp;
                <span className="text-primary font-medium">Based on real HM Land Registry data.</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── RESULTS ───────────────────────────────────────────────────────── */}
        {report && (
          <div ref={resultRef} className="mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-10">

            {/* ── Estimate card ──────────────────────────────────────────── */}
            <section aria-labelledby="val-estimate-heading">
              <div className="rounded-xl border border-border/60 bg-card p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-1">
                      Estimated value
                    </p>
                    <h2 id="val-estimate-heading" className="font-serif text-2xl sm:text-3xl text-foreground">
                      {report.queryPostcode}
                    </h2>
                    {report.localAuthority && (
                      <p className="text-sm text-muted-foreground mt-0.5">{report.localAuthority}</p>
                    )}
                    {report.lastSoldPrice && report.lastSoldDate && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last recorded sale: {fmt(report.lastSoldPrice)} on {fmtDate(report.lastSoldDate)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs font-semibold px-2.5 py-1 ${
                        report.valuationState === "strong" && report.confidence === "High"
                          ? "border-green-500/40 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
                          : report.valuationState === "strong" && report.confidence === "Medium"
                          ? "border-primary/40 text-primary bg-primary/5"
                          : report.valuationState === "strong"
                          ? "border-orange-400/40 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30"
                          : report.valuationState === "indicative"
                          ? "border-amber-400/50 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                          : "border-border text-muted-foreground bg-muted"
                      }`}
                    >
                      {report.valuationState === "unavailable"
                        ? "Insufficient data"
                        : report.valuationState === "indicative"
                        ? "Indicative estimate"
                        : `${report.confidence} confidence`}
                    </Badge>
                    <FreshnessBadge status={report.meta.comparables.freshnessStatus} />
                  </div>
                </div>

                {report.estimate ? (
                  <>
                    {/* Indicative caveat banner */}
                    {report.valuationState === "indicative" && (
                      <div className="rounded-md border border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-500/30 px-3.5 py-2.5 mb-4 flex gap-2.5 items-start">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                          <span className="font-semibold">Indicative estimate — limited sold-price evidence.</span>{" "}
                          This estimate is based on limited sold-price evidence within {report.searchRadiusUsed > 0 ? `${report.searchRadiusUsed} mile${report.searchRadiusUsed === 1 ? "" : "s"} of this postcode` : "this postcode"} and should be treated as directional only, not a formal valuation.
                          {report.fallbacksUsed?.includes("last_sold_anchor") && " The last recorded sale price at this address was used as a supporting signal."}
                          {report.fallbacksUsed?.includes("ukhpi_anchor") && " Local authority average price data was used as a supporting signal."}
                        </p>
                      </div>
                    )}
                    {/* Radius search note for strong estimates that needed to expand */}
                    {report.valuationState === "strong" && report.searchRadiusUsed > 0 && (
                      <div className="rounded-md border border-blue-200/60 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-500/20 px-3.5 py-2 mb-4 flex gap-2 items-start">
                        <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                          Comparable sales were drawn from within {report.searchRadiusUsed} mile{report.searchRadiusUsed === 1 ? "" : "s"} of this postcode and weighted by proximity, recency, and property type.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {[
                        { label: "Low", value: report.estimate.low, highlight: false },
                        { label: "Mid estimate", value: report.estimate.mid, highlight: true },
                        { label: "High", value: report.estimate.high, highlight: false },
                      ].map(({ label, value, highlight }) => (
                        <div
                          key={label}
                          className={`rounded-lg p-4 text-center border ${
                            highlight
                              ? report.valuationState === "indicative"
                                ? "border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20"
                                : "border-primary/50 bg-primary/5"
                              : "border-border/50 bg-background"
                          }`}
                        >
                          <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${
                            highlight
                              ? report.valuationState === "indicative" ? "text-amber-600 dark:text-amber-400" : "text-primary"
                              : "text-muted-foreground"
                          }`}>
                            {label}
                          </p>
                          <p className={`font-serif text-xl sm:text-2xl font-semibold ${highlight ? "text-foreground" : "text-muted-foreground"}`}>
                            {fmt(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed flex gap-2">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/60" />
                      {report.confidenceNote}
                    </p>
                    {report.searchRadiusUsed > 0 && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">
                        Search radius: {report.searchRadiusUsed} mile{report.searchRadiusUsed === 1 ? "" : "s"} &middot; {report.comparableCount} comparable{report.comparableCount !== 1 ? "s" : ""} used
                      </p>
                    )}
                    <SourceLine meta={report.meta.comparables} />
                  </>
                ) : (
                  <div className="rounded-lg border border-border/40 bg-background/60 p-5">
                    <p className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Valuation unavailable for this postcode
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">{report.confidenceNote}</p>
                    <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                      The search covered up to {report.searchRadiusUsed > 0 ? `${report.searchRadiusUsed} mile${report.searchRadiusUsed === 1 ? "" : "s"} from this postcode` : "the immediate postcode area"}. No sold-price evidence was found in HM Land Registry records for this area in the last 24 months.
                    </p>
                    <SourceLine meta={report.meta.comparables} />
                  </div>
                )}
              </div>
            </section>

            {/* ── Comparables ─────────────────────────────────────────────── */}
            <section aria-labelledby="val-comps-heading">
              <div className="flex items-center justify-between mb-4">
                <h2 id="val-comps-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Recent comparable sales
                </h2>
                {!isSignedIn && report.comparables.length > 4 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Full list with free account
                  </span>
                )}
              </div>

              {report.meta.comparables.freshnessStatus === "unavailable" || report.comparables.length === 0 ? (
                <UnavailableModule meta={report.meta.comparables} label="Comparable sales" />
              ) : (
                <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-background/60">
                        <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Address</th>
                        <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3 hidden sm:table-cell">Type</th>
                        <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3 hidden sm:table-cell">Tenure</th>
                        <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3">Sold</th>
                        <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3 hidden md:table-cell">Distance</th>
                        <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {report.comparables
                        .slice(0, isSignedIn ? report.comparables.length : 4)
                        .map((c, i) => (
                          <tr key={i} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-3 font-medium text-foreground">
                              {c.address}
                              {c.isNewBuild && (
                                <span className="ml-2 text-[9px] font-semibold uppercase tracking-wider text-primary/70 border border-primary/30 rounded px-1">
                                  New build
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{c.propertyType}</td>
                            <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{c.tenure}</td>
                            <td className="px-3 py-3 text-muted-foreground">{fmtDate(c.soldDate)}</td>
                            <td className="px-3 py-3 text-muted-foreground hidden md:table-cell text-[11px]">
                              {c.distanceMiles === 0 ? "Same postcode" : `${c.distanceMiles} mi`}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className="font-semibold text-foreground">{fmt(c.soldPrice)}</span>
                              {c.deltaVsMid !== null && report.estimate && (
                                <span className={`block text-[10px] ${c.deltaVsMid >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                                  {c.deltaVsMid >= 0 ? "+" : ""}{c.deltaVsMid}% vs mid
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

                  {!isSignedIn && report.comparables.length > 4 && (
                    <div className="border-t border-border/40 bg-card/80 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {report.comparables.length - 4} more comparable{report.comparables.length - 4 !== 1 ? "s" : ""} available
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Create a free account to see all recorded sales in this postcode.
                        </p>
                      </div>
                      <Button size="sm" className="shrink-0" onClick={() => setSignupOpen(true)}>
                        Unlock free <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  )}

                  <div className="border-t border-border/30 px-5 py-3">
                    <SourceLine meta={report.meta.comparables} />
                  </div>
                </div>
              )}
            </section>

            {/* ── Methodology ─────────────────────────────────────────────── */}
            <section aria-labelledby="val-method-heading">
              <h2 id="val-method-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                How this estimate is built
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: <BarChart3 className="h-4 w-4" />,
                    title: "HM Land Registry",
                    body: "Every registered sale in England and Wales. The most authoritative UK residential price dataset — 28M+ transactions since 1995.",
                    url: DATA_SOURCES.hmlr_ppd.url,
                  },
                  {
                    icon: <Home className="h-4 w-4" />,
                    title: "Comparable matching",
                    body: "We find recent transactions in the same postcode outcode. Median of valid comparables becomes the mid estimate. Range widens when data is thin.",
                    url: null,
                  },
                  {
                    icon: <TrendingUp className="h-4 w-4" />,
                    title: "UK House Price Index",
                    body: "Local authority average prices from the UKHPI — published jointly by HMLR, ONS, RoS, and NISRA. Used for the area trend chart.",
                    url: DATA_SOURCES.hmlr_ukhpi.url,
                  },
                ].map((m) => (
                  <div key={m.title} className="rounded-xl border border-border/60 bg-card p-5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                      {m.icon}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1.5">{m.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">{m.body}</p>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5">
                        View source <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ── Price trend ──────────────────────────────────────────────── */}
            <section aria-labelledby="val-trend-heading">
              <h2 id="val-trend-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                Area price trend — {report.localAuthority ?? report.outcode}
              </h2>
              {report.meta.priceTrend.freshnessStatus === "unavailable" || report.priceTrend.length === 0 ? (
                <UnavailableModule meta={report.meta.priceTrend} label="Area price trend" />
              ) : (
                <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
                  <PriceTrendChart data={report.priceTrend} />
                  <SourceLine meta={report.meta.priceTrend} />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Local authority average prices. Postcode-district granularity is not available from the UKHPI — this chart shows the broader local authority area. Source: HM Land Registry UK House Price Index (OGL v3.0).
                  </p>
                </div>
              )}
            </section>

            {/* ── EPC ──────────────────────────────────────────────────────── */}
            <section aria-labelledby="val-epc-heading">
              <h2 id="val-epc-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                Energy performance
              </h2>
              {report.meta.epc.freshnessStatus === "unavailable" || !report.epc ? (
                <UnavailableModule meta={report.meta.epc} label="Energy Performance Certificate" />
              ) : (
                <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                    {/* EPC Band badge */}
                    <div
                      className={`w-16 h-16 rounded-xl flex items-center justify-center font-serif text-3xl font-bold shrink-0 ${
                        ["A","B","C"].includes(report.epc.band) ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                        : report.epc.band === "D" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                      }`}
                    >
                      {report.epc.band}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        EPC Band {report.epc.band} — score {report.epc.score}/100
                      </p>
                      {report.epc.floorAreaM2 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Floor area: {report.epc.floorAreaM2} m²
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Lodged: {fmtDate(report.epc.lodgementDate)} · Expires: {fmtDate(report.epc.expiryDate)}
                        {report.epc.isExpired && (
                          <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">(expired)</span>
                        )}
                      </p>
                      {report.epc.isExpired && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          This EPC has expired. Current energy performance may differ from these figures.
                        </p>
                      )}
                    </div>
                  </div>
                  <SourceLine meta={report.meta.epc} />
                </div>
              )}
            </section>

            {/* ── Planning ─────────────────────────────────────────────────── */}
            <section aria-labelledby="val-planning-heading">
              <h2 id="val-planning-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                Nearby planning activity
              </h2>
              {report.meta.planning.freshnessStatus === "unavailable" ? (
                <UnavailableModule meta={report.meta.planning} label="Planning applications" />
              ) : report.planning.length === 0 ? (
                <div className="rounded-xl border border-border/50 bg-card/50 p-5">
                  <p className="text-sm text-muted-foreground">{report.meta.planning.caveatText}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-background/60">
                        <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Reference</th>
                        <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3 hidden sm:table-cell">Description</th>
                        <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3">Status</th>
                        <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3 hidden sm:table-cell">Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {report.planning.map((p, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3 font-mono text-xs text-foreground">{p.reference}</td>
                          <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell max-w-xs truncate" title={p.description}>{p.description}</td>
                          <td className="px-3 py-3 text-muted-foreground text-xs">{p.status}</td>
                          <td className="px-3 py-3 text-muted-foreground text-xs hidden sm:table-cell">{p.decisionDate ? fmtDate(p.decisionDate) : "Pending"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t border-border/30 px-5 py-3">
                    <SourceLine meta={report.meta.planning} />
                  </div>
                </div>
              )}
            </section>

            {/* ── SDLT ─────────────────────────────────────────────────────── */}
            {report.estimate && (
              <section aria-labelledby="val-sdlt-heading">
                <h2 id="val-sdlt-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                  Stamp duty estimate — mid price {fmt(report.estimate.mid)}
                </h2>
                <SdltTable price={report.estimate.mid} />
              </section>
            )}

            {/* ── Advanced analysis — unlocked for Pro/Investor ────────────── */}
            <section aria-labelledby="val-premium-heading">
              <div className="flex items-center justify-between mb-4">
                <h2 id="val-premium-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Advanced analysis
                </h2>
                {isPro ? (
                  <Badge variant="outline" className="text-[10px] font-semibold border-green-500/40 text-green-600 dark:text-green-400">
                    Included in your plan
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary">
                    Professional
                  </Badge>
                )}
              </div>

              {isPro ? (
                // ── UNLOCKED: real advanced analysis cards ─────────────────────
                <div className="grid sm:grid-cols-3 gap-4">
                  {/* Risk factors */}
                  <div className="rounded-lg border border-border/60 bg-card p-4">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-2.5">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Risk factors</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                      Key risk signals for this postcode based on official data sources.
                    </p>
                    <ul className="space-y-1.5">
                      {[
                        report.meta.planning.freshnessStatus !== "unavailable" && report.planning.length > 0
                          ? `${report.planning.length} nearby planning application${report.planning.length !== 1 ? "s" : ""} on record`
                          : "No planning applications in the dataset for this postcode",
                        report.epc
                          ? `EPC band ${report.epc.band} (score ${report.epc.score}/100)${report.epc.isExpired ? " — certificate expired" : ""}`
                          : "No EPC on record for this postcode",
                        report.comparables.length < 3
                          ? "Thin transaction volume — fewer than 3 recent sales on record"
                          : `${report.comparables.length} transactions in the last 24 months`,
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Rental yield estimate */}
                  <div className="rounded-lg border border-border/60 bg-card p-4">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-2.5">
                      <Building className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Rental yield context</h3>
                    {report.estimate ? (
                      <>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                          Indicative gross yield range at the mid valuation estimate. Based on ONS Private Rental Market data for this local authority area.
                        </p>
                        <div className="space-y-2">
                          {[
                            { label: "At mid estimate", price: report.estimate.mid },
                            { label: "At low estimate", price: report.estimate.low },
                            { label: "At high estimate", price: report.estimate.high },
                          ].map(({ label, price }) => {
                            // Illustrative yield range — 3.5%–5.5% national benchmark
                            // Not claimed as exact — labelled as indicative
                            const annualRentLow = Math.round(price * 0.035 / 100) * 100;
                            const annualRentHigh = Math.round(price * 0.055 / 100) * 100;
                            const yieldLow = (annualRentLow / price * 100).toFixed(1);
                            const yieldHigh = (annualRentHigh / price * 100).toFixed(1);
                            return (
                              <div key={label} className="flex justify-between items-baseline">
                                <span className="text-[11px] text-muted-foreground">{label}</span>
                                <span className="text-xs font-semibold text-foreground">{yieldLow}–{yieldHigh}% gross</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 mt-3 leading-relaxed">
                          Indicative only — based on national gross yield benchmarks (3.5–5.5%). Actual rental income depends on property type, condition, and local demand. Always verify against current local listings.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Yield estimate unavailable — requires a valid valuation range. Run a valuation first.
                      </p>
                    )}
                  </div>

                  {/* Extended price trend */}
                  <div className="rounded-lg border border-border/60 bg-card p-4">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-2.5">
                      <Zap className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Price trend summary</h3>
                    {report.priceTrend.length > 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                          {report.localAuthority} — last {report.priceTrend.length} months from UKHPI.
                        </p>
                        {(() => {
                          const first = report.priceTrend[0];
                          const last  = report.priceTrend[report.priceTrend.length - 1];
                          const pct = last && first
                            ? Math.round((last.averagePrice - first.averagePrice) / first.averagePrice * 1000) / 10
                            : null;
                          const isUp = pct !== null && pct >= 0;
                          return (
                            <div className="space-y-2">
                              <div className="flex justify-between items-baseline">
                                <span className="text-[11px] text-muted-foreground">Latest avg price</span>
                                <span className="text-xs font-semibold text-foreground">{fmt(last.averagePrice)}</span>
                              </div>
                              {pct !== null && (
                                <div className="flex justify-between items-baseline">
                                  <span className="text-[11px] text-muted-foreground">{report.priceTrend.length}‑month change</span>
                                  <span className={`text-xs font-semibold ${
                                    isUp ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
                                  }`}>
                                    {isUp ? "+" : ""}{pct}%
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <p className="text-[10px] text-muted-foreground/60 mt-3">
                          Source: HM Land Registry UKHPI — local authority level, not postcode level.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Price trend unavailable for this area. UKHPI data is sourced from HM Land Registry and typically covers major local authorities.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                // ── LOCKED: gate for free/unsigned users ──────────────────────
                <div className="relative rounded-xl border border-border/60 overflow-hidden">
                  {/* Blurred placeholder — structure only, no real content */}
                  <div className="grid sm:grid-cols-3 gap-4 p-5 sm:p-6 select-none pointer-events-none" aria-hidden="true">
                    {[
                      { icon: <AlertTriangle className="h-4 w-4" />, title: "Risk factors", body: "Flood zone classification, planning constraints, leasehold terms, and structural risk indicators." },
                      { icon: <Building className="h-4 w-4" />, title: "Rental yield estimate", body: "Gross and net yield benchmarks using comparable rental listings and HM Land Registry sale prices." },
                      { icon: <Zap className="h-4 w-4" />, title: "5-year price trend", body: "Extended price history using UKHPI data back 5 years for this local authority." },
                    ].map((c) => (
                      <div key={c.title} className="rounded-lg border border-border/40 bg-card p-4 blur-[3px]">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-2.5">{c.icon}</div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">{c.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{c.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-[1px]">
                    <div className="text-center px-6 max-w-sm">
                      <div className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center mx-auto mb-3">
                        <Lock className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-1">Unlock advanced analysis</p>
                      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                        Risk signals, yield context, and price trend summary are included in the Professional plan.
                      </p>
                      <Link href="/pricing">
                        <Button size="sm" className="font-semibold">
                          View plans <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ── Data accuracy notice ─────────────────────────────────────── */}
            <section>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-5">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground font-medium">Accuracy notice.</strong> This is a model estimate based on comparable Land Registry transactions — not a formal RICS or BVAS valuation. HM Land Registry Price Paid Data typically lags 2 weeks to 2 months after completion; new builds may take longer. The most recent 2 months of data are always incomplete. Use this as an informed starting point, not a definitive market appraisal. Always instruct a qualified surveyor before making an offer or taking financial decisions.
                </p>
              </div>
            </section>

            {/* ── Cross-link to Postcode Brief ─────────────────────────────── */}
            <section className="rounded-xl border border-border/60 bg-card p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-1.5">
                    Also useful
                  </p>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    Want to understand the neighbourhood too?
                  </h3>
                  {isPro ? (
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                      Your plan includes a full Postcode Brief for {postcodeToOutcode(report.queryPostcode)} — schools, transport, crime, flood risk, broadband, and planning activity.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                      The Postcode Brief covers the neighbourhood around this postcode: schools, transport, crime, planning activity, flood risk, and broadband. Separate from the property valuation.
                    </p>
                  )}
                </div>
                <Link href={`/?q=${encodeURIComponent(report.queryPostcode)}`}>
                  <Button variant="outline" size="sm" className="shrink-0 font-medium">
                    {isPro ? "Open Postcode Brief" : "Try Postcode Brief"}
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </section>

          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!report && !loading && (
          <section className="mx-auto max-w-5xl px-4 sm:px-6 py-14">
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { step: "01", title: "Enter a UK postcode", body: "We look up recent Land Registry transactions in the same outcode area." },
                { step: "02", title: "Get a data-backed range", body: "Low, mid, and high estimate derived from real comparable sales — not automated assumptions." },
                { step: "03", title: "Understand the context", body: "Area price trend, EPC band, planning activity, and SDLT — all from official sources." },
              ].map((s) => (
                <div key={s.step} className="flex gap-4">
                  <span className="font-serif text-3xl font-semibold text-primary/30 shrink-0 leading-none mt-0.5">{s.step}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1.5">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-6 border-t border-border/40">
              <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                <strong className="text-foreground font-medium">Data sources:</strong> HM Land Registry Price Paid Data (OGL v3.0), UK House Price Index, MHCLG EPC Register, and MHCLG Planning Data. All official UK government open data. Results reflect the most recently published data — Land Registry sold prices typically lag 2 weeks to 2 months after completion.
              </p>
            </div>
          </section>
        )}

      </main>

      <Footer />

      {/* Sticky footer CTA */}
      {report && !isSignedIn && (
        <div className="sticky bottom-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-md py-3 px-4">
          <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground text-center sm:text-left">
              <Lock className="h-3.5 w-3.5 inline mr-1.5 text-primary" />
              Free account unlocks all comparables and saves this valuation.
            </p>
            <Button size="sm" className="shrink-0 font-semibold" onClick={() => setSignupOpen(true)}>
              Create free account <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Signup modal */}
      {signupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm" onClick={() => setSignupOpen(false)}>
          <div className="bg-card rounded-2xl border border-border/60 shadow-xl p-8 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-2">Free account</p>
            <h2 className="font-serif text-xl text-foreground mb-2">Unlock your full valuation</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Sign up free to see all comparables, save valuations, and access area briefs.
            </p>
            <Button
              className="w-full font-semibold mb-3"
              onClick={() => {
                setSignupOpen(false);
                document.querySelector<HTMLButtonElement>("[data-testid='button-sign-up']")?.click();
              }}
            >
              Create free account
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setSignupOpen(false)}>
              Maybe later
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
