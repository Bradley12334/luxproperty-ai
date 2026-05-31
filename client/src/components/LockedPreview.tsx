/**
 * LockedPreview.tsx
 * ─────────────────
 * A purely static placeholder shown in place of premium sections for locked
 * (free-tier) users. Contains NO real data from the ai/report objects — only
 * fake skeleton rows and generic copy.
 *
 * Rules:
 *  - Never pass real ai.* values into this component
 *  - All "numbers" and "text" shown are fixed placeholder strings
 *  - Safe to render for any user tier — no data leaks
 */

import { Lock } from "lucide-react";
import { Link } from "wouter";

interface LockedPreviewProps {
  /** Short title shown in the card header */
  title: string;
  /** One-line description of what the section contains */
  description: string;
  /** Which plan unlocks this (default: "Professional") */
  planLabel?: string;
  /** Pricing page href (default: "/pricing") */
  pricingHref?: string;
  /** How many skeleton rows to render (default: 3) */
  skeletonRows?: number;
  /** test id for the container */
  testId?: string;
}

export function LockedPreview({
  title,
  description,
  planLabel = "Professional",
  pricingHref = "/pricing",
  skeletonRows = 3,
  testId,
}: LockedPreviewProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border"
      style={{ background: "#1A1612", borderColor: "#2A2420" }}
      data-testid={testId}
    >
      {/* Subtle gold top edge */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, #B8860B 40%, #B8860B 60%, transparent)",
          opacity: 0.4,
        }}
      />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "#2A2420" }}>
        <div className="flex items-center justify-between">
          <p
            className="text-sm font-semibold"
            style={{ color: "#FAF8F4", fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            {title}
          </p>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              background: "rgba(184,134,11,0.12)",
              color: "#B8860B",
              border: "1px solid rgba(184,134,11,0.25)",
            }}
          >
            <Lock className="h-2.5 w-2.5" aria-hidden="true" />
            {planLabel}
          </span>
        </div>
      </div>

      {/* Fake skeleton rows — NO real data */}
      <div className="px-5 py-4 space-y-3" aria-hidden="true">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className="h-2 rounded"
              style={{
                background: "#2A2420",
                width: `${[52, 68, 44][i % 3]}%`,
              }}
            />
            <div
              className="h-2 rounded ml-auto"
              style={{ background: "#2A2420", width: "18%" }}
            />
          </div>
        ))}
        {/* Extra wider skeleton to mimic a paragraph */}
        <div className="pt-1 space-y-1.5">
          <div className="h-1.5 rounded" style={{ background: "#2A2420", width: "88%" }} />
          <div className="h-1.5 rounded" style={{ background: "#2A2420", width: "74%" }} />
          <div className="h-1.5 rounded" style={{ background: "#2A2420", width: "60%" }} />
        </div>
      </div>

      {/* Lock overlay */}
      <div className="px-5 pb-5">
        <div
          className="rounded-lg px-4 py-3.5 flex items-start gap-3"
          style={{ background: "rgba(42,36,32,0.8)", border: "1px solid #2A2420" }}
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5"
            style={{ background: "rgba(184,134,11,0.12)", border: "1px solid rgba(184,134,11,0.25)" }}
          >
            <Lock className="h-3.5 w-3.5" style={{ color: "#B8860B" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold mb-0.5" style={{ color: "#FAF8F4" }}>
              {title} — {planLabel}
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: "#9A9490" }}>
              {description}
            </p>
            <Link href={pricingHref}>
              <span
                className="inline-block mt-2 text-xs font-semibold underline underline-offset-2"
                style={{ color: "#B8860B" }}
              >
                Upgrade to unlock →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
