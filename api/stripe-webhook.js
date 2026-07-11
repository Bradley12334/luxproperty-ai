// Vercel Serverless Function — Stripe Webhook Handler
// Listens for checkout.session.completed and upgrades the user's plan in Supabase

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// ─── Plan mapping ────────────────────────────────────────────────────────────
// Stripe object IDs are MODE-SPECIFIC: test-mode products/prices have different
// IDs from live-mode ones. Hardcoding a single set is what broke this before —
// the map held prod_UKur… IDs that existed in no mode at all, so the lookup
// always failed, `plan` stayed null, and the handler returned 200 without ever
// touching the database. Payments succeeded; nobody was upgraded.
//
// Resolution is now layered so it works in BOTH modes:
//   1. Env-configured IDs — set these per Vercel environment (live IDs on
//      Production, test IDs on Preview/Development):
//        STRIPE_PRODUCT_PROFESSIONAL / STRIPE_PRODUCT_INVESTOR
//        STRIPE_PRICE_PROFESSIONAL   / STRIPE_PRICE_INVESTOR
//   2. Known live-mode IDs (acct_1TMEwHP7AaxWnYG2) as built-in defaults, so
//      production keeps working even with no env vars set.
//   3. Product metadata/name lookup (see resolvePlanFromProduct) — the safety
//      net that makes an unconfigured test-mode product still resolve.
// The maps are a UNION of ids → plan, so test and live IDs can coexist safely.
function buildPlanMap(entries) {
  const map = {};
  for (const [id, plan] of entries) {
    if (id && typeof id === "string") map[id.trim()] = plan;
  }
  return map;
}

const PRODUCT_TO_PLAN = buildPlanMap([
  [process.env.STRIPE_PRODUCT_PROFESSIONAL, "professional"],
  [process.env.STRIPE_PRODUCT_INVESTOR, "investor"],
  ["prod_URdf6yYOnUexia", "professional"], // live — Professional £4.99/mo
  ["prod_URdg68jhOvTMso", "investor"],     // live — Investor £39.99/mo
]);

const PRICE_TO_PLAN = buildPlanMap([
  [process.env.STRIPE_PRICE_PROFESSIONAL, "professional"],
  [process.env.STRIPE_PRICE_INVESTOR, "investor"],
  ["price_1TSkOHP7AaxWnYG27bdaHVBU", "professional"], // live — £4.99/mo
  ["price_1TSkOlP7AaxWnYG2LJzX7Jc7", "investor"],     // live — £39.99/mo
]);

// Last-resort resolution: ask Stripe about the product itself. Works in any
// mode with no configuration, provided the product carries metadata.plan
// (preferred — set `plan=professional` / `plan=investor` on the Stripe product)
// or is simply named "Professional" / "Investor" as they are today.
async function resolvePlanFromProduct(stripe, productId) {
  try {
    const product = await stripe.products.retrieve(productId);
    const metaPlan = String(product.metadata?.plan || "").toLowerCase().trim();
    if (metaPlan === "professional" || metaPlan === "investor") return metaPlan;
    const name = String(product.name || "").toLowerCase();
    if (name.includes("professional")) return "professional";
    if (name.includes("investor")) return "investor";
  } catch (err) {
    console.error("Product lookup failed for", productId, err.message);
  }
  return null;
}

export const config = {
  api: {
    bodyParser: false, // Stripe needs the raw body to verify signature
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-04-10",
  });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY // use service key server-side (bypasses RLS)
  );

  // Verify Stripe signature
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  // Handle checkout completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // ── Identity ─────────────────────────────────────────────────────────────
    // client_reference_id is the LuxProperty user id, attached to the Payment
    // Link by client/src/lib/checkout.ts. It is the ONLY trustworthy link
    // between the payment and the account that initiated it. The checkout email
    // is a fallback for anonymous purchases (the buyer may type any address).
    const userId = session.client_reference_id || null;
    const customerEmail = (
      session.customer_details?.email ||
      session.customer_email ||
      ""
    )
      .toLowerCase()
      .trim();

    // ── Resolve plan from line items ─────────────────────────────────────────
    // Order: known product id → known price id → ask Stripe about the product
    // (metadata.plan, then name). The final step is what lets an unconfigured
    // test-mode product resolve without hardcoding its IDs.
    let plan = null;
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
      for (const item of lineItems.data) {
        const productId = item.price?.product;
        const priceId = item.price?.id;
        if (productId && PRODUCT_TO_PLAN[productId]) {
          plan = PRODUCT_TO_PLAN[productId];
          break;
        }
        if (priceId && PRICE_TO_PLAN[priceId]) {
          plan = PRICE_TO_PLAN[priceId];
          break;
        }
        if (productId) {
          plan = await resolvePlanFromProduct(stripe, productId);
          if (plan) {
            console.warn(
              `Plan resolved via product lookup, not the ID map — product ${productId} ` +
              `is not in PRODUCT_TO_PLAN. Add it (or set STRIPE_PRODUCT_* env vars) for this mode.`
            );
            break;
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch line items for session", session.id, err.message);
      // Fetching line items failed — this is transient/infrastructural.
      // Return 500 so Stripe retries rather than losing the upgrade.
      return res.status(500).json({ error: "Could not fetch line items" });
    }

    if (!plan) {
      // A paid session we cannot map to a plan is a CONFIGURATION BUG (the
      // product/price IDs above are out of date). Fail loudly: 500 makes Stripe
      // retry and surfaces the endpoint as failing in the dashboard, instead of
      // silently taking money and doing nothing.
      console.error(
        "PLAN RESOLUTION FAILED — payment taken, no upgrade applied. session:",
        session.id,
        "| fix: set STRIPE_PRODUCT_PROFESSIONAL / STRIPE_PRODUCT_INVESTOR (or",
        "STRIPE_PRICE_*) for this Stripe mode, or set metadata.plan on the product"
      );
      return res.status(500).json({ error: "Could not determine plan" });
    }

    // ── Apply the upgrade ────────────────────────────────────────────────────
    // New Professional subscribers also get one free Investor-level brief.
    const updates = plan === "professional"
      ? { plan, bonus_investor_brief: true }
      : { plan };

    let updated = [];

    // 1. Preferred: match on the account id carried through checkout.
    if (userId) {
      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId)
        .select("id, email, plan");
      if (error) {
        console.error("Supabase update by id failed:", error.message);
        return res.status(500).json({ error: "Database update failed" });
      }
      updated = data || [];
    }

    // 2. Fallback: match on the checkout email (anonymous purchase, or a
    //    checkout started before client_reference_id was attached).
    if (updated.length === 0 && customerEmail) {
      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("email", customerEmail)
        .select("id, email, plan");
      if (error) {
        console.error("Supabase update by email failed:", error.message);
        return res.status(500).json({ error: "Database update failed" });
      }
      updated = data || [];
    }

    if (updated.length === 0) {
      // Money taken but we cannot identify an account to upgrade. We return 200
      // (a retry cannot fix this — there is genuinely no matching account yet),
      // but this MUST be visible: it is unfulfilled paid revenue needing manual
      // reconciliation.
      console.error(
        "UNFULFILLED PAYMENT — no LuxProperty account matched. session:",
        session.id,
        "| client_reference_id:", userId,
        "| checkout email:", customerEmail,
        "| plan owed:", plan
      );
      return res.status(200).json({ received: true, warning: "No account matched" });
    }

    console.log(
      `Plan upgraded: ${updated[0].email} → ${plan} (matched by ${userId && updated.length ? "user id" : "email"})`
    );
  }

  // Handle subscription cancellation / payment failure (optional future use)
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    // Downgrade to explorer when subscription is cancelled
    // Requires customer email lookup — implement when needed
    console.log("Subscription cancelled:", subscription.id);
  }

  return res.status(200).json({ received: true });
}
