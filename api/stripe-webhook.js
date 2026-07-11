// Vercel Serverless Function — Stripe Webhook Handler
// Listens for checkout.session.completed and upgrades the user's plan in Supabase

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// ─── Plan mapping ────────────────────────────────────────────────────────────
// These MUST match the live Stripe account (acct_1TMEwHP7AaxWnYG2).
// Verified against the live account — do not edit without re-checking:
//   Stripe Dashboard → Product catalogue → click product → copy Product/Price ID.
//
// Previously these held product IDs (prod_UKur…) that did not exist in the
// account at all, so the lookup always failed, `plan` stayed null, and the
// handler returned 200 without ever touching the database — payments succeeded
// and nobody was upgraded. Product ID is the primary key; price ID is a
// fallback in case a product is re-priced under a new price object.
const PRODUCT_TO_PLAN = {
  prod_URdf6yYOnUexia: "professional", // Professional — £4.99/mo
  prod_URdg68jhOvTMso: "investor",     // Investor — £39.99/mo
};

const PRICE_TO_PLAN = {
  price_1TSkOHP7AaxWnYG27bdaHVBU: "professional", // £4.99/mo
  price_1TSkOlP7AaxWnYG2LJzX7Jc7: "investor",     // £39.99/mo
};

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

    // ── Resolve plan from line items (product first, then price) ──────────────
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
        "| update PRODUCT_TO_PLAN / PRICE_TO_PLAN in api/stripe-webhook.js"
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
