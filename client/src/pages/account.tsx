import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/lib/authStore";
import { checkoutUrl } from "@/lib/checkout";
import { fetchMyBriefs, type OwnedBrief } from "@/lib/library";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  User,
  CreditCard,
  LogOut,
  ArrowRight,
  Check,
  Shield,
  FileText,
  MapPin,
  Lock,
} from "lucide-react";

const planDetails = {
  explorer: {
    label: "Explorer",
    price: "Free",
    color: "text-muted-foreground",
    features: ["2 briefs per month", "Area screening brief — Good fit / Mixed / Limited fit", "Market overview (average price & YoY change)", "1-year price trend (Land Registry)", "Neighbourhood profile — schools, transport, walkability", "Flood risk & council tax band", "Named stations, schools & amenities"],
    upgradeUrl: "https://buy.stripe.com/8x200l2oKdP229WfJa6Na01?success_url=https%3A%2F%2Fwww.luxproperty.ai%2Fsuccess%3Fplan%3Dinvestor",
    upgradeTo: "Investor — £39.99/month",
    upgradeDescription: "Want the full picture on one postcode? Run its brief and unlock it for £14.99 — yours permanently. Or go unlimited across every postcode with Investor: comparable sales, 10-year trends, sold-prices maps and a portfolio dashboard.",
  },
  professional: {
    label: "Professional",
    price: "£4.99/month",
    color: "text-primary",
    features: ["Unlimited briefs", "Everything in Explorer", "5-year price trend — full Land Registry history", "Comparable sales & valuation range", "Pre-offer strategy — fair value range, opening range & seller pressure points", "Pre-offer questions — what to ask before committing", "Planning activity & risk flags", "Crime breakdown by category (police.uk)", "Broadband speed & fibre coverage (Ofcom)", "Rental market context — rents & demand signal", "Air quality index (DEFRA)", "Save & revisit briefs"],
    upgradeUrl: "https://buy.stripe.com/8x200l2oKdP229WfJa6Na01?success_url=https%3A%2F%2Fwww.luxproperty.ai%2Fsuccess%3Fplan%3Dinvestor",
    upgradeTo: "Investor — £39.99/month",
    upgradeDescription: "Add 10-year trend data, rental demand scores, a sold prices map, and a portfolio dashboard to compare multiple areas at once.",
  },
  investor: {
    label: "Investor",
    price: "£39.99/month",
    color: "text-amber-600 dark:text-amber-400",
    features: ["Everything in Professional", "10-year price trend — cross-area comparison", "Rental demand score — letting potential rated across areas", "Sold prices map & street price ranking", "Development tracker — pipeline & change signals", "Portfolio dashboard — save, compare & revisit briefs", "Custom report branding (add your name & firm)"],
    upgradeUrl: null,
    upgradeTo: null,
    upgradeDescription: null,
  },
};

export default function AccountPage() {
  useDocumentTitle("Account");
  const { user, isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [ownedBriefs, setOwnedBriefs] = useState<OwnedBrief[]>([]);
  const [briefsLoading, setBriefsLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) {
      navigate("/");
    }
  }, [isSignedIn, navigate]);

  // Load the owned Full Briefs ("My briefs" library). Never throws — an empty list on
  // error, so a library blip degrades to the upsell state rather than an error screen.
  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;
    setBriefsLoading(true);
    fetchMyBriefs()
      .then((briefs) => { if (alive) setOwnedBriefs(briefs); })
      .finally(() => { if (alive) setBriefsLoading(false); });
    return () => { alive = false; };
  }, [isSignedIn]);

  // Mint a fresh Stripe Billing Portal session server-side and send the customer
  // there. Replaces a hardcoded billing.stripe.com/p/login/... link that 404'd
  // and was not scoped to the signed-in customer.
  async function openBillingPortal() {
    if (!user || portalLoading) return;
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.url) {
        // Same-tab redirect: popup blockers reliably kill window.open() after an
        // await, and Stripe returns the customer to /account via return_url.
        window.location.href = data.url;
        return;
      }

      setPortalError(
        data.code === "NO_CUSTOMER"
          ? "We couldn't find your billing record — you may have paid with a different email address. Please contact support@luxproperty.ai and we'll sort it out."
          : data.code === "PORTAL_NOT_CONFIGURED"
          ? "The billing portal isn't available right now. Please contact support@luxproperty.ai and we'll cancel or amend your subscription for you."
          : data.error || "Could not open the billing portal. Please try again, or contact support@luxproperty.ai."
      );
    } catch {
      setPortalError("Could not reach the billing portal. Please check your connection and try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  if (!user) return null;

  const plan = planDetails[user.plan];
  const joinDate = new Date(user.joinedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-16">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">
              Account
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl tracking-tight">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
          </div>

          <div className="space-y-5">
            {/* Profile card */}
            <Card className="p-5 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold">
                  Member since {joinDate}
                </Badge>
              </div>
              <div className="pt-4 border-t border-border/40">
                <p className="text-xs text-muted-foreground">
                  To update your name or email, contact{" "}
                  <a href="mailto:support@luxproperty.ai" className="text-primary underline-offset-2 hover:underline">
                    support@luxproperty.ai
                  </a>
                </p>
              </div>
            </Card>

            {/* Plan card */}
            <Card className="p-5 sm:p-6">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Current plan</p>
                  <p className={`text-lg font-serif tracking-tight ${plan.color}`}>
                    {plan.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{plan.price}</p>
                </div>
              </div>

              <ul className="space-y-1.5 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.upgradeUrl && plan.upgradeTo && (
                <div className="pt-4 border-t border-border/40">
                  {(plan as any).upgradeDescription && (
                    <p className="text-xs text-muted-foreground mb-3">{(plan as any).upgradeDescription}</p>
                  )}
                  <Button
                    size="sm"
                    className="font-semibold text-sm"
                    onClick={() => {
                      // checkoutUrl fails closed (null when signed out). This page
                      // already redirects anonymous visitors, so this is belt-and-braces.
                      const url = checkoutUrl(plan.upgradeUrl!);
                      if (url) window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    data-testid="button-upgrade"
                  >
                    Upgrade to {plan.upgradeTo}
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {user.plan === "investor" && (
                <div className="pt-4 border-t border-border/40">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      You're on the Investor plan — full comparison toolkit, portfolio dashboard, and 10-year trend data across any UK postcode.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground/60 pl-6">Some advanced tools are rolling out soon.</p>
                </div>
              )}

              {(user.plan === "professional" || user.plan === "investor") && (
                <div className="pt-4 border-t border-border/40 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    You can manage or cancel your subscription at any time from the Stripe billing portal. Cancellation takes effect at the end of your current billing period — you keep access until then.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-sm w-full sm:w-auto"
                      onClick={openBillingPortal}
                      disabled={portalLoading}
                      data-testid="button-manage-subscription"
                    >
                      {portalLoading ? "Opening…" : "Manage Subscription"}
                      {!portalLoading && <ArrowRight className="ml-2 h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-sm w-full sm:w-auto text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={openBillingPortal}
                      disabled={portalLoading}
                      data-testid="button-cancel-subscription"
                    >
                      Cancel subscription
                    </Button>
                  </div>
                  {portalError && (
                    <p className="text-xs text-destructive leading-relaxed" data-testid="text-portal-error">
                      {portalError}
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* My briefs — owned Full Briefs (£14.99 one-off purchases). Distinct from
                the Investor portfolio: this is "postcodes you own & revisit free", not the
                compare/track toolset. Always shown — free users see the locked upsell. */}
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">My briefs</p>
                  <p className="text-sm font-medium">Postcodes you own — revisit free, forever</p>
                </div>
              </div>

              {briefsLoading ? (
                <p className="text-sm text-muted-foreground">Loading your briefs…</p>
              ) : ownedBriefs.length > 0 ? (
                <ul className="space-y-2">
                  {ownedBriefs.map((b) => {
                    // Link to the buyer's TYPED full postcode (the fully-populated point
                    // brief) when we have it; fall back to the outcode (district) for
                    // bare-outcode purchases and pre-migration rows. Ownership is by
                    // outcode, so either URL serves the owned brief at INV depth.
                    const target = b.postcode || b.outcode;
                    const coversDistrict = b.postcode && b.postcode.replace(/\s+/g, "") !== b.outcode;
                    return (
                    <li key={b.outcode}>
                      <Link href={`/brief/${encodeURIComponent(target)}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-between gap-2 text-sm h-auto py-2"
                          data-testid={`button-owned-brief-${b.outcode.toLowerCase()}`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <MapPin className="h-4 w-4 text-primary shrink-0" />
                            <span className="flex flex-col items-start min-w-0">
                              <span className="font-medium truncate">{b.postcode || b.outcode}</span>
                              {coversDistrict && (
                                <span className="text-[11px] text-muted-foreground font-normal">
                                  Covers all of {b.outcode}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal shrink-0">
                            Owned · revisit free
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </Button>
                      </Link>
                    </li>
                    );
                  })}
                </ul>
              ) : (
                // Locked/empty upsell — shown, not hidden (the save affordance is a surface).
                <div className="rounded-lg border border-dashed border-border/70 p-4">
                  <div className="flex items-start gap-2.5">
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-foreground/80 mb-1">You don't own any full briefs yet.</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Screen any UK postcode free, then unlock its complete Investor-depth brief for £14.99 — yours permanently, saved here.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {user.plan === "investor" && (
                <p className="text-[11px] text-muted-foreground/60 mt-3 leading-relaxed">
                  On Investor every postcode is already unlocked — use your{" "}
                  <Link href="/portfolio" className="text-primary underline-offset-2 hover:underline">portfolio</Link>{" "}
                  to compare and track areas.
                </p>
              )}
            </Card>

            {/* Quick links */}
            <Card className="p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary mb-4">
                Quick Links
              </p>
              <div className="space-y-2">
                <Link href="/">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-sm" data-testid="button-new-brief">
                    <FileText className="h-4 w-4" />
                    Generate a new brief
                  </Button>
                </Link>
                {user.plan === "investor" && (
                  <Link href="/portfolio">
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-sm" data-testid="button-portfolio">
                      <Shield className="h-4 w-4" />
                      My portfolio
                    </Button>
                  </Link>
                )}
                <Link href="/pricing">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-sm" data-testid="button-view-plans">
                    <CreditCard className="h-4 w-4" />
                    View all plans
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Sign out */}
            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive gap-2"
                onClick={() => { signOut(); navigate("/"); }}
                data-testid="button-account-sign-out"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
