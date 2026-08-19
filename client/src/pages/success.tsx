import { useEffect, useState } from "react";

// Extend Window so TypeScript knows gtag exists (declared in index.html)
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Home, FileText, BarChart2, Gift, MapPin } from "lucide-react";

export default function SuccessPage() {
  useDocumentTitle(
    "You're all set — LuxProperty.ai",
    "Your purchase is confirmed. Start running postcode briefs."
  );

  const { user } = useAuth();
  const [plan, setPlan] = useState<"professional" | "investor" | null>(null);
  // The £149 one-off Full Brief carries its owned district as ?fullbrief=<OUTCODE> and
  // the buyer's TYPED full postcode as ?pc=<POSTCODE> (both set by create-checkout's
  // success_url). It is NOT a subscription. outcode is the entitlement; pc drives routing.
  const [fullBrief, setFullBrief] = useState<string | null>(null);
  const [fullPostcode, setFullPostcode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fb = params.get("fullbrief");
    if (fb) {
      const oc = fb.toUpperCase().replace(/\s+/g, "");
      setFullBrief(oc);
      // pc is the typed full postcode. Only treat it as a POINT postcode when it's more
      // than the bare outcode (a bare-outcode buy sends pc === outcode → district is the
      // destination). Preserve display spacing; compare on the compacted form.
      const pcRaw = (params.get("pc") || "").trim().toUpperCase();
      const pcCompact = pcRaw.replace(/\s+/g, "");
      setFullPostcode(pcRaw && pcCompact !== oc ? pcRaw : null);
      return; // a Full Brief purchase never also carries a subscription plan
    }
    const p = params.get("plan");
    if (p === "professional" || p === "investor") setPlan(p);
  }, []);

  // Google Ads conversion — fires once on mount. Distinct event for the one-off so a
  // Full Brief purchase and a subscription are not conflated in reporting.
  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    if (fullBrief) window.gtag("event", "conversion_event_full_brief_paid");
    else if (plan) window.gtag("event", "conversion_event_subscribe_paid");
  }, [fullBrief, plan]);

  // ── Full Brief (one-off) success ──────────────────────────────────────────
  if (fullBrief) return <FullBriefSuccess outcode={fullBrief} postcode={fullPostcode} firstName={user?.name?.split(" ")[0] ?? null} />;

  // ── Subscription success (unchanged) ──────────────────────────────────────
  const planLabel = plan === "investor" ? "Investor" : "Professional";
  const planPrice = plan === "investor" ? "£39.99/month" : "£4.99/month";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        {/* Check icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>

        {/* Headline */}
        <h1 className="font-display text-2xl sm:text-3xl text-foreground text-center mb-3">
          You're in. Let's find you something worth buying.
        </h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-2">
          {plan
            ? `${planLabel} plan (${planPrice}) — now active.`
            : "Your subscription is now active."}
        </p>
        <p className="text-xs text-muted-foreground/60 text-center max-w-xs mb-10">
          Stripe has emailed your receipt. You can manage or cancel from your account page at any time.
        </p>

        {/* What's unlocked */}
        <div className="w-full max-w-sm border border-border/50 rounded-xl bg-card p-5 mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
            What's unlocked
          </p>
          <ul className="space-y-3">
            {plan === "investor" ? (
              <>
                <UnlockedItem text="Full postcode intelligence brief — every data point" />
                <UnlockedItem text="Comparable sold prices with deal quality scoring" />
                <UnlockedItem text="10-year price history and market trend data" />
                <UnlockedItem text="Side-by-side postcode comparison tool" />
                <UnlockedItem text="Portfolio tracker across multiple properties" />
              </>
            ) : (
              <>
                <UnlockedItem text="Full postcode intelligence brief — every data point" />
                <UnlockedItem text="Comparable sold prices with deal quality scoring" />
                <UnlockedItem text="5-year price history and market trend data" />
                <UnlockedItem text="Pre-offer strategy and opening offer range" />
              </>
            )}
          </ul>
        </div>

        {/* Bonus Investor brief — only for new Professional subscribers */}
        {plan === "professional" && (
          <div className="w-full max-w-sm border border-primary/30 rounded-xl bg-primary/5 p-5 mb-2">
            <div className="flex items-start gap-3">
              <Gift className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Your first brief is an Investor brief — on us.</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Run any postcode brief and you'll get full Investor-level data: 10-year price history, rental demand score, sold prices map, street price ranking and development tracker. After that first brief, your plan returns to Professional as normal.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <Link href="/" className="flex-1">
            <Button className="w-full gap-2" data-testid="button-run-brief">
              <FileText className="h-4 w-4" />
              Run your first brief
            </Button>
          </Link>
          <Link href="/account" className="flex-1">
            <Button variant="outline" className="w-full gap-2" data-testid="button-go-account">
              <Home className="h-4 w-4" />
              My account
            </Button>
          </Link>
        </div>

        {plan === "investor" && (
          <Link href="/portfolio" className="mt-3">
            <Button variant="ghost" size="sm" className="text-sm text-muted-foreground gap-2" data-testid="button-go-portfolio">
              <BarChart2 className="h-4 w-4" />
              View my portfolio
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        )}

        {/* Postcode prompt */}
        <p className="mt-8 text-xs text-muted-foreground/50 text-center max-w-xs">
          Try any UK postcode — e.g. <span className="font-mono text-foreground/60">SW1A 1AA</span>, <span className="font-mono text-foreground/60">LS6 2EX</span>, or <span className="font-mono text-foreground/60">M21 9WQ</span>. Your brief is ready in under 60 seconds.
        </p>
      </main>

      <Footer />
    </div>
  );
}

// ─── Full Brief (one-off) success surface ──────────────────────────────────────
// The buyer permanently owns the Investor-depth brief for ONE district (outcode). When
// they typed a full postcode, we lead with THAT (their point brief, fully populated) and
// frame the district as the bonus; the primary CTA opens the typed postcode. A bare-outcode
// buyer (no `postcode`) gets the district framing and opens the outcode directly.
// Honest Investor-depth list (NO PDF export — not shipped).
function FullBriefSuccess({ outcode, postcode, firstName }: { outcode: string; postcode: string | null; firstName: string | null }) {
  const hasPoint = !!postcode;              // did the buyer type a full postcode?
  const heroLabel = postcode || outcode;    // what they see as "theirs"
  const target = postcode || outcode;       // where the CTA routes (point brief when typed)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>

        <h1 className="font-display text-2xl sm:text-3xl text-foreground text-center mb-3">
          {firstName ? `${firstName}, ` : ""}your {heroLabel} brief is ready.
        </h1>
        {hasPoint ? (
          <p className="text-sm text-muted-foreground text-center max-w-md mb-2">
            Your full <span className="font-medium text-foreground">{postcode}</span> brief is ready at Investor depth — and your purchase covers the whole <span className="font-medium text-foreground">{outcode}</span> district, every postcode in it, permanently.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-2">
            Your full <span className="font-medium text-foreground">{outcode}</span> brief is saved to your account at Investor depth. Revisit it any time — regenerating it is always free.
          </p>
        )}
        <p className="text-xs text-muted-foreground/60 text-center max-w-xs mb-10">
          Stripe has emailed your receipt. You'll find this brief under "My briefs" in your account.
        </p>

        {/* What you own — ownership is district-wide, so the list is framed by outcode */}
        <div className="w-full max-w-sm border border-border/50 rounded-xl bg-card p-5 mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
            What you own for {outcode}
          </p>
          <ul className="space-y-3">
            <UnlockedItem text="The complete brief at Investor depth — every section unlocked" />
            <UnlockedItem text="Comparable sold prices & valuation range" />
            <UnlockedItem text="10-year price history and market trend" />
            <UnlockedItem text="Letting economics — indicative gross yield & sales velocity" />
            <UnlockedItem text="Sold prices map & street price ranking" />
            <UnlockedItem text="Development tracker, planning activity & crime breakdown" />
            <UnlockedItem text="Free to regenerate forever — never counts against your quota" />
          </ul>
        </div>

        {/* CTAs — primary opens the owned brief (the typed postcode when present) */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <Link href={`/brief/${encodeURIComponent(target)}`} className="flex-1">
            <Button className="w-full gap-2" data-testid="button-open-owned-brief">
              <MapPin className="h-4 w-4" />
              Open your {heroLabel} brief
            </Button>
          </Link>
          <Link href="/account" className="flex-1">
            <Button variant="outline" className="w-full gap-2" data-testid="button-go-account">
              <Home className="h-4 w-4" />
              My briefs
            </Button>
          </Link>
        </div>

        <p className="mt-8 text-xs text-muted-foreground/50 text-center max-w-xs">
          Want another area? Run any UK postcode free to screen it, then unlock the full brief whenever you're ready.
        </p>
      </main>

      <Footer />
    </div>
  );
}

function UnlockedItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <span className="text-sm text-foreground/80">{text}</span>
    </li>
  );
}
