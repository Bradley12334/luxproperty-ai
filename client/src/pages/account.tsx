import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/lib/authStore";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  User,
  CreditCard,
  LogOut,
  ArrowRight,
  Check,
  Shield,
  FileText,
} from "lucide-react";

const planDetails = {
  explorer: {
    label: "Explorer",
    price: "Free",
    color: "text-muted-foreground",
    features: ["3 briefs per month", "Area screening brief — Good fit / Mixed / Limited fit", "Market overview (average price & YoY change)", "1-year price trend (Land Registry)", "Neighbourhood profile — schools, transport, walkability", "Flood risk & council tax band", "Named stations, schools & amenities"],
    upgradeUrl: "https://buy.stripe.com/7sY8wRe7s9yM7ug8gI6Na00",
    upgradeTo: "Professional — £4.99/month",
    upgradeDescription: "Get comparable sales, a negotiation brief, 5-year price history, crime breakdown, planning context, and PDF export for any UK postcode.",
  },
  professional: {
    label: "Professional",
    price: "£4.99/month",
    color: "text-primary",
    features: ["Unlimited briefs", "Everything in Explorer", "5-year price trend — full Land Registry history", "Comparable sales & valuation range", "Pre-offer strategy — fair value range, opening range & seller pressure points", "Pre-offer questions — what to ask before committing", "Planning activity & risk flags", "Crime breakdown by category (police.uk)", "Broadband speed & fibre coverage (Ofcom)", "Rental market context — rents & demand signal", "Air quality index (DEFRA)", "Export to PDF & save briefs"],
    upgradeUrl: "https://buy.stripe.com/8x200l2oKdP229WfJa6Na01",
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

  useEffect(() => {
    if (!isSignedIn) {
      navigate("/");
    }
  }, [isSignedIn, navigate]);

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
                    onClick={() => window.open(plan.upgradeUrl!, "_blank", "noopener,noreferrer")}
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
                <div className="pt-4 border-t border-border/40">
                  <p className="text-xs text-muted-foreground mb-3">
                    Manage or cancel your subscription
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-sm"
                    onClick={() => window.open("https://billing.stripe.com/p/login/live_00g14n4MU7tN9XW000", "_blank", "noopener,noreferrer")}
                    data-testid="button-manage-subscription"
                  >
                    Manage Subscription
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </div>
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
