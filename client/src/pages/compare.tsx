import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { generateBrief } from "@/lib/mockEngine";
import type { BriefReport } from "@shared/schema";
import {
  ArrowRight,
  BarChart3,
  MapPin,
  Train,
  GraduationCap,
  Shield,
  Droplets,
  Wifi,
  Wind,
  TrendingUp,
  Home,
  Footprints,
} from "lucide-react";
import { WalkScore, calculateWalkScore } from "@/components/walk-score";

function fmt(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function parsePrice(priceStr: string): number {
  return parseInt(priceStr.replace(/[^0-9]/g, ""), 10) || 0;
}

function ScoreBar({ value, max = 10, colour = "bg-primary" }: { value: number; max?: number; colour?: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${colour} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-foreground w-8 text-right">{value}</span>
    </div>
  );
}

function RatingBadge({ value }: { value: string }) {
  const colorMap: Record<string, string> = {
    Low: "bg-green-500/15 text-green-700 dark:text-green-400",
    Medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    High: "bg-red-500/15 text-red-600 dark:text-red-400",
    Good: "bg-green-500/15 text-green-700 dark:text-green-400",
    Moderate: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    Poor: "bg-red-500/15 text-red-600 dark:text-red-400",
    "Very Poor": "bg-red-700/15 text-red-800 dark:text-red-300",
    Excellent: "bg-green-600/15 text-green-800 dark:text-green-300",
    Outstanding: "bg-green-600/15 text-green-800 dark:text-green-300",
  };
  const cls = colorMap[value] ?? "bg-muted text-muted-foreground";
  return <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}>{value}</span>;
}

interface CompareColumnProps {
  report: BriefReport;
  label: "A" | "B";
}

function CompareColumn({ report, label }: CompareColumnProps) {
  const ai = report.areaIntelligence;
  const liveWalkScore = calculateWalkScore(
    ai.nearbyStations ?? [],
    ai.nearbySchools ?? [],
    ai.nearbyAmenities
  );
  // Use area walkability (0-10 → 0-100) as floor when Overpass data is sparse
  const areaWalk = ai.neighbourhoodProfile?.walkability;
  const fallbackWalk = areaWalk != null ? Math.round(areaWalk * 10) : 0;
  const walkScore = liveWalkScore < 20 && fallbackWalk > liveWalkScore ? fallbackWalk : liveWalkScore;

  const latestPrice = ai.priceTrend?.length
    ? parsePrice(ai.priceTrend[ai.priceTrend.length - 1].averagePrice)
    : 0;

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* Header */}
      <Card className="p-4 border-primary/30">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
            {label}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Postcode</p>
            <p className="text-lg font-bold text-foreground">{report.query.toUpperCase()}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ai.executiveSummary?.slice(0, 120)}…</p>
      </Card>

      {/* Market overview */}
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Market Overview</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Avg price</span>
            <span className="text-sm font-bold text-foreground">{ai.marketOverview.averagePrice}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">YoY change</span>
            <span className={`text-sm font-bold ${ai.marketOverview.priceChangeYoY?.startsWith("+") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {ai.marketOverview.priceChangeYoY}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Avg days on market</span>
            <span className="text-sm font-bold text-foreground">{ai.marketOverview.avgDaysOnMarket}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Supply</span>
            <span className="text-sm font-medium text-foreground">{ai.marketOverview.supplyLevel}</span>
          </div>
        </div>
      </Card>

      {/* Neighbourhood scores */}
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Neighbourhood</p>
        <div className="space-y-2.5">
          {[
            { label: "Schools", value: ai.neighbourhoodProfile.schoolsRating },
            { label: "Transport", value: ai.neighbourhoodProfile.transportRating },
            { label: "Safety", value: ai.neighbourhoodProfile.safetyRating },
            { label: "Walkability", value: ai.neighbourhoodProfile.walkability },
          ].map(({ label: l, value }) => (
            <div key={l}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground">{l}</span>
                <span className="text-xs font-bold text-foreground">{value}/10</span>
              </div>
              <ScoreBar value={value} max={10} />
            </div>
          ))}
        </div>
      </Card>

      {/* Walk Score */}
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Walk Score</p>
        <div className="flex items-center gap-3">
          <div className="text-3xl font-bold" style={{
            color: walkScore >= 70 ? "#16a34a" : walkScore >= 50 ? "#ca8a04" : "#dc2626"
          }}>{walkScore}</div>
          <div>
            <p className="text-xs font-semibold text-foreground">
              {walkScore >= 90 ? "Walker's Paradise" : walkScore >= 70 ? "Very Walkable" : walkScore >= 50 ? "Somewhat Walkable" : "Car-Dependent"}
            </p>
            <p className="text-xs text-muted-foreground">out of 100</p>
          </div>
        </div>
      </Card>

      {/* Flood risk */}
      {ai.floodRisk && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Flood Risk</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{ai.floodRisk.zone}</span>
            <RatingBadge value={ai.floodRisk.riskBadge} />
          </div>
        </Card>
      )}

      {/* Air quality */}
      {ai.airQuality && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Air Quality</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">NO₂ {ai.airQuality.no2Level}</span>
            <RatingBadge value={ai.airQuality.rating} />
          </div>
        </Card>
      )}

      {/* Crime */}
      {ai.crimeStats && ai.crimeStats.totalCrimesPerMonth > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Crime</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">{ai.crimeStats.totalCrimesPerMonth}</span>
            <span className="text-xs text-muted-foreground">crimes/month</span>
          </div>
          {ai.crimeStats.topCategories.slice(0, 2).map((c, i) => (
            <p key={i} className="text-xs text-muted-foreground mt-1">{c.category} ({c.pct}%)</p>
          ))}
        </Card>
      )}

      {/* Nearby stations */}
      {ai.nearbyStations && ai.nearbyStations.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Nearest Stations</p>
          <div className="space-y-1.5">
            {ai.nearbyStations.slice(0, 3).map((s, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-xs text-foreground font-medium truncate pr-2">{s.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{s.walkMins}min</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Market flags */}
      {ai.investmentOutlook?.riskFlags && ai.investmentOutlook.riskFlags.length > 0 && (
        <Card className="p-4 border-amber-400/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Market flags</p>
          <div className="space-y-1">
            {ai.investmentOutlook.riskFlags.slice(0, 3).map((f, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠ {f}</p>
            ))}
          </div>
        </Card>
      )}

      {/* Verdict */}
      <Card className="p-4 border-primary/20 bg-primary/5">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Verdict</p>
        <p className="text-xs text-foreground/90 italic leading-relaxed">{ai.verdict}</p>
        <div className="mt-3">
          <a href={`/#/brief/${report.id}`}>
            <Button size="sm" variant="outline" className="w-full text-xs">
              Full Report <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          </a>
        </div>
      </Card>
    </div>
  );
}

export default function ComparePage() {
  // Pre-fill postcode A from ?a= query param (linked from brief page)
  const initialA = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("a") ??
      // Hash routing: params after the hash path e.g. /#/compare?a=SW1A
      (() => { try { return new URLSearchParams(window.location.hash.split("?")[1] || "").get("a") ?? ""; } catch { return ""; } })()
    : "";

  const [postcodeA, setPostcodeA] = useState(initialA);
  const [postcodeB, setPostcodeB] = useState("");
  const [reportA, setReportA] = useState<BriefReport | null>(null);
  const [reportB, setReportB] = useState<BriefReport | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState("");
  const [errorB, setErrorB] = useState("");

  async function loadReport(
    postcode: string,
    setter: (r: BriefReport | null) => void,
    setLoading: (b: boolean) => void,
    setError: (s: string) => void
  ) {
    const cleaned = postcode.trim().toUpperCase();
    if (!cleaned) return;
    setLoading(true);
    setError("");
    setter(null);
    try {
      const r = await generateBrief(cleaned);
      setter(r);
    } catch (e: any) {
      setError(e.message ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load if postcode A was pre-filled from brief page link
  useEffect(() => {
    if (initialA) {
      loadReport(initialA, setReportA, setLoadingA, setErrorA);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (postcodeA) loadReport(postcodeA, setReportA, setLoadingA, setErrorA);
    if (postcodeB) loadReport(postcodeB, setReportB, setLoadingB, setErrorB);
  }

  const bothLoaded = reportA && reportB;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-xl font-serif font-bold text-foreground mb-1">Area Comparison</h1>
          <p className="text-sm text-muted-foreground mb-3">
            Enter two postcodes to compare areas side by side — prices, schools, transport, safety, walkability, and local amenities.
          </p>
          <p className="text-sm text-muted-foreground">
            Useful when you're weighing up two locations and want an objective, data-backed picture of both before you commit.
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <Card className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Postcode A
                </label>
                <div className="flex gap-2">
                  <div className="w-7 h-9 rounded bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">A</div>
                  <Input
                    value={postcodeA}
                    onChange={(e) => setPostcodeA(e.target.value)}
                    placeholder="e.g. SW1A 1AA"
                    className="flex-1 h-9 text-sm font-medium uppercase"
                    data-testid="input-postcode-a"
                  />
                </div>
                {errorA && <p className="text-xs text-destructive">{errorA}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Postcode B
                </label>
                <div className="flex gap-2">
                  <div className="w-7 h-9 rounded bg-muted-foreground/20 flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">B</div>
                  <Input
                    value={postcodeB}
                    onChange={(e) => setPostcodeB(e.target.value)}
                    placeholder="e.g. E1 6RF"
                    className="flex-1 h-9 text-sm font-medium uppercase"
                    data-testid="input-postcode-b"
                  />
                </div>
                {errorB && <p className="text-xs text-destructive">{errorB}</p>}
              </div>
            </div>
            <Button
              type="submit"
              className="w-full sm:w-auto font-semibold"
              disabled={loadingA || loadingB || (!postcodeA && !postcodeB)}
              data-testid="button-compare"
            >
              {loadingA || loadingB ? "Loading…" : "Compare"}
              <BarChart3 className="ml-2 h-4 w-4" />
            </Button>
          </Card>
        </form>

        {/* Loading state */}
        {(loadingA || loadingB) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-3 animate-pulse">
                <div className="h-28 bg-muted rounded-lg" />
                <div className="h-32 bg-muted rounded-lg" />
                <div className="h-32 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {bothLoaded && !loadingA && !loadingB && (
          <div className="space-y-4">
            {/* Summary winner row */}
            <div className="grid grid-cols-2 gap-4 mb-2">
              {[reportA, reportB].map((r, i) => {
                const avgP = parsePrice(r.areaIntelligence.marketOverview.averagePrice);
                return (
                  <div key={i} className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      {i === 0 ? "A" : "B"} · {r.query.toUpperCase()}
                    </p>
                    <p className="text-lg font-bold text-foreground">£{avgP.toLocaleString("en-GB")}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-6" data-testid="compare-columns">
              <CompareColumn report={reportA} label="A" />
              <div className="hidden sm:block w-px bg-border" />
              <CompareColumn report={reportB} label="B" />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loadingA && !loadingB && !reportA && !reportB && (
          <div className="text-center py-16 text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium mb-1">Compare two areas, side by side.</p>
            <p className="text-sm text-muted-foreground/70">Enter two postcodes above to see prices, schools, transport, and more.</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
