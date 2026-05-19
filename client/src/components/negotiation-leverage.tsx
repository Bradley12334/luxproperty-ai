import { TrendingDown, TrendingUp, Minus, Target, Thermometer, BarChart2, Crosshair, ChevronRight } from "lucide-react";
import type { AreaIntelligence } from "../../../shared/schema";

type NL = AreaIntelligence["negotiationLeverage"];

// ── Stance config ─────────────────────────────────────────────────────────────
const STANCE_META: Record<
  NL["stance"],
  { bg: string; border: string; label: string; textColor: string; dot: string }
> = {
  "Firm buyer — you have leverage": {
    bg: "bg-emerald-500/[0.07] dark:bg-emerald-900/20",
    border: "border-emerald-400/40",
    label: "text-emerald-800 dark:text-emerald-300",
    textColor: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  "Balanced — play it carefully": {
    bg: "bg-primary/[0.05]",
    border: "border-primary/20",
    label: "text-primary dark:text-primary",
    textColor: "text-foreground/80",
    dot: "bg-primary",
  },
  "Limited leverage — seller holds ground": {
    bg: "bg-amber-500/[0.06] dark:bg-amber-900/15",
    border: "border-amber-400/35",
    label: "text-amber-800 dark:text-amber-300",
    textColor: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  "Thin data — proceed cautiously": {
    bg: "bg-zinc-100/60 dark:bg-zinc-800/30",
    border: "border-zinc-300/50 dark:border-zinc-700/40",
    label: "text-zinc-600 dark:text-zinc-400",
    textColor: "text-zinc-600 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
};

// ── Demand temperature config ─────────────────────────────────────────────────
const DEMAND_META: Record<
  NL["demandTemperature"]["label"],
  { color: string; icon: React.ReactNode; bg: string }
> = {
  Competitive:  { color: "text-red-600 dark:text-red-400",    icon: <TrendingUp  className="h-3.5 w-3.5" />, bg: "bg-red-50/60 dark:bg-red-900/15"     },
  Balanced:     { color: "text-primary",                        icon: <Minus       className="h-3.5 w-3.5" />, bg: "bg-primary/[0.05]"                   },
  Soft:         { color: "text-amber-600 dark:text-amber-400", icon: <TrendingDown className="h-3.5 w-3.5" />, bg: "bg-amber-50/60 dark:bg-amber-900/15" },
  "Very soft":  { color: "text-emerald-700 dark:text-emerald-400", icon: <TrendingDown className="h-3.5 w-3.5" />, bg: "bg-emerald-50/50 dark:bg-emerald-900/15" },
};

// ── Seller position config ────────────────────────────────────────────────────
const SELLER_META: Record<
  NL["sellerPosition"]["label"],
  { color: string; bg: string }
> = {
  "Strong position":    { color: "text-red-600 dark:text-red-400",    bg: "bg-red-50/50 dark:bg-red-900/15"     },
  "Balanced":           { color: "text-primary",                        bg: "bg-primary/[0.05]"                  },
  "Some vulnerability": { color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50/50 dark:bg-amber-900/15" },
  "Signs of pressure":  { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50/50 dark:bg-emerald-900/15" },
  "Uncertain":          { color: "text-zinc-500 dark:text-zinc-400",   bg: "bg-zinc-100/60 dark:bg-zinc-800/30"  },
};

// ── Leverage strength config ──────────────────────────────────────────────────
const STRENGTH_META: Record<
  NL["leveragePoints"][number]["strength"],
  { chip: string; label: string }
> = {
  strong:   { chip: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-300/50 dark:border-emerald-600/30", label: "Strong" },
  moderate: { chip: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300/50 dark:border-amber-600/30",             label: "Moderate" },
  weak:     { chip: "bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 border-zinc-300/40 dark:border-zinc-700/30",                    label: "Tactical" },
};

// ── Confidence badge ──────────────────────────────────────────────────────────
const CONFIDENCE_META: Record<
  NL["offerRange"]["confidence"],
  { badge: string; label: string }
> = {
  Strong:   { badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-300/40", label: "Strong evidence" },
  Moderate: { badge: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300/40",           label: "Moderate evidence" },
  Thin:     { badge: "bg-zinc-100 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 border-zinc-300/40",                label: "Thin evidence" },
};

// ── Main component ────────────────────────────────────────────────────────────
interface NegotiationLeverageProps {
  leverage: AreaIntelligence["negotiationLeverage"];
}

export function NegotiationLeverage({ leverage }: NegotiationLeverageProps) {
  const { offerRange, sellerPosition, demandTemperature, localSalesRead, leveragePoints, stance } = leverage;
  const stanceMeta = STANCE_META[stance];
  const demandMeta = DEMAND_META[demandTemperature.label];
  const sellerMeta = SELLER_META[sellerPosition.label];
  const confMeta   = CONFIDENCE_META[offerRange.confidence];

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm" data-testid="section-negotiation-leverage">

      {/* ── Section header ── */}
      <div className="px-5 sm:px-6 py-3.5 bg-muted/30 border-b border-border/40 flex items-center gap-2.5">
        <Crosshair className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          Negotiation Leverage
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/45 font-medium tracking-wide hidden sm:block">
          Buyer strategy
        </span>
      </div>

      {/* ── Stance banner ── */}
      <div className={`px-5 sm:px-6 py-3.5 ${stanceMeta.bg} border-b ${stanceMeta.border} flex items-center gap-2.5`}>
        <div className={`h-2 w-2 rounded-full shrink-0 ${stanceMeta.dot}`} />
        <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${stanceMeta.label}`}>
          {stance}
        </span>
      </div>

      <div className="p-5 sm:p-6 space-y-5">

        {/* ── Offer ranges ── */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Offer Range</span>
            </div>
            <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${confMeta.badge}`}>
              {confMeta.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-muted/30 border border-border/40">
              <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground mb-1">Fair Value</p>
              <p className="font-serif text-xl tracking-tight text-foreground leading-tight" data-testid="nl-fair-value">
                {offerRange.fairValue}
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-primary/[0.06] border border-primary/20">
              <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground mb-1">Opening Range</p>
              <p className="font-serif text-xl tracking-tight text-primary leading-tight" data-testid="nl-opening-range">
                {offerRange.openingRange}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-2.5 border-l-2 border-border/50 pl-2.5">
            {offerRange.confidenceNote}
          </p>
        </div>

        {/* ── Demand + Seller position ── */}
        <div className="grid sm:grid-cols-2 gap-3">
          {/* Demand temperature */}
          <div className={`rounded-lg p-3.5 border border-border/40 ${demandMeta.bg}`}>
            <div className={`flex items-center gap-1.5 mb-1.5 ${demandMeta.color}`}>
              <Thermometer className="h-3 w-3 shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em]">Market Demand</span>
            </div>
            <p className={`text-sm font-semibold mb-1 ${demandMeta.color}`} data-testid="nl-demand-label">
              {demandTemperature.label}
            </p>
            <p className="text-[11px] text-foreground/70 leading-relaxed">
              {demandTemperature.rationale}
            </p>
          </div>

          {/* Seller position */}
          <div className={`rounded-lg p-3.5 border border-border/40 ${sellerMeta.bg}`}>
            <div className={`flex items-center gap-1.5 mb-1.5 ${sellerMeta.color}`}>
              <BarChart2 className="h-3 w-3 shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em]">Seller Position</span>
            </div>
            <p className={`text-sm font-semibold mb-1 ${sellerMeta.color}`} data-testid="nl-seller-label">
              {sellerPosition.label}
            </p>
            <p className="text-[11px] text-foreground/70 leading-relaxed">
              {sellerPosition.rationale}
            </p>
          </div>
        </div>

        {/* ── Local sales read ── */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart2 className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">What Local Sales Imply</span>
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed" data-testid="nl-sales-read">
            {localSalesRead}
          </p>
        </div>

        {/* ── Leverage points ── */}
        {leveragePoints.length > 0 && (
          <div className="pt-4 border-t border-border/30">
            <div className="flex items-center gap-1.5 mb-3">
              <Crosshair className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Leverage Points to Use</span>
            </div>
            <ul className="space-y-2.5" data-testid="nl-leverage-points">
              {leveragePoints.map((lp, i) => {
                const sm = STRENGTH_META[lp.strength];
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground/85 leading-relaxed flex-1">
                      {lp.point}
                    </span>
                    <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border self-start mt-0.5 ${sm.chip}`}>
                      {sm.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ── Disclaimer ── */}
        <p className="text-[10px] text-muted-foreground/40 leading-relaxed border-t border-border/20 pt-3">
          Offer ranges are derived from Land Registry transaction data and area benchmarks — not a formal valuation. Always instruct a RICS-regulated surveyor before exchange. Not legal or financial advice.
        </p>

      </div>
    </div>
  );
}
