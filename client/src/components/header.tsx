import { Link, useLocation } from "wouter";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LuxPropertyLogo } from "./logo";
import { useTheme } from "./theme-provider";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  return (
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
          <Link href="/portfolio">
            <Button
              variant={location === "/portfolio" ? "secondary" : "ghost"}
              size="sm"
              className="text-sm font-medium"
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
        </nav>
      </div>
    </header>
  );
}
