import { Link } from "wouter";
import { LuxPropertyLogo } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-border/60 py-10 mt-auto">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Logo + tagline */}
          <div className="flex flex-col gap-2">
            <Link href="/">
              <LuxPropertyLogo />
            </Link>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              AI-powered UK property intelligence. Built on HM Land Registry data.
            </p>
            <p className="text-xs text-muted-foreground">
              LuxProperty AI Ltd · Company No. 17158079
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1">
                Product
              </p>
              <Link href="/">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  Home
                </span>
              </Link>
              <Link href="/pricing">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  Pricing
                </span>
              </Link>
              <Link href="/portfolio">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  Portfolio
                </span>
              </Link>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1">
                Company
              </p>
              <Link href="/about">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  About
                </span>
              </Link>
              <Link href="/privacy">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  Privacy Policy
                </span>
              </Link>
              <Link href="/terms">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  Terms of Service
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} LuxProperty AI Ltd. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Data: HM Land Registry (OGL v3.0) · Postcodes.io
          </p>
        </div>
      </div>
    </footer>
  );
}
