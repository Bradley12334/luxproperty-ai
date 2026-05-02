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
  Trees,
  UtensilsCrossed,
  Users,
  Moon,
  Lightbulb,
  Home,
  ChevronDown,
  MessageSquare,
  Droplets,
  Building2,
  PieChart,
  Clock,
  FileSearch,
  TrendingUp,
  Wifi,
  Wind,
  Star,
  Construction,
  BarChart3,
} from "lucide-react";
import { SoldPricesMap } from "@/components/sold-prices-map";
import type { BriefReport } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { PostcodeMap } from "@/components/postcode-map";

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

function CollapsibleSection({ title, children, defaultOpen = true, testId }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden" data-testid={testId}>
      <button
        className="w-full flex items-center justify-between p-5 sm:p-6 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">{title}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 sm:px-6 pb-5 sm:pb-6">{children}</div>}
    </Card>
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

  <div class="section">
    <div class="section-label">Flood &amp; Climate Risk</div>
    <div style="display:flex;gap:24px;margin-bottom:10px">
      <div class="kpi"><div class="kpi-label">Risk Level</div><div class="kpi-value" style="font-size:16px">${ai.floodRisk.riskBadge}</div></div>
      <div class="kpi"><div class="kpi-label">EA Flood Zone</div><div class="kpi-value" style="font-size:14px">${ai.floodRisk.zone}</div></div>
      <div class="kpi"><div class="kpi-label">Surface Water</div><div class="kpi-value" style="font-size:14px">${ai.floodRisk.surfaceWater}</div></div>
    </div>
    <p class="body-text">${ai.floodRisk.detail}</p>
  </div>

  <div class="section">
    <div class="section-label">Council Tax</div>
    <div style="display:flex;gap:24px;margin-bottom:10px">
      <div class="kpi"><div class="kpi-label">Most Common Band</div><div class="kpi-value">${ai.councilTax.mostCommonBand}</div></div>
      <div class="kpi"><div class="kpi-label">Annual Cost</div><div class="kpi-value">${ai.councilTax.annualCost}</div></div>
      <div class="kpi"><div class="kpi-label">Local Authority</div><div class="kpi-value" style="font-size:14px">${ai.councilTax.borough}</div></div>
    </div>
    <p class="body-text">${ai.councilTax.note}</p>
  </div>

  <div class="section">
    <div class="section-label">Property Type Split</div>
    <p class="body-text" style="margin-bottom:8px">${ai.propertyTypeSplit.dominantType}</p>
    <table><thead><tr><th>Type</th><th style="text-align:right">Share</th></tr></thead>
    <tbody>
      <tr><td>Flats / Apartments</td><td style="text-align:right">${ai.propertyTypeSplit.flats}%</td></tr>
      <tr><td>Terraced Houses</td><td style="text-align:right">${ai.propertyTypeSplit.terraced}%</td></tr>
      <tr><td>Semi-Detached</td><td style="text-align:right">${ai.propertyTypeSplit.semiDetached}%</td></tr>
      <tr><td>Detached Houses</td><td style="text-align:right">${ai.propertyTypeSplit.detached}%</td></tr>
    </tbody></table>
  </div>

  <div class="section">
    <div class="section-label">Commute Times</div>
    <table><thead><tr><th>Destination</th><th>Time</th><th>Mode</th><th>Via</th></tr></thead>
    <tbody>${ai.commuteTable.map(r => `<tr><td>${r.destination}</td><td style="color:#B8860B;font-weight:700">${r.time}</td><td>${r.mode}</td><td style="color:#9ca3af">${r.via}</td></tr>`).join("")}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-label">Rental Market Snapshot</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:12px">
      <div class="kpi"><div class="kpi-label">1-Bed Asking Rent</div><div class="kpi-value" style="font-size:16px">${ai.rentalMarket.oneBedAskingRent}</div></div>
      <div class="kpi"><div class="kpi-label">2-Bed Asking Rent</div><div class="kpi-value" style="font-size:16px">${ai.rentalMarket.twoBedAskingRent}</div></div>
      <div class="kpi"><div class="kpi-label">3-Bed Asking Rent</div><div class="kpi-value" style="font-size:16px">${ai.rentalMarket.threeBedAskingRent}</div></div>
      <div class="kpi"><div class="kpi-label">1-Bed Yield</div><div class="kpi-value" style="font-size:16px;color:#166534">${ai.rentalMarket.oneBedYield}</div></div>
      <div class="kpi"><div class="kpi-label">2-Bed Yield</div><div class="kpi-value" style="font-size:16px;color:#166534">${ai.rentalMarket.twoBedYield}</div></div>
      <div class="kpi"><div class="kpi-label">Demand Level</div><div class="kpi-value" style="font-size:16px;color:#B8860B">${ai.rentalMarket.demandLevel}</div></div>
    </div>
    <p class="body-text">${ai.rentalMarket.note}</p>
  </div>

  <div class="section">
    <div class="section-label">Broadband &amp; Infrastructure</div>
    <div style="display:flex;gap:24px;margin-bottom:10px">
      <div class="kpi"><div class="kpi-label">Rating</div><div class="kpi-value" style="font-size:16px">${ai.broadband.rating}</div></div>
      <div class="kpi"><div class="kpi-label">Avg Download</div><div class="kpi-value" style="font-size:16px">${ai.broadband.avgDownloadSpeed}</div></div>
      <div class="kpi"><div class="kpi-label">Full Fibre</div><div class="kpi-value" style="font-size:16px">${ai.broadband.fullFibreAvailability}</div></div>
    </div>
    <p class="body-text">${ai.broadband.note}</p>
  </div>

  <div class="section">
    <div class="section-label">Air Quality</div>
    <div style="display:flex;gap:24px;margin-bottom:10px">
      <div class="kpi"><div class="kpi-label">Rating</div><div class="kpi-value" style="font-size:16px">${ai.airQuality.rating}</div></div>
      <div class="kpi"><div class="kpi-label">NO₂</div><div class="kpi-value" style="font-size:16px">${ai.airQuality.no2Level}</div></div>
      <div class="kpi"><div class="kpi-label">PM2.5</div><div class="kpi-value" style="font-size:16px">${ai.airQuality.pm25Level}</div></div>
    </div>
    <p class="body-text">${ai.airQuality.note}</p>
  </div>

  <div class="section">
    <div class="section-label">Nearby Developments</div>
    <table><thead><tr><th>Development</th><th>Type</th><th>Status</th><th>Impact</th></tr></thead>
    <tbody>${ai.nearbyDevelopments.map(d => `<tr><td>${d.name}</td><td style="color:#9ca3af">${d.type}</td><td style="color:#9ca3af">${d.status}</td><td style="color:${d.impact==='Positive'?'#166534':d.impact==='Monitor'?'#92400e':'#6b7280'};font-weight:600">${d.impact}</td></tr>`).join("")}</tbody>
    </table>
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

  const { user } = useAuth();
  const isPaid = user?.plan === "professional" || user?.plan === "investor";
  const isInvestor = user?.plan === "investor";
  const { toast } = useToast();

  useEffect(() => {
    if (briefId) {
      const id = parseInt(briefId);
      const found = getBrief(id);
      setReport(found);
      if (found) {
        // Async check — update state once resolved
        isInPortfolio(found.query.toUpperCase()).then((saved) => {
          setSavedToPortfolio(saved);
        });
      }
      setIsLoading(false);
    }
  }, [briefId]);

  async function handleSaveToPortfolio() {
    if (!report) return;
    const { ok } = await addToPortfolio(report);
    if (ok) {
      setSavedToPortfolio(true);
      toast({
        title: "Saved to Portfolio",
        description: `${report.areaIntelligence.area || report.areaIntelligence.location} has been added to your portfolio.`,
      });
    }
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

            {/* Map — shown when coords available */}
            {(report.lat && report.lng) && (
              <Card className="p-5 sm:p-6" data-testid="section-map">
                <SectionHeading>Location Map</SectionHeading>
                <PostcodeMap
                  postcode={ai.location}
                  lat={report.lat}
                  lng={report.lng}
                  areaName={ai.area}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">OpenStreetMap</a> contributors
                </p>
              </Card>
            )}

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

            {/* Neighbourhood Profile — collapsible */}
            <CollapsibleSection title="Neighbourhood Profile" testId="section-neighbourhood">
              {/* Ratings strip */}
              <div className="space-y-3 mb-6 pb-6 border-b border-border/40">
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

              {/* Rich descriptions grid */}
              <div className="grid gap-5 sm:grid-cols-2">
                {[
                  { icon: Home, label: "Local Character", text: ai.neighbourhoodProfile.character },
                  { icon: UtensilsCrossed, label: "Shops & Amenities", text: ai.neighbourhoodProfile.amenities },
                  { icon: Train, label: "Transport Links", text: ai.neighbourhoodProfile.transport },
                  { icon: Trees, label: "Green Space", text: ai.neighbourhoodProfile.greenSpace },
                  { icon: GraduationCap, label: "Schools", text: ai.neighbourhoodProfile.schools },
                  { icon: Users, label: "Who Lives Here", text: ai.neighbourhoodProfile.demographics },
                  { icon: Moon, label: "Evenings & Eating Out", text: ai.neighbourhoodProfile.nightlife },
                  { icon: Lightbulb, label: "Buyer Intelligence", text: ai.neighbourhoodProfile.marketComment },
                  { icon: MessageSquare, label: "What Residents Say", text: ai.neighbourhoodProfile.residentSentiment },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <item.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{item.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* ── FREE TIER SECTIONS ──────────────────────────────────────── */}

            {/* Flood & Climate Risk */}
            <CollapsibleSection title="Flood & Climate Risk" testId="section-flood">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-3 items-start">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    ai.floodRisk.riskBadge === "Low"
                      ? "bg-green-500/15 text-green-700 dark:text-green-400"
                      : ai.floodRisk.riskBadge === "Medium"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      : "bg-red-500/15 text-red-700 dark:text-red-400"
                  }`}>
                    <Droplets className="h-3 w-3" />
                    {ai.floodRisk.riskBadge} Risk
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">EA Flood Zone</span>
                    <span className="text-sm text-foreground font-medium">{ai.floodRisk.zone}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Surface Water Risk</span>
                    <span className="text-sm text-foreground font-medium">{ai.floodRisk.surfaceWater}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{ai.floodRisk.detail}</p>
                <a
                  href="https://flood-map-for-planning.service.gov.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline underline-offset-2 self-start"
                >
                  Verify on EA Flood Map for Planning →
                </a>
              </div>
            </CollapsibleSection>

            {/* Council Tax */}
            <CollapsibleSection title="Council Tax" testId="section-council-tax">
              <div className="flex flex-col gap-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Most Common Band</span>
                    <span className="text-sm text-foreground font-bold text-lg">{ai.councilTax.mostCommonBand}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Annual Cost</span>
                    <span className="text-sm text-foreground font-bold text-lg">{ai.councilTax.annualCost}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Local Authority</span>
                    <span className="text-sm text-foreground font-medium">{ai.councilTax.borough}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{ai.councilTax.note}</p>
                <a
                  href={`https://www.gov.uk/council-tax-bands`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline underline-offset-2 self-start"
                >
                  Check band for a specific address on gov.uk →
                </a>
              </div>
            </CollapsibleSection>

            {/* Property Type Split */}
            <CollapsibleSection title="Property Type Split" testId="section-property-types">
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">{ai.propertyTypeSplit.dominantType}</p>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: "Flats / Apartments", value: ai.propertyTypeSplit.flats, color: "bg-[#B8860B]" },
                    { label: "Terraced Houses", value: ai.propertyTypeSplit.terraced, color: "bg-[#8B6914]" },
                    { label: "Semi-Detached", value: ai.propertyTypeSplit.semiDetached, color: "bg-[#6B5010]" },
                    { label: "Detached Houses", value: ai.propertyTypeSplit.detached, color: "bg-[#4A380B]" },
                    { label: "Other", value: ai.propertyTypeSplit.other, color: "bg-muted-foreground/30" },
                  ].filter(i => i.value > 0).map(item => (
                    <div key={item.label} className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        <span className="text-xs font-semibold text-foreground">{item.value}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all duration-700`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleSection>

            {/* Commute Calculator */}
            <CollapsibleSection title="Commute Calculator" testId="section-commute">
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">Journey times from the postcode centre to key destinations.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-primary py-2 pr-4">Destination</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-primary py-2 pr-4">Time</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-primary py-2 pr-4">Mode</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-primary py-2">Via</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ai.commuteTable.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 pr-4 font-medium text-foreground">{row.destination}</td>
                          <td className="py-2.5 pr-4">
                            <span className="inline-flex items-center gap-1 text-[#B8860B] font-bold">
                              <Clock className="h-3 w-3" />
                              {row.time}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{row.mode}</td>
                          <td className="py-2.5 text-muted-foreground text-xs">{row.via}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CollapsibleSection>

            {/* ── PROFESSIONAL+ SECTIONS ──────────────────────────────────── */}

            {/* Planning Activity — Pro+ */}
            {isPaid ? (
              <CollapsibleSection title="Planning Activity" testId="section-planning">
                <div className="flex flex-col gap-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Applications (12 months)</span>
                      <span className="text-2xl font-bold text-foreground">{ai.planningActivity.recentApplications.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Local Authority</span>
                      <span className="text-sm text-foreground font-medium">{ai.councilTax.borough}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Major Developments</span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{ai.planningActivity.majorDevelopments}</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ai.planningActivity.note}</p>
                  <a
                    href={ai.planningActivity.councilPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline underline-offset-2 self-start"
                  >
                    View planning portal →
                  </a>
                </div>
              </CollapsibleSection>
            ) : (
              <div className="relative" data-testid="section-planning-locked">
                <div className="blur-sm pointer-events-none select-none opacity-60">
                  <Card className="p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <FileSearch className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Planning Activity</h3>
                    </div>
                    <div className="h-24 bg-muted rounded" />
                  </Card>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg">
                    <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-foreground">Professional & above</p>
                    <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                  </div>
                </div>
              </div>
            )}

            {/* Rental Market Snapshot — Pro+ */}
            {isPaid ? (
              <CollapsibleSection title="Rental Market Snapshot" testId="section-rental-market">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: "1-Bed Asking Rent", value: ai.rentalMarket.oneBedAskingRent },
                      { label: "2-Bed Asking Rent", value: ai.rentalMarket.twoBedAskingRent },
                      { label: "3-Bed Asking Rent", value: ai.rentalMarket.threeBedAskingRent },
                      { label: "1-Bed Gross Yield", value: ai.rentalMarket.oneBedYield },
                      { label: "2-Bed Gross Yield", value: ai.rentalMarket.twoBedYield },
                      { label: "Demand Level", value: ai.rentalMarket.demandLevel },
                    ].map(item => (
                      <div key={item.label} className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{item.label}</span>
                        <span className={`font-bold ${item.label.includes("Yield") ? "text-green-600 dark:text-green-400 text-lg" : item.label === "Demand Level" ? "text-[#B8860B] text-base" : "text-foreground text-lg"}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ai.rentalMarket.note}</p>
                </div>
              </CollapsibleSection>
            ) : (
              <div className="relative" data-testid="section-rental-market-locked">
                <div className="blur-sm pointer-events-none select-none opacity-60">
                  <Card className="p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Rental Market Snapshot</h3>
                    </div>
                    <div className="h-24 bg-muted rounded" />
                  </Card>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg">
                    <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-foreground">Professional & above</p>
                    <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                  </div>
                </div>
              </div>
            )}

            {/* Broadband & Infrastructure — Pro+ */}
            {isPaid ? (
              <CollapsibleSection title="Broadband & Infrastructure" testId="section-broadband">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                      ai.broadband.rating === "Excellent"
                        ? "bg-green-500/15 text-green-700 dark:text-green-400"
                        : ai.broadband.rating === "Good"
                        ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                        : ai.broadband.rating === "Fair"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-red-500/15 text-red-700 dark:text-red-400"
                    }`}>
                      <Wifi className="h-3 w-3" />
                      {ai.broadband.rating}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Avg Download Speed</span>
                      <span className="text-xl font-bold text-foreground">{ai.broadband.avgDownloadSpeed}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Full Fibre Availability</span>
                      <span className="text-xl font-bold text-foreground">{ai.broadband.fullFibreAvailability}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Providers</span>
                      <span className="text-sm text-foreground font-medium">{ai.broadband.providers}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ai.broadband.note}</p>
                </div>
              </CollapsibleSection>
            ) : (
              <div className="relative" data-testid="section-broadband-locked">
                <div className="blur-sm pointer-events-none select-none opacity-60">
                  <Card className="p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Wifi className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Broadband & Infrastructure</h3>
                    </div>
                    <div className="h-20 bg-muted rounded" />
                  </Card>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg">
                    <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-foreground">Professional & above</p>
                    <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                  </div>
                </div>
              </div>
            )}

            {/* Air Quality — Pro+ */}
            {isPaid ? (
              <CollapsibleSection title="Air Quality Index" testId="section-air-quality">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                      ai.airQuality.rating === "Good"
                        ? "bg-green-500/15 text-green-700 dark:text-green-400"
                        : ai.airQuality.rating === "Moderate"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : ai.airQuality.rating === "Poor"
                        ? "bg-orange-500/15 text-orange-700 dark:text-orange-400"
                        : "bg-red-500/15 text-red-700 dark:text-red-400"
                    }`}>
                      <Wind className="h-3 w-3" />
                      {ai.airQuality.rating}
                    </span>
                    <span className="text-xs text-muted-foreground">WHO guideline: NO₂ ≤10 µg/m³ · PM2.5 ≤5 µg/m³</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">NO₂ (Nitrogen Dioxide)</span>
                      <span className="text-xl font-bold text-foreground">{ai.airQuality.no2Level}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">PM2.5 (Fine Particles)</span>
                      <span className="text-xl font-bold text-foreground">{ai.airQuality.pm25Level}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ai.airQuality.note}</p>
                  <a
                    href="https://uk-air.defra.gov.uk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline underline-offset-2 self-start"
                  >
                    View DEFRA UK-AIR data →
                  </a>
                </div>
              </CollapsibleSection>
            ) : (
              <div className="relative" data-testid="section-air-quality-locked">
                <div className="blur-sm pointer-events-none select-none opacity-60">
                  <Card className="p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Wind className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Air Quality Index</h3>
                    </div>
                    <div className="h-20 bg-muted rounded" />
                  </Card>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg">
                    <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-foreground">Professional & above</p>
                    <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                  </div>
                </div>
              </div>
            )}

            {/* ── INVESTOR ONLY SECTIONS ──────────────────────────────────── */}

            {/* Rental Demand Score — Investor */}
            {isInvestor ? (
              <CollapsibleSection title="Rental Demand Score" testId="section-rental-demand">
                <div className="flex flex-col gap-4">
                  <div className="flex items-end gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Demand Score</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-[#B8860B]">{ai.rentalDemand.score}</span>
                        <span className="text-lg text-muted-foreground font-medium">/10</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 pb-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Avg Days to Let</span>
                      <span className="text-2xl font-bold text-foreground">{ai.rentalDemand.avgDaysToLet} days</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/60">
                    <BarChart3 className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground">{ai.rentalDemand.vsNationalAvg}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ai.rentalDemand.note}</p>
                </div>
              </CollapsibleSection>
            ) : (
              <div className="relative" data-testid="section-rental-demand-locked">
                <div className="blur-sm pointer-events-none select-none opacity-60">
                  <Card className="p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Rental Demand Score</h3>
                    </div>
                    <div className="h-24 bg-muted rounded" />
                  </Card>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg">
                    <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-foreground">Investor plan only</p>
                    <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                  </div>
                </div>
              </div>
            )}

            {/* Nearby Development Tracker — Investor */}
            {isInvestor ? (
              <CollapsibleSection title="Development Tracker" testId="section-developments">
                <div className="flex flex-col gap-3">
                  {ai.nearbyDevelopments.map((dev, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg border border-border bg-card">
                      <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                        dev.impact === "Positive" ? "bg-green-500" : dev.impact === "Monitor" ? "bg-amber-500" : "bg-muted-foreground"
                      }`} />
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{dev.name}</span>
                          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{dev.type}</span>
                          <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                            dev.impact === "Positive" ? "bg-green-500/15 text-green-700 dark:text-green-400" :
                            dev.impact === "Monitor" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                            "bg-muted text-muted-foreground"
                          }`}>{dev.impact}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{dev.status}</span>
                        <p className="text-xs text-muted-foreground leading-relaxed">{dev.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            ) : (
              <div className="relative" data-testid="section-developments-locked">
                <div className="blur-sm pointer-events-none select-none opacity-60">
                  <Card className="p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Construction className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Development Tracker</h3>
                    </div>
                    <div className="h-24 bg-muted rounded" />
                  </Card>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg">
                    <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-foreground">Investor plan only</p>
                    <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                  </div>
                </div>
              </div>
            )}

            {/* Sold Prices Map — Investor */}
            {isInvestor && ai.recentSoldPrices && ai.recentSoldPrices.length > 0 ? (
              <CollapsibleSection title="Recent Sold Prices Map" testId="section-sold-prices-map">
                <div className="flex flex-col gap-4">
                  <SoldPricesMap
                    soldPrices={ai.recentSoldPrices}
                    centerLat={report.lat}
                    centerLng={report.lng}
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-primary py-2 pr-3">Address</th>
                          <th className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-primary py-2 pr-3">Price</th>
                          <th className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-primary py-2 pr-3">Type</th>
                          <th className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-primary py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ai.recentSoldPrices.map((sp, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="py-2.5 pr-3 text-foreground font-medium">{sp.address}</td>
                            <td className="py-2.5 pr-3 text-[#B8860B] font-bold">{sp.price}</td>
                            <td className="py-2.5 pr-3 text-muted-foreground">{sp.type}</td>
                            <td className="py-2.5 text-muted-foreground">{sp.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">Source: HM Land Registry. Prices reflect completed transactions, not asking prices.</p>
                </div>
              </CollapsibleSection>
            ) : !isInvestor ? (
              <div className="relative" data-testid="section-sold-prices-locked">
                <div className="blur-sm pointer-events-none select-none opacity-60">
                  <Card className="p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Recent Sold Prices Map</h3>
                    </div>
                    <div className="h-32 bg-muted rounded" />
                  </Card>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg">
                    <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-foreground">Investor plan only</p>
                    <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                  </div>
                </div>
              </div>
            ) : null}

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

            {/* === INVESTMENT OUTLOOK + VERDICT — gated for paid plans === */}
            {isPaid ? (
              <div className="space-y-6">
                {/* Investment Outlook — unlocked */}
                <Card className="p-5 sm:p-6" data-testid="section-investment-outlook">
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

                {/* Verdict — unlocked */}
                <Card className="p-5 sm:p-6 border-primary/20" data-testid="section-verdict">
                  <SectionHeading>Verdict</SectionHeading>
                  <p className="text-sm leading-relaxed text-foreground/90 italic">
                    {ai.verdict}
                  </p>
                </Card>

                {/* Price Alerts — investor only */}
                {user?.plan === "investor" && <PriceAlerts postcode={ai.location} />}
              </div>
            ) : (
              /* Paywall — free / not signed in */
              <div className="relative">
                {/* Blurred preview */}
                <div className="space-y-6 blur-sm opacity-50 select-none pointer-events-none" aria-hidden="true">
                  <Card className="p-5 sm:p-6">
                    <SectionHeading>Investment Outlook</SectionHeading>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                      <KpiValue label="Growth Forecast" value={ai.investmentOutlook.growthForecast} />
                      <KpiValue label="Rental Yield" value={ai.investmentOutlook.rentalYieldEstimate} />
                    </div>
                    {ai.investmentOutlook.riskFlags.length > 0 && (
                      <ul className="space-y-1.5">
                        {ai.investmentOutlook.riskFlags.map((flag, i) => (
                          <li key={i} className="text-sm text-foreground/80 pl-5">{flag}</li>
                        ))}
                      </ul>
                    )}
                  </Card>
                  <Card className="p-5 sm:p-6 border-primary/20">
                    <SectionHeading>Verdict</SectionHeading>
                    <p className="text-sm leading-relaxed text-foreground/90 italic">{ai.verdict}</p>
                  </Card>
                </div>

                {/* Overlay */}
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
                          View plans — from £4.99/month
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
            )}
          </div>

          {/* Bottom CTA */}
          <div className="mt-10 pt-8 border-t border-border/40">
            {/* Custom Report Branding — Investor only */}
            {user?.plan === "investor" && (
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
            )}

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
                {/* Save to Portfolio — paid plans only */}
                {isPaid && (
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
                )}
                {/* Export PDF — paid plans only */}
                {isPaid ? (
                  <Button
                    size="sm"
                    className="gap-1.5 font-semibold"
                    onClick={() => report && exportToPDF(report, companyName || undefined, preparedBy || undefined)}
                    data-testid="button-export-pdf"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export PDF
                  </Button>
                ) : (
                  <a href="/#/pricing">
                    <Button size="sm" variant="outline" className="gap-1.5 font-semibold" data-testid="button-export-pdf-locked">
                      <Lock className="h-3.5 w-3.5" />
                      Export PDF
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
