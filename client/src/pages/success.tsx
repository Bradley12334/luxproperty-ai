import { useEffect, useState } from "react";

// Extend Window so TypeScript knows gtag exists (declared in index.html)
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Home, FileText, BarChart2 } from "lucide-react";

export default function SuccessPage() {
  useDocumentTitle(
    "Welcome to LuxProperty.ai",
    "Your subscription is confirmed. Start running postcode briefs with your new plan."
  );

  const [plan, setPlan] = useState<"professional" | "investor" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("plan");
    if (p === "professional" || p === "investor") setPlan(p);
  }, []);

  // Google Ads conversion — fires once on mount, only on this page
  useEffect(() => {
    if (typeof window.gtag === "function") {
      window.gtag("event", "conversion_event_subscribe_paid");
    }
  }, []);

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
          You're all set.
        </h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-2">
          {plan
            ? `Your ${planLabel} plan (${planPrice}) is now active.`
            : "Your subscription is now active."}
        </p>
        <p className="text-xs text-muted-foreground/60 text-center max-w-xs mb-10">
          A confirmation receipt has been sent to your email by Stripe. You can manage or cancel your subscription at any time from your account page.
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
                <UnlockedItem text="PDF export of any brief" />
              </>
            ) : (
              <>
                <UnlockedItem text="Full postcode intelligence brief — every data point" />
                <UnlockedItem text="Comparable sold prices with deal quality scoring" />
                <UnlockedItem text="5-year price history and market trend data" />
                <UnlockedItem text="Pre-offer strategy and opening offer range" />
                <UnlockedItem text="PDF export of any brief" />
              </>
            )}
          </ul>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <Link href="/" className="flex-1">
            <Button className="w-full gap-2" data-testid="button-run-brief">
              <FileText className="h-4 w-4" />
              Run a postcode brief
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
