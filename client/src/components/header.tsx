import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Sun, Moon, User, LogOut, ChevronDown, Settings, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LuxPropertyLogo } from "./logo";
import { useTheme } from "./theme-provider";
import { AuthModal } from "./auth-modal";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "@/lib/authStore";
import { getBriefUsage, EXPLORER_LIMIT } from "@/hooks/use-brief-usage";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const { user, isSignedIn } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function openSignIn() { setAuthTab("signin"); setAuthOpen(true); }
  function openSignUp() { setAuthTab("signup"); setAuthOpen(true); }

  const planLabel = user?.plan === "investor" ? "Investor" : user?.plan === "professional" ? "Professional" : "Explorer";

  const [briefsUsed, setBriefsUsed] = useState(getBriefUsage);
  useEffect(() => {
    setBriefsUsed(getBriefUsage());
  }, [user]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { href: "/about", label: "About" },
    { href: "/compare", label: "Compare" },
    { href: "/valuation", label: "Valuation" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/pricing", label: "Pricing" },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <LuxPropertyLogo />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={location === link.href ? "secondary" : "ghost"}
                  size="sm"
                  className="text-sm font-medium"
                  data-testid={`link-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </Button>
              </Link>
            ))}

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Brief usage counter — Explorer plan only */}
            {isSignedIn && user?.plan === "explorer" && (
              <Link href="/pricing">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                    briefsUsed >= EXPLORER_LIMIT
                      ? "border-red-400/60 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                  title={`${briefsUsed} of ${EXPLORER_LIMIT} free briefs used this month`}
                  data-testid="text-brief-usage"
                >
                  {briefsUsed}/{EXPLORER_LIMIT} briefs
                </span>
              </Link>
            )}

            {/* Auth buttons / user menu */}
            {isSignedIn && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-sm font-medium pl-2.5"
                    data-testid="button-user-menu"
                  >
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-3 w-3 text-primary" />
                    </div>
                    <span className="max-w-[100px] truncate">{user.name.split(" ")[0]}</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {planLabel} plan
                    </span>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account">
                      <Settings className="h-3.5 w-3.5 mr-2" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/portfolio">
                      <Settings className="h-3.5 w-3.5 mr-2" />
                      My Portfolio
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={signOut}
                    className="text-destructive focus:text-destructive"
                    data-testid="button-sign-out"
                  >
                    <LogOut className="h-3.5 w-3.5 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sm font-medium"
                  onClick={openSignIn}
                  data-testid="button-sign-in"
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  className="text-sm font-semibold"
                  onClick={openSignUp}
                  data-testid="button-sign-up"
                >
                  Sign Up
                </Button>
              </div>
            )}
          </nav>

          {/* Mobile nav — right side controls */}
          <div className="flex sm:hidden items-center gap-1">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              data-testid="button-theme-toggle-mobile"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Auth — compact */}
            {!isSignedIn && (
              <Button
                size="sm"
                className="text-sm font-semibold"
                onClick={openSignUp}
                data-testid="button-sign-up-mobile"
              >
                Sign Up
              </Button>
            )}

            {isSignedIn && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    data-testid="button-user-menu-mobile"
                  >
                    <User className="h-4 w-4 text-primary" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {planLabel} plan
                    </span>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account">
                      <Settings className="h-3.5 w-3.5 mr-2" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/portfolio">
                      <Settings className="h-3.5 w-3.5 mr-2" />
                      My Portfolio
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={signOut}
                    className="text-destructive focus:text-destructive"
                    data-testid="button-sign-out-mobile"
                  >
                    <LogOut className="h-3.5 w-3.5 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Hamburger */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-border/60 bg-background/95 backdrop-blur-md">
            <nav className="mx-auto max-w-5xl px-4 py-3 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <button
                    className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      location === link.href
                        ? "bg-secondary text-foreground"
                        : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                    }`}
                    data-testid={`link-mobile-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                  </button>
                </Link>
              ))}
              {!isSignedIn && (
                <button
                  className="w-full text-left px-3 py-3 rounded-lg text-sm font-medium text-foreground/70 hover:bg-muted/50 hover:text-foreground transition-colors min-h-[44px]"
                  onClick={() => { openSignIn(); setMobileMenuOpen(false); }}
                  data-testid="link-mobile-sign-in"
                >
                  Sign In
                </button>
              )}
              {isSignedIn && user?.plan === "explorer" && (
                <Link href="/pricing">
                  <div className="px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        briefsUsed >= EXPLORER_LIMIT
                          ? "border-red-400/60 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {briefsUsed}/{EXPLORER_LIMIT} briefs used
                    </span>
                  </div>
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authTab} />
    </>
  );
}
