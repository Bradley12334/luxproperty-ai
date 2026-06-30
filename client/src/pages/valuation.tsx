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
  HelpCircle,
  ShieldCheck,
  Layers,
  Calendar,
  History,
  Navigation,
  Ruler,
  Leaf,
  ChevronDown,
  ChevronUp,
  Target,
  Banknote,
  FileText,
  Receipt,
  Users,
  BadgeCheck,
  ThumbsUp,
  ThumbsDown,
  Minus,
  PoundSterling,
  Hammer,
  ShieldAlert,
  Waves,
  BatteryLow,
} from "lucide-react";
import {
  runValuation,
  calculateSdlt,
  type ValuationReport,
  type FreshnessStatus,
  type ModuleMetadata,
  type ComparableSale,
  type TimelineEvent,
  type PropertyHistory,
} from "@/lib/valuationEngine";
import { DATA_SOURCES } from "@/lib/valuationSources";
import {
  filterEmptyFields,
  getPropertyFactsCompleteness,
  getOwnershipCostsCompleteness,
  getEpcCompleteness,
  getPlanningCompleteness,
  getLeaseholdCompleteness,
  getValueDriversCompleteness,
  getConsecutiveSuppressedSections,
  getProvenanceChipClass,
  // new module-decision helpers
  getRentalModuleDecision,
  getEpcModuleDecision,
  getLeaseholdModuleDecision,
  getPropertyFactsDecision,
  calcGrossYield,
  type CompletenessResult,
  type FieldRow,
  type ModuleDecision,
} from "@/lib/sectionCompleteness";

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

// ─── Provenance chip ─────────────────────────────────────────────────────────

function ProvenanceChip({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] border rounded-full px-2 py-0.5 ${getProvenanceChipClass(label as any)}`}>
      <ShieldCheck className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

// ─── Sparse state card ────────────────────────────────────────────────────────
// Used when a section has data but not enough to justify a full card.
// Renders a compact, single-line explanation — not a large empty placeholder.

function SparseCard({ message, link }: { message: string; link?: { href: string; label: string } }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3 flex items-start gap-2.5">
      <Info className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {message}
        {link && (
          <>
            {" "}
            <a href={link.href} target="_blank" rel="noopener noreferrer"
               className="underline hover:text-foreground inline-flex items-center gap-0.5">
              {link.label} <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </>
        )}
      </p>
    </div>
  );
}


// ─── Warning card ─────────────────────────────────────────────────────────────
// Amber advisory box for absent-but-important data (EPC missing, tenure uncertain,
// leasehold terms unavailable). Small footprint — never a big empty panel.

function WarningCard({
  message, ctaText, ctaUrl, level = "amber",
}: {
  message: string;
  ctaText?: string | null;
  ctaUrl?:  string | null;
  level?: "amber" | "neutral";
}) {
  const colours = level === "amber"
    ? "border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/15 text-amber-800 dark:text-amber-300"
    : "border-border/40 bg-muted/20 text-muted-foreground";
  return (
    <div className={`rounded-lg border px-4 py-3 flex items-start gap-2.5 ${colours}`}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-70" />
      <div className="flex-1">
        <p className="text-[11px] leading-relaxed">{message}</p>
        {ctaText && ctaUrl && (
          <a
            href={ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold underline opacity-80 hover:opacity-100"
          >
            {ctaText} <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Partial note ─────────────────────────────────────────────────────────────
// Compact footer shown when a card is in partial state.

function PartialNote({ result }: { result: CompletenessResult }) {
  if (!result.confirmedNote && !result.sparseMessage) return null;
  return (
    <p className="text-[10px] text-muted-foreground/70 mt-3 leading-relaxed flex gap-1.5 items-start">
      <Info className="h-3 w-3 shrink-0 mt-0.5" />
      {result.confirmedNote ?? result.sparseMessage}
    </p>
  );
}

// ─── Section heading with provenance chip ─────────────────────────────────────

function SectionHeading({
  id, label, provenance, badge,
}: {
  id: string;
  label: string;
  provenance?: string | null;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h2 id={id} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        {label}
      </h2>
      <div className="flex items-center gap-2">
        {provenance && <ProvenanceChip label={provenance} />}
        {badge}
      </div>
    </div>
  );
}

// ─── Price trend SVG chart ────────────────────────────────────────────────────

// ─── Property hero ────────────────────────────────────────────────────────────
// The main identity block at the top of every result page.
// Left: address + key confirmed facts  Right: estimate panel

function PropertyHero({
  report,
  isPro,
}: {
  report: ValuationReport;
  isPro: boolean;
}) {
  const pf = report.propertyFacts;
  const est = report.estimate;

  // Build the compact key-fact pills — only show confirmed facts
  const factPills: { icon: React.ReactNode; text: string }[] = [];
  if (pf.propertyType) factPills.push({ icon: <Home className="h-3.5 w-3.5" />, text: pf.propertyType });
  if (pf.tenure) factPills.push({ icon: <Layers className="h-3.5 w-3.5" />, text: pf.tenure });
  if (pf.floorAreaM2) factPills.push({ icon: <Ruler className="h-3.5 w-3.5" />, text: `${pf.floorAreaM2} m²` });
  if (pf.epcBand) factPills.push({ icon: <Leaf className="h-3.5 w-3.5" />, text: `EPC ${pf.epcBand}` });
  if (pf.bedroomsEst) factPills.push({ icon: <Building className="h-3.5 w-3.5" />, text: pf.bedroomsEst });

  const hasLastSale = !!(report.lastSoldPrice && report.lastSoldDate);
  const sinceLastSale = report.sinceLastSale;
  const isUp = sinceLastSale ? sinceLastSale.changeAmount >= 0 : null;

  const confidenceColour =
    report.valuationState === "strong" && report.confidence === "High"
      ? "border-green-500/50 text-green-700 dark:text-green-400 bg-green-50/80 dark:bg-green-950/20"
      : report.valuationState === "strong" && report.confidence === "Medium"
      ? "border-primary/40 text-primary bg-primary/5"
      : report.valuationState === "indicative"
      ? "border-amber-400/50 text-amber-700 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/20"
      : "border-border text-muted-foreground bg-muted";

  return (
    <section aria-labelledby="val-hero-address" className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* ── Property identity strip ─────────────────────────────────────────── */}
      <div className="px-6 sm:px-8 pt-7 pb-5 border-b border-border/40">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary mb-2">
          Property profile
        </p>
        <h1 id="val-hero-address" className="font-serif text-2xl sm:text-3xl text-foreground leading-tight tracking-tight">
          {report.queryPostcode}
        </h1>
        {report.localAuthority && (
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {report.localAuthority}
          </p>
        )}

        {/* Confirmed property fact pills */}
        {factPills.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {factPills.map((p) => (
              <span
                key={p.text}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground border border-border/50 bg-background rounded-full px-3 py-1"
              >
                {p.icon}
                {p.text}
              </span>
            ))}
            {pf.tenureConfidence === "inferred" && pf.tenure && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600/80 dark:text-amber-400/70 border border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/10 rounded-full px-2.5 py-0.5">
                Tenure inferred
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Main hero body ──────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border/40">

        {/* Left: property identity / map placeholder */}
        <div className="relative min-h-[180px] sm:min-h-[220px] bg-muted/20 flex flex-col items-center justify-center p-6 sm:p-8 overflow-hidden">
          {/* Map-style decorative pattern as tasteful fallback */}
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
            viewBox="0 0 400 260"
            fill="none"
          >
            {/* Street grid pattern */}
            {[40, 80, 120, 160, 200, 240, 280, 320, 360].map(x => (
              <line key={`v${x}`} x1={x} y1="0" x2={x} y2="260" stroke="currentColor" strokeWidth="1" />
            ))}
            {[40, 80, 120, 160, 200, 240].map(y => (
              <line key={`h${y}`} x1="0" y1={y} x2="400" y2={y} stroke="currentColor" strokeWidth="1" />
            ))}
            <circle cx="200" cy="130" r="20" fill="currentColor" opacity="0.6" />
          </svg>

          {/* House icon and postcode */}
          <div className="relative flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl border border-border/60 bg-background flex items-center justify-center mb-3 shadow-sm">
              <Home className="h-7 w-7 text-primary/60" />
            </div>
            <p className="font-serif text-base font-semibold text-foreground">{report.queryPostcode}</p>
            {report.localAuthority && (
              <p className="text-xs text-muted-foreground mt-0.5">{report.localAuthority}</p>
            )}
            {hasLastSale && (
              <p className="text-[11px] text-muted-foreground/70 mt-2">
                Last sold {fmt(report.lastSoldPrice!)} · {fmtDate(report.lastSoldDate!)}
              </p>
            )}
          </div>
        </div>

        {/* Right: estimate panel */}
        <div className="p-6 sm:p-8 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                Estimated value
              </p>
              <span className={`text-[10px] font-semibold border rounded-full px-2.5 py-0.5 ${confidenceColour}`}>
                {report.valuationState === "unavailable"
                  ? "Insufficient data"
                  : report.valuationState === "indicative"
                  ? "Indicative"
                  : `${report.confidence} confidence`}
              </span>
            </div>

            {est ? (
              <>
                {/* Main estimate — mid prominent, low/high flanking */}
                <div className="flex items-end gap-3 mb-1">
                  <div className="flex-1 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Low</p>
                    <p className="font-serif text-lg text-muted-foreground">{fmt(est.low)}</p>
                  </div>
                  <div className="flex-[1.6] text-center">
                    <p className="text-[9px] uppercase tracking-wider text-primary mb-0.5">Mid estimate</p>
                    <p className="font-serif text-3xl sm:text-4xl font-semibold text-foreground leading-none">{fmt(est.mid)}</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">High</p>
                    <p className="font-serif text-lg text-muted-foreground">{fmt(est.high)}</p>
                  </div>
                </div>

                {/* Since-last-sale one-liner */}
                {sinceLastSale && (
                  <p className={`text-xs font-semibold text-center mt-2 ${isUp ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                    {isUp ? "▲" : "▼"} {isUp ? "+" : ""}{fmt(Math.abs(sinceLastSale.changeAmount))} ({isUp ? "+" : ""}{sinceLastSale.changePercent}%) since last recorded sale
                  </p>
                )}

                <p className="text-[10px] text-muted-foreground/70 text-center mt-2 leading-relaxed">
                  {report.confidenceNote}
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground mb-1">Valuation unavailable</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{report.confidenceNote}</p>
              </div>
            )}
          </div>

          {/* Freshness + search radius metadata */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 border-t border-border/30">
            <FreshnessBadge status={report.meta.comparables.freshnessStatus} />
            {report.comparableCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {report.comparableCount} comparable{report.comparableCount !== 1 ? "s" : ""}
                {report.searchRadiusUsed > 0 ? ` · ${report.searchRadiusUsed} mi radius` : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Sold nearby card grid ────────────────────────────────────────────────────
// Card-first presentation of comparables. On desktop: 3-col grid.
// On mobile: horizontal scroll strip.

function SoldNearbyCardGrid({
  comparables,
  estimate,
  isSignedIn,
  onUnlock,
}: {
  comparables: ComparableSale[];
  estimate: { low: number; mid: number; high: number } | null;
  isSignedIn: boolean;
  onUnlock: () => void;
}) {
  const limit = isSignedIn ? comparables.length : Math.min(comparables.length, 4);
  const visible = comparables.slice(0, limit);
  const hidden  = comparables.length - limit;

  if (!visible.length) return null;

  function propTypeIcon(type: string) {
    if (type === "Flat") return <Building className="h-3.5 w-3.5" />;
    return <Home className="h-3.5 w-3.5" />;
  }

  function deltaLabel(delta: number | null): React.ReactNode | null {
    if (delta === null) return null;
    const isAbove = delta > 0;
    return (
      <span className={`text-[9px] font-semibold uppercase tracking-wide ${isAbove ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
        {isAbove ? "+" : ""}{delta}% vs mid
      </span>
    );
  }

  return (
    <div>
      {/* Mobile: horizontal scroll; Desktop: 3-col grid */}
      <div className="flex sm:grid sm:grid-cols-3 gap-3 overflow-x-auto pb-1 sm:pb-0 -mx-4 sm:mx-0 px-4 sm:px-0 snap-x snap-mandatory sm:snap-none">
        {visible.map((c, i) => (
          <div
            key={i}
            className="snap-start shrink-0 w-[240px] sm:w-auto rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors"
          >
            {/* Top: icon + price */}
            <div className="flex items-start justify-between gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center text-primary/60 shrink-0">
                {propTypeIcon(c.propertyType)}
              </div>
              <div className="text-right">
                <p className="font-serif text-base font-semibold text-foreground leading-none">{fmt(c.soldPrice)}</p>
                {estimate && deltaLabel(c.deltaVsMid)}
              </div>
            </div>

            {/* Address */}
            <p className="text-[11px] font-medium text-foreground leading-snug line-clamp-2">
              {c.address}
              {c.isNewBuild && (
                <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-primary/70 border border-primary/30 rounded px-1">New build</span>
              )}
            </p>

            {/* Facts row */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto">
              <span className="text-[10px] text-muted-foreground">{c.propertyType}</span>
              <span className="text-[10px] text-muted-foreground">{c.tenure}</span>
              {c.distanceMiles === 0
                ? <span className="text-[10px] text-primary/70 font-medium">Same postcode</span>
                : <span className="text-[10px] text-muted-foreground">{c.distanceMiles} mi</span>
              }
            </div>

            {/* Date */}
            <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {fmtDate(c.soldDate)}
            </p>
          </div>
        ))}
      </div>

      {/* Unlock gate for non-signed-in users */}
      {!isSignedIn && hidden > 0 && (
        <div className="mt-3 rounded-xl border border-border/50 bg-card/60 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {hidden} more comparable sale{hidden !== 1 ? "s" : ""} available
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create a free account to see all recorded sales in this postcode.
            </p>
          </div>
          <button
            onClick={onUnlock}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/40 rounded-lg px-4 py-2 hover:bg-primary/5 transition-colors"
          >
            Unlock free <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Property timeline ────────────────────────────────────────────────────────
// Evidence-led history strip. Shows known sale events in reverse chronological
// order. Handles 1-event minimal state gracefully.

function PropertyTimeline({ history }: { history: PropertyHistory }) {
  const [expanded, setExpanded] = useState(false);

  if (history.totalEvents === 0) return null;

  const COLLAPSE_THRESHOLD = 5;
  const showAll = expanded || history.totalEvents <= COLLAPSE_THRESHOLD;
  const visible = showAll ? history.events : history.events.slice(0, COLLAPSE_THRESHOLD);
  const hiddenCount = history.totalEvents - COLLAPSE_THRESHOLD;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
      {history.totalEvents === 1 ? (
        // Minimal single-event version
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center text-primary/60 shrink-0">
            <History className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {history.events[0].priceGBP ? fmt(history.events[0].priceGBP) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Sold {fmtDate(history.events[0].date)}
              {history.events[0].detail ? ` · ${history.events[0].detail}` : ""}
            </p>
          </div>
        </div>
      ) : (
        // Full timeline
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border/50 sm:left-[19px]" />

          <ol className="space-y-0">
            {visible.map((ev, i) => {
              const isFirst = i === 0;
              return (
                <li key={i} className={`relative flex gap-4 sm:gap-5 ${i > 0 ? "pt-5" : ""}`}>
                  {/* Timeline dot */}
                  <div className={`relative z-10 w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
                    ev.isSubject
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : isFirst
                      ? "border-border bg-card text-muted-foreground"
                      : "border-border/50 bg-background text-muted-foreground/60"
                  }`}>
                    <Calendar className="h-3.5 w-3.5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`text-[11px] font-semibold uppercase tracking-wider ${ev.isSubject ? "text-primary" : "text-muted-foreground"}`}>
                        {ev.label}
                        {ev.isSubject && <span className="ml-1.5 text-[9px] border border-primary/30 rounded px-1.5 py-0.5 normal-case tracking-normal">This postcode</span>}
                      </p>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{fmtDate(ev.date)}</span>
                    </div>
                    <p className="font-serif text-base font-semibold text-foreground mt-0.5">
                      {ev.priceGBP ? fmt(ev.priceGBP) : "—"}
                    </p>
                    {ev.address && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{ev.address}</p>
                    )}
                    {ev.detail && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{ev.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Expand / collapse */}
          {history.totalEvents > COLLAPSE_THRESHOLD && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-4 ml-12 sm:ml-14 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="h-3.5 w-3.5" /> Show fewer</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5" /> Show {hiddenCount} more sale{hiddenCount !== 1 ? "s" : ""}</>
              )}
            </button>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/60 mt-4 pt-3 border-t border-border/30 flex items-center gap-1.5">
        <Info className="h-3 w-3 shrink-0" />
        Sale events from HM Land Registry Price Paid Data. Does not include off-market transactions or sales not yet registered.
      </p>
    </div>
  );
}

// ─── Property map panel ───────────────────────────────────────────────────────
// Lightweight location context strip. Uses OpenStreetMap static tile as a
// fallback visual — not an interactive map product.

function PropertyMapPanel({ postcode, localAuthority }: { postcode: string; localAuthority: string | null }) {
  const mapUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(postcode)}#map=15`;
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Map placeholder with street-grid decoration */}
      <div className="relative h-[120px] sm:h-[140px] bg-muted/30 flex items-center justify-center overflow-hidden">
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none"
          viewBox="0 0 600 160"
          fill="none"
        >
          {[30, 90, 150, 210, 270, 330, 390, 450, 510, 570].map(x => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="160" stroke="currentColor" strokeWidth="1" />
          ))}
          {[30, 70, 110, 150].map(y => (
            <line key={`h${y}`} x1="0" y1={y} x2="600" y2={y} stroke="currentColor" strokeWidth="1" />
          ))}
          <circle cx="300" cy="80" r="14" fill="currentColor" opacity="0.7" />
          <circle cx="300" cy="80" r="28" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        </svg>
        {/* Location pin */}
        <div className="relative flex flex-col items-center gap-1.5 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-primary/60 bg-background flex items-center justify-center shadow-md">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <p className="text-xs font-semibold text-foreground bg-background/90 rounded-full px-3 py-0.5 border border-border/40">
            {postcode}
          </p>
        </div>
      </div>

      {/* Footer strip */}
      <div className="px-5 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-foreground">{postcode}</p>
          {localAuthority && (
            <p className="text-[11px] text-muted-foreground">{localAuthority}</p>
          )}
        </div>
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors shrink-0"
        >
          <Navigation className="h-3.5 w-3.5" />
          View on map
        </a>
      </div>
    </div>
  );
}



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


// ─── Deal Quality Verdict ─────────────────────────────────────────────────────
// Derives a single plain-English verdict by comparing asking price vs the
// fair value band. Displayed prominently in the PropertyHero section.

type DealQuality = "well_priced" | "fairly_priced" | "above_comparables" | "insufficient_data";

function getDealQuality(
  askingPrice: number | null,
  estimate: { low: number; mid: number; high: number } | null,
  comparableCount: number,
): DealQuality {
  if (!estimate || comparableCount < 3) return "insufficient_data";
  if (!askingPrice) return "insufficient_data";
  if (askingPrice <= estimate.low) return "well_priced";
  if (askingPrice <= estimate.high) return "fairly_priced";
  return "above_comparables";
}

const DEAL_QUALITY_CONFIG: Record<DealQuality, {
  label: string;
  explanation: string;
  chipClass: string;
  icon: React.ReactNode;
}> = {
  well_priced: {
    label: "Well priced",
    explanation: "The asking price is at or below the range supported by recent comparable sales.",
    chipClass: "bg-green-50 border-green-400/50 text-green-800 dark:bg-green-950/30 dark:border-green-500/40 dark:text-green-300",
    icon: <ThumbsUp className="h-3.5 w-3.5" />,
  },
  fairly_priced: {
    label: "Fairly priced",
    explanation: "The asking price is in line with what similar properties have sold for nearby.",
    chipClass: "bg-blue-50 border-blue-400/50 text-blue-800 dark:bg-blue-950/30 dark:border-blue-500/40 dark:text-blue-300",
    icon: <BadgeCheck className="h-3.5 w-3.5" />,
  },
  above_comparables: {
    label: "Priced above comparables",
    explanation: "The asking price is higher than recent comparable sales suggest. Condition or demand may justify a premium — but go in informed.",
    chipClass: "bg-amber-50 border-amber-400/50 text-amber-800 dark:bg-amber-950/30 dark:border-amber-500/40 dark:text-amber-300",
    icon: <ThumbsDown className="h-3.5 w-3.5" />,
  },
  insufficient_data: {
    label: "Insufficient data",
    explanation: "We don't have enough recent comparable sales to make a reliable assessment. Treat this range as indicative only.",
    chipClass: "bg-muted border-border text-muted-foreground",
    icon: <Minus className="h-3.5 w-3.5" />,
  },
};

function DealQualityBadge({ quality }: { quality: DealQuality }) {
  const cfg = DEAL_QUALITY_CONFIG[quality];
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${cfg.chipClass}`}>
      {cfg.icon}
      {cfg.label}
    </div>
  );
}

// ─── Asking Price Bar ─────────────────────────────────────────────────────────
// Visual fair value band with the asking price plotted as a marker.
// If the asking price is outside the band, the bar extends to show the gap.

function AskingPriceBar({
  estimate,
  askingPrice,
}: {
  estimate: { low: number; mid: number; high: number };
  askingPrice: number | null;
}) {
  if (!askingPrice) return null;

  // Determine the full range to render including asking price
  const barMin = Math.min(estimate.low, askingPrice) * 0.995;
  const barMax = Math.max(estimate.high, askingPrice) * 1.005;
  const totalSpan = barMax - barMin;

  const bandLeft  = ((estimate.low  - barMin) / totalSpan) * 100;
  const bandWidth = ((estimate.high - estimate.low) / totalSpan) * 100;
  const midPct    = ((estimate.mid  - barMin) / totalSpan) * 100;
  const askPct    = ((askingPrice   - barMin) / totalSpan) * 100;

  const askingAbove = askingPrice > estimate.high;
  const askingBelow = askingPrice < estimate.low;

  return (
    <div className="mt-4 mb-2">
      <div className="relative h-5 rounded-full bg-muted/50 overflow-visible">
        {/* Fair value band — the green/teal zone */}
        <div
          className="absolute top-0 h-full rounded-full bg-primary/20 border border-primary/30"
          style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
        />
        {/* Mid marker — thin vertical line */}
        <div
          className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-primary/60 rounded-full"
          style={{ left: `${midPct}%`, transform: "translateX(-50%)" }}
        />
        {/* Asking price marker */}
        <div
          className={`absolute top-[-4px] bottom-[-4px] w-1 rounded-full shadow-sm ${
            askingAbove ? "bg-amber-500" : askingBelow ? "bg-green-500" : "bg-foreground"
          }`}
          style={{ left: `${askPct}%`, transform: "translateX(-50%)" }}
        />
      </div>
      {/* Legend */}
      <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
        <span>Conservative <span className="font-semibold text-foreground">£{estimate.low.toLocaleString("en-GB")}</span></span>
        <span className="hidden sm:inline">Likely <span className="font-semibold text-foreground">£{estimate.mid.toLocaleString("en-GB")}</span></span>
        <span>Optimistic <span className="font-semibold text-foreground">£{estimate.high.toLocaleString("en-GB")}</span></span>
      </div>
      {askingPrice && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className={`h-2.5 w-2.5 rounded-full ${askingAbove ? "bg-amber-500" : askingBelow ? "bg-green-500" : "bg-foreground"}`} />
          Asking price: <span className="font-semibold text-foreground">£{askingPrice.toLocaleString("en-GB")}</span>
          {askingAbove && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              — £{(askingPrice - estimate.high).toLocaleString("en-GB")} above the comparable range
            </span>
          )}
          {askingBelow && (
            <span className="text-green-700 dark:text-green-400 font-medium">
              — £{(estimate.low - askingPrice).toLocaleString("en-GB")} below the comparable range
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Honest Confidence Signal ─────────────────────────────────────────────────
// Plain-English, cites actual numbers. Replaces vague "High/Medium/Low" label.

function ConfidenceSignal({
  comparableCount,
  searchRadiusMiles,
  valuationState,
}: {
  comparableCount: number;
  searchRadiusMiles: number;
  valuationState: string;
}) {
  const radiusText = searchRadiusMiles === 0
    ? "same postcode"
    : `${searchRadiusMiles} mile${searchRadiusMiles === 1 ? "" : "s"} of this postcode`;

  const quality =
    valuationState === "unavailable"
      ? null
      : comparableCount >= 8
      ? "solid"
      : comparableCount >= 4
      ? "moderate"
      : "thin";

  if (!quality) return null;

  const qualityText =
    quality === "solid"
      ? "solid data"
      : quality === "moderate"
      ? "reasonable data"
      : "treat this range as indicative";

  const qualityColour =
    quality === "solid"
      ? "text-green-700 dark:text-green-400"
      : quality === "moderate"
      ? "text-blue-600 dark:text-blue-400"
      : "text-amber-600 dark:text-amber-400";

  return (
    <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
      Based on{" "}
      <span className="font-semibold text-foreground">{comparableCount} comparable sale{comparableCount === 1 ? "" : "s"}</span>{" "}
      within the {radiusText} —{" "}
      <span className={`font-medium ${qualityColour}`}>{qualityText}</span>.
    </p>
  );
}

// ─── Risk Alert Strip ─────────────────────────────────────────────────────────
// Surfaces deal-breaker signals before the user reads the full sections.
// Shown only when Flag conditions exist. Each alert is one sentence max.

interface RiskAlert {
  id: string;
  icon: React.ReactNode;
  message: string;
  level: "critical" | "warning";
}

function buildRiskAlerts(report: ValuationReport): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  const ls = report.leaseholdSummary;
  const epc = report.epc;
  const pf = report.propertyFacts;

  // Leasehold — short lease
  if (ls.isLeasehold && ls.leaseYearsRemaining !== null) {
    if (ls.leaseWarning === "critical") {
      alerts.push({
        id: "leasehold_critical",
        level: "critical",
        icon: <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
        message: `This property has a ${ls.leaseYearsRemaining}-year lease. Leases under 80 years can be expensive to extend and may affect mortgage eligibility. Ask the vendor's solicitor for full lease terms before proceeding.`,
      });
    } else if (ls.leaseWarning === "caution") {
      alerts.push({
        id: "leasehold_caution",
        level: "warning",
        icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
        message: `This property has a ${ls.leaseYearsRemaining}-year lease. As the lease shortens below 80 years, extension costs rise and mortgageability may be affected.`,
      });
    }
  }

  // EPC F/G
  if (epc && (epc.band === "F" || epc.band === "G")) {
    alerts.push({
      id: "epc_low",
      level: "warning",
      icon: <BatteryLow className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
      message: `This property has an EPC rating of ${epc.band}. This is below average and will cost more to heat. It may be unmortgageable for buy-to-let purposes. Factor in retrofit costs before making an offer.`,
    });
  }

  // Flood risk — from ownershipCosts floodRiskNote (present if zone 2/3)
  const floodNote = report.ownershipCosts?.floodRiskNote;
  if (floodNote && floodNote.toLowerCase().includes("zone 3")) {
    alerts.push({
      id: "flood_3",
      level: "critical",
      icon: <Waves className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
      message: "This postcode is in Flood Zone 3 (high probability of flooding). This is a material risk. Review the Environment Agency flood maps and discuss with your conveyancer.",
    });
  } else if (floodNote && floodNote.toLowerCase().includes("zone 2")) {
    alerts.push({
      id: "flood_2",
      level: "warning",
      icon: <Waves className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
      message: "This postcode is in Flood Zone 2 (medium probability of flooding). Buildings insurance may be more expensive. Get a specific insurance quote before exchange.",
    });
  }

  // Planning — more than 2 applications
  if (report.planning.length > 2) {
    alerts.push({
      id: "planning",
      level: "warning",
      icon: <Hammer className="h-3.5 w-3.5 shrink-0 mt-0.5" />,
      message: `There are ${report.planning.length} planning applications within the area in the past 3 years. Review these before committing — they could affect your enjoyment or the property's future value.`,
    });
  }

  return alerts;
}

function RiskAlertStrip({ report }: { report: ValuationReport }) {
  const alerts = buildRiskAlerts(report);
  if (alerts.length === 0) return null;

  return (
    <section aria-label="Risk alerts" className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={`flex gap-2.5 items-start rounded-xl border px-4 py-3 ${
            a.level === "critical"
              ? "border-red-300/60 bg-red-50/70 dark:bg-red-950/20 dark:border-red-500/30 text-red-800 dark:text-red-300"
              : "border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
          }`}
        >
          <span className={a.level === "critical" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}>
            {a.icon}
          </span>
          <p className="text-[11px] leading-relaxed">{a.message}</p>
        </div>
      ))}
    </section>
  );
}

// ─── Recommended Opening Offer ────────────────────────────────────────────────
// Derives a single £ figure and a short rationale. No asking price input required
// on the page — the block adapts based on where asking price sits vs the band.
// (If no asking price is known, it anchors to the 40th percentile of the band.)

function RecommendedOpeningOffer({
  estimate,
  askingPrice,
  comparableCount,
}: {
  estimate: { low: number; mid: number; high: number };
  askingPrice: number | null;
  comparableCount: number;
}) {
  if (comparableCount < 3) return null;

  // Calculate opening offer
  let openingOffer: number;
  let rationale: string;
  let headroomNote: string;

  if (!askingPrice) {
    // No asking price — anchor to 40th percentile of the band
    openingOffer = Math.round((estimate.low + (estimate.mid - estimate.low) * 0.4) / 1000) * 1000;
    rationale = "Based on the comparable range, a reasonable opening offer would be:";
    headroomNote = `This leaves approx. £${(estimate.mid - openingOffer).toLocaleString("en-GB")} of negotiation room to the midpoint of the fair value band.`;
  } else if (askingPrice > estimate.high) {
    openingOffer = Math.round(estimate.low * 1.01 / 1000) * 1000;
    rationale = `The asking price of £${askingPrice.toLocaleString("en-GB")} sits above the comparable range. An opening offer consistent with what similar properties have actually sold for would be:`;
    headroomNote = `This leaves approx. £${(estimate.mid - openingOffer).toLocaleString("en-GB")} of negotiation room to the midpoint of the fair value band.`;
  } else if (askingPrice >= estimate.low && askingPrice <= estimate.high) {
    openingOffer = Math.round(askingPrice * 0.94 / 1000) * 1000;
    rationale = `The asking price of £${askingPrice.toLocaleString("en-GB")} sits within the comparable range. An opening offer that leaves negotiating room while remaining credible would be:`;
    headroomNote = `This leaves approx. £${(askingPrice - openingOffer).toLocaleString("en-GB")} of room to the asking price, and £${(estimate.mid - openingOffer).toLocaleString("en-GB")} to the midpoint of the fair value band.`;
  } else {
    // Asking price below the band — competitive pricing
    openingOffer = Math.round(askingPrice * 0.98 / 1000) * 1000;
    rationale = `The asking price looks competitively set — below what similar properties have sold for. Similar properties have sold for up to £${estimate.high.toLocaleString("en-GB")}. You may face competition.`;
    headroomNote = "Consider whether to offer close to or at asking price to remain competitive.";
  }

  return (
    <section aria-labelledby="val-opening-offer-heading" className="rounded-2xl border border-border/60 bg-card p-6 sm:p-7">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Target className="h-4 w-4" />
        </div>
        <div>
          <h2 id="val-opening-offer-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-0.5">Recommended opening offer</h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">{rationale}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="font-serif text-4xl font-semibold text-foreground tracking-tight">
            £{openingOffer.toLocaleString("en-GB")}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-sm">{headroomNote}</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-muted/30 px-4 py-3 text-[10px] text-muted-foreground leading-relaxed max-w-xs">
          <strong className="text-foreground font-medium block mb-0.5">Starting point only.</strong>
          Always instruct a RICS-accredited surveyor before exchanging contracts. A surveyor may identify issues that affect the value.
        </div>
      </div>
    </section>
  );
}

// ─── Market Pulse Strip ───────────────────────────────────────────────────────
// Three compact data points: comparable sales activity, radius used, data recency.
// Replaces vague confidence label with specific, actionable signals.

function MarketPulseStrip({
  report,
}: {
  report: ValuationReport;
}) {
  const { comparableCount, searchRadiusUsed, meta, comparableSelectionMeta: csm } = report;

  // Most recent comparable date
  const sortedComps = [...report.comparables].sort(
    (a, b) => new Date(b.soldDate).getTime() - new Date(a.soldDate).getTime()
  );
  const mostRecentSale = sortedComps[0]?.soldDate ?? null;
  const mostRecentLabel = mostRecentSale
    ? new Date(mostRecentSale).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : null;

  // Months since oldest comparable
  const oldestSale = sortedComps[sortedComps.length - 1]?.soldDate ?? null;
  const monthsWindow = oldestSale
    ? Math.round((Date.now() - new Date(oldestSale).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null;

  const dataItems: { label: string; value: string; sub?: string; colour?: string }[] = [
    {
      label: "Comparable sales used",
      value: String(comparableCount),
      sub: monthsWindow ? `past ${monthsWindow} months` : undefined,
      colour: comparableCount >= 6 ? "text-green-600 dark:text-green-400" : comparableCount >= 3 ? "text-foreground" : "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Search radius",
      value: searchRadiusUsed === 0 ? "Same postcode" : `${searchRadiusUsed} mile${searchRadiusUsed === 1 ? "" : "s"}`,
      sub: searchRadiusUsed > 0.5 ? "radius expanded" : "tight radius",
      colour: searchRadiusUsed > 1 ? "text-amber-600 dark:text-amber-400" : "text-foreground",
    },
    {
      label: "Most recent sale",
      value: mostRecentLabel ?? "Unknown",
      sub: "in the data",
      colour: "text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 rounded-xl border border-border/50 bg-card/60 overflow-hidden">
      {dataItems.map((item, i) => (
        <div key={i} className={`px-4 py-3 ${i < dataItems.length - 1 ? "border-r border-border/40" : ""}`}>
          <p className={`text-lg font-semibold font-serif ${item.colour ?? "text-foreground"}`}>{item.value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider leading-tight">{item.label}</p>
          {item.sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{item.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Cost to Buy Summary ──────────────────────────────────────────────────────
// SDLT + indicative solicitor fees + survey types + mortgage arrangement fee.
// First-time buyers consistently underestimate total purchase costs.

function CostToBuySummary({
  report,
}: {
  report: ValuationReport;
}) {
  const sdlt = report.sdlt;
  const purchasePrice = sdlt?.purchasePrice ?? report.estimate?.mid ?? null;

  if (!purchasePrice) return null;

  const isFirstTimeBuyer = sdlt?.firstTimeBuyer !== null && sdlt?.firstTimeBuyer !== undefined;
  const sdltStandard = sdlt?.standardBuyer ?? null;
  const sdltFTB = sdlt?.firstTimeBuyer ?? null;

  // Indicative cost ranges
  const solicitorLow = 1500;
  const solicitorHigh = 3000;
  const surveyConditionLow = 400;
  const surveyConditionHigh = 600;
  const surveyHomebuyerLow = 500;
  const surveyHomebuyerHigh = 1000;
  const surveyStructuralLow = 800;
  const surveyStructuralHigh = 1500;
  const mortgageFeeNote = "£0–£1,500 (many lenders offer fee-free options)";

  // Total indicative range (using HomeBuyer survey as default)
  const totalLow = (sdltFTB ?? sdltStandard ?? 0) + solicitorLow + surveyHomebuyerLow + 0;
  const totalHigh = (sdltFTB ?? sdltStandard ?? 0) + solicitorHigh + surveyHomebuyerHigh + 1500;

  return (
    <section aria-labelledby="val-cost-heading" className="rounded-2xl border border-border/60 bg-card p-6 sm:p-7">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <PoundSterling className="h-4 w-4" />
        </div>
        <div>
          <h2 id="val-cost-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-0.5">Estimated cost to buy</h2>
          <p className="text-xs text-muted-foreground">Based on a purchase price of £{purchasePrice.toLocaleString("en-GB")}. These are indicative figures — get quotes before committing.</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* SDLT */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/40">
          <div>
            <p className="text-sm font-medium text-foreground">Stamp Duty (SDLT)</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Source: HMRC rates effective 1 April 2025.{" "}
              <a href="https://www.gov.uk/stamp-duty-land-tax" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">gov.uk</a>
            </p>
          </div>
          <div className="text-right shrink-0">
            {sdltFTB !== null && sdltFTB !== undefined && (
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                £{sdltFTB.toLocaleString("en-GB")} <span className="text-[10px] font-normal text-muted-foreground">(FTB rate)</span>
              </p>
            )}
            {sdltStandard !== null && (
              <p className={`text-sm font-semibold ${sdltFTB !== null ? "text-muted-foreground text-xs line-through" : "text-foreground"}`}>
                £{sdltStandard.toLocaleString("en-GB")}
                {sdltFTB !== null && <span className="ml-1 text-[10px] font-normal no-underline">(standard)</span>}
              </p>
            )}
          </div>
        </div>

        {/* Solicitor */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/40">
          <div>
            <p className="text-sm font-medium text-foreground">Solicitor / conveyancing fees</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Indicative range for a residential purchase. Get quotes from at least two regulated firms.</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-foreground">£{solicitorLow.toLocaleString("en-GB")}–£{solicitorHigh.toLocaleString("en-GB")}</p>
          </div>
        </div>

        {/* Survey */}
        <div className="pb-3 border-b border-border/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Survey</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Always recommended before exchange. Three levels:</p>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            {[
              { type: "Condition Report", range: `£${surveyConditionLow}–£${surveyConditionHigh}`, note: "Basic. For newer properties in good condition." },
              { type: "HomeBuyer Report", range: `£${surveyHomebuyerLow}–£${surveyHomebuyerHigh}`, note: "Most common. Recommended for most purchases." },
              { type: "Full Structural Survey", range: `£${surveyStructuralLow}–£${surveyStructuralHigh}`, note: "For older, unusual, or high-value properties." },
            ].map((s) => (
              <div key={s.type} className="flex items-baseline justify-between gap-3 text-[11px]">
                <div>
                  <span className="font-medium text-foreground">{s.type}</span>
                  <span className="text-muted-foreground ml-1.5">— {s.note}</span>
                </div>
                <span className="font-semibold text-foreground shrink-0">{s.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mortgage arrangement fee */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/40">
          <div>
            <p className="text-sm font-medium text-foreground">Mortgage arrangement fee</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Many lenders offer fee-free products. Compare total cost of borrowing, not just the rate.</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-foreground">{mortgageFeeNote}</p>
          </div>
        </div>

        {/* Total */}
        <div className="flex items-start justify-between gap-4 pt-1">
          <div>
            <p className="text-sm font-semibold text-foreground">Total indicative cost to complete</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Excluding deposit and mortgage. Based on HomeBuyer Survey + FTB SDLT where eligible.</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-foreground">£{totalLow.toLocaleString("en-GB")}–£{totalHigh.toLocaleString("en-GB")}</p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[10px] text-muted-foreground/70 leading-relaxed border-t border-border/30 pt-3">
        These are indicative figures only. Get quotes from a regulated solicitor, chartered surveyor, and mortgage adviser before committing. Additional costs may include search fees (£250–£500), land registration (varies), and any leasehold-specific fees.
      </p>
    </section>
  );
}

// ─── Three-Step Action Panel ──────────────────────────────────────────────────
// The only element of its kind in the market. Tells buyers exactly what to do
// with the data they've just read.

function ThreeStepActionPanel({
  report,
  onSave,
}: {
  report: ValuationReport;
  onSave: () => void;
}) {
  const steps = [
    {
      number: "01",
      title: "Decide whether to view",
      icon: <Home className="h-4 w-4" />,
      body: "If the asking price sits above the comparable range and there are risk flags, it may not be worth your time. If it's fairly priced and the risk profile is clean, it's worth a look.",
    },
    {
      number: "02",
      title: "Set your maximum before you view",
      icon: <Target className="h-4 w-4" />,
      body: "Decide your walk-away price before you walk through the door. Use the Optimistic figure as your absolute ceiling — not the asking price. Write it down. Buyers who set a number in advance are less likely to overbid.",
    },
    {
      number: "03",
      title: "Use this data in negotiation",
      icon: <FileText className="h-4 w-4" />,
      body: "When you make an offer, you can reference the comparable sales directly. Agents expect buyers to negotiate. Citing specific sold prices in the same postcode is more persuasive than saying 'I think it's overpriced.'",
    },
  ];

  return (
    <section aria-labelledby="val-action-heading" className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0">
          <Users className="h-4 w-4" />
        </div>
        <div>
          <h2 id="val-action-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-0.5">What to do with this information</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">Three steps to turn this data into a decision.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-5">
        {steps.map((s) => (
          <div key={s.number} className="flex gap-4">
            <span className="font-serif text-3xl font-semibold text-primary/25 shrink-0 leading-none mt-0.5 select-none">{s.number}</span>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-primary/60">{s.icon}</span>
                <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-5 border-t border-primary/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[11px] text-muted-foreground max-w-md leading-relaxed">
          <strong className="text-foreground font-medium">Remember:</strong> This is a starting point based on official Land Registry data, not a formal valuation. Always instruct a RICS-accredited surveyor before exchanging contracts.
        </p>
        <Button size="sm" variant="outline" className="shrink-0 font-medium" onClick={onSave}>
          <Receipt className="h-3.5 w-3.5 mr-1.5" />
          Save this valuation
        </Button>
      </div>
    </section>
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
  // Optional asking price — user can enter to get deal quality verdict and opening offer
  const [askingPrice, setAskingPrice] = useState<number | null>(null);
  const [askingPriceInput, setAskingPriceInput] = useState("");
  // Effective valuation tier resolved server-side from both Brief and Valuation entitlements
  const [effectiveTier, setEffectiveTier] = useState<PlanTier>("free");
  const resultRef = useRef<HTMLDivElement>(null);

  // Returns the resolved tier — caller must call setEffectiveTier with the result.
  //
  // Fast path: if the user already has a global Professional/Investor plan (read from
  // authStore which re-validates against the DB on every page load), we know the answer
  // immediately — no API round-trip needed.
  //
  // Slow path: explorer users who may have bought a per-postcode Brief still need the
  // API call to check postcode_entitlements.
  async function resolveEntitlement(postcode: string): Promise<PlanTier> {
    if (!user?.id) return "free";

    // Fast path — global plan already confirms Pro/Investor access
    if (user.plan === "professional" || user.plan === "investor") {
      return user.plan;
    }

    // Slow path — explorer: check per-postcode Brief entitlements via API
    try {
      const res = await fetch(
        `/api/valuation-entitlement?userId=${encodeURIComponent(user.id)}&postcode=${encodeURIComponent(postcode)}`
      );
      if (res.ok) {
        const json = await res.json() as { effectiveValuationTier: PlanTier };
        return json.effectiveValuationTier ?? "free";
      }
    } catch {
      // Network error — fall back gracefully; user will see free-tier view
    }
    return "free";
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
      // Run valuation data fetch and entitlement resolution in parallel.
      // Both states are set atomically after Promise.all completes so the
      // Advanced Analysis gate always reflects the correct tier on first render.
      const [result, tier] = await Promise.all([
        runValuation(q),
        resolveEntitlement(q),
      ]);
      setEffectiveTier(tier);
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
          <div ref={resultRef} className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-8">

            {/* ════════════════════════════════════════════════════════════════
                1. ADDRESS HERO — property identity + estimate integrated
            ════════════════════════════════════════════════════════════════ */}
            <PropertyHero report={report} isPro={isPro} />

            {/* Indicative / radius caveats — shown directly under hero */}
            {report.valuationState === "indicative" && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-500/30 px-4 py-3 flex gap-2.5 items-start">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  <span className="font-semibold">Indicative estimate — limited sold-price evidence.</span>{" "}
                  This estimate is based on limited sold-price evidence within {report.searchRadiusUsed > 0 ? `${report.searchRadiusUsed} mile${report.searchRadiusUsed === 1 ? "" : "s"} of this postcode` : "this postcode"} and should be treated as directional only.
                  {report.fallbacksUsed?.includes("last_sold_anchor") && " The last recorded sale price was used as a supporting signal."}
                  {report.fallbacksUsed?.includes("ukhpi_anchor") && " Local authority average price data was used as a supporting signal."}
                </p>
              </div>
            )}
            {report.valuationState === "strong" && report.searchRadiusUsed > 0 && (
              <div className="rounded-xl border border-blue-200/60 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-500/20 px-4 py-3 flex gap-2 items-start">
                <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                  Comparable sales were drawn from within {report.searchRadiusUsed} mile{report.searchRadiusUsed === 1 ? "" : "s"} of this postcode and weighted by proximity, recency, and property type.
                </p>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                NEW: ASKING PRICE INPUT + DEAL QUALITY VERDICT + OPENING OFFER
            ════════════════════════════════════════════════════════════════ */}
            {report.estimate && (
              <section className="rounded-2xl border border-border/60 bg-card p-6 sm:p-7 space-y-4">
                {/* Header */}
                <div>
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-3">Fair value band</h2>

                  {/* Three-figure band */}
                  <div className="grid grid-cols-3 gap-3 mb-2">
                    {[
                      { label: "Conservative", tooltip: "The lower end of what comparable sales in this area support. Properties needing work or with less kerb appeal tend to sell here.", val: report.estimate.low },
                      { label: "Likely", tooltip: "The midpoint of recent comparable sales for this type of property. Your most reliable anchor point.", val: report.estimate.mid },
                      { label: "Optimistic", tooltip: "The upper end — well-presented, well-located examples that sold quickly.", val: report.estimate.high },
                    ].map((f) => (
                      <div key={f.label} className="rounded-xl border border-border/50 bg-background p-3 sm:p-4 text-center" title={f.tooltip}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{f.label}</p>
                        <p className="font-serif text-xl sm:text-2xl font-semibold text-foreground">£{f.val.toLocaleString("en-GB")}</p>
                      </div>
                    ))}
                  </div>

                  {/* Confidence signal */}
                  <ConfidenceSignal
                    comparableCount={report.comparableCount}
                    searchRadiusMiles={report.searchRadiusUsed}
                    valuationState={report.valuationState}
                  />
                </div>

                {/* Asking price input */}
                <div className="border-t border-border/40 pt-4">
                  <p className="text-[11px] text-muted-foreground mb-2 font-medium">
                    Enter the asking price to get a deal quality verdict and opening offer suggestion:
                  </p>
                  <div className="flex gap-2 max-w-xs">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">£</span>
                      <Input
                        className="pl-7 text-sm"
                        placeholder="e.g. 350000"
                        value={askingPriceInput}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          setAskingPriceInput(raw);
                          const n = parseInt(raw);
                          setAskingPrice(isNaN(n) || n < 10000 ? null : n);
                        }}
                        data-testid="input-asking-price"
                      />
                    </div>
                    {askingPrice && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground px-2" onClick={() => { setAskingPrice(null); setAskingPriceInput(""); }}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {/* Deal quality verdict — only when asking price is entered */}
                {askingPrice && report.estimate && (() => {
                  const quality = getDealQuality(askingPrice, report.estimate, report.comparableCount);
                  const cfg = DEAL_QUALITY_CONFIG[quality];
                  return (
                    <div className="border-t border-border/40 pt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <DealQualityBadge quality={quality} />
                      <p className="text-xs text-muted-foreground leading-relaxed max-w-md">{cfg.explanation}</p>
                    </div>
                  );
                })()}

                {/* Asking price bar — shown when estimate exists (optionally with asking price) */}
                <AskingPriceBar estimate={report.estimate} askingPrice={askingPrice} />

                {/* Methodology tooltip */}
                <details className="text-[10px] text-muted-foreground/70 cursor-pointer">
                  <summary className="flex items-center gap-1 hover:text-muted-foreground transition-colors list-none">
                    <HelpCircle className="h-3 w-3" /> How was this calculated?
                  </summary>
                  <p className="mt-2 leading-relaxed max-w-lg pl-4 border-l border-border/40">
                    We take every recorded sale within {report.searchRadiusUsed > 0 ? `${report.searchRadiusUsed} miles` : "the same postcode"} from HM Land Registry. We filter for the same property type, then take the median. No automated valuation models. No AI-generated estimates. Every figure traces back to an official Land Registry transaction record.
                    {" "}<a href="https://landregistry.data.gov.uk" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground inline-flex items-center gap-0.5">Land Registry Price Paid Data (OGL v3.0) <ExternalLink className="h-2.5 w-2.5" /></a>. Typically lags 2–8 weeks after completion.
                  </p>
                </details>
              </section>
            )}

            {/* ════════════════════════════════════════════════════════════════
                NEW: MARKET PULSE STRIP
            ════════════════════════════════════════════════════════════════ */}
            {report.comparables.length > 0 && (
              <MarketPulseStrip report={report} />
            )}

            {/* ════════════════════════════════════════════════════════════════
                NEW: RECOMMENDED OPENING OFFER
            ════════════════════════════════════════════════════════════════ */}
            {report.estimate && report.comparableCount >= 3 && (
              <RecommendedOpeningOffer
                estimate={report.estimate}
                askingPrice={askingPrice}
                comparableCount={report.comparableCount}
              />
            )}

            {/* ════════════════════════════════════════════════════════════════
                NEW: RISK ALERT STRIP
            ════════════════════════════════════════════════════════════════ */}
            <RiskAlertStrip report={report} />

            {/* ════════════════════════════════════════════════════════════════
                2. NEARBY SOLD EVIDENCE CARDS
            ════════════════════════════════════════════════════════════════ */}
            {report.comparables.length > 0 && (
              <section aria-labelledby="val-comps-heading">
                <SectionHeading
                  id="val-comps-heading"
                  label="Nearby sold evidence"
                  provenance="Confirmed from Land Registry"
                  badge={
                    !isSignedIn && report.comparables.length > 4 ? (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Full list free
                      </span>
                    ) : undefined
                  }
                />
                <SoldNearbyCardGrid
                  comparables={report.comparables}
                  estimate={report.estimate}
                  isSignedIn={isSignedIn}
                  onUnlock={() => setSignupOpen(true)}
                />
              </section>
            )}

            {/* ════════════════════════════════════════════════════════════════
                3. COMPARABLE SELECTION EXPLAINER (analytical layer)
            ════════════════════════════════════════════════════════════════ */}
            {report.comparableSelectionMeta && (
              <section aria-labelledby="val-comp-meta-heading">
                <SectionHeading id="val-comp-meta-heading" label="How comparables were selected" />
                <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
                  {(() => {
                    const m = report.comparableSelectionMeta;
                    return (
                      <>
                        <p className="text-sm text-foreground mb-4 leading-relaxed">{m.explainerLine}</p>
                        <div className="grid sm:grid-cols-3 gap-4 mb-4">
                          <div className="rounded-lg border border-border/50 bg-background p-3 text-center">
                            <p className="font-serif text-2xl font-semibold text-foreground">{m.candidatesFound}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Candidates found</p>
                          </div>
                          <div className="rounded-lg border border-border/50 bg-background p-3 text-center">
                            <p className="font-serif text-2xl font-semibold text-foreground">{m.selectedCount}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Used in estimate</p>
                          </div>
                          <div className="rounded-lg border border-border/50 bg-background p-3 text-center">
                            <p className="font-serif text-2xl font-semibold text-foreground">
                              {m.searchRadiusMiles === 0 ? "Same postcode" : `${m.searchRadiusMiles} mi`}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Search radius</p>
                          </div>
                        </div>
                        {m.weightingFactors.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Weighting applied</p>
                            <div className="flex flex-wrap gap-1.5">
                              {m.weightingFactors.map((f) => (
                                <span key={f} className="text-[10px] rounded-full border border-border/50 bg-background px-2.5 py-0.5 text-muted-foreground">{f}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {m.radiusExpanded && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mt-2">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Search radius was expanded beyond the immediate postcode due to limited local data.
                          </p>
                        )}
                        {m.thinDataFallback && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mt-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Thin data path used — estimate is indicative, not high-confidence.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </section>
            )}

            {/* ════════════════════════════════════════════════════════════════
                4. PROPERTY HISTORY TIMELINE
            ════════════════════════════════════════════════════════════════ */}
            {report.propertyHistory.totalEvents > 0 && (
              <section aria-labelledby="val-timeline-heading">
                <SectionHeading
                  id="val-timeline-heading"
                  label="Property history"
                  provenance="Confirmed from Land Registry"
                />
                <PropertyTimeline history={report.propertyHistory} />
              </section>
            )}

            {/* ════════════════════════════════════════════════════════════════
                5. LOCATION CONTEXT / MAP PANEL
            ════════════════════════════════════════════════════════════════ */}
            <section aria-labelledby="val-map-heading">
              <SectionHeading id="val-map-heading" label="Location" />
              <PropertyMapPanel postcode={report.queryPostcode} localAuthority={report.localAuthority} />
            </section>

            {/* ════════════════════════════════════════════════════════════════
                6. PROPERTY FACTS (moved up — belongs near identity)
            ════════════════════════════════════════════════════════════════ */}
            {(() => {
              const pfDecision = getPropertyFactsDecision(report.propertyFacts);
              if (pfDecision.state === "hidden") return null;
              const visibleRows = [...pfDecision.confirmedRows, ...pfDecision.inferredRows];
              return (
                <section aria-labelledby="val-facts-heading">
                  <SectionHeading
                    id="val-facts-heading"
                    label="Property details"
                    provenance={pfDecision.provenanceLabel}
                  />
                  <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
                    {pfDecision.isMinimal ? (
                      <div className="space-y-3">
                        {visibleRows.map((r) => (
                          <div key={r.label} className="flex items-baseline justify-between">
                            <span className="text-xs text-muted-foreground shrink-0 mr-4">{r.label}</span>
                            <div className="text-right">
                              <span className="text-xs font-medium text-foreground">{r.value}</span>
                              {r.caveat && <span className="block text-[10px] font-normal text-muted-foreground/60">{r.caveat}</span>}
                              {r.provenance === "inferred" && <span className="block text-[9px] font-normal text-amber-600/70 dark:text-amber-400/60 uppercase tracking-wide">Estimated</span>}
                            </div>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-border/30 flex items-start gap-2">
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                            Most property details are not available from current public records for this address. Verify type, tenure, and floor area directly with the seller or your solicitor.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-0 divide-y divide-border/30 sm:divide-y-0">
                          {pfDecision.confirmedRows.map((r) => (
                            <div key={r.label} className="flex items-baseline justify-between py-2.5 border-b border-border/30 last:border-0">
                              <span className="text-xs text-muted-foreground shrink-0 mr-4">{r.label}</span>
                              <span className="text-xs font-medium text-foreground text-right">
                                {r.value}
                                {r.caveat && <span className="block text-[10px] font-normal text-muted-foreground/60">{r.caveat}</span>}
                              </span>
                            </div>
                          ))}
                          {pfDecision.inferredRows.map((r) => (
                            <div key={r.label} className="flex items-baseline justify-between py-2.5 border-b border-border/30 last:border-0">
                              <span className="text-xs text-muted-foreground shrink-0 mr-4">{r.label}</span>
                              <div className="text-right">
                                <span className="text-xs font-medium text-foreground">{r.value}</span>
                                {r.caveat && <span className="block text-[10px] font-normal text-muted-foreground/60">{r.caveat}</span>}
                                <span className="block text-[9px] font-normal text-amber-600/70 dark:text-amber-400/60 uppercase tracking-wide">Estimated</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {pfDecision.missingCount > 0 && (
                          <div className="mt-4 pt-3 border-t border-border/30 flex items-start gap-2">
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                              {pfDecision.missingCount} detail{pfDecision.missingCount !== 1 ? "s" : ""} (floor area, council tax band, construction era) not available from current public records.
                              Always verify tenure and floor area with your solicitor.
                              Source: {report.propertyFacts.source}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>
              );
            })()}

            {/* ════════════════════════════════════════════════════════════════
                7. AREA PRICE TREND
            ════════════════════════════════════════════════════════════════ */}
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

            {/* ════════════════════════════════════════════════════════════════
                8. LEASEHOLD SUMMARY
            ════════════════════════════════════════════════════════════════ */}
            {(() => {
              const l        = report.leaseholdSummary;
              const lhDecision = getLeaseholdModuleDecision(l);
              if (lhDecision.state === "hidden") return null;
              if (lhDecision.state === "warning") {
                return (
                  <section aria-labelledby="val-leasehold-heading">
                    <SectionHeading id="val-leasehold-heading" label="Tenure" provenance={lhDecision.provenanceLabel} />
                    <WarningCard message={lhDecision.copy!} />
                  </section>
                );
              }
              if (lhDecision.state === "compact") {
                return (
                  <section aria-labelledby="val-leasehold-heading">
                    <SectionHeading id="val-leasehold-heading" label="Leasehold summary" provenance={lhDecision.provenanceLabel} />
                    <div className="rounded-xl border border-amber-400/40 bg-amber-50/30 dark:bg-amber-950/15 p-5 sm:p-6 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">Tenure</span>
                        <span className="text-xs font-semibold text-foreground">
                          Leasehold
                          {l.tenureConfidence === "inferred" && (
                            <span className="ml-1.5 text-[9px] font-normal text-amber-600/70 dark:text-amber-400/60 uppercase tracking-wide">Inferred</span>
                          )}
                        </span>
                      </div>
                      <WarningCard level="amber" message={lhDecision.copy!} />
                    </div>
                  </section>
                );
              }
              const borderClass = l.leaseWarning === "critical"
                ? "border-red-400/60 bg-red-50/40 dark:bg-red-950/20"
                : l.leaseWarning === "caution"
                ? "border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20"
                : "border-border/60 bg-card";
              return (
                <section aria-labelledby="val-leasehold-heading">
                  <SectionHeading id="val-leasehold-heading" label="Leasehold summary" provenance={lhDecision.provenanceLabel} />
                  <div className={`rounded-xl border p-5 sm:p-6 ${borderClass}`}>
                    {l.leaseWarning === "critical" && (
                      <div className="flex items-start gap-2.5 mb-4 rounded-md border border-red-400/50 bg-red-100/60 dark:bg-red-950/30 px-3.5 py-2.5">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-red-800 dark:text-red-300 leading-relaxed">
                          <span className="font-semibold">Short lease warning.</span> Leases under 80 years can significantly reduce mortgage availability and resale value. Legal advice is strongly recommended before proceeding.
                        </p>
                      </div>
                    )}
                    {l.leaseWarning === "caution" && (
                      <div className="flex items-start gap-2.5 mb-4 rounded-md border border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20 px-3.5 py-2.5">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                          <span className="font-semibold">Lease length to monitor.</span> Under 125 years remaining — factor in the cost of a lease extension before making an offer.
                        </p>
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-0 divide-y divide-border/30 sm:divide-y-0">
                      <div className="flex items-baseline justify-between py-2.5 border-b border-border/30">
                        <span className="text-xs text-muted-foreground shrink-0 mr-4">Tenure</span>
                        <span className="text-xs font-medium text-foreground text-right">
                          Leasehold
                          {l.tenureConfidence === "inferred" && (
                            <span className="block text-[9px] font-normal text-amber-600/70 dark:text-amber-400/60 uppercase tracking-wide">Inferred from comparables</span>
                          )}
                        </span>
                      </div>
                      {l.leaseYearsRemaining !== null && (
                        <div className="flex items-baseline justify-between py-2.5 border-b border-border/30 last:border-0">
                          <span className="text-xs text-muted-foreground shrink-0 mr-4">Years remaining</span>
                          <span className={`text-xs font-semibold text-right ${l.leaseWarning === "critical" ? "text-red-600 dark:text-red-400" : l.leaseWarning === "caution" ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                            ~{l.leaseYearsRemaining} years
                          </span>
                        </div>
                      )}
                      {(l.serviceChargeEstGBP !== null || l.serviceChargeNote) && (
                        <div className="flex items-baseline justify-between py-2.5 border-b border-border/30 last:border-0">
                          <span className="text-xs text-muted-foreground shrink-0 mr-4">Service charge</span>
                          <span className="text-xs font-medium text-foreground text-right">
                            {l.serviceChargeEstGBP !== null ? `~£${l.serviceChargeEstGBP.toLocaleString("en-GB")}/yr` : l.serviceChargeNote}
                          </span>
                        </div>
                      )}
                      {(l.groundRentEstGBP !== null || l.groundRentNote) && (
                        <div className="flex items-baseline justify-between py-2.5 border-b border-border/30 last:border-0">
                          <span className="text-xs text-muted-foreground shrink-0 mr-4">Ground rent</span>
                          <span className="text-xs font-medium text-foreground text-right">
                            {l.groundRentEstGBP !== null ? `~£${l.groundRentEstGBP.toLocaleString("en-GB")}/yr` : l.groundRentNote}
                          </span>
                        </div>
                      )}
                    </div>
                    {l.leaseYearsRemaining === null && (
                      <WarningCard level="amber" message="Lease length, service charge, and ground rent are not available from public records. Request the lease pack from the seller or their solicitor before proceeding." />
                    )}
                    {l.leaseYearsRemaining !== null && (l.serviceChargeEstGBP === null && !l.serviceChargeNote) && (
                      <p className="text-[10px] text-muted-foreground/60 mt-3 leading-relaxed">
                        Service charge and ground rent are not held in Land Registry or EPC records. Request from the seller or managing agent.
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground/80 mt-3 leading-relaxed flex gap-1.5 items-start">
                      <Info className="h-3 w-3 shrink-0 mt-0.5 flex-shrink-0" />
                      {l.valuationImpactNote}
                    </p>
                  </div>
                </section>
              );
            })()}

            {/* ════════════════════════════════════════════════════════════════
                9. EPC
            ════════════════════════════════════════════════════════════════ */}
            {(() => {
              const epcDecision = getEpcModuleDecision(report.epc, report.meta.epc);
              if (epcDecision.state === "warning") {
                return (
                  <section aria-labelledby="val-epc-heading">
                    <SectionHeading id="val-epc-heading" label="Energy performance" provenance={epcDecision.provenanceLabel} />
                    <WarningCard message={epcDecision.copy!} ctaText={epcDecision.ctaText} ctaUrl={epcDecision.ctaUrl} />
                  </section>
                );
              }
              const epc = report.epc!;
              return (
                <section aria-labelledby="val-epc-heading">
                  <SectionHeading id="val-epc-heading" label="Energy performance" provenance={epcDecision.provenanceLabel} />
                  <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center font-serif text-3xl font-bold shrink-0 ${["A","B","C"].includes(epc.band) ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300" : epc.band === "D" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"}`}>
                        {epc.band}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">EPC Band {epc.band} — score {epc.score}/100</p>
                        {epc.floorAreaM2 && <p className="text-xs text-muted-foreground mt-0.5">Floor area: {epc.floorAreaM2} m²</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Lodged: {fmtDate(epc.lodgementDate)} · Expires: {fmtDate(epc.expiryDate)}
                          {epc.isExpired && <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">(expired)</span>}
                        </p>
                        {epc.isExpired && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">This EPC has expired. Current energy performance may differ — ask the seller for an updated certificate.</p>}
                      </div>
                    </div>
                    <SourceLine meta={report.meta.epc} />
                  </div>
                </section>
              );
            })()}

            {/* ════════════════════════════════════════════════════════════════
                10. WHAT COULD CHANGE THE VALUE
            ════════════════════════════════════════════════════════════════ */}
            {(() => {
              const vd       = report.valueDrivers;
              const vdComp   = getValueDriversCompleteness(vd);
              if (vdComp.state === "unavailable") return null;
              return (
                <section aria-labelledby="val-drivers-heading">
                  <SectionHeading id="val-drivers-heading" label="What could change the value?" provenance={vdComp.provenanceLabel} />
                  <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">Upside factors</p>
                        </div>
                        {vd.increases.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No upside signals identified from available data.</p>
                        ) : (
                          <ul className="space-y-3">
                            {vd.increases.map((d, i) => (
                              <li key={i} className="flex gap-2.5 items-start">
                                <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${d.strength === "strong" ? "bg-green-500" : d.strength === "moderate" ? "bg-green-400" : "bg-green-300"}`} />
                                <div>
                                  <p className="text-xs font-semibold text-foreground">{d.label}</p>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{d.detail}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Risk factors</p>
                        </div>
                        {vd.decreases.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No risk signals identified from available data.</p>
                        ) : (
                          <ul className="space-y-3">
                            {vd.decreases.map((d, i) => (
                              <li key={i} className="flex gap-2.5 items-start">
                                <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${d.strength === "strong" ? "bg-red-500" : d.strength === "moderate" ? "bg-red-400" : "bg-red-300"}`} />
                                <div>
                                  <p className="text-xs font-semibold text-foreground">{d.label}</p>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{d.detail}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    <PartialNote result={vdComp} />
                    <p className="text-[10px] text-muted-foreground/60 mt-4 leading-relaxed flex gap-1.5 items-start">
                      <Info className="h-3 w-3 shrink-0 mt-0.5" />
                      Signals derived from official public data for this postcode. These are indicative factors, not a formal assessment.
                    </p>
                  </div>
                </section>
              );
            })()}

            {/* ════════════════════════════════════════════════════════════════
                11. OWNERSHIP COSTS
            ════════════════════════════════════════════════════════════════ */}
            {(() => {
              const oc      = report.ownershipCosts;
              const ocComp  = getOwnershipCostsCompleteness(oc, report.leaseholdSummary.isLeasehold);
              if (ocComp.state === "unavailable") return null;
              if (ocComp.state === "sparse") {
                return (
                  <section aria-labelledby="val-costs-heading">
                    <SectionHeading id="val-costs-heading" label="Ownership costs" provenance={ocComp.provenanceLabel} />
                    {oc.sdltMid !== null && (
                      <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6 mb-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">Stamp duty (standard buyer, mid estimate)</span>
                          <span className="text-sm font-semibold text-foreground">{oc.sdltMid === 0 ? "£0" : fmt(oc.sdltMid)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">Based on mid estimate — verify on GOV.UK</p>
                      </div>
                    )}
                    <SparseCard message={ocComp.sparseMessage!} />
                  </section>
                );
              }
              const costRows: FieldRow[] = [
                { label: "Council tax band", value: oc.councilTaxBand ? `Band ${oc.councilTaxBand}${oc.councilTaxAnnualEst ? ` — approx. ${fmt(oc.councilTaxAnnualEst)}/yr` : ""}` : null, provenance: "confirmed" },
                { label: "Energy efficiency", value: oc.energyEfficiencyNote ?? (oc.epcBand ? `EPC Band ${oc.epcBand}` : null), provenance: "confirmed" },
                ...(report.leaseholdSummary.isLeasehold ? [
                  { label: "Service charge", value: oc.serviceChargeNote, note: "Request from seller or managing agent", provenance: "confirmed" as const },
                  { label: "Ground rent", value: oc.groundRentNote, note: "Request from seller or managing agent", provenance: "confirmed" as const },
                ] : []),
                { label: "Stamp duty (standard buyer)", value: oc.sdltMid !== null ? (oc.sdltMid === 0 ? "£0" : fmt(oc.sdltMid)) : null, note: "Based on mid estimate — verify on GOV.UK", provenance: "confirmed" as const },
                { label: "Flood risk", value: oc.floodRiskNote, provenance: "confirmed" as const },
              ];
              const { populated: costPopulated } = filterEmptyFields(costRows);
              return (
                <section aria-labelledby="val-costs-heading">
                  <SectionHeading id="val-costs-heading" label="Ownership costs" provenance={ocComp.provenanceLabel} />
                  <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6">
                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-0">
                      {costPopulated.map((r) => (
                        <div key={r.label} className="flex items-start justify-between py-2.5 border-b border-border/30 last:border-0 gap-4">
                          <span className="text-xs text-muted-foreground shrink-0">{r.label}</span>
                          <span className="text-xs font-medium text-foreground text-right">
                            {r.value}
                            {r.note && <span className="block text-[10px] font-normal text-muted-foreground/60">{r.note}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                    <PartialNote result={ocComp} />
                    <p className="text-[10px] text-muted-foreground/60 mt-3 leading-relaxed flex gap-1.5 items-start">
                      <Info className="h-3 w-3 shrink-0 mt-0.5" />
                      Council tax estimates are based on published band rates and are approximate. Energy costs depend on usage, tariff, and property condition.
                    </p>
                  </div>
                </section>
              );
            })()}

            {/* ════════════════════════════════════════════════════════════════
                12. PLANNING
            ════════════════════════════════════════════════════════════════ */}
            {(() => {
              const planComp = getPlanningCompleteness(report.planning, report.meta.planning);
              if (planComp.state === "sparse") {
                return (
                  <section aria-labelledby="val-planning-heading">
                    <SectionHeading id="val-planning-heading" label="Nearby planning activity" provenance={planComp.provenanceLabel} />
                    <SparseCard message={planComp.sparseMessage!} />
                  </section>
                );
              }
              return (
                <section aria-labelledby="val-planning-heading">
                  <SectionHeading id="val-planning-heading" label="Nearby planning activity" provenance={planComp.provenanceLabel} />
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
                </section>
              );
            })()}

            {/* ════════════════════════════════════════════════════════════════
                13. STAMP DUTY + ADVANCED ANALYSIS
            ════════════════════════════════════════════════════════════════ */}
            {report.estimate && (
              <section aria-labelledby="val-sdlt-heading">
                <h2 id="val-sdlt-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                  Stamp duty estimate — mid price {fmt(report.estimate.mid)}
                </h2>
                <SdltTable price={report.estimate.mid} />
              </section>
            )}

            {/* Advanced analysis — Pro/Investor gated */}
            <section aria-labelledby="val-premium-heading">
              <div className="flex items-center justify-between mb-4">
                <h2 id="val-premium-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Advanced analysis
                </h2>
                {isPro ? (
                  <Badge variant="outline" className="text-[10px] font-semibold border-green-500/40 text-green-600 dark:text-green-400">Included in your plan</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary">Professional</Badge>
                )}
              </div>
              {isPro ? (
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-border/60 bg-card p-4">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-2.5"><AlertTriangle className="h-4 w-4" /></div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Risk factors</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">Key risk signals for this postcode based on official data sources.</p>
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
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {(() => {
                    const rc         = report.rentalContext;
                    const rentalDec  = getRentalModuleDecision(rc, report.estimate);
                    if (rentalDec.state === "hidden") return null;
                    if (rentalDec.state === "compact") {
                      return (
                        <div className="rounded-lg border border-border/60 bg-card p-4">
                          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-2.5"><Building className="h-4 w-4" /></div>
                          <h3 className="text-sm font-semibold text-foreground mb-1">Rental yield context</h3>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{rentalDec.copy}</p>
                        </div>
                      );
                    }
                    const est = report.estimate!;
                    const rent = rc.estimatedMonthlyRentGBP!;
                    return (
                      <div className="rounded-lg border border-border/60 bg-card p-4">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-2.5"><Building className="h-4 w-4" /></div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">Rental yield context</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                          Gross yield at each valuation estimate. Based on {rc.rentEvidenceLevel ?? "local rental market data"}.{rc.propertyTypeBasis && ` · ${rc.propertyTypeBasis}`}{rc.dataYear && ` (${rc.dataYear})`}
                        </p>
                        <div className="space-y-2">
                          {[{ label: "At mid estimate", price: est.mid }, { label: "At low estimate", price: est.low }, { label: "At high estimate", price: est.high }].map(({ label, price }) => (
                            <div key={label} className="flex justify-between items-baseline">
                              <span className="text-[11px] text-muted-foreground">{label}</span>
                              <span className="text-xs font-semibold text-foreground">{calcGrossYield(rent, price)}% gross</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-baseline pt-1 border-t border-border/20">
                            <span className="text-[11px] text-muted-foreground">Est. monthly rent</span>
                            <span className="text-xs font-semibold text-foreground">
                              £{rc.rentRangeLow?.toLocaleString("en-GB") ?? rent.toLocaleString("en-GB")}
                              {rc.rentRangeHigh && rc.rentRangeHigh !== rent ? `–£${rc.rentRangeHigh.toLocaleString("en-GB")} /month` : " /month"}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 mt-3 leading-relaxed">Source: {rc.rentEvidenceLevel}. Gross yield only — does not account for void periods, management fees, or maintenance.</p>
                      </div>
                    );
                  })()}
                  <div className="rounded-lg border border-border/60 bg-card p-4">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-2.5"><Zap className="h-4 w-4" /></div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Price trend summary</h3>
                    {report.priceTrend.length > 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{report.localAuthority} — last {report.priceTrend.length} months from UKHPI.</p>
                        {(() => {
                          const first = report.priceTrend[0];
                          const last  = report.priceTrend[report.priceTrend.length - 1];
                          const pct = last && first ? Math.round((last.averagePrice - first.averagePrice) / first.averagePrice * 1000) / 10 : null;
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
                                  <span className={`text-xs font-semibold ${isUp ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>{isUp ? "+" : ""}{pct}%</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <p className="text-[10px] text-muted-foreground/60 mt-3">Source: HM Land Registry UKHPI — local authority level, not postcode level.</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed">Price trend unavailable for this area.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative rounded-xl border border-border/60 overflow-hidden">
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
                      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Risk signals, yield context, and price trend summary are included in the Professional plan.</p>
                      <Link href="/pricing">
                        <Button size="sm" className="font-semibold">View plans <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ════════════════════════════════════════════════════════════════
                14. HOW THIS ESTIMATE IS BUILT
            ════════════════════════════════════════════════════════════════ */}
            <section aria-labelledby="val-method-heading">
              <h2 id="val-method-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                How this estimate is built
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { icon: <BarChart3 className="h-4 w-4" />, title: "HM Land Registry", body: "Every registered sale in England and Wales. The most authoritative UK residential price dataset — 28M+ transactions since 1995.", url: DATA_SOURCES.hmlr_ppd.url },
                  { icon: <Home className="h-4 w-4" />, title: "Comparable matching", body: "We find recent transactions in the same postcode outcode. Median of valid comparables becomes the mid estimate. Range widens when data is thin.", url: null },
                  { icon: <TrendingUp className="h-4 w-4" />, title: "UK House Price Index", body: "Local authority average prices from the UKHPI — published jointly by HMLR, ONS, RoS, and NISRA. Used for the area trend chart.", url: DATA_SOURCES.hmlr_ukhpi.url },
                ].map((m) => (
                  <div key={m.title} className="rounded-xl border border-border/60 bg-card p-5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">{m.icon}</div>
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

            {/* ════════════════════════════════════════════════════════════════
                NEW: COST TO BUY SUMMARY
            ════════════════════════════════════════════════════════════════ */}
            <CostToBuySummary report={report} />

            {/* ════════════════════════════════════════════════════════════════
                NEW: THREE-STEP ACTION PANEL
            ════════════════════════════════════════════════════════════════ */}
            <ThreeStepActionPanel report={report} onSave={() => setSignupOpen(true)} />

            {/* ════════════════════════════════════════════════════════════════
                15. DATA ACCURACY NOTICE + CROSS-LINK
            ════════════════════════════════════════════════════════════════ */}
            <section>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-5">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground font-medium">Accuracy notice.</strong> This is a model estimate based on comparable Land Registry transactions — not a formal RICS or BVAS valuation. HM Land Registry Price Paid Data typically lags 2 weeks to 2 months after completion; new builds may take longer. The most recent 2 months of data are always incomplete. Use this as an informed starting point, not a definitive market appraisal. Always instruct a qualified surveyor before making an offer or taking financial decisions.
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-border/60 bg-card p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-1.5">Also useful</p>
                  <h3 className="text-base font-semibold text-foreground mb-1">Want to understand the neighbourhood too?</h3>
                  {isPro ? (
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-md">Professional valuation features are included with your Brief for {postcodeToOutcode(report.queryPostcode)}. The Brief also covers schools, transport, crime, flood risk, broadband, and planning activity.</p>
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-md">The Postcode Brief covers the neighbourhood around this postcode: schools, transport, crime, planning activity, flood risk, and broadband. Separate from the property valuation.</p>
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
