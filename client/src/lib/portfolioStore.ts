import type { BriefReport } from "@shared/schema";

export interface PortfolioItem {
  id: number;
  query: string;
  areaName: string;
  averagePrice: string;
  savedAt: string;
  briefId: number;
  report: BriefReport;
}

// In-memory portfolio store
export const portfolioItems: PortfolioItem[] = [];

let itemIdCounter = 1;

export function addToPortfolio(report: BriefReport): PortfolioItem {
  const existing = portfolioItems.find((item) => item.briefId === report.id);
  if (existing) return existing;

  const item: PortfolioItem = {
    id: itemIdCounter++,
    query: report.query,
    areaName: report.areaIntelligence.area || report.areaIntelligence.location,
    averagePrice: report.areaIntelligence.marketOverview.averagePrice,
    savedAt: new Date().toISOString(),
    briefId: report.id,
    report,
  };
  portfolioItems.push(item);
  return item;
}

export function removeFromPortfolio(id: number): void {
  const idx = portfolioItems.findIndex((item) => item.id === id);
  if (idx !== -1) portfolioItems.splice(idx, 1);
}

export function isInPortfolio(briefId: number): boolean {
  return portfolioItems.some((item) => item.briefId === briefId);
}

export function getPortfolioStats(): {
  totalProperties: number;
  averagePortfolioValue: string;
  totalValue: string;
} {
  const count = portfolioItems.length;
  if (count === 0) {
    return { totalProperties: 0, averagePortfolioValue: "—", totalValue: "—" };
  }

  const prices = portfolioItems
    .map((item) => {
      const raw = item.averagePrice.replace(/[£,]/g, "");
      return parseInt(raw, 10);
    })
    .filter((p) => !isNaN(p));

  if (prices.length === 0) {
    return { totalProperties: count, averagePortfolioValue: "—", totalValue: "—" };
  }

  const total = prices.reduce((s, p) => s + p, 0);
  const avg = Math.round(total / prices.length);

  const fmt = (n: number) =>
    `£${Math.round(n).toLocaleString("en-GB")}`;

  return {
    totalProperties: count,
    averagePortfolioValue: fmt(avg),
    totalValue: fmt(total),
  };
}
