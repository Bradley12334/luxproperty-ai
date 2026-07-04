import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Database,
  Shield,
  TrendingUp,
  Building2,
  GraduationCap,
  ArrowRight,
  MapPin,
  FileText,
} from "lucide-react";

export default function AboutPage() {
  useDocumentTitle("About", "LuxProperty.ai is a UK property intelligence platform built to give every buyer instant access to the kind of market analysis previously only available to professionals.");
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 sm:py-24 border-b border-border/40">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Badge variant="outline" className="text-[10px] mb-5">
              About LuxProperty.ai
            </Badge>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.1] tracking-tight mb-6">
              The full picture on any UK property.{" "}
              <span className="text-primary italic">Before you commit.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              LuxProperty.ai turns any UK postcode into a full buyer brief in under 60 seconds:
              real comparable sales, a fair value range, risk flags (flood, crime, planning),
              and a pre-offer strategy — all drawn from official UK data sources. No estimates.
              No portal prices. Just what you need before you offer.
            </p>
          </div>
        </section>

        {/* Why we built it */}
        <section className="py-14 sm:py-20 border-b border-border/40">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
              The problem
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-6">
              Most buyers make offers without the right data
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
              <p>
                Property is the biggest purchase most people ever make — yet the research
                process is fragmented across Rightmove, Zoopla, Land Registry, police.uk,
                Ofsted, and the Environment Agency. Pulling it together manually takes hours.
                Paying a buying agent or surveyor to do it costs hundreds of pounds per property.
              </p>
              <p>
                LuxProperty.ai replaces that process. We combine HM Land Registry's official
                Price Paid dataset with eight other named official sources to produce a structured
                buyer brief — comparable sales, risk flags, price trend and pre-offer strategy —
                in under a minute. The same quality of analysis that used to cost a day and a
                solicitor's time, available instantly for any England or Wales postcode.
              </p>
              <p>
                Enter any UK postcode to see the full brief for yourself.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-14 sm:py-20 border-b border-border/40 bg-muted/20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
              How it works
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-10">
              Eight official sources. One clear brief.
            </h2>

            <div className="grid gap-6 sm:grid-cols-2">
              {[
                {
                  icon: Database,
                  title: "HM Land Registry",
                  body: "Every sold price is drawn from the official Price Paid dataset — the same register used by mortgage lenders and solicitors. 18M+ transactions covering England and Wales. No estimates, no smoothing.",
                },
                {
                  icon: MapPin,
                  title: "Postcodes.io",
                  body: "Postcode-level intelligence including district names, local authority areas, and regional classification — giving every brief accurate geographic context.",
                },
                {
                  icon: TrendingUp,
                  title: "5 and 10-year price trends",
                  body: "Year-by-year median prices from Land Registry so you can see exactly how a postcode has moved. Not a smoothed estimate — actual registered transaction data.",
                },
                {
                  icon: FileText,
                  title: "A brief that answers the real questions",
                  body: "Every brief covers what matters before an offer: comparable sales, pre-offer strategy, fair value range, crime breakdown, flood risk, planning activity, school ratings, broadband and transport.",
                },
              ].map((item) => (
                <div key={item.title} className="flex flex-col gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-14 sm:py-20 border-b border-border/40 bg-muted/20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
              Our principles
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-10">
              Different from the portals
            </h2>

            <div className="grid gap-5 sm:grid-cols-3">
              {[
                {
                  icon: Shield,
                  title: "Every source is named",
                  body: "We always cite the source of every figure. If a number appears in your brief, it came from a named official register — not a black-box estimate.",
                },
                {
                  icon: Database,
                  title: "No portal prices",
                  body: "Rightmove and Zoopla show asking prices. We show registered sold prices from Land Registry — what buyers actually paid, not what vendors originally wanted.",
                },
                {
                  icon: GraduationCap,
                  title: "Instant, not expensive",
                  body: "Professional-grade analysis used to mean hiring a buying agent or surveyor for hundreds of pounds. We've made it available for any postcode in under 60 seconds.",
                },
              ].map((item) => (
                <div key={item.title} className="flex flex-col gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-4">
              See what your target postcode actually looks like.
            </h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-lg">
              Enter any UK postcode and get a full buyer brief in under 60 seconds. Free to start, no card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/">
                <Button className="font-semibold" data-testid="button-about-cta">
                  Generate a free brief
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" data-testid="button-about-pricing">
                  View pricing
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
