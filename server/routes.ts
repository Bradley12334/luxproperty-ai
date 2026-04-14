import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateBriefRequestSchema } from "@shared/schema";
import type { AreaIntelligence, PropertyDeepDive, BriefReport } from "@shared/schema";

function detectQueryType(query: string): "postcode" | "address" {
  // UK postcode pattern: letter(s) + number(s) + optional space + number + letters
  const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  const partialPostcode = /^[A-Z]{1,2}\d[A-Z\d]?$/i;
  const trimmed = query.trim();
  if (postcodePattern.test(trimmed) || partialPostcode.test(trimmed)) {
    return "postcode";
  }
  return "address";
}

function generateMockAreaIntelligence(query: string, queryType: string): AreaIntelligence {
  const isPostcode = queryType === "postcode";
  const postcodeAreas: Record<string, { location: string; area: string; avgPrice: number; growth: string }> = {
    "SW7": { location: "SW7", area: "South Kensington", avgPrice: 2850000, growth: "+4.2%" },
    "SW1": { location: "SW1", area: "Westminster", avgPrice: 3200000, growth: "+3.8%" },
    "SW3": { location: "SW3", area: "Chelsea", avgPrice: 3100000, growth: "+5.1%" },
    "W1": { location: "W1", area: "Mayfair", avgPrice: 4500000, growth: "+2.9%" },
    "W8": { location: "W8", area: "Kensington", avgPrice: 3400000, growth: "+4.7%" },
    "NW3": { location: "NW3", area: "Hampstead", avgPrice: 2600000, growth: "+6.2%" },
    "EC2": { location: "EC2", area: "City of London", avgPrice: 1800000, growth: "+3.1%" },
    "N1": { location: "N1", area: "Islington", avgPrice: 1450000, growth: "+5.8%" },
  };

  // Extract postcode prefix
  const prefix = query.trim().toUpperCase().replace(/\s+/g, "").match(/^([A-Z]{1,2}\d)/)?.[1] || "";
  const areaData = postcodeAreas[prefix] || { 
    location: query.trim().toUpperCase().split(" ")[0], 
    area: "Prime Central London", 
    avgPrice: 2200000, 
    growth: "+4.5%" 
  };

  const avgPrice = areaData.avgPrice;
  
  return {
    location: isPostcode ? areaData.location : query.split(",")[0].trim(),
    area: isPostcode ? areaData.area : areaData.area,
    executiveSummary: `${areaData.area} remains one of London's most sought-after residential markets, with sustained demand from domestic and international buyers. Average property values have demonstrated resilient growth of ${areaData.growth} year-on-year, outperforming the broader London market by 1.8 percentage points. Current supply remains constrained at 12% below the five-year average, supporting continued price appreciation.`,
    marketOverview: {
      averagePrice: `£${(avgPrice).toLocaleString()}`,
      priceChangeYoY: areaData.growth,
      avgDaysOnMarket: Math.floor(Math.random() * 30) + 35,
      supplyLevel: "Below Average",
    },
    priceTrend: [
      { year: 2020, averagePrice: `£${Math.round(avgPrice * 0.82).toLocaleString()}`, change: "-2.1%" },
      { year: 2021, averagePrice: `£${Math.round(avgPrice * 0.88).toLocaleString()}`, change: "+7.3%" },
      { year: 2022, averagePrice: `£${Math.round(avgPrice * 0.92).toLocaleString()}`, change: "+4.5%" },
      { year: 2023, averagePrice: `£${Math.round(avgPrice * 0.96).toLocaleString()}`, change: "+4.3%" },
      { year: 2024, averagePrice: `£${avgPrice.toLocaleString()}`, change: areaData.growth },
    ],
    neighbourhoodProfile: {
      schoolsRating: 8.7,
      transportRating: 9.2,
      safetyRating: 8.4,
      walkability: 9.5,
    },
    investmentOutlook: {
      growthForecast: "+3.5% – 5.2% p.a. (2025–2028)",
      rentalYieldEstimate: "3.2% – 3.8% gross",
      riskFlags: [
        "Stamp duty surcharge for overseas buyers (2%)",
        "Potential capital gains tax reform in Spring Budget",
        "Interest rate sensitivity on leveraged purchases",
      ],
    },
    verdict: `${areaData.area} presents a compelling long-term investment case with strong fundamentals. The combination of constrained supply, world-class amenities, and enduring international demand provides a robust floor for values. We would recommend proceeding with acquisition at or slightly below current asking prices, with particular attention to properties requiring modernisation where value-add potential of 15–25% exists. The area's resilience during recent market corrections further supports its status as a defensive allocation within a broader property portfolio.`,
  };
}

function generateMockPropertyDeepDive(query: string): PropertyDeepDive {
  const streetNames = ["Onslow Gardens", "Pelham Crescent", "Thurloe Square", "Egerton Crescent"];
  const prices = [2450000, 2780000, 3100000, 2620000];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  return {
    valuationAssessment: {
      estimatedRange: "£2,650,000 – £2,950,000",
      priceVsAreaAverage: "+4.2% above area median",
      valueScore: "7.8 / 10",
    },
    comparableSales: [
      {
        address: `14 ${streetNames[0]}, SW7`,
        price: `£${prices[0].toLocaleString()}`,
        date: `${months[Math.floor(Math.random() * 6)]} 2024`,
        type: "3-bed flat",
      },
      {
        address: `8 ${streetNames[1]}, SW7`,
        price: `£${prices[1].toLocaleString()}`,
        date: `${months[Math.floor(Math.random() * 6) + 3]} 2024`,
        type: "4-bed maisonette",
      },
      {
        address: `22 ${streetNames[2]}, SW7`,
        price: `£${prices[2].toLocaleString()}`,
        date: `${months[Math.floor(Math.random() * 6) + 6]} 2024`,
        type: "3-bed flat",
      },
      {
        address: `5 ${streetNames[3]}, SW7`,
        price: `£${prices[3].toLocaleString()}`,
        date: `${months[Math.floor(Math.random() * 3) + 9]} 2024`,
        type: "2-bed flat",
      },
    ],
    negotiationBrief: {
      suggestedOfferRange: "£2,550,000 – £2,700,000",
      leveragePoints: [
        "Property has been on market for 58 days — above area average of 42",
        "No chain — vendor relocated overseas",
        "Interior requires updating — factor £150,000–£200,000 refurbishment budget",
        "Comparable at 14 Onslow Gardens sold 8% below initial asking",
        "Offer conditional on survey — leverage any structural findings",
      ],
    },
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/briefs/generate", async (req, res) => {
    try {
      const parsed = generateBriefRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
      }

      const { query } = parsed.data;
      const queryType = detectQueryType(query);

      // Simulate AI processing delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const areaIntelligence = generateMockAreaIntelligence(query, queryType);
      const propertyDeepDive = queryType === "address" ? generateMockPropertyDeepDive(query) : undefined;

      const reportData: Omit<BriefReport, "id"> = {
        query,
        queryType,
        generatedAt: new Date().toISOString(),
        areaIntelligence,
        propertyDeepDive,
      };

      const brief = await storage.createBrief({
        query,
        queryType,
        data: JSON.stringify(reportData),
        createdAt: new Date().toISOString(),
      });

      const report: BriefReport = {
        ...reportData,
        id: brief.id,
      };

      return res.json(report);
    } catch (error) {
      console.error("Error generating brief:", error);
      return res.status(500).json({ message: "Failed to generate brief" });
    }
  });

  app.get("/api/briefs/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid brief ID" });
    }
    const brief = await storage.getBrief(id);
    if (!brief) {
      return res.status(404).json({ message: "Brief not found" });
    }
    const report = JSON.parse(brief.data) as BriefReport;
    report.id = brief.id;
    return res.json(report);
  });

  app.get("/api/briefs", async (_req, res) => {
    const allBriefs = await storage.getAllBriefs();
    return res.json(allBriefs.map(b => ({
      id: b.id,
      query: b.query,
      queryType: b.queryType,
      createdAt: b.createdAt,
    })));
  });

  return httpServer;
}
