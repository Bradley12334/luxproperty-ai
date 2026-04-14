import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  ArrowLeft,
  MapPin,
  Clock,
  AlertTriangle,
  TrendingUp,
  GraduationCap,
  Train,
  Shield,
  Footprints,
  FileText,
} from "lucide-react";
import type { BriefReport } from "@shared/schema";

function SkeletonReport() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="skeleton-shimmer h-6 w-48 rounded" />
        <div className="skeleton-shimmer h-10 w-96 max-w-full rounded" />
        <div className="skeleton-shimmer h-4 w-32 rounded" />
      </div>

      {/* Executive summary skeleton */}
      <Card className="p-6 space-y-3">
        <div className="skeleton-shimmer h-5 w-40 rounded" />
        <div className="skeleton-shimmer h-4 w-full rounded" />
        <div className="skeleton-shimmer h-4 w-full rounded" />
        <div className="skeleton-shimmer h-4 w-3/4 rounded" />
      </Card>

      {/* Market overview skeleton */}
      <Card className="p-6 space-y-4">
        <div className="skeleton-shimmer h-5 w-36 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton-shimmer h-3 w-20 rounded" />
              <div className="skeleton-shimmer h-8 w-28 rounded" />
            </div>
          ))}
        </div>
      </Card>

      {/* More sections */}
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="p-6 space-y-3">
          <div className="skeleton-shimmer h-5 w-44 rounded" />
          <div className="skeleton-shimmer h-4 w-full rounded" />
          <div className="skeleton-shimmer h-4 w-5/6 rounded" />
          <div className="skeleton-shimmer h-4 w-2/3 rounded" />
        </Card>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
          <div className="text-center py-16 mb-8">
            <div className="inline-flex items-center gap-2 text-primary mb-4">
              <FileText className="h-5 w-5 animate-pulse" />
            </div>
            <h2 className="font-serif text-xl tracking-tight mb-2">
              Compiling your intelligence brief
            </h2>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
              Analysing market data
              <span className="flex gap-0.5">
                <span className="pulse-dot w-1 h-1 rounded-full bg-muted-foreground" />
                <span className="pulse-dot w-1 h-1 rounded-full bg-muted-foreground" />
                <span className="pulse-dot w-1 h-1 rounded-full bg-muted-foreground" />
              </span>
            </p>
          </div>
          <SkeletonReport />
        </div>
      </main>
      <Footer />
    </div>
  );
}

function RatingBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-serif text-lg tabular-nums text-foreground min-w-[2.5rem] text-right">
        {value}
      </span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-primary mb-4">
      {children}
    </h3>
  );
}

function KpiValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-serif text-2xl tracking-tight text-foreground" data-testid={`text-kpi-${label.toLowerCase().replace(/\s/g, "-")}`}>
        {value}
      </p>
    </div>
  );
}

export default function BriefPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const briefId = params.get("id");

  const { data: report, isLoading, isError } = useQuery<BriefReport>({
    queryKey: ["/api/briefs", briefId],
    enabled: !!briefId,
  });

  if (isLoading || !report) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="font-serif text-xl mb-2">Brief not found</h2>
            <p className="text-sm text-muted-foreground mb-6">
              We couldn't load this intelligence brief.
            </p>
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                Back to search
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const { areaIntelligence: ai, propertyDeepDive: pd } = report;
  const isPropertyReport = report.queryType === "address" && pd;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
          {/* Back nav */}
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground" data-testid="button-back">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              New search
            </Button>
          </Link>

          {/* Report Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-semibold">
                {isPropertyReport ? "Property Brief" : "Area Brief"}
              </Badge>
            </div>
            <h1
              className="font-serif text-2xl sm:text-3xl tracking-tight leading-tight mb-2"
              data-testid="text-report-title"
            >
              {isPropertyReport
                ? `Property Intelligence Brief`
                : `Area Intelligence Brief — ${ai.location}, ${ai.area}`}
            </h1>
            {isPropertyReport && (
              <p className="text-base text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {report.query}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Generated {new Date(report.generatedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="space-y-6">
            {/* Executive Summary */}
            <Card className="p-5 sm:p-6" data-testid="section-executive-summary">
              <SectionHeading>Executive Summary</SectionHeading>
              <p className="text-sm leading-relaxed text-foreground/90">
                {ai.executiveSummary}
              </p>
            </Card>

            {/* Market Overview KPIs */}
            <Card className="p-5 sm:p-6" data-testid="section-market-overview">
              <SectionHeading>Market Overview</SectionHeading>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                <KpiValue label="Average Price" value={ai.marketOverview.averagePrice} />
                <KpiValue label="Price Change YoY" value={ai.marketOverview.priceChangeYoY} />
                <KpiValue label="Avg Days on Market" value={ai.marketOverview.avgDaysOnMarket} />
                <KpiValue label="Supply Level" value={ai.marketOverview.supplyLevel} />
              </div>
            </Card>

            {/* Price Trend */}
            <Card className="p-5 sm:p-6" data-testid="section-price-trend">
              <SectionHeading>5-Year Price Trend</SectionHeading>
              <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
                <table className="w-full text-sm" data-testid="table-price-trend">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left font-medium text-muted-foreground py-2.5 pr-4">Year</th>
                      <th className="text-left font-medium text-muted-foreground py-2.5 pr-4">Average Price</th>
                      <th className="text-right font-medium text-muted-foreground py-2.5">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ai.priceTrend.map((row) => (
                      <tr key={row.year} className="border-b border-border/30 last:border-0">
                        <td className="py-2.5 pr-4 tabular-nums">{row.year}</td>
                        <td className="py-2.5 pr-4 font-serif text-lg">{row.averagePrice}</td>
                        <td className={`py-2.5 text-right tabular-nums ${
                          row.change.startsWith("+") ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        }`}>
                          {row.change}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Neighbourhood Profile */}
            <Card className="p-5 sm:p-6" data-testid="section-neighbourhood">
              <SectionHeading>Neighbourhood Profile</SectionHeading>
              <div className="space-y-4">
                {[
                  { icon: GraduationCap, label: "Schools", value: ai.neighbourhoodProfile.schoolsRating },
                  { icon: Train, label: "Transport", value: ai.neighbourhoodProfile.transportRating },
                  { icon: Shield, label: "Safety", value: ai.neighbourhoodProfile.safetyRating },
                  { icon: Footprints, label: "Walkability", value: ai.neighbourhoodProfile.walkability },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground w-24 shrink-0">{item.label}</span>
                    <div className="flex-1">
                      <RatingBar value={item.value} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Property Valuation — only for address searches */}
            {isPropertyReport && pd && (
              <>
                <Card className="p-5 sm:p-6" data-testid="section-valuation">
                  <SectionHeading>Property Valuation Assessment</SectionHeading>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <KpiValue label="Estimated Range" value={pd.valuationAssessment.estimatedRange} />
                    <KpiValue label="vs Area Average" value={pd.valuationAssessment.priceVsAreaAverage} />
                    <KpiValue label="Value Score" value={pd.valuationAssessment.valueScore} />
                  </div>
                </Card>

                <Card className="p-5 sm:p-6" data-testid="section-comparables">
                  <SectionHeading>Comparable Sales</SectionHeading>
                  <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
                    <table className="w-full text-sm" data-testid="table-comparables">
                      <thead>
                        <tr className="border-b border-border/60">
                          <th className="text-left font-medium text-muted-foreground py-2.5 pr-4">Address</th>
                          <th className="text-left font-medium text-muted-foreground py-2.5 pr-4">Type</th>
                          <th className="text-left font-medium text-muted-foreground py-2.5 pr-4">Price</th>
                          <th className="text-right font-medium text-muted-foreground py-2.5">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pd.comparableSales.map((sale, i) => (
                          <tr key={i} className="border-b border-border/30 last:border-0">
                            <td className="py-2.5 pr-4">{sale.address}</td>
                            <td className="py-2.5 pr-4 text-muted-foreground">{sale.type}</td>
                            <td className="py-2.5 pr-4 font-serif text-lg">{sale.price}</td>
                            <td className="py-2.5 text-right text-muted-foreground">{sale.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card className="p-5 sm:p-6" data-testid="section-negotiation">
                  <SectionHeading>Negotiation Brief</SectionHeading>
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-1">Suggested Offer Range</p>
                    <p className="font-serif text-2xl tracking-tight text-primary">
                      {pd.negotiationBrief.suggestedOfferRange}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Key Leverage Points
                  </p>
                  <ul className="space-y-2">
                    {pd.negotiationBrief.leveragePoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary font-serif mt-0.5">{i + 1}.</span>
                        <span className="text-foreground/90">{point}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </>
            )}

            {/* Investment Outlook */}
            <Card className="p-5 sm:p-6" data-testid="section-investment">
              <SectionHeading>Investment Outlook</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                <KpiValue label="Growth Forecast" value={ai.investmentOutlook.growthForecast} />
                <KpiValue label="Rental Yield" value={ai.investmentOutlook.rentalYieldEstimate} />
              </div>

              {ai.investmentOutlook.riskFlags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                    <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    Risk Flags
                  </p>
                  <ul className="space-y-1.5">
                    {ai.investmentOutlook.riskFlags.map((flag, i) => (
                      <li key={i} className="text-sm text-foreground/80 pl-5 relative before:content-['–'] before:absolute before:left-0 before:text-muted-foreground">
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            {/* Verdict */}
            <Card className="p-5 sm:p-6 border-primary/20" data-testid="section-verdict">
              <SectionHeading>Verdict</SectionHeading>
              <p className="text-sm leading-relaxed text-foreground/90 italic">
                {ai.verdict}
              </p>
            </Card>
          </div>

          {/* Bottom CTA */}
          <div className="mt-10 pt-8 border-t border-border/40 text-center">
            <p className="text-xs text-muted-foreground mb-3">
              This brief was generated using AI-assisted analysis of public market data.
            </p>
            <Link href="/">
              <Button variant="outline" size="sm" data-testid="button-new-search">
                Generate another brief
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
