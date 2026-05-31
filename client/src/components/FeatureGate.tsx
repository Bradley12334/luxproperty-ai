/**
 * FeatureGate.tsx
 * ───────────────
 * Wraps a premium feature. If the visitor has not given their email, it
 * renders a teaser CTA instead. Once they submit, the real content renders.
 *
 * Usage:
 *   <FeatureGate featureName="investment_score">
 *     <InvestmentScoreBreakdown />
 *   </FeatureGate>
 *
 * The gate state is persisted in localStorage so it survives page reloads
 * without requiring a server round-trip on every render.
 */

import { useState, useCallback, useEffect } from "react";
import { Lock, TrendingUp, Star, Bell, BarChart3 } from "lucide-react";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Feature identifiers — add new ones here as the product grows */
export type GatedFeature =
  | "ai_market_insights"
  | "investment_score"
  | "save_property"
  | "price_alerts"
  | string; // allow arbitrary strings for future features

export interface FeatureGateProps {
  /** Identifier stored in Supabase for attribution analytics */
  featureName: GatedFeature;
  /** The premium content to reveal after capture */
  children: React.ReactNode;
  /** Optional: override the default teaser card entirely */
  teaser?: React.ReactNode;
  /** Optional: override headline in the modal for this feature */
  modalHeadline?: string;
  /** Optional: override subtext in the modal for this feature */
  modalSubtext?: string;
}

// ─── localStorage helpers ────────────────────────────────────────────────────

const STORAGE_KEY = "lux_email_captured";

function hasEmailCaptured(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // localStorage may be blocked in some privacy modes
    return false;
  }
}

// ─── Per-feature teaser config ────────────────────────────────────────────────

interface TeaserConfig {
  icon: React.ElementType;
  label: string;
  headline: string;
  bullets: string[];
  ctaLabel: string;
  modalHeadline: string;
  modalSubtext: string;
}

const FEATURE_TEASERS: Record<string, TeaserConfig> = {
  ai_market_insights: {
    icon: BarChart3,
    label: "AI Analysis",
    headline: "AI Market Insights",
    bullets: [
      "Demand trend vs 12 months ago",
      "Price-per-sqft vs area average",
      "Rental yield forecast",
      "AI-generated buy/wait recommendation",
    ],
    ctaLabel: "See Full AI Analysis",
    modalHeadline: "Unlock Full Market Insights",
    modalSubtext:
      "Enter your email to see complete AI analysis, price trends, and investment scores for this property.",
  },
  investment_score: {
    icon: TrendingUp,
    label: "Investment Score",
    headline: "Investment Score Breakdown",
    bullets: [
      "Capital growth potential (5-yr)",
      "Rental yield vs postcode average",
      "Liquidity & resale demand score",
      "Risk-adjusted return estimate",
    ],
    ctaLabel: "See Investment Score",
    modalHeadline: "Unlock Your Investment Score",
    modalSubtext:
      "Get a full breakdown of capital growth potential, rental yield, and risk metrics for this property.",
  },
  save_property: {
    icon: Star,
    label: "Save Property",
    headline: "Save to Your Portfolio",
    bullets: [
      "Track price changes over time",
      "Compare saved properties side-by-side",
      "Export to PDF for your advisor",
      "Set a target price alert",
    ],
    ctaLabel: "Save This Property",
    modalHeadline: "Save Properties to Your Portfolio",
    modalSubtext:
      "Enter your email to save this property, track price changes, and build your shortlist.",
  },
  price_alerts: {
    icon: Bell,
    label: "Price Alerts",
    headline: "Price & Market Alerts",
    bullets: [
      "Get notified when this property drops",
      "Area price movement weekly digest",
      "Similar properties that just listed",
      "Sold prices in the last 6 months",
    ],
    ctaLabel: "Set Up Alerts",
    modalHeadline: "Get Price & Market Alerts",
    modalSubtext:
      "Enter your email to receive price drop alerts and weekly market updates for this area.",
  },
};

// Fallback config for any unrecognised feature name
const DEFAULT_TEASER: TeaserConfig = {
  icon: Lock,
  label: "Premium",
  headline: "Premium Feature",
  bullets: [
    "In-depth local market data",
    "AI-powered property analysis",
    "Comparable sales & price trends",
  ],
  ctaLabel: "Get Access",
  modalHeadline: "Unlock Full Market Insights",
  modalSubtext:
    "Enter your email to access complete AI analysis, price trends, and investment data.",
};

// ─── Teaser card ─────────────────────────────────────────────────────────────

function TeaserCard({
  config,
  onCtaClick,
}: {
  config: TeaserConfig;
  onCtaClick: () => void;
}) {
  const Icon = config.icon;

  return (
    <div
      className="relative overflow-hidden rounded-xl border p-6"
      style={{
        background: "#1A1612",
        borderColor: "#2A2420",
      }}
    >
      {/* Subtle gold gradient at the top edge */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, #B8860B 40%, #B8860B 60%, transparent)",
          opacity: 0.5,
        }}
      />

      {/* Header row */}
      <div className="mb-5 flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "rgba(184,134,11,0.12)" }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color: "#B8860B" }} aria-hidden="true" />
        </div>
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "#B8860B" }}
          >
            {config.label}
          </p>
          <h3
            className="text-base font-semibold leading-snug"
            style={{ color: "#FAF8F4", fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            {config.headline}
          </h3>
        </div>
      </div>

      {/* Bullet preview — blurred to hint at what's locked */}
      <ul className="mb-5 space-y-2" aria-hidden="true">
        {config.bullets.map((bullet, i) => (
          <li
            key={i}
            className="flex items-center gap-2 text-sm"
            style={{
              color: "#9A9490",
              // Progressive blur: first bullet clear, rest increasingly blurred
              filter: i === 0 ? "none" : `blur(${i * 1.5}px)`,
              opacity: i === 0 ? 1 : 0.6,
            }}
          >
            <span
              className="h-1 w-1 shrink-0 rounded-full"
              style={{ background: "#B8860B" }}
            />
            {bullet}
          </li>
        ))}
      </ul>

      {/* Lock overlay over the blurred bullets — decorative */}
      <div className="pointer-events-none absolute inset-x-6 bottom-20 flex justify-center">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: "rgba(26,22,18,0.9)", border: "1px solid #2A2420" }}
        >
          <Lock className="h-3.5 w-3.5" style={{ color: "#9A9490" }} />
        </div>
      </div>

      {/* CTA button */}
      <button
        type="button"
        onClick={onCtaClick}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors"
        style={{ background: "#B8860B", color: "#FAF8F4" }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "#9A7A0A")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "#B8860B")
        }
      >
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        {config.ctaLabel}
      </button>

      <p className="mt-2.5 text-center text-[11px]" style={{ color: "#5A5450" }}>
        Free — no payment required
      </p>
    </div>
  );
}

// ─── FeatureGate ─────────────────────────────────────────────────────────────

export function FeatureGate({
  featureName,
  children,
  teaser,
  modalHeadline,
  modalSubtext,
}: FeatureGateProps) {
  // Initialise from localStorage so there's no flash on re-visits
  const [unlocked, setUnlocked] = useState<boolean>(() => hasEmailCaptured());
  const [showModal, setShowModal] = useState(false);

  // If another tab or component unlocks, sync the state
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue === "true") {
        setUnlocked(true);
        setShowModal(false);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleSuccess = useCallback(() => {
    setUnlocked(true);
    setShowModal(false);
  }, []);

  const handleClose = useCallback(() => {
    setShowModal(false);
  }, []);

  // Already unlocked — render the real feature
  if (unlocked) {
    return <>{children}</>;
  }

  // Resolve teaser config
  const config = FEATURE_TEASERS[featureName] ?? DEFAULT_TEASER;

  return (
    <>
      {/* Render provided teaser override, or the default card */}
      {teaser ? (
        <div onClick={() => setShowModal(true)} style={{ cursor: "pointer" }}>
          {teaser}
        </div>
      ) : (
        <TeaserCard config={config} onCtaClick={() => setShowModal(true)} />
      )}

      {/* Modal — rendered via portal-style fixed overlay */}
      {showModal && (
        <EmailCaptureModal
          sourceFeature={featureName}
          onSuccess={handleSuccess}
          onClose={handleClose}
          headline={modalHeadline ?? config.modalHeadline}
          subtext={modalSubtext ?? config.modalSubtext}
        />
      )}
    </>
  );
}

// ─── Convenience hook ─────────────────────────────────────────────────────────
/**
 * useEmailCaptured()
 * Returns { captured, markCaptured } — useful when you want to gate non-component
 * things (e.g. a button click handler that downloads a PDF).
 *
 * Example:
 *   const { captured, markCaptured } = useEmailCaptured();
 *   if (!captured) { showModal(); return; }
 *   downloadPdf();
 */
export function useEmailCaptured() {
  const [captured, setCaptured] = useState<boolean>(() => hasEmailCaptured());

  const markCaptured = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setCaptured(true);
  }, []);

  return { captured, markCaptured };
}
