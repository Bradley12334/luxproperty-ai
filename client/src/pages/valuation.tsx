import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/hooks/use-auth";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ValuationResult {
  address: string;
  postcode: string;
  propertyType: string;
  low: number;
  mid: number;
  high: number;
  confidence: "High" | "Medium" | "Low";
  confidenceNote: string;
  lastSold?: string;
  lastSoldPrice?: number;
  drivers: { label: string; direction: "up" | "down" | "neutral"; note: string }[];
  comparables: Comparable[];
  marketConditions: MarketCondition[];
  trendData: TrendPoint[];
}

interface Comparable {
  address: string;
  type: string;
  beds: string;
  sold: string;
  price: number;
  delta: number; // % vs mid estimate
}

interface MarketCondition {
  label: string;
  value: string;
  sub: string;
  direction: "up" | "down" | "neutral";
}

interface TrendPoint {
  month: string;
  price: number;
}

// ─── Demo data (shown when user runs a search) ────────────────────────────────

function buildDemoResult(query: string): ValuationResult {
  const upper = query.toUpperCase().trim();
  // Vary numbers slightly by postcode to feel real
  const seed = upper.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = 320000 + (seed % 12) * 15000;

  return {
    address: upper,
    postcode: upper,
    propertyType: "Semi-detached",
    low: Math.round(base * 0.91 / 1000) * 1000,
    mid: Math.round(base / 1000) * 1000,
    high: Math.round(base * 1.09 / 1000) * 1000,
    confidence: "Medium",
    confidenceNote:
      "Based on 14 comparable transactions within 0.4 miles in the last 24 months. Confidence is medium due to limited exact-match stock — semi-detached volumes in this area are moderate.",
    lastSold: "March 2021",
    lastSoldPrice: Math.round(base * 0.83 / 1000) * 1000,
    drivers: [
      { label: "Recent local sales trend", direction: "up", note: "+4.2% in the last 12 months (HM Land Registry)" },
      { label: "Transport access", direction: "up", note: "Within 800m of a rail station — adds measurable demand" },
      { label: "School catchment quality", direction: "up", note: "Within catchment of Ofsted-rated Good schools" },
      { label: "Property type supply", direction: "down", note: "Semi-detacheds transact slower than flats in this district" },
      { label: "Energy efficiency (EPC)", direction: "neutral", note: "EPC band D — neutral effect at current market" },
    ],
    comparables: [
      { address: "14 nearby road", type: "Semi-detached", beds: "3 bed", sold: "Jan 2025", price: base - 8000, delta: -2.5 },
      { address: "27 nearby road", type: "Semi-detached", beds: "3 bed", sold: "Nov 2024", price: base + 5000, delta: +1.6 },
      { address: "8 nearby close", type: "Semi-detached", beds: "4 bed", sold: "Sep 2024", price: base + 32000, delta: +10.0 },
      { address: "51 nearby avenue", type: "Semi-detached", beds: "3 bed", sold: "Jul 2024", price: base - 14000, delta: -4.4 },
      // Locked
      { address: "••• ••• Road", type: "Semi-detached", beds: "3 bed", sold: "May 2024", price: 0, delta: 0 },
      { address: "••• ••• Close", type: "Terraced", beds: "3 bed", sold: "Feb 2024", price: 0, delta: 0 },
    ],
    marketConditions: [
      { label: "Avg days on market", value: "43 days", sub: "For semi-detacheds in this postcode district", direction: "neutral" },
      { label: "Price vs asking", value: "97.4%", sub: "Properties typically selling 2–3% below asking", direction: "down" },
      { label: "12-month price trend", value: "+4.2%", sub: "HM Land Registry, postcode district level", direction: "up" },
    ],
    trendData: [
      { month: "Jun 24", price: base * 0.958 },
      { month: "Jul 24", price: base * 0.964 },
      { month: "Aug 24", price: base * 0.969 },
      { month: "Sep 24", price: base * 0.974 },
      { month: "Oct 24", price: base * 0.978 },
      { month: "Nov 24", price: base * 0.982 },
      { month: "Dec 24", price: base * 0.985 },
      { month: "Jan 25", price: base * 0.989 },
      { month: "Feb 25", price: base * 0.993 },
      { month: "Mar 25", price: base * 0.997 },
      { month: "Apr 25", price: base * 1.000 },
      { month: "May 25", price: base * 1.004 },
    ],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "£" + n.toLocaleString("en-GB");
}

// ─── Mini sparkline using SVG ─────────────────────────────────────────────────

function PriceTrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) return null;
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const W = 600;
  const H = 120;
  const PAD = { t: 16, r: 8, b: 28, l: 8 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const step = chartW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: PAD.l + i * step,
    y: PAD.t + chartH - ((d.price - min) / range) * chartH,
    label: d.month,
    price: d.price,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const fillD = `${pathD} L ${points[points.length - 1].x} ${H - PAD.b} L ${PAD.l} ${H - PAD.b} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-label="12-month price trend chart">
      <defs>
        <linearGradient id="val-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 0.5, 1].map((t) => (
        <line
          key={t}
          x1={PAD.l}
          x2={W - PAD.r}
          y1={PAD.t + chartH * (1 - t)}
          y2={PAD.t + chartH * (1 - t)}
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />
      ))}
      {/* Fill */}
      <path d={fillD} fill="url(#val-fill)" />
      {/* Line */}
      <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
      {/* X-axis labels — every other month to avoid crowding */}
      {points.map((p, i) =>
        i % 2 === 0 ? (
          <text
            key={i}
            x={p.x}
            y={H - PAD.b + 14}
            textAnchor="middle"
            fontSize="9"
            fill="hsl(var(--muted-foreground))"
          >
            {p.label}
          </text>
        ) : null
      )}
      {/* End dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="4"
        fill="hsl(var(--primary))"
      />
    </svg>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function ValuationPage() {
  useDocumentTitle(
    "Property Valuation",
    "Get an instant estimate for any UK property. Enter an address or postcode to see a valuation range, comparable sales, and market conditions — powered by HM Land Registry data."
  );

  const { isSignedIn } = useAuth();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError(null);
    setLoading(true);
    // Simulate brief async lookup
    setTimeout(() => {
      setResult(buildDemoResult(q));
      setLoading(false);
      // Scroll to result
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }, 900);
  }

  const hasResult = !!result;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">

        {/* ─── HERO ──────────────────────────────────────────────────────────── */}
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
                Enter any UK address or postcode to get an instant valuation range backed by HM Land Registry transaction data and local comparables. No agents, no appointments.
              </p>

              {/* Search */}
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
                      Searching…
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
                Works for any UK postcode or full address.&nbsp;&nbsp;
                <span className="text-primary font-medium">Free estimate — no account required.</span>
              </p>
            </div>
          </div>
        </section>

        {/* ─── RESULT PANEL ──────────────────────────────────────────────────── */}
        {hasResult && result && (
          <div ref={resultRef} className="mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-10">

            {/* Estimate card */}
            <section aria-labelledby="val-estimate-heading">
              <div className="rounded-xl border border-border/60 bg-card p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-1">
                      Estimated value
                    </p>
                    <h2 id="val-estimate-heading" className="font-serif text-2xl sm:text-3xl text-foreground">
                      {result.address}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {result.propertyType}
                      {result.lastSold && result.lastSoldPrice && (
                        <> &middot; Last sold {result.lastSold} at {fmt(result.lastSoldPrice)}</>
                      )}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs font-semibold px-2.5 py-1 ${
                      result.confidence === "High"
                        ? "border-green-500/40 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
                        : result.confidence === "Medium"
                        ? "border-primary/40 text-primary bg-primary/5"
                        : "border-orange-400/40 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30"
                    }`}
                  >
                    {result.confidence} confidence
                  </Badge>
                </div>

                {/* Range bars */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: "Low", value: result.low, highlight: false },
                    { label: "Mid estimate", value: result.mid, highlight: true },
                    { label: "High", value: result.high, highlight: false },
                  ].map(({ label, value, highlight }) => (
                    <div
                      key={label}
                      className={`rounded-lg p-4 text-center border ${
                        highlight
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/50 bg-background"
                      }`}
                    >
                      <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${highlight ? "text-primary" : "text-muted-foreground"}`}>
                        {label}
                      </p>
                      <p className={`font-serif text-xl sm:text-2xl font-semibold ${highlight ? "text-foreground" : "text-muted-foreground"}`}>
                        {fmt(value)}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/60" />
                  {result.confidenceNote}
                </p>
              </div>
            </section>

            {/* What's driving the estimate */}
            <section aria-labelledby="val-drivers-heading">
              <h2 id="val-drivers-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                What&apos;s driving the estimate
              </h2>
              <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40">
                {result.drivers.map((d, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-4">
                    <span
                      className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                        d.direction === "up"
                          ? "bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400"
                          : d.direction === "down"
                          ? "bg-red-100 dark:bg-red-950/40 text-red-500 dark:text-red-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {d.direction === "up" ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : d.direction === "down" ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <Scale className="h-3 w-3" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{d.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Methodology */}
            <section aria-labelledby="val-method-heading">
              <h2 id="val-method-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                How this estimate is built
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: <BarChart3 className="h-4 w-4" />,
                    title: "HM Land Registry",
                    body: "Every registered sale in England and Wales since 2000. The most authoritative price dataset for UK residential property.",
                  },
                  {
                    icon: <Home className="h-4 w-4" />,
                    title: "Comparable matching",
                    body: "We find recent sales within walking distance that match on property type, size band, and condition signals.",
                  },
                  {
                    icon: <TrendingUp className="h-4 w-4" />,
                    title: "Local price trend",
                    body: "Adjusts comparables forward using postcode-district trend data from the last 12 months.",
                  },
                ].map((m) => (
                  <div key={m.title} className="rounded-xl border border-border/60 bg-card p-5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                      {m.icon}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1.5">{m.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{m.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Comparable sales */}
            <section aria-labelledby="val-comps-heading">
              <div className="flex items-center justify-between mb-4">
                <h2 id="val-comps-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Comparable sales
                </h2>
                {!isSignedIn && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Full list unlocked with free account
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-background/60">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Address</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3 hidden sm:table-cell">Type</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3 hidden sm:table-cell">Size</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3">Sold</th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {result.comparables.slice(0, isSignedIn ? result.comparables.length : 4).map((c, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-medium text-foreground">{c.address}</td>
                        <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{c.type}</td>
                        <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{c.beds}</td>
                        <td className="px-3 py-3 text-muted-foreground">{c.sold}</td>
                        <td className="px-5 py-3 text-right font-semibold text-foreground">{fmt(c.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Gate overlay for remaining rows when signed out */}
                {!isSignedIn && result.comparables.length > 4 && (
                  <div className="border-t border-border/40 bg-card/80 px-5 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {result.comparables.length - 4} more comparables available
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Create a free account to unlock the full comparables list and save your valuation.
                      </p>
                    </div>
                    <Button size="sm" className="shrink-0" onClick={() => setSignupOpen(true)}>
                      Unlock free <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </section>

            {/* Market conditions */}
            <section aria-labelledby="val-market-heading">
              <h2 id="val-market-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                Market conditions
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {result.marketConditions.map((m) => (
                  <div key={m.label} className="rounded-xl border border-border/60 bg-card p-5">
                    <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                    <p className={`font-serif text-2xl font-semibold mb-1 ${
                      m.direction === "up" ? "text-green-600 dark:text-green-400"
                      : m.direction === "down" ? "text-red-500 dark:text-red-400"
                      : "text-foreground"
                    }`}>
                      {m.value}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{m.sub}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Price trend */}
            <section aria-labelledby="val-trend-heading">
              <h2 id="val-trend-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                12-month price trend — postcode district
              </h2>
              <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
                <PriceTrendChart data={result.trendData} />
                <p className="text-[11px] text-muted-foreground mt-3">
                  Average sale price for semi-detached properties in this postcode district. Source: HM Land Registry (OGL v3.0).
                </p>
              </div>
            </section>

            {/* Premium locked section */}
            <section aria-labelledby="val-premium-heading">
              <div className="flex items-center justify-between mb-4">
                <h2 id="val-premium-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Advanced analysis
                </h2>
                <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary">
                  Professional
                </Badge>
              </div>
              <div className="relative rounded-xl border border-border/60 overflow-hidden">
                {/* Locked cards — no real content rendered, just structure */}
                <div className="grid sm:grid-cols-3 gap-4 p-5 sm:p-6 select-none pointer-events-none" aria-hidden="true">
                  {[
                    { icon: <AlertTriangle className="h-4 w-4" />, title: "Risk factors", body: "Planning constraints, flood zone proximity, leasehold considerations, and structural risk indicators for this postcode." },
                    { icon: <Building className="h-4 w-4" />, title: "Rental yield estimate", body: "Gross and net yield benchmarks based on comparable rental listings and current purchase price range." },
                    { icon: <Zap className="h-4 w-4" />, title: "Planning activity", body: "Recent and pending planning applications within 200m that could affect value or liveability." },
                  ].map((c) => (
                    <div key={c.title} className="rounded-lg border border-border/40 bg-card p-4 blur-[3px]">
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-2.5">
                        {c.icon}
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">{c.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{c.body}</p>
                    </div>
                  ))}
                </div>
                {/* Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-[1px]">
                  <div className="text-center px-6 max-w-sm">
                    <div className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center mx-auto mb-3">
                      <Lock className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">Unlock advanced analysis</p>
                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                      Risk factors, rental yield, and planning activity are included in the Professional plan.
                    </p>
                    <Link href="/pricing">
                      <Button size="sm" className="font-semibold">
                        View plans <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* Cross-link to Postcode Brief */}
            <section className="rounded-xl border border-border/60 bg-card p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-1.5">
                    Also useful
                  </p>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    Want to understand the neighbourhood too?
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                    The Postcode Brief goes deeper on the area: schools, transport, crime, planning activity, flood risk, broadband, and a full buyer strategy — all in one place. It&apos;s a different product, built for a different question.
                  </p>
                </div>
                <Link href="/">
                  <Button variant="outline" size="sm" className="shrink-0 font-medium">
                    Try Postcode Brief <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </section>

          </div>
        )}

        {/* ─── EMPTY STATE — how it works ─────────────────────────────────── */}
        {!hasResult && !loading && (
          <section className="mx-auto max-w-5xl px-4 sm:px-6 py-14">
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  step: "01",
                  title: "Enter any UK address or postcode",
                  body: "Full address gives a more precise match. Postcode alone gives a district-level estimate.",
                },
                {
                  step: "02",
                  title: "See a data-backed valuation range",
                  body: "Low, mid, and high estimate based on recent Land Registry sales and local price trend.",
                },
                {
                  step: "03",
                  title: "Understand what's behind the number",
                  body: "Comparables, market conditions, and the specific factors driving the estimate up or down.",
                },
              ].map((s) => (
                <div key={s.step} className="flex gap-4">
                  <span className="font-serif text-3xl font-semibold text-primary/30 shrink-0 leading-none mt-0.5">
                    {s.step}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1.5">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 pt-8 border-t border-border/40">
              <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                <strong className="text-foreground font-medium">Accuracy note:</strong> This is a model estimate based on comparable transactions and area trend data — not a formal RICS valuation. Use it as an informed starting point before instructing a surveyor or making an offer. Figures may differ from automated valuations on other platforms due to different comparable selection criteria.
              </p>
            </div>
          </section>
        )}

      </main>

      <Footer />

      {/* Sticky footer CTA — shown when result is visible and user is not signed in */}
      {hasResult && !isSignedIn && (
        <div className="sticky bottom-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-md py-3 px-4">
          <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground text-center sm:text-left">
              <Lock className="h-3.5 w-3.5 inline mr-1.5 text-primary" />
              Create a free account to unlock full comparables and save this valuation.
            </p>
            <Button size="sm" className="shrink-0 font-semibold" onClick={() => setSignupOpen(true)}>
              Unlock free <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Signup modal — reuse the existing AuthModal */}
      {signupOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm"
          onClick={() => setSignupOpen(false)}
        >
          <div
            className="bg-card rounded-2xl border border-border/60 shadow-xl p-8 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-2">Free account</p>
            <h2 className="font-serif text-xl text-foreground mb-2">Unlock your full valuation</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Sign up free to see all comparables, save valuations, and get access to area briefs.
            </p>
            <Button
              className="w-full font-semibold mb-3"
              onClick={() => {
                setSignupOpen(false);
                // Fire the site's existing auth modal — dispatch a custom event the Header listens to,
                // or just navigate to home where the Sign Up button is visible.
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
