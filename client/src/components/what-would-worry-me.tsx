import { AlertTriangle, AlertCircle, Info, ShieldCheck } from "lucide-react";
import type { AreaIntelligence } from "../../../shared/schema";

// ── Category icon map ─────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<
  NonNullable<AreaIntelligence["worryBox"]["items"][number]["category"]>,
  string
> = {
  flood:       "🌊",
  market:      "📉",
  crime:       "⚠",
  epc:         "⚡",
  development: "🏗",
  data:        "📊",
  environment: "💨",
  other:       "•",
};

// ── Severity styling ──────────────────────────────────────────────────────────
type Severity = AreaIntelligence["worryBox"]["items"][number]["severity"];

const SEVERITY_STYLES: Record<
  Severity,
  {
    row: string;
    dot: string;
    headline: string;
    icon: React.ReactNode;
  }
> = {
  high: {
    row: "bg-red-50/50 dark:bg-red-950/20",
    dot: "bg-red-500",
    headline: "text-red-800 dark:text-red-300",
    icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />,
  },
  medium: {
    row: "bg-amber-50/40 dark:bg-amber-950/15",
    dot: "bg-amber-500",
    headline: "text-amber-800 dark:text-amber-300",
    icon: <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />,
  },
  low: {
    row: "bg-zinc-50/60 dark:bg-zinc-900/20",
    dot: "bg-zinc-400 dark:bg-zinc-500",
    headline: "text-zinc-700 dark:text-zinc-300",
    icon: <Info className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />,
  },
};

// ── Outer border / header tint by worst severity present ─────────────────────
function outerSeverityClass(items: AreaIntelligence["worryBox"]["items"]): {
  border: string;
  headerBg: string;
  headerBorder: string;
  headerLabel: string;
  headerIcon: string;
} {
  const worst = items[0]?.severity ?? "low";
  if (worst === "high") {
    return {
      border: "border-red-400/40",
      headerBg: "bg-red-500/[0.07]",
      headerBorder: "border-red-400/25",
      headerLabel: "text-red-700 dark:text-red-400",
      headerIcon: "text-red-600 dark:text-red-400",
    };
  }
  if (worst === "medium") {
    return {
      border: "border-amber-400/40",
      headerBg: "bg-amber-500/[0.07]",
      headerBorder: "border-amber-400/25",
      headerLabel: "text-amber-700 dark:text-amber-400",
      headerIcon: "text-amber-600 dark:text-amber-400",
    };
  }
  return {
    border: "border-zinc-300/50 dark:border-zinc-700/50",
    headerBg: "bg-zinc-100/60 dark:bg-zinc-800/40",
    headerBorder: "border-zinc-300/30 dark:border-zinc-700/30",
    headerLabel: "text-zinc-600 dark:text-zinc-400",
    headerIcon: "text-zinc-500 dark:text-zinc-400",
  };
}

// ── Main component ────────────────────────────────────────────────────────────
interface WhatWouldWorryMeProps {
  worryBox: AreaIntelligence["worryBox"];
}

export function WhatWouldWorryMe({ worryBox }: WhatWouldWorryMeProps) {
  const { verdict, items } = worryBox;
  const hasItems = items.length > 0;
  const cls = outerSeverityClass(items);

  return (
    <div
      className={`rounded-xl border-2 ${cls.border} overflow-hidden shadow-sm`}
      data-testid="section-worry-box"
    >
      {/* ── Header ── */}
      <div
        className={`px-5 sm:px-6 py-3.5 ${cls.headerBg} border-b ${cls.headerBorder} flex items-center gap-2.5`}
      >
        {hasItems ? (
          <AlertTriangle className={`h-4 w-4 shrink-0 ${cls.headerIcon}`} />
        ) : (
          <ShieldCheck className={`h-4 w-4 shrink-0 ${cls.headerIcon}`} />
        )}
        <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${cls.headerLabel}`}>
          What would worry me here?
        </span>
        {hasItems && (
          <span className={`ml-1.5 text-[10px] font-semibold ${cls.headerLabel} opacity-65`}>
            {items.length} concern{items.length > 1 ? "s" : ""} to check
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground/45 font-medium tracking-wide hidden sm:block">
          Due-diligence flags
        </span>
      </div>

      {/* ── No-concerns state ── */}
      {!hasItems && (
        <div className="px-5 sm:px-6 py-5 flex items-start gap-3">
          <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <p className="text-sm text-foreground/80 leading-relaxed">
            {verdict || "No major immediate concerns identified from available data — standard due diligence applies."}
          </p>
        </div>
      )}

      {/* ── Concern rows ── */}
      {hasItems && (
        <div className="divide-y divide-border/25">
          {items.map((item, i) => {
            const sty = SEVERITY_STYLES[item.severity];
            const emoji = CATEGORY_ICONS[item.category] ?? "•";
            return (
              <div
                key={i}
                className={`px-5 sm:px-6 py-4 flex gap-3.5 items-start ${sty.row}`}
                data-testid={`worry-item-${item.category}`}
              >
                {/* Left: severity dot + headline */}
                <div className="shrink-0 flex flex-col gap-1 min-w-0 sm:flex-row sm:items-start sm:gap-2.5 sm:min-w-[200px] sm:max-w-[220px] pt-0.5">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`h-1.5 w-1.5 rounded-full ${sty.dot} shrink-0 mt-0.5`} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] leading-tight opacity-50">
                      {emoji}
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold uppercase tracking-[0.11em] leading-tight ${sty.headline}`}>
                    {item.headline}
                  </span>
                </div>

                {/* Right: detail sentence */}
                <p className="text-sm text-foreground/80 leading-relaxed min-w-0">
                  {item.detail}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer note ── */}
      <div className="px-5 sm:px-6 py-2.5 border-t border-border/20 bg-background/40">
        <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
          Concerns are drawn from Land Registry, EA flood data, DEFRA, and area enrichment signals. Always commission independent surveys before offering.
        </p>
      </div>
    </div>
  );
}
