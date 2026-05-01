// Supabase-backed portfolio store — saved briefs persist across sessions
// Uses public.saved_briefs table; queries are scoped by user_id

import { supabase } from "./supabase";
import { getUser } from "./authStore";
import type { BriefReport } from "@shared/schema";

export interface PortfolioItem {
  id: string;          // uuid from Supabase
  query: string;
  areaName: string;
  averagePrice: string;
  savedAt: string;
  briefId: number;     // report.id (local)
  report: BriefReport;
}

// ─── Load portfolio from Supabase ────────────────────────────────────────────
export async function loadPortfolio(): Promise<PortfolioItem[]> {
  const user = getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("saved_briefs")
    .select("id, postcode, area_name, report_json, saved_at")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false });

  if (error) {
    console.error("loadPortfolio error:", error);
    return [];
  }

  return (data ?? []).map((row) => {
    let report: BriefReport;
    try {
      report = JSON.parse(row.report_json);
    } catch {
      return null;
    }
    return {
      id: row.id,
      query: row.postcode,
      areaName: row.area_name,
      averagePrice: report.areaIntelligence?.marketOverview?.averagePrice ?? "—",
      savedAt: row.saved_at,
      briefId: report.id,
      report,
    };
  }).filter(Boolean) as PortfolioItem[];
}

// ─── Add to portfolio ────────────────────────────────────────────────────────
export async function addToPortfolio(report: BriefReport): Promise<{ ok: boolean; item?: PortfolioItem }> {
  const user = getUser();
  if (!user) return { ok: false };

  // Check if already saved (by postcode + user)
  const { data: existing } = await supabase
    .from("saved_briefs")
    .select("id")
    .eq("user_id", user.id)
    .eq("postcode", report.query.toUpperCase())
    .maybeSingle();

  if (existing) {
    // Already in portfolio — return it
    const items = await loadPortfolio();
    const found = items.find((i) => i.id === existing.id);
    return { ok: true, item: found };
  }

  const areaName =
    report.areaIntelligence?.area || report.areaIntelligence?.location || report.query;

  const { data, error } = await supabase
    .from("saved_briefs")
    .insert({
      user_id: user.id,
      postcode: report.query.toUpperCase(),
      area_name: areaName,
      report_json: JSON.stringify(report),
    })
    .select("id, postcode, area_name, saved_at")
    .single();

  if (error || !data) {
    console.error("addToPortfolio error:", error);
    return { ok: false };
  }

  const item: PortfolioItem = {
    id: data.id,
    query: data.postcode,
    areaName: data.area_name,
    averagePrice: report.areaIntelligence?.marketOverview?.averagePrice ?? "—",
    savedAt: data.saved_at,
    briefId: report.id,
    report,
  };

  return { ok: true, item };
}

// ─── Remove from portfolio ────────────────────────────────────────────────────
export async function removeFromPortfolio(id: string): Promise<void> {
  const user = getUser();
  if (!user) return;

  const { error } = await supabase
    .from("saved_briefs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // safety check

  if (error) console.error("removeFromPortfolio error:", error);
}

// ─── Check if saved ─────────────────────────────────────────────────────────
export async function isInPortfolio(postcode: string): Promise<boolean> {
  const user = getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("saved_briefs")
    .select("id")
    .eq("user_id", user.id)
    .eq("postcode", postcode.toUpperCase())
    .maybeSingle();

  return !!data;
}

// ─── Portfolio stats ─────────────────────────────────────────────────────────
export function getPortfolioStats(items: PortfolioItem[]): {
  totalProperties: number;
  averagePortfolioValue: string;
  totalValue: string;
} {
  const count = items.length;
  if (count === 0) {
    return { totalProperties: 0, averagePortfolioValue: "—", totalValue: "—" };
  }

  const prices = items
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
  const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

  return {
    totalProperties: count,
    averagePortfolioValue: fmt(avg),
    totalValue: fmt(total),
  };
}
