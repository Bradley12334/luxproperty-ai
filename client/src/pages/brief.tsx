import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "wouter";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  comingSoon?: boolean;
  data: any;
}
interface BriefMeta {
  postcode: string; outcode: string; ward: string; localAuthority: string;
  region: string | null; country: string; tier: string;
  window: { startYear: number; endYear: number };
  transactionCount: number; truncated: boolean; cached: boolean; generatedAt: string;
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

function LoadingState() {
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
function SectionHeading({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary mb-4">
      {icon}
      {children}
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
        {meta.ward && <span>{meta.ward}</span>}
        {meta.localAuthority && <span>· {meta.localAuthority}</span>}
        {meta.region && <span>· {meta.region}</span>}
      </div>
      <h1 className="mt-2 font-serif text-3xl tracking-tight">{meta.postcode}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {meta.transactionCount.toLocaleString()} in-district sold prices · {meta.window.startYear}–{meta.window.endYear}
        {meta.cached ? " · cached" : ""}
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
type Status = "idle" | "loading" | "done" | "error";

export default function BriefPage() {
  const params = useParams();
  const initial = params.id ? decodeURIComponent(params.id) : "";
  const [postcode, setPostcode] = useState(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [payload, setPayload] = useState<BriefPayload | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  async function runGeneration(pc: string) {
    const clean = pc.trim();
    if (!clean) return;
    setStatus("loading");
    setPayload(null);
    setError(null);
    try {
      const res = await fetch(`/api/brief?postcode=${encodeURIComponent(clean)}`);
      const json: BriefPayload | BriefErrorResp = await res.json();
      if (!res.ok || json.ok === false) {
        setError((json as BriefErrorResp).error ?? { code: "UPSTREAM_ERROR", message: "Brief generation failed." });
        setStatus("error");
        return;
      }
      setPayload(json as BriefPayload);
      setStatus("done");
    } catch {
      setError({ code: "UPSTREAM_ERROR", message: "Couldn’t reach the brief service. Please try again." });
      setStatus("error");
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

        {status === "loading" && <LoadingState />}

        {status === "error" && error && <ErrorState error={error} />}

        {status === "done" && payload && prices && (
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
            <BriefHeader meta={payload.meta} />
            <PricesSection section={prices} />
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
