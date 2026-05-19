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
              Property intelligence that works{" "}
              <span className="text-primary italic">for you</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              LuxProperty.ai turns any UK postcode or address into a structured buyer brief
              in under a minute. Built on official Land Registry data, it gives buyers,
              brokers, and advisers a clear decision-making brief covering price trends,
              comparable sales, area character, and key risk factors — before making an offer.
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
              Property research is slow, expensive, and fragmented
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
              <p>
                Buying property is one of the largest financial decisions most people ever
                make. Yet the research process is still dominated by expensive surveyors,
                opaque agency data, and hours spent manually cross-referencing Rightmove,
                Zoopla, and Land Registry.
              </p>
              <p>
                We built LuxProperty.ai to change that. By combining HM Land Registry's
                official Price Paid dataset with postcode-level intelligence from
                Postcodes.io, we generate buyer briefs that give anyone the same
                quality of research previously available only to those paying for a
                surveyor or buying agent — in seconds, not days.
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
              Real data. No estimates.
            </h2>

            <div className="grid gap-6 sm:grid-cols-2">
              {[
                {
                  icon: Database,
                  title: "HM Land Registry",
                  body: "Every price in our briefs comes from the official Price Paid dataset — the same register used by mortgage lenders, solicitors, and the ONS. 18 million+ transactions covering England and Wales.",
                },
                {
                  icon: MapPin,
                  title: "Postcodes.io",
                  body: "Postcode-level intelligence including district names, local authority areas, and regional classification — giving every brief accurate geographic context.",
                },
                {
                  icon: TrendingUp,
                  title: "5-year price trends",
                  body: "We fetch year-by-year median prices from Land Registry so you can see exactly how a market has moved — not a smoothed estimate, but actual registered sale prices.",
                },
                {
                  icon: FileText,
                  title: "Professional-grade output",
                  body: "Reports are structured to cover the questions that matter before an offer: market KPIs, neighbourhood profile, comparable sales, negotiation context, and a summary of key risk flags.",
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
              Built on trust
            </h2>

            <div className="grid gap-5 sm:grid-cols-3">
              {[
                {
                  icon: Shield,
                  title: "Transparency",
                  body: "We always show where data comes from. Every brief cites HM Land Registry and Postcodes.io. No black-box estimates.",
                },
                {
                  icon: Database,
                  title: "Accuracy",
                  body: "We use median prices — not means — to avoid distortion from outlier sales. We require a minimum of 5 transactions before reporting a figure.",
                },
                {
                  icon: GraduationCap,
                  title: "Accessibility",
                  body: "Professional-grade property analysis shouldn't cost £500 and take two weeks. We make it instant and affordable for everyone.",
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
              Ready to try it?
            </h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-lg">
              Generate your first property report free — no account required.
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
