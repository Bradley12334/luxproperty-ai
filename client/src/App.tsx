import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieBanner } from "@/components/cookie-banner";
import NotFound from "@/pages/not-found";
import ResetPasswordPage from "@/pages/reset-password";
import Home from "@/pages/home";
import BriefPage from "@/pages/brief";
import PricingPage from "@/pages/pricing";
import PortfolioPage from "@/pages/portfolio";
import AboutPage from "@/pages/about";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import AccountPage from "@/pages/account";
import AreaPage from "@/pages/area";
import ComparePage from "@/pages/compare";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/brief/:id" component={BriefPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/portfolio" component={PortfolioPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/account" component={AccountPage} />
      <Route path="/area/:postcode" component={AreaPage} />
      <Route path="/compare" component={ComparePage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <CookieBanner />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
