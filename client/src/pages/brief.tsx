import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { getBrief } from "@/lib/mockEngine";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { PriceAlerts } from "@/components/price-alerts";
import { addToPortfolio, isInPortfolio } from "@/lib/portfolioStore";
import { useToast } from "@/hooks/use-toast";
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
  Download,
  Bookmark,
  BookmarkCheck,
  Lock,
  ArrowRight,
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


function exportToPDF(
  report: BriefReport,
  companyName?: string,
  preparedBy?: string,
) {
  const { areaIntelligence: ai, propertyDeepDive: pd } = report;
  const isProperty = report.queryType === "address" && pd;
  const date = new Date(report.generatedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const priceTrendRows = ai.priceTrend.map(row => `
    <tr>
      <td>${row.year}</td>
      <td style="font-family:Georgia,serif;font-size:15px">${row.averagePrice}</td>
      <td style="text-align:right;color:${row.change.startsWith("+") ? "#166534" : row.change === "—" ? "#6b7280" : "#991b1b"}">${row.change}</td>
    </tr>`).join("");

  const comparableRows = isProperty && pd ? pd.comparableSales.map(s => `
    <tr>
      <td>${s.address}</td>
      <td style="color:#6b7280">${s.type}</td>
      <td style="font-family:Georgia,serif;font-size:15px">${s.price}</td>
      <td style="text-align:right;color:#6b7280">${s.date}</td>
    </tr>`).join("") : "";

  const leveragePoints = isProperty && pd ? pd.negotiationBrief.leveragePoints.map((p, i) => `
    <li style="margin-bottom:6px"><span style="color:#B8860B;font-family:Georgia,serif">${i+1}.</span> ${p}</li>`).join("") : "";

  const riskFlags = ai.investmentOutlook.riskFlags.map(f => `
    <li style="margin-bottom:4px;padding-left:16px;position:relative"><span style="position:absolute;left:0;color:#9ca3af">–</span>${f}</li>`).join("");

  // Masthead branding
  const mastheadLogoHtml = companyName
    ? `<div>
        <div class="logo">${companyName}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:2px">Powered by Lux<span style="color:#B8860B">Property</span>.ai</div>
      </div>`
    : `<div class="logo">Lux<span>Property</span>.ai</div>`;

  // Meta section with optional "Prepared by"
  const preparedByLine = preparedBy
    ? `<br>Prepared by ${preparedBy}`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${companyName || "LuxProperty.ai"} — ${isProperty ? "Property" : "Area"} Intelligence Brief</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', sans-serif; font-size: 13px; color: #1a1612; background: #fff; }
  .page { max-width: 780px; margin: 0 auto; padding: 52px 48px; }
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #B8860B; margin-bottom: 32px; }
  .logo { font-family: Georgia, serif; font-size: 20px; font-weight: normal; letter-spacing: -0.5px; }
  .logo span { color: #B8860B; }
  .meta { text-align: right; font-size: 11px; color: #6b7280; line-height: 1.6; }
  .badge { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; background: #f3f4f6; color: #374151; padding: 3px 8px; border-radius: 3px; margin-bottom: 10px; }
  h1 { font-family: Georgia, serif; font-size: 26px; font-weight: normal; letter-spacing: -0.5px; line-height: 1.25; margin-bottom: 6px; }
  .subtitle { font-size: 12px; color: #6b7280; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
  .section { margin-bottom: 28px; }
  .section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #B8860B; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
  .body-text { font-size: 13px; line-height: 1.7; color: #374151; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .kpi { }
  .kpi-label { font-size: 10px; color: #9ca3af; margin-bottom: 4px; }
  .kpi-value { font-family: Georgia, serif; font-size: 20px; color: #1a1612; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-weight: 500; color: #9ca3af; padding: 8px 12px 8px 0; border-bottom: 1px solid #e5e7eb; }
  td { padding: 8px 12px 8px 0; border-bottom: 1px solid #f3f4f6; color: #374151; }
  .verdict { background: #faf8f4; border-left: 3px solid #B8860B; padding: 16px 20px; font-style: italic; font-size: 13px; line-height: 1.7; color: #374151; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .offer { font-family: Georgia, serif; font-size: 22px; color: #B8860B; margin-bottom: 12px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
  ul { list-style: none; padding: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="masthead">
    ${mastheadLogoHtml}
    <div class="meta">
      Intelligence Brief<br>
      Generated ${date}${preparedByLine}<br>
      Data: HM Land Registry · Postcodes.io
    </div>
  </div>

  <div style="margin-bottom:28px">
    <div class="badge">${isProperty ? "Property Brief" : "Area Brief"}</div>
    <h1>${isProperty ? "Property Intelligence Brief" : `Area Intelligence Brief — ${ai.location}, ${ai.area}`}</h1>
    ${isProperty ? `<div class="subtitle">📍 ${report.query}</div>` : ""}
  </div>

  <div class="section">
    <div class="section-label">Executive Summary</div>
    <p class="body-text">${ai.executiveSummary}</p>
  </div>

  <div class="section">
    <div class="section-label">Market Overview</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Average Price</div><div class="kpi-value">${ai.marketOverview.averagePrice}</div></div>
      <div class="kpi"><div class="kpi-label">Price Change YoY</div><div class="kpi-value">${ai.marketOverview.priceChangeYoY}</div></div>
      <div class="kpi"><div class="kpi-label">Avg Days on Market</div><div class="kpi-value">${ai.marketOverview.avgDaysOnMarket}</div></div>
      <div class="kpi"><div class="kpi-label">Supply Level</div><div class="kpi-value">${ai.marketOverview.supplyLevel}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">5-Year Price Trend</div>
    <table><thead><tr><th>Year</th><th>Median Price</th><th style="text-align:right">Change</th></tr></thead>
    <tbody>${priceTrendRows}</tbody></table>
  </div>

  ${isProperty && pd ? `
  <div class="section">
    <div class="section-label">Property Valuation Assessment</div>
    <div class="two-col">
      <div class="kpi"><div class="kpi-label">Estimated Range</div><div class="kpi-value" style="font-size:16px">${pd.valuationAssessment.estimatedRange}</div></div>
      <div class="kpi"><div class="kpi-label">vs Area Average</div><div class="kpi-value" style="font-size:16px">${pd.valuationAssessment.priceVsAreaAverage}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Comparable Sales</div>
    <table><thead><tr><th>Address</th><th>Type</th><th>Price</th><th style="text-align:right">Date</th></tr></thead>
    <tbody>${comparableRows}</tbody></table>
  </div>

  <div class="section">
    <div class="section-label">Negotiation Brief</div>
    <div class="offer">${pd.negotiationBrief.suggestedOfferRange}</div>
    <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Key Leverage Points</p>
    <ul>${leveragePoints}</ul>
  </div>` : ""}

  <div class="section">
    <div class="section-label">Investment Outlook</div>
    <div class="two-col" style="margin-bottom:16px">
      <div class="kpi"><div class="kpi-label">Growth Forecast</div><div class="kpi-value" style="font-size:16px">${ai.investmentOutlook.growthForecast}</div></div>
      <div class="kpi"><div class="kpi-label">Rental Yield Estimate</div><div class="kpi-value" style="font-size:16px">${ai.investmentOutlook.rentalYieldEstimate}</div></div>
    </div>
    <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Risk Flags</p>
    <ul>${riskFlags}</ul>
  </div>

  <div class="section">
    <div class="section-label">Verdict</div>
    <div class="verdict">${ai.verdict}</div>
  </div>

  <div class="footer">
    <span>${companyName || "LuxProperty.ai"} — Confidential Intelligence Brief</span>
    <span>Data sourced from HM Land Registry Price Paid &amp; Postcodes.io. For informational purposes only.</span>
  </div>
</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

export default function BriefPage() {
  const params = useParams<{ id: string }>();
  const briefId = params.id;
  const [report, setReport] = useState<BriefReport | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Feature 1: Custom branding state
  const [companyName, setCompanyName] = useState("");
  const [preparedBy, setPreparedBy] = useState("");

  // Feature 3: Portfolio state
  const [savedToPortfolio, setSavedToPortfolio] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (briefId) {
      const id = parseInt(briefId);
      const found = getBrief(id);
      setReport(found);
      if (found) {
        setSavedToPortfolio(isInPortfolio(found.id));
      }
      setIsLoading(false);
    }
  }, [briefId]);

  function handleSaveToPortfolio() {
    if (!report) return;
    addToPortfolio(report);
    setSavedToPortfolio(true);
    toast({
      title: "Saved to Portfolio",
      description: `${report.areaIntelligence.area || report.areaIntelligence.location} has been added to your portfolio.`,
    });
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (!report) {
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

            {/* === PAYWALL WRAPPER — Investment Outlook, Verdict, Price Alerts === */}
            <div className="relative">
              {/* Blurred content */}
              <div className="space-y-6 blur-sm opacity-50 select-none pointer-events-none" aria-hidden="true">
                {/* Investment Outlook */}
                <Card className="p-5 sm:p-6">
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
                <Card className="p-5 sm:p-6 border-primary/20">
                  <SectionHeading>Verdict</SectionHeading>
                  <p className="text-sm leading-relaxed text-foreground/90 italic">
                    {ai.verdict}
                  </p>
                </Card>
              </div>

              {/* Paywall overlay */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <Card className="max-w-sm w-full mx-4 p-6 text-center shadow-lg border-primary/20 bg-card">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-serif text-lg tracking-tight mb-2">
                    Upgrade to see the full picture
                  </h3>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                    Investment outlook, risk flags, verdict, and PDF export are included in
                    Professional and Investor plans.
                  </p>
                  <div className="space-y-2">
                    <a href="/#/pricing">
                      <Button className="w-full font-semibold" data-testid="button-paywall-upgrade">
                        View plans — from £59/month
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </a>
                    <p className="text-xs text-muted-foreground">
                      Executive summary, market overview &amp; price trend are always free
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-10 pt-8 border-t border-border/40">
            {/* Feature 1: Custom Report Branding */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Custom Report Branding
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="space-y-1.5">
                  <Label htmlFor="company-name" className="text-xs text-muted-foreground">
                    Company name <span className="font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="company-name"
                    type="text"
                    placeholder="Acme Property Advisors"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-company-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prepared-by" className="text-xs text-muted-foreground">
                    Your name <span className="font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="prepared-by"
                    type="text"
                    placeholder="Jane Smith"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-prepared-by"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                This brief was generated using AI-assisted analysis of public market data.<br />
                Data sourced from HM Land Registry Price Paid &amp; Postcodes.io.
              </p>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                <Link href="/">
                  <Button variant="outline" size="sm" data-testid="button-new-search">
                    Generate another brief
                  </Button>
                </Link>
                {/* Feature 3: Save to Portfolio button */}
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-1.5 font-semibold ${savedToPortfolio ? "border-amber-600/60 text-amber-700 dark:text-amber-400" : ""}`}
                  onClick={handleSaveToPortfolio}
                  disabled={savedToPortfolio}
                  data-testid="button-save-portfolio"
                >
                  {savedToPortfolio ? (
                    <BookmarkCheck className="h-3.5 w-3.5" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5" />
                  )}
                  {savedToPortfolio ? "Saved" : "Save to Portfolio"}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 font-semibold"
                  onClick={() => report && exportToPDF(report, companyName || undefined, preparedBy || undefined)}
                  data-testid="button-export-pdf"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
