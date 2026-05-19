/**
 * DevelopmentAlerts
 * ─────────────────────────────────────────────────────────────────────────────
 * Compact, high-signal alert block surfacing nearby developments that could
 * materially affect a buyer's decision. Appears above the Executive Summary —
 * before the buyer reads the full report.
 *
 * Logic:
 *   - Filters nearbyDevelopments to only schemes that are "Under construction",
 *     "Approved", or explicitly impactful (not "No major schemes on record")
 *   - Ranks: disruption → mixed → upside → unclear
 *   - Shows max 3 alerts (anything beyond 3 is covered in the full tracker)
 *   - Falls back to a planning-volume note if live planning shows > 5 applications
 *     but no curated schemes exist
 *   - Returns null when there's genuinely nothing to flag
 */

import { AlertTriangle, TrendingUp, Construction, Zap } from "lucide-react";
import type { AreaIntelligence } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

type DevImpactLabel = "upside" | "disruption" | "mixed" | "unclear";

interface AlertItem {
  name: string;
  type: string;
  status: string;
  impactLabel: DevImpactLabel;
  impactRationale: string;
  distanceM?: number;
  isLiveActivity?: boolean; // true = from planningActivity count, not a named scheme
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SORT_ORDER: Record<DevImpactLabel, number> = {
  disruption: 0,
  mixed:      1,
  upside:     2,
  unclear:    3,
};

function fmtDist(m?: number): string {
  if (!m) return "";
  if (m < 1000) return `~${Math.round(m / 50) * 50}m`;
  return `~${(m / 1000).toFixed(1)}km`;
}

function isActiveScheme(status: string): boolean {
  const s = status.toLowerCase();
  return (
    s.includes("under construction") ||
    s.includes("approved") ||
    s.includes("consent") ||
    s.includes("permitted") ||
    s.includes("completing") ||
    s.includes("delivery")
  );
}

/** Derive at most 3 high-signal alerts from available data. */
export function deriveDevelopmentAlerts(
  devs: AreaIntelligence["nearbyDevelopments"],
  planningActivity?: AreaIntelligence["planningActivity"],
): AlertItem[] {
  const alerts: AlertItem[] = [];

  if (devs && devs.length > 0) {
    // Filter to real, active, or high-impact schemes only
    const eligible = devs.filter(d => {
      if (d.name === "No major schemes on record") return false;
      // Always include active construction
      if (isActiveScheme(d.status)) return true;
      // Include approved/positive if impactLabel is upside or mixed
      if (d.impactLabel === "upside" || d.impactLabel === "mixed") return true;
      // Include disruption regardless of status
      if (d.impactLabel === "disruption") return true;
      return false;
    });

    // Sort: disruption first, then mixed, then upside
    const sorted = [...eligible].sort((a, b) => {
      const aRank = SORT_ORDER[a.impactLabel ?? "unclear"];
      const bRank = SORT_ORDER[b.impactLabel ?? "unclear"];
      if (aRank !== bRank) return aRank - bRank;
      // Within same impact, active construction first
      const aActive = isActiveScheme(a.status) ? 0 : 1;
      const bActive = isActiveScheme(b.status) ? 0 : 1;
      return aActive - bActive;
    });

    for (const d of sorted.slice(0, 3)) {
      alerts.push({
        name:             d.name,
        type:             d.type,
        status:           d.status,
        impactLabel:      (d.impactLabel ?? "unclear") as DevImpactLabel,
        impactRationale:  d.impactRationale,
        distanceM:        d.distanceM,
      });
    }
  }

  // Fallback: if no curated schemes but high planning volume, surface that
  if (alerts.length === 0 && planningActivity && planningActivity.recentApplications >= 6) {
    alerts.push({
      name:            `${planningActivity.recentApplications} planning applications nearby`,
      type:            "Planning activity",
      status:          "Recent (12 months)",
      impactLabel:     "mixed",
      impactRationale: `${planningActivity.recentApplications} planning applications have been registered near this area in the past 12 months. This level of activity warrants a check of the council planning portal before exchange — some applications may affect outlook, quiet enjoyment, or access routes.`,
      isLiveActivity:  true,
    });
  }

  return alerts;
}

// ── Visual config ─────────────────────────────────────────────────────────────

const ALERT_CONFIG: Record<
  DevImpactLabel,
  {
    label:       string;
    borderColor: string;
    bgColor:     string;
    badgeBg:     string;
    badgeText:   string;
    textColor:   string;
    Icon:        React.FC<{ size?: number; style?: React.CSSProperties }>;
  }
> = {
  disruption: {
    label:       "Disruption risk",
    borderColor: "#ef4444",
    bgColor:     "#fef2f2",
    badgeBg:     "#fee2e2",
    badgeText:   "#991b1b",
    textColor:   "#7f1d1d",
    Icon: ({ size = 14, style }) => (
      <AlertTriangle width={size} height={size} style={style} strokeWidth={2} />
    ),
  },
  mixed: {
    label:       "Mixed impact",
    borderColor: "#f59e0b",
    bgColor:     "#fffbeb",
    badgeBg:     "#fef3c7",
    badgeText:   "#92400e",
    textColor:   "#78350f",
    Icon: ({ size = 14, style }) => (
      <Construction width={size} height={size} style={style} strokeWidth={2} />
    ),
  },
  upside: {
    label:       "Likely upside",
    borderColor: "#22c55e",
    bgColor:     "#f0fdf4",
    badgeBg:     "#dcfce7",
    badgeText:   "#166534",
    textColor:   "#14532d",
    Icon: ({ size = 14, style }) => (
      <TrendingUp width={size} height={size} style={style} strokeWidth={2} />
    ),
  },
  unclear: {
    label:       "Impact unclear",
    borderColor: "#94a3b8",
    bgColor:     "#f8fafc",
    badgeBg:     "#f1f5f9",
    badgeText:   "#475569",
    textColor:   "#334155",
    Icon: ({ size = 14, style }) => (
      <Zap width={size} height={size} style={style} strokeWidth={2} />
    ),
  },
};

// Type chip colour helper
function typeColor(type: string): { bg: string; text: string } {
  const t = type.toLowerCase();
  if (t.includes("transport") || t.includes("infrastructure") || t.includes("rail") || t.includes("station"))
    return { bg: "#dbeafe", text: "#1e40af" };
  if (t.includes("residential"))
    return { bg: "#ede9fe", text: "#5b21b6" };
  if (t.includes("commercial") || t.includes("mixed"))
    return { bg: "#ffedd5", text: "#9a3412" };
  if (t.includes("road") || t.includes("access"))
    return { bg: "#fef9c3", text: "#854d0e" };
  if (t.includes("planning"))
    return { bg: "#f1f5f9", text: "#475569" };
  return { bg: "#f3f4f6", text: "#374151" };
}

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: AlertItem }) {
  const cfg  = ALERT_CONFIG[alert.impactLabel];
  const dist = fmtDist(alert.distanceM);
  const tc   = typeColor(alert.type);

  return (
    <div
      style={{
        borderLeft:   `3px solid ${cfg.borderColor}`,
        background:   cfg.bgColor,
        borderRadius: "8px",
        padding:      "12px 14px",
        display:      "flex",
        flexDirection:"column",
        gap:          "7px",
      }}
    >
      {/* Row 1: name + distance */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap", flex: 1 }}>
          <cfg.Icon size={14} style={{ color: cfg.borderColor, flexShrink: 0 }} />
          <span style={{
            fontFamily:  "'Switzer', 'Helvetica Neue', sans-serif",
            fontSize:    "13px",
            fontWeight:  700,
            color:       "#111827",
            lineHeight:  1.3,
          }}>
            {alert.name}
          </span>
        </div>
        {dist && (
          <span style={{
            fontFamily:  "'Switzer', 'Helvetica Neue', sans-serif",
            fontSize:    "11px",
            color:       "#6b7280",
            fontWeight:  500,
            flexShrink:  0,
            whiteSpace:  "nowrap",
          }}>
            {dist}
          </span>
        )}
      </div>

      {/* Row 2: chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
        {/* Impact badge */}
        <span style={{
          fontFamily:     "'Switzer', 'Helvetica Neue', sans-serif",
          fontSize:       "10px",
          fontWeight:     700,
          letterSpacing:  "0.06em",
          textTransform:  "uppercase",
          background:     cfg.badgeBg,
          color:          cfg.badgeText,
          padding:        "2px 8px",
          borderRadius:   "9999px",
        }}>
          {cfg.label}
        </span>
        {/* Type chip */}
        {alert.type && alert.type !== "—" && (
          <span style={{
            fontFamily:     "'Switzer', 'Helvetica Neue', sans-serif",
            fontSize:       "10px",
            fontWeight:     600,
            letterSpacing:  "0.04em",
            textTransform:  "uppercase",
            background:     tc.bg,
            color:          tc.text,
            padding:        "2px 8px",
            borderRadius:   "9999px",
          }}>
            {alert.type}
          </span>
        )}
        {/* Status */}
        <span style={{
          fontFamily: "'Switzer', 'Helvetica Neue', sans-serif",
          fontSize:   "10px",
          color:      "#6b7280",
          fontWeight: 500,
        }}>
          {alert.status}
        </span>
      </div>

      {/* Row 3: rationale */}
      <p style={{
        fontFamily:  "'Switzer', 'Helvetica Neue', sans-serif",
        fontSize:    "12px",
        color:       "#1f2937",
        lineHeight:  1.6,
        margin:      0,
        fontWeight:  400,
      }}>
        {alert.impactRationale}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DevelopmentAlertsProps {
  nearbyDevelopments: AreaIntelligence["nearbyDevelopments"];
  planningActivity?:  AreaIntelligence["planningActivity"];
  areaName?:          string;
}

export function DevelopmentAlerts({
  nearbyDevelopments,
  planningActivity,
  areaName,
}: DevelopmentAlertsProps) {
  const alerts = deriveDevelopmentAlerts(nearbyDevelopments, planningActivity);
  if (alerts.length === 0) return null;

  const hasDisruption = alerts.some(a => a.impactLabel === "disruption");
  const hasUpside     = alerts.some(a => a.impactLabel === "upside");
  const countLabel    = alerts.length === 1 ? "1 alert" : `${alerts.length} alerts`;
  const summaryLabel  = hasDisruption && hasUpside
    ? "Upside and disruption risk"
    : hasDisruption
    ? "Disruption risk nearby"
    : hasUpside
    ? "Development upside nearby"
    : "Nearby change to review";

  return (
    <div
      style={{
        background:   "#1A1612",
        border:       "1px solid #B8860B33",
        borderRadius: "12px",
        padding:      "18px 22px",
        marginBottom: "16px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <Construction
            width={17} height={17}
            style={{ color: "#B8860B", flexShrink: 0 }}
            strokeWidth={2}
          />
          <div>
            <p style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize:   "15px",
              color:      "#FAF8F4",
              margin:     0,
              lineHeight: 1.2,
              fontWeight: 400,
            }}>
              Nearby Development Alerts
            </p>
            <p style={{
              fontFamily:    "'Switzer', 'Helvetica Neue', sans-serif",
              fontSize:      "11px",
              color:         "#B8860B",
              margin:        "2px 0 0",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight:    500,
            }}>
              {summaryLabel} · {countLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Gold divider */}
      <div style={{
        height:     "1px",
        background: "linear-gradient(90deg, #B8860B44 0%, #B8860B22 60%, transparent 100%)",
        marginBottom: "14px",
      }} />

      {/* Alert cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {alerts.map((alert, i) => (
          <AlertCard key={i} alert={alert} />
        ))}
      </div>

      {/* Footer */}
      <p style={{
        fontFamily:  "'Switzer', 'Helvetica Neue', sans-serif",
        fontSize:    "10px",
        color:       "#6B6560",
        margin:      "12px 0 0",
        lineHeight:  1.4,
      }}>
        High-signal schemes only. Full development detail and all tracked schemes are in the Nearby Development Tracker section below.
      </p>
    </div>
  );
}

// ── PDF helper export ─────────────────────────────────────────────────────────

export function pdfDevelopmentAlertsSection(
  nearbyDevelopments: AreaIntelligence["nearbyDevelopments"],
  planningActivity?: AreaIntelligence["planningActivity"],
): string {
  const alerts = deriveDevelopmentAlerts(nearbyDevelopments, planningActivity);
  if (alerts.length === 0) return "";

  const IMPACT_COLOURS: Record<DevImpactLabel, { bg: string; text: string; border: string; label: string }> = {
    disruption: { bg: "#fee2e2", text: "#991b1b", border: "#ef4444", label: "Disruption risk" },
    mixed:      { bg: "#fef3c7", text: "#92400e", border: "#f59e0b", label: "Mixed impact"    },
    upside:     { bg: "#dcfce7", text: "#166534", border: "#22c55e", label: "Likely upside"   },
    unclear:    { bg: "#f1f5f9", text: "#475569", border: "#94a3b8", label: "Impact unclear"  },
  };

  const rows = alerts.map(a => {
    const col  = IMPACT_COLOURS[a.impactLabel] ?? IMPACT_COLOURS.unclear;
    const dist = a.distanceM
      ? (a.distanceM < 1000 ? `~${Math.round(a.distanceM / 50) * 50}m` : `~${(a.distanceM / 1000).toFixed(1)}km`)
      : "";
    return `
      <div style="border-left:3px solid ${col.border};background:${col.bg}33;border-radius:6px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:5px">
          <span style="font-size:12px;font-weight:700;color:#111827">${a.name}</span>
          <span style="font-size:9px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;background:${col.bg};color:${col.text};padding:2px 7px;border-radius:9999px">${col.label}</span>
          ${a.type && a.type !== "—" ? `<span style="font-size:9px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;background:#e5e7eb;color:#374151;padding:2px 7px;border-radius:9999px">${a.type}</span>` : ""}
          <span style="font-size:10px;color:#6b7280">${a.status}</span>
          ${dist ? `<span style="font-size:10px;color:#6b7280;margin-left:auto">${dist}</span>` : ""}
        </div>
        <p style="font-size:11.5px;color:#1f2937;line-height:1.6;margin:0">${a.impactRationale}</p>
      </div>`;
  }).join("");

  return `
  <div class="section">
    <div class="section-label">Nearby Development Alerts</div>
    <p style="font-size:11px;color:#6b7280;margin-bottom:10px">High-signal schemes nearby that could affect demand, liveability, or short-term disruption. Full tracker below.</p>
    ${rows}
    <p style="font-size:10px;color:#9ca3af;margin-top:6px">Check the council planning portal before exchange to confirm current application status.</p>
  </div>`;
}
