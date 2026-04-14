import { useState, useCallback } from "react";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { generateBrief } from "@/lib/mockEngine";
import {
  portfolioItems,
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
  onRemove: (id: number) => void;
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
          <p className="text-xs text-muted-foreground mb-0.5">Date Saved</p>
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
      <h3 className="font-serif text-lg mb-2">No properties yet</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        Add properties and searches to track their performance and build your intelligence portfolio.
      </p>
      <Button
        size="sm"
        className="gap-1.5"
        onClick={onAdd}
        data-testid="button-add-first-property"
      >
        <Plus className="h-3.5 w-3.5" />
        Add your first property
      </Button>
    </div>
  );
}

export default function PortfolioPage() {
  useDocumentTitle("Portfolio");
  // Use state to force re-renders when portfolio changes
  const [items, setItems] = useState<PortfolioItem[]>(() => [...portfolioItems]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const stats = getPortfolioStats();

  const refreshItems = useCallback(() => {
    setItems([...portfolioItems]);
  }, []);

  function handleRemove(id: number) {
    removeFromPortfolio(id);
    refreshItems();
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
      addToPortfolio(report);
      refreshItems();
      setDialogOpen(false);
      setSearchQuery("");
      toast({
        title: "Added to portfolio",
        description: `Brief generated for "${query}" and saved to your portfolio.`,
      });
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

  // Compute stats from current items to stay reactive
  const totalProperties = items.length;
  const prices = items
    .map((item) => {
      const raw = item.averagePrice.replace(/[£,]/g, "");
      return parseInt(raw, 10);
    })
    .filter((p) => !isNaN(p));
  const totalValue =
    prices.length > 0
      ? `£${prices.reduce((s, p) => s + p, 0).toLocaleString("en-GB")}`
      : "—";
  const avgValue =
    prices.length > 0
      ? `£${Math.round(prices.reduce((s, p) => s + p, 0) / prices.length).toLocaleString("en-GB")}`
      : "—";

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
                Your saved properties and area intelligence briefs
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
                    Enter a postcode or property address to generate an intelligence brief and add it to your portfolio.
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
              label="Total Properties"
              value={totalProperties}
            />
            <StatCard
              icon={BarChart3}
              label="Average Portfolio Value"
              value={avgValue}
            />
            <StatCard
              icon={TrendingUp}
              label="Total Value"
              value={totalValue}
            />
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.length === 0 ? (
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
