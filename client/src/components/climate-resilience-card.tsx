/**
 * ClimateResilienceCard
 * ─────────────────────────────────────────────────────────────────────────────
 * Prominent buyer-facing summary of flood, climate, and resilience signals.
 * Renders a top-level resilience verdict badge, up to 4 climate signals, and
 * a "What to check next" list of practical buyer actions.
 *
 * Resilience labels (4 tiers):
 *   Low risk       — green  — no material environmental flags
 *   Some exposure  — amber  — one or more signals worth noting (London clay, etc.)
 *   Elevated risk  — orange — medium flood + secondary signals
 *   High risk      — red    — high flood risk or 3+ flagged signals
 *
 * Used as the primary Flood & Climate section for ALL tiers (free + paid).
 */

import { Droplets, AlertTriangle, CheckCircle2, Info, ChevronRight, Thermometer, ShieldAlert } from "lucide-react";

export type ResilienceLabel = "Low risk" | "Some exposure" | "Elevated risk" | "High risk";

export interface ClimateSignal {
  label: string;
  value: string;
  context: string;
  flagged: boolean;
}

export interface ClimateResilienceCardProps {
  riskBadge: "Low" | "Medium" | "High";
  zone: string;
  surfaceWater: string;
  detail: string;
  resilienceLabel?: ResilienceLabel;
  climateSignals?: ClimateSignal[];
  nextSteps?: string[];
}

// ─── Resilience metadata ──────────────────────────────────────────────────────

const RESILIENCE_META: Record<
  ResilienceLabel,
  { badgeClass: string; borderClass: string; bgClass: string; Icon: React.FC<{ className?: string }> }
> = {
  "Low risk": {
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    borderClass: "border-emerald-500/30",
    bgClass: "bg-emerald-500/5",
    Icon: ({ className }) => <CheckCircle2 className={className} />,
  },
  "Some exposure": {
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    borderClass: "border-amber-500/30",
    bgClass: "bg-amber-500/5",
    Icon: ({ className }) => <Info className={className} />,
  },
  "Elevated risk": {
    badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    borderClass: "border-orange-500/30",
    bgClass: "bg-orange-500/5",
    Icon: ({ className }) => <AlertTriangle className={className} />,
  },
  "High risk": {
    badgeClass: "bg-red-500/15 text-red-700 dark:text-red-400",
    borderClass: "border-red-500/30",
    bgClass: "bg-red-500/5",
    Icon: ({ className }) => <ShieldAlert className={className} />,
  },
};

// ─── Signal icon by label ────────────────────────────────────────────────────

function SignalIcon({ label, flagged }: { label: string; flagged: boolean }) {
  const cls = `h-3.5 w-3.5 shrink-0 mt-0.5 ${flagged ? "text-orange-500 dark:text-orange-400" : "text-muted-foreground"}`;
  const l = label.toLowerCase();
  if (l.includes("flood")) return <Droplets className={cls} />;
  if (l.includes("heat") || l.includes("temperature")) return <Thermometer className={cls} />;
  if (l.includes("subsidence") || l.includes("ground")) return <AlertTriangle className={cls} />;
  return <Info className={cls} />;
}

// ─── Individual climate signal row ───────────────────────────────────────────

function SignalRow({ signal }: { signal: ClimateSignal }) {
  return (
    <div className={`flex gap-3 p-3 rounded-lg border ${signal.flagged ? "border-orange-500/20 bg-orange-500/5" : "border-border bg-card/50"}`}>
      <SignalIcon label={signal.label} flagged={signal.flagged} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{signal.label}</span>
          <span className={`text-[10px] font-medium ${signal.flagged ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>
            {signal.value}
          </span>
          {signal.flagged && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-700 dark:text-orange-400">
              Check
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{signal.context}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClimateResilienceCard({
  riskBadge,
  zone,
  surfaceWater,
  detail,
  resilienceLabel,
  climateSignals,
  nextSteps,
}: ClimateResilienceCardProps) {
  // Fallback resilience label if engine hasn't populated it yet
  const label: ResilienceLabel =
    resilienceLabel ??
    (riskBadge === "High" ? "High risk" : riskBadge === "Medium" ? "Elevated risk" : "Low risk");

  const meta = RESILIENCE_META[label];
  const { Icon } = meta;

  const hasSignals = climateSignals && climateSignals.length > 0;
  const hasNextSteps = nextSteps && nextSteps.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Top verdict banner ── */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${meta.borderClass} ${meta.bgClass}`}>
        <Icon className={`h-5 w-5 shrink-0 ${meta.badgeClass.split(" ")[1]}`} />
        <div className="flex flex-col gap-0.5">
          <span className={`text-sm font-semibold ${meta.badgeClass.split(" ")[1]}`}>
            {label}
          </span>
          <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
        </div>
      </div>

      {/* ── KPI bar — zone + surface water ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">EA Flood Zone</span>
          <span className="text-sm font-medium text-foreground">{zone}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Surface Water</span>
          <span className={`text-sm font-medium ${
            surfaceWater === "High" ? "text-red-600 dark:text-red-400"
            : surfaceWater === "Medium" ? "text-amber-600 dark:text-amber-400"
            : "text-foreground"
          }`}>{surfaceWater}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Flood Exposure</span>
          <span className={`text-sm font-medium ${
            riskBadge === "High" ? "text-red-600 dark:text-red-400"
            : riskBadge === "Medium" ? "text-amber-600 dark:text-amber-400"
            : "text-emerald-600 dark:text-emerald-400"
          }`}>{riskBadge}</span>
        </div>
      </div>

      {/* ── Climate signals ── */}
      {hasSignals && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Environmental Signals</span>
          {climateSignals!.map((s, i) => (
            <SignalRow key={i} signal={s} />
          ))}
        </div>
      )}

      {/* ── What to check next ── */}
      {hasNextSteps && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">What to Check Before Offering</span>
          <div className="flex flex-col gap-1.5">
            {nextSteps!.map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Disclaimer ── */}
      <p className="text-xs text-muted-foreground/60 leading-relaxed border-t border-border pt-3">
        Environmental signals are area-level indicators derived from EA flood monitoring, geological mapping, and EPC data. They are not a substitute for a formal flood risk assessment, environmental search, or RICS survey — always verify at property level before exchange.
      </p>

      {/* ── EA link ── */}
      <a
        href="https://flood-map-for-planning.service.gov.uk"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary underline underline-offset-2 self-start flex items-center gap-1"
      >
        Check EA Flood Map for Planning <ChevronRight className="h-3 w-3" />
      </a>
    </div>
  );
}
