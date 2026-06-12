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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "wouter";
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
  FileSearch,
  Wifi,
  Wind,
  Star,
  Construction,
  BarChart3,
  ShoppingCart,
  BookOpen,
  AlertCircle,
  Coffee,
  Stethoscope,
  TreePine,
  Leaf,
  BadgeCheck,
  Target,
  CheckCircle2,
  ShieldAlert,
  Zap,
  XCircle,
} from "lucide-react";
import { SoldPricesMap, deriveMapInterpretation } from "@/components/sold-prices-map";
import type { BriefReport } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { AuthModal } from "@/components/auth-modal";
import { PostcodeMap } from "@/components/postcode-map";
import { NeighbourhoodMap } from "@/components/neighbourhood-map";
import { WalkScore, calculateWalkScore } from "@/components/walk-score";
import { CrimeSparkline } from "@/components/crime-sparkline";
import { MortgageCalculator } from "@/components/mortgage-calculator";
import { StreetPriceRanking } from "@/components/street-price-ranking";
import { NearbyDevelopmentTracker, sortDevs, IMPACT_META, fmtDistance } from "@/components/nearby-development-tracker";
import { ClimateResilienceCard } from "@/components/climate-resilience-card";
import { WhatWouldWorryMe } from "@/components/what-would-worry-me";
import { NegotiationLeverage } from "@/components/negotiation-leverage";
import { WhatPeopleMiss } from "@/components/what-people-miss";
import { DevelopmentAlerts, pdfDevelopmentAlertsSection } from "@/components/development-alerts";
import { getInfrastructureFlags } from "@/lib/hs2Data";
import { FeatureGate, useEmailCaptured } from "@/components/FeatureGate";
import { LockedPreview } from "@/components/LockedPreview";

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

const LOADING_STEPS = [
  "Fetching HM Land Registry data",
  "Analysing price trends",
  "Sourcing comparable sales",
  "Checking flood & EPC records",
  "Loading neighbourhood data",
  "Calculating walk score",
  "Summarising key findings",
];

function LoadingState() {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((i) => (i + 1) % LOADING_STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
          <div className="text-center py-16 mb-8">
            <div className="inline-flex items-center gap-2 text-primary mb-5">
              <FileText className="h-5 w-5 animate-pulse" />
            </div>
            <h2 className="font-serif text-xl tracking-tight mb-3">
              Compiling your property report
            </h2>
            {/* Progress steps */}
            <div className="flex flex-col items-center gap-2 mb-6">
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

// ── One-Glance Summary ───────────────────────────────────────────────────────

// ── Buyer Summary Block ──────────────────────────────────────────────────────
// A four-field executive readout designed to be the first thing a buyer reads.
// Evidence-led — every field derives from real signals in the brief data.
// In thinner-data areas it does more interpretive work; in richer areas it
// acts as a strong executive readout without duplicating the full report.

interface BuyerSummary {
  bestFor: string;      // Type of buyer / household this area suits
  mainStrengths: string; // Clearest positive signals, specific and evidence-led
  watchOuts: string;    // Main trade-offs or caution points
  buyerTakeaway: string; // Pre-offer buyer recommendation — action-oriented, confidence-calibrated
}

function deriveBuyerSummary(
  ai: BriefReport["areaIntelligence"],
  isPropertyReport: boolean,
): BuyerSummary {
  const yoy = ai.marketOverview.priceChangeYoY;
  const yoyNum = parseFloat(yoy.replace(/[^\d.\-]/g, ""));
  const supply = ai.marketOverview.supplyLevel?.toLowerCase() ?? "";
  const avgPrice = ai.marketOverview.averagePrice;
  const dom = ai.marketOverview.avgDaysOnMarket;

  const safetyRating   = ai.neighbourhoodProfile?.safetyRating ?? 70;
  const transportRating = ai.neighbourhoodProfile?.transportRating ?? 5;
  const schoolsRating  = ai.neighbourhoodProfile?.schoolsRating ?? 5;

  const closestStation = ai.nearbyStations?.slice().sort((a, b) => a.walkMins - b.walkMins)?.[0];
  const stationWalkMins = closestStation?.walkMins ?? 999;
  const closestPark    = ai.nearbyAmenities?.greenSpaces?.[0];
  const topSchool      = ai.nearbySchools?.find(s => s.ofstedRating === "Outstanding" || s.ofstedRating === "Good");
  const floodRisk      = ai.floodRisk?.riskBadge ?? "Low";
  const airRating      = ai.airQuality?.rating ?? "Good";
  const crimePerMonth  = ai.crimeStats?.totalCrimesPerMonth ?? 0;
  const cafeCount      = ai.nearbyAmenities?.cafesAndRestaurants?.length ?? 0;

  // Derived context signals
  const isTransitRich  = transportRating >= 7 || stationWalkMins <= 8;
  const isTransitLight = transportRating < 5 || stationWalkMins > 20;
  const isAmenityLight = cafeCount === 0;
  const hasBroadbandStrength = ai.broadband?.rating === "Excellent" || ai.broadband?.rating === "Very Good";
  const hasDataConfidence = avgPrice !== "Insufficient data" && avgPrice !== "Scotland/NI — see note" && !isNaN(yoyNum);
  const priceNum = parseFloat(avgPrice.replace(/[^\d]/g, ""));
  const isThinData = !hasDataConfidence || priceNum === 0;

  // ── BEST FOR ─────────────────────────────────────────────────────────────
  const bestForParts: string[] = [];
  if (topSchool && schoolsRating >= 7) bestForParts.push("families prioritising schools");
  if (isTransitRich) bestForParts.push("commuters who want walkable transport");
  if (closestPark && closestPark.walkMins <= 6) bestForParts.push("buyers who value green space on the doorstep");
  if (hasBroadbandStrength && isTransitLight) bestForParts.push("remote workers who rely on fast home broadband");

  let bestFor: string;
  if (priceNum > 1_000_000) {
    bestFor = bestForParts.length > 0
      ? `High-net-worth buyers, particularly ${bestForParts[0]} — this is a prime-market postcode.`
      : "High-net-worth buyers seeking a premium, established address with structural long-term value.";
  } else if (priceNum > 500_000) {
    bestFor = bestForParts.length > 0
      ? `Professionals and equity-rich upsizers, especially ${bestForParts[0]}.`
      : "Established buyers and professionals looking for quality without prime-market pricing.";
  } else if (isTransitLight && isAmenityLight) {
    bestFor = "Buyers prioritising space over connectivity — families, home workers, and those comfortable car-dependent living. Less suited to daily commuters who need quick rail access.";
  } else if (isTransitLight) {
    bestFor = bestForParts.filter(p => !p.includes("commuter")).length > 0
      ? `${bestForParts.filter(p => !p.includes("commuter"))[0].replace(/^./, c => c.toUpperCase())} — worth weighing up if a daily train commute is part of the plan.`
      : "Buyers comfortable with car-dependent commuting. Worth weighing against your daily travel requirements before committing.";
  } else if (bestForParts.length >= 2) {
    bestFor = `${bestForParts[0].replace(/^./, c => c.toUpperCase())} and ${bestForParts[1]}.`;
  } else if (bestForParts.length === 1) {
    bestFor = `${bestForParts[0].replace(/^./, c => c.toUpperCase())}. Also suited to first-time buyers and owner-occupiers looking for value in a well-connected area.`;
  } else {
    const characterSnip = (ai.neighbourhoodProfile?.character ?? "").split(".")[0];
    bestFor = characterSnip.length > 20 && characterSnip.length < 130
      ? characterSnip + "."
      : "A broad range of buyers — from first-time buyers to families — depending on budget and lifestyle priorities.";
  }

  // ── MAIN STRENGTHS ───────────────────────────────────────────────────────
  const strengthParts: string[] = [];

  if (closestStation && stationWalkMins <= 8) {
    const lineNote = closestStation.lines.length > 0 ? ` (${closestStation.lines.slice(0, 2).join(", ")})` : "";
    strengthParts.push(`${closestStation.name}${lineNote} is a ${stationWalkMins}-minute walk`);
  } else if (closestStation && stationWalkMins <= 15 && transportRating >= 6) {
    strengthParts.push(`${closestStation.name} is ${stationWalkMins} minutes away — reasonable for most commuters`);
  }
  if (topSchool) {
    strengthParts.push(`${topSchool.name} rated ${topSchool.ofstedRating} by Ofsted${topSchool.walkMins <= 12 ? ` (${topSchool.walkMins} min walk)` : ""}`);
  } else if (schoolsRating >= 7) {
    strengthParts.push("above-average school provision for the area");
  }
  if (floodRisk === "Low") {
    strengthParts.push("low flood risk — insurance and mortgage terms unaffected");
  }
  if (airRating === "Good" && isTransitLight) {
    strengthParts.push("good air quality — a benefit of lower traffic density");
  } else if (airRating === "Good" && !isTransitRich) {
    strengthParts.push("clean air — NO₂ and PM2.5 within WHO guidelines");
  }
  if (hasBroadbandStrength) {
    strengthParts.push(`${ai.broadband!.rating.toLowerCase()} broadband (${ai.broadband!.avgDownloadSpeed})`);
  }
  if (closestPark && closestPark.walkMins <= 7) {
    const parkStr = isAmenityLight
      ? `${closestPark.name} (${closestPark.walkMins} min) provides open space that partly offsets lighter local amenities`
      : `${closestPark.name} is ${closestPark.walkMins} minutes on foot`;
    strengthParts.push(parkStr);
  }
  if (!isNaN(yoyNum) && yoyNum >= 4) {
    strengthParts.push(`strong ${yoy} annual price growth — above-average capital appreciation`);
  } else if (!isNaN(yoyNum) && yoyNum > 0 && yoyNum < 4) {
    strengthParts.push(`steady ${yoy} year-on-year price growth`);
  }

  let mainStrengths: string;
  if (strengthParts.length >= 2) {
    mainStrengths = strengthParts.slice(0, 3).map((p, i) => i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p).join(". ") + ".";
  } else if (strengthParts.length === 1) {
    mainStrengths = strengthParts[0].charAt(0).toUpperCase() + strengthParts[0].slice(1) + ". The wider area offers a stable residential base — review the full sections for detail.";
  } else if (isThinData) {
    mainStrengths = "Transaction volume is too low for a data-driven strengths analysis. The sections below — transport, schools, flood risk, and crime — provide the clearest directional read for this area.";
  } else {
    const floodNote = floodRisk === "Low" ? "low flood risk" : "flood data worth reviewing";
    mainStrengths = `Average price of ${avgPrice} with ${floodNote} — a stable base for ownership. Review transport, schools, and environment below for fuller context.`;
  }

  // ── WATCH-OUTS ────────────────────────────────────────────────────────────
  const watchParts: string[] = [];

  if (floodRisk === "High") {
    watchParts.push("high flood risk — get a dedicated flood assessment and check insurance terms before proceeding");
  } else if (floodRisk === "Medium") {
    watchParts.push("medium flood risk on record — worth a specific assessment before exchange");
  }
  if (!isNaN(yoyNum) && yoyNum < -2) {
    watchParts.push(`prices down ${yoy.replace("-", "")} year-on-year — understand local drivers before committing`);
  }
  if (crimePerMonth > 80 && safetyRating < 45) {
    const topCat = ai.crimeStats?.topCategories?.[0];
    watchParts.push(`above-average crime levels${topCat ? ` — most common category: ${topCat.category}` : ""} — visit at different times of day`);
  }
  if (airRating === "Poor" || airRating === "Very Poor") {
    watchParts.push(`${airRating.toLowerCase()} air quality (NO₂: ${String(ai.airQuality.no2Level).replace(/ \(est\.\)/g, "")}) — relevant for families and those with respiratory health concerns`);
  }
  if (isTransitLight) {
    const stationNote = stationWalkMins < 999
      ? `nearest station is ${stationWalkMins} minutes away — most journeys will require a car`
      : "no station within easy walking distance — car-dependent area";
    watchParts.push(stationNote);
  }
  if (isAmenityLight && !watchParts.some(w => w.includes("amenity") || w.includes("café"))) {
    watchParts.push("limited walkable amenities — essentials covered but lifestyle options are thin on the ground");
  }
  if (typeof dom === "number" && dom > 70) {
    watchParts.push(`slow market — homes averaging ${dom} days to sell, which may reflect weaker demand in this pocket`);
  }
  if (watchParts.length === 0 && ai.investmentOutlook?.riskFlags?.length > 0) {
    watchParts.push(ai.investmentOutlook.riskFlags[0].replace(/^[A-Z]/, c => c.toLowerCase()));
  }

  let watchOuts: string;
  if (watchParts.length >= 2) {
    watchOuts = watchParts.slice(0, 2).map((p, i) => i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p).join(". ") + ".";
  } else if (watchParts.length === 1) {
    watchOuts = watchParts[0].charAt(0).toUpperCase() + watchParts[0].slice(1) + ". Commission a survey and review the title register before exchange.";
  } else {
    watchOuts = isPropertyReport
      ? "No major area-level concerns in this data. Review the comparable sales and valuation section for property-specific considerations."
      : "No material red flags in this data. Review planning activity and crime sections for local nuances before committing.";
  }

  // ── OVERALL SUITABILITY ───────────────────────────────────────────────────
  let buyerTakeaway: string;

  // Count positive vs negative signals
  const positives = strengthParts.length;
  const negatives = watchParts.length;
  const hasFloodRisk = floodRisk === "High" || floodRisk === "Medium";
  const marketRising = !isNaN(yoyNum) && yoyNum > 0;
  const marketFalling = !isNaN(yoyNum) && yoyNum < -2;

  if (isThinData) {
    buyerTakeaway = `Thin data area — figures are directional, not statistically precise. Focus on the structural signals: transport, schools, flood risk, and council tax. Visit the area, speak to a local agent, and commission a RICS survey before offering. Don't let limited data drive a fast decision.`;
  } else if (positives >= 3 && negatives === 0) {
    buyerTakeaway = `Strong area for most buyer types at ${avgPrice}. No material red flags — the full report gives you enough to move into due diligence. Instruct a RICS Level 2 survey and review the planning section before exchange.`;
  } else if (positives >= 2 && negatives <= 1 && !hasFloodRisk) {
    buyerTakeaway = `Good case for proceeding${marketRising ? ` — ${yoy} price growth supports your position` : ""}. Address the watch-out before offering, but it's not a deal-breaker. Use the comparable sales to anchor your opening bid.`;
  } else if (negatives >= 2 && hasFloodRisk) {
    buyerTakeaway = `Proceed with care. Flood risk combined with ${negatives > 2 ? "other material concerns" : "a further watch-out"} means this requires full due diligence — a structural survey, dedicated flood assessment, and insurance quote before you commit. These issues are manageable but not optional to verify.`;
  } else if (negatives >= 2 && marketFalling) {
    buyerTakeaway = `Negotiate from a position of information. Soft prices and the concerns above give you leverage — but verify whether the price weakness is structural or temporary before offering. Build a safety margin into your maximum. Use comparables to calibrate your opening bid.`;
  } else if (isTransitLight && isAmenityLight) {
    buyerTakeaway = `Best suited to buyers choosing space and calm over urban convenience. Test your daily routine — particularly the commute — against what's actually here before committing. If connectivity works for your lifestyle, this area represents reasonable value.`;
  } else if (positives >= 2 && negatives >= 2) {
    buyerTakeaway = `Balanced case — clear strengths, genuine trade-offs. ${marketRising ? `Price momentum (${yoy}) is in your favour. ` : ""}Decide how much weight the watch-outs carry for your specific situation, then use the negotiation section to calibrate your offer.`;
  } else {
    buyerTakeaway = marketRising
      ? `Solid basis for proceeding in a ${yoy} market. No critical concerns in this data — the sections below give you everything you need to pressure-test the decision and calibrate your offer.`
      : `Reasonable value at ${avgPrice}. No critical concerns identified — use the comparable sales and negotiation section to anchor your bid, and commission a survey before exchange.`;
  }

  return { bestFor, mainStrengths, watchOuts, buyerTakeaway };
}

// ── Red Flag Summary Block ────────────────────────────────────────────────
function RedFlagSummaryBlock({
  flags,
}: {
  flags: BriefReport["areaIntelligence"]["redFlags"];
}) {
  const hasFlags = flags && flags.length > 0;
  const highCount = hasFlags ? flags.filter(f => f.severity === "high").length : 0;

  // Colour scheme: red border if any high-severity, amber if only medium
  const borderColor = highCount > 0
    ? "border-red-500/40"
    : "border-amber-500/35";
  const headerBg = highCount > 0
    ? "bg-red-500/[0.06]"
    : "bg-amber-500/[0.06]";
  const headerBorder = highCount > 0
    ? "border-red-500/25"
    : "border-amber-500/25";
  const iconColor = highCount > 0
    ? "text-red-600 dark:text-red-400"
    : "text-amber-600 dark:text-amber-400";
  const labelColor = highCount > 0
    ? "text-red-700 dark:text-red-400"
    : "text-amber-700 dark:text-amber-400";

  return (
    <div
      className={`rounded-xl border ${borderColor} overflow-hidden shadow-sm`}
      data-testid="section-red-flags"
    >
      {/* Header strip */}
      <div className={`px-5 sm:px-6 py-3.5 ${headerBg} border-b ${headerBorder} flex items-center gap-2.5`}>
        <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${labelColor}`}>
          Risk Summary
        </span>
        {hasFlags && (
          <span className={`ml-1 text-[10px] font-semibold ${labelColor} opacity-70`}>
            {flags.length} flag{flags.length > 1 ? "s" : ""} identified
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground/50 font-medium tracking-wide hidden sm:block">
          Material risks
        </span>
      </div>

      {/* Content */}
      {!hasFlags ? (
        <div className="px-5 sm:px-6 py-4 flex items-start gap-3">
          <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <p className="text-sm text-foreground/80 leading-relaxed">
            No major immediate red flags identified from available data.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {flags.map((flag, i) => {
            const isHigh = flag.severity === "high";
            return (
              <div
                key={i}
                className={`px-5 sm:px-6 py-4 sm:py-[17px] flex gap-3.5 items-start ${
                  isHigh
                    ? "bg-red-50/40 dark:bg-red-950/15"
                    : "bg-amber-50/30 dark:bg-amber-950/10"
                }`}
              >
                {/* Severity dot + label */}
                <div className={`flex items-center gap-1.5 min-w-[130px] sm:min-w-[150px] pt-0.5 shrink-0 ${
                  isHigh ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
                }`}>
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 mt-0.5 ${
                    isHigh ? "bg-red-500" : "bg-amber-500"
                  }`} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.13em] leading-tight">
                    {flag.label}
                  </span>
                </div>
                {/* Detail */}
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {flag.detail}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shortlist Verdict Block — "Would I shortlist this?" ──────────────────────
// The headline decision signal. Displayed at the very top of every Professional+
// brief — gives buyers an immediate, memorable call before they read anything else.
// Four fixed labels map to distinct visual treatments so the verdict is scannable
// in under 2 seconds on both desktop and mobile.
function ShortlistVerdictBlock({
  sv,
}: {
  sv: BriefReport["areaIntelligence"]["shortlistVerdict"];
}) {
  if (!sv) return null;

  const isStrong   = sv.label === "Strong shortlist";
  const isCaveats  = sv.label === "Shortlist with caveats";
  const isCaution  = sv.label === "Proceed carefully";

  // Per-label visual config
  const cfg = isStrong
    ? {
        outer:     "border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.06] to-emerald-500/[0.02] dark:from-emerald-900/20 dark:to-transparent",
        divider:   "border-emerald-500/20",
        labelPill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
        dot:       "bg-emerald-500",
        icon:      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
        tagline:   "Keep going.",
      }
    : isCaveats
    ? {
        outer:     "border-[#B8860B]/25 bg-gradient-to-br from-[#B8860B]/[0.05] to-[#B8860B]/[0.01] dark:from-amber-900/15 dark:to-transparent",
        divider:   "border-[#B8860B]/20",
        labelPill: "bg-[#B8860B]/15 text-[#B8860B] border-[#B8860B]/30",
        dot:       "bg-[#B8860B]",
        icon:      <BookmarkCheck className="h-4 w-4 text-[#B8860B] shrink-0" />,
        tagline:   "Keep going, but check first.",
      }
    : isCaution
    ? {
        outer:     "border-orange-500/25 bg-gradient-to-br from-orange-500/[0.05] to-orange-500/[0.01] dark:from-orange-900/15 dark:to-transparent",
        divider:   "border-orange-500/20",
        labelPill: "bg-orange-500/12 text-orange-700 dark:text-orange-400 border-orange-500/25",
        dot:       "bg-orange-500",
        icon:      <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />,
        tagline:   "Slow down.",
      }
    : {
        outer:     "border-red-500/20 bg-gradient-to-br from-red-500/[0.04] to-red-500/[0.01] dark:from-red-900/10 dark:to-transparent",
        divider:   "border-red-500/15",
        labelPill: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
        dot:       "bg-red-500",
        icon:      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />,
        tagline:   "Move on.",
      };

  return (
    <div
      className={`rounded-xl border overflow-hidden shadow-sm ${cfg.outer}`}
      data-testid="section-shortlist-verdict"
    >
      {/* Header row */}
      <div className={`px-5 sm:px-6 py-3 border-b ${cfg.divider} flex items-center gap-2`}>
        {cfg.icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Would I shortlist this?
        </span>
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground/45 italic hidden sm:block">
          {cfg.tagline}
        </span>
      </div>

      {/* Label + reasoning */}
      <div className="px-5 sm:px-6 py-4 flex items-start gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border whitespace-nowrap shrink-0 ${cfg.labelPill}`}
          data-testid="text-shortlist-label"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
          {sv.label}
        </span>
        <p className="text-sm text-foreground/90 leading-relaxed font-medium" data-testid="text-shortlist-reasoning">
          {sv.reasoning}
        </p>
      </div>

      {/* Next step */}
      {sv.nextStep && (
        <div className={`px-5 sm:px-6 py-3 border-t ${cfg.divider} flex items-start gap-2.5`}>
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/45 shrink-0 mt-0.5">Next</span>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{sv.nextStep}</p>
        </div>
      )}
    </div>
  );
}

// ── Buyer Verdict Block — "Would I buy here?" ──────────────────────────────────
function BuyerVerdictBlock({
  ai,
}: {
  ai: BriefReport["areaIntelligence"];
}) {
  const v = ai.buyerVerdict;
  if (!v) return null;

  const isStrong  = v.verdictLabel === "Strong case";
  const isGood    = v.verdictLabel === "Good case";
  const isCaution = v.verdictLabel === "Proceed carefully";
  const isThin    = v.verdictLabel === "Thin data — verify first";

  // Verdict label colour
  const labelColors = isStrong
    ? { pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500", border: "border-emerald-500/20" }
    : isGood
    ? { pill: "bg-[#B8860B]/15 text-[#B8860B] border-[#B8860B]/30", dot: "bg-[#B8860B]", border: "border-[#B8860B]/25" }
    : isCaution
    ? { pill: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25", dot: "bg-red-500", border: "border-red-500/20" }
    : { pill: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-400/25", dot: "bg-slate-400", border: "border-slate-400/20" };

  // Confidence badge colour
  const confColor = v.confidenceLevel === "High"
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
    : v.confidenceLevel === "Moderate"
    ? "bg-[#B8860B]/10 text-[#B8860B] border-[#B8860B]/25"
    : "bg-slate-400/10 text-slate-600 dark:text-slate-400 border-slate-400/20";

  return (
    <div
      className={`rounded-xl border ${labelColors.border} overflow-hidden shadow-sm`}
      data-testid="section-buyer-verdict"
    >
      {/* Header — verdict label + headline question */}
      <div className="px-5 sm:px-6 py-4 bg-[#1A1612]/[0.03] dark:bg-white/[0.03] border-b border-border/30">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Lightbulb className="h-3.5 w-3.5 text-[#B8860B] shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Would I buy here?
            </span>
          </div>
          {/* Verdict label pill */}
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${labelColors.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${labelColors.dot} shrink-0`} />
            {v.verdictLabel}
          </span>
        </div>
        {/* Rationale — the decisive evidence sentence */}
        <p className="mt-2.5 text-sm text-foreground/90 leading-relaxed font-medium">
          {v.verdictRationale}
        </p>
      </div>

      {/* Three structured rows */}
      <div className="divide-y divide-border/30">

        {/* Best for */}
        <div className="px-5 sm:px-6 py-4 sm:py-[17px] flex gap-3.5 items-start bg-[#B8860B]/[0.03]">
          <div className="flex items-center gap-1.5 min-w-[120px] sm:min-w-[140px] pt-0.5 shrink-0 text-[#B8860B]">
            <Target className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] leading-tight">Best for</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{v.bestFor}</p>
        </div>

        {/* Strongest positives */}
        <div className="px-5 sm:px-6 py-4 sm:py-[17px] flex gap-3.5 items-start bg-emerald-50/30 dark:bg-emerald-950/10">
          <div className="flex items-center gap-1.5 min-w-[120px] sm:min-w-[140px] pt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] leading-tight">Positives</span>
          </div>
          {v.strongestPositives.length > 0 ? (
            <ul className="space-y-1.5">
              {v.strongestPositives.map((pos, i) => (
                <li key={i} className="flex gap-2 items-baseline">
                  <span className="text-emerald-500 text-[10px] shrink-0 mt-0.5">✓</span>
                  <span className="text-sm text-foreground leading-relaxed">{pos}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">No standout positives identified from available data.</p>
          )}
        </div>

        {/* Main watch-outs */}
        <div className="px-5 sm:px-6 py-4 sm:py-[17px] flex gap-3.5 items-start bg-amber-50/30 dark:bg-amber-950/10">
          <div className="flex items-center gap-1.5 min-w-[120px] sm:min-w-[140px] pt-0.5 shrink-0 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] leading-tight">Watch-outs</span>
          </div>
          {v.mainWatchOuts.length > 0 ? (
            <ul className="space-y-1.5">
              {v.mainWatchOuts.map((wo, i) => (
                <li key={i} className="flex gap-2 items-baseline">
                  <span className="text-amber-500 text-[10px] shrink-0 mt-0.5">–</span>
                  <span className="text-sm text-foreground leading-relaxed">{wo}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground/70">No material watch-outs from available data.</p>
          )}
        </div>
      </div>

      {/* Confidence footer */}
      <div className="px-5 sm:px-6 py-3 border-t border-border/30 bg-muted/20 flex items-start gap-2.5">
        <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${confColor}`}>
          {v.confidenceLevel} confidence
        </span>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {v.confidenceNote}
        </p>
      </div>
    </div>
  );
}

// ── Explorer Verdict Block ───────────────────────────────────────────────────
// Prominently shown to all users (including free). Simple area screening judgement.
function ExplorerVerdictBlock({
  explorerVerdict,
}: {
  explorerVerdict: BriefReport["areaIntelligence"]["explorerVerdict"];
}) {
  const { label, rationale } = explorerVerdict;
  const isGood = label === "Good fit";
  const isLimited = label === "Limited fit";

  const colors = isGood
    ? { pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", border: "border-emerald-500/20", bg: "bg-emerald-50/30 dark:bg-emerald-950/10", dot: "bg-emerald-500" }
    : isLimited
    ? { pill: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25", border: "border-red-400/20", bg: "bg-red-50/20 dark:bg-red-950/10", dot: "bg-red-500" }
    : { pill: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", border: "border-amber-500/20", bg: "bg-amber-50/30 dark:bg-amber-950/10", dot: "bg-amber-500" };

  return (
    <div
      className={`rounded-xl border ${colors.border} ${colors.bg} px-5 sm:px-6 py-4 sm:py-5`}
      data-testid="section-explorer-verdict"
    >
      <div className="flex items-start gap-3.5">
        {/* Coloured dot */}
        <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${colors.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Area Screen
            </span>
            <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${colors.pill}`}>
              {label}
            </span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {rationale}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Small inline pill shown next to KPI labels that are modelled/benchmarked rather than directly measured */
function EstimateTag() {
  return (
    <span className="inline-flex items-center text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#B8860B]/10 text-[#B8860B] border border-[#B8860B]/20 ml-1.5 align-middle">
      Estimate
    </span>
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

/**
 * ConfidencePill — subtle indicator showing how much weight to place on a conclusion.
 * Used across valuation, negotiation, verdict, lifestyle fit, market trend, and sentiment.
 * Design: compact, readable, never alarming — feels like analytical maturity not a warning label.
 */
function ConfidencePill({
  level,
  note,
  className = "",
}: {
  level: "High" | "Medium" | "Low";
  note: string;
  className?: string;
}) {
  const cfg = level === "High"
    ? { pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", dot: "bg-emerald-500", label: "High confidence" }
    : level === "Medium"
    ? { pill: "bg-[#B8860B]/10 text-[#B8860B] border-[#B8860B]/20", dot: "bg-[#B8860B]", label: "Medium confidence" }
    : { pill: "bg-slate-400/10 text-slate-500 dark:text-slate-400 border-slate-400/20", dot: "bg-slate-400", label: "Low confidence" };

  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${cfg.pill}`}>
        <span className={`w-1 h-1 rounded-full ${cfg.dot} shrink-0`} />
        {cfg.label}
      </span>
      <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{note}</p>
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

  const comparableRows = isProperty && pd
    ? pd.comparableSales.length === 1 && pd.comparableSales[0].price === "—"
      ? `<tr><td colspan="4" style="color:#6b7280;font-style:italic;padding:10px 0">${pd.comparableSales[0].address}</td></tr>`
      : pd.comparableSales.map(s => `
    <tr>
      <td>${s.address}</td>
      <td style="color:#6b7280">${s.type}</td>
      <td style="font-family:Georgia,serif;font-size:15px">${s.price}</td>
      <td style="text-align:right;color:#6b7280">${s.date}</td>
    </tr>`).join("")
    : "";

  const leveragePoints = isProperty && pd ? pd.negotiationBrief.leveragePoints.map((p, i) => `
    <li style="margin-bottom:6px"><span style="color:#B8860B;font-family:Georgia,serif">${i+1}.</span> ${p}</li>`).join("") : "";

  // —— Worry box section for PDF ——
  const pdfWorryBoxSection = (() => {
    const wb = ai.worryBox;
    if (!wb) return "";
    const hasItems = wb.items.length > 0;
    const worstSeverity = wb.items[0]?.severity ?? "low";
    const headerBg = worstSeverity === "high" ? "#fef2f2" : worstSeverity === "medium" ? "#fffbeb" : "#f9fafb";
    const headerBorderColor = worstSeverity === "high" ? "#ef4444" : worstSeverity === "medium" ? "#f59e0b" : "#d1d5db";
    const headerLabelColor = worstSeverity === "high" ? "#b91c1c" : worstSeverity === "medium" ? "#92400e" : "#6b7280";
    const outerBorder = worstSeverity === "high" ? "#ef444480" : worstSeverity === "medium" ? "#f59e0b80" : "#d1d5db";
    const severityRowBg: Record<string, string> = { high: "#fef2f2", medium: "#fffbeb", low: "#f9fafb" };
    const severityLabelColor: Record<string, string> = { high: "#b91c1c", medium: "#92400e", low: "#4b5563" };
    const severityDotColor: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#9ca3af" };
    const categoryEmoji: Record<string, string> = { flood: "\u{1F30A}", market: "\u{1F4C9}", crime: "\u26A0", epc: "\u26A1", development: "\u{1F3D7}", data: "\u{1F4CA}", environment: "\u{1F4A8}", other: "\u2022" };
    const rows = hasItems
      ? wb.items.map(item => {
          const rowBg = severityRowBg[item.severity] ?? "#f9fafb";
          const labelColor = severityLabelColor[item.severity] ?? "#374151";
          const dotColor = severityDotColor[item.severity] ?? "#9ca3af";
          const emoji = categoryEmoji[item.category] ?? "\u2022";
          return `<tr>
  <td style="padding:11px 14px;border-left:3px solid ${dotColor};border-bottom:1px solid #f3f4f6;background:${rowBg};vertical-align:top">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <div style="flex-shrink:0;padding-top:2px">
        <div style="display:inline-flex;align-items:center;gap:5px">
          <span style="font-size:9px;color:${dotColor}">●</span>
          <span style="font-size:7.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${labelColor}">${emoji} ${item.headline}</span>
        </div>
      </div>
      <p style="font-size:11px;line-height:1.65;color:#374151;margin:0">${item.detail}</p>
    </div>
  </td>
</tr>`;
        }).join("")
      : `<tr><td style="padding:12px 16px">
           <div style="display:flex;align-items:center;gap:10px">
             <div style="width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0"></div>
             <p style="font-size:12px;color:#374151;margin:0">${wb.verdict || "No major immediate concerns identified from available data \u2014 standard due diligence applies."}</p>
           </div>
         </td></tr>`;
    return `
  <div class="section" style="border:2px solid ${outerBorder};border-radius:8px;overflow:hidden;margin-bottom:24px;padding:0">
    <div style="padding:11px 16px;background:${headerBg};border-bottom:2px solid ${headerBorderColor}40;display:flex;align-items:center;gap:10px">
      <span style="font-size:13px">${hasItems ? "\u26A0\uFE0F" : "\u{1F6E1}\uFE0F"}</span>
      <span style="font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${headerLabelColor}">What would worry me here?</span>
      ${hasItems ? `<span style="font-size:9px;color:${headerLabelColor};opacity:0.7;margin-left:4px">${wb.items.length} concern${wb.items.length > 1 ? "s" : ""} to check</span>` : ""}
    </div>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <div style="padding:7px 14px;border-top:1px solid #f3f4f6;background:#fafafa">
      <p style="font-size:9px;color:#9ca3af;margin:0">Concerns drawn from Land Registry, EA flood data, DEFRA, and area enrichment signals. Always commission independent surveys before offering.</p>
    </div>
  </div>`;
  })();

  // —— Negotiation Leverage PDF section ——
  const pdfNegotiationLeverageSection = (() => {
    const nl = ai.negotiationLeverage;
    if (!nl) return "";
    const stanceColors: Record<string, string> = {
      "Firm buyer — you have leverage": "#166534",
      "Balanced — play it carefully": "#B8860B",
      "Limited leverage — seller holds ground": "#92400e",
      "Thin data — proceed cautiously": "#6b7280",
    };
    const stanceBgs: Record<string, string> = {
      "Firm buyer — you have leverage": "#f0fdf4",
      "Balanced — play it carefully": "#fefce8",
      "Limited leverage — seller holds ground": "#fffbeb",
      "Thin data — proceed cautiously": "#f9fafb",
    };
    const stanceColor = stanceColors[nl.stance] ?? "#374151";
    const stanceBg = stanceBgs[nl.stance] ?? "#f9fafb";
    const demandColors: Record<string, string> = { Competitive: "#991b1b", Balanced: "#1e4d8c", Soft: "#92400e", "Very soft": "#166534" };
    const sellerColors: Record<string, string> = { "Strong position": "#991b1b", "Balanced": "#1e4d8c", "Some vulnerability": "#92400e", "Signs of pressure": "#166534", "Uncertain": "#6b7280" };
    const strengthColors: Record<string, string> = { strong: "#166534", moderate: "#92400e", weak: "#6b7280" };
    const strengthBgs: Record<string, string> = { strong: "#dcfce7", moderate: "#fef3c7", weak: "#f3f4f6" };
    const confColors: Record<string, string> = { Strong: "#166534", Moderate: "#92400e", Thin: "#6b7280" };
    const leverageRows = nl.leveragePoints.map(lp =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top">
        <div style="display:flex;align-items:flex-start;gap:10px;justify-content:space-between">
          <p style="font-size:11px;color:#374151;margin:0;line-height:1.55">${lp.point}</p>
          <span style="flex-shrink:0;font-size:8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:2px 6px;border-radius:3px;background:${strengthBgs[lp.strength]};color:${strengthColors[lp.strength]}">${lp.strength === "strong" ? "Strong" : lp.strength === "moderate" ? "Moderate" : "Tactical"}</span>
        </div>
      </td></tr>`
    ).join("");
    return `
  <div class="section" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;padding:0">
    <div style="padding:10px 16px;background:#f8f9fa;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:8px">
      <span style="font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#B8860B">⌖ NEGOTIATION LEVERAGE</span>
      <span style="font-size:8.5px;color:#9ca3af;margin-left:auto">Buyer strategy</span>
    </div>
    <div style="padding:10px 16px;background:${stanceBg};border-bottom:1px solid #e5e7eb">
      <span style="font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${stanceColor}">${nl.stance}</span>
    </div>
    <div style="padding:14px 16px">
      <div style="display:flex;gap:12px;margin-bottom:14px">
        <div style="flex:1;background:#faf8f4;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px">
          <div style="font-size:8.5px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px">Fair Value</div>
          <div style="font-family:Georgia,serif;font-size:16px;color:#1a1612">${nl.offerRange.fairValue}</div>
        </div>
        <div style="flex:1;background:#faf8f4;border:1px solid #B8860B30;border-radius:6px;padding:10px 12px">
          <div style="font-size:8.5px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px">Opening Range</div>
          <div style="font-family:Georgia,serif;font-size:16px;color:#B8860B">${nl.offerRange.openingRange}</div>
        </div>
        <div style="flex:1;background:#faf8f4;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px">
          <div style="font-size:8.5px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px">Evidence</div>
          <div style="font-size:12px;font-weight:600;color:${confColors[nl.offerRange.confidence]}">${nl.offerRange.confidence}</div>
        </div>
      </div>
      <p style="font-size:10px;color:#6b7280;border-left:2px solid #e5e7eb;padding-left:8px;margin-bottom:12px">${nl.offerRange.confidenceNote}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="background:#f9fafb;border-radius:6px;padding:10px 12px;border:1px solid #f3f4f6">
          <div style="font-size:8px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${demandColors[nl.demandTemperature.label] ?? "#374151"};margin-bottom:4px">Market Demand: ${nl.demandTemperature.label}</div>
          <p style="font-size:10.5px;color:#374151;margin:0;line-height:1.55">${nl.demandTemperature.rationale}</p>
        </div>
        <div style="background:#f9fafb;border-radius:6px;padding:10px 12px;border:1px solid #f3f4f6">
          <div style="font-size:8px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${sellerColors[nl.sellerPosition.label] ?? "#374151"};margin-bottom:4px">Seller Position: ${nl.sellerPosition.label}</div>
          <p style="font-size:10.5px;color:#374151;margin:0;line-height:1.55">${nl.sellerPosition.rationale}</p>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <div style="font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;margin-bottom:6px">What Local Sales Imply</div>
        <p style="font-size:11px;color:#374151;line-height:1.6;margin:0">${nl.localSalesRead}</p>
      </div>
      <div style="border-top:1px solid #f3f4f6;padding-top:10px">
        <div style="font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;margin-bottom:6px">Leverage Points to Use</div>
        <table style="width:100%;border-collapse:collapse">${leverageRows}</table>
      </div>
      <p style="font-size:8.5px;color:#9ca3af;margin-top:8px">Offer ranges derived from Land Registry data and area benchmarks. Not a formal valuation. Instruct a RICS surveyor before exchange.</p>
    </div>
  </div>`;
  })();

  // Red-flag section for PDF
  const redFlagsForPdf = ai.redFlags ?? [];
  const pdfHasFlags = redFlagsForPdf.length > 0;
  const pdfHighCount = redFlagsForPdf.filter(f => f.severity === "high").length;
  const pdfRedFlagSection = `
  <div class="section">
    <div class="section-label" style="color:${pdfHighCount > 0 ? "#dc2626" : "#d97706"}">Risk Summary${pdfHasFlags ? ` — ${redFlagsForPdf.length} flag${redFlagsForPdf.length > 1 ? "s" : ""} identified` : ""}</div>
    ${!pdfHasFlags
      ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:0 4px 4px 0">
           <div style="width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0"></div>
           <p style="font-size:12px;color:#374151;margin:0">No major immediate red flags identified from available data.</p>
         </div>`
      : `<table style="width:100%;border-collapse:collapse">${redFlagsForPdf.map(flag => {
          const isHigh = flag.severity === "high";
          return `<tr><td style="padding:10px 14px;border-left:3px solid ${isHigh ? "#ef4444" : "#f59e0b"};border-bottom:1px solid #f3f4f6;background:${isHigh ? "#fef2f2" : "#fffbeb"};vertical-align:top">
            <div style="font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${isHigh ? "#b91c1c" : "#92400e"};margin-bottom:4px">${flag.label}</div>
            <p style="font-size:12px;line-height:1.6;color:#374151;margin:0">${flag.detail}</p>
          </td></tr>`;
        }).join("")}</table>`
    }
  </div>`;

  const offerStrategyHtml = isProperty && pd?.offerStrategy ? `
  <div class="section">
    <div class="section-label">Pre-offer Strategy</div>
    <p style="font-size:10px;color:#6b7280;margin-bottom:12px">Evidence-led guidance for making and defending an offer. Not a formal valuation — instruct a RICS surveyor before exchange.</p>
    <div style="display:flex;gap:12px;margin-bottom:12px">
      <div style="background:#faf8f4;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;flex:1">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px">Fair Value Range</div>
        <div style="font-family:Georgia,serif;font-size:17px;color:#1a1612">${pd.offerStrategy.fairValueRange}</div>
      </div>
      <div style="background:#faf8f4;border:1px solid #B8860B30;border-radius:6px;padding:10px 14px;flex:1">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px">Opening Range</div>
        <div style="font-family:Georgia,serif;font-size:17px;color:#B8860B">${pd.offerStrategy.openingRange}</div>
      </div>
      <div style="background:#faf8f4;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;flex:1">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Evidence Quality</div>
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:8.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:3px 9px;border-radius:20px;border:1px solid;${pd.offerStrategy.confidence === 'Strong' ? 'background:#f0fdf4;color:#15803d;border-color:#86efac' : pd.offerStrategy.confidence === 'Moderate' ? 'background:#fefce8;color:#B8860B;border-color:#fde047' : 'background:#f8fafc;color:#64748b;border-color:#cbd5e1'}"><span style="width:5px;height:5px;border-radius:50%;background:currentColor;display:inline-block"></span>${pd.offerStrategy.confidence} evidence</span>
      </div>
    </div>
    <p style="font-size:11px;color:#6b7280;border-left:2px solid #e5e7eb;padding-left:10px;margin-bottom:12px">${pd.offerStrategy.confidenceNote}</p>
    <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">How we got here</p>
    <p style="font-size:12px;color:#374151;line-height:1.6;margin-bottom:12px">${pd.offerStrategy.rationale}</p>
    <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Factors that may support a firmer stance</p>
    <ul style="padding-left:0;list-style:none;margin-bottom:12px">${pd.offerStrategy.sellerPressurePoints.map(p => `<li style="margin-bottom:6px;font-size:12px;color:#374151;padding-left:14px;position:relative"><span style="position:absolute;left:0;color:#d97706">‣</span>${p}</li>`).join("")}</ul>
    <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Questions to raise before offering</p>
    <ol style="padding-left:16px;margin:0">${pd.offerStrategy.preOfferQuestions.map(q => `<li style="margin-bottom:6px;font-size:12px;color:#374151">${q}</li>`).join("")}</ol>
  </div>` : "";

  const riskFlags = ai.investmentOutlook.riskFlags.map(f => `
    <li style="margin-bottom:4px;padding-left:16px;position:relative"><span style="position:absolute;left:0;color:#9ca3af">–</span>${f}</li>`).join("");

  // Walk Score
  const { calculateWalkScore: _calcWs } = { calculateWalkScore: (s: any[], sc: any[], a: any) => {
    let score = 0;
    if (s.some((x: any) => x.distanceMetres <= 400)) score += 25;
    else if (s.some((x: any) => x.distanceMetres <= 800)) score += 12;
    const shops = [...(a?.supermarkets ?? []), ...(a?.cafesAndRestaurants ?? [])];
    if (shops.some((x: any) => x.distanceMetres <= 400)) score += 20;
    else if (shops.some((x: any) => x.distanceMetres <= 800)) score += 10;
    if (a?.greenSpaces?.some((x: any) => x.distanceMetres <= 800)) score += 15;
    if (sc.some((x: any) => x.distanceMetres <= 800)) score += 10;
    if (a?.health?.some((x: any) => x.distanceMetres <= 800)) score += 10;
    if (a?.cafesAndRestaurants?.some((x: any) => x.distanceMetres <= 400)) score += 20;
    return Math.min(score, 100);
  }};
  const walkScoreVal = _calcWs(ai.nearbyStations ?? [], ai.nearbySchools ?? [], ai.nearbyAmenities);
  const walkScoreLabel = walkScoreVal >= 90 ? "Walker's Paradise" : walkScoreVal >= 70 ? "Very Walkable" : walkScoreVal >= 50 ? "Somewhat Walkable" : walkScoreVal >= 25 ? "Car-Dependent" : "Minimal Walkability";

  // Nearby stations rows
  const stationRows = (ai.nearbyStations ?? []).slice(0, 6).map(s =>
    `<tr><td>${s.name}</td><td style="color:#9ca3af">${s.modes?.join(", ") ?? ""}</td><td style="color:#6b7280">${s.lines?.slice(0,2).join(", ") ?? ""}</td><td style="text-align:right;color:#B8860B;font-weight:600">${s.walkMins} min</td></tr>`
  ).join("");

  // Nearby schools rows
  const schoolRows = (ai.nearbySchools ?? []).slice(0, 6).map(s =>
    `<tr><td>${s.name}</td><td style="color:#9ca3af">${s.type}</td><td style="color:${
      s.ofstedRating === 'Outstanding' ? '#166534' : s.ofstedRating === 'Good' ? '#1d4ed8' : '#6b7280'
    }">${s.ofstedRating}</td><td style="text-align:right;color:#6b7280">${s.walkMins} min</td></tr>`
  ).join("");

  // Crime stats
  // ── Sold Prices PDF section ───────────────────────────────────────────────
  const pdfSoldPricesSection = (() => {
    const sp = ai.recentSoldPrices;
    if (!sp || sp.length === 0) return "";
    const interp = deriveMapInterpretation(sp, (() => {
      const raw = ai.marketOverview?.averagePrice;
      if (!raw) return undefined;
      const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
      return isNaN(n) ? undefined : n;
    })());

    const evidenceBg  = interp.evidenceLabel === "Strong" ? "#f0fdf4" : interp.evidenceLabel === "Moderate" ? "#fffbeb" : "#fef2f2";
    const evidenceCol = interp.evidenceLabel === "Strong" ? "#166534" : interp.evidenceLabel === "Moderate" ? "#92400e" : "#991b1b";
    const spreadBg    = interp.spreadLabel === "Tight" ? "#f0fdf4" : interp.spreadLabel === "Moderate spread" ? "#fffbeb" : "#fff7ed";
    const spreadCol   = interp.spreadLabel === "Tight" ? "#166534" : interp.spreadLabel === "Moderate spread" ? "#92400e" : "#7c2d12";

    const rows = sp.slice(0, 12).map(s =>
      `<tr style="border-bottom:1px solid #f3f4f6">`
      + `<td style="padding:7px 10px 7px 0;font-size:11px;color:#374151">${s.address}</td>`
      + `<td style="padding:7px 8px;font-size:12px;font-weight:700;color:#B8860B;white-space:nowrap">${s.price}</td>`
      + `<td style="padding:7px 8px;font-size:10px;color:#9ca3af;white-space:nowrap">${s.type}</td>`
      + `<td style="padding:7px 0;font-size:10px;color:#9ca3af;white-space:nowrap;text-align:right">${s.date}</td>`
      + `</tr>`
    ).join("");

    const prices = sp.map(s => parseInt(s.price.replace(/[^0-9]/g,""),10)).filter(p=>p>0);
    const sorted = [...prices].sort((a,b)=>a-b);
    const lo = sorted[0] || 0;
    const hi = sorted[sorted.length-1] || 0;
    const med = sorted.length ? sorted[Math.floor(sorted.length/2)] : 0;
    const fmt3 = (n: number) => n >= 1000000 ? `£${(n/1000000).toFixed(1).replace(/\.0$/,"")}m` : `£${Math.round(n/1000)}k`;

    return `
  <div class="section">
    <div class="section-label">Nearby Sold Prices</div>
    <p style="font-size:10px;color:#6b7280;margin-bottom:10px">Recent transactions in this postcode area from HM Land Registry Price Paid data. Completed sales only — not asking prices.</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px">
      <div class="kpi"><div class="kpi-label">Range (low)</div><div class="kpi-value" style="font-size:15px">${fmt3(lo)}</div></div>
      <div class="kpi" style="border:1px solid #B8860B30"><div class="kpi-label">Local median</div><div class="kpi-value" style="font-size:15px;color:#B8860B">${fmt3(med)}</div></div>
      <div class="kpi"><div class="kpi-label">Range (high)</div><div class="kpi-value" style="font-size:15px">${fmt3(hi)}</div></div>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;margin-bottom:12px">
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">
        <span style="flex-shrink:0;font-size:9px;font-weight:700;padding:2px 8px;border-radius:9999px;background:${evidenceBg};color:${evidenceCol};border:1px solid ${evidenceBg}">${interp.evidenceLabel} evidence</span>
        <p style="font-size:12px;color:#374151;line-height:1.6;margin:0">${interp.evidenceNote}</p>
      </div>
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">
        <span style="flex-shrink:0;font-size:9px;font-weight:700;padding:2px 8px;border-radius:9999px;background:${spreadBg};color:${spreadCol};border:1px solid ${spreadBg}">${interp.spreadLabel}</span>
        <p style="font-size:12px;color:#374151;line-height:1.6;margin:0">${interp.spreadNote}</p>
      </div>
      ${interp.contextNote ? `<p style="font-size:12px;color:#374151;line-height:1.6;margin:0;padding-top:6px;border-top:1px solid #e5e7eb">${interp.contextNote}</p>` : ""}
    </div>
    <table style="width:100%"><thead><tr><th>Address</th><th>Price</th><th>Type</th><th style="text-align:right">Date</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p style="margin-top:8px;font-size:10px;color:#9ca3af">Source: HM Land Registry Price Paid data. Prices are registered completed-transaction values and do not reflect any post-sale negotiation. Coordinates are postcode-centroid estimates — not exact property locations.</p>
  </div>`;
  })();

  // ── Development Tracker PDF section ──────────────────────────────────────────
  const pdfDevelopmentTrackerSection = (() => {
    const devs = ai.nearbyDevelopments;
    if (!devs || devs.length === 0) return "";
    const real = devs.filter(d => d.name !== "No major schemes on record");
    if (real.length === 0) return "";
    const sorted = sortDevs(devs);
    const IMPACT_COLOURS: Record<string, { bg: string; text: string; label: string }> = {
      upside:    { bg: "#d1fae5", text: "#065f46", label: "Likely upside" },
      disruption:{ bg: "#fee2e2", text: "#991b1b", label: "Disruption risk" },
      mixed:     { bg: "#fef3c7", text: "#92400e", label: "Mixed impact" },
      unclear:   { bg: "#f3f4f6", text: "#374151", label: "Impact unclear" },
    };
    const rows = sorted
      .filter(d => d.name !== "No major schemes on record")
      .map(dev => {
        const col = IMPACT_COLOURS[dev.impactLabel ?? "unclear"] ?? IMPACT_COLOURS.unclear;
        const dist = dev.distanceM ? (dev.distanceM < 1000 ? `~${Math.round(dev.distanceM / 50) * 50}m` : `~${(dev.distanceM / 1000).toFixed(1)}km`) : "";
        return `
          <div style="border-left:3px solid ${col.text};background:${col.bg}20;border-radius:6px;padding:10px 12px;margin-bottom:8px">
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:4px">
              <span style="font-size:12px;font-weight:700;color:#111827">${dev.name}</span>
              <span style="font-size:10px;font-weight:600;background:${col.bg};color:${col.text};padding:2px 7px;border-radius:999px">${col.label}</span>
              ${dev.type !== "—" ? `<span style="font-size:10px;font-weight:600;background:#e5e7eb;color:#374151;padding:2px 7px;border-radius:999px">${dev.type}</span>` : ""}
              <span style="font-size:10px;color:#6b7280">${dev.status}</span>
              ${dist ? `<span style="font-size:10px;color:#6b7280;margin-left:auto">${dist}</span>` : ""}
            </div>
            <p style="font-size:11px;color:#1f2937;line-height:1.55;margin:0 0 4px">${dev.impactRationale}</p>
            <p style="font-size:10px;color:#6b7280;line-height:1.5;margin:0">${dev.detail}</p>
          </div>`;
      })
      .join("");
    return `
  <div class="section">
    <div class="section-label">Nearby Development Tracker</div>
    <p style="font-size:11px;color:#6b7280;margin-bottom:10px">Major consented and in-progress schemes near this property, classified by likely buyer impact.</p>
    ${rows}
    <p style="font-size:10px;color:#9ca3af;margin-top:8px">Development data is derived from curated major schemes and live planning registers. Minor applications and early-stage proposals may not appear here. Always verify with the council planning portal before exchange.</p>
  </div>`;
  })();

  const crimeSection = ai.crimeStats && ai.crimeStats.totalCrimesPerMonth > 0 ? `
  <div class="section">
    <div class="section-label">Crime Statistics</div>
    <div style="display:flex;gap:24px;margin-bottom:10px">
      <div class="kpi"><div class="kpi-label">Crimes/Month</div><div class="kpi-value" style="font-size:20px">${ai.crimeStats.totalCrimesPerMonth.toLocaleString("en-GB")}</div></div>
    </div>
    <table><thead><tr><th>Category</th><th style="text-align:right">Count</th><th style="text-align:right">Share</th></tr></thead>
    <tbody>${ai.crimeStats.topCategories.slice(0, 5).map(c =>
      `<tr><td>${c.category}</td><td style="text-align:right">${c.count}</td><td style="text-align:right;color:#6b7280">${c.pct}%</td></tr>`
    ).join("")}</tbody></table>
    <p style="margin-top:8px;font-size:11px;color:#9ca3af">${ai.crimeStats.vsNationalNote}</p>
  </div>` : "";

  // "Would I buy here?" verdict for PDF — uses the pre-computed buyerVerdict from engine
  const pdfVerdict = ai.buyerVerdict;
  const pdfVerdictLabelColor = pdfVerdict?.verdictLabel === "Strong case"
    ? "#166534" : pdfVerdict?.verdictLabel === "Good case"
    ? "#92400e" : pdfVerdict?.verdictLabel === "Proceed carefully"
    ? "#991b1b" : "#374151";
  const pdfVerdictLabelBg = pdfVerdict?.verdictLabel === "Strong case"
    ? "#f0fdf4" : pdfVerdict?.verdictLabel === "Good case"
    ? "#fefce8" : pdfVerdict?.verdictLabel === "Proceed carefully"
    ? "#fef2f2" : "#f9fafb";
  const pdfConfColor = pdfVerdict?.confidenceLevel === "High"
    ? "#166534" : pdfVerdict?.confidenceLevel === "Moderate"
    ? "#92400e" : "#374151";
  const pdfConfBg = pdfVerdict?.confidenceLevel === "High"
    ? "#f0fdf4" : pdfVerdict?.confidenceLevel === "Moderate"
    ? "#fffbeb" : "#f9fafb";
  // Shortlist verdict for PDF — the very first decision signal
  const sv = ai.shortlistVerdict;
  const pdfShortlistColors: Record<string, { bg: string; border: string; dot: string; label: string }> = {
    "Strong shortlist":             { bg: "#f0fdf4", border: "#86efac", dot: "#22c55e", label: "#15803d" },
    "Shortlist with caveats":       { bg: "#fefce8", border: "#fde047", dot: "#B8860B", label: "#B8860B" },
    "Proceed carefully":            { bg: "#fff7ed", border: "#fed7aa", dot: "#f97316", label: "#c2410c" },
    "Probably not worth pursuing":  { bg: "#fef2f2", border: "#fecaca", dot: "#ef4444", label: "#b91c1c" },
  };
  const pdfSLCol = sv ? (pdfShortlistColors[sv.label] ?? pdfShortlistColors["Shortlist with caveats"]) : null;
  const pdfShortlistSection = sv && pdfSLCol ? `
  <div class="section" style="border:1px solid ${pdfSLCol.border};border-radius:8px;overflow:hidden;padding:0;margin-bottom:24px">
    <div style="padding:10px 16px;background:${pdfSLCol.bg};border-bottom:1px solid ${pdfSLCol.border};display:flex;align-items:center;gap:8px">
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${pdfSLCol.label}">
        <span style="width:6px;height:6px;border-radius:50%;background:${pdfSLCol.dot};display:inline-block;flex-shrink:0"></span>
        Would I shortlist this?
      </span>
      <span style="margin-left:auto;font-size:8.5px;color:#9ca3af;font-style:italic">${
        sv.label === "Strong shortlist" ? "Keep going." :
        sv.label === "Shortlist with caveats" ? "Keep going, but check first." :
        sv.label === "Proceed carefully" ? "Slow down." : "Move on."
      }</span>
    </div>
    <div style="padding:12px 16px;display:flex;align-items:flex-start;gap:10px">
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:8.5px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:3px 9px;border-radius:20px;border:1px solid ${pdfSLCol.border};background:${pdfSLCol.bg};color:${pdfSLCol.label};flex-shrink:0">
        <span style="width:5px;height:5px;border-radius:50%;background:${pdfSLCol.dot};display:inline-block"></span>
        ${sv.label}
      </span>
      <p style="font-size:11.5px;color:#111827;line-height:1.6;margin:0;font-weight:500">${sv.reasoning}</p>
    </div>
    <div style="padding:8px 16px;background:#fafafa;border-top:1px solid ${pdfSLCol.border}">
      <span style="font-size:7.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;margin-right:8px">Next</span>
      <span style="font-size:10.5px;color:#6b7280;line-height:1.6">${sv.nextStep}</span>
    </div>
  </div>` : "";

  const pdfOneGlanceSection = pdfVerdict ? `
  <div class="section">
    <div class="section-label">Would I Buy Here?</div>
    <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      <div style="padding:14px 16px;background:#faf8f4;border-bottom:1px solid #e5e7eb">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#9ca3af">Verdict</div>
          <div style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:0.08em;padding:3px 10px;border-radius:20px;background:${pdfVerdictLabelBg};color:${pdfVerdictLabelColor};border:1px solid ${pdfVerdictLabelColor}30">${pdfVerdict.verdictLabel}</div>
        </div>
        <p style="font-size:12px;line-height:1.65;color:#111827;margin:0;font-weight:500">${pdfVerdict.verdictRationale}</p>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:11px 14px;background:#fefce8;border-left:3px solid #B8860B;border-bottom:1px solid #f3f4f6;vertical-align:top">
            <div style="font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#92400e;margin-bottom:5px">Best for</div>
            <p style="font-size:12px;line-height:1.6;color:#111827;margin:0">${pdfVerdict.bestFor}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:11px 14px;background:#f0fdf4;border-left:3px solid #22c55e;border-bottom:1px solid #f3f4f6;vertical-align:top">
            <div style="font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#166534;margin-bottom:6px">Strongest positives</div>
            <ul style="padding:0;margin:0;list-style:none;display:flex;flex-direction:column;gap:5px">${pdfVerdict.strongestPositives.map(p => `<li style="font-size:12px;line-height:1.6;color:#111827;padding-left:14px;position:relative"><span style="position:absolute;left:0;color:#22c55e;font-weight:700">✓</span>${p}</li>`).join("")}</ul>
          </td>
        </tr>
        <tr>
          <td style="padding:11px 14px;background:#fffbeb;border-left:3px solid #f59e0b;border-bottom:1px solid #f3f4f6;vertical-align:top">
            <div style="font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#92400e;margin-bottom:6px">Watch-outs</div>
            ${pdfVerdict.mainWatchOuts.length > 0
              ? `<ul style="padding:0;margin:0;list-style:none;display:flex;flex-direction:column;gap:5px">${pdfVerdict.mainWatchOuts.map(w => `<li style="font-size:12px;line-height:1.6;color:#111827;padding-left:14px;position:relative"><span style="position:absolute;left:0;color:#f59e0b;font-weight:700">–</span>${w}</li>`).join("")}</ul>`
              : `<p style="font-size:12px;color:#6b7280;margin:0">No material watch-outs from available data.</p>`
            }
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#f9fafb;border-left:1px solid #e5e7eb;vertical-align:middle">
            <div style="display:inline-flex;align-items:center;gap:7px">
              <span style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:2px 8px;border-radius:12px;background:${pdfConfBg};color:${pdfConfColor};border:1px solid ${pdfConfColor}30">${pdfVerdict.confidenceLevel} confidence</span>
              <span style="font-size:11px;color:#6b7280;line-height:1.55">${pdfVerdict.confidenceNote}</span>
            </div>
          </td>
        </tr>
      </table>
    </div>
  </div>` : "";

  // Strengths & Considerations for PDF
  const { strengths: pdfStrengths, considerations: pdfConsiderations } = deriveStrengthsAndConsiderations(ai);
  const pdfSCSSection = (pdfStrengths.length > 0 || pdfConsiderations.length > 0) ? `
  <div class="section">
    <div class="section-label">Strengths &amp; Considerations</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      ${pdfStrengths.length > 0 ? `
      <div>
        <div style="font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#166534;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e"></span>What works in your favour
        </div>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          ${pdfStrengths.map(s => `<li><div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:2px">${s.label}</div><div style="font-size:11px;color:#6b7280;line-height:1.55">${s.detail}</div></li>`).join("")}
        </ul>
      </div>` : ""}
      ${pdfConsiderations.length > 0 ? `
      <div>
        <div style="font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#92400e;margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#f59e0b"></span>Worth thinking about
        </div>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          ${pdfConsiderations.map(c => `<li><div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:2px">${c.label}</div><div style="font-size:11px;color:#6b7280;line-height:1.55">${c.detail}</div></li>`).join("")}
        </ul>
      </div>` : ""}
    </div>
    <p style="margin-top:12px;font-size:10px;color:#9ca3af">Synthesised from Land Registry, Environment Agency, Ofsted, and ONS data. Not a substitute for a professional survey.</p>
  </div>` : "";

  // Lifestyle Fit for PDF
  const pdfLifestyleFitSection = (() => {
    const fit = ai.lifestyleFit;
    if (!fit || fit.length === 0) return "";

    const scoreMeta: Record<string, { color: string; bg: string; border: string; bar: string }> = {
      Excellent: { color: "#166534", bg: "#f0fdf4", border: "#bbf7d0", bar: "#22c55e" },
      Good:      { color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", bar: "#3b82f6" },
      Mixed:     { color: "#92400e", bg: "#fffbeb", border: "#fde68a", bar: "#f59e0b" },
      Limited:   { color: "#991b1b", bg: "#fef2f2", border: "#fecaca", bar: "#f87171" },
    };

    const categoryMeta: Record<string, { desc: string }> = {
      "Family fit":        { desc: "Schools, safety & green space" },
      "Commute fit":       { desc: "Stations, lines & walk time" },
      "Convenience fit":   { desc: "Day-to-day essentials on foot" },
      "Green space fit":   { desc: "Parks & usable outdoor access" },
      "Long-term appeal":  { desc: "Desirability signals & resale strength" },
    };

    const barWidths: Record<string, string> = {
      Excellent: "100%",
      Good:      "75%",
      Mixed:     "50%",
      Limited:   "25%",
    };

    const rows = fit.map(item => {
      const sm = scoreMeta[item.score] ?? scoreMeta["Mixed"];
      const cm = categoryMeta[item.category] ?? { desc: "" };
      const bw = barWidths[item.score] ?? "50%";
      return `
      <tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:12px 14px 12px 0;vertical-align:top;width:150px">
          <div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:3px">${item.category}</div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.09em;color:#9ca3af;margin-bottom:6px">${cm.desc}</div>
          <div style="background:#f3f4f6;height:4px;border-radius:9999px;overflow:hidden;width:100px">
            <div style="height:4px;width:${bw};background:${sm.bar};border-radius:9999px"></div>
          </div>
          <div style="margin-top:5px">
            <span style="display:inline-block;padding:2px 9px;border-radius:9999px;font-size:9px;font-weight:700;background:${sm.bg};color:${sm.color};border:1px solid ${sm.border}">${item.score}</span>
          </div>
        </td>
        <td style="padding:12px 0 12px 8px;font-size:11.5px;color:#374151;line-height:1.6;vertical-align:top">${item.caption}</td>
      </tr>`;
    }).join("");

    // Summary line
    const counts: Record<string, number> = { Excellent: 0, Good: 0, Mixed: 0, Limited: 0 };
    fit.forEach(f => { counts[f.score] = (counts[f.score] ?? 0) + 1; });
    const topLine = counts["Excellent"] >= 3
      ? "Strong across the board"
      : (counts["Excellent"] ?? 0) + (counts["Good"] ?? 0) >= 4
      ? "Mostly positive"
      : (counts["Mixed"] ?? 0) + (counts["Limited"] ?? 0) >= 3
      ? "Several trade-offs to weigh"
      : "Mixed picture";

    return `
    <div class="section">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div class="section-label" style="margin-bottom:0">Lifestyle Fit</div>
        <span style="font-size:10px;color:#6b7280;font-weight:600">${topLine}</span>
      </div>
      <p style="font-size:10px;color:#9ca3af;margin-bottom:14px">How this area scores across five buyer-first dimensions — grounded in data from this brief.</p>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb">
            <th style="text-align:left;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;padding-bottom:8px;width:150px">Category</th>
            <th style="text-align:left;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;padding-bottom:8px">What this means in practice</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:10px;font-size:10px;color:#9ca3af">Derived from Ofsted ratings, station data, Overpass amenity data, and UK crime statistics. Reflects the area as a whole — individual streets may vary.</p>
    </div>`;
  })();

  // ── What People Miss PDF section ──────────────────────────────────────────
  const pdfMissedInsightsSection = (() => {
    const missed = ai.missedInsights;
    if (!missed || missed.length === 0) return "";
    const categoryLabels: Record<string, string> = {
      transport: "Transport", noise: "Noise & Air", environment: "Climate",
      schools: "Schools", safety: "Safety", green: "Green Space",
      market: "Market", amenity: "Amenities", value: "Value", demand: "Demand",
    };
    const rows = missed.map(item => `
      <tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:9px 10px 9px 0;white-space:nowrap">
          <span style="display:inline-block;padding:3px 9px;border-radius:6px;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;background:#fffbeb;color:#92400e;border:1px solid #fde68a">${categoryLabels[item.category] ?? item.category}</span>
        </td>
        <td style="padding:9px 0 9px 8px;font-size:12px;color:#374151;line-height:1.55">${item.insight}</td>
      </tr>
    `).join("");
    return `
    <div class="section">
      <div class="section-label">What People Miss About This Area</div>
      <p style="font-size:11px;color:#6b7280;margin-bottom:12px">Non-obvious trade-offs derived by combining multiple data signals — not found in listing copy.</p>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb">
            <th style="text-align:left;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;padding-bottom:7px;width:110px">Signal</th>
            <th style="text-align:left;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;padding-bottom:7px">Insight</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  })();

  // HS2 flags
  const hs2Flags = (() => {
    const outcode = ai.location.trim().toUpperCase().split(" ")[0].replace(/\d[A-Z]{2}$/, "").trim();
    const hs2Map: Record<string, string> = {
      "NW10": "HS2 Old Oak Common — Mixed impact. Under construction.",
      "NW1": "HS2 Euston Terminus — Under construction.",
      "B1": "HS2 Birmingham Curzon Street — Positive regeneration impact.",
    };
    return hs2Map[outcode] ? `<p style="margin-top:8px;padding:10px 14px;background:#fef9c3;border-left:3px solid #ca8a04;font-size:12px;color:#713f12">⚠ Infrastructure Alert: ${hs2Map[outcode]}</p>` : "";
  })();

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
<title>${companyName || "LuxProperty.ai"} — ${isProperty ? "Property" : "Area"} Report</title>
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
      Buyer Brief — ${isProperty ? "Property" : "Area"} Report<br>
      Generated ${date}${preparedByLine}<br>
      LuxProperty.ai Professional
    </div>
  </div>

  <div style="margin-bottom:28px">
    <div class="badge">${isProperty ? "Property Brief" : "Area Brief"}</div>
    <h1>${isProperty ? `Property Report — ${ai.location}` : `${ai.location} Property Report — ${ai.area}`}</h1>
    ${isProperty ? `<div class="subtitle">📍 ${report.query}</div>` : ""}
  </div>

  ${pdfShortlistSection}

  ${pdfOneGlanceSection}

  ${pdfWorryBoxSection}

  ${pdfRedFlagSection}

  <div style="margin-bottom:24px;padding:12px 16px;background:#faf8f4;border-left:3px solid #B8860B;font-size:11px;color:#6b7280;line-height:1.65">
    <strong style="color:#1a1612;display:block;margin-bottom:4px">How to read this brief</strong>
    This report uses official UK data sources: Land Registry (prices), Environment Agency (flood), data.police.uk (crime), Ofcom (broadband), Ofsted (schools), and ONS (rental benchmarks). It is a structured due-diligence tool — not a substitute for a RICS survey or legal advice.
  </div>

  <div class="section">
    <div class="section-label">Executive Summary</div>
    <p class="body-text">${ai.executiveSummary}</p>
  </div>

  ${pdfSCSSection}

  ${pdfLifestyleFitSection}

  ${pdfMissedInsightsSection}

  ${pdfDevelopmentAlertsSection(ai.nearbyDevelopments, ai.planningActivity)}

  <div class="section">
    <div class="section-label">Market Overview</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Average Price</div><div class="kpi-value">${ai.marketOverview.averagePrice}</div></div>
      <div class="kpi"><div class="kpi-label">Price Change YoY</div><div class="kpi-value">${ai.marketOverview.priceChangeYoY}</div></div>
      <div class="kpi"><div class="kpi-label">Avg Days on Market • Estimate</div><div class="kpi-value">${ai.marketOverview.avgDaysOnMarket}</div></div>
      <div class="kpi"><div class="kpi-label">Supply Level • Estimate</div><div class="kpi-value">${ai.marketOverview.supplyLevel}</div></div>
    </div>
    <p style="font-size:10px;color:#9ca3af;margin-top:10px">Average price and YoY change: HM Land Registry postcode data. Days on market and supply level are benchmarked from area tier — not live listing data.</p>
    ${ai.briefConfidence ? `<div style="margin-top:10px;display:flex;align-items:flex-start;gap:8px">
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;padding:2px 8px;border-radius:20px;border:1px solid;flex-shrink:0;${
        ai.briefConfidence.marketTrend === 'High'
          ? 'background:#f0fdf4;color:#15803d;border-color:#86efac'
          : ai.briefConfidence.marketTrend === 'Medium'
          ? 'background:#fefce8;color:#B8860B;border-color:#fde047'
          : 'background:#f8fafc;color:#64748b;border-color:#cbd5e1'
      }"><span style="width:5px;height:5px;border-radius:50%;background:currentColor;display:inline-block"></span>${ai.briefConfidence.marketTrend} confidence</span>
      <span style="font-size:10px;color:#9ca3af;line-height:1.55">${ai.briefConfidence.marketTrendNote}</span>
    </div>` : ''}
  </div>

  ${pdfNegotiationLeverageSection}

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

${offerStrategyHtml}` : ""}

  ${pdfSoldPricesSection}

  ${pdfDevelopmentTrackerSection}

  <div class="section">
    <div class="section-label">Flood, Climate &amp; Resilience</div>
    ${(() => {
      const rl = ai.floodRisk.resilienceLabel ?? (ai.floodRisk.riskBadge === "High" ? "High risk" : ai.floodRisk.riskBadge === "Medium" ? "Elevated risk" : "Low risk");
      const rlColour = rl === "High risk" ? "#991b1b" : rl === "Elevated risk" ? "#c2410c" : rl === "Some exposure" ? "#92400e" : "#065f46";
      const rlBg = rl === "High risk" ? "#fee2e2" : rl === "Elevated risk" ? "#ffedd5" : rl === "Some exposure" ? "#fef3c7" : "#d1fae5";
      const signalRows = (ai.floodRisk.climateSignals ?? []).map(s =>
        `<tr><td style="padding:4px 8px 4px 0;font-size:11px;font-weight:600;color:#111827">${s.label}</td><td style="padding:4px 0;font-size:11px;color:#374151">${s.value}</td><td style="padding:4px 8px;font-size:11px;color:#6b7280;max-width:280px">${s.context}</td><td style="padding:4px 0">${s.flagged ? `<span style="font-size:10px;font-weight:700;background:#ffedd5;color:#c2410c;padding:2px 6px;border-radius:4px">Check</span>` : ""}</td></tr>`
      ).join("");
      const stepItems = (ai.floodRisk.nextSteps ?? []).map(step =>
        `<li style="font-size:11px;color:#374151;line-height:1.6;margin-bottom:3px">${step}</li>`
      ).join("");
      return `
    <div style="display:flex;align-items:center;gap:10px;background:${rlBg};border-radius:6px;padding:8px 12px;margin-bottom:10px">
      <span style="font-size:13px;font-weight:700;color:${rlColour}">${rl}</span>
      <span style="font-size:11px;color:#374151">${ai.floodRisk.detail}</span>
    </div>
    <div style="display:flex;gap:20px;margin-bottom:10px">
      <div class="kpi"><div class="kpi-label">Flood Exposure</div><div class="kpi-value" style="font-size:15px">${ai.floodRisk.riskBadge}</div></div>
      <div class="kpi"><div class="kpi-label">EA Flood Zone</div><div class="kpi-value" style="font-size:13px">${ai.floodRisk.zone}</div></div>
      <div class="kpi"><div class="kpi-label">Surface Water</div><div class="kpi-value" style="font-size:13px">${ai.floodRisk.surfaceWater}</div></div>
    </div>
    ${signalRows.length > 0 ? `<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;margin-bottom:5px">Environmental Signals</p><table style="width:100%;margin-bottom:10px"><tbody>${signalRows}</tbody></table>` : ""}
    ${stepItems.length > 0 ? `<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;margin-bottom:4px">What to Check Before Offering</p><ul style="margin:0;padding-left:16px">${stepItems}</ul>` : ""}
    <p style="font-size:10px;color:#9ca3af;margin-top:8px">Environmental signals are area-level indicators derived from EA flood monitoring, geological mapping, and EPC data. Not a substitute for a formal flood risk assessment, environmental search, or RICS survey.</p>`;
    })()}
  </div>
    <p class="body-text">${ai.floodRisk.detail}</p>
  </div>

  <div class="section">
    <div class="section-label">Council Tax</div>
    <div style="display:flex;gap:24px;margin-bottom:10px">
      <div class="kpi"><div class="kpi-label">${ai.councilTax.confidence === 'Guidance' ? 'Most Common Band' : 'Estimated Band'}</div><div class="kpi-value">${ai.councilTax.mostCommonBand}${ai.councilTax.confidence === 'Estimate' ? ' <span style="font-size:10px;font-weight:600;color:#B45309;background:#FEF3C7;padding:1px 6px;border-radius:9999px;margin-left:4px">est.</span>' : ''}</div></div>
      <div class="kpi"><div class="kpi-label">Annual Cost</div><div class="kpi-value">${ai.councilTax.annualCost}</div></div>
      <div class="kpi"><div class="kpi-label">Local Authority</div><div class="kpi-value" style="font-size:14px">${ai.councilTax.borough}</div></div>
    </div>
    <p class="body-text">${ai.councilTax.note}</p>
    <p class="body-text" style="font-size:11px;color:#6B7280;margin-top:6px">Confirm exact band: <a href="${ai.councilTax.checkerUrl}" style="color:#B8860B">${ai.councilTax.checkerUrl}</a></p>
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
    ${ai.broadband.avgDownloadSpeed !== "Check at address"
      ? `<p style="font-size:11px;color:#9ca3af;margin-top:6px">Ofcom figures are postcode-level averages. Availability and speeds can differ between individual properties — verify at checker.ofcom.org.uk before committing.</p>`
      : `<p style="font-size:11px;color:#9ca3af;margin-top:6px">Verify broadband availability and speeds at your specific address at checker.ofcom.org.uk.</p>`
    }
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

  ${walkScoreVal > 0 ? `
  <div class="section">
    <div class="section-label">Walk Score</div>
    <div style="display:flex;gap:24px;margin-bottom:10px;align-items:center">
      <div class="kpi"><div class="kpi-label">Score</div><div class="kpi-value" style="font-size:28px;color:${walkScoreVal>=70?'#166534':walkScoreVal>=50?'#92400e':'#991b1b'}">${walkScoreVal}</div></div>
      <div class="kpi"><div class="kpi-label">Rating</div><div class="kpi-value" style="font-size:16px">${walkScoreLabel}</div></div>
    </div>
  </div>` : ""}

  ${(ai.nearbyStations && ai.nearbyStations.length > 0) ? (() => {
    const pdfStations = ai.nearbyStations;
    const sorted = pdfStations.slice().sort((a: any, b: any) => a.walkMins - b.walkMins);
    const closest = sorted[0];
    const closestWalk = closest?.walkMins ?? 999;
    const TUBE_LINES_PDF = ["jubilee","central","northern","victoria","piccadilly","bakerloo","district","circle","metropolitan","elizabeth","elizabeth line","hammersmith & city","hammersmith","overground","london overground","dlr"];
    const hasLondonTube = pdfStations.some((s: any) => s.lines.some((l: string) => TUBE_LINES_PDF.includes(l.toLowerCase())));
    const hasElizabethLine = pdfStations.some((s: any) => s.lines.some((l: string) => l.toLowerCase().includes("elizabeth")) || s.modes?.includes("elizabeth-line"));
    const hasNationalRail = pdfStations.some((s: any) => s.modes?.includes("national-rail"));
    const stationsWithin10 = pdfStations.filter((s: any) => s.walkMins <= 10).length;

    const connectivityLabel =
      (hasLondonTube || hasElizabethLine) && closestWalk <= 10 ? "Well connected — London network"
      : hasNationalRail && closestWalk <= 12 ? "Well connected — National Rail"
      : hasNationalRail && closestWalk <= 20 ? "Rail-reliant — good National Rail access"
      : (hasLondonTube || hasElizabethLine) && closestWalk <= 20 ? "Rail-reliant — London network within reach"
      : closestWalk <= 25 ? "Moderate rail access"
      : "Limited rail access — car-dependent";

    const connectivityColor = connectivityLabel.startsWith("Well") ? "#166534" : connectivityLabel.startsWith("Rail") ? "#1d4ed8" : connectivityLabel.startsWith("Moderate") ? "#92400e" : "#991b1b";
    const connectivityBg = connectivityLabel.startsWith("Well") ? "#f0fdf4" : connectivityLabel.startsWith("Rail") ? "#eff6ff" : connectivityLabel.startsWith("Moderate") ? "#fefce8" : "#fef2f2";

    let commutePicture = closest
      ? closestWalk <= 10
        ? `${closest.name} is ${closestWalk} minutes on foot — strong access.${stationsWithin10 > 1 ? ` ${stationsWithin10} stations within a 10-minute walk.` : ""}`
        : closestWalk <= 20
        ? `${closest.name} is ${closestWalk} minutes away — manageable for daily commuting.`
        : `The nearest station is ${closestWalk} minutes away — most commuting will involve a car or bus to the station.`
      : "No nearby stations recorded.";

    const rows = pdfStations.map((s: any) =>
      `<tr><td style="padding:7px 10px 7px 0"><strong style="font-size:12px;color:#111827">${s.name}</strong><br><span style="font-size:10px;color:#9ca3af">${s.modes?.join(", ") ?? ""}</span></td><td style="padding:7px 8px;vertical-align:top"><div style="display:flex;flex-wrap:wrap;gap:3px">${s.lines.slice(0,3).map((l: string) => { const st = ({
        "jubilee":{"bg":"#939598","text":"#fff"},"central":{"bg":"#E32017","text":"#fff"},"northern":{"bg":"#000000","text":"#fff"},"victoria":{"bg":"#0098D4","text":"#fff"},"piccadilly":{"bg":"#003688","text":"#fff"},"bakerloo":{"bg":"#B36305","text":"#fff"},"district":{"bg":"#00782A","text":"#fff"},"circle":{"bg":"#FFD300","text":"#000"},"metropolitan":{"bg":"#9B0056","text":"#fff"},"elizabeth line":{"bg":"#6950a1","text":"#fff"},"elizabeth":{"bg":"#6950a1","text":"#fff"},"hammersmith":{"bg":"#F3A9BB","text":"#000"},"overground":{"bg":"#EE7C0E","text":"#fff"},"london overground":{"bg":"#EE7C0E","text":"#fff"},"dlr":{"bg":"#00A4A7","text":"#fff"}
      })[l.toLowerCase()] ?? {"bg":"#B8860B","text":"#fff"}; return `<span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:9999px;background:${st.bg};color:${st.text}">${l}</span>`; }).join("")}</div></td><td style="text-align:right;padding:7px 0;color:#B8860B;font-weight:600;white-space:nowrap">${s.walkMins} min</td></tr>`
    ).join("");

    // Best for commuting — PDF
    const TUBE_LINES_BF = ["jubilee","central","northern","victoria","piccadilly","bakerloo","district","circle","metropolitan","elizabeth","elizabeth line","hammersmith & city","hammersmith","overground","london overground","dlr"];
    const elizabethStPDF = pdfStations.find((s: any) => s.lines.some((l: string) => l.toLowerCase().includes("elizabeth")));
    const jubileeStPDF = pdfStations.find((s: any) => s.lines.some((l: string) => l.toLowerCase() === "jubilee"));
    const northernStPDF = pdfStations.find((s: any) => s.lines.some((l: string) => l.toLowerCase() === "northern"));
    const centralStPDF = pdfStations.find((s: any) => s.lines.some((l: string) => l.toLowerCase() === "central"));
    const dlrStPDF = pdfStations.find((s: any) => s.lines.some((l: string) => l.toLowerCase() === "dlr"));
    const overgroundStPDF = pdfStations.find((s: any) => s.lines.some((l: string) => l.toLowerCase().includes("overground")));
    const nationalRailStPDF = pdfStations.find((s: any) => s.modes?.includes("national-rail") && !s.lines.some((l: string) => TUBE_LINES_BF.includes(l.toLowerCase())));
    let bestForLinePDF: string | null = null;
    if (elizabethStPDF) bestForLinePDF = `Best for City/Canary Wharf: ${elizabethStPDF.name} (Elizabeth line — Liverpool St, Canary Wharf, Paddington in one seat).`;
    else if (jubileeStPDF) bestForLinePDF = `Best for Canary Wharf/West End: ${jubileeStPDF.name} (Jubilee — Canary Wharf, London Bridge, Westminster, Bond St).`;
    else if (northernStPDF) bestForLinePDF = `Best for City/West End: ${northernStPDF.name} (Northern line — Bank, London Bridge, Waterloo, King's Cross).`;
    else if (centralStPDF) bestForLinePDF = `Best for West End/City: ${centralStPDF.name} (Central line — Oxford Circus, St Paul's, Bank).`;
    else if (dlrStPDF) bestForLinePDF = `Best for Canary Wharf: ${dlrStPDF.name} (DLR — direct to Canary Wharf without changing).`;
    else if (overgroundStPDF) bestForLinePDF = `Best for cross-London travel: ${overgroundStPDF.name} (London Overground — multi-zone without Zone 1).`;
    else if (nationalRailStPDF) bestForLinePDF = `Best for London commuting: ${nationalRailStPDF.name} (National Rail direct services).`;

    return `
    <div class="section">
      <div class="section-label">Nearby Stations</div>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af">Commute picture</span>
          <span style="font-size:10px;font-weight:700;padding:2px 10px;border-radius:9999px;background:${connectivityBg};color:${connectivityColor}">${connectivityLabel}</span>
        </div>
        <p style="font-size:12px;color:#374151;line-height:1.55;margin:0 0 ${bestForLinePDF ? '8px' : '0'} 0">${commutePicture}</p>
        ${bestForLinePDF ? `<p style="font-size:11px;font-weight:600;color:#374151;margin:0"><strong style="color:#9ca3af;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">&#9733; Best for commuting</strong><br>${bestForLinePDF}</p>` : ""}
      </div>
      <table><thead><tr><th>Station</th><th>Lines</th><th style="text-align:right">Walk</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p style="margin-top:8px;font-size:10px;color:#9ca3af">Walk times estimated at 80m/min. Verify door-to-door times via Citymapper or Google Maps.</p>
    </div>`;
  })() : ""}

  ${(ai.nearbySchools && ai.nearbySchools.length > 0) ? (() => {
    const pdfSchools = ai.nearbySchools;
    const within20 = pdfSchools.filter((s: any) => s.walkMins <= 20);
    const outstanding = within20.filter((s: any) => s.ofstedRating === "Outstanding");
    const good = within20.filter((s: any) => s.ofstedRating === "Good");
    const needsImprovement = within20.filter((s: any) => s.ofstedRating?.includes("Improvement"));
    const unrated = within20.filter((s: any) => !s.ofstedRating || s.ofstedRating === "Not rated" || s.ofstedRating === "Not yet rated");
    const desirable = outstanding.length + good.length;
    const hasPrimary = pdfSchools.some((s: any) => s.type === "Primary" || s.type === "Nursery");
    const hasSecondary = pdfSchools.some((s: any) => s.type === "Secondary");
    const hasIndependent = pdfSchools.some((s: any) => s.type === "Independent");

    const pictureLabel =
      outstanding.length >= 1 && desirable >= 2 ? "Strong school provision"
      : desirable >= 2 ? "Solid school provision"
      : desirable === 1 ? "Reasonable school options"
      : needsImprovement.length >= 1 && desirable === 0 ? "Mixed school provision"
      : unrated.length >= 1 && desirable === 0 ? "Unrated — quality uncertain"
      : "Limited school quality nearby";

    const pictureColor = pictureLabel.startsWith("Strong") || pictureLabel.startsWith("Solid") ? "#166534"
      : pictureLabel.startsWith("Reasonable") ? "#1d4ed8"
      : pictureLabel.startsWith("Mixed") || pictureLabel.startsWith("Unrated") ? "#92400e"
      : "#991b1b";
    const pictureBg = pictureLabel.startsWith("Strong") || pictureLabel.startsWith("Solid") ? "#f0fdf4"
      : pictureLabel.startsWith("Reasonable") ? "#eff6ff"
      : pictureLabel.startsWith("Mixed") || pictureLabel.startsWith("Unrated") ? "#fefce8"
      : "#fef2f2";

    let pictureSentence = "";
    if (outstanding.length >= 1) {
      pictureSentence = outstanding[0].name + " is rated Outstanding (Ofsted) and is " + outstanding[0].walkMins + " min away." + (desirable > 1 ? " " + desirable + " schools rated Good or Outstanding are within a 20-minute walk." : "");
    } else if (good.length >= 2) {
      pictureSentence = good.length + " Good-rated schools within a 20-minute walk — solid provision for families.";
    } else if (good.length === 1) {
      pictureSentence = good[0].name + " is rated Good (Ofsted, " + good[0].walkMins + " min). No Outstanding schools in immediate reach.";
    } else if (needsImprovement.length >= 1) {
      pictureSentence = "The nearest rated schools require improvement — families should research options further afield.";
    } else if (unrated.length > 0) {
      pictureSentence = "Nearby schools are not yet Ofsted-rated — verify current inspection status at ofsted.gov.uk before deciding.";
    } else {
      pictureSentence = "School provision exists nearby but Ofsted coverage is incomplete.";
    }

    const typeNote = hasPrimary && hasSecondary && hasIndependent ? "Primary, secondary, and independent options are all represented nearby."
      : hasPrimary && hasSecondary ? "Both primary and secondary schools are within reach."
      : hasPrimary ? "Primarily primary-level coverage — secondary options may require travelling further."
      : hasSecondary ? "Secondary school provision nearby — primary options may be further afield."
      : "A mix of school types is recorded nearby.";

    const ofstedRows = pdfSchools.map((s: any) => {
      const rc = s.ofstedRating === "Outstanding" ? "#166534" : s.ofstedRating === "Good" ? "#1d4ed8" : s.ofstedRating?.includes("Improvement") ? "#92400e" : "#6b7280";
      const rb = s.ofstedRating === "Outstanding" ? "#f0fdf4" : s.ofstedRating === "Good" ? "#eff6ff" : s.ofstedRating?.includes("Improvement") ? "#fefce8" : "#f9fafb";
      return `<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px 10px 8px 0"><strong style="font-size:12px;color:#111827">${s.name}</strong></td><td style="padding:8px 8px;font-size:11px;color:#9ca3af;white-space:nowrap">${s.type}</td><td style="padding:8px 8px;text-align:center"><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:9999px;background:${rb};color:${rc}">${s.ofstedRating || "Not rated"}</span></td><td style="text-align:right;padding:8px 0;color:#B8860B;font-weight:600;white-space:nowrap">${s.walkMins} min</td></tr>`;
    }).join("");

    return `
    <div class="section">
      <div class="section-label">Nearby Schools</div>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af">School picture</span>
          <span style="font-size:10px;font-weight:700;padding:2px 10px;border-radius:9999px;background:${pictureBg};color:${pictureColor}">${pictureLabel}</span>
        </div>
        <p style="font-size:12px;color:#374151;line-height:1.55;margin:0 0 8px 0">${pictureSentence}</p>
        <p style="font-size:11px;color:#9ca3af;margin:0">${typeNote}</p>
        <div style="display:flex;gap:16px;margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb">
          ${outstanding.length > 0 ? `<span style="font-size:11px;color:#166534"><strong>${outstanding.length}</strong> Outstanding</span>` : ""}
          ${good.length > 0 ? `<span style="font-size:11px;color:#1d4ed8"><strong>${good.length}</strong> Good</span>` : ""}
          ${needsImprovement.length > 0 ? `<span style="font-size:11px;color:#92400e"><strong>${needsImprovement.length}</strong> Needs Improvement</span>` : ""}
          ${unrated.length > 0 ? `<span style="font-size:11px;color:#9ca3af"><strong>${unrated.length}</strong> Not rated</span>` : ""}
          <span style="font-size:11px;color:#9ca3af;margin-left:auto">within 20 min walk</span>
        </div>
      </div>
      <table><thead><tr><th>School</th><th>Type</th><th>Ofsted</th><th style="text-align:right">Walk</th></tr></thead>
      <tbody>${ofstedRows}</tbody></table>
      <p style="margin-top:8px;font-size:10px;color:#9ca3af">Ratings from OpenStreetMap. Verify at ofsted.gov.uk. Proximity does not guarantee catchment placement — confirm with school or local authority.</p>
    </div>`;
  })() : ""}

  ${(ai.nearbyAmenities && (ai.nearbyAmenities.supermarkets?.length > 0 || ai.nearbyAmenities.cafesAndRestaurants?.length > 0 || ai.nearbyAmenities.health?.length > 0)) ? (() => {
    const pdfSupermarkets = ai.nearbyAmenities.supermarkets ?? [];
    const pdfCafes = ai.nearbyAmenities.cafesAndRestaurants ?? [];
    const pdfHealth = ai.nearbyAmenities.health ?? [];
    const pdfGreenSpaces = ai.nearbyAmenities.greenSpaces ?? [];

    // Grocery tier
    const premiumGrocersPDF = ["waitrose","marks & spencer","m&s","marks and spencer","whole foods","planet organic"];
    const valueGrocersPDF = ["lidl","aldi","iceland","farmfoods","heron foods"];
    const hasPremiumPDF = pdfSupermarkets.some((s: any) => premiumGrocersPDF.some(p => s.name.toLowerCase().includes(p)));
    const hasValuePDF = pdfSupermarkets.some((s: any) => valueGrocersPDF.some(v => s.name.toLowerCase().includes(v)));
    const hasSupermarketPDF = pdfSupermarkets.length > 0;
    const premiumStorePDF = hasPremiumPDF ? pdfSupermarkets.find((s: any) => premiumGrocersPDF.some(p => s.name.toLowerCase().includes(p))) : null;

    const groceryVerdictPDF = hasPremiumPDF
      ? `${premiumStorePDF?.name ?? "A premium grocer"} gives this area a premium grocery anchor.`
      : hasValuePDF && hasSupermarketPDF ? `Budget grocery options are close by — daily essentials are covered, but no premium supermarket within walking distance.`
      : hasSupermarketPDF ? `Supermarket coverage present but mainstream — no premium anchor within walking distance.`
      : `No supermarkets recorded in the immediate radius.`;

    const cafeVerdictPDF = pdfCafes.length >= 4
      ? `Active café and restaurant scene (${pdfCafes.length} venues) — strong street-level liveability.`
      : pdfCafes.length >= 2 ? `Some dining options nearby — thin but functional.`
      : pdfCafes.length === 1 ? `Limited café presence — one venue recorded. Eating out requires travelling further.`
      : `No cafés or restaurants recorded in the immediate area.`;

    const healthVerdictPDF = pdfHealth.length >= 2
      ? `GP and health facilities within reach (${pdfHealth.length} recorded).`
      : pdfHealth.length === 1 ? `One health facility recorded — check NHS GP finder for new patient availability.`
      : "";

    const amenityScorePDF = (hasSupermarketPDF ? 1 : 0) + (pdfCafes.length >= 2 ? 1 : 0) + (pdfHealth.length >= 1 ? 1 : 0);
    const overallLabelPDF = amenityScorePDF >= 3 ? "Well provisioned" : amenityScorePDF === 2 ? "Partially self-sufficient" : amenityScorePDF === 1 ? "Limited amenity base" : "Sparse — car-dependent";
    const overallColorPDF = amenityScorePDF >= 3 ? "#166534" : amenityScorePDF === 2 ? "#1d4ed8" : amenityScorePDF === 1 ? "#92400e" : "#991b1b";
    const overallBgPDF = amenityScorePDF >= 3 ? "#f0fdf4" : amenityScorePDF === 2 ? "#eff6ff" : amenityScorePDF === 1 ? "#fefce8" : "#fef2f2";
    const highStreetPDF = amenityScorePDF >= 3 ? "Overall: well-provisioned for daily living. Essentials, eating options, and health services accessible on foot or nearby." : amenityScorePDF === 2 ? "Overall: partially self-sufficient — most needs met but one or two essentials require travelling further." : amenityScorePDF === 1 ? "Overall: limited amenity base. Most day-to-day needs require a car or trip to a nearby town centre." : "Overall: sparse amenity coverage within the data radius. Verify what's available on foot before committing.";

    const supermarketRows = pdfSupermarkets.map((s: any) =>
      `<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:5px 10px 5px 0;font-size:12px;color:#111827">${s.name}</td><td style="padding:5px 8px;font-size:11px;color:#9ca3af">${s.type}</td><td style="text-align:right;padding:5px 0;color:#B8860B;font-size:11px;font-weight:600">${s.distanceMetres}m</td></tr>`
    ).join("");
    const cafeRows = pdfCafes.slice(0, 6).map((s: any) =>
      `<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:5px 10px 5px 0;font-size:12px;color:#111827">${s.name}</td><td style="padding:5px 8px;font-size:11px;color:#9ca3af">${s.type}</td><td style="text-align:right;padding:5px 0;color:#B8860B;font-size:11px;font-weight:600">${s.distanceMetres}m</td></tr>`
    ).join("");
    const greenRows = pdfGreenSpaces.slice(0, 4).map((s: any) =>
      `<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:5px 10px 5px 0;font-size:12px;color:#111827">${s.name}</td><td style="text-align:right;padding:5px 0;color:#B8860B;font-size:11px;font-weight:600">${s.walkMins} min</td></tr>`
    ).join("");

    return `
    <div class="section">
      <div class="section-label">Local Amenities</div>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af">Amenity picture</span>
          <span style="font-size:10px;font-weight:700;padding:2px 10px;border-radius:9999px;background:${overallBgPDF};color:${overallColorPDF}">${overallLabelPDF}</span>
        </div>
        ${hasSupermarketPDF ? `<p style="font-size:12px;color:#374151;line-height:1.5;margin:0 0 5px 0">${groceryVerdictPDF}</p>` : ""}
        <p style="font-size:12px;color:#374151;line-height:1.5;margin:0 0 5px 0">${cafeVerdictPDF}</p>
        ${healthVerdictPDF ? `<p style="font-size:11px;color:#6b7280;margin:0 0 6px 0">${healthVerdictPDF}</p>` : ""}
        <p style="font-size:11px;color:#6b7280;margin:0;padding-top:6px;border-top:1px solid #e5e7eb">${highStreetPDF}</p>
      </div>
      ${pdfSupermarkets.length > 0 ? `<p style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:5px">Supermarkets & Shops</p><table><tbody>${supermarketRows}</tbody></table>` : ""}
      ${pdfCafes.length > 0 ? `<p style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;margin:10px 0 5px 0">Cafés & Restaurants</p><table><tbody>${cafeRows}</tbody></table>${pdfCafes.length > 6 ? `<p style="font-size:10px;color:#9ca3af;margin-top:4px">(${pdfCafes.length - 6} additional venues not shown)</p>` : ""}` : ""}
      ${pdfGreenSpaces.length > 0 ? `<p style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;margin:10px 0 5px 0">Parks & Green Spaces</p><table><tbody>${greenRows}</tbody></table>` : ""}
      <p style="margin-top:8px;font-size:10px;color:#9ca3af">Source: OpenStreetMap. Coverage is typically accurate but may not include every local business or amenity.</p>
    </div>`;
  })() : ""}

  ${crimeSection}

  ${(() => {
    const pdfBullets = ai.neighbourhoodProfile.residentSentimentBullets;
    const pdfCoverageThin = ai.neighbourhoodProfile.coverageThin;
    if (!pdfBullets || pdfBullets.length === 0) return "";
    const typeConfig: Record<string, { label: string; bg: string; color: string; borderColor: string }> = {
      "positive":  { label: "Positive",       bg: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" },
      "trade-off": { label: "Trade-off",      bg: "#fffbeb", color: "#92400e", borderColor: "#fde68a" },
      "lifestyle": { label: "Lifestyle note", bg: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" },
      "caution":   { label: "Buyer caution",  bg: "#fef2f2", color: "#991b1b", borderColor: "#fecaca" },
      "note":      { label: "Note",           bg: "#f9fafb", color: "#6b7280", borderColor: "#e5e7eb" },
    };
    const bulletRows = pdfBullets.map((b: { type: string; text: string }) => {
      const cfg = typeConfig[b.type] ?? typeConfig["note"];
      return `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">
        <span style="flex-shrink:0;margin-top:1px;font-size:9px;font-weight:700;padding:2px 8px;border-radius:9999px;background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.borderColor};white-space:nowrap">${cfg.label}</span>
        <p style="font-size:12px;color:#374151;line-height:1.6;margin:0">${b.text}</p>
      </div>`;
    }).join("");
    return `
    <div class="section">
      <div class="section-label">What Residents Say</div>
      ${pdfCoverageThin ? `<p style="font-size:10px;color:#9ca3af;margin-bottom:10px;font-style:italic">Coverage limited — bullets derived from available data signals rather than curated resident feedback.</p>` : ""}
      ${bulletRows}
    </div>`;
  })()
  }

  <div class="section">
    <div class="section-label">Market Outlook</div>
    <p style="font-size:11px;color:#6b7280;margin-bottom:12px">Market signals are derived from Land Registry transaction data — not a prediction or forecast. Rental yield is a gross indicative range based on area tier benchmarks and ONS data. Not financial advice.</p>
    <div class="two-col" style="margin-bottom:16px">
      <div class="kpi"><div class="kpi-label">Recent market signals</div><div class="kpi-value" style="font-size:13px">${ai.investmentOutlook.growthForecast}</div></div>
      <div class="kpi"><div class="kpi-label">Rental yield estimate</div><div class="kpi-value" style="font-size:16px">${ai.investmentOutlook.rentalYieldEstimate}</div></div>
    </div>
    <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Market flags</p>
    <ul>${riskFlags}</ul>
  </div>

  <div class="section">
    <div class="section-label">Verdict</div>
    <div class="verdict">${ai.verdict}</div>
  </div>
  ${hs2Flags}

  <div class="footer">
    <span>${companyName || "LuxProperty.ai"} — Confidential Property Report</span>
    <span>Data: HM Land Registry · Postcodes.io · data.police.uk · Ofcom · ONS · Environment Agency · Ofsted. For due diligence reference only — not a substitute for a professional survey.</span>
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

// ── TfL / rail line colour mapping ───────────────────────────────────────────
const TFL_LINE_COLOURS: Record<string, { bg: string; text: string }> = {
  "elizabeth line":    { bg: "#6950a1", text: "#fff" },
  "elizabeth":         { bg: "#6950a1", text: "#fff" },
  "jubilee":           { bg: "#868f98", text: "#fff" },
  "central":           { bg: "#dc241f", text: "#fff" },
  "northern":          { bg: "#000000", text: "#fff" },
  "victoria":          { bg: "#0098d4", text: "#fff" },
  "piccadilly":        { bg: "#003688", text: "#fff" },
  "bakerloo":          { bg: "#b36305", text: "#fff" },
  "district":          { bg: "#00782a", text: "#fff" },
  "circle":            { bg: "#ffd300", text: "#1a1612" },
  "hammersmith & city": { bg: "#f3a9bb", text: "#1a1612" },
  "hammersmith":       { bg: "#f3a9bb", text: "#1a1612" },
  "metropolitan":      { bg: "#9b0056", text: "#fff" },
  "overground":        { bg: "#ee7c0e", text: "#fff" },
  "london overground": { bg: "#ee7c0e", text: "#fff" },
  "dlr":               { bg: "#00a4a7", text: "#fff" },
  "thameslink":        { bg: "#da0a43", text: "#fff" },
  "southeastern":      { bg: "#1c3f73", text: "#fff" },
  "great western":     { bg: "#0a493e", text: "#fff" },
  "chiltern":          { bg: "#3f4d9f", text: "#fff" },
  "c2c":               { bg: "#b2195b", text: "#fff" },
  "crossrail":         { bg: "#6950a1", text: "#fff" },
  "national rail":     { bg: "#1c3f73", text: "#fff" },
};

function getLineStyle(line: string): { bg: string; text: string } {
  const key = line.toLowerCase().trim();
  return TFL_LINE_COLOURS[key] ?? { bg: "#B8860B", text: "#fff" };
}

// ── Strengths & Considerations ────────────────────────────────────────────────
// Derived entirely from existing report data — no extra API calls.
interface SCSPoint {
  label: string;
  detail: string;
}

function deriveStrengthsAndConsiderations(ai: BriefReport["areaIntelligence"]): {
  strengths: SCSPoint[];
  considerations: SCSPoint[];
} {
  const strengths: SCSPoint[] = [];
  const considerations: SCSPoint[] = [];

  // ── STRENGTHS ─────────────────────────────────────────────────────────────

  // Price growth
  const yoy = ai.marketOverview.priceChangeYoY;
  const yoyNum = parseFloat(yoy.replace(/[^\d.\-]/g, ""));
  if (!isNaN(yoyNum) && yoyNum >= 4) {
    strengths.push({
      label: "Strong price growth",
      detail: `Values up ${yoy} year-on-year — above the national average, suggesting sustained buyer demand.`,
    });
  } else if (!isNaN(yoyNum) && yoyNum > 0) {
    strengths.push({
      label: "Steady price appreciation",
      detail: `Values have grown ${yoy} over the past year, indicating a stable, demand-led market.`,
    });
  }

  // Good Ofsted school nearby
  const outstandingSchool = ai.nearbySchools?.find(s => s.ofstedRating === "Outstanding");
  const goodSchool = ai.nearbySchools?.find(s => s.ofstedRating === "Good");
  const topSchool = outstandingSchool ?? goodSchool;
  if (topSchool) {
    strengths.push({
      label: `${topSchool.ofstedRating} school within reach`,
      detail: `${topSchool.name} (${topSchool.type}) is rated ${topSchool.ofstedRating} by Ofsted and is a ${topSchool.walkMins}-minute walk.`,
    });
  }

  // Strong transport
  const transportRating = ai.neighbourhoodProfile?.transportRating ?? 0;
  const closestStation = ai.nearbyStations?.slice().sort((a, b) => a.walkMins - b.walkMins)?.[0];
  const stationWalkMins = closestStation?.walkMins ?? 999;
  const isTransitLight = transportRating < 5 || stationWalkMins > 20;
  const cafeCount = ai.nearbyAmenities?.cafesAndRestaurants?.length ?? 0;
  const isAmenityLight = cafeCount === 0;
  const hasBroadbandStrength = ai.broadband?.rating === "Excellent" || ai.broadband?.rating === "Very Good";
  if (transportRating >= 7 || (closestStation && stationWalkMins <= 8)) {
    const stationNote = closestStation
      ? `${closestStation.name} is ${stationWalkMins} minutes on foot.`
      : "Several stations are within easy walking distance.";
    strengths.push({
      label: "Well connected for commuters",
      detail: stationNote + (closestStation?.lines?.length ? ` Lines: ${closestStation.lines.slice(0, 2).join(", ")}.` : ""),
    });
  }

  // Low flood risk
  if (ai.floodRisk?.riskBadge === "Low") {
    strengths.push({
      label: "Low flood risk",
      detail: `The Environment Agency classifies this area as ${ai.floodRisk.zone} — a genuine plus for long-term insurability and resale.`,
    });
  }

  // Good broadband — for transit-light areas, frame as remote-working viability
  if (ai.broadband?.rating === "Excellent" || ai.broadband?.rating === "Very Good") {
    const broadbandDetail = isTransitLight
      ? `Average download speeds of ${ai.broadband.avgDownloadSpeed}, with ${ai.broadband.fullFibreAvailability} full-fibre availability — a meaningful upside if you work from home.`
      : `Average download speeds of ${ai.broadband.avgDownloadSpeed}, with ${ai.broadband.fullFibreAvailability} full-fibre availability.`;
    strengths.push({
      label: isTransitLight ? "Strong broadband — well suited to home working" : `${ai.broadband.rating.toLowerCase()} broadband`,
      detail: broadbandDetail,
    });
  }

  // Good air quality
  if (ai.airQuality?.rating === "Good") {
    strengths.push({
      label: "Good air quality",
      detail: `NO₂ and PM2.5 readings are within WHO guidelines — important for families with young children.`,
    });
  }

  // Green space nearby
  const closestPark = ai.nearbyAmenities?.greenSpaces?.[0];
  if (closestPark && closestPark.walkMins <= 8) {
    strengths.push({
      label: "Green space on your doorstep",
      detail: `${closestPark.name} is ${closestPark.walkMins} minutes away — ideal for families, dog walkers, and weekend morning runs.`,
    });
  }

  // Supply tightness
  const supply = ai.marketOverview.supplyLevel?.toLowerCase();
  if (supply && (supply.includes("low") || supply.includes("tight") || supply.includes("constrained"))) {
    strengths.push({
      label: "Constrained supply",
      detail: `Stock levels are ${ai.marketOverview.supplyLevel}, which tends to support prices and limit negotiating room for sellers.`,
    });
  }

  // ── CONSIDERATIONS ────────────────────────────────────────────────────────

  // Flood risk
  if (ai.floodRisk?.riskBadge === "High") {
    considerations.push({
      label: "High flood risk — check insurance",
      detail: `Classified as ${ai.floodRisk.zone}. Flood insurance may be harder to obtain or more expensive — verify with your broker before proceeding.`,
    });
  } else if (ai.floodRisk?.riskBadge === "Medium") {
    considerations.push({
      label: "Medium flood risk",
      detail: `Classified as ${ai.floodRisk.zone}. Worth requesting a specific flood risk assessment and checking the Environment Agency's interactive map.`,
    });
  }

  // Price falling
  if (!isNaN(yoyNum) && yoyNum < 0) {
    considerations.push({
      label: "Prices have softened",
      detail: `Values are ${yoy} year-on-year. This could be a buying opportunity, or a sign of weaker local demand — worth exploring the cause.`,
    });
  }

  // Risk flags from investmentOutlook
  if (ai.investmentOutlook?.riskFlags?.length > 0) {
    ai.investmentOutlook.riskFlags.slice(0, 2).forEach(flag => {
      considerations.push({ label: "Risk flag", detail: flag });
    });
  }

  // High crime
  const safetyRating = ai.neighbourhoodProfile?.safetyRating ?? 100;
  if (safetyRating < 40 && ai.crimeStats?.totalCrimesPerMonth > 0) {
    const topCat = ai.crimeStats.topCategories?.[0];
    considerations.push({
      label: "Above-average crime levels",
      detail: `${ai.crimeStats.totalCrimesPerMonth} crimes recorded per month in this area.${ topCat ? ` Most common: ${topCat.category} (${topCat.pct}%).` : ""} ${ai.crimeStats.vsNationalNote}`,
    });
  }

  // Poor air quality
  if (ai.airQuality?.rating === "Poor" || ai.airQuality?.rating === "Very Poor") {
    considerations.push({
      label: `${ai.airQuality.rating} air quality`,
      detail: `NO₂ at ${ai.airQuality.no2Level} — above WHO guidelines. Relevant if you have young children, respiratory conditions, or simply want fresh air at home.`,
    });
  }

  // Slow market / high days on market
  const dom = ai.marketOverview.avgDaysOnMarket;
  if (typeof dom === "number" && dom > 90) {
    considerations.push({
      label: "Properties sitting longer",
      detail: `Homes are taking an average of ${dom} days to sell — a signal that demand may be softer, which could work in your favour at negotiation.`,
    });
  }

  // No good schools nearby
  const hasDecentSchool = ai.nearbySchools?.some(s =>
    (s.ofstedRating === "Outstanding" || s.ofstedRating === "Good") && s.walkMins <= 20
  );
  if (ai.nearbySchools?.length > 0 && !hasDecentSchool) {
    considerations.push({
      label: "School ratings to consider",
      detail: `No Outstanding or Good-rated Ofsted schools within a 20-minute walk. Worth checking the wider catchment if schools are a priority.`,
    });
  }

  // Rail access limited — flag car dependency
  if (isTransitLight) {
    const stationNote = stationWalkMins < 999
      ? `The nearest station is a ${stationWalkMins}-minute walk — most daily journeys will require a car.`
      : "There is no station within easy walking distance — car dependency is high for commuting.";
    considerations.push({
      label: "Rail access limited",
      detail: stationNote + (hasBroadbandStrength ? " Strong broadband partly offsets this for home workers." : ""),
    });
  }

  // Lighter amenity density — distinguish essentials vs lifestyle
  if (isAmenityLight) {
    considerations.push({
      label: "Lighter amenity density",
      detail: "Few walkable cafés or restaurants in the immediate area. Daily essentials are covered, but lifestyle options — coffee shops, dining, evening venues — are limited within walking distance.",
    });
  }

  // Cap to 3 each for readability
  return {
    strengths: strengths.slice(0, 3),
    considerations: considerations.slice(0, 3),
  };
}

function StrengthsAndConsiderations({ ai, standalone = true }: { ai: BriefReport["areaIntelligence"]; standalone?: boolean }) {
  const { strengths, considerations } = deriveStrengthsAndConsiderations(ai);

  if (strengths.length === 0 && considerations.length === 0) return null;

  const inner = (
    <>
      {standalone && (
        <div className="flex items-center gap-2 mb-5">
          <BadgeCheck className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Strengths &amp; Considerations</h3>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Strengths */}
        {strengths.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-green-700 dark:text-green-400 mb-3 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />
              What works in your favour
            </p>
            <ul className="space-y-4">
              {strengths.map((s, i) => (
                <li key={i} className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground leading-snug">{s.label}</span>
                  <span className="text-xs text-muted-foreground leading-relaxed">{s.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Considerations */}
        {considerations.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              Worth thinking about
            </p>
            <ul className="space-y-4">
              {considerations.map((c, i) => (
                <li key={i} className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground leading-snug">{c.label}</span>
                  <span className="text-xs text-muted-foreground leading-relaxed">{c.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground/70 mt-5 pt-4 border-t border-border/40">
        Synthesised from Land Registry, Environment Agency, Ofsted, and ONS data in this report. Not a substitute for a professional survey.
      </p>
    </>
  );

  return standalone ? (
    <Card className="p-5 sm:p-6" data-testid="section-strengths-considerations">{inner}</Card>
  ) : (
    <div data-testid="section-strengths-considerations">{inner}</div>
  );
}

// ── Resident Sentiment Bullets Block ──────────────────────────────────────────
type SentimentBullet = {
  type: "positive" | "trade-off" | "lifestyle" | "caution" | "note";
  text: string;
};

const SENTIMENT_TYPE_META: Record<SentimentBullet["type"], {
  label: string;
  color: string;
  dot: string;
}> = {
  "positive":  { label: "Positive",      color: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25", dot: "bg-emerald-500" },
  "trade-off": { label: "Trade-off",     color: "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/25",         dot: "bg-amber-500" },
  "lifestyle": { label: "Lifestyle note",color: "text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/25",             dot: "bg-blue-500" },
  "caution":   { label: "Buyer caution", color: "text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/25",                 dot: "bg-red-500" },
  "note":      { label: "Note",          color: "text-muted-foreground bg-muted/40 border-border/40",                             dot: "bg-muted-foreground" },
};

/** Full 3–5 bullet version — Professional tier */
function ResidentSentimentBlock({ ai }: { ai: BriefReport["areaIntelligence"] }) {
  const bullets = ai.neighbourhoodProfile.residentSentimentBullets;
  const coverageThin = ai.neighbourhoodProfile.coverageThin;
  if (!bullets || bullets.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">What Residents Say</span>
        {coverageThin && (
          <span className="ml-auto text-[10px] text-muted-foreground/60 italic">Limited coverage</span>
        )}
      </div>
      <div className={`flex flex-col gap-2 ${coverageThin ? "opacity-75" : ""}`}>
        {bullets.map((bullet, i) => {
          const meta = SENTIMENT_TYPE_META[bullet.type];
          return (
            <div key={i} className="flex gap-2.5 items-start">
              <span className={`inline-flex items-center gap-1 shrink-0 mt-[3px] px-1.5 py-0.5 rounded border text-[10px] font-semibold ${meta.color}`}>
                {meta.label}
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed">{bullet.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Teaser version — Explorer tier (max 2 bullets: positive + caution) */
function ResidentSentimentTeaser({ ai }: { ai: BriefReport["areaIntelligence"] }) {
  const bullets = ai.neighbourhoodProfile.residentSentimentBullets;
  if (!bullets || bullets.length === 0) return null;

  // Pick one positive and one caution/trade-off for the teaser
  const positive = bullets.find(b => b.type === "positive");
  const caution  = bullets.find(b => b.type === "caution") || bullets.find(b => b.type === "trade-off");
  const teaser   = [positive, caution].filter(Boolean) as SentimentBullet[];

  if (teaser.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">What Residents Say</span>
        <span className="ml-auto text-[10px] text-muted-foreground/50">Preview</span>
      </div>
      <div className="flex flex-col gap-2">
        {teaser.map((bullet, i) => {
          const meta = SENTIMENT_TYPE_META[bullet.type];
          return (
            <div key={i} className="flex gap-2.5 items-start">
              <span className={`inline-flex items-center gap-1 shrink-0 mt-[3px] px-1.5 py-0.5 rounded border text-[10px] font-semibold ${meta.color}`}>
                {meta.label}
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{bullet.text}</p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground/50 pt-1">
        Full resident sentiment — 3–5 categorised bullets — available in{" "}
        <Link href="/pricing"><span className="text-primary underline underline-offset-2">Professional ↗</span></Link>
      </p>
    </div>
  );
}

// ── At a Glance lifestyle panel ───────────────────────────────────────────────
function LifestyleGlance({ ai, report }: { ai: BriefReport["areaIntelligence"]; report: BriefReport }) {
  // Pick best school
  const bestSchool = ai.nearbySchools?.find(s =>
    s.ofstedRating === "Outstanding" || s.ofstedRating === "Good"
  ) ?? ai.nearbySchools?.[0];

  // Pick nearest station
  const closestStation = ai.nearbyStations?.
    slice().sort((a, b) => a.walkMins - b.walkMins)?.[0];

  // Pick nearest green space
  const closestPark = ai.nearbyAmenities?.greenSpaces?.[0];

  // Safety
  const safetyRating = ai.neighbourhoodProfile?.safetyRating ?? 0;
  const safetyLabel =
    safetyRating >= 80 ? "Very Safe" :
    safetyRating >= 60 ? "Generally Safe" :
    safetyRating >= 40 ? "Average" : "Below Average";
  const safetyColour =
    safetyRating >= 80 ? "text-green-700 dark:text-green-400" :
    safetyRating >= 60 ? "text-blue-700 dark:text-blue-400" :
    safetyRating >= 40 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400";

  // Local feel — pull from character or area name
  const localFeel = ai.neighbourhoodProfile?.character
    ? ai.neighbourhoodProfile.character.split(".")[0] + "."
    : `${ai.area} is a well-connected residential area.`;

  const hasAnyData = bestSchool || closestStation || closestPark;
  if (!hasAnyData) return null;

  return (
    <Card className="p-5 sm:p-6 border-primary/20 bg-gradient-to-br from-card to-primary/[0.03]" data-testid="section-lifestyle-glance">
      <div className="flex items-center gap-2 mb-4">
        <Home className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">At a Glance — Life Here</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {/* Schools */}
        {bestSchool && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Schools</span>
            </div>
            <p className="text-sm font-semibold text-foreground leading-tight">{bestSchool.name}</p>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full self-start ${
              bestSchool.ofstedRating === "Outstanding" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
              bestSchool.ofstedRating === "Good" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400" :
              "bg-muted text-muted-foreground"
            }`}>{bestSchool.ofstedRating}</span>
            <p className="text-xs text-muted-foreground">{bestSchool.walkMins} min walk</p>
          </div>
        )}

        {/* Commute */}
        {closestStation && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Train className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Commute</span>
            </div>
            <p className="text-sm font-semibold text-foreground leading-tight">{closestStation.name}</p>
            <div className="flex flex-wrap gap-1">
              {closestStation.lines.slice(0, 2).map((line, j) => {
                const style = getLineStyle(line);
                return (
                  <span key={j} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: style.bg, color: style.text }}>{line}</span>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{closestStation.walkMins} min walk</p>
          </div>
        )}

        {/* Safety */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Safety</span>
          </div>
          <p className={`text-sm font-semibold leading-tight ${safetyColour}`}>{safetyLabel}</p>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
            <div
              className={`h-full rounded-full transition-all ${
                safetyRating >= 80 ? "bg-green-500" :
                safetyRating >= 60 ? "bg-blue-500" :
                safetyRating >= 40 ? "bg-amber-500" : "bg-red-500"
              }`}
              style={{ width: `${safetyRating}%` }}
            />
          </div>
          {ai.crimeStats && (
            <p className="text-xs text-muted-foreground">{ai.crimeStats.totalCrimesPerMonth} crimes/mo</p>
          )}
        </div>

        {/* Green Space */}
        {closestPark && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Leaf className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Green Space</span>
            </div>
            <p className="text-sm font-semibold text-foreground leading-tight">{closestPark.name}</p>
            <p className="text-xs text-muted-foreground">{closestPark.walkMins} min walk</p>
          </div>
        )}
      </div>

      {/* Local feel sentence */}
      <div className="border-t border-border/40 pt-3 mt-1">
        <p className="text-xs text-muted-foreground leading-relaxed italic">"{localFeel}"</p>
      </div>
    </Card>
  );
}


// ── Lifestyle Fit Block ───────────────────────────────────────────────────────────────────
// Buyer-first lifestyle scoring across five dimensions. Each category is banded
// (Excellent / Good / Mixed / Limited) with a plain-English explanation grounded
// in actual signals from the brief — not generic neighbourhood copy.

type LifestyleCategory = "Family fit" | "Commute fit" | "Convenience fit" | "Green space fit" | "Long-term appeal";

const LIFESTYLE_CATEGORY_META: Record<
  LifestyleCategory,
  { icon: React.ReactNode; label: string; description: string }
> = {
  "Family fit": {
    icon: <GraduationCap className="h-4 w-4" />,
    label: "Family Fit",
    description: "Schools, safety & green space",
  },
  "Commute fit": {
    icon: <Train className="h-4 w-4" />,
    label: "Commute Fit",
    description: "Stations, lines & walk time",
  },
  "Convenience fit": {
    icon: <ShoppingCart className="h-4 w-4" />,
    label: "Convenience Fit",
    description: "Day-to-day essentials on foot",
  },
  "Green space fit": {
    icon: <Leaf className="h-4 w-4" />,
    label: "Green Space Fit",
    description: "Parks & usable outdoor access",
  },
  "Long-term appeal": {
    icon: <TrendingUp className="h-4 w-4" />,
    label: "Long-term Appeal",
    description: "Desirability signals & resale strength",
  },
};

const SCORE_CONFIG = {
  Excellent: {
    bar: "bg-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    dot:  "bg-emerald-500",
    barWidth: "w-full",
  },
  Good: {
    bar: "bg-blue-500",
    pill: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    dot:  "bg-blue-500",
    barWidth: "w-3/4",
  },
  Mixed: {
    bar: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    dot:  "bg-amber-500",
    barWidth: "w-2/4",
  },
  Limited: {
    bar: "bg-red-400",
    pill: "bg-red-400/15 text-red-700 dark:text-red-400 border-red-400/30",
    dot:  "bg-red-400",
    barWidth: "w-1/4",
  },
} as const;

function LifestyleFitBlock({ ai }: { ai: BriefReport["areaIntelligence"] }) {
  const fit = ai.lifestyleFit;
  if (!fit || fit.length === 0) return null;

  // Count score distribution for summary line
  const counts = { Excellent: 0, Good: 0, Mixed: 0, Limited: 0 };
  fit.forEach(f => { counts[f.score]++; });
  const topLabel = counts.Excellent >= 3
    ? "Strong across the board"
    : counts.Excellent + counts.Good >= 4
    ? "Mostly positive"
    : counts.Mixed + counts.Limited >= 3
    ? "Several trade-offs to weigh"
    : "Mixed picture";

  return (
    <Card className="overflow-hidden border-primary/20" data-testid="section-lifestyle-fit">
      {/* Header band */}
      <div className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6 border-b border-border/40">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Lifestyle Fit
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">{topLabel}</span>
        </div>
        {/* Compact score strip */}
        <div className="mt-3 flex gap-2 flex-wrap">
          {fit.map(item => {
            const cfg = SCORE_CONFIG[item.score];
            const meta = LIFESTYLE_CATEGORY_META[item.category as LifestyleCategory];
            return (
              <div
                key={item.category}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.pill}`}
                title={item.caption}
              >
                <span className="opacity-70">{meta?.icon}</span>
                <span>{meta?.label ?? item.category}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score rows */}
      <div className="divide-y divide-border/30">
        {fit.map((item) => {
          const meta   = LIFESTYLE_CATEGORY_META[item.category as LifestyleCategory];
          const cfg    = SCORE_CONFIG[item.score];
          return (
            <div key={item.category} className="px-5 py-4 sm:px-6">
              <div className="flex items-start gap-3 sm:gap-4">
                {/* Left column: icon + label + bar */}
                <div className="shrink-0 w-[140px] sm:w-[160px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`shrink-0 ${cfg.pill.split(" ")[1]}`}>{meta?.icon}</span>
                    <span className="text-[12px] font-semibold text-foreground leading-tight">
                      {meta?.label ?? item.category}
                    </span>
                  </div>
                  {/* Score bar */}
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${cfg.bar} ${cfg.barWidth} rounded-full transition-all`} />
                  </div>
                  <div className="mt-1.5">
                    <span className={`inline-flex items-center px-1.5 py-px rounded text-[10px] font-bold border ${cfg.pill}`}>
                      {item.score}
                    </span>
                  </div>
                </div>

                {/* Right column: sub-description + caption */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60 font-semibold mb-1">
                    {meta?.description}
                  </p>
                  <p className="text-[12px] text-foreground/85 leading-relaxed">
                    {item.caption}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 pt-3 sm:px-6 border-t border-border/30 flex flex-col gap-2.5">
        <p className="text-[10px] text-muted-foreground/50 leading-snug">
          Scores are derived from Ofsted ratings, station data, Overpass amenity data, and UK crime statistics sourced for this brief. They reflect the area as a whole — individual streets may vary.
        </p>
        {ai.briefConfidence && (
          <ConfidencePill
            level={ai.briefConfidence.lifestyleFit}
            note={ai.briefConfidence.lifestyleFitNote}
          />
        )}
      </div>
    </Card>
  );
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
  // Email-captured visitors see Market Outlook without a paid plan
  const { captured: emailCaptured } = useEmailCaptured();
  const hasMarketOutlookAccess = isPaid || emailCaptured;
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
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
            <h2 className="font-serif text-xl mb-2">Report not found</h2>
            <p className="text-sm text-muted-foreground mb-6">
              We couldn't load this report.
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

  // ── Signed-out gate ─────────────────────────────────────────────────────────
  // Signed-out users see the report title + a static locked teaser.
  // No report content (no ai.* data) is rendered or mounted for !user.
  if (!user) {
    const reportTitle = report.queryType === "address" && report.propertyDeepDive
      ? `Property Report — ${report.query}`
      : `${report.areaIntelligence.location} Property Report — ${report.areaIntelligence.area}`;
    const isPropertyBrief = report.queryType === "address" && !!report.propertyDeepDive;

    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                New search
              </Button>
            </Link>
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-semibold">
                  {isPropertyBrief ? "Property Brief" : "Area Brief"}
                </Badge>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl tracking-tight leading-tight mb-2">
                {reportTitle}
              </h1>
            </div>

            {/* Locked gate — purely static, zero real data */}
            <div
              className="relative overflow-hidden rounded-xl border"
              style={{ background: "#1A1612", borderColor: "#2A2420" }}
              data-testid="section-signed-out-gate"
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background: "linear-gradient(90deg, transparent, #B8860B 40%, #B8860B 60%, transparent)",
                  opacity: 0.5,
                }}
              />
              <div className="px-6 pt-8 pb-4 space-y-4" aria-hidden="true">
                {[88, 72, 60, 80, 55].map((w, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="h-2 rounded" style={{ background: "#2A2420", width: `${w}%` }} />
                    <div className="h-2 rounded ml-auto" style={{ background: "#2A2420", width: "15%" }} />
                  </div>
                ))}
                <div className="pt-2 space-y-2">
                  <div className="h-1.5 rounded" style={{ background: "#2A2420", width: "90%" }} />
                  <div className="h-1.5 rounded" style={{ background: "#2A2420", width: "76%" }} />
                  <div className="h-1.5 rounded" style={{ background: "#2A2420", width: "62%" }} />
                </div>
              </div>
              <div className="px-6 pb-6">
                <div
                  className="rounded-xl px-5 py-5 text-center"
                  style={{ background: "rgba(42,36,32,0.85)", border: "1px solid #2A2420" }}
                >
                  <div
                    className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ background: "rgba(184,134,11,0.12)", border: "1px solid rgba(184,134,11,0.25)" }}
                  >
                    <Lock className="h-5 w-5" style={{ color: "#B8860B" }} />
                  </div>
                  <h3
                    className="text-base font-semibold mb-1.5"
                    style={{ color: "#FAF8F4", fontFamily: "'Instrument Serif', Georgia, serif" }}
                  >
                    Sign in to view this report
                  </h3>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: "#9A9490" }}>
                    Create a free account or sign in to access property reports. Explorer is free — Professional and Investor unlock deeper analysis.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => { setAuthTab("signup"); setAuthOpen(true); }}
                      className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
                      style={{ background: "#B8860B", color: "#FAF8F4" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#9A7A0A")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#B8860B")}
                      data-testid="button-signup-gate"
                    >
                      Create free account
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthTab("signin"); setAuthOpen(true); }}
                      className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
                      style={{ background: "transparent", color: "#FAF8F4", border: "1px solid #2A2420" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                      data-testid="button-signin-gate"
                    >
                      Sign in
                    </button>
                  </div>
                  <p className="mt-3 text-[11px]" style={{ color: "#5A5450" }}>
                    Free — no payment required to view reports
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
        <AuthModal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          defaultTab={authTab}
        />
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
                ? `Property Report — ${report.query}`
                : `${ai.location} Property Report — ${ai.area}`}
            </h1>

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

          <div className="space-y-0">

            {/* ═══════════════════════════════════════════════════════════════
                LAYER 1 — DECISION SUMMARY
                Always visible. No click required.
                Answers: "Should I keep looking at this?" in under 30 seconds.
            ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-4 mb-6">

              {/* Shortlist Verdict — top signal, Professional+ */}
              {isPaid && ai.shortlistVerdict && (
                <ShortlistVerdictBlock sv={ai.shortlistVerdict} />
              )}

              {/* What Would Worry Me — risk-first framing, Professional+ */}
              {isPaid && ai.worryBox && (
                <WhatWouldWorryMe worryBox={ai.worryBox} />
              )}

              {/* Buyer Verdict — structured would-I-buy decision, Professional+ */}
              {isPaid && (
                <BuyerVerdictBlock ai={ai} />
              )}

              {/* Red Flag Summary — Professional+ */}
              {isPaid && (
                <RedFlagSummaryBlock flags={ai.redFlags ?? []} />
              )}

              {/* Explorer Verdict — shown to all users */}
              <ExplorerVerdictBlock explorerVerdict={ai.explorerVerdict} />

              {/* ── Headline KPI strip ── always visible */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl border border-border/40 bg-card p-4 sm:p-5">
                <KpiValue label="Average Price" value={ai.marketOverview.averagePrice} />
                <KpiValue label="Price Change YoY" value={ai.marketOverview.priceChangeYoY} />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Time on Market <EstimateTag /></p>
                  <p className="font-serif text-2xl tracking-tight text-foreground">{ai.marketOverview.avgDaysOnMarket}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Supply Level <EstimateTag /></p>
                  <p className="font-serif text-2xl tracking-tight text-foreground">{ai.marketOverview.supplyLevel}</p>
                </div>
              </div>

              {/* ── Neighbourhood ratings strip ── always visible */}
              <div className="rounded-xl border border-border/40 bg-card p-4 sm:p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">Area Ratings</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  {[
                    { icon: GraduationCap, label: "Schools", value: ai.neighbourhoodProfile.schoolsRating },
                    { icon: Train, label: "Transport", value: ai.neighbourhoodProfile.transportRating },
                    { icon: Shield, label: "Safety", value: ai.neighbourhoodProfile.safetyRating },
                    { icon: Footprints, label: "Walkability", value: ai.neighbourhoodProfile.walkability },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground w-20 shrink-0">{item.label}</span>
                      <div className="flex-1">
                        <RatingBar value={item.value} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* ═══════════════════════════════════════════════════════════════
                LAYERS 2 + 3 — TABBED DEEP DIVE
                4 tabs: Overview · Market · Neighbourhood · Details
                Accordions within tabs for secondary detail.
            ═══════════════════════════════════════════════════════════════ */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full grid grid-cols-4 mb-6 h-auto rounded-lg bg-muted/60 p-1">
                <TabsTrigger value="overview" className="text-[11px] font-semibold uppercase tracking-[0.1em] py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Overview</TabsTrigger>
                <TabsTrigger value="market" className="text-[11px] font-semibold uppercase tracking-[0.1em] py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Market</TabsTrigger>
                <TabsTrigger value="neighbourhood" className="text-[11px] font-semibold uppercase tracking-[0.1em] py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Nearby</TabsTrigger>
                <TabsTrigger value="details" className="text-[11px] font-semibold uppercase tracking-[0.1em] py-2.5 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Details</TabsTrigger>
              </TabsList>

              {/* ─────────────────────────────────────────────────────────────
                  TAB 1 — OVERVIEW
                  What it covers:
                  - Executive Summary (always open)
                  - Lifestyle Fit + Strengths & Considerations (paid)
                  - What People Miss (paid)
                  - Development Alerts (paid)
                  - Map
                  - Flood, Climate & Resilience
                  - Council Tax
                  - Infrastructure Alerts
                  - Mortgage Calculator
              ───────────────────────────────────────────────────────────── */}
              <TabsContent value="overview" className="space-y-4 mt-0">

                {/* Executive Summary */}
                <Card className="p-5 sm:p-6" data-testid="section-executive-summary">
                  <SectionHeading>Executive Summary</SectionHeading>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {ai.executiveSummary}
                  </p>
                  {(ai.marketOverview.averagePrice === "Insufficient data" || ai.marketOverview.averagePrice === "Scotland/NI — see note") && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-4 leading-relaxed border-l-2 border-amber-400/40 pl-3 bg-amber-50/50 dark:bg-amber-950/20 py-2 rounded-r-sm">
                      Data note: Land Registry transaction volume for this postcode is below the threshold for full statistical analysis. Figures are directional — supplement with Rightmove and Zoopla sold prices and local agent intelligence before offering.
                    </p>
                  )}
                </Card>

                {/* Lifestyle Fit — paid */}
                {isPaid && (
                  <LifestyleFitBlock ai={ai} />
                )}

                {/* Strengths & Considerations + What People Miss + Development Alerts — paid */}
                {isPaid && (
                  <Card className="overflow-hidden" data-testid="section-strengths-summary">
                    <Accordion type="multiple" defaultValue={["strengths"]} className="w-full">
                      <AccordionItem value="strengths" className="border-0">
                        <AccordionTrigger className="px-5 sm:px-6 py-4 text-xs font-semibold uppercase tracking-[0.15em] text-primary hover:no-underline hover:bg-muted/30">
                          Strengths &amp; Considerations
                        </AccordionTrigger>
                        <AccordionContent className="px-5 sm:px-6 pb-5">
                          <StrengthsAndConsiderations ai={ai} />
                        </AccordionContent>
                      </AccordionItem>
                      {(ai.missedInsights?.length ?? 0) > 0 && (
                        <AccordionItem value="missed" className="border-t border-border/30">
                          <AccordionTrigger className="px-5 sm:px-6 py-4 text-xs font-semibold uppercase tracking-[0.15em] text-primary hover:no-underline hover:bg-muted/30">
                            What People Miss
                          </AccordionTrigger>
                          <AccordionContent className="px-5 sm:px-6 pb-5">
                            <WhatPeopleMiss missedInsights={ai.missedInsights} areaName={ai.area} />
                          </AccordionContent>
                        </AccordionItem>
                      )}
                      <AccordionItem value="developments" className="border-t border-border/30">
                        <AccordionTrigger className="px-5 sm:px-6 py-4 text-xs font-semibold uppercase tracking-[0.15em] text-primary hover:no-underline hover:bg-muted/30">
                          Development Alerts
                        </AccordionTrigger>
                        <AccordionContent className="px-5 sm:px-6 pb-5">
                          <DevelopmentAlerts
                            nearbyDevelopments={ai.nearbyDevelopments}
                            planningActivity={ai.planningActivity}
                            areaName={ai.area}
                          />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </Card>
                )}

                {/* Map */}
                {(report.lat && report.lng) && (
                  <Card className="overflow-hidden" data-testid="section-map">
                    <Accordion type="single" defaultValue="map" collapsible className="w-full">
                      <AccordionItem value="map" className="border-0">
                        <AccordionTrigger className="px-5 sm:px-6 py-4 text-xs font-semibold uppercase tracking-[0.15em] text-primary hover:no-underline hover:bg-muted/30">
                          Location Map
                        </AccordionTrigger>
                        <AccordionContent className="px-5 sm:px-6 pb-5">
                          <PostcodeMap
                            postcode={ai.location}
                            lat={report.lat}
                            lng={report.lng}
                            areaName={ai.area}
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">OpenStreetMap</a> contributors
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </Card>
                )}

                {/* Flood, Climate & Resilience */}
                <CollapsibleSection title="Flood, Climate & Resilience" testId="section-flood" defaultOpen={false}>
                  <ClimateResilienceCard
                    riskBadge={ai.floodRisk.riskBadge}
                    zone={ai.floodRisk.zone}
                    surfaceWater={ai.floodRisk.surfaceWater}
                    detail={ai.floodRisk.detail}
                    resilienceLabel={ai.floodRisk.resilienceLabel}
                    climateSignals={ai.floodRisk.climateSignals}
                    nextSteps={ai.floodRisk.nextSteps}
                  />
                </CollapsibleSection>

                {/* Council Tax */}
                <CollapsibleSection title="Council Tax" testId="section-council-tax" defaultOpen={false}>
                  <div className="flex flex-col gap-4">
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                          {ai.councilTax.confidence === "Guidance" ? "Most Common Band" : "Estimated Band"}
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-foreground">{ai.councilTax.mostCommonBand}</span>
                          {ai.councilTax.confidence !== "Guidance" && (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              Estimate
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Annual Cost <EstimateTag /></span>
                        <span className="text-lg font-bold text-foreground">{ai.councilTax.annualCost}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Local Authority</span>
                        <span className="text-sm font-medium text-foreground">{ai.councilTax.borough}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{ai.councilTax.note}</p>
                    <p className="text-xs text-muted-foreground/70 leading-relaxed border-l-2 border-border pl-3">
                      Council tax is a fixed annual cost that doesn't scale with property price — a Band F property costs £500–£1,000+ more per year than a Band C equivalent.
                    </p>
                    <a href={ai.councilTax.checkerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-2 self-start">
                      {ai.councilTax.confidence === "Guidance" ? "Confirm exact band for this address →" : "Check exact band for any specific address →"}
                    </a>
                  </div>
                </CollapsibleSection>

                {/* Infrastructure Alerts */}
                {(() => {
                  const flags = getInfrastructureFlags(ai.location);
                  if (flags.length === 0) return null;
                  return (
                    <CollapsibleSection title="Infrastructure Alerts" testId="section-infrastructure" defaultOpen={false}>
                      <div className="space-y-3">
                        {flags.map((flag, i) => (
                          <div key={i} className={`p-4 rounded-lg border ${
                            flag.impact === "Positive" ? "border-green-500/30 bg-green-500/5" :
                            flag.impact === "Disruptive" ? "border-amber-500/30 bg-amber-500/5" :
                            "border-blue-500/30 bg-blue-500/5"
                          }`}>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-sm font-bold text-foreground">{flag.name}</span>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                flag.impact === "Positive" ? "bg-green-500/15 text-green-700 dark:text-green-400" :
                                flag.impact === "Disruptive" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                                "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                              }`}>{flag.impact}</span>
                              <span className="text-[10px] text-muted-foreground">{flag.type}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{flag.detail}</p>
                            <p className="text-xs font-medium text-foreground/70 mt-1.5">Status: {flag.phaseOrStatus}</p>
                          </div>
                        ))}
                      </div>
                    </CollapsibleSection>
                  );
                })()}

                {/* Mortgage Calculator */}
                <CollapsibleSection title="Mortgage Calculator" testId="section-mortgage" defaultOpen={false}>
                  <MortgageCalculator averagePrice={ai.marketOverview.averagePrice} />
                </CollapsibleSection>

              </TabsContent>

              {/* ─────────────────────────────────────────────────────────────
                  TAB 2 — MARKET
                  What it covers:
                  - 5-year price trend
                  - Negotiation leverage (paid)
                  - Property Valuation + Comparables + Offer Strategy (property reports)
                  - Property Type Split (paid)
                  - Rental Market Snapshot (paid)
                  - Market Outlook + Verdict (gated)
              ───────────────────────────────────────────────────────────── */}
              <TabsContent value="market" className="space-y-4 mt-0">

                {/* Price Trend */}
                <Card className="p-5 sm:p-6" data-testid="section-price-trend">
                  <SectionHeading>{isPaid ? "5-Year Price Trend" : "1-Year Price Trend"}</SectionHeading>
                  {!isPaid && (
                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                      Most recent Land Registry price data for this postcode. Professional unlocks the full 5-year history.
                    </p>
                  )}
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
                        {(isPaid ? ai.priceTrend : ai.priceTrend.slice(-1)).map((row) => (
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
                  {!isPaid && (
                    <Link href="/pricing">
                      <p className="text-xs text-primary underline underline-offset-2 mt-3">Unlock 5-year history with Professional →</p>
                    </Link>
                  )}
                  <p className="text-xs text-muted-foreground/70 mt-4 leading-relaxed">
                    Average price and year-on-year change are postcode-level figures from HM Land Registry (latest available). Time on market and supply level are benchmarked from area tier.
                  </p>
                  {ai.briefConfidence && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <ConfidencePill level={ai.briefConfidence.marketTrend} note={ai.briefConfidence.marketTrendNote} />
                    </div>
                  )}
                </Card>

                {/* Negotiation Leverage — Professional+ */}
                {isPaid && ai.negotiationLeverage && (
                  <NegotiationLeverage leverage={ai.negotiationLeverage} />
                )}

                {/* Property Valuation + Comparables + Offer Strategy — address reports only */}
                {isPropertyReport && pd && (
                  <>
                    <Card className="p-5 sm:p-6" data-testid="section-valuation">
                      <SectionHeading>Property Valuation Assessment</SectionHeading>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Estimated Range <EstimateTag /></p>
                          <p className="font-serif text-2xl tracking-tight text-foreground" data-testid="text-kpi-estimated-range">
                            {pd.valuationAssessment.estimatedRange}
                          </p>
                        </div>
                        <KpiValue label="vs Area Average" value={pd.valuationAssessment.priceVsAreaAverage} />
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Value Score <EstimateTag /></p>
                          <p className="font-serif text-2xl tracking-tight text-foreground" data-testid="text-kpi-value-score">
                            {pd.valuationAssessment.valueScore}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-4 leading-relaxed border-l-2 border-border pl-3">
                        The range gives you a starting anchor for offer calibration — not a final number. For a binding figure, instruct a RICS-regulated surveyor.
                      </p>
                    </Card>

                    <Card className="p-5 sm:p-6" data-testid="section-comparables">
                      <SectionHeading>Comparable Sales</SectionHeading>
                      {pd.comparableSales.length === 1 && pd.comparableSales[0].price === "—" ? (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/40">
                          <FileSearch className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                          <div className="flex flex-col gap-1">
                            <p className="text-sm text-muted-foreground leading-relaxed">{pd.comparableSales[0].address}</p>
                            <p className="text-xs text-muted-foreground/70">Use the 5-year price trend and area median above as your pricing anchors.</p>
                            <a href="https://www.rightmove.co.uk/house-prices.html" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-2 self-start mt-1">Search sold prices on Rightmove →</a>
                          </div>
                        </div>
                      ) : (
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
                      )}
                      {pd.comparableSales.length > 1 && (
                        <p className="text-xs text-muted-foreground/70 mt-4 leading-relaxed border-l-2 border-border pl-3">
                          Properties that sold at a premium typically offer something the subject property may not. Use the lower end as your opening negotiation anchor.
                        </p>
                      )}
                    </Card>

                    {pd.offerStrategy && (
                      <Card className="p-5 sm:p-6 border-primary/20" data-testid="section-offer-strategy">
                        <div className="flex items-start justify-between gap-3 mb-5">
                          <div>
                            <SectionHeading>Pre-offer Strategy</SectionHeading>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              Evidence-led guidance for making and defending an offer. Not a formal valuation — instruct a RICS surveyor before exchange.
                            </p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                            pd.offerStrategy.confidence === "Strong"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-400/30"
                              : pd.offerStrategy.confidence === "Moderate"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/30"
                              : "bg-muted text-muted-foreground border-border"
                          }`}>
                            {pd.offerStrategy.confidence} evidence
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-primary/5 border border-primary/10 mb-5">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1">Fair Value Range <EstimateTag /></p>
                            <p className="font-serif text-2xl tracking-tight text-foreground" data-testid="text-fair-value-range">
                              {pd.offerStrategy.fairValueRange}
                            </p>
                          </div>
                          <div className="sm:border-l sm:border-border/50 sm:pl-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1">Opening Range <EstimateTag /></p>
                            <p className="font-serif text-2xl tracking-tight text-primary" data-testid="text-opening-range">
                              {pd.offerStrategy.openingRange}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground/80 leading-relaxed mb-5 border-l-2 border-border pl-3">
                          {pd.offerStrategy.confidenceNote}
                        </p>
                        <div className="mb-5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">How we got here</p>
                          <p className="text-sm text-foreground/90 leading-relaxed">{pd.offerStrategy.rationale}</p>
                        </div>
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="seller-points" className="border-t border-border/40">
                            <AccordionTrigger className="py-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:no-underline">
                              Factors that may support a firmer stance
                            </AccordionTrigger>
                            <AccordionContent>
                              <ul className="space-y-2 pt-1">
                                {pd.offerStrategy.sellerPressurePoints.map((point, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm">
                                    <span className="text-amber-600 dark:text-amber-400 mt-1 shrink-0">‣</span>
                                    <span className="text-foreground/90 leading-relaxed">{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="pre-offer-q" className="border-t border-border/40">
                            <AccordionTrigger className="py-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:no-underline">
                              Questions to raise before offering
                            </AccordionTrigger>
                            <AccordionContent>
                              <ul className="space-y-2 pt-1">
                                {pd.offerStrategy.preOfferQuestions.map((q, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm">
                                    <span className="text-primary/60 font-serif mt-0.5 shrink-0 tabular-nums">{i + 1}.</span>
                                    <span className="text-foreground/90 leading-relaxed">{q}</span>
                                  </li>
                                ))}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </Card>
                    )}
                  </>
                )}

                {/* Property Type Split — Professional+ */}
                {isPaid && (
                  <CollapsibleSection title="Property Type Split" testId="section-property-types" defaultOpen={false}>
                    <div className="flex flex-col gap-4">
                      <p className={`text-sm ${ai.propertyTypeSplit.dominantType.includes("Indicative") || ai.propertyTypeSplit.dominantType.includes("indicative") || ai.propertyTypeSplit.dominantType.includes("limited") ? "text-muted-foreground italic text-xs" : "text-muted-foreground"}`}>{ai.propertyTypeSplit.dominantType}</p>
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
                              <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${item.value}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Rental Market Snapshot — Pro+ */}
                {isPaid ? (
                  <CollapsibleSection title="Rental Market Snapshot" testId="section-rental-market" defaultOpen={false}>
                    <div className="flex flex-col gap-5">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Asking rents nearby</p>
                          <EstimateTag />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { label: "1-Bed", value: ai.rentalMarket.oneBedAskingRent },
                            { label: "2-Bed", value: ai.rentalMarket.twoBedAskingRent },
                            { label: "3-Bed", value: ai.rentalMarket.threeBedAskingRent },
                          ].map(item => (
                            <div key={item.label} className="flex flex-col gap-1">
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{item.label}</span>
                              <span className="text-lg font-bold text-foreground">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="pt-3 border-t border-border/40">
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Rental market signals</p>
                          <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#B8860B]/10 text-[#B8860B] border border-[#B8860B]/20">Landlords</span>
                          <EstimateTag />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { label: "1-Bed Gross Yield", value: ai.rentalMarket.oneBedYield },
                            { label: "2-Bed Gross Yield", value: ai.rentalMarket.twoBedYield },
                            { label: "Demand Level", value: ai.rentalMarket.demandLevel },
                          ].map(item => (
                            <div key={item.label} className="flex flex-col gap-1">
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{item.label}</span>
                              <span className={`font-bold ${item.label.includes("Yield") ? "text-green-600 dark:text-green-400 text-lg" : "text-[#B8860B] text-base"}`}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{ai.rentalMarket.note}</p>
                      <p className="text-xs text-muted-foreground/70 leading-relaxed">
                        Rents and yields are ranges derived from ONS Private Rental Market data and VOA 2024 figures for this postcode district.
                      </p>
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
                      <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg max-w-[220px]">
                        <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-foreground">Rental market — Professional</p>
                        <p className="text-[11px] text-muted-foreground mt-1 mb-2">Asking rents by property size and local letting demand.</p>
                        <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Market Outlook + Verdict — gated */}
                {hasMarketOutlookAccess ? (
                  <div className="space-y-4">
                    <Card className="p-5 sm:p-6" data-testid="section-market-outlook">
                      <SectionHeading>Market Outlook</SectionHeading>
                      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                        Market signals are derived from Land Registry transaction data — not a prediction or forecast. Not financial advice.
                      </p>
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-1">Recent market signals</p>
                        <p className="text-sm text-foreground leading-relaxed" data-testid="text-kpi-price-growth">
                          {ai.investmentOutlook.growthForecast}
                        </p>
                      </div>
                      <div className="pt-4 border-t border-border/40">
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Rental yield context</p>
                          <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#B8860B]/10 text-[#B8860B] border border-[#B8860B]/20">Landlords</span>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Rental yield (indicative) <EstimateTag /></p>
                          <p className="font-serif text-2xl tracking-tight text-foreground" data-testid="text-kpi-rental-yield">
                            {ai.investmentOutlook.rentalYieldEstimate}
                          </p>
                        </div>
                      </div>
                      {ai.investmentOutlook.riskFlags.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            Market flags
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
                    <Card className="p-5 sm:p-6 border-primary/20" data-testid="section-verdict">
                      <SectionHeading>Verdict</SectionHeading>
                      <p className="text-sm leading-relaxed text-foreground/90 italic">{ai.verdict}</p>
                    </Card>
                  </div>
                ) : (
                  <FeatureGate
                    featureName="investment_score"
                    modalHeadline="Unlock Market Outlook & Verdict"
                    modalSubtext="Enter your email to see price growth forecasts, rental yield, market flags, and the full brief verdict. Free — no payment required."
                    teaser={
                      <LockedPreview
                        title="Market Outlook & Verdict"
                        description="Price growth forecast, rental yield estimate, market risk flags, and the full AI brief verdict."
                        planLabel="Free — enter email"
                        pricingHref="/pricing"
                        skeletonRows={4}
                        testId="section-market-outlook-locked"
                      />
                    }
                  >
                    <div className="space-y-4">
                      <Card className="p-5 sm:p-6" data-testid="section-market-outlook">
                        <SectionHeading>Market Outlook</SectionHeading>
                        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                          Market signals are derived from Land Registry transaction data — not a prediction or forecast. Not financial advice.
                        </p>
                        <div className="mb-4">
                          <p className="text-xs text-muted-foreground mb-1">Recent market signals</p>
                          <p className="text-sm text-foreground leading-relaxed">{ai.investmentOutlook.growthForecast}</p>
                        </div>
                        <div className="pt-4 border-t border-border/40">
                          <p className="text-xs text-muted-foreground mb-1">Rental yield (indicative) <EstimateTag /></p>
                          <p className="font-serif text-2xl tracking-tight text-foreground">{ai.investmentOutlook.rentalYieldEstimate}</p>
                        </div>
                        {ai.investmentOutlook.riskFlags.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                              <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                              Market flags
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
                      <Card className="p-5 sm:p-6 border-primary/20" data-testid="section-verdict">
                        <SectionHeading>Verdict</SectionHeading>
                        <p className="text-sm leading-relaxed text-foreground/90 italic">{ai.verdict}</p>
                      </Card>
                    </div>
                  </FeatureGate>
                )}

              </TabsContent>

              {/* ─────────────────────────────────────────────────────────────
                  TAB 3 — NEIGHBOURHOOD
                  What it covers:
                  - Walk Score
                  - Neighbourhood Profile (character, transport, schools, amenities, green space)
                  - Commute Calculator
                  - Nearby Stations (collapsible)
                  - Nearby Schools (collapsible)
                  - Local Amenities (collapsible)
                  - Neighbourhood Map
              ───────────────────────────────────────────────────────────── */}
              <TabsContent value="neighbourhood" className="space-y-4 mt-0">

                {/* Walk Score */}
                {(ai.nearbyStations?.length > 0 || ai.nearbySchools?.length > 0 || ai.nearbyAmenities) && (
                  <Card className="p-5 sm:p-6">
                    <WalkScore
                      stations={ai.nearbyStations ?? []}
                      schools={ai.nearbySchools ?? []}
                      amenities={ai.nearbyAmenities}
                      areaWalkability={ai.neighbourhoodProfile?.walkability}
                    />
                  </Card>
                )}

                {/* Neighbourhood Profile */}
                <CollapsibleSection title="Neighbourhood Profile" testId="section-neighbourhood">
                  {isPaid ? (
                    <div className="grid gap-5 sm:grid-cols-2">
                      {/* Area character synthesis */}
                      {(() => {
                        const tier = ai.tier ?? "";
                        const safety = ai.neighbourhoodProfile?.safetyRating ?? 50;
                        const schools = ai.neighbourhoodProfile?.schoolsRating ?? 5;
                        const transport = ai.neighbourhoodProfile?.transportRating ?? 5;
                        const cafes = ai.nearbyAmenities?.cafesAndRestaurants?.length ?? 0;
                        const coverageThin = ai.neighbourhoodProfile?.coverageThin;
                        const isAffluent = tier.toLowerCase().includes("prime") || tier.toLowerCase().includes("prestige") || tier.toLowerCase().includes("luxury");
                        const isFamily = schools >= 7 && safety >= 65;
                        const isTransitRich2 = transport >= 7;
                        const isSafe = safety >= 70;
                        const isVibrant = cafes >= 3;
                        const isQuiet = cafes <= 1 && !isTransitRich2;
                        let archetype: string;
                        let archetypeDetail: string;
                        if (isAffluent && isFamily && isSafe) {
                          archetype = "Affluent family area";
                          archetypeDetail = "High safety ratings and strong school provision signal this as a settled, family-oriented neighbourhood.";
                        } else if (isAffluent && isTransitRich2) {
                          archetype = "Affluent, well-connected";
                          archetypeDetail = "Prime location with strong transit access. Attracts commuter professionals and second-home buyers.";
                        } else if (isFamily && isQuiet) {
                          archetype = "Quiet, family-oriented";
                          archetypeDetail = "Low footfall, limited evening scene, but solid for families who value calm streets and school access over buzz.";
                        } else if (isVibrant && isTransitRich2 && !isFamily) {
                          archetype = "Urban, mixed-use";
                          archetypeDetail = "Active street-level scene with good transit links. Suits younger professionals and downsizers.";
                        } else if (isTransitRich2 && !isFamily && !isAffluent) {
                          archetype = "Transient, commuter-facing";
                          archetypeDetail = "Strong transport access drives demand here more than neighbourhood character.";
                        } else if (isQuiet && !isSafe && !isFamily) {
                          archetype = "Mixed character";
                          archetypeDetail = "The signals here are mixed — limited amenity base, moderate safety rating, and no dominant buyer archetype. Suitable buyers should visit in the evening as well as during the day.";
                        } else {
                          archetype = "Suburban residential";
                          archetypeDetail = "A broadly residential area with moderate scores across safety, schools, and transport.";
                        }
                        return (
                          <div className="sm:col-span-2 rounded-lg border border-border/50 bg-muted/20 p-4 flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Area character read</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{archetype}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{archetypeDetail}</p>
                            {coverageThin && (
                              <p className="text-[10px] text-muted-foreground/50 italic">Derived from data signals — limited curated enrichment available for this postcode.</p>
                            )}
                          </div>
                        );
                      })()}
                      {[
                        { icon: Home, label: "Local Character", text: ai.neighbourhoodProfile.character },
                        { icon: UtensilsCrossed, label: "Shops & Amenities", text: ai.neighbourhoodProfile.amenities },
                        { icon: Train, label: "Transport Links", text: ai.neighbourhoodProfile.transport },
                        { icon: Trees, label: "Green Space", text: ai.neighbourhoodProfile.greenSpace },
                        { icon: GraduationCap, label: "Schools", text: ai.neighbourhoodProfile.schools },
                        { icon: Users, label: "Who Lives Here", text: ai.neighbourhoodProfile.demographics },
                        { icon: Moon, label: "Evenings & Eating Out", text: ai.neighbourhoodProfile.nightlife },
                        { icon: Lightbulb, label: "Buyer Notes", text: ai.neighbourhoodProfile.marketComment },
                      ].map((item) => (
                        <div key={item.label} className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <item.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{item.label}</span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                        </div>
                      ))}
                      <div className="sm:col-span-2 flex flex-col gap-3">
                        <ResidentSentimentBlock ai={ai} />
                        {ai.briefConfidence && (
                          <ConfidencePill level={ai.briefConfidence.localSentiment} note={ai.briefConfidence.localSentimentNote} className="mt-1" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-5">
                      {[
                        { icon: Home, label: "Local Character", text: ai.neighbourhoodProfile.character },
                        { icon: Train, label: "Transport", text: ai.neighbourhoodProfile.transport },
                        { icon: GraduationCap, label: "Schools", text: ai.neighbourhoodProfile.schools },
                      ].map((item) => (
                        <div key={item.label} className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <item.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{item.label}</span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                        </div>
                      ))}
                      <div className="border-t border-border/40 pt-4">
                        <ResidentSentimentTeaser ai={ai} />
                      </div>
                      <p className="text-xs text-muted-foreground/60 border-t border-border/40 pt-3">
                        Full neighbourhood detail available in Professional.{" "}
                        <Link href="/pricing"><span className="text-primary underline underline-offset-2">Upgrade →</span></Link>
                      </p>
                    </div>
                  )}
                </CollapsibleSection>

                {/* Commute */}
                {isPaid ? (
                  <CollapsibleSection title="Commute Calculator" testId="section-commute" defaultOpen={false}>
                    <div className="flex flex-col gap-3">
                      <p className="text-xs text-muted-foreground">Journey times from the postcode centre to key destinations.</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-primary py-2 pr-4">Destination</th>
                              <th className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-primary py-2 pr-4">Time</th>
                              <th className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-primary py-2 pr-4">Mode</th>
                              <th className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-primary py-2">Via / Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ai.commuteTable.map((row, i) => (
                              <tr key={i} className="border-b border-border/40 last:border-0">
                                <td className="py-2.5 pr-4 font-medium">{row.destination}</td>
                                <td className="py-2.5 pr-4">{row.time}</td>
                                <td className="py-2.5 pr-4 text-muted-foreground">{row.mode}</td>
                                <td className="py-2.5 text-muted-foreground text-xs">{row.via}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-muted-foreground/70 leading-relaxed border-l-2 border-border pl-3 mt-2">
                        Commute times are indicative estimates. Verify via Google Maps or National Rail using the actual departure point.
                      </p>
                    </div>
                  </CollapsibleSection>
                ) : (
                  <CollapsibleSection title="Commute" testId="section-commute" defaultOpen={false}>
                    <div className="flex flex-col gap-3">
                      {ai.commuteTable.length > 0 && ai.commuteTable[0].destination !== "Town / City Centre" ? (
                        <div className="flex items-start gap-3">
                          <Train className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm text-foreground font-medium">{ai.commuteTable[0].destination}</p>
                            <p className="text-sm text-muted-foreground">{ai.commuteTable[0].time} by {ai.commuteTable[0].mode}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <Train className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <p className="text-sm text-muted-foreground">
                            Journey times depend on your exact address. Check Nearby Stations for the closest rail connections.
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground/60">
                        Full commute calculator available in Professional.{" "}
                        <Link href="/pricing"><span className="text-primary underline underline-offset-2">Upgrade →</span></Link>
                      </p>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Nearby Stations */}
                {ai.nearbyStations && ai.nearbyStations.length > 0 && (
                  <CollapsibleSection title="Nearby Stations" testId="section-stations" defaultOpen={false}>
                    <div className="space-y-0">
                      {/* ── Commute picture interpretation ── */}
                      {(() => {
                        const stations = ai.nearbyStations ?? [];
                        const sorted = stations.slice().sort((a, b) => a.walkMins - b.walkMins);
                        const closest = sorted[0];
                        const closestWalk = closest?.walkMins ?? 999;
                        const TUBE_LINES = ["jubilee","central","northern","victoria","piccadilly","bakerloo",
                          "district","circle","metropolitan","elizabeth","elizabeth line","hammersmith & city",
                          "hammersmith","overground","london overground","dlr","liberty","lioness",
                          "mildmay","suffragette","weaver","windrush"];
                        const hasLondonTube = stations.some(s => s.lines.some(l => TUBE_LINES.includes(l.toLowerCase())));
                        const hasNationalRail = stations.some(s => s.modes?.includes("national-rail"));
                        const hasElizabethLine = stations.some(s =>
                          s.lines.some(l => l.toLowerCase().includes("elizabeth")) ||
                          s.modes?.includes("elizabeth-line")
                        );
                        const totalStations = stations.length;
                        const stationsWithin10 = stations.filter(s => s.walkMins <= 10).length;
                        const stationsWithin20 = stations.filter(s => s.walkMins <= 20).length;
                        let pictureLabel = "";
                        let pictureDetail = "";
                        if (closestWalk <= 5 && stationsWithin10 >= 2) {
                          pictureLabel = "Excellent transport access";
                          pictureDetail = hasElizabethLine
                            ? `${stationsWithin10} station${stationsWithin10 > 1 ? "s" : ""} within 10 minutes, including Elizabeth line access. Fast cross-London connections within walking distance.`
                            : hasLondonTube
                            ? `${stationsWithin10} Tube station${stationsWithin10 > 1 ? "s" : ""} within 10 minutes — strong coverage across multiple lines.`
                            : `${stationsWithin10} stations within 10 minutes — high-frequency connections with minimal walk time.`;
                        } else if (closestWalk <= 8 && hasLondonTube) {
                          pictureLabel = "Good tube access";
                          pictureDetail = `${closest?.name} is a ${closestWalk}-minute walk — solid commuter base for central London. ${stationsWithin20 > 1 ? `${stationsWithin20} stations within 20 minutes gives resilience if one line is disrupted.` : ""}`;
                        } else if (closestWalk <= 8 && hasNationalRail) {
                          pictureLabel = "Good rail access";
                          pictureDetail = `${closest?.name} is ${closestWalk} minutes away${closest?.lines?.length > 0 ? ` — ${closest.lines.slice(0, 2).join(", ")}` : ""}. Regular services for commuters.`;
                        } else if (closestWalk <= 12) {
                          pictureLabel = "Moderate walking distance";
                          pictureDetail = `Nearest station (${closest?.name}) is ${closestWalk} minutes on foot — manageable but adds time to commutes. ${totalStations > 2 ? `${totalStations} stations within reach.` : ""}`;
                        } else if (closestWalk <= 20) {
                          pictureLabel = "Longer walk or requires cycling";
                          pictureDetail = `${closest?.name} at ${closestWalk} minutes is too far for most daily walkers — cycling or a short bus leg may be needed. Factor into your commute planning.`;
                        } else {
                          pictureLabel = "Car-dependent area";
                          pictureDetail = `No station within easy walking distance (nearest: ${closestWalk} min). This area relies on car or bus transport for most journeys.`;
                        }
                        return pictureLabel ? (
                          <div className="mb-4 flex items-start gap-3 p-3.5 rounded-lg border border-border/40 bg-muted/30">
                            <Train className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-foreground mb-0.5">{pictureLabel}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{pictureDetail}</p>
                            </div>
                          </div>
                        ) : null;
                      })()}
                      {/* Station list */}
                      <div className="space-y-2">
                        {ai.nearbyStations.slice(0, isPaid ? undefined : 3).map((station, i) => {
                          const TUBE_LINE_COLOURS: Record<string, string> = {
                            "jubilee": "#A0A5A9", "central": "#E32017", "northern": "#000000",
                            "victoria": "#0098D4", "piccadilly": "#003688", "bakerloo": "#B36305",
                            "district": "#00782A", "circle": "#FFD300", "metropolitan": "#9B0056",
                            "elizabeth": "#6950a1", "elizabeth line": "#6950a1",
                            "hammersmith & city": "#F3A9BB", "hammersmith": "#F3A9BB",
                            "overground": "#EE7C0E", "london overground": "#EE7C0E",
                            "dlr": "#00A4A7", "liberty": "#6950a1", "lioness": "#6950a1",
                            "mildmay": "#6950a1", "suffragette": "#6950a1",
                            "weaver": "#6950a1", "windrush": "#6950a1",
                          };
                          return (
                            <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/20 last:border-0">
                              <Train className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium text-foreground">{station.name}</p>
                                  <span className="text-xs text-muted-foreground shrink-0">{station.walkMins} min walk</span>
                                </div>
                                {station.lines.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {station.lines.map((line, j) => {
                                      const color = TUBE_LINE_COLOURS[line.toLowerCase()];
                                      return color ? (
                                        <span key={j} className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: color === "#FFD300" ? "#b89a00" : color, color: color === "#FFD300" || color === "#A0A5A9" ? "#000" : "#fff" }}>
                                          {line}
                                        </span>
                                      ) : (
                                        <span key={j} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{line}</span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {!isPaid && ai.nearbyStations.length > 3 && (
                          <p className="text-xs text-muted-foreground/60 pt-2">
                            {ai.nearbyStations.length - 3} more station{ai.nearbyStations.length - 3 > 1 ? "s" : ""} — unlock with Professional. <Link href="/pricing"><span className="text-primary underline underline-offset-2">Upgrade →</span></Link>
                          </p>
                        )}
                      </div>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Nearby Schools */}
                {ai.nearbySchools && ai.nearbySchools.length > 0 && (
                  <CollapsibleSection title="Nearby Schools" testId="section-schools" defaultOpen={false}>
                    <div className="space-y-0">
                      {/* School picture interpretation */}
                      {(() => {
                        const schools = ai.nearbySchools ?? [];
                        const outstanding = schools.filter(s => s.ofstedRating === "Outstanding");
                        const good = schools.filter(s => s.ofstedRating === "Good");
                        const requiresImprovement = schools.filter(s => s.ofstedRating === "Requires Improvement");
                        const inadequate = schools.filter(s => s.ofstedRating === "Inadequate");
                        const totalRated = outstanding.length + good.length + requiresImprovement.length + inadequate.length;
                        const highQuality = outstanding.length + good.length;
                        const pctHighQuality = totalRated > 0 ? Math.round((highQuality / totalRated) * 100) : 0;
                        const closestOutstanding = outstanding.slice().sort((a, b) => a.walkMins - b.walkMins)[0];
                        let pictureLabel = "";
                        let pictureDetail = "";
                        if (outstanding.length >= 2 || (outstanding.length === 1 && good.length >= 2)) {
                          pictureLabel = "Strong school catchment";
                          pictureDetail = `${outstanding.length} Outstanding${outstanding.length > 1 ? "" : ""} and ${good.length} Good-rated school${good.length > 1 ? "s" : ""} within reach. ${closestOutstanding ? `${closestOutstanding.name} is ${closestOutstanding.walkMins} minutes away.` : ""}`;
                        } else if (good.length >= 3 && outstanding.length === 0) {
                          pictureLabel = "Solid school provision";
                          pictureDetail = `${good.length} Good-rated schools nearby. No Outstanding-rated schools in this data, but consistently solid provision — worth confirming current catchment areas with the local authority.`;
                        } else if (requiresImprovement.length > good.length && inadequate.length > 0) {
                          pictureLabel = "Below-average school provision";
                          pictureDetail = `More schools rated Requires Improvement or Inadequate than Good or Outstanding in this data. Families should research current Ofsted ratings directly — Ofsted reports can change significantly.`;
                        } else if (totalRated === 0) {
                          pictureLabel = "School data limited";
                          pictureDetail = "Ofsted ratings not available in this data pull. Check Ofsted Find an Inspector directly for up-to-date school ratings in this area.";
                        } else {
                          pictureLabel = `${pctHighQuality}% of nearby schools rated Good or Outstanding`;
                          pictureDetail = `${highQuality} of ${totalRated} rated schools meet the Good or Outstanding bar. ${requiresImprovement.length > 0 ? `${requiresImprovement.length} rated Requires Improvement.` : ""} Verify current catchment areas before committing.`;
                        }
                        return pictureLabel ? (
                          <div className="mb-4 flex items-start gap-3 p-3.5 rounded-lg border border-border/40 bg-muted/30">
                            <GraduationCap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-foreground mb-0.5">{pictureLabel}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{pictureDetail}</p>
                            </div>
                          </div>
                        ) : null;
                      })()}
                      <div className="space-y-2">
                        {ai.nearbySchools.slice(0, isPaid ? undefined : 3).map((school, i) => {
                          const ratingColors: Record<string, string> = {
                            "Outstanding": "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                            "Good": "text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/20",
                            "Requires Improvement": "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
                            "Inadequate": "text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/20",
                          };
                          const ratingClass = ratingColors[school.ofstedRating] ?? "text-muted-foreground bg-muted border-border/40";
                          return (
                            <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/20 last:border-0">
                              <GraduationCap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-foreground">{school.name}</p>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${ratingClass}`}>{school.ofstedRating}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{school.type} · {school.walkMins} min walk</p>
                              </div>
                            </div>
                          );
                        })}
                        {!isPaid && ai.nearbySchools.length > 3 && (
                          <p className="text-xs text-muted-foreground/60 pt-2">
                            {ai.nearbySchools.length - 3} more school{ai.nearbySchools.length - 3 > 1 ? "s" : ""} — unlock with Professional. <Link href="/pricing"><span className="text-primary underline underline-offset-2">Upgrade →</span></Link>
                          </p>
                        )}
                      </div>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Local Amenities */}
                {ai.nearbyAmenities && (
                  <CollapsibleSection title="Local Amenities" testId="section-amenities" defaultOpen={false}>
                    <div className="space-y-0">
                      {/* Amenity picture interpretation */}
                      {(() => {
                        const amenities = ai.nearbyAmenities;
                        if (!amenities) return null;
                        const cafes = amenities.cafesAndRestaurants?.length ?? 0;
                        const supermarkets = amenities.supermarkets?.length ?? 0;
                        const green = amenities.greenSpaces?.length ?? 0;
                        const gyms = amenities.gyms?.length ?? 0;
                        const pubs = amenities.pubs?.length ?? 0;
                        const total = cafes + supermarkets + green + gyms + pubs;
                        const closestCafe = cafes > 0 ? amenities.cafesAndRestaurants![0] : null;
                        const closestSupermarket = supermarkets > 0 ? amenities.supermarkets![0] : null;
                        let label = "";
                        let detail = "";
                        if (total === 0) {
                          label = "Limited walkable amenities";
                          detail = "No amenities returned from Overpass for this area. This may reflect data coverage gaps rather than a lack of facilities — check Google Maps for the actual street-level picture.";
                        } else if (cafes >= 5 && supermarkets >= 2) {
                          label = "Excellent walkable amenity base";
                          detail = `${cafes} cafes/restaurants and ${supermarkets} supermarket${supermarkets > 1 ? "s" : ""} within reach. ${closestCafe ? `${closestCafe.name} is ${closestCafe.walkMins} min.` : ""} Strong daily living score.`;
                        } else if (cafes >= 3 || supermarkets >= 1) {
                          label = "Solid local amenities";
                          detail = `${cafes > 0 ? `${cafes} café/restaurant option${cafes > 1 ? "s" : ""}` : "Limited café scene"}${supermarkets > 0 ? `, ${supermarkets} supermarket${supermarkets > 1 ? "s" : ""}` : " but no supermarket in walking range"}. ${green > 0 ? `${green} green space${green > 1 ? "s" : ""} adds lifestyle value.` : ""}`;
                        } else {
                          label = "Limited amenity base";
                          detail = `Fewer than 3 cafes/restaurants and limited supermarket provision nearby. Day-to-day convenience relies on a short drive or bus. ${green > 0 ? `${green} green space${green > 1 ? "s" : ""} provides outdoor access.` : ""}`;
                        }
                        return (
                          <div className="mb-4 flex items-start gap-3 p-3.5 rounded-lg border border-border/40 bg-muted/30">
                            <UtensilsCrossed className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-foreground mb-0.5">{label}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
                            </div>
                          </div>
                        );
                      })()}
                      {/* Amenity rows */}
                      {[
                        { icon: Coffee, label: "Cafes & Restaurants", items: ai.nearbyAmenities?.cafesAndRestaurants },
                        { icon: ShoppingCart, label: "Supermarkets", items: ai.nearbyAmenities?.supermarkets },
                        { icon: TreePine, label: "Green Spaces", items: ai.nearbyAmenities?.greenSpaces },
                        { icon: Zap, label: "Gyms", items: ai.nearbyAmenities?.gyms },
                        { icon: Star, label: "Pubs", items: ai.nearbyAmenities?.pubs },
                        { icon: Stethoscope, label: "Medical", items: ai.nearbyAmenities?.medical },
                        { icon: BookOpen, label: "Libraries", items: ai.nearbyAmenities?.libraries },
                      ].filter(cat => (cat.items?.length ?? 0) > 0).map((cat) => (
                        <div key={cat.label} className="py-3 border-b border-border/20 last:border-0">
                          <div className="flex items-center gap-2 mb-2">
                            <cat.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">{cat.label}</span>
                            <span className="text-[10px] text-muted-foreground">({cat.items!.length})</span>
                          </div>
                          <div className="space-y-1.5">
                            {cat.items!.slice(0, 4).map((item, j) => (
                              <div key={j} className="flex items-center justify-between text-xs">
                                <span className="text-foreground/80">{item.name}</span>
                                <span className="text-muted-foreground shrink-0 ml-2">{item.walkMins} min</span>
                              </div>
                            ))}
                            {cat.items!.length > 4 && (
                              <p className="text-[10px] text-muted-foreground/60">+{cat.items!.length - 4} more</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Neighbourhood Map */}
                {isPaid && report.lat && report.lng && (
                  <CollapsibleSection title="Neighbourhood Map" testId="section-neighbourhood-map" defaultOpen={false}>
                    <NeighbourhoodMap
                      postcode={ai.location}
                      lat={report.lat}
                      lng={report.lng}
                      stations={ai.nearbyStations ?? []}
                      schools={ai.nearbySchools ?? []}
                      amenities={ai.nearbyAmenities}
                    />
                  </CollapsibleSection>
                )}

              </TabsContent>

              {/* ─────────────────────────────────────────────────────────────
                  TAB 4 — DETAILS
                  What it covers:
                  - Crime Statistics (paid)
                  - Broadband & Infrastructure (paid)
                  - Air Quality (paid)
                  - Planning Activity (paid)
                  - Rental Demand (investor)
                  - Nearby Development Tracker (investor)
                  - Nearby Sold Prices Map (paid)
                  - Street Price Ranking (investor)
              ───────────────────────────────────────────────────────────── */}
              <TabsContent value="details" className="space-y-4 mt-0">

                {/* Crime Statistics — Professional+ */}
                {isPaid && ai.crimeStats && ai.crimeStats.totalCrimesPerMonth === 0 && (
                  <CollapsibleSection title="Crime Statistics" testId="section-crime-unavailable" defaultOpen={false}>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/40">
                      <Shield className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1">
                        <p className="text-sm text-muted-foreground leading-relaxed">{ai.crimeStats.vsNationalNote}</p>
                        <p className="text-xs text-muted-foreground/70 mt-2 leading-relaxed">
                          No recorded data doesn't mean no crime — it means the API returned no records for this period. Check police.uk directly before deciding.
                        </p>
                        <a href="https://www.police.uk/pu/your-area/" target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-2 self-start mt-1">Check crime data at police.uk →</a>
                      </div>
                    </div>
                  </CollapsibleSection>
                )}
                {isPaid && ai.crimeStats && ai.crimeStats.totalCrimesPerMonth > 0 && (
                  <CollapsibleSection title="Crime Statistics" testId="section-crime" defaultOpen={false}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-foreground">{ai.crimeStats.totalCrimesPerMonth.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">crimes recorded near this area ({ai.crimeStats.date})</p>
                        </div>
                        <Shield className="h-8 w-8 text-primary/30" />
                      </div>
                      {ai.crimeStats.topCategories.length > 0 && (
                        <div className="space-y-2">
                          {ai.crimeStats.topCategories.map((cat, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-foreground font-medium">{cat.category}</span>
                                <span className="text-muted-foreground">{cat.count} ({cat.pct}%)</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.min(cat.pct * 2, 100)}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground leading-relaxed">{ai.crimeStats.vsNationalNote}</p>
                      {report.lat && report.lng && (
                        <div className="pt-2 border-t border-border/40">
                          <CrimeSparkline lat={report.lat} lng={report.lng} />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground/70 leading-relaxed border-l-2 border-border pl-3">
                        Source: data.police.uk — Police recorded crime data. Anti-social behaviour, vehicle crime, and burglary rates vary significantly between adjacent postcodes.
                      </p>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Broadband & Infrastructure — Pro+ */}
                {isPaid ? (
                  <CollapsibleSection title="Broadband & Infrastructure" testId="section-broadband" defaultOpen={false}>
                    <div className="flex flex-col gap-4">
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Avg Download</span>
                          <span className="text-lg font-bold text-foreground">{ai.broadband.avgDownloadSpeed}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Avg Upload</span>
                          <span className="text-lg font-bold text-foreground">{ai.broadband.avgUploadSpeed}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Rating</span>
                          <span className={`text-base font-bold ${
                            ai.broadband.rating === "Excellent" ? "text-emerald-600 dark:text-emerald-400" :
                            ai.broadband.rating === "Very Good" ? "text-green-600 dark:text-green-400" :
                            ai.broadband.rating === "Good" ? "text-primary" :
                            "text-amber-600 dark:text-amber-400"
                          }`}>{ai.broadband.rating}</span>
                        </div>
                      </div>
                      {ai.broadband.fullFibreAvailable !== undefined && (
                        <div className="flex items-center gap-2">
                          <Wifi className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs text-muted-foreground">
                            Full fibre (FTTP): <span className="font-semibold text-foreground">{ai.broadband.fullFibreAvailable ? "Available" : "Not available"}</span>
                          </span>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground leading-relaxed">{ai.broadband.note}</p>
                      <p className="text-xs text-muted-foreground/70 leading-relaxed">Source: Ofcom Connected Nations dataset (postcode-level). Actual speeds vary by provider and premises.</p>
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
                        <div className="h-24 bg-muted rounded" />
                      </Card>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg max-w-[220px]">
                        <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-foreground">Broadband — Professional</p>
                        <p className="text-[11px] text-muted-foreground mt-1 mb-2">Download/upload speeds and full fibre availability.</p>
                        <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Air Quality — Pro+ */}
                {isPaid ? (
                  <CollapsibleSection title="Air Quality" testId="section-air-quality" defaultOpen={false}>
                    <div className="flex flex-col gap-4">
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Overall Rating</span>
                          <span className={`text-base font-bold ${
                            ai.airQuality.rating === "Good" ? "text-emerald-600 dark:text-emerald-400" :
                            ai.airQuality.rating === "Moderate" ? "text-amber-600 dark:text-amber-400" :
                            "text-red-600 dark:text-red-400"
                          }`}>{ai.airQuality.rating}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">NO₂ Level</span>
                          <span className="text-base font-bold text-foreground">{ai.airQuality.no2Level} μg/m³</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">PM2.5</span>
                          <span className="text-base font-bold text-foreground">{ai.airQuality.pm25Level} μg/m³</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{ai.airQuality.note}</p>
                      <p className="text-xs text-muted-foreground/70 leading-relaxed">Source: DEFRA Air Quality modelling. Relevant for families and those with respiratory health concerns.</p>
                    </div>
                  </CollapsibleSection>
                ) : (
                  <div className="relative" data-testid="section-air-quality-locked">
                    <div className="blur-sm pointer-events-none select-none opacity-60">
                      <Card className="p-5 sm:p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Wind className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-sm">Air Quality</h3>
                        </div>
                        <div className="h-24 bg-muted rounded" />
                      </Card>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg max-w-[220px]">
                        <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-foreground">Air Quality — Professional</p>
                        <p className="text-[11px] text-muted-foreground mt-1 mb-2">NO₂ and PM2.5 levels with rating.</p>
                        <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Planning Activity — Pro+ */}
                {isPaid ? (
                  <CollapsibleSection title="Planning Activity" testId="section-planning" defaultOpen={false}>
                    <div className="flex flex-col gap-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Planning Applications (past 12 months)</span>
                          {ai.planningActivity.recentApplications > 0
                            ? <span className="text-2xl font-bold text-foreground">{ai.planningActivity.recentApplications.toLocaleString()}</span>
                            : <span className="text-sm text-muted-foreground">Count not available — check the council portal below.</span>
                          }
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
                      <p className="text-xs text-muted-foreground/70 leading-relaxed border-l-2 border-border pl-3">
                        Check the council portal directly before exchange — applications can move fast and won't always appear in this data.
                      </p>
                      <a href={ai.planningActivity.councilPortalUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-2 self-start">
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
                      <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg max-w-[220px]">
                        <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-foreground">Planning activity — Professional</p>
                        <p className="text-[11px] text-muted-foreground mt-1 mb-2">Applications, major developments, and the council portal link.</p>
                        <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rental Demand — Investor */}
                {user?.plan === "investor" ? (
                  <CollapsibleSection title="Rental Demand" testId="section-rental-demand" defaultOpen={false}>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Demand Level</span>
                          <span className="text-base font-bold text-[#B8860B]">{ai.rentalDemand?.demandLevel ?? "—"}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Void Risk <EstimateTag /></span>
                          <span className="text-base font-bold text-foreground">{ai.rentalDemand?.voidRisk ?? "—"}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Tenant Profile</span>
                          <span className="text-sm font-medium text-foreground">{ai.rentalDemand?.tenantProfile ?? "—"}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Supply Trend <EstimateTag /></span>
                          <span className="text-sm font-medium text-foreground">{ai.rentalDemand?.supplyTrend ?? "—"}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{ai.rentalDemand?.note ?? ""}</p>
                    </div>
                  </CollapsibleSection>
                ) : isPaid ? (
                  <div className="relative" data-testid="section-rental-demand-locked">
                    <div className="blur-sm pointer-events-none select-none opacity-60">
                      <Card className="p-5 sm:p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-sm">Rental Demand</h3>
                        </div>
                        <div className="h-24 bg-muted rounded" />
                      </Card>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg max-w-[220px]">
                        <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-foreground">Rental Demand — Investor</p>
                        <p className="text-[11px] text-muted-foreground mt-1 mb-2">Void risk, tenant profile, supply trend.</p>
                        <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Nearby Development Tracker — Investor */}
                {user?.plan === "investor" ? (
                  <CollapsibleSection title="Nearby Development Tracker" testId="section-developments" defaultOpen={false}>
                    <NearbyDevelopmentTracker developments={ai.nearbyDevelopments ?? []} />
                  </CollapsibleSection>
                ) : isPaid ? (
                  <div className="relative" data-testid="section-developments-locked">
                    <div className="blur-sm pointer-events-none select-none opacity-60">
                      <Card className="p-5 sm:p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Construction className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-sm">Nearby Development Tracker</h3>
                        </div>
                        <div className="h-24 bg-muted rounded" />
                      </Card>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg max-w-[220px]">
                        <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-foreground">Development Tracker — Investor</p>
                        <p className="text-[11px] text-muted-foreground mt-1 mb-2">Nearby planning applications with impact scores.</p>
                        <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Nearby Sold Prices Map — Professional+ */}
                {isPaid ? (
                  <CollapsibleSection title="Nearby Sold Prices" testId="section-sold-prices-map" defaultOpen={false}>
                    {report.lat && report.lng ? (
                      <div className="space-y-4">
                        <SoldPricesMap lat={report.lat} lng={report.lng} postcode={ai.location} />
                        {(() => {
                          const interp = deriveMapInterpretation(ai);
                          return interp ? (
                            <div className="flex items-start gap-3 p-3.5 rounded-lg border border-border/40 bg-muted/30">
                              <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                              <p className="text-xs text-muted-foreground leading-relaxed">{interp}</p>
                            </div>
                          ) : null;
                        })()}
                        <p className="text-xs text-muted-foreground/60">Source: HM Land Registry Price Paid Data. Prices shown are registered sale prices — not asking prices.</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Location coordinates not available for this postcode.</p>
                    )}
                  </CollapsibleSection>
                ) : (
                  <div className="relative" data-testid="section-sold-prices-locked">
                    <div className="blur-sm pointer-events-none select-none opacity-60">
                      <Card className="p-5 sm:p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <MapPin className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-sm">Nearby Sold Prices</h3>
                        </div>
                        <div className="h-32 bg-muted rounded" />
                      </Card>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-background/95 border border-border rounded-lg px-4 py-3 text-center shadow-lg max-w-[220px]">
                        <Lock className="h-4 w-4 text-primary mx-auto mb-1.5" />
                        <p className="text-xs font-semibold text-foreground">Sold Prices Map — Professional</p>
                        <p className="text-[11px] text-muted-foreground mt-1 mb-2">Map of recent sold prices within 500m.</p>
                        <Link href="/pricing"><span className="text-xs text-primary underline underline-offset-2">Upgrade to unlock</span></Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Street Price Ranking — Investor */}
                {user?.plan === "investor" && (
                  <CollapsibleSection title="Street Price Ranking" testId="section-street-ranking" defaultOpen={false}>
                    <StreetPriceRanking postcode={ai.location} lat={report.lat} lng={report.lng} />
                  </CollapsibleSection>
                )}

              </TabsContent>

            </Tabs>

          </div>{/* end space-y-0 outer wrapper */}

          {/* Bottom CTA */}
          <div className="mt-10 pt-8 border-t border-border/40">
            {/* Custom Report Branding — Investor only */}
            {user?.plan === "investor" && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Add your name to the PDF <span className="font-normal normal-case tracking-normal">(optional)</span>
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
                Generated from public market data — HM Land Registry, ONS, Environment Agency &amp; more.<br />
                Not a substitute for professional survey or legal advice.
              </p>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                <Link href="/">
                  <Button variant="outline" size="sm" data-testid="button-new-search">
                    New search
                  </Button>
                </Link>
                <Link href={`/compare?a=${encodeURIComponent(report?.postcode || "")}`}>
                  <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-compare">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Compare
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
