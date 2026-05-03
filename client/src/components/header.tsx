import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Sun, Moon, User, LogOut, ChevronDown, Settings } from "lucide-react";
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

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const { user, isSignedIn } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");

  function openSignIn() { setAuthTab("signin"); setAuthOpen(true); }
  function openSignUp() { setAuthTab("signup"); setAuthOpen(true); }

  const planLabel = user?.plan === "investor" ? "Investor" : user?.plan === "professional" ? "Professional" : "Explorer";

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <LuxPropertyLogo />
          </Link>

          <nav className="flex items-center gap-1">
            <Link href="/about">
              <Button
                variant={location === "/about" ? "secondary" : "ghost"}
                size="sm"
                className="text-sm font-medium hidden sm:inline-flex"
                data-testid="link-about"
              >
                About
              </Button>
            </Link>
            <Link href="/compare">
              <Button
                variant={location === "/compare" ? "secondary" : "ghost"}
                size="sm"
                className="text-sm font-medium hidden sm:inline-flex"
                data-testid="link-compare"
              >
                Compare
              </Button>
            </Link>
            <Link href="/portfolio">
              <Button
                variant={location === "/portfolio" ? "secondary" : "ghost"}
                size="sm"
                className="text-sm font-medium hidden sm:inline-flex"
                data-testid="link-portfolio"
              >
                Portfolio
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                variant={location === "/pricing" ? "secondary" : "ghost"}
                size="sm"
                className="text-sm font-medium"
                data-testid="link-pricing"
              >
                Pricing
              </Button>
            </Link>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

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
                    <span className="hidden sm:inline max-w-[100px] truncate">{user.name.split(" ")[0]}</span>
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
                  className="text-sm font-medium hidden sm:inline-flex"
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
        </div>
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authTab} />
    </>
  );
}
