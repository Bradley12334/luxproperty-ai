import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const briefs = sqliteTable("briefs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  query: text("query").notNull(),
  queryType: text("query_type").notNull(), // "postcode" | "address"
  data: text("data").notNull(), // JSON stringified report data
  createdAt: text("created_at").notNull(),
});

export const insertBriefSchema = createInsertSchema(briefs).omit({
  id: true,
});

export type InsertBrief = z.infer<typeof insertBriefSchema>;
export type Brief = typeof briefs.$inferSelect;

// Request/response types
export const generateBriefRequestSchema = z.object({
  query: z.string().min(1, "Please enter a postcode or address"),
});

export type GenerateBriefRequest = z.infer<typeof generateBriefRequestSchema>;

export interface AreaIntelligence {
  location: string;
  area: string;
  executiveSummary: string;
  marketOverview: {
    averagePrice: string;
    priceChangeYoY: string;
    avgDaysOnMarket: number;
    supplyLevel: string;
  };
  priceTrend: Array<{
    year: number;
    averagePrice: string;
    change: string;
  }>;
  neighbourhoodProfile: {
    schoolsRating: number;
    transportRating: number;
    safetyRating: number;
    walkability: number;
  };
  investmentOutlook: {
    growthForecast: string;
    rentalYieldEstimate: string;
    riskFlags: string[];
  };
  verdict: string;
}

export interface PropertyDeepDive {
  valuationAssessment: {
    estimatedRange: string;
    priceVsAreaAverage: string;
    valueScore: string;
  };
  comparableSales: Array<{
    address: string;
    price: string;
    date: string;
    type: string;
  }>;
  negotiationBrief: {
    suggestedOfferRange: string;
    leveragePoints: string[];
  };
}

export interface BriefReport {
  id: number;
  query: string;
  queryType: "postcode" | "address";
  generatedAt: string;
  areaIntelligence: AreaIntelligence;
  propertyDeepDive?: PropertyDeepDive;
}
