import { createContext, useContext, useEffect, useState, type FormEvent } from "react";
import { useParams, Link, useLocation } from "wouter";
import { authHeader, getUser } from "@/lib/authStore";
import { startFullBriefCheckout } from "@/lib/fullBriefCheckout";
import { track } from "@/lib/analytics";
import { AuthModal } from "@/components/auth-modal";
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
  ShoppingCart,
  UtensilsCrossed,
  Stethoscope,
  Store,
  Wifi,
  Wind,
  Receipt,
  Landmark,
  Coins,
  KeyRound,
  ShieldCheck,
  Building2,
  Gauge,
  Lock,
  ArrowRight,
  Loader2,
  Download,
  MailCheck,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────────
 * Brief page. Takes a postcode, calls GET /api/brief (with the signed-in userId so
 * the server resolves plan + quota), shows the reused stepping loader over the
 * ~20-30s generation, and renders the full section set in every render state.
 *
 * TIER GATING is server-side: the payload already contains only what the plan is
 * entitled to. Locked sections arrive as { state:"LOCKED", title, description, cta }
 * and render as titled upgrade previews (LockedSection), never gaps. The quota
 * funnel (QuotaFunnel) nudges anonymous → sign-in and tracks Explorer's 3/month;
 * an over-quota response renders OverQuotaScreen (a clean 200, not an error).
 * ──────────────────────────────────────────────────────────────────────────── */

// ── Payload types (mirror lib/brief/generate.js) ─────────────────────────────
type SectionState = "DATA" | "SPARSE" | "UNAVAILABLE" | "LOCKED" | "COMING_SOON" | "PENDING";
interface Money { raw: number | null; formatted: string }
interface Pct { raw: number | null; formatted: string; direction?: "up" | "down" | "flat" }
interface TrendRow {
  year: number; count: number; median: Money; change: Pct;
  // The range the year's own sales support — shown for low-volume years, where the
  // median is real but its uncertainty is the point.
  range: { low: number; high: number; formatted: string } | null;
  medianWithheld: string | null;
  changeSuppressed: string | null;
  state: "data" | "sparse" | "missing";
}
interface LeveragePoint { signal: string; text: string }
export interface BriefSection {
  key: string;
  title: string;
  minTier: "EXP" | "PRO" | "INV";
  state: SectionState;
  note?: string | null;
  sourceFootnote?: string;
  sourceNote?: string;
  disclaimer?: string;
  // Sold-price provenance. Present whenever the price spine came from the offline
  // PPD aggregate; null on the legacy live-scan path, which has no publication date.
  asOf?: { published: string; label: string; statement: string; refreshOverdue: boolean } | null;
  // Set when the resolved postcode sector diverges from its district by more than
  // sampling error — i.e. the district figure is the wrong level for this address.
  sectorNote?: string | null;
  sectorVerdict?: "warn" | "none" | null;
  // The sector's own median, stated as a figure. Present whenever the sector
  // diverges beyond sampling error — it is the fact the withholding copy promises
  // the reader keeps, so it must be RENDERED, not merely described.
  sectorFigure?: {
    sector: string;
    median: Money;
    count: number | null;
    range: { low: number; high: number; formatted: string } | null;
    vsDistrict: { pct: number; formatted: string } | null;
  } | null;
  entitled?: boolean;
  comingSoon?: boolean;
  pending?: boolean;
  // LOCKED-state fields (server-built upgrade preview; data is null when locked).
  description?: string;
  requiredTier?: "EXP" | "PRO" | "INV";
  requiredTierLabel?: string;
  cta?: { label: string; target: string };
  // Truncated-preview fields (server, lib/brief/gate.js): a locked section may tease its
  // leading rows in `preview` while `data` stays null. Only nearbySoldPrices (2 rows) and
  // streetPriceRanking (top 3) carry these today.
  previewTruncated?: boolean;
  preview?: any;
  data: any;
}
// Server-computed quota snapshot (lib/brief/quota.js → quotaStatus).
interface QuotaStatus {
  tier: string;
  authenticated: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  unlimited: boolean;
  exceeded: boolean;
  month: string;
  resetsOn: string;
}
interface BriefMeta {
  postcode: string; outcode: string; outcodeOnly?: boolean; ward: string; localAuthority: string;
  region: string | null; country: string; tier: string;
  window: { startYear: number; endYear: number };
  transactionCount: number; truncated: boolean; cached: boolean; generatedAt: string;
  cacheLayer?: "memory" | "durable" | "live";
  dataError?: { code: string; retryable?: boolean } | null;
}
interface BriefPayload { ok: true; meta: BriefMeta; sections: BriefSection[]; quota?: QuotaStatus; fullBriefOwned?: boolean }
interface BriefErrorResp { ok: false; error: { code: string; message: string } }
// Clean over-quota response (HTTP 200, not an error) — Explorer used its 2/month.
// The wall copy is composed client-side (OverQuotaScreen) from `requested`.
interface QuotaExceededResp {
  ok: true;
  quotaExceeded: true;
  quota: QuotaStatus;
  requested?: { postcode: string; outcode: string };
}
// Clean anonymous soft-gate response (HTTP 200, not an error): a guest has already used
// their one free brief and asked for a different area. The SignUpGateScreen composes an
// encouraging "create a free account to continue" prompt from `requested`.
interface SignupRequiredResp {
  ok: true;
  signupRequired: true;
  requested?: { postcode: string; outcode: string };
}
// Clean verified-email-required response (HTTP 200, not an error): a signed-in account
// hasn't confirmed its email yet. VerifyEmailGate shows a "confirm your email" state and
// reuses the existing resend-verification action.
interface VerifyEmailResp {
  ok: true;
  verifyEmailRequired: true;
}

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
        <p className="text-sm text-muted-foreground mb-2">
          Live HM Land Registry data — this typically takes 20–30 seconds.
        </p>
        <p className="text-xs text-muted-foreground/70 mb-8">
          First look at this area? Pulling fresh HM Land Registry data can take up to a minute.
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
    <Badge variant="outline" className="no-print ml-auto text-[10px] font-semibold uppercase tracking-wide">
      {tier}
    </Badge>
  );
}

function SectionHeading({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  tier?: "EXP" | "PRO" | "INV";
  children: React.ReactNode;
}) {
  // DELIBERATE entitled-view change (tier-badge cleanup, commit 2/2): the tier badge is now
  // removed EVERYWHERE, entitled included. A £14.99 owner resolves to INV and would otherwise
  // see "PRO"/"INV" on sections they've just unlocked — reading as "tiers I still don't have"
  // exactly when the purchase should feel complete; the badge names a tier the viewer can't
  // act on. `tier` stays in the prop type (call sites still pass it) but is no longer
  // rendered. Revert THIS commit alone to restore the entitled-only badges.
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary mb-4">
      {icon}
      {children}
    </h3>
  );
}

// The id of the single Full Brief unlock banner (SaveBriefAffordance) at the top of a
// brief. Locked-section tags scroll to it — one unlock CTA, not N competing buttons.
const FULL_BRIEF_BANNER_ID = "full-brief-unlock";

// ── "In the full brief" tag ──────────────────────────────────────────────────
// The calm marker on a locked section. Tapping scrolls to the single unlock banner
// at the top of the brief (the £14.99 Full Brief / Investor CTA lives there).
function InFullBriefTag() {
  return (
    <button
      type="button"
      onClick={() => {
        // Scroll to the single unlock banner (Explorer). If it isn't present — e.g. a
        // grandfathered Professional, for whom the £14.99 banner is hidden — fall back
        // to the plans page (Investor) rather than a dead tap.
        const el = document.getElementById(FULL_BRIEF_BANNER_ID);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        else window.location.assign("/pricing");
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
      data-testid="tag-in-full-brief"
    >
      <Lock className="h-3 w-3" />
      In the full brief
    </button>
  );
}

// ── Brief location context ────────────────────────────────────────────────────
// The viewed brief's outcode/postcode/tier, provided once at the render root so every
// LockedSection's unlock CTA can target the correct district without threading props
// through renderSection. Consumed ONLY by locked cards, which render ONLY in the
// non-entitled view — an entitled viewer never sees a LockedSection, so this leaves the
// entitled view untouched.
const BriefLocationContext = createContext<{ outcode: string; postcode: string; tier: string; window?: { startYear: number; endYear: number } } | null>(null);

// ── Free-view truncation (step 2) ──────────────────────────────────────────────
// A semi-hidden section shows its leading rows, fades the tail (SCREEN ONLY — fades don't
// print), and appends a count line naming what's missing. No button (only the keep-cards +
// the collapse block carry the CTA); the £14.99 price rides along as a PRINT-ONLY line so
// it still appears on paper (FIX 1 pattern). None of this renders for entitled viewers.
function FadeTail({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <div className="no-print pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

function CountLine({ line }: { line: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Lock className="h-3.5 w-3.5 text-primary/70" /> {line}
    </div>
  );
}

// Print-only price line — fades and the on-screen CTA don't print, so carry the £14.99 on
// paper (FIX 1 pattern). One per truncated section.
function PrintPrice({ outcode }: { outcode: string }) {
  return <p className="print-only mt-1 text-xs font-semibold text-foreground">Unlock {outcode} — £14.99</p>;
}

function MoreLine({ line, outcode }: { line: string; outcode: string }) {
  return (
    <div className="mt-2">
      <CountLine line={line} />
      <PrintPrice outcode={outcode} />
    </div>
  );
}

function TruncatedFade({ line, outcode, children }: { line: string; outcode: string; children: React.ReactNode }) {
  return (
    <div>
      <FadeTail>{children}</FadeTail>
      <MoreLine line={line} outcode={outcode} />
    </div>
  );
}

// ── Per-locked-card unlock CTA ─────────────────────────────────────────────────
// The real £14.99 one-off unlock, on the card itself. Reuses the SINGLE existing
// checkout entry point (startFullBriefCheckout) — no new route, endpoint or Stripe
// call — with the same signed-in / already-owned / error handling as the top banner
// (SaveBriefAffordance). Shown to any NON-ENTITLED viewer of this card — EXP (free) and
// grandfathered PRO alike: a Full Brief purchase resolves the outcode to INV and unlocks
// it, so a PRO viewer of an INV-locked section now has a route to buy. INV plans/owners
// never render a locked card, so they never see this.
function LockedCardCta({ outcode, postcode }: { outcode: string; postcode: string }) {
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onUnlock() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const r = await startFullBriefCheckout(postcode, outcode);
    if (r.status === "redirecting") return; // navigating to Stripe — keep the spinner
    if (r.status === "signin-required") { setAuthOpen(true); setBusy(false); return; }
    if (r.status === "already-owned") { navigate(`/brief/${encodeURIComponent(r.outcode || outcode)}`); return; }
    setNote(r.message); // error
    setBusy(false);
  }

  return (
    <>
      <div className="flex flex-col items-start gap-1.5">
        <Button
          size="sm"
          onClick={onUnlock}
          disabled={busy}
          className="font-semibold"
          data-testid="button-unlock-locked-section"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>Unlock {outcode} — £14.99<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></>
          )}
        </Button>
        {/* Print hides <button> (index.css @media print), so the price would vanish on
            paper. Carry the SAME label as a print-only line — screen render is unchanged
            (.print-only is display:none on screen, block in print). */}
        <p className="print-only text-sm font-semibold text-foreground">Unlock {outcode} — £14.99</p>
        <p className="text-[11px] text-muted-foreground">
          Unlocks every postcode in {outcode} — as many properties as you view, permanently.
        </p>
        {note && <p className="text-xs text-destructive" data-testid="text-unlock-error">{note}</p>}
      </div>
      <AuthModal open={authOpen} defaultTab="signup" onClose={() => setAuthOpen(false)} />
    </>
  );
}

// ── Generic LOCKED section — a titled preview, never a gap ─────────────────────
// The server (lib/brief/gate.js) drops a locked section's data and sends only
// { title, description, requiredTier }. This renders it as a preview with a real
// per-card unlock CTA for any non-entitled viewer (EXP or grandfathered PRO), alongside
// the single banner at the top. INV plans/owners never render a locked card.
export function LockedSection({ section }: { section: BriefSection }) {
  const tier = section.requiredTier ?? section.minTier;
  const loc = useContext(BriefLocationContext);
  // Only EXP and PRO viewers ever reach a locked card (INV/owner are entitled to
  // everything), so tier !== "INV" == "a non-entitled viewer who can buy the £14.99
  // one-off to unlock this outcode". Fall back to the calm tag only if context is absent.
  return (
    <Card className="relative overflow-hidden border-dashed p-6">
      <SectionHeading icon={<Lock className="h-3.5 w-3.5" />} tier={tier}>
        {section.title}
      </SectionHeading>
      <p className="max-w-prose text-sm text-muted-foreground">
        {section.description ?? "Part of the full brief."}
      </p>
      <div className="mt-4">
        {loc && loc.tier !== "INV"
          ? <LockedCardCta outcode={loc.outcode} postcode={loc.postcode} />
          : <InFullBriefTag />}
      </div>
    </Card>
  );
}

// ── Truncated-row preview — real leading rows behind a locked overlay ──────────
// The server (lib/brief/gate.js) sends a locked section's first few rows in `preview`
// (data stays null). We feed those rows to the SAME section component as a normal DATA
// section, fade the bottom to signal there's more, and place the real unlock CTA below.
// Only nearbySoldPrices (2 rows) and streetPriceRanking (top 3) take this path.
function LockedPreview({
  section,
  Component,
}: {
  section: BriefSection;
  Component: React.ComponentType<{ section: BriefSection }>;
}) {
  const loc = useContext(BriefLocationContext);
  // Render the real component over ONLY the sliced rows the server sent.
  const previewSection: BriefSection = { ...section, state: "DATA", data: section.preview };
  // Street preview carries its own summary figures (per-outcode, from the server payload —
  // never hardcoded): total streets ranked + the price range. Surface them in the overlay.
  const p = section.preview;
  const overlayLine =
    p && typeof p.qualifyingCount === "number" && p.range?.highest?.formatted && p.range?.lowest?.formatted
      ? `Preview — ${p.qualifyingCount} streets ranked, ${p.range.lowest.formatted} to ${p.range.highest.formatted}. Full ranking locked.`
      : "Preview — the full list is locked.";
  return (
    <div>
      {/* FIX 5: rows render fully — nothing overlaps them. The previous design faded and
          overlaid the CTA on top of the last row; a still-visible fade necessarily covers
          content, so it's removed. The preview line + unlock CTA now sit BELOW the rows. */}
      <Component section={previewSection} />
      <div className="mt-3 flex flex-col items-start gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-primary" /> {overlayLine}
        </div>
        {loc && loc.tier !== "INV"
          ? <LockedCardCta outcode={loc.outcode} postcode={loc.postcode} />
          : <InFullBriefTag />}
      </div>
    </div>
  );
}

// FIX 2: only these locked sections keep a full card in the free view (comps & street
// as truncated previews; pre-offer & crime as full locked cards). EVERY other locked
// section is collapsed into one "Also in the full brief" block, rendered once at the end
// — replacing the wall of consecutive locked cards.
const KEEP_LOCKED_FULL = new Set(["nearbySoldPrices", "streetPriceRanking", "preOfferQuestions", "crimeBreakdown", "planning"]);

// A locked section that is NOT kept as a full card → collapsed into the aggregate block
// (so it is not rendered inline). Only ever true in the non-entitled view (entitled
// viewers have no LOCKED sections), so the entitled view is unaffected.
function isCollapsedLocked(section: BriefSection | undefined): boolean {
  return !!section && section.state === "LOCKED" && !KEEP_LOCKED_FULL.has(section.key);
}

// Render a section, intercepting LOCKED so every gated slot becomes a preview.
function renderSection(
  section: BriefSection | undefined,
  Component: React.ComponentType<{ section: BriefSection }>,
) {
  if (!section) return null;
  if (section.state === "LOCKED") {
    // Collapsed locked sections are rendered once in the aggregate block, not inline.
    if (isCollapsedLocked(section)) return null;
    // A kept locked section that carries teaser rows → truncated preview; otherwise the
    // generic titled locked card.
    if (section.previewTruncated && section.preview) {
      return <LockedPreview section={section} Component={Component} />;
    }
    return <LockedSection section={section} />;
  }
  return <Component section={section} />;
}

// FIX 2: the single collapsed block that replaces the wall of locked cards. Lists the
// remaining locked sections by their EXISTING titles (no wording change) + one shared
// £14.99 CTA for the whole block. Renders only when there are collapsed sections — i.e.
// never in the entitled view, so the entitled view stays byte-identical.
function AlsoInFullBrief({ sections }: { sections: BriefSection[] }) {
  const loc = useContext(BriefLocationContext);
  if (sections.length === 0) return null;
  return (
    <Card className="border-dashed p-6">
      <SectionHeading icon={<Lock className="h-3.5 w-3.5" />}>Also in the full brief</SectionHeading>
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {sections.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm text-foreground">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
            <span className="truncate">{s.title}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        {loc && loc.tier !== "INV"
          ? <LockedCardCta outcode={loc.outcode} postcode={loc.postcode} />
          : <InFullBriefTag />}
      </div>
    </Card>
  );
}

// ── Quota funnel — sign-in nudge (anonymous) / usage tracker (Explorer) ───────
function QuotaFunnel({ quota }: { quota?: QuotaStatus }) {
  if (!quota) return null;

  // Anonymous: the funnel — sign in to save briefs and track the 2 free monthly briefs.
  if (!quota.authenticated) {
    return (
      <Card className="flex flex-col gap-3 border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">
            You’re browsing as a guest. <span className="font-medium text-foreground">Sign in free</span> to save your
            briefs and track your <span className="font-medium text-foreground">2 free briefs each month</span>.
          </span>
        </div>
        <Link href="/signup">
          <Button size="sm" variant="outline" className="shrink-0 gap-1.5">
            Create free account
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </Card>
    );
  }

  // Professional / Investor: unlimited — a quiet confirmation, no nag.
  if (quota.unlimited) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        Unlimited briefs on your {quota.tier === "INV" ? "Investor" : "Professional"} plan.
      </p>
    );
  }

  // Explorer (signed in): usage tracker toward the monthly limit (dynamic — quota.limit).
  const remaining = quota.remaining ?? 0;
  return (
    <Card className="flex flex-col gap-2 border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          {remaining} of {quota.limit} free {quota.limit === 1 ? "brief" : "briefs"} left
        </span>{" "}
        this month{quota.remaining === 0 ? "" : ` · resets ${formatResetDate(quota.resetsOn)}`}.
      </div>
      <Link href="/pricing">
        <Button size="sm" variant="outline" className="shrink-0 gap-1.5">
          Go unlimited
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </Card>
  );
}

// ── Over-quota screen — clean, not an error ──────────────────────────────────
// Sell-not-scold, contextual to the postcode they just tried. Both paths: the £14.99
// Full Brief on THIS district (hero) + Investor unlimited. If the tried postcode isn't
// purchasable (empty outcode), the generic "any postcode" variant renders instead so
// the buy button never targets nothing.
function OverQuotaScreen({ resp }: { resp: QuotaExceededResp }) {
  const { quota, requested } = resp;
  const outcode = requested?.outcode ?? "";
  const postcode = requested?.postcode ?? "";
  const hasPC = outcode.length > 0;

  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function buyFull() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const r = await startFullBriefCheckout(postcode, outcode);
    if (r.status === "redirecting") return; // navigating to Stripe — keep the spinner
    if (r.status === "signin-required") { setAuthOpen(true); setBusy(false); return; }
    if (r.status === "already-owned") { window.location.href = `/brief/${encodeURIComponent(r.outcode || outcode)}`; return; }
    setNote(r.message); // error
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h2 className="font-serif text-2xl tracking-tight mb-2">
        {hasPC
          ? "You’ve screened two areas this month — here’s the full picture on the next one."
          : "You’ve screened two areas this month"}
      </h2>
      <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
        {hasPC ? (
          <>
            Serious about <span className="font-medium text-foreground">{outcode}</span>? Unlock the full brief — every
            section at Investor depth, saved to your account and yours to keep. Or go unlimited across every district with
            Investor.
          </>
        ) : (
          <>
            Unlock the full brief on any postcode — every section at Investor depth, saved to your account and yours to
            keep. Or go unlimited across every district with Investor.
          </>
        )}
      </p>

      <div className="flex flex-col items-center gap-3">
        {hasPC ? (
          <Button className="gap-1.5 font-semibold" onClick={buyFull} disabled={busy} data-testid="button-wall-full-brief">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Unlock {outcode} — £14.99<ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
        ) : (
          <Link href="/pricing">
            <Button className="gap-1.5 font-semibold" data-testid="button-wall-full-brief">
              Get the full brief — £14.99
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
        <p className="text-xs text-muted-foreground">
          {hasPC
            ? `Permanent access to ${outcode} — revisit and regenerate it free, forever.`
            : "Permanent access to the postcode you buy — revisit and regenerate it free, forever."}
        </p>
        <Link href="/pricing" className="text-sm text-primary underline-offset-4 hover:underline" data-testid="link-wall-investor">
          See Investor — £39.99/mo, unlimited everything
        </Link>
        {note && <p className="text-xs text-destructive" data-testid="text-wall-error">{note}</p>}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Your free briefs reset on {formatResetDate(quota.resetsOn)}.
      </p>
      <AuthModal open={authOpen} defaultTab="signup" onClose={() => setAuthOpen(false)} />
    </div>
  );
}

// ── Sign-up gate — the anonymous soft gate (one free brief used) ──────────────
// Encouraging, not punitive: the guest has SEEN the product work, so we invite them to
// create a free account to keep exploring new areas. Not an error, not a paywall — a
// warm nudge. Their first brief (and its postcode) carries over on sign-up.
function SignUpGateScreen({ resp }: { resp: SignupRequiredResp }) {
  const outcode = resp.requested?.outcode ?? "";
  const hasPC = outcode.length > 0;
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h2 className="font-serif text-2xl tracking-tight mb-2">
        Create a free account to keep exploring
      </h2>
      <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
        You’ve used your free area screening{hasPC ? <> and you’re onto <span className="font-medium text-foreground">{outcode}</span></> : null}.
        It’s free to keep going — create an account and we’ll save the brief you just generated to{" "}
        <span className="font-medium text-foreground">My briefs</span>, plus give you more free screenings each month.
      </p>

      <div className="flex flex-col items-center gap-3">
        <Button className="gap-1.5 font-semibold" onClick={() => setAuthOpen(true)} data-testid="button-gate-signup">
          Create free account
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground">
          No card required · your first brief comes with you.
        </p>
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          className="text-sm text-primary underline-offset-4 hover:underline"
          data-testid="link-gate-signin"
        >
          Already have an account? Sign in
        </button>
      </div>

      <AuthModal open={authOpen} defaultTab="signup" onClose={() => setAuthOpen(false)} />
    </div>
  );
}

// ── Verify-email gate — signed in, but email not confirmed ────────────────────
// Reuses the EXISTING verification flow (no second flow): the same resend-verification
// endpoint as the checkout gate (use-checkout.tsx). The confirmation email was already
// sent at sign-up; clicking its link (/verify-email) flips the flag and the next
// generation proceeds.
function VerifyEmailGate() {
  const email = getUser()?.email ?? "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function resend() {
    if (resending || resent || !email) return;
    setResending(true);
    try {
      await fetch("/api/auth-email?action=resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } catch {
      /* quiet — the endpoint never reveals account existence */
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <MailCheck className="h-5 w-5 text-primary" />
      </div>
      <h2 className="font-serif text-2xl tracking-tight mb-2">Confirm your email to continue</h2>
      <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
        We’ve sent a confirmation link{email ? <> to <span className="font-medium text-foreground">{email}</span></> : null}.
        Click it to verify your address and your brief will generate straight away. This is a one-time step that keeps
        your account secure.
      </p>
      <div className="flex flex-col items-center gap-3">
        <Button className="gap-1.5 font-semibold" onClick={resend} disabled={resending || resent} data-testid="button-verify-resend">
          {resending ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
          ) : resent ? (
            "Confirmation email sent"
          ) : (
            "Resend confirmation email"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Already confirmed? Refresh this page after clicking the link in your email.
        </p>
      </div>
    </div>
  );
}

function formatResetDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return "the 1st";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
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
    <div className="print-keep space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-serif text-2xl tabular-nums text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ── Executive Summary (EXP) ──────────────────────────────────────────────────
interface ExecSignal { label: string; value: string; source: string }
interface ExecSummaryData {
  headline: string;
  classification: { trajectory: string; trajectoryLabel: string; activity: string; activityLabel: string } | null;
  paragraphs: string[];
  signals: ExecSignal[];
}

function trajectoryTone(key?: string): "info" | "warn" | "danger" | "ok" {
  if (key === "rising" || key === "firming") return "ok";
  if (key === "softening") return "warn";
  if (key === "falling") return "danger";
  return "info";
}

function ExecutiveSummarySection({ section }: { section: BriefSection }) {
  const d = section.data as ExecSummaryData | null;
  const isUnavailable = section.state === "UNAVAILABLE";
  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<Sparkles className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>

        {d?.classification && (
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[11px]">{d.classification.trajectoryLabel}</Badge>
            <Badge variant="outline" className="text-[11px]">{d.classification.activityLabel} sales activity</Badge>
          </div>
        )}

        {section.state === "SPARSE" && section.note && (
          <div className="mb-4">
            <Callout tone="warn" icon={<AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>
              {section.note}
            </Callout>
          </div>
        )}

        <div className={`space-y-3 text-sm leading-relaxed ${isUnavailable ? "text-muted-foreground" : "text-foreground"}`}>
          {(d?.paragraphs ?? []).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>

      {/* Provenance ledger — every read above traces to one of these payload fields */}
      {d?.signals?.length ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Behind these figures</p>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {d.signals.map((s, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-1.5">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className="text-right text-sm tabular-nums text-foreground" title={s.source}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── The rebuilt section: Prices, Trend & Negotiation ─────────────────────────
function PricesSection({ section }: { section: BriefSection }) {
  // Free view (step 2): the trend table is already server-trimmed to 1 year for EXP; add
  // the fade + count line. Entitled sees the full depth as today.
  const loc = useContext(BriefLocationContext);
  const entitled = loc?.tier !== "EXP";
  const outcode = loc?.outcode ?? "";
  const postcode = loc?.postcode ?? "";
  const win = loc?.window;
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

  const { marketOverview: mo, trend, negotiation: neg, priceRange } = section.data;

  return (
    <Card className="p-6 space-y-8">
      <div>
        <SectionHeading icon={<BarChart3 className="h-3.5 w-3.5" />}>{section.title}</SectionHeading>

        {/* Dated on every render, not only when stale — the reader should never have
            to assume how current a price figure is. */}
        {section.asOf && (
          <p className="mb-3 text-xs text-muted-foreground">{section.asOf.statement}</p>
        )}

        {/* The sector's own median, beside the district's. Rendered BEFORE the note
            so the note's reference to "the sector's own median" is true of the page. */}
        {section.sectorFigure && (
          <div className="mb-5 rounded-lg border border-primary/40 bg-primary/5 p-4">
            <div className="mb-2 text-xs uppercase tracking-wide text-primary">
              Sector {section.sectorFigure.sector} — this address
            </div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <div className="font-serif text-2xl tabular-nums text-foreground">
                {section.sectorFigure.median.formatted}
              </div>
              {section.sectorFigure.count != null && (
                <div className="text-xs text-muted-foreground">
                  from {section.sectorFigure.count.toLocaleString()} recorded sales
                </div>
              )}
              {section.sectorFigure.vsDistrict && (
                <div className="text-xs text-muted-foreground">
                  {section.sectorFigure.vsDistrict.formatted} vs the district
                </div>
              )}
            </div>
            {section.sectorFigure.range && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                Likely range {section.sectorFigure.range.formatted}
              </div>
            )}
          </div>
        )}

        {/* Sector divergence: the district figure is the wrong level for this address. */}
        {section.sectorNote && (
          <div className="mb-5 flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p className="text-muted-foreground">{section.sectorNote}</p>
          </div>
        )}

        {section.state === "SPARSE" && section.note && (
          <div className="mb-5 flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p className="text-muted-foreground">{section.note}</p>
          </div>
        )}

        {/* Too few sales to state a typical price. The recorded sales survive as
            facts; the count and the SPREAD are stated so the list below cannot be
            read as an implied average. marketOverview is null in this state. */}
        {!mo && (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Recorded sales" value={String(section.data.totalTransactions ?? 0)} sub="in this district" />
            {priceRange && (
              <Stat label="Range of those sales" value={`${priceRange.low.formatted} – ${priceRange.high.formatted}`} sub="lowest to highest" />
            )}
          </div>
        )}

        {/* Market overview */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label={`${mo.latestYear.year} median`} value={mo.latestYear.median.formatted} sub={`${mo.latestYear.count} sales`} />
          {/* Label from the true data-window start (meta.window), NOT the visible trend's
              first row — for a free viewer the trend is trimmed to 1yr, so trend.rows[0].year
              was 2025 while windowMedian is the full-window (2016–2025) median. Entitled is
              unchanged: win.startYear === trend.rows[0].year when the full trend is shown. */}
          <Stat label={`${win?.startYear ?? trend.rows[0].year}–${mo.latestYear.year} median`} value={mo.windowMedian.formatted} sub={`${mo.totalTransactions} sales`} />
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
        {(() => {
          const trendTable = (
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
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {r.median.formatted}
                        {r.state === "sparse" && r.range && (
                          <div className="text-[10px] font-normal text-muted-foreground">{r.range.formatted}</div>
                        )}
                      </td>
                      <td className={`py-2 text-right tabular-nums ${changeColor(r.change.direction ?? dirOf(r.change.raw))}`}>{r.change.formatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          const hiddenYears = win ? win.endYear - win.startYear + 1 - trend.rows.length : 0;
          return !entitled && win && hiddenYears > 0 ? (
            <TruncatedFade line={`${hiddenYears} more years (${win.startYear}–${win.endYear}) in the full brief`} outcode={outcode}>
              {trendTable}
            </TruncatedFade>
          ) : trendTable;
        })()}
        {Array.isArray(trend.notes) && trend.notes.length > 0 && (
          <div className="mt-3 space-y-1">
            {trend.notes.map((n: string) => (
              <p key={n} className="text-xs text-muted-foreground">{n}</p>
            ))}
          </div>
        )}
      </div>

      {/* Negotiation / pre-offer — PRO. Below PRO the server sends neg.locked with
          the figures dropped; render a preview instead of an empty block. */}
      <div>
        <SectionHeading icon={<Handshake className="h-3.5 w-3.5" />} tier={neg.locked ? "PRO" : undefined}>
          Pre-Offer & Negotiation
        </SectionHeading>

        {neg.locked ? (
          <div className="rounded-lg border border-dashed border-border p-4">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Fair-value range, suggested opening range and buyer leverage points are part of the full brief.
              </span>
            </p>
            {/* FIX 4: Pre-Offer & Negotiation is the highest-value locked content, so it
                gets the real £14.99 unlock CTA (not just the scroll-to-banner tag). */}
            <div className="mt-3">
              {loc && loc.tier !== "INV"
                ? <LockedCardCta outcode={outcode} postcode={postcode} />
                : <InFullBriefTag />}
            </div>
            {neg.notAValuationNote && (
              <p className="mt-4 text-xs italic text-muted-foreground">{neg.notAValuationNote}</p>
            )}
          </div>
        ) : (
        <>
        {/* A deliberate omission must LOOK deliberate. An unexplained blank where a
            number used to be reads as a load failure, which is worse than the figure
            we removed — so the reason renders in the space the ranges vacated. */}
        {neg.withheld && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-primary">
              <Info className="h-3.5 w-3.5" />
              No negotiation range quoted
            </div>
            <p className="text-sm text-muted-foreground">{neg.withheld}</p>
          </div>
        )}

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
        </>
        )}
      </div>

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Recent sales in {outcode} (PRO) — key `nearbySoldPrices` (contract) ──────
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
    <div className="print-keep flex items-start justify-between gap-4 border-b border-border/50 py-3 last:border-0">
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

      {section.sourceNote && <p className="print-footnote text-[11px] text-muted-foreground">{section.sourceNote}</p>}
      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Street Price Ranking (INV) ───────────────────────────────────────────────
interface StreetRow {
  street: string;
  count: number;
  median: Money;
  // The band the street's own sales actually support. Shown because two streets a
  // few percent apart are not distinguishable, and a bare median hides that.
  range: { low: number; high: number; formatted: string } | null;
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
            <th className="py-2 pr-4 font-medium text-right">Likely range</th>
            <th className="py-2 font-medium text-right">vs area</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.street} className="border-b border-border/50">
              <td className="py-2 pr-4">{r.street}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{r.count}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{r.median.formatted}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground text-xs">
                {r.range ? r.range.formatted : "—"}
              </td>
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

  const { top, bottom, areaMedian, blockClaim } = section.data as {
    top: StreetRow[]; bottom: StreetRow[]; areaMedian: Money | null; blockClaim: boolean;
  };

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
            Area median across all listed streets: <span className="font-medium text-foreground tabular-nums">{areaMedian.formatted}</span>. Streets are grouped into a dearer and a cheaper set, not placed in order — the gaps between neighbouring streets are smaller than the uncertainty in their medians. The sale count shows how much evidence sits behind each.
          </p>
        )}
      </div>

      {top.length > 0 && (
        <div>
          {bottom.length > 0 && blockClaim && (
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dearer streets</div>
          )}
          <StreetList rows={top} />
        </div>
      )}

      {bottom.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cheaper streets</div>
          <StreetList rows={bottom} />
        </div>
      )}

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
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
            <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
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
          {/* No print fallback table here: the same sales are already listed in
           * full in the "Recent sales" section above. Only the map is hidden
           * in print; the low/median/high summary stats above survive. */}
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
              <div key={p.id} className="print-keep flex items-start justify-between gap-4 border-b border-border/50 py-3 last:border-0">
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
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
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
  // Free view (step 2): headline rating, planning zone, insurance line, live-warning status
  // AND the surface-water + subsidence notes stay fully visible (those notes state what we
  // DON'T have data for — fading them would look like withheld product). Only the low-value
  // nearby EA areas list + historic flooding are faded; "Before you offer" moves to the full
  // brief. Entitled sees the whole body, as today.
  const loc = useContext(BriefLocationContext);
  const entitled = loc?.tier !== "EXP";
  const outcode = loc?.outcode ?? "";
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

      {/* Detail body — semi-hidden in the free view (step 2). Free: live warnings + nearby
          EA areas behind a fade + count line; historic flooding, surface water, subsidence
          and "Before you offer" are in the full brief. Entitled: the full body, as today. */}
      {entitled ? (
        <>
          <WarningsBlock warnings={d.warnings} />
          <NearbyAreas nearby={d.nearby} />
          {d.historic?.text && (
            d.historic.flooded ? (
              <Callout tone="warn" icon={<AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>{d.historic.text}</Callout>
            ) : (
              <p className="text-sm text-muted-foreground">{d.historic.text}</p>
            )
          )}
          <GuidanceBlocks guidance={d.guidance} />
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
        </>
      ) : (
        <>
          {/* Fully visible: live-warning status + surface-water and subsidence notes — the
              latter state what we DON'T have data for, so fading them would make honest
              limits look like withheld product. */}
          <WarningsBlock warnings={d.warnings} />
          <GuidanceBlocks guidance={d.guidance} />
          {/* Faded/truncated: the low-value nearby EA areas list + historic flooding. */}
          <TruncatedFade line="Full flood detail in the full brief" outcode={outcode}>
            <div className="space-y-6">
              <NearbyAreas nearby={d.nearby} />
              {d.historic?.text && (
                d.historic.flooded ? (
                  <Callout tone="warn" icon={<AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>{d.historic.text}</Callout>
                ) : (
                  <p className="text-sm text-muted-foreground">{d.historic.text}</p>
                )
              )}
            </div>
          </TruncatedFade>
        </>
      )}

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
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
  // Free view (step 2): the commute headline + note stay; the stations list truncates to
  // the nearest 2 behind a fade + count line. Entitled sees the full list, as today.
  const loc = useContext(BriefLocationContext);
  const entitled = loc?.tier !== "EXP";
  const outcode = loc?.outcode ?? "";
  const truncateStations = !entitled && d.stations.length > 2;
  const shownStations = truncateStations ? d.stations.slice(0, 2) : d.stations;

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
          {(() => {
            const list = (
              <ul className="space-y-2">
                {shownStations.map((s, i) => (
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
            );
            return truncateStations ? (
              <TruncatedFade line={`+${d.stations.length - 2} more stations in the full brief`} outcode={outcode}>{list}</TruncatedFade>
            ) : list;
          })()}
          <p className="mt-3 text-[11px] text-muted-foreground">{d.walkSpeedNote}</p>
        </div>
      )}

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
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
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
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
  // Free view (step 2): nearest 3 behind a fade + count line. Entitled sees all, as today.
  const loc = useContext(BriefLocationContext);
  const entitled = loc?.tier !== "EXP";
  const outcode = loc?.outcode ?? "";
  const truncateSchools = !entitled && d.schools.length > 3;
  const shownSchools = truncateSchools ? d.schools.slice(0, 3) : d.schools;

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

      {hasSchools && (() => {
        const list = (
          <ul className="space-y-2">
            {shownSchools.map((s, i) => (
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
        );
        return truncateSchools ? (
          <TruncatedFade line={`+${d.schools.length - 3} more schools in the full brief`} outcode={outcode}>{list}</TruncatedFade>
        ) : list;
      })()}

      {/* Catchment caveat — always shown */}
      <Callout tone="warn" icon={<Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>{d.catchmentCaveat}</Callout>

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Local Amenities (EXP) ─────────────────────────────────────────────────────
interface AmenityItem { name: string; type: string; distanceMeters: number; distanceLabel: string; walkMins: number | null }
interface AmenityGroup { key: string; label: string; total: number; shown: number; items: AmenityItem[] }
interface AmenitiesData { scope: "point" | "district"; groups: AmenityGroup[]; totalFound: number }

const AMENITY_ICON: Record<string, React.ReactNode> = {
  supermarkets: <ShoppingCart className="h-3.5 w-3.5" />,
  food: <UtensilsCrossed className="h-3.5 w-3.5" />,
  health: <Stethoscope className="h-3.5 w-3.5" />,
};

function AmenityGroupBlock({ group, entitled }: { group: AmenityGroup; entitled: boolean }) {
  // Free view (step 2): show 2 named items per category behind a fade (resolves the
  // "counts with nothing under them / broken fetch" look). Entitled sees the full list.
  const shown = entitled ? group.items : group.items.slice(0, 2);
  const faded = !entitled && group.items.length > 2;
  const list = group.items.length > 0 ? (
    <ul className="space-y-1.5">
      {shown.map((it, i) => (
        <li key={i} className="flex items-center justify-between gap-4 text-sm">
          <span className="min-w-0 truncate text-foreground">
            {it.name}
            <span className="ml-2 text-xs text-muted-foreground">{it.type}</span>
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {it.walkMins ? `${it.walkMins} min` : it.distanceLabel}
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">None recorded within range.</p>
  );
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {AMENITY_ICON[group.key] ?? <Store className="h-3.5 w-3.5" />}
        {group.label}
        <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
          {group.total > group.shown ? `${group.shown} of ${group.total} nearby` : `${group.total} nearby`}
        </span>
      </div>
      {faded ? <FadeTail>{list}</FadeTail> : list}
    </div>
  );
}

function AmenitiesSection({ section }: { section: BriefSection }) {
  const d = section.data as AmenitiesData;
  const hasAny = d.totalFound > 0;
  // Free view (step 2): 2 named items per category behind a fade + one section count line.
  const loc = useContext(BriefLocationContext);
  const entitled = loc?.tier !== "EXP";
  const outcode = loc?.outcode ?? "";

  return (
    <Card className="p-6 space-y-5">
      <div>
        <SectionHeading icon={<Store className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        {section.note && (
          <div className="mb-1">
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
      </div>

      {hasAny && (
        <div className="grid gap-6 sm:grid-cols-3">
          {d.groups.map((g) => (
            <AmenityGroupBlock key={g.key} group={g} entitled={entitled} />
          ))}
        </div>
      )}

      {!entitled && hasAny && <MoreLine line="Full amenity list in the full brief" outcode={outcode} />}

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Broadband & Fibre (PRO) ───────────────────────────────────────────────────
interface BroadbandData {
  avgDownload?: string; avgMbps?: number; fullFibre?: string; fullFibrePct?: number;
  superfast?: string; rating?: string; providers?: string;
  granularity?: "local-authority" | "region" | null; checkerUrl: string;
}

function BroadbandSection({ section }: { section: BriefSection }) {
  const d = section.data as BroadbandData;
  const isData = section.state === "DATA";

  return (
    <Card className="p-6 space-y-5">
      <div>
        <SectionHeading icon={<Wifi className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        {section.note && (
          <div className="mb-4">
            <Callout
              tone={isData ? "info" : "warn"}
              icon={isData ? <Info className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            >
              {section.note}
            </Callout>
          </div>
        )}
      </div>

      {isData && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Avg download</div>
              <div className="font-serif text-2xl tabular-nums text-foreground">{d.avgDownload}</div>
              {d.rating && <div className="mt-1 text-xs text-muted-foreground">{d.rating}</div>}
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Full fibre (FTTP)</div>
              <div className="font-serif text-2xl tabular-nums text-foreground">{d.fullFibre}</div>
              <div className="mt-1 text-xs text-muted-foreground">of premises</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Superfast (≥30 Mbps)</div>
              <div className="font-serif text-2xl tabular-nums text-foreground">{d.superfast}</div>
              <div className="mt-1 text-xs text-muted-foreground">of premises</div>
            </div>
          </div>
          {d.providers && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Providers: </span>{d.providers}
            </div>
          )}
        </>
      )}

      <a href={d.checkerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
        <ExternalLink className="h-3.5 w-3.5" /> Check your address at checker.ofcom.org.uk
      </a>

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Air Quality (PRO) ─────────────────────────────────────────────────────────
interface AirReading { species: string; index: number; band: string | null }
interface AirMonitor { name: string; localAuthority: string | null; distanceLabel: string; distanceMeters: number }
interface AirQualityData {
  monitor: AirMonitor | null;
  band?: string | null; maxIndex?: number | null;
  readings: AirReading[];
  scaleNote: string;
  representativeness: "near" | "caveat" | "far" | "none";
  linkUrl: string;
}

const AIR_BAND_STYLE: Record<string, string> = {
  Low: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  Moderate: "border-amber-500/50 text-amber-700 dark:text-amber-400",
  High: "border-orange-500/50 text-orange-700 dark:text-orange-400",
  "Very High": "border-red-500/50 text-red-700 dark:text-red-400",
};

function AirQualitySection({ section }: { section: BriefSection }) {
  const d = section.data as AirQualityData;
  const showReadings = section.state === "DATA" || section.state === "SPARSE";

  return (
    <Card className="p-6 space-y-5">
      <div>
        <SectionHeading icon={<Wind className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>

        {/* Monitor disclosure is always present when we have one */}
        {d.monitor && (
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>
              Monitor: <span className="text-foreground">{d.monitor.name}</span> · {d.monitor.distanceLabel} away
            </span>
          </div>
        )}

        {section.note && (
          <div className="mb-4">
            <Callout
              tone={section.state === "DATA" ? "info" : "warn"}
              icon={section.state === "DATA" ? <Info className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            >
              {section.note}
            </Callout>
          </div>
        )}
      </div>

      {showReadings && d.readings.length > 0 && (
        <>
          {d.band && (
            <div className={`inline-flex items-center rounded-md border px-3 py-1 font-serif text-lg ${AIR_BAND_STYLE[d.band] ?? "border-border text-foreground"}`}>
              {d.band}
              <span className="ml-2 text-sm font-normal text-muted-foreground">overall (index {d.maxIndex}/10)</span>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {d.readings.map((r) => (
              <div key={r.species} className="rounded-lg border border-border p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{r.species}</div>
                <div className="font-serif text-lg tabular-nums text-foreground">
                  {r.index}<span className="text-sm text-muted-foreground">/10</span>
                </div>
                {r.band && <div className="text-xs text-muted-foreground">{r.band}</div>}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{d.scaleNote}</p>
        </>
      )}

      <a href={d.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
        <ExternalLink className="h-3.5 w-3.5" /> DEFRA UK-AIR
      </a>

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Buying Costs (EXP council tax + PRO stamp duty) ──────────────────────────
interface SdBand { band: string; rate: string; taxed: Money }
interface StampDutyData {
  regime: "SDLT" | "LTT";
  regimeLongName: string;
  atPrice: Money;
  total: Money;
  effectiveRate: string;
  breakdown: SdBand[];
  effectiveDate: string;
  calculatorUrl: string;
  calculatorLabel: string;
  estimateNote: string;
  surchargeNote: string;
  ftbNote: string | null;
  guidance: string[];
}
interface CtBand { band: string; cost: number; formatted: string; isBandD: boolean }
interface CouncilTaxData {
  authority: string; country: string; dataYear: string;
  bandD: Money; bands: CtBand[]; checkerUrl: string;
}
interface BuyingCostsData {
  councilTax: CouncilTaxData | null;
  stampDuty: StampDutyData | null; // populated in Unit 2
  stampDutyEntitled: boolean;
}

function CouncilTaxBlock({ ct, entitled, outcode }: { ct: CouncilTaxData; entitled: boolean; outcode: string }) {
  // Free view (step 2): keep Band D fully visible; the A–H band table shows the first 4
  // bands behind a fade + count line. Entitled sees the full grid, as today.
  const truncate = !entitled && ct.bands.length > 4;
  const shownBands = truncate ? ct.bands.slice(0, 4) : ct.bands;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Receipt className="h-3.5 w-3.5" />
        Council tax · {ct.authority}
        <span className="font-normal normal-case tracking-normal text-muted-foreground/70">{ct.dataYear}</span>
      </div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Band D</span>
        <span className="font-serif text-2xl tabular-nums text-foreground">{ct.bandD.formatted}</span>
        <span className="text-xs text-muted-foreground">/ year</span>
      </div>
      {(() => {
        const grid = (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {shownBands.map((b) => (
              <div
                key={b.band}
                className={`rounded-md border p-2 text-center ${
                  b.isBandD ? "border-primary/50 bg-primary/5" : "border-border"
                }`}
              >
                <div className={`text-[11px] font-semibold uppercase ${b.isBandD ? "text-primary" : "text-muted-foreground"}`}>
                  {b.band}
                </div>
                <div className="mt-0.5 text-[11px] tabular-nums text-foreground">{b.formatted}</div>
              </div>
            ))}
          </div>
        );
        return truncate ? (
          <TruncatedFade line="Full A–H council tax band table in the full brief" outcode={outcode}>{grid}</TruncatedFade>
        ) : grid;
      })()}
      <a
        href={ct.checkerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Confirm the band & current charge at gov.uk
      </a>
    </div>
  );
}

function StampDutyBlock({ sd }: { sd: StampDutyData }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Landmark className="h-3.5 w-3.5" />
        {sd.regime === "LTT" ? "Land transaction tax (Wales)" : "Stamp duty (SDLT)"}
        {/* DELIBERATE entitled-view change (commit 2/2): retired "PRO" tier badge removed —
            an entitled viewer shouldn't see a tier name they can't act on. */}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated {sd.regime}</div>
          <div className="font-serif text-2xl tabular-nums text-foreground">{sd.total.formatted}</div>
          <div className="text-xs text-muted-foreground">effective rate {sd.effectiveRate}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">At area median</div>
          <div className="font-serif text-xl tabular-nums text-foreground">{sd.atPrice.formatted}</div>
        </div>
      </div>

      {/* Estimate-not-liability label */}
      <Callout tone="warn" icon={<Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>{sd.estimateNote}</Callout>

      {sd.breakdown.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Band</th>
                <th className="py-2 pr-4 font-medium text-right">Rate</th>
                <th className="py-2 font-medium text-right">Tax on portion</th>
              </tr>
            </thead>
            <tbody>
              {sd.breakdown.map((b) => (
                <tr key={b.band} className="border-b border-border/50">
                  <td className="py-2 pr-4 tabular-nums">{b.band}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{b.rate}</td>
                  <td className="py-2 text-right tabular-nums">{b.taxed.formatted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <p><span className="font-medium text-foreground">Additional property: </span>{sd.surchargeNote}</p>
        {sd.ftbNote && <p><span className="font-medium text-foreground">First-time buyers: </span>{sd.ftbNote}</p>}
      </div>

      <ul className="mt-4 space-y-2">
        {sd.guidance.map((g, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{g}</span>
          </li>
        ))}
      </ul>

      <a
        href={sd.calculatorUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" /> {sd.calculatorLabel}
      </a>
      <p className="mt-2 text-[11px] text-muted-foreground">{sd.regimeLongName} rates effective {sd.effectiveDate}.</p>
    </div>
  );
}

function BuyingCostsSection({ section }: { section: BriefSection }) {
  const d = section.data as BuyingCostsData;
  // Free view (step 2): keep the Band D figure; the A–H table truncates behind a fade.
  const loc = useContext(BriefLocationContext);
  const entitled = loc?.tier !== "EXP";
  const outcode = loc?.outcode ?? "";

  if (section.state === "UNAVAILABLE" || !d.councilTax) {
    return (
      <Card className="p-6">
        <SectionHeading icon={<Coins className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        <div className="flex items-start gap-3 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p>{section.note}</p>
        </div>
        {section.sourceFootnote && (
          <p className="mt-4 print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<Coins className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        {section.note && (
          <div className="mb-5">
            <Callout tone="info" icon={<Info className="h-4 w-4 text-primary" />}>{section.note}</Callout>
          </div>
        )}
      </div>

      <CouncilTaxBlock ct={d.councilTax} entitled={entitled} outcode={outcode} />

      {/* Stamp duty (PRO block): computed at the area median for entitled plans; a
          non-entitled plan sees a titled upgrade preview instead (never a gap). */}
      {d.stampDuty ? (
        <div className="border-t border-border/50 pt-6">
          <StampDutyBlock sd={d.stampDuty} />
        </div>
      ) : !d.stampDutyEntitled ? (
        <div className="rounded-lg border border-dashed border-border p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Landmark className="h-3.5 w-3.5" /> Stamp duty estimate
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Estimated SDLT at the area median, with the additional-property surcharge and leasehold checks.
          </p>
          {/* FIX 4: bare lock — no CTA. Stamp duty stays in place beside the council-tax
              figures; the dashed border signals it's locked. The single unlock action lives
              on the Pre-Offer block / top banner, not repeated here. */}
        </div>
      ) : null}

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Rental Snapshot (PRO) ─────────────────────────────────────────────────────
interface RentBenchmark { key: string; label: string; monthly: number; formatted: string }
interface RentalYield { localMedian: Money; low: string; high: string; range: string; basis: string }
interface RentalSnapshotData {
  region: string;
  regionLabel: string;
  benchmarks: RentBenchmark[];
  yield: RentalYield | null;
}

function RentalSnapshotSection({ section }: { section: BriefSection }) {
  if (section.state === "UNAVAILABLE" || !section.data) {
    return (
      <Card className="p-6">
        <SectionHeading icon={<KeyRound className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        <div className="flex items-start gap-3 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p>{section.note}</p>
        </div>
        {section.sourceFootnote && (
          <p className="mt-4 print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
        )}
      </Card>
    );
  }

  const d = section.data as RentalSnapshotData;

  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<KeyRound className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        {/* Granularity honesty — always shown; regional, never implied-local */}
        {section.note && (
          <div className="mb-5">
            <Callout tone="warn" icon={<Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>{section.note}</Callout>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {d.regionLabel} rent benchmarks · VOA PRMS 2024
        </div>
        <div className="grid grid-cols-3 gap-4">
          {d.benchmarks.map((b) => (
            <div key={b.key} className="rounded-lg border border-border p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{b.label}</div>
              <div className="font-serif text-xl tabular-nums text-foreground">{b.formatted}</div>
            </div>
          ))}
        </div>
      </div>

      {d.yield && (
        <div className="rounded-lg border border-border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Indicative gross yield</div>
          <div className="font-serif text-2xl tabular-nums text-foreground">{d.yield.range}</div>
          <div className="mt-2 text-xs text-muted-foreground">{d.yield.basis}</div>
        </div>
      )}

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Crime Breakdown (PRO) ─────────────────────────────────────────────────────
interface CrimeCategory { key: string; label: string; count: number; pct: number }
interface CrimeBreakdownData {
  month: string; when: string; total: number;
  categories: CrimeCategory[];
  radiusFrame: string; guidance: string; centre: string;
}

function CrimeBreakdownSection({ section }: { section: BriefSection }) {
  if (section.state === "UNAVAILABLE" || !section.data) {
    return (
      <Card className="p-6">
        <SectionHeading icon={<ShieldCheck className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        <div className="flex items-start gap-3 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p>{section.note}</p>
        </div>
        {section.sourceFootnote && (
          <p className="mt-4 print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
        )}
      </Card>
    );
  }

  const d = section.data as CrimeBreakdownData;
  const maxCount = d.categories.length ? d.categories[0].count : 0;

  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<ShieldCheck className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        {section.note && (
          <div className="mb-5">
            <Callout
              tone={section.state === "DATA" ? "info" : "warn"}
              icon={section.state === "DATA" ? <Info className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            >
              {section.note}
            </Callout>
          </div>
        )}
      </div>

      {d.total > 0 && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-serif text-3xl tabular-nums text-foreground">{d.total.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">recorded crimes · {d.when}</span>
          </div>

          <div className="space-y-2">
            {d.categories.map((c) => (
              <div key={c.key} className="print-keep flex items-center gap-3">
                <div className="w-40 shrink-0 truncate text-sm text-foreground">{c.label}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${maxCount ? Math.max(2, (c.count / maxCount) * 100) : 0}%` }}
                  />
                </div>
                <div className="w-24 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                  {c.count.toLocaleString()} · {c.pct}%
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Neighbourhood Profile / Lifestyle Fit (EXP) ──────────────────────────────
interface LifestyleDim {
  key: string; title: string; tier: string; label: string;
  summary: string; inputs: { label: string; value: string }[]; note: string | null;
}
interface SentimentBlock {
  available: boolean; asOf: string | null; text: string | null; label: string; disclaimer: string;
}
interface NeighbourhoodData {
  scope: string; ratedCount: number; dimensions: LifestyleDim[]; sentiment: SentimentBlock;
}

function tierClasses(tier: string): string {
  switch (tier) {
    case "excellent": return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "good": return "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
    case "fair": return "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300";
    case "limited": return "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300";
    default: return "border-border bg-muted/40 text-muted-foreground"; // insufficient
  }
}

function NeighbourhoodSection({ section }: { section: BriefSection }) {
  const d = section.data as NeighbourhoodData | null;
  // Free view (step 2, added later): each lifestyle card shows title + rating badge; the
  // metric rows truncate behind a fade with a per-card count line. Entitled sees all.
  const loc = useContext(BriefLocationContext);
  const entitled = loc?.tier !== "EXP";
  const outcode = loc?.outcode ?? "";
  // (a) Gate the "Each rating lists the exact inputs behind it." sentence to entitled
  // viewers — with rows hidden it is no longer true for a free viewer. This depends on that
  // EXACT substring in lib/brief/sections/neighbourhood.js → sourceFootnote; if that copy
  // ever changes, the replace safely no-ops and the free viewer just sees the full caveat.
  const EXACT_INPUTS_SENTENCE = " Each rating lists the exact inputs behind it.";
  const footnote = entitled
    ? section.sourceFootnote
    : (section.sourceFootnote ?? "").replace(EXACT_INPUTS_SENTENCE, "");
  if (!d) {
    return (
      <Card className="p-6">
        <SectionHeading icon={<Home className="h-3.5 w-3.5" />} tier={section.minTier}>{section.title}</SectionHeading>
        <div className="flex items-start gap-3 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p>{section.note ?? "Neighbourhood profile is unavailable for this postcode."}</p>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<Home className="h-3.5 w-3.5" />} tier={section.minTier}>{section.title}</SectionHeading>
        {section.note && (
          <div className="mb-4">
            <Callout tone="info" icon={<Info className="h-4 w-4 text-primary" />}>{section.note}</Callout>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {d.dimensions.map((dim) => (
            <div key={dim.key} className="print-keep rounded-lg border border-border/60 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{dim.title}</span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tierClasses(dim.tier)}`}>
                  {dim.label}
                </span>
              </div>
              {(() => {
                // Insufficient dims have NO input rows — the note IS the content (an honest
                // "no data" limit, like flood's surface-water note); always shown.
                if (dim.tier === "insufficient") {
                  return <p className="text-xs text-muted-foreground">{dim.note}</p>;
                }
                const fullBody = (
                  <dl className="space-y-1">
                    {dim.inputs.map((inp, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
                        <dt className="text-muted-foreground">{inp.label}</dt>
                        <dd className="text-right text-foreground">{inp.value}</dd>
                      </div>
                    ))}
                    {dim.note && <p className="pt-1 text-[11px] text-muted-foreground">{dim.note}</p>}
                  </dl>
                );
                if (entitled) return fullBody;
                // Free view: first input row visible, the rest faded + count line. Every card
                // shows a row (a single input; insufficient cards show the note above).
                if (dim.inputs.length <= 1) return fullBody; // nothing to truncate
                const firstRow = (
                  <dl className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <dt className="text-muted-foreground">{dim.inputs[0].label}</dt>
                      <dd className="text-right text-foreground">{dim.inputs[0].value}</dd>
                    </div>
                  </dl>
                );
                return (
                  <>
                    <FadeTail>{firstRow}</FadeTail>
                    <div className="mt-2"><CountLine line={`+${dim.inputs.length - 1} more`} /></div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* One print-only £14.99 for the whole section (per-card lines carry the counts). */}
      {!entitled && <PrintPrice outcode={outcode} />}

      {/* Resident sentiment — folded, labelled, dated qualitative sub-block */}
      <div className="rounded-lg border border-dashed border-border/70 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">Resident sentiment</span>
          {d.sentiment.available && d.sentiment.asOf && (
            <Badge variant="outline" className="text-[10px]">Curated · as of {d.sentiment.asOf}</Badge>
          )}
        </div>
        {d.sentiment.available ? (
          <>
            <p className="text-sm leading-relaxed text-foreground">{d.sentiment.text}</p>
            <p className="mt-3 text-[11px] text-muted-foreground">{d.sentiment.disclaimer}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{d.sentiment.disclaimer}</p>
        )}
      </div>

      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{footnote}</p>
      )}
    </Card>
  );
}

// ── Pre-offer Questions (PRO) ────────────────────────────────────────────────
interface QuestionGroup { key: string; heading: string; trigger: string; questions: string[] }
interface PreOfferQuestionsData { triggeredCount: number; groups: QuestionGroup[] }

function PreOfferQuestionsSection({ section }: { section: BriefSection }) {
  const d = section.data as PreOfferQuestionsData | null;
  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<FileText className="h-3.5 w-3.5" />} tier={section.minTier}>{section.title}</SectionHeading>
        {section.note && (
          <div className="mb-4">
            <Callout tone="info" icon={<Info className="h-4 w-4 text-primary" />}>{section.note}</Callout>
          </div>
        )}
      </div>
      <div className="space-y-4">
        {(d?.groups ?? []).map((g) => {
          const isUniversal = g.key === "universal";
          return (
            <div key={g.key} className={`rounded-lg border p-4 ${isUniversal ? "border-dashed border-border/70" : "border-border/60"}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{g.heading}</span>
                {!isUniversal && <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Triggered</Badge>}
              </div>
              <p className="mb-3 text-xs text-muted-foreground">{isUniversal ? g.trigger : <><span className="font-medium text-foreground">Why: </span>{g.trigger}</>}</p>
              <ul className="space-y-2">
                {g.questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {section.sourceFootnote && (
        <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
  );
}

// ── Planning Activity & Risk Flags (PRO) ─────────────────────────────────────
interface Designation { dataset: string; label: string; meaning: string; name: string; reference: string | null; date: string | null; year: string | null; documentUrl: string | null }
interface RiskFlag { key: string; severity: "info" | "watch" | "elevated"; label: string; trigger: string }
interface PlanningData {
  designationsFetched: boolean; designationSummary: string;
  designations: Designation[]; flags: RiskFlag[];
  portal: { url: string; curated: boolean }; lpaName: string | null; applicationsNote: string;
}

function flagClasses(sev: string): string {
  if (sev === "elevated") return "border-red-500/40 bg-red-500/5";
  if (sev === "watch") return "border-amber-500/40 bg-amber-500/5";
  return "border-primary/30 bg-primary/5";
}

function PlanningActivitySection({ section }: { section: BriefSection }) {
  if (section.state === "UNAVAILABLE" || !section.data) {
    return (
      <Card className="p-6">
        <SectionHeading icon={<Landmark className="h-3.5 w-3.5" />} tier={section.minTier}>{section.title}</SectionHeading>
        <div className="flex items-start gap-3 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <p>{section.note}</p>
        </div>
        {section.sourceFootnote && <p className="mt-4 print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>}
      </Card>
    );
  }
  const d = section.data as PlanningData;
  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<Landmark className="h-3.5 w-3.5" />} tier={section.minTier}>{section.title}</SectionHeading>
        {section.note && (
          <div className="mb-4"><Callout tone="warn" icon={<AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>{section.note}</Callout></div>
        )}
      </div>

      {/* Risk flags */}
      {d.flags.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Risk flags</p>
          <div className="space-y-2">
            {d.flags.map((f) => (
              <div key={f.key} className={`rounded-md border p-3 ${flagClasses(f.severity)}`}>
                <div className="text-sm font-medium text-foreground">{f.label}</div>
                <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Trigger: </span>{f.trigger}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Designations */}
      <div>
        <p className="mb-2 text-sm text-muted-foreground">{d.designationSummary}</p>
        {d.designations.length > 0 && (
          <div className="space-y-2">
            {d.designations.map((des, i) => (
              <div key={i} className="rounded-md border border-border/60 p-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-foreground">{des.label}</span>
                  <span className="text-sm text-muted-foreground">— {des.name}</span>
                  {des.year && <span className="text-xs text-muted-foreground">· designated {des.year}</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{des.meaning}</p>
                {des.documentUrl && (
                  <a href={des.documentUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Designation document <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live applications link-out */}
      <Callout tone="info" icon={<Info className="h-4 w-4 text-primary" />}>
        <p>{d.applicationsNote}</p>
        <a href={d.portal.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline">
          {d.portal.curated ? "Open the council planning portal" : "Find your council's planning portal"} <ExternalLink className="h-3 w-3" />
        </a>
      </Callout>

      {section.sourceFootnote && <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>}
    </Card>
  );
}

// ── Development Tracker (INV) ────────────────────────────────────────────────
interface DevScheme { name: string; type: string; status: string; impact: "Positive" | "Neutral" | "Monitor"; detail: string }
interface DevTrackerData { curated: boolean; asOf: string | null; schemes: DevScheme[]; portal: { url: string; curated: boolean } }

function impactClasses(impact: string): string {
  if (impact === "Positive") return "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
  if (impact === "Monitor") return "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300";
  return "border-border bg-muted/40 text-muted-foreground";
}

function DevelopmentTrackerSection({ section }: { section: BriefSection }) {
  const d = section.data as DevTrackerData | null;
  return (
    <Card className="p-6 space-y-5">
      <div>
        <SectionHeading icon={<Building2 className="h-3.5 w-3.5" />} tier={section.minTier}>{section.title}</SectionHeading>
        {section.note && (
          <Callout tone={d?.curated ? "info" : "warn"} icon={d?.curated ? <Info className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>
            {section.note}
          </Callout>
        )}
      </div>

      {d?.curated && d.schemes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Curated · as of {d.asOf}</Badge>
          </div>
          {d.schemes.map((s, i) => (
            <div key={i} className="rounded-lg border border-border/60 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{s.name}</span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${impactClasses(s.impact)}`}>{s.impact}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{s.type} · {s.status}</div>
              <p className="mt-2 text-sm text-muted-foreground">{s.detail}</p>
            </div>
          ))}
        </div>
      )}

      {d?.portal && (
        <a href={d.portal.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          {d.portal.curated ? "Council planning portal" : "Find your council's planning portal"} <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {section.sourceFootnote && <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>}
    </Card>
  );
}

// ── Letting Economics / Rental Demand (INV) ──────────────────────────────────
interface RentalDemandData {
  yield: { available: boolean; range?: string; regionLabel?: string; localMedian?: string | null; basis?: string; reason?: string };
  velocity: { available: boolean; avgPerYear?: number; latestYear?: { year: number; count: number }; windowYears?: number; totalCount?: number; reason?: string };
  methodology: string;
}

function RentalDemandSection({ section }: { section: BriefSection }) {
  const d = section.data as RentalDemandData | null;
  return (
    <Card className="p-6 space-y-6">
      <div>
        <SectionHeading icon={<Gauge className="h-3.5 w-3.5" />} tier={section.minTier}>{section.title}</SectionHeading>
        {section.note && (
          <Callout tone={section.state === "DATA" ? "info" : "warn"} icon={section.state === "DATA" ? <Info className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>
            {section.note}
          </Callout>
        )}
      </div>

      {d && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Gross yield */}
          <div className="rounded-lg border border-border/60 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Gross yield (return)</div>
            {d.yield.available ? (
              <>
                <div className="mt-1 font-serif text-2xl tabular-nums text-foreground">{d.yield.range}</div>
                <p className="mt-2 text-[11px] text-muted-foreground">{d.yield.basis}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Not available — {d.yield.reason}.</p>
            )}
          </div>
          {/* Sales velocity */}
          <div className="rounded-lg border border-border/60 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Sales velocity (liquidity)</div>
            {d.velocity.available ? (
              <>
                <div className="mt-1 font-serif text-2xl tabular-nums text-foreground">
                  ~{d.velocity.avgPerYear}<span className="text-sm font-normal text-muted-foreground"> sales/yr</span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {d.velocity.totalCount?.toLocaleString()} recorded sales over {d.velocity.windowYears} years; {d.velocity.latestYear?.count} in {d.velocity.latestYear?.year}.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Not available — {d.velocity.reason}.</p>
            )}
          </div>
        </div>
      )}

      {d?.methodology && (
        <Callout tone="warn" icon={<Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />}>{d.methodology}</Callout>
      )}

      {section.sourceFootnote && <p className="print-footnote border-t border-border/50 pt-4 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>}
    </Card>
  );
}

// ── Area Screening Verdict (EXP) — the synthesis engine's render ──────────────
interface VerdictItem { signal: string; sectionKey: string; headline: string; detail: string | null; nextStep: string | null }
interface VerdictData {
  refused: boolean;
  verdict: string | null;
  chip: { label: string; tone: "good" | "mixed" | "limited" | "neutral" };
  confidence: { tier: string; points: number; label: string };
  collapsed: boolean;
  score?: number;
  scope: "point" | "district";
  summary?: string;
  headline?: string;
  explanation?: string;
  strongestReason?: { text: string; detail: string | null; sectionKey: string | null; signal: string | null; direction: string };
  bestFor?: { shortWho: string; why: string; text: string } | null;
  whatWouldChange?: string;
  positives?: VerdictItem[];
  watchOuts?: VerdictItem[];
  neutralNotes?: { signal: string; sectionKey: string; text: string }[];
  canSee?: string[];
  cannotSee?: string[];
  standingNote: string;
}

// Verdict source-key → the on-page section anchor + its human label (for tap-through).
const VERDICT_SECTION_LABELS: Record<string, string> = {
  pricesTrendNegotiation: "Prices, Trend & Negotiation",
  floodClimate: "Flood, Climate & Resilience",
  neighbourhood: "Neighbourhood Profile",
  crimeBreakdown: "Crime Breakdown",
  planning: "Planning Activity & Risk Flags",
};

function scrollToSection(key: string) {
  const el = document.getElementById(`sec-${key}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function VerdictSourceLink({ sectionKey }: { sectionKey: string | null | undefined }) {
  if (!sectionKey) return null;
  const label = VERDICT_SECTION_LABELS[sectionKey] ?? sectionKey;
  return (
    <button
      type="button"
      onClick={() => scrollToSection(sectionKey)}
      className="inline-flex items-center gap-0.5 text-[11px] text-primary/70 underline underline-offset-2 hover:text-primary"
    >
      {label}
      <Route className="h-3 w-3" />
    </button>
  );
}

function verdictChipClasses(tone: VerdictData["chip"]["tone"]) {
  switch (tone) {
    case "good": return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "limited": return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
    case "mixed": return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default: return "border-border bg-muted/50 text-muted-foreground";
  }
}

export function VerdictCard({ section, entitled = false }: { section: BriefSection; entitled?: boolean }) {
  const d = section.data as VerdictData | null;
  if (!d) {
    return (
      <Card className="p-6">
        <SectionHeading icon={<Gauge className="h-3.5 w-3.5" />} tier={section.minTier}>{section.title}</SectionHeading>
        <p className="text-sm text-muted-foreground">{section.note ?? "The screening verdict is unavailable for this postcode."}</p>
      </Card>
    );
  }

  // ── REFUSAL — below the confidence floor, no verdict is asserted. ───────────
  if (d.refused) {
    return (
      <Card className="p-6 space-y-4">
        <SectionHeading icon={<Gauge className="h-3.5 w-3.5" />} tier={section.minTier}>{section.title}</SectionHeading>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${verdictChipClasses("neutral")}`}>Insufficient data</span>
          <span className="text-xs text-muted-foreground">No reliable screening verdict</span>
        </div>
        <p className="font-serif text-lg leading-snug text-foreground">{d.headline}</p>
        <p className="text-sm text-muted-foreground">{d.explanation}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> What we can see
            </div>
            {d.canSee && d.canSee.length ? (
              <ul className="space-y-1 text-sm text-foreground">{d.canSee.map((s, i) => <li key={i}>· {s}</li>)}</ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing resolved for this postcode.</p>
            )}
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> What we can't
            </div>
            {d.cannotSee && d.cannotSee.length ? (
              <ul className="space-y-1 text-sm text-muted-foreground">{d.cannotSee.map((s, i) => <li key={i}>· {s}</li>)}</ul>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>
        <p className="border-t border-border/50 pt-3 text-[11px] text-muted-foreground">{d.standingNote}</p>
      </Card>
    );
  }

  // ── A real verdict. ─────────────────────────────────────────────────────────
  const positives = d.positives ?? [];
  const watchOuts = d.watchOuts ?? [];
  const neutrals = d.neutralNotes ?? [];
  return (
    <Card className="p-6 space-y-5">
      <SectionHeading icon={<Gauge className="h-3.5 w-3.5" />} tier={section.minTier}>{section.title}</SectionHeading>

      {/* Chip + confidence */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${verdictChipClasses(d.chip.tone)}`}>{d.chip.label}</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Gauge className="h-3.5 w-3.5" />
          {d.confidence.label} · {d.confidence.points}/100
        </span>
        {d.scope === "district" && <Badge variant="outline" className="text-[10px]">District-wide</Badge>}
        {d.collapsed && <Badge variant="outline" className="text-[10px]">Partial read</Badge>}
      </div>

      {/* Headline summary */}
      {d.summary && <p className="font-serif text-lg leading-snug text-foreground">{d.summary}</p>}

      {/* Strongest supporting reason */}
      {d.strongestReason && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Strongest supporting reason</div>
          <p className="mt-1 text-sm text-foreground">{d.strongestReason.text}</p>
          {d.strongestReason.detail && <p className="mt-1 text-xs text-muted-foreground">{d.strongestReason.detail}</p>}
          {d.strongestReason.sectionKey && <div className="mt-2"><VerdictSourceLink sectionKey={d.strongestReason.sectionKey} /></div>}
        </div>
      )}

      {/* Best for */}
      {d.bestFor && (
        <div className="flex items-start gap-2 text-sm">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-foreground"><span className="font-medium">Best for {d.bestFor.shortWho}</span> — <span className="text-muted-foreground">{d.bestFor.why}.</span></p>
        </div>
      )}

      {/* Positives + watch-outs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> Strongest positives
          </div>
          {positives.length ? (
            <ul className="space-y-2">
              {positives.map((p, i) => (
                <li key={i} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
                  <p className="font-medium text-foreground">{p.headline}</p>
                  {p.detail && <p className="mt-0.5 text-xs text-muted-foreground">{p.detail}</p>}
                  <div className="mt-1"><VerdictSourceLink sectionKey={p.sectionKey} /></div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No standout positive signals in the data.</p>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Watch-outs
          </div>
          {watchOuts.length ? (
            <ul className="space-y-2">
              {watchOuts.map((w, i) => (
                <li key={i} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
                  <p className="font-medium text-foreground">{w.headline}</p>
                  {w.detail && <p className="mt-0.5 text-xs text-muted-foreground">{w.detail}</p>}
                  {entitled && w.nextStep && <p className="mt-1 text-xs text-foreground"><span className="font-medium">Next step:</span> {w.nextStep}</p>}
                  <div className="mt-1"><VerdictSourceLink sectionKey={w.sectionKey} /></div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No material watch-outs in the data.</p>
          )}
        </div>
      </div>

      {/* What would change the read (guidance for softer verdicts) */}
      {d.verdict === "Limited fit" && d.whatWouldChange && (
        <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-muted-foreground"><span className="font-medium text-foreground">What would change this read:</span> {d.whatWouldChange}</p>
        </div>
      )}

      {/* Neutral "worth knowing" notes */}
      {neutrals.length > 0 && (
        <div className="space-y-2">
          {neutrals.map((n, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
              <p>{n.text} <VerdictSourceLink sectionKey={n.sectionKey} /></p>
            </div>
          ))}
        </div>
      )}

      <p className="border-t border-border/50 pt-3 text-[11px] text-muted-foreground">{d.standingNote}</p>
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

// ── Save / own affordance ────────────────────────────────────────────────────
// The £14.99 one-off "save this brief permanently" surface. Owned → a calm ownership
// confirmation. Not owned → a LOCKED upsell (shown, not hidden) that starts the Full
// Brief checkout for THIS district. Anonymous → the same button opens sign-in first.
// NOTE: final CTA/upsell wording is finalised in Step 5 (the wall/CTA copy propose-gate);
// this uses functional copy so the deliverable exists before that promise is written.
function SaveBriefAffordance({ outcode, postcode, owned, tier }: { outcode: string; postcode: string; owned: boolean; tier: string }) {
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (owned) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3" data-testid="owned-brief-banner">
        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
        <p className="text-sm text-foreground/80">
          <span className="font-medium text-foreground">You own {outcode}.</span>{" "}
          Saved to your account — revisit and regenerate free, forever.
        </p>
      </div>
    );
  }

  // The £14.99 upsell is ONLY for Explorer-tier (free) viewers who don't own this
  // district. A subscriber whose PLAN already grants full/higher depth — Investor, or a
  // grandfathered Professional — must never be shown a one-off upsell for access they
  // already have. Their brief is served at their plan tier, so tier is PRO/INV here
  // (the INV override only fires when owned, handled above). Anonymous = EXP = shown.
  if (tier !== "EXP") return null;

  async function onSave() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const r = await startFullBriefCheckout(postcode, outcode);
    if (r.status === "redirecting") return; // navigating to Stripe — keep the spinner
    if (r.status === "signin-required") { setAuthOpen(true); setBusy(false); return; }
    if (r.status === "already-owned") { navigate(`/brief/${encodeURIComponent(r.outcode || outcode)}`); return; }
    setNote(r.message); // error
    setBusy(false);
  }

  return (
    <>
      <div id={FULL_BRIEF_BANNER_ID} className="rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] px-4 py-3.5 scroll-mt-20">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">See the full picture on {outcode}</p>
              <p className="text-xs text-muted-foreground max-w-prose">
                You're seeing the free area screen. Unlock every section at Investor depth — comparable sales, 10-year trend, letting economics, sold-prices map and more — yours permanently.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onSave}
            disabled={busy}
            className="font-semibold shrink-0"
            data-testid="button-save-full-brief"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Unlock {outcode} — £14.99<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></>
            )}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href="/pricing" className="text-xs text-primary underline-offset-4 hover:underline" data-testid="link-save-investor">
            or go unlimited with Investor
          </Link>
          {note && <p className="text-xs text-destructive" data-testid="text-save-error">{note}</p>}
        </div>
      </div>
      <AuthModal open={authOpen} defaultTab="signup" onClose={() => setAuthOpen(false)} />
    </>
  );
}

// ── Meta header ──────────────────────────────────────────────────────────────
function BriefHeader({ meta }: { meta: BriefMeta }) {
  return (
    // Hidden entirely in print — the print-only header block (postcode, area,
    // verdict, wordmark) stands in for it, so nothing is duplicated on page 1.
    <div className="no-print mb-6 flex items-start justify-between gap-4">
      <div>
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
      {/* Native print → "Save as PDF" (this whole header is hidden in the PDF). */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="shrink-0 gap-1.5"
          data-testid="button-download-pdf"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Download PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
        <p className="max-w-[15rem] text-right text-[11px] leading-snug text-muted-foreground" data-testid="text-print-tip">
          Tip: untick “Headers and footers” in the print dialog for a clean PDF.
        </p>
      </div>
    </div>
  );
}

// ── Print-only header / footer ────────────────────────────────────────────────
// These render only on paper (see the @media print block in index.css). They
// carry no interactive controls. The footer's "Generated" date is the payload's
// own generatedAt (when the brief was built), never `today`. It deliberately
// makes NO "data as at" currency claim — the underlying sources lag by varying
// amounts (crime ~2mo, council tax 2024/25, Ofcom 2024, Census 2021).
function fmtPrintDate(iso: string | undefined): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function printAreaName(meta: BriefMeta): string {
  const parts: string[] = [];
  if (!meta.outcodeOnly && meta.ward) parts.push(meta.ward);
  if (meta.localAuthority) parts.push(meta.localAuthority);
  if (meta.region) parts.push(meta.region);
  return parts.join(" · ") || meta.outcode;
}

// The verdict label + chip tone for the print header, mirroring VerdictCard's
// on-screen logic (refusal → neutral "Insufficient data").
function printVerdict(section?: BriefSection): { label: string; tone: VerdictData["chip"]["tone"] } {
  const d = section?.data as VerdictData | null | undefined;
  if (!d) return { label: "Screening verdict unavailable", tone: "neutral" };
  if (d.refused) return { label: "Insufficient data", tone: "neutral" };
  return { label: d.verdict || d.chip?.label || "See verdict", tone: d.chip?.tone ?? "neutral" };
}

function BriefPrintHeader({ meta, verdict }: { meta: BriefMeta; verdict?: BriefSection }) {
  const v = printVerdict(verdict);
  return (
    <div className="print-header" aria-hidden="true">
      <div className="print-header-left">
        <div className="print-wordmark">
          Lux<span className="pw-gold">Property</span><span className="pw-ai">.ai</span>
        </div>
        <div className="print-postcode">{meta.postcode}</div>
        <div className="print-area">{printAreaName(meta)}</div>
      </div>
      <div className="print-verdict">
        <span className="print-verdict-label">Area screening verdict</span>
        <span className={`print-verdict-value ${verdictChipClasses(v.tone)}`}>{v.label}</span>
      </div>
    </div>
  );
}

function BriefPrintFooter({ meta }: { meta: BriefMeta }) {
  const date = fmtPrintDate(meta.generatedAt);
  const pc = meta.postcode.trim();
  return (
    <div className="print-footer" aria-hidden="true">
      Generated {date} · luxproperty.ai/brief/{pc}
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
  const [payload, setPayload] = useState<
    BriefPayload | QuotaExceededResp | SignupRequiredResp | VerifyEmailResp | null
  >(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [retryNote, setRetryNote] = useState<string | null>(null);

  async function runGeneration(pc: string) {
    const clean = pc.trim();
    if (!clean) return;
    setStatus("loading");
    setPayload(null);
    setError(null);
    setRetryNote(null);

    // Identity travels ONLY as a verified Bearer token (authHeader()); the server
    // derives the account — tier + quota — from it. A userId is never sent: a UUID
    // is no longer an identity claim. Anonymous visitors send no token and get
    // Explorer sections, unmetered.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const url = `/api/brief?postcode=${encodeURIComponent(clean)}`;
        const res = await fetch(url, { headers: authHeader() });
        const json:
          | BriefPayload
          | QuotaExceededResp
          | SignupRequiredResp
          | VerifyEmailResp
          | BriefErrorResp = await res.json();

        // Resolve-altitude failure (invalid postcode / Scotland-NI / guard): these
        // are deterministic — retrying won't change them. Surface immediately.
        if (!res.ok || json.ok === false) {
          setError((json as BriefErrorResp).error ?? { code: "UPSTREAM_ERROR", message: "Brief generation failed." });
          setStatus("error");
          return;
        }

        // Over-quota: a clean 200 response, not an error. Show the upgrade screen.
        if ("quotaExceeded" in json && json.quotaExceeded) {
          setPayload(json as QuotaExceededResp);
          setStatus("done");
          return;
        }

        // Anonymous soft gate: a clean 200, not an error. Guest used their free brief —
        // show the encouraging sign-up prompt.
        if ("signupRequired" in json && json.signupRequired) {
          setPayload(json as SignupRequiredResp);
          setStatus("done");
          return;
        }

        // Signed in but email not confirmed: a clean 200 — show the verify-email state.
        if ("verifyEmailRequired" in json && json.verifyEmailRequired) {
          track("verification_required_shown", { postcode: clean });
          setPayload(json as VerifyEmailResp);
          setStatus("done");
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

        track("brief_generated", { outcode: good.meta?.outcode, tier: good.meta?.tier });
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

  // Narrow the payload union: over-quota, sign-up and verify-email responses carry no sections.
  const quotaResp = payload && "quotaExceeded" in payload ? (payload as QuotaExceededResp) : null;
  const signupResp = payload && "signupRequired" in payload ? (payload as SignupRequiredResp) : null;
  const verifyResp = payload && "verifyEmailRequired" in payload ? (payload as VerifyEmailResp) : null;
  const brief =
    payload &&
    !("quotaExceeded" in payload) &&
    !("signupRequired" in payload) &&
    !("verifyEmailRequired" in payload)
      ? (payload as BriefPayload)
      : null;

  const execSummary = brief?.sections.find((s) => s.key === "executiveSummary");
  const prices = brief?.sections.find((s) => s.key === "pricesTrendNegotiation");
  const nearby = brief?.sections.find((s) => s.key === "nearbySoldPrices");
  const streets = brief?.sections.find((s) => s.key === "streetPriceRanking");
  const soldMap = brief?.sections.find((s) => s.key === "soldPricesMap");
  const flood = brief?.sections.find((s) => s.key === "floodClimate");
  const stationsCommute = brief?.sections.find((s) => s.key === "stationsCommute");
  const commuteCalc = brief?.sections.find((s) => s.key === "commuteCalculator");
  const schools = brief?.sections.find((s) => s.key === "schools");
  const amenities = brief?.sections.find((s) => s.key === "amenities");
  const broadband = brief?.sections.find((s) => s.key === "broadband");
  const airQuality = brief?.sections.find((s) => s.key === "airQuality");
  const buyingCosts = brief?.sections.find((s) => s.key === "buyingCosts");
  const propertyType = brief?.sections.find((s) => s.key === "propertyTypeSplit");
  const rentalSnapshot = brief?.sections.find((s) => s.key === "rentalSnapshot");
  const crimeBreakdown = brief?.sections.find((s) => s.key === "crimeBreakdown");
  const neighbourhood = brief?.sections.find((s) => s.key === "neighbourhood");
  const preOfferQuestions = brief?.sections.find((s) => s.key === "preOfferQuestions");
  const planning = brief?.sections.find((s) => s.key === "planning");
  const developmentTracker = brief?.sections.find((s) => s.key === "developmentTracker");
  const rentalDemand = brief?.sections.find((s) => s.key === "rentalDemandScore");
  const areaVerdict = brief?.sections.find((s) => s.key === "areaVerdict");
  // FIX 2: locked sections not kept as full cards collapse into one "Also in the full
  // brief" block at the end. Empty for entitled viewers (they have no LOCKED sections),
  // preserving the paid order in the payload's section sequence.
  const collapsedLocked = (brief?.sections ?? []).filter(isCollapsedLocked);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Postcode input — always visible so it can be re-run */}
        <div className="no-print border-b border-border bg-muted/20">
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

        {/* Over-quota — clean upgrade screen, not an error. */}
        {status === "done" && quotaResp && <OverQuotaScreen resp={quotaResp} />}

        {/* Anonymous soft gate — encouraging sign-up prompt, not an error. */}
        {status === "done" && signupResp && <SignUpGateScreen resp={signupResp} />}

        {/* Signed in but email unconfirmed — verify-email state, not an error. */}
        {status === "done" && verifyResp && <VerifyEmailGate />}

        {status === "done" && brief && prices && (
          <div className="brief-print-root mx-auto max-w-3xl px-4 sm:px-6 py-8">
            {/* Print-only: first-page header block + footer repeated every page.
             * Kept outside the space-y flow so screen layout is unchanged. */}
            <BriefPrintHeader meta={brief.meta} verdict={areaVerdict} />
            <BriefPrintFooter meta={brief.meta} />
            <BriefLocationContext.Provider value={{ outcode: brief.meta.outcode, postcode: brief.meta.postcode, tier: brief.meta.tier, window: brief.meta.window }}>
            <div className="space-y-6">
            <BriefHeader meta={brief.meta} />
            {/* Upgrade block + quota funnel are screen-only nudges (never in the PDF) */}
            <div className="no-print">
              <SaveBriefAffordance outcode={brief.meta.outcode} postcode={brief.meta.postcode} owned={!!brief.fullBriefOwned} tier={brief.meta.tier} />
            </div>
            <div className="no-print">
              <QuotaFunnel quota={brief.quota} />
            </div>
            {areaVerdict && <VerdictCard section={areaVerdict} entitled={brief.meta.tier !== "EXP"} />}
            {execSummary && <ExecutiveSummarySection section={execSummary} />}
            <div id="sec-neighbourhood">{neighbourhood && <NeighbourhoodSection section={neighbourhood} />}</div>
            <div id="sec-pricesTrendNegotiation"><PricesSection section={prices} /></div>
            {renderSection(nearby, NearbySoldPricesSection)}
            {renderSection(streets, StreetRankingSection)}
            {renderSection(soldMap, SoldPricesMapSection)}
            <div id="sec-floodClimate">{flood && <FloodClimateSection section={flood} />}</div>
            {stationsCommute && <StationsCommuteSection section={stationsCommute} />}
            {renderSection(commuteCalc, CommuteCalculatorSection)}
            {schools && <SchoolsSection section={schools} />}
            {amenities && <AmenitiesSection section={amenities} />}
            {renderSection(broadband, BroadbandSection)}
            {renderSection(airQuality, AirQualitySection)}
            {buyingCosts && <BuyingCostsSection section={buyingCosts} />}
            {renderSection(propertyType, PropertyTypeSection)}
            {renderSection(rentalSnapshot, RentalSnapshotSection)}
            <div id="sec-crimeBreakdown">{renderSection(crimeBreakdown, CrimeBreakdownSection)}</div>
            <div id="sec-planning">{renderSection(planning, PlanningActivitySection)}</div>
            {renderSection(developmentTracker, DevelopmentTrackerSection)}
            {renderSection(rentalDemand, RentalDemandSection)}
            {renderSection(preOfferQuestions, PreOfferQuestionsSection)}
            {/* FIX 2: the collapsed locked sections, as one compact block (free view only). */}
            <AlsoInFullBrief sections={collapsedLocked} />
            </div>
            </BriefLocationContext.Provider>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

// ── Property Type Split (PRO) — ONS Census 2021 TS044 ────────────────────────
function PropertyTypeSection({ section }: { section: BriefSection }) {
  if (section.state === "UNAVAILABLE" || !section.data) {
    return (
      <Card className="p-6">
        <SectionHeading icon={<Building2 className="h-3.5 w-3.5" />} tier={section.minTier}>
          {section.title}
        </SectionHeading>
        <p className="text-sm text-muted-foreground">{section.note}</p>
        {section.sourceFootnote && (
          <p className="print-footnote mt-3 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
        )}
      </Card>
    );
  }
  const d = section.data;
  const maxPct = Math.max(...d.categories.map((c: any) => c.percent || 0), 1);
  return (
    <Card className="p-6">
      <SectionHeading icon={<Building2 className="h-3.5 w-3.5" />} tier={section.minTier}>
        {section.title}
      </SectionHeading>
      {section.note && <p className="mb-4 text-sm text-muted-foreground">{section.note}</p>}
      <div className="space-y-2.5">
        {d.categories.map((c: any) => (
          <div key={c.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">{c.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {c.countFormatted} · {c.percentFormatted}
              </span>
            </div>
            <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${Math.round(((c.percent || 0) / maxPct) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {section.sourceFootnote && (
        <p className="print-footnote mt-4 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">{section.sourceFootnote}</p>
      )}
    </Card>
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
