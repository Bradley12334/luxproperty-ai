/**
 * UpgradePreview.tsx
 * ──────────────────
 * Shown to free (Explorer) and Professional users at the point of highest buyer
 * intent — right after the free area Verdict — to preview the locked tiers for
 * THE POSTCODE THEY JUST SEARCHED, not a generic feature list.
 *
 * Design constraints honoured here:
 *  - The teaser lines above each blur use REAL, postcode-specific counts pulled
 *    from the already-generated report (e.g. "14 comparable sold prices found").
 *    These counts are non-sensitive META — they match what the user gets after
 *    upgrading, so nothing shown here is invented.
 *  - The actual paid FIGURES (rents, yields, comp prices, fair-value numbers) are
 *    NOT rendered here. The blurred area is a structural skeleton only, so the
 *    locked detail is not readable by inspecting this component's DOM.
 *  - NOTE on server-side gating: this app generates the brief client-side, so the
 *    full report object necessarily lives in the browser. We surface only counts/
 *    existence here; truly server-side gating of the paid figures would require
 *    moving generation server-side (a separate, larger change — see notes).
 *  - Every count is guarded: data-thin postcodes fall back to a truthful generic
 *    line rather than a fake number.
 */

import { Link } from "wouter";
import { Lock, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BriefReport } from "@shared/schema";

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

interface TierBlockProps {
  tier: "Professional" | "Investor";
  price: string;
  headline: string;
  teasers: string[];
  ctaLabel: string;
  testId: string;
}

function TierBlock({ tier, price, headline, teasers, ctaLabel, testId }: TierBlockProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-primary/25 bg-card"
      data-testid={testId}
    >
      {/* Real, postcode-specific teaser header — deliberately NOT blurred */}
      <div className="px-5 sm:px-6 pt-5">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] bg-primary/10 text-primary border border-primary/25">
          <Lock className="h-2.5 w-2.5" aria-hidden="true" /> {tier} · {price}
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground leading-snug">{headline}</p>
        <ul className="mt-3 space-y-2">
          {teasers.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-foreground/80">
              <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Blurred structural skeleton (no real figures) with an unlock CTA overlaid */}
      <div className="relative mt-4">
        <div
          className="blur-[6px] pointer-events-none select-none opacity-50 px-5 sm:px-6 pb-8 pt-2"
          aria-hidden="true"
        >
          <div className="space-y-2.5">
            {[82, 64, 74, 56, 70].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-2.5 rounded bg-muted" style={{ width: `${w}%` }} />
                <div className="h-2.5 rounded bg-muted ml-auto" style={{ width: "16%" }} />
              </div>
            ))}
          </div>
        </div>
        {/* CTA overlaid on the blur — the classic paywall treatment */}
        <div className="absolute inset-0 flex items-center justify-center px-5 sm:px-6">
          <div className="w-full">
            <Link href="/pricing" className="block">
              <Button
                className="w-full h-11 text-[13px] font-semibold"
                data-testid={`${testId}-cta`}
              >
                {ctaLabel} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-2 text-[11px] text-muted-foreground text-center leading-relaxed">
              Preview of paid content · A buying agent charges hundreds per property · Cancel anytime
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UpgradePreview({
  report,
  isPaid,
  isInvestor,
}: {
  report: BriefReport;
  isPaid: boolean;      // Professional or Investor
  isInvestor: boolean;  // Investor (or bonus Investor brief)
}) {
  // Investor already has everything — nothing to preview.
  if (isInvestor) return null;

  const ai = report.areaIntelligence;
  const pdd = report.propertyDeepDive;

  // ── Real, postcode-specific counts (present client-side for every plan) ──────
  const soldCount = ai.recentSoldPrices?.length ?? 0;
  const devCount = (ai.nearbyDevelopments ?? []).filter(
    (d) => d.name && !/no major schemes/i.test(d.name),
  ).length;
  const planningApps = ai.planningActivity?.recentApplications ?? 0;
  const crimeCats = ai.crimeStats?.topCategories?.length ?? 0;
  const hasRental = !!ai.rentalMarket?.oneBedAskingRent;
  const hasFairValue = !!(
    pdd?.offerStrategy?.fairValueRange || ai.negotiationLeverage?.offerRange?.fairValue
  );

  // ── Professional teasers — real first, truthful generic fallback if data-thin ─
  const proTeasers: string[] = [];
  if (soldCount > 0) proTeasers.push(`${plural(soldCount, "comparable sold price")} found for this postcode`);
  if (hasFairValue) proTeasers.push("Fair-value range & pre-offer strategy ready");
  if (planningApps > 0) proTeasers.push(`${plural(planningApps, "planning application")} in the last 12 months`);
  if (crimeCats >= 2) proTeasers.push(`Full crime breakdown across ${crimeCats} categories`);
  if (hasRental) proTeasers.push("Rental yields for 1, 2 & 3-bed homes");
  if (proTeasers.length === 0) {
    proTeasers.push("Comparable sales, fair-value range & pre-offer strategy for this postcode");
  }

  // ── Investor teasers ─────────────────────────────────────────────────────────
  const invTeasers: string[] = [];
  if (soldCount > 0) invTeasers.push(`${plural(soldCount, "sold price")} mapped street-by-street`);
  if (devCount > 0) invTeasers.push(`${plural(devCount, "nearby development")} in the tracker`);
  invTeasers.push("10-year price trend for this postcode");
  if (hasRental) invTeasers.push("Rental demand score & days-to-let");

  return (
    <div className="space-y-3" data-testid="section-upgrade-preview">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        There's more in this brief
      </p>
      {!isPaid && (
        <TierBlock
          tier="Professional"
          price="£4.99/mo"
          headline="Unlock comparable sales, fair-value range & pre-offer strategy"
          teasers={proTeasers.slice(0, 4)}
          ctaLabel="Unlock with Professional"
          testId="upgrade-preview-professional"
        />
      )}
      <TierBlock
        tier="Investor"
        price="£39.99/mo"
        headline="Add 10-year trends, rental demand & portfolio tools"
        teasers={invTeasers.slice(0, 4)}
        ctaLabel="Add Investor tools"
        testId="upgrade-preview-investor"
      />
    </div>
  );
}
