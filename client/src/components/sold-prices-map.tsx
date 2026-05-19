import { useEffect, useRef, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2 } from "lucide-react";

interface SoldPrice {
  address: string;
  price: string;
  date: string;
  type: string;
  lat: number;
  lng: number;
}

// ── Price parsing ─────────────────────────────────────────────────────────────
function parsePrice(p: string): number {
  return parseInt(p.replace(/[^0-9]/g, ""), 10) || 0;
}

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${n.toLocaleString("en-GB")}`;
}

// ── Price tier assignment ─────────────────────────────────────────────────────
type Tier = "low" | "mid-low" | "mid" | "mid-high" | "high";

function assignTiers(prices: number[]): Tier[] {
  if (prices.length === 0) return [];
  const sorted = [...prices].sort((a, b) => a - b);
  const p20 = sorted[Math.floor(sorted.length * 0.2)];
  const p40 = sorted[Math.floor(sorted.length * 0.4)];
  const p60 = sorted[Math.floor(sorted.length * 0.6)];
  const p80 = sorted[Math.floor(sorted.length * 0.8)];
  return prices.map(p =>
    p <= p20 ? "low" :
    p <= p40 ? "mid-low" :
    p <= p60 ? "mid" :
    p <= p80 ? "mid-high" : "high"
  );
}

const TIER_COLOURS: Record<Tier, { bg: string; border: string; text: string; label: string; dot: string }> = {
  "low":      { bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8", label: "Lower end", dot: "#3b82f6" },
  "mid-low":  { bg: "#f0fdf4", border: "#22c55e", text: "#166534", label: "Below mid",  dot: "#22c55e" },
  "mid":      { bg: "#fefce8", border: "#eab308", text: "#713f12", label: "Mid-range",  dot: "#eab308" },
  "mid-high": { bg: "#fff7ed", border: "#f97316", text: "#7c2d12", label: "Above mid",  dot: "#f97316" },
  "high":     { bg: "#fdf4ff", border: "#a855f7", text: "#6b21a8", label: "Upper end",  dot: "#a855f7" },
};

// ── Interpretation engine ─────────────────────────────────────────────────────
export interface MapInterpretation {
  evidenceLabel: "Strong" | "Moderate" | "Thin";
  evidenceNote: string;
  spreadLabel: "Tight" | "Moderate spread" | "Wide spread";
  spreadNote: string;
  contextNote: string;
  dataSourceNote: string;
}

export function deriveMapInterpretation(
  soldPrices: SoldPrice[],
  areaMedian?: number,
): MapInterpretation {
  const n = soldPrices.length;
  const prices = soldPrices.map(s => parsePrice(s.price)).filter(p => p > 0);
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
  const min = sorted[0] || 0;
  const max = sorted[sorted.length - 1] || 0;
  const spread = median > 0 ? (max - min) / median : 0;

  // Evidence strength
  const evidenceLabel: "Strong" | "Moderate" | "Thin" =
    n >= 8 ? "Strong" : n >= 4 ? "Moderate" : "Thin";

  const evidenceNote =
    n >= 8
      ? `${n} nearby transactions provide a solid local evidence base.`
      : n >= 4
      ? `${n} nearby transactions — a useful directional picture, though more sales would sharpen the range.`
      : n >= 1
      ? `Only ${n} nearby transaction${n > 1 ? "s" : ""} recorded — treat all figures as directional rather than precise.`
      : "No nearby transactions found — pricing context relies on area median only.";

  // Spread
  const spreadLabel: "Tight" | "Moderate spread" | "Wide spread" =
    spread < 0.25 ? "Tight" :
    spread < 0.6 ? "Moderate spread" : "Wide spread";

  const spreadNote =
    spread < 0.25
      ? `Prices are tightly clustered — consistent stock type and condition nearby.`
      : spread < 0.6
      ? `A moderate price range of ${fmtShort(min)}–${fmtShort(max)} — some variation in property size or condition is likely.`
      : `Wide price variation of ${fmtShort(min)}–${fmtShort(max)} — significantly different property types or conditions are represented in this dataset.`;

  // Context vs area median
  let contextNote = "";
  if (areaMedian && areaMedian > 0 && median > 0) {
    const diff = ((median - areaMedian) / areaMedian) * 100;
    if (Math.abs(diff) <= 5) {
      contextNote = `Nearby transactions sit in line with the broader area median (${fmtShort(areaMedian)}).`;
    } else if (diff > 5) {
      contextNote = `Nearby transactions average ${Math.abs(diff).toFixed(0)}% above the postcode median — the immediate streets are pricing at a premium.`;
    } else {
      contextNote = `Nearby transactions average ${Math.abs(diff).toFixed(0)}% below the postcode median — the immediate streets may present relative value.`;
    }
  } else if (median > 0) {
    contextNote = `Transaction median from this dataset: ${fmtShort(median)}.`;
  }

  const dataSourceNote = "HM Land Registry Price Paid data. Reflects completed transactions — not asking prices. Prices are title-deed registered values and may not reflect later negotiation.";

  return { evidenceLabel, evidenceNote, spreadLabel, spreadNote, contextNote, dataSourceNote };
}

// ── Map component ─────────────────────────────────────────────────────────────
interface SoldPricesMapProps {
  soldPrices: SoldPrice[];
  centerLat?: number;
  centerLng?: number;
  areaMedian?: number;
  /** If true, renders the interpretation panel below the map */
  showInterpretation?: boolean;
  /** Compact mode — smaller height, no interpretation (for Investor secondary use) */
  compact?: boolean;
}

export function SoldPricesMap({
  soldPrices,
  centerLat,
  centerLng,
  areaMedian,
  showInterpretation = true,
  compact = false,
}: SoldPricesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const prices = useMemo(() => soldPrices.map(s => parsePrice(s.price)), [soldPrices]);
  const tiers = useMemo(() => assignTiers(prices), [prices]);
  const interpretation = useMemo(
    () => deriveMapInterpretation(soldPrices, areaMedian),
    [soldPrices, areaMedian]
  );

  // Stats for legend / header
  const priceNums = prices.filter(p => p > 0);
  const minPrice = priceNums.length ? Math.min(...priceNums) : 0;
  const maxPrice = priceNums.length ? Math.max(...priceNums) : 0;
  const medPrice = useMemo(() => {
    const sorted = [...priceNums].sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  }, [priceNums]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || soldPrices.length === 0) return;

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const firstPin = soldPrices[0];
      const center: [number, number] = centerLat && centerLng
        ? [centerLat, centerLng]
        : [firstPin.lat, firstPin.lng];

      const map = L.map(mapRef.current!, {
        center,
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });

      // Clean, low-saturation tile layer — keeps price labels readable
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      // Plot sold price pins with tier colours
      soldPrices.forEach((sp, i) => {
        const tier = tiers[i] ?? "mid";
        const colour = TIER_COLOURS[tier];
        const shortPrice = fmtShort(prices[i]);
        const rank = i + 1;

        const markerHtml = `
          <div style="
            position: relative;
            display: inline-flex;
            flex-direction: column;
            align-items: center;
          ">
            <div style="
              background: ${colour.bg};
              color: ${colour.text};
              border: 2px solid ${colour.border};
              font-size: 10px;
              font-weight: 700;
              padding: 3px 7px;
              border-radius: 5px;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.18);
              font-family: system-ui, -apple-system, sans-serif;
              letter-spacing: -0.01em;
              line-height: 1.3;
            ">${shortPrice}</div>
            <div style="
              width: 0; height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 6px solid ${colour.border};
              margin-top: -1px;
            "></div>
          </div>`;

        const icon = L.divIcon({
          html: markerHtml,
          className: "",
          iconSize: [72, 34],
          iconAnchor: [36, 34],
          popupAnchor: [0, -36],
        });

        const popupContent = `
          <div style="font-size:12px;font-family:system-ui,-apple-system,sans-serif;line-height:1.5;min-width:180px">
            <div style="font-size:14px;font-weight:700;color:#1a1612;margin-bottom:3px">${sp.price}</div>
            <div style="color:#374151;margin-bottom:2px;font-size:11px">${sp.address}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
              <span style="font-size:10px;background:${colour.bg};color:${colour.text};border:1px solid ${colour.border};padding:1px 6px;border-radius:3px;font-weight:600">${colour.label}</span>
              <span style="font-size:10px;color:#9ca3af">${sp.type} · ${sp.date}</span>
            </div>
          </div>`;

        L.marker([sp.lat, sp.lng], { icon })
          .addTo(map)
          .bindPopup(popupContent, { maxWidth: 240 });
      });

      // Subject property marker (if lat/lng provided)
      if (centerLat && centerLng) {
        const subjectIcon = L.divIcon({
          html: `<div style="
            width: 14px; height: 14px;
            border-radius: 50%;
            background: #B8860B;
            border: 3px solid white;
            box-shadow: 0 0 0 2px #B8860B, 0 3px 10px rgba(0,0,0,0.35);
          "></div>`,
          className: "",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          popupAnchor: [0, -10],
        });
        L.marker([centerLat, centerLng], { icon: subjectIcon })
          .addTo(map)
          .bindPopup(`<div style="font-size:11px;font-family:system-ui,sans-serif;font-weight:600;color:#B8860B">Subject property / postcode</div>`);
      }

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [soldPrices, centerLat, centerLng, tiers, prices]);

  if (soldPrices.length === 0) return null;

  const mapHeight = compact ? "260px" : "340px";

  // Unique tiers present — for legend
  const presentTiers = [...new Set(tiers)] as Tier[];
  const tierOrder: Tier[] = ["low", "mid-low", "mid", "mid-high", "high"];
  const legendTiers = tierOrder.filter(t => presentTiers.includes(t));

  return (
    <div className="flex flex-col gap-4" data-testid="sold-prices-map-container">
      {/* Stats bar */}
      {!compact && priceNums.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/40 rounded-lg px-3 py-2.5 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-0.5">Lowest nearby</div>
            <div className="text-sm font-bold text-foreground">{fmtShort(minPrice)}</div>
          </div>
          <div className="bg-[#B8860B]/8 rounded-lg px-3 py-2.5 text-center border border-[#B8860B]/20">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-0.5">Local median</div>
            <div className="text-sm font-bold text-[#B8860B]">{fmtShort(medPrice)}</div>
          </div>
          <div className="bg-muted/40 rounded-lg px-3 py-2.5 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-0.5">Highest nearby</div>
            <div className="text-sm font-bold text-foreground">{fmtShort(maxPrice)}</div>
          </div>
        </div>
      )}

      {/* Map */}
      <div
        ref={mapRef}
        style={{ height: mapHeight, width: "100%", borderRadius: "0.5rem", overflow: "hidden" }}
        data-testid="sold-prices-map"
      />

      {/* Price tier legend */}
      {legendTiers.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shrink-0">Price tier:</span>
          {legendTiers.map(tier => (
            <span
              key={tier}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border"
              style={{
                background: TIER_COLOURS[tier].bg,
                color: TIER_COLOURS[tier].text,
                borderColor: TIER_COLOURS[tier].border,
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: TIER_COLOURS[tier].dot }}
              />
              {TIER_COLOURS[tier].label}
            </span>
          ))}
        </div>
      )}

      {/* Interpretation panel */}
      {showInterpretation && <SoldPriceInterpretationPanel interpretation={interpretation} count={soldPrices.length} />}
    </div>
  );
}

// ── Interpretation panel ──────────────────────────────────────────────────────
interface InterpretationPanelProps {
  interpretation: MapInterpretation;
  count: number;
}

export function SoldPriceInterpretationPanel({ interpretation, count }: InterpretationPanelProps) {
  const { evidenceLabel, evidenceNote, spreadLabel, spreadNote, contextNote, dataSourceNote } = interpretation;

  const evidenceConfig = {
    Strong:   { icon: CheckCircle2, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25" },
    Moderate: { icon: Minus,        color: "text-amber-700 dark:text-amber-400",    bg: "bg-amber-500/10 border-amber-500/25" },
    Thin:     { icon: AlertCircle,  color: "text-red-700 dark:text-red-400",        bg: "bg-red-500/10 border-red-500/25" },
  }[evidenceLabel];

  const spreadConfig = {
    "Tight":           { icon: TrendingUp,   color: "text-emerald-700 dark:text-emerald-400" },
    "Moderate spread": { icon: Minus,        color: "text-amber-700 dark:text-amber-400" },
    "Wide spread":     { icon: TrendingDown, color: "text-orange-700 dark:text-orange-400" },
  }[spreadLabel];

  const EvidenceIcon = evidenceConfig.icon;
  const SpreadIcon = spreadConfig.icon;

  return (
    <div className="bg-muted/30 border border-border/50 rounded-lg p-4 flex flex-col gap-3" data-testid="sold-price-interpretation">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Local price picture</span>
      </div>

      {/* Evidence strength */}
      <div className="flex gap-3 items-start">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold shrink-0 ${evidenceConfig.bg} ${evidenceConfig.color}`}>
          <EvidenceIcon className="w-3 h-3" />
          {evidenceLabel} evidence
        </span>
        <p className="text-sm text-muted-foreground leading-relaxed">{evidenceNote}</p>
      </div>

      {/* Price spread */}
      <div className="flex gap-3 items-start">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold shrink-0 bg-muted/60 border-border/60 ${spreadConfig.color}`}>
          <SpreadIcon className="w-3 h-3" />
          {spreadLabel}
        </span>
        <p className="text-sm text-muted-foreground leading-relaxed">{spreadNote}</p>
      </div>

      {/* Area median context */}
      {contextNote && (
        <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-2.5">{contextNote}</p>
      )}

      {/* Data source */}
      <p className="text-[10px] text-muted-foreground/60 border-t border-border/30 pt-2">{dataSourceNote}</p>
    </div>
  );
}
