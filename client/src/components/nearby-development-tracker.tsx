/**
 * NearbyDevelopmentTracker
 * ─────────────────────────────────────────────────────────────────────────────
 * Scannable buyer-facing component that renders major nearby development schemes
 * with impact classification, plain-English rationale, distance badge, and
 * status indicator.
 *
 * Impact labels (4 tiers):
 *   upside      — green  — scheme likely improves area appeal / connectivity
 *   disruption  — red    — construction, noise, density, or character risk
 *   mixed       — amber  — genuine upsides and downsides; buyer should weigh both
 *   unclear     — slate  — insufficient evidence; check council portal
 *
 * Used in Professional+ brief section and exported for PDF use.
 */

import { Construction, TrendingUp, AlertTriangle, HelpCircle, ChevronRight } from "lucide-react";

export type DevImpactLabel = "upside" | "disruption" | "mixed" | "unclear";

export interface NearbyDevelopment {
  name: string;
  type: string;
  status: string;
  impact: "Positive" | "Neutral" | "Monitor";
  impactLabel: DevImpactLabel;
  impactRationale: string;
  distanceM?: number;
  detail: string;
}

// ─── Impact metadata ──────────────────────────────────────────────────────────

const IMPACT_META: Record<
  DevImpactLabel,
  {
    label: string;
    chipClass: string;
    dotClass: string;
    borderClass: string;
    bgClass: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  upside: {
    label: "Likely upside",
    chipClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    borderClass: "border-l-emerald-500",
    bgClass: "bg-emerald-500/5",
    Icon: ({ className }) => <TrendingUp className={className} />,
  },
  disruption: {
    label: "Disruption risk",
    chipClass: "bg-red-500/15 text-red-700 dark:text-red-400",
    dotClass: "bg-red-500",
    borderClass: "border-l-red-500",
    bgClass: "bg-red-500/5",
    Icon: ({ className }) => <AlertTriangle className={className} />,
  },
  mixed: {
    label: "Mixed impact",
    chipClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
    borderClass: "border-l-amber-500",
    bgClass: "bg-amber-500/5",
    Icon: ({ className }) => <Construction className={className} />,
  },
  unclear: {
    label: "Impact unclear",
    chipClass: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
    dotClass: "bg-slate-400",
    borderClass: "border-l-slate-400",
    bgClass: "bg-slate-500/5",
    Icon: ({ className }) => <HelpCircle className={className} />,
  },
};

// ─── Type chip colours ────────────────────────────────────────────────────────

function typeChipClass(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("transport") || t.includes("infrastructure"))
    return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
  if (t.includes("residential"))
    return "bg-violet-500/15 text-violet-700 dark:text-violet-400";
  if (t.includes("commercial"))
    return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
  if (t.includes("mixed"))
    return "bg-teal-500/15 text-teal-700 dark:text-teal-400";
  if (t.includes("road") || t.includes("access"))
    return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
  return "bg-muted text-muted-foreground";
}

// ─── Distance label ───────────────────────────────────────────────────────────

function fmtDistance(m?: number): string | null {
  if (!m) return null;
  if (m < 1000) return `~${Math.round(m / 50) * 50}m`;
  return `~${(m / 1000).toFixed(1)}km`;
}

// ─── Sort order: disruption first, then mixed, then upside, then unclear ──────

const SORT_ORDER: Record<DevImpactLabel, number> = {
  disruption: 0,
  mixed: 1,
  upside: 2,
  unclear: 3,
};

function sortDevs(devs: NearbyDevelopment[]): NearbyDevelopment[] {
  return [...devs].sort((a, b) => {
    const aOrder = SORT_ORDER[a.impactLabel ?? "unclear"];
    const bOrder = SORT_ORDER[b.impactLabel ?? "unclear"];
    if (aOrder !== bOrder) return aOrder - bOrder;
    // Within same impact tier, put under-construction first
    const aActive = a.status.toLowerCase().includes("construction") ? 0 : 1;
    const bActive = b.status.toLowerCase().includes("construction") ? 0 : 1;
    return aActive - bActive;
  });
}

// ─── Individual dev card ──────────────────────────────────────────────────────

function DevCard({ dev }: { dev: NearbyDevelopment }) {
  const meta = IMPACT_META[dev.impactLabel ?? "unclear"];
  const { Icon } = meta;
  const isNoSchemes = dev.name === "No major schemes on record";
  const dist = fmtDistance(dev.distanceM);

  if (isNoSchemes) {
    return (
      <div className="flex items-start gap-3 py-3 px-1">
        <Construction className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground italic">{dev.detail}</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-border border-l-[3px] ${meta.borderClass} ${meta.bgClass} p-4 flex flex-col gap-2`}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.chipClass.split(" ")[1]}`} />
        <span className="text-sm font-semibold text-foreground leading-snug">{dev.name}</span>
      </div>

      {/* Chips row */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {/* Impact chip */}
        <span
          className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${meta.chipClass}`}
        >
          {meta.label}
        </span>
        {/* Type chip */}
        {dev.type !== "—" && (
          <span
            className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${typeChipClass(dev.type)}`}
          >
            {dev.type}
          </span>
        )}
        {/* Status */}
        <span className="text-[10px] text-muted-foreground font-medium">{dev.status}</span>
        {/* Distance */}
        {dist && (
          <span className="text-[10px] text-muted-foreground font-medium ml-auto">{dist}</span>
        )}
      </div>

      {/* Impact rationale — the "why it matters" sentence */}
      <p className="text-xs text-foreground/80 leading-relaxed font-medium">
        {dev.impactRationale}
      </p>

      {/* Full detail — secondary, lighter */}
      <p className="text-xs text-muted-foreground leading-relaxed">{dev.detail}</p>
    </div>
  );
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ devs }: { devs: NearbyDevelopment[] }) {
  const real = devs.filter(d => d.name !== "No major schemes on record");
  if (real.length === 0) return null;

  const counts = {
    upside: real.filter(d => d.impactLabel === "upside").length,
    disruption: real.filter(d => d.impactLabel === "disruption").length,
    mixed: real.filter(d => d.impactLabel === "mixed").length,
    unclear: real.filter(d => d.impactLabel === "unclear").length,
  };

  return (
    <div className="flex flex-wrap gap-3 pb-1">
      {(["disruption", "mixed", "upside", "unclear"] as DevImpactLabel[]).map(key => {
        const count = counts[key];
        if (!count) return null;
        const meta = IMPACT_META[key];
        return (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full inline-block ${meta.dotClass}`} />
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{count}</span>{" "}
              {meta.label.toLowerCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Council portal footnote ──────────────────────────────────────────────────

function CouncilPortalNote({ portalUrl }: { portalUrl?: string }) {
  return (
    <div className="flex flex-col gap-1 pt-1 border-t border-border">
      <p className="text-xs text-muted-foreground/70 leading-relaxed">
        Development data is derived from curated major schemes and live planning registers.
        Minor applications and early-stage proposals may not appear here. Always verify with
        the council planning portal before exchange.
      </p>
      {portalUrl && (
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline underline-offset-2 self-start flex items-center gap-1"
        >
          Check council planning portal <ChevronRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

interface NearbyDevelopmentTrackerProps {
  developments: NearbyDevelopment[];
  councilPortalUrl?: string;
}

export function NearbyDevelopmentTracker({
  developments,
  councilPortalUrl,
}: NearbyDevelopmentTrackerProps) {
  const sorted = sortDevs(developments);

  return (
    <div className="flex flex-col gap-4">
      <SummaryBar devs={developments} />
      <div className="flex flex-col gap-3">
        {sorted.map((dev, i) => (
          <DevCard key={i} dev={dev} />
        ))}
      </div>
      <CouncilPortalNote portalUrl={councilPortalUrl} />
    </div>
  );
}

// ─── Export helpers for PDF ───────────────────────────────────────────────────

export { sortDevs, IMPACT_META, fmtDistance };
