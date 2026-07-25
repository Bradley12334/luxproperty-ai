// Portfolio add-to path: derive the four card fields from the REAL brief
// pipeline (/api/brief) so saved-portfolio numbers match a generated brief
// exactly — no divergent price query (spine rule). Replaces the retired
// client-side mockEngine.generateBrief for portfolio.

import { authHeader } from "@/lib/authStore";

export interface PortfolioSummary {
  query: string;         // postcode, uppercased — also the /brief/:postcode key
  queryType: "area";     // new pipeline is postcode/area-based (no address variant)
  areaName: string;      // ward → localAuthority → postcode
  averagePrice: string;  // windowMedian.formatted, or "—" when unavailable
}

export async function fetchPortfolioSummary(
  postcode: string,
): Promise<PortfolioSummary> {
  const clean = postcode.trim().toUpperCase();
  const url = `/api/brief?postcode=${encodeURIComponent(clean)}`;
  const res = await fetch(url, { headers: authHeader() });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error?.message ?? "Failed to generate brief");
  }
  const prices = (json.sections ?? []).find(
    (s: any) => s.key === "pricesTrendNegotiation",
  );
  const averagePrice =
    prices?.data?.marketOverview?.windowMedian?.formatted ?? "—";
  const areaName = json.meta?.ward || json.meta?.localAuthority || clean;
  return { query: clean, queryType: "area", areaName, averagePrice };
}
