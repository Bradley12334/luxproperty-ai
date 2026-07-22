import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "wouter";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SoldPricesMap, type MapPoint } from "@/components/sold-prices-map";
import {
  Search,
  FileText,
  TrendingDown,
  TrendingUp,
  Minus,
  Handshake,
  BarChart3,
  Info,
  AlertTriangle,
  Clock,
  Home,
  Tag,
  Sparkles,
  ListOrdered,
  MapPin,
  Droplets,
  CheckCircle2,
  ShieldAlert,
  CloudRain,
  Waves,
  TrainFront,
  Footprints,
  Route,
  ExternalLink,
  GraduationCap,
  Accessibility,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────────
 * Phase 2a brief page. Takes a postcode, calls GET /api/brief, shows the reused
 * stepping loader over the ~20-30s generation, and renders the one rebuilt
 * section — Prices, Trend & Negotiation — in all of its render states, plus the
 * remaining sections as "coming in rebuild" placeholders. Deliberately minimal;
 * later phases add the other sections and tier gating.
 * ──────────────────────────────────────────────────────────────────────────── */

// ── Payload types (mirror lib/brief/generate.js) ─────────────────────────────
type SectionState = "DATA" | "SPARSE" | "UNAVAILABLE" | "LOCKED" | "COMING_SOON";
interface Money { raw: number | null; formatted: string }
interface Pct { raw: number | null; formatted: string; direction?: "up" | "down" | "flat" }
interface TrendRow { year: number; count: number; median: Money; change: Pct; state: "data" | "sparse" | "missing" }
interface LeveragePoint { signal: string; text: string }
interface BriefSection {
  key: string;
  title: string;
  minTier: "EXP" | "PRO" | "INV";
  state: SectionState;
  note?: string | null;
  sourceFootnote?: string;
  sourceNote?: string;
  disclaimer?: string;
  entitled?: boolean;
  comingSoon?: boolean;
  data: any;
}
interface BriefMeta {
  postcode: string; outcode: string; outcodeOnly?: boolean; ward: string; localAuthority: string;
  region: string | null; country: string; tier: string;
  window: { startYear: number; endYear: number };
  transactionCount: number; truncated: boolean; cached: boolean; generatedAt: string;
  cacheLayer?: "memory" | "durable" | "live";
  dataError?: { code: string; retryable?: boolean } | null;
}
interface BriefPayload { ok: true; meta: BriefMeta; sections: BriefSection[] }
interface BriefErrorResp { ok: false; error: { code: string; message: string } }

// ── Reused stepping loader (from the original brief) ─────────────────────────
const LOADING_STEPS = [
  "Resolving postcode & verifying location",
  "Fetching HM Land Registry sold prices",
  "Deduplicating in-district transactions",
  "Computing medians & price trend",
  "Assessing confidence & negotiation position",
  "Assembling your brief",
];

function LoadingState({ retryNote }: { retryNote?: string | null }) {
  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setStepIdx((i) => Math.min(i + 1, LOADING_STEPS.length - 1)), 4200);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
      <div className="text-center py-12 mb-8">
        <div className="inline-flex items-center gap-2 text-primary mb-5">
          <FileText className="h-5 w-5 animate-pulse" />
        </div>
        <h2 className="font-serif text-2xl tracking-tight mb-2">Compiling your property brief</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Live HM Land Registry data — this typically takes 20–30 seconds.
        </p>
        {retryNote && (
          <div className="mx-auto mb-8 flex max-w-md items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-left text-xs text-muted-foreground">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{retryNote}</span>
          </div>
        )}
        <div className="flex flex-col items-center gap-2">
          {LOADING_STEPS.map((step, i) => (
            <div
              key={step}
              className={`flex items-center gap-2 text-sm transition-all duration-500 ${
                i < stepIdx
                  ? "text-primary/50 line-through"
                  : i === stepIdx
                  ? "text-foreground font-medium"
                  : "text-muted-foreground/40"
              }`}
            >
              {i < stepIdx && <span className="text-primary text-xs">✓</span>}
              {i === stepIdx && (
                <span className="flex gap-0.5">
                  <span className="pulse-dot w-1 h-1 rounded-full bg-primary" />
                  <span className="pulse-dot w-1 h-1 rounded-full bg-primary" />
                  <span className="pulse-dot w-1 h-1 rounded-full bg-primary" />
                </span>
              )}
              {i > stepIdx && <span className="w-3" />}
              {step}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6 space-y-3">
            <div className="skeleton-shimmer h-5 w-44 rounded" />
            <div className="skeleton-shimmer h-4 w-full rounded" />
            <div className="skeleton-shimmer h-4 w-5/6 rounded" />
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Small shared bits ────────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: "EXP" | "PRO" | "INV" }) {
  return (
    <Badge variant="outline" className="ml-auto text-[10px] font-semibold uppercase tracking-wide">
      {tier}
    </Badge>
  );
}

function SectionHeading({
  icon,
  tier,
  children,
}: {
  icon?: React.ReactNode;
  tier?: "EXP" | "PRO" | "INV";
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary mb-4">
      {icon}
      {children}
      {tier && <TierBadge tier={tier} />}
    </h3>
  );
}

function YoYFigure({ pct }: { pct: Pct }) {
  const dir = pct.direction ?? "flat";
  const Icon = dir === "down" ? TrendingDown : dir === "up" ? TrendingUp : Minus;
  const color =
    dir === "down" ? "text-red-600 dark:text-red-400" : dir === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 font-serif text-2xl tabular-nums ${color}`}>
      <Icon className="h-4 w-4" />
      {pct.formatted}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-serif text-2xl tabular-nums text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ── The rebuilt section: Prices, Trend & Negotiation ─────────────────────────
function PricesSection({ section }: { section: BriefSection }) {
  if (section.state === "UNAVAILABLE") {
    return (
      <Card className="p-6">
        <SectionHeading icon={<BarChart3 className="h-3.5 w-3.5" />}>{section.title}</SectionHeading>
        <div className="flex items-start gap-3 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p>{section.note}</p>
        </div>
      </Card>
    );
  }

  const { marketOverview: mo, trend, negotiation: neg } = section.data;

  return (
    <Card className="p-6 space-y-8">
      <div>
        <SectionHeading icon={<BarChart3 className="h-3.5 w-3.5" />}>{section.title}</SectionHeading>

        {section.state === "SPARSE" && section.note && (
          <div className="mb-5 flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p className="text-muted-foreground">{section.note}</p>
          </div>
        )}

        {/* Market overview */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label={`${mo.latestYear.year} median`} value={mo.latestYear.median.formatted} sub={`${mo.latestYear.count} sales`} />
          <Stat label={`${trend.rows[0].year}–${mo.latestYear.year} median`} value={mo.windowMedian.formatted} sub={`${mo.totalTransactions} sales`} />
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Year-on-year</div>
            <YoYFigure pct={mo.yoyChange} />
            <div className="text-xs text-muted-foreground">vs {mo.previousYear.year}</div>
          </div>
          <Stat label="Confidence" value={cap(mo.confidence.level)} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{mo.confidence.note}</p>
      </div>

      {/* Price trend */}
      <div>
        <SectionHeading icon={<TrendingUp className="h-3.5 w-3.5" />}>Price Trend ({trend.years}-Year)</SectionHeading>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Year</th>
                <th className="py-2 pr-4 font-medium text-right">Sales</th>
                <th className="py-2 pr-4 font-medium text-right">Median</th>
                <th className="py-2 font-medium text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {trend.rows.map((r: TrendRow) => (
                <tr key={r.year} className={`border-b border-border/50 ${r.state === "missing" ? "text-muted-foreground/50" : ""}`}>
                  <td className="py-2 pr-4 tabular-nums">
                    {r.year}
                    {r.state === "sparse" && <span className="ml-2 text-[10px] uppercase tracking-wide text-primary/70">low volume</span>}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{r.count || "—"}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{r.median.formatted}</td>
                  <td className={`py-2 text-right tabular-nums ${changeColor(r.change.direction ?? dirOf(r.change.raw))}`}>{r.change.formatted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {trend.lowVolumeNote && <p className="mt-3 text-xs text-muted-foreground">{trend.lowVolumeNote}</p>}
      </div>

      {/* Negotiation / pre-offer */}
      <div>
        <SectionHeading icon={<Handshake className="h-3.5 w-3.5" />}>Pre-Offer & Negotiation</SectionHeading>

        <div className="grid gap-6 sm:grid-cols-2">
          {neg.fairValueRange && (
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Fair value range</div>
              <div className="font-serif text-xl tabular-nums text-foreground">
                {neg.fairValueRange.low.formatted} – {neg.fairValueRange.high.formatted}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{neg.fairValueRange.basis}</div>
            </div>
          )}
          {neg.openingRange && (
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Suggested opening range</div>
              <div className="font-serif text-xl tabular-nums text-foreground">
                {neg.openingRange.low.formatted} – {neg.openingRange.high.formatted}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Offer confidence: {neg.confidence}</div>
            </div>
          )}
        </div>

        {neg.leveragePoints.length > 0 && (
          <div className="mt-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Leverage points</div>
            <ul className="space-y-2">
              {neg.leveragePoints.map((p: LeveragePoint) => (
                <li key={p.signal} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{p.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-5 text-xs italic text-muted-foreground">{neg.notAValuationNote}</p>
      </div>

      {section.sourceFootnote && (
        <p className="border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Nearby Sold Prices (PRO) ─────────────────────────────────────────────────
interface SoldItem {
  id: string;
  address: string;
  postcode: string;
  price: Money;
  propertyType: string;
  tenure: string;
  newBuild: boolean;
  monthYear: string;
}

function SoldPriceRow({ item }: { item: SoldItem }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-3 last:border-0">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{item.address}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{item.propertyType}</span>
          <span aria-hidden>·</span>
          <span>{item.tenure}</span>
          {item.newBuild && (
            <>
              <span aria-hidden>·</span>
              <span className="text-primary">New build</span>
            </>
          )}
          {item.monthYear && (
            <>
              <span aria-hidden>·</span>
              <span>{item.monthYear}</span>
            </>
          )}
        </div>
      </div>
      <div className="shrink-0 font-serif text-base tabular-nums text-foreground">{item.price.formatted}</div>
    </div>
  );
}

function NearbySoldPricesSection({ section }: { section: BriefSection }) {
  if (section.state === "UNAVAILABLE") {
    return (
      <Card className="p-6">
        <SectionHeading icon={<Home className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        <div className="flex items-start gap-3 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p>{section.note}</p>
        </div>
      </Card>
    );
  }

  const { items, summary } = section.data as { items: SoldItem[]; summary: any };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<Home className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>

        {section.state === "SPARSE" && section.note && (
          <div className="mb-5 flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p className="text-muted-foreground">{section.note}</p>
          </div>
        )}

        {summary && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Lowest" value={summary.low.formatted} />
              <Stat label="Median" value={summary.median.formatted} />
              <Stat label="Highest" value={summary.high.formatted} />
            </div>
            {summary.vsWindow?.text && (
              <p className="mt-4 text-sm text-muted-foreground">{summary.vsWindow.text}</p>
            )}
            {summary.spread?.text && (
              <p className="mt-2 text-sm text-muted-foreground">{summary.spread.text}</p>
            )}
          </>
        )}
      </div>

      <div>
        {items.map((item) => (
          <SoldPriceRow key={item.id} item={item} />
        ))}
      </div>

      {section.sourceNote && <p className="text-[11px] text-muted-foreground">{section.sourceNote}</p>}
      {section.sourceFootnote && (
        <p className="border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Street Price Ranking (INV) ───────────────────────────────────────────────
interface StreetRow {
  rank: number;
  street: string;
  count: number;
  median: Money;
  vsArea: { pct: number; formatted: string; direction: "above" | "below" | "inline" } | null;
}

function StreetList({ rows }: { rows: StreetRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Street</th>
            <th className="py-2 pr-4 font-medium text-right">Sales</th>
            <th className="py-2 pr-4 font-medium text-right">Median</th>
            <th className="py-2 font-medium text-right">vs area</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.street} className="border-b border-border/50">
              <td className="py-2 pr-4">
                <span className="tabular-nums text-muted-foreground">{r.rank}.</span> {r.street}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">{r.count}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{r.median.formatted}</td>
              <td className={`py-2 text-right tabular-nums ${r.vsArea ? changeColor(r.vsArea.direction === "above" ? "up" : r.vsArea.direction === "below" ? "down" : "flat") : "text-muted-foreground"}`}>
                {r.vsArea ? r.vsArea.formatted : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StreetRankingSection({ section }: { section: BriefSection }) {
  if (section.state === "UNAVAILABLE") {
    return (
      <Card className="p-6">
        <SectionHeading icon={<ListOrdered className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        <div className="flex items-start gap-3 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p>{section.note}</p>
        </div>
      </Card>
    );
  }

  const { top, bottom, areaMedian } = section.data as { top: StreetRow[]; bottom: StreetRow[]; areaMedian: Money | null };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<ListOrdered className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>

        {section.state === "SPARSE" && section.note && (
          <div className="mb-5 flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p className="text-muted-foreground">{section.note}</p>
          </div>
        )}

        {areaMedian && (
          <p className="mb-4 text-sm text-muted-foreground">
            Area median across all ranked streets: <span className="font-medium text-foreground tabular-nums">{areaMedian.formatted}</span>. Streets are ranked by the median of their recorded sales — the sale count shows how much evidence sits behind each.
          </p>
        )}
      </div>

      {top.length > 0 && (
        <div>
          {bottom.length > 0 && (
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Highest median</div>
          )}
          <StreetList rows={top} />
        </div>
      )}

      {bottom.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lowest median</div>
          <StreetList rows={bottom} />
        </div>
      )}

      {section.sourceFootnote && (
        <p className="border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Sold Prices Map (INV) ────────────────────────────────────────────────────
const TIER_DOT: Record<string, string> = {
  low: "#3b82f6",
  "mid-low": "#22c55e",
  mid: "#eab308",
  "mid-high": "#f97316",
  high: "#a855f7",
};

function SoldPricesMapSection({ section }: { section: BriefSection }) {
  if (section.state === "UNAVAILABLE") {
    return (
      <Card className="p-6">
        <SectionHeading icon={<MapPin className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        <div className="flex items-start gap-3 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p>{section.note}</p>
        </div>
      </Card>
    );
  }

  const { mapAvailable, mapNote, centre, subjectLabel, points, legend, summary } = section.data as {
    mapAvailable: boolean;
    mapNote: string | null;
    centre: { lat: number; lng: number };
    subjectLabel: string;
    points: MapPoint[];
    legend: { tier: string; label: string }[];
    summary: { low: Money; median: Money; high: Money };
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<MapPin className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>

        {section.state === "SPARSE" && section.note && (
          <div className="mb-5 flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p className="text-muted-foreground">{section.note}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Stat label="Lowest nearby" value={summary.low.formatted} />
          <Stat label="Median nearby" value={summary.median.formatted} />
          <Stat label="Highest nearby" value={summary.high.formatted} />
        </div>
      </div>

      {mapAvailable ? (
        <div className="space-y-3">
          <SoldPricesMap centre={centre} subjectLabel={subjectLabel} points={points} />
          {legend.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ background: "#B8860B" }} />
                Subject postcode
              </span>
              {legend.map((l) => (
                <span key={l.tier} className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: TIER_DOT[l.tier] ?? "#6b7280" }} />
                  {l.label}
                </span>
              ))}
            </div>
          )}
          <p className="flex items-start gap-2 text-[11px] italic text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            {section.disclaimer}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p>{mapNote}</p>
          </div>
          <div>
            {points.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-4 border-b border-border/50 py-3 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{p.address}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {p.propertyType}
                    {p.monthYear ? ` · ${p.monthYear}` : ""}
                  </div>
                </div>
                <div className="shrink-0 font-serif text-base tabular-nums text-foreground">{p.price.formatted}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section.sourceFootnote && (
        <p className="border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Flood, Climate & Resilience (EXP / free) ─────────────────────────────────
type RiskBand = "High" | "Medium" | "Low" | "Very Low";
interface FloodNearby { name: string; watercourse: string | null; approxMeters: number | null; approxLabel: string | null; kind: "warning" | "alert" }
interface FloodWarning { name: string; severity: number | null; severityLabel: string | null; message: string | null }
interface FloodData {
  scope: "point" | "district";
  riskBand: RiskBand | null;
  riskBandMeaning?: string | null;
  planningZone: 1 | 2 | 3 | null;
  planningZoneMeaning?: string | null;
  proximity: { bufferM: number; zone3Within: boolean; zone2Within: boolean; text: string } | null;
  headline: string | null;
  defencesNote?: string | null;
  insuranceNote?: string;
  nearby: { count: number; items: FloodNearby[]; text: string };
  warnings: { active: boolean; checked: boolean; count: number; items: FloodWarning[]; text: string };
  historic: { flooded: boolean; scope: string; text: string } | null;
  guidance: { surfaceWater: string; subsidence: string };
  nextSteps: string[];
}

// Risk-band colour, echoing the up/down palette used elsewhere: elevated = warm/red,
// benign = cool/green. Kept as full class strings so Tailwind's JIT can see them.
const BAND_STYLE: Record<RiskBand, { text: string; chip: string }> = {
  High: { text: "text-red-600 dark:text-red-400", chip: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" },
  Medium: { text: "text-orange-600 dark:text-orange-400", chip: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  Low: { text: "text-amber-600 dark:text-amber-400", chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  "Very Low": { text: "text-emerald-600 dark:text-emerald-400", chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
};
const ZONE_ELEVATED = new Set([2, 3]);

/** A soft callout box. Tone drives the colour; icon is caller-supplied. */
function Callout({ tone, icon, children }: { tone: "info" | "warn" | "danger" | "ok"; icon: React.ReactNode; children: React.ReactNode }) {
  const cls =
    tone === "danger"
      ? "border-red-500/30 bg-red-500/5"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-500/5"
      : tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : "border-primary/30 bg-primary/5";
  return (
    <div className={`flex items-start gap-3 rounded-md border ${cls} p-3 text-sm`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="text-muted-foreground [&_strong]:text-foreground">{children}</div>
    </div>
  );
}

/** The three-way active-warnings distinction — the whole point of the state model:
 *  a live warning, a confirmed all-clear, and a check that couldn't be completed are
 *  visually and semantically different. "Couldn't confirm" must never read as safe. */
function WarningsBlock({ warnings }: { warnings: FloodData["warnings"] }) {
  if (warnings.active) {
    return (
      <Callout tone="danger" icon={<ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />}>
        <p className="font-medium text-red-700 dark:text-red-300">{warnings.text}</p>
        <ul className="mt-2 space-y-1">
          {warnings.items.map((w, i) => (
            <li key={i}>
              {w.severityLabel && <span className="font-medium text-foreground">{w.severityLabel}: </span>}
              {w.name}
              {w.message ? ` — ${w.message}` : ""}
            </li>
          ))}
        </ul>
      </Callout>
    );
  }
  if (!warnings.checked) {
    // Distinct amber "couldn't confirm" — an unreached live service is NOT an all-clear.
    return (
      <Callout tone="warn" icon={<Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>
        {warnings.text}
      </Callout>
    );
  }
  // Confirmed: none in force.
  return (
    <Callout tone="ok" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}>
      {warnings.text}
    </Callout>
  );
}

function NearbyAreas({ nearby }: { nearby: FloodData["nearby"] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nearby Environment Agency flood areas</div>
      <p className="text-sm text-muted-foreground">{nearby.text}</p>
      {nearby.items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {nearby.items.map((a, i) => (
            <li key={i} className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-0">
              <div className="min-w-0">
                <div className="truncate text-sm text-foreground">{a.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {a.watercourse && <span>{a.watercourse}</span>}
                  <span className="uppercase tracking-wide text-[10px] text-primary/70">{a.kind}</span>
                </div>
              </div>
              {a.approxLabel && <div className="shrink-0 text-sm tabular-nums text-muted-foreground">{a.approxLabel}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GuidanceBlocks({ guidance }: { guidance: FloodData["guidance"] }) {
  return (
    <div className="space-y-3">
      <Callout tone="info" icon={<CloudRain className="h-4 w-4 text-primary" />}>
        <strong>Surface water — </strong>{guidance.surfaceWater}
      </Callout>
      <Callout tone="info" icon={<Info className="h-4 w-4 text-primary" />}>
        <strong>Subsidence & ground stability — </strong>{guidance.subsidence}
      </Callout>
    </div>
  );
}

function FloodClimateSection({ section }: { section: BriefSection }) {
  if (section.state === "UNAVAILABLE") {
    return (
      <Card className="p-6">
        <SectionHeading icon={<Droplets className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        <div className="flex items-start gap-3 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p>{section.note}</p>
        </div>
      </Card>
    );
  }

  const d = section.data as FloodData;
  const band = d.riskBand;
  const zone = d.planningZone;
  const bandStyle = band ? BAND_STYLE[band] : null;
  const zoneElevated = zone != null && ZONE_ELEVATED.has(zone);

  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<Droplets className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>

        {/* SPARSE / district-wide framing note */}
        {section.state === "SPARSE" && section.note && (
          <div className="mb-5">
            <Callout tone="warn" icon={<Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>{section.note}</Callout>
          </div>
        )}
        {section.state === "DATA" && section.note && (
          <div className="mb-5">
            <Callout tone="info" icon={<Info className="h-4 w-4 text-primary" />}>{section.note}</Callout>
          </div>
        )}

        {d.headline && <p className="text-sm text-foreground">{d.headline}</p>}
      </div>

      {/* Point-level risk band + planning zone (suppressed district-wide) */}
      {d.scope === "point" && (band || zone) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Flood risk · rivers & sea</div>
            {band ? (
              <>
                <div className={`inline-flex items-center rounded-md border px-2 py-0.5 font-serif text-lg ${bandStyle?.chip}`}>{band}</div>
                {d.riskBandMeaning && <div className="mt-2 text-xs text-muted-foreground">{d.riskBandMeaning}</div>}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">—</div>
            )}
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Planning flood zone</div>
            {zone != null ? (
              <>
                <div className={`font-serif text-lg ${zoneElevated ? "text-orange-600 dark:text-orange-400" : "text-foreground"}`}>Zone {zone}</div>
                {d.planningZoneMeaning && <div className="mt-2 text-xs text-muted-foreground">{d.planningZoneMeaning}</div>}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">—</div>
            )}
          </div>
        </div>
      )}

      {/* Edge-of-floodplain proximity nuance */}
      {d.proximity?.text && (
        <Callout tone="warn" icon={<Waves className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>{d.proximity.text}</Callout>
      )}

      {/* Zone-vs-band (undefended vs defended) reconciliation */}
      {d.defencesNote && (
        <Callout tone="info" icon={<ShieldAlert className="h-4 w-4 text-primary" />}>{d.defencesNote}</Callout>
      )}

      {/* Insurance & lending line */}
      {d.insuranceNote && (
        <p className={`text-sm ${d.scope === "point" && (band === "High" || band === "Medium" || zoneElevated) ? "text-foreground" : "text-muted-foreground"}`}>
          {d.insuranceNote}
        </p>
      )}

      {/* Live warnings — three distinct states */}
      <WarningsBlock warnings={d.warnings} />

      {/* Nearby named areas with distances */}
      <NearbyAreas nearby={d.nearby} />

      {/* Historic flooding */}
      {d.historic?.text && (
        d.historic.flooded ? (
          <Callout tone="warn" icon={<AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>{d.historic.text}</Callout>
        ) : (
          <p className="text-sm text-muted-foreground">{d.historic.text}</p>
        )
      )}

      {/* Surface water + subsidence guidance (labelled, no fabricated rating) */}
      <GuidanceBlocks guidance={d.guidance} />

      {/* Next steps */}
      {d.nextSteps?.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Before you offer</div>
          <ul className="space-y-2">
            {d.nextSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {section.sourceFootnote && (
        <p className="border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Stations & Commute (EXP) ─────────────────────────────────────────────────
interface CommuteHeadline { destination: string; distanceLabel: string; london: boolean; text: string }
interface StationRow {
  name: string; modes: string[]; lines: string[];
  distanceMeters: number; distanceLabel: string; walkMins: number | null;
}
interface StationsCommuteData {
  scope: "point" | "district";
  stationsState: "found" | "none" | "unavailable";
  walkSpeedNote: string;
  stations: StationRow[];
  nearest: StationRow | null;
  commute: CommuteHeadline;
}

function StationChips({ modes, lines }: { modes: string[]; lines: string[] }) {
  // Modes are the primary signal; named lines (where OSM records them) are secondary.
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
      {modes.map((m) => (
        <span key={m} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
          {m}
        </span>
      ))}
      {lines.map((l) => (
        <span key={l} className="text-[11px] text-muted-foreground">{l}</span>
      ))}
    </div>
  );
}

function StationsCommuteSection({ section }: { section: BriefSection }) {
  const d = section.data as StationsCommuteData;
  const stationsAvailable = d.stationsState === "found";

  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<TrainFront className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>

        {/* Honest station-state / district framing note */}
        {section.note && (
          <div className="mb-5">
            <Callout
              tone={d.stationsState === "found" ? "info" : "warn"}
              icon={
                d.stationsState === "found"
                  ? <Info className="h-4 w-4 text-primary" />
                  : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              }
            >
              {section.note}
            </Callout>
          </div>
        )}

        {/* Commute headline — always present */}
        <div className="rounded-lg border border-border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Headline commute</div>
          <div className="font-serif text-lg text-foreground">
            {d.commute.london ? "Central London" : d.commute.destination}
            <span className="ml-2 text-sm font-normal text-muted-foreground">· ~{d.commute.distanceLabel} straight-line</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{d.commute.text}</p>
        </div>
      </div>

      {/* Stations list */}
      {stationsAvailable && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Footprints className="h-3.5 w-3.5" />
            Stations within walking range
          </div>
          <ul className="space-y-2">
            {d.stations.map((s, i) => (
              <li key={i} className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm text-foreground">{s.name}</div>
                  <StationChips modes={s.modes} lines={s.lines} />
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm tabular-nums text-foreground">{s.walkMins ? `${s.walkMins} min walk` : s.distanceLabel}</div>
                  <div className="text-[11px] tabular-nums text-muted-foreground">{s.distanceLabel}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">{d.walkSpeedNote}</p>
        </div>
      )}

      {section.sourceFootnote && (
        <p className="border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Full Commute Calculator (PRO) ────────────────────────────────────────────
interface CommuteTflRow { destination: string; durationMins: number | null; durationLabel: string | null; modes: string[] }
interface CommuteEstRow { destination: string; distanceLabel: string; driveMins: number; driveLabel: string }
interface CommuteCalcData {
  method: "tfl" | "estimate";
  from: string;
  linkUrl: string;
  linkLabel: string;
  rows: (CommuteTflRow | CommuteEstRow)[];
}

function CommuteCalculatorSection({ section }: { section: BriefSection }) {
  const d = section.data as CommuteCalcData;
  const isTfl = d.method === "tfl";

  return (
    <Card className="p-6 space-y-5">
      <div>
        <SectionHeading icon={<Route className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>

        {section.note && (
          <div className="mb-5">
            <Callout
              tone={isTfl && section.state === "DATA" ? "info" : "warn"}
              icon={
                isTfl && section.state === "DATA"
                  ? <Info className="h-4 w-4 text-primary" />
                  : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              }
            >
              {section.note}
            </Callout>
          </div>
        )}
      </div>

      {d.rows.length > 0 && (
        <ul className="space-y-2">
          {d.rows.map((row, i) => (
            <li key={i} className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-0">
              <div className="min-w-0">
                <div className="text-sm text-foreground">{row.destination}</div>
                {isTfl ? (
                  (row as CommuteTflRow).modes.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      {(row as CommuteTflRow).modes.map((m) => (
                        <span key={m} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">{m}</span>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="mt-0.5 text-[11px] text-muted-foreground">~{(row as CommuteEstRow).distanceLabel} straight-line</div>
                )}
              </div>
              <div className="shrink-0 text-right">
                {isTfl ? (
                  <div className="font-serif text-lg tabular-nums text-foreground">
                    {(row as CommuteTflRow).durationLabel ?? <span className="text-sm text-muted-foreground">—</span>}
                  </div>
                ) : (
                  <>
                    <div className="font-serif text-lg tabular-nums text-foreground">~{(row as CommuteEstRow).driveLabel}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">est. by road</div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <a
        href={d.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {d.linkLabel}
      </a>

      {section.sourceFootnote && (
        <p className="border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Schools (EXP) ─────────────────────────────────────────────────────────────
interface SchoolRow {
  name: string; phase: string; specialist: boolean;
  distanceMeters: number; distanceLabel: string; walkMins: number | null; ofstedUrl: string;
}
interface SchoolsData {
  scope: "point" | "district";
  schools: SchoolRow[];
  ratingsNote: string | null;
  catchmentCaveat: string;
}

function SchoolsSection({ section }: { section: BriefSection }) {
  const d = section.data as SchoolsData;
  const hasSchools = d.schools.length > 0;

  return (
    <Card className="p-6 space-y-5">
      <div>
        <SectionHeading icon={<GraduationCap className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>

        {section.note && (
          <div className="mb-5">
            <Callout
              tone={section.state === "DATA" ? "info" : "warn"}
              icon={
                section.state === "DATA"
                  ? <Info className="h-4 w-4 text-primary" />
                  : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              }
            >
              {section.note}
            </Callout>
          </div>
        )}

        {/* Honest "no ratings in-brief" explanation */}
        {d.ratingsNote && (
          <div className="mb-4">
            <Callout tone="info" icon={<Info className="h-4 w-4 text-primary" />}>{d.ratingsNote}</Callout>
          </div>
        )}
      </div>

      {hasSchools && (
        <ul className="space-y-2">
          {d.schools.map((s, i) => (
            <li key={i} className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-foreground">{s.name}</span>
                  {s.specialist && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      <Accessibility className="h-3 w-3" /> Specialist / SEND
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="uppercase tracking-wide text-[10px] text-primary/70">{s.phase}</span>
                  <a
                    href={s.ofstedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Ofsted report
                  </a>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm tabular-nums text-foreground">{s.walkMins ? `${s.walkMins} min walk` : s.distanceLabel}</div>
                <div className="text-[11px] tabular-nums text-muted-foreground">{s.distanceLabel}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Catchment caveat — always shown */}
      <Callout tone="warn" icon={<Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>{d.catchmentCaveat}</Callout>

      {section.sourceFootnote && (
        <p className="border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Coming-soon placeholders ─────────────────────────────────────────────────
function ComingSoonList({ sections }: { sections: BriefSection[] }) {
  return (
    <Card className="p-6">
      <SectionHeading icon={<Clock className="h-3.5 w-3.5" />}>Coming in the rebuild</SectionHeading>
      <p className="mb-4 text-sm text-muted-foreground">
        These sections are part of the full brief and are being rebuilt in later phases. They appear here so nothing is
        silently missing from the report.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {sections.map((s) => (
          <div key={s.key} className="flex items-center justify-between rounded-md border border-dashed border-border px-3 py-2 text-sm">
            <span className="text-muted-foreground">{s.title}</span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {s.minTier}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Error state (resolve-altitude failures) ──────────────────────────────────
function ErrorState({ error }: { error: { code: string; message: string } }) {
  const friendly: Record<string, string> = {
    INVALID_POSTCODE: "That postcode isn’t recognised",
    UNSUPPORTED_NATION: "England & Wales only",
    VALIDATION_GUARD_FAILED: "Couldn’t verify that location",
    UPSTREAM_ERROR: "Data source unavailable",
  };
  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-16">
      <Card className="p-8 text-center">
        <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-primary" />
        <h2 className="font-serif text-xl mb-2">{friendly[error.code] ?? "Couldn’t generate the brief"}</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </Card>
    </div>
  );
}

// ── Meta header ──────────────────────────────────────────────────────────────
function BriefHeader({ meta }: { meta: BriefMeta }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="uppercase tracking-wide">{meta.outcode}</Badge>
        {meta.outcodeOnly ? (
          <span>District-wide</span>
        ) : (
          meta.ward && <span>{meta.ward}</span>
        )}
        {meta.localAuthority && <span>· {meta.localAuthority}</span>}
        {meta.region && <span>· {meta.region}</span>}
      </div>
      <h1 className="mt-2 font-serif text-3xl tracking-tight">
        {meta.postcode}
        {meta.outcodeOnly && <span className="ml-2 text-base font-normal text-muted-foreground">· district-wide</span>}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {meta.outcodeOnly
          ? "Based on the postcode-district centroid — enter a full postcode for a location-specific brief. "
          : ""}
        {meta.transactionCount.toLocaleString()} in-district sold prices · {meta.window.startYear}–{meta.window.endYear}
        {meta.cached ? " · cached" : ""}
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
type Status = "idle" | "loading" | "done" | "error";

// The location is verified before any price fetch, so a price section that comes
// back UNAVAILABLE is a slow/absent Land Registry scan — worth retrying. Land
// Registry latency is per-request and the server caches the first success durably,
// so a later attempt usually lands on warm data. UNAVAILABLE only sticks after the
// retries are exhausted (a genuine source outage).
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [2500, 5000]; // waits before attempts 2 and 3

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Decode a URL path segment without throwing on a malformed sequence (e.g. a
 *  stray "%"). A bad value falls through to the API, which returns the friendly
 *  INVALID_POSTCODE card — never a render-time crash. */
function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** A payload whose price section is UNAVAILABLE for a retryable (latency) reason. */
function isRetryablePayload(p: BriefPayload): boolean {
  if (!p.meta.dataError?.retryable) return false;
  const prices = p.sections.find((s) => s.key === "pricesTrendNegotiation");
  return prices?.state === "UNAVAILABLE";
}

export default function BriefPage() {
  const params = useParams();
  const initial = params.id ? safeDecode(params.id) : "";
  const [postcode, setPostcode] = useState(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [payload, setPayload] = useState<BriefPayload | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [retryNote, setRetryNote] = useState<string | null>(null);

  async function runGeneration(pc: string) {
    const clean = pc.trim();
    if (!clean) return;
    setStatus("loading");
    setPayload(null);
    setError(null);
    setRetryNote(null);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(`/api/brief?postcode=${encodeURIComponent(clean)}`);
        const json: BriefPayload | BriefErrorResp = await res.json();

        // Resolve-altitude failure (invalid postcode / Scotland-NI / guard): these
        // are deterministic — retrying won't change them. Surface immediately.
        if (!res.ok || json.ok === false) {
          setError((json as BriefErrorResp).error ?? { code: "UPSTREAM_ERROR", message: "Brief generation failed." });
          setStatus("error");
          return;
        }

        const good = json as BriefPayload;

        // A verified location but a slow/absent price scan → retry on warm data.
        if (isRetryablePayload(good) && attempt < MAX_ATTEMPTS) {
          setRetryNote(
            "HM Land Registry is taking longer than usual for this area — retrying to gather the full sold-price history…",
          );
          await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? 5000);
          continue;
        }

        setPayload(good);
        setStatus("done");
        return;
      } catch {
        // Network/parse failure — retry a couple of times before giving up.
        if (attempt < MAX_ATTEMPTS) {
          setRetryNote("Reconnecting to the brief service…");
          await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? 5000);
          continue;
        }
        setError({ code: "UPSTREAM_ERROR", message: "Couldn’t reach the brief service. Please try again." });
        setStatus("error");
        return;
      }
    }
  }

  // Deep-link: /brief/E8%201NG auto-generates on load.
  useEffect(() => {
    if (initial) runGeneration(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runGeneration(postcode);
  }

  const prices = payload?.sections.find((s) => s.key === "pricesTrendNegotiation");
  const nearby = payload?.sections.find((s) => s.key === "nearbySoldPrices");
  const streets = payload?.sections.find((s) => s.key === "streetPriceRanking");
  const soldMap = payload?.sections.find((s) => s.key === "soldPricesMap");
  const flood = payload?.sections.find((s) => s.key === "floodClimate");
  const stationsCommute = payload?.sections.find((s) => s.key === "stationsCommute");
  const commuteCalc = payload?.sections.find((s) => s.key === "commuteCalculator");
  const schools = payload?.sections.find((s) => s.key === "schools");
  const comingSoon = payload?.sections.filter((s) => s.comingSoon) ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Postcode input — always visible so it can be re-run */}
        <div className="border-b border-border bg-muted/20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
            <h1 className="font-serif text-2xl tracking-tight mb-1">Property brief</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Enter a postcode for an evidence-led, HM Land Registry–backed area brief.
            </p>
            <form onSubmit={onSubmit} className="flex gap-2">
              <Input
                value={postcode}
                onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                placeholder="e.g. E8 1NG"
                className="max-w-xs"
                aria-label="Postcode"
                disabled={status === "loading"}
              />
              <Button type="submit" disabled={status === "loading" || !postcode.trim()}>
                <Search className="mr-2 h-4 w-4" />
                {status === "loading" ? "Generating…" : "Generate brief"}
              </Button>
            </form>
          </div>
        </div>

        {status === "idle" && (
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-6 w-6 text-primary/60" />
            <p className="text-sm">Enter a postcode above to generate a brief.</p>
          </div>
        )}

        {status === "loading" && <LoadingState retryNote={retryNote} />}

        {status === "error" && error && <ErrorState error={error} />}

        {status === "done" && payload && prices && (
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
            <BriefHeader meta={payload.meta} />
            <PricesSection section={prices} />
            {nearby && <NearbySoldPricesSection section={nearby} />}
            {streets && <StreetRankingSection section={streets} />}
            {soldMap && <SoldPricesMapSection section={soldMap} />}
            {flood && <FloodClimateSection section={flood} />}
            {stationsCommute && <StationsCommuteSection section={stationsCommute} />}
            {commuteCalc && <CommuteCalculatorSection section={commuteCalc} />}
            {schools && <SchoolsSection section={schools} />}
            {comingSoon.length > 0 && <ComingSoonList sections={comingSoon} />}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function dirOf(n: number | null): "up" | "down" | "flat" {
  if (n == null) return "flat";
  return n > 0 ? "up" : n < 0 ? "down" : "flat";
}
function changeColor(dir: "up" | "down" | "flat") {
  return dir === "down" ? "text-red-600 dark:text-red-400" : dir === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";
}
