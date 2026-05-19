import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { generateBrief } from "@/lib/mockEngine";
import {
  loadPortfolio,
  addToPortfolio,
  removeFromPortfolio,
  getPortfolioStats,
  type PortfolioItem,
} from "@/lib/portfolioStore";
import {
  Plus,
  ExternalLink,
  Trash2,
  Building2,
  TrendingUp,
  BarChart3,
  Search,
  Loader2,
  Lock,
} from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-2">
          <Icon className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="font-serif text-2xl tracking-tight">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function PropertyCard({
  item,
  onRemove,
}: {
  item: PortfolioItem;
  onRemove: (id: string) => void;
}) {
  const savedDate = new Date(item.savedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Card className="p-5 flex flex-col gap-4" data-testid={`card-portfolio-item-${item.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <Badge
            variant="secondary"
            className="text-[10px] uppercase tracking-wider font-semibold mb-2"
          >
            {item.report.queryType === "address" ? "Property" : "Area"}
          </Badge>
          <h3 className="font-serif text-base leading-snug truncate" title={item.query}>
            {item.query}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{item.areaName}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => onRemove(item.id)}
          data-testid={`button-remove-portfolio-${item.id}`}
          aria-label="Remove from portfolio"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Average Price</p>
          <p className="font-serif text-lg tracking-tight">{item.averagePrice}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Saved</p>
          <p className="text-sm">{savedDate}</p>
        </div>
      </div>

      <div className="pt-1 border-t border-border/40">
        <Link href={`/brief/${item.briefId}`}>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs h-7 px-2 text-primary hover:text-primary"
            data-testid={`link-view-brief-${item.id}`}
          >
            <ExternalLink className="h-3 w-3" />
            View Brief
          </Button>
        </Link>
      </div>
    </Card>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Building2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-serif text-lg mb-2">No briefs saved yet</h3>
      <p className="text-sm text-muted-foreground mb-2 max-w-xs">
        Save briefs you want to revisit, compare locations, and keep track of serious options — all in one place.
      </p>
      <p className="text-xs text-muted-foreground mb-6 max-w-xs">
        Open any brief and tap <span className="font-semibold">Save to Portfolio</span> to add it here.
      </p>
      <Button
        size="sm"
        className="gap-1.5"
        onClick={onAdd}
        data-testid="button-add-first-property"
      >
        <Plus className="h-3.5 w-3.5" />
        Add a property
      </Button>
    </div>
  );
}

function LoadingCards() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-5 flex flex-col gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </Card>
      ))}
    </>
  );
}

export default function PortfolioPage() {
  useDocumentTitle("Portfolio");
  const { user, isSignedIn } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Load portfolio from Supabase when user is available
  const refreshItems = useCallback(async () => {
    setIsLoadingItems(true);
    const loaded = await loadPortfolio();
    setItems(loaded);
    setIsLoadingItems(false);
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      refreshItems();
    } else {
      setItems([]);
      setIsLoadingItems(false);
    }
  }, [isSignedIn, refreshItems]);

  const stats = getPortfolioStats(items);

  async function handleRemove(id: string) {
    await removeFromPortfolio(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast({
      title: "Removed from portfolio",
      description: "The property has been removed.",
    });
  }

  async function handleAddProperty(e: React.FormEvent) {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsGenerating(true);
    try {
      const report = await generateBrief(query);
      const { ok, item } = await addToPortfolio(report);
      if (ok && item) {
        setItems((prev) => {
          // Avoid duplicates
          if (prev.find((i) => i.id === item.id)) return prev;
          return [item, ...prev];
        });
        setDialogOpen(false);
        setSearchQuery("");
        toast({
          title: "Added to portfolio",
          description: `Brief generated for "${query}" and saved to your portfolio.`,
        });
      } else {
        toast({
          title: "Already in portfolio",
          description: `A brief for "${query}" is already saved.`,
        });
        setDialogOpen(false);
      }
    } catch {
      toast({
        title: "Failed to generate brief",
        description: "Please check your query and try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  // Not signed in
  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <div className="rounded-full bg-muted p-4 mx-auto mb-4 w-fit">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-xl mb-2">Sign in to access your portfolio</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
              Your saved properties and reports are stored in your account.
            </p>
            <Link href="/">
              <Button size="sm">Go to homepage</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Investor-only gating
  const isInvestor = user?.plan === "investor";

  if (!isInvestor) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <div className="rounded-full bg-amber-50 dark:bg-amber-950/30 p-4 mx-auto mb-4 w-fit">
              <BarChart3 className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="font-serif text-xl mb-2">Compare briefs across multiple areas</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
              The portfolio dashboard is part of the Investor plan. Save briefs, compare areas side by side, and keep track of every location you're seriously considering.
            </p>
            <Link href="/pricing">
              <Button size="sm" className="font-semibold">View Investor plan — £39.99/month</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl tracking-tight mb-1">
                Portfolio
              </h1>
              <p className="text-sm text-muted-foreground">
                Save briefs, compare locations, and keep track of serious options
              </p>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="gap-1.5 font-semibold"
                  data-testid="button-add-property"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Property
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" data-testid="dialog-add-property">
                <DialogHeader>
                  <DialogTitle className="font-serif">Add to Portfolio</DialogTitle>
                  <DialogDescription>
                    Enter a postcode or address to generate a brief and add it to your comparison list.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddProperty}>
                  <div className="space-y-3 py-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="portfolio-search" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Postcode or Address
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          id="portfolio-search"
                          type="text"
                          placeholder="SW1A 2AA or 10 Downing Street, London"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                          disabled={isGenerating}
                          data-testid="input-portfolio-search"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDialogOpen(false)}
                      disabled={isGenerating}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isGenerating || !searchQuery.trim()}
                      className="gap-1.5 font-semibold"
                      data-testid="button-generate-brief"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Generating…
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          Generate & Add
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              icon={Building2}
              label="Areas saved"
              value={stats.totalProperties}
            />
            <StatCard
              icon={BarChart3}
              label="Avg. asking price"
              value={stats.averagePortfolioValue}
            />
            <StatCard
              icon={TrendingUp}
              label="Last Saved"
              value={
                items.length > 0
                  ? new Date(
                      [...items].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())[0].savedAt
                    ).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                  : "—"
              }
            />
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingItems ? (
              <LoadingCards />
            ) : items.length === 0 ? (
              <EmptyState onAdd={() => setDialogOpen(true)} />
            ) : (
              items.map((item) => (
                <PropertyCard
                  key={item.id}
                  item={item}
                  onRemove={handleRemove}
                />
              ))
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
