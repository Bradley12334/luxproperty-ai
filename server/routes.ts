import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { createRequire } from "module";

// ─── Vercel API handler bridge ────────────────────────────────────────────────
// The api/*.js files are Vercel serverless functions. In development (Express),
// we proxy them by loading the handler and adapting the request/response objects.
async function loadApiHandler(filename: string) {
  try {
    const require = createRequire(import.meta.url);
    // Use dynamic import for ES module handlers
    const mod = await import(path.resolve(process.cwd(), "api", filename));
    return mod.default ?? mod;
  } catch (e) {
    console.error(`Failed to load api handler ${filename}:`, e);
    return null;
  }
}

function makeVercelReq(req: Request) {
  return { query: req.query as Record<string, string>, method: req.method, body: req.body, headers: req.headers };
}

function makeVercelRes(res: Response) {
  return {
    status(code: number) { res.status(code); return this; },
    json(data: unknown) { res.json(data); },
    send(data: unknown) { res.send(data); },
    setHeader(k: string, v: string) { res.setHeader(k, v); return this; },
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ─── Vercel API handlers (dev bridge) ───────────────────────────────────────
  const apiRoutes: Array<[string, string]> = [
    ["/api/tfl-commute",             "tfl-commute.js"],
    ["/api/rental-market",           "rental-market.js"],
    ["/api/broadband",               "broadband.js"],
    ["/api/valuation-entitlement",   "valuation-entitlement.js"],
  ];

  for (const [route, file] of apiRoutes) {
    const handler = await loadApiHandler(file);
    if (!handler) continue;
    app.get(route, async (req: Request, res: Response) => {
      try {
        await handler(makeVercelReq(req), makeVercelRes(res));
      } catch (err) {
        console.error(`Error in ${route}:`, err);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }

  return httpServer;
}
