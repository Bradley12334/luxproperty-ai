// Vercel Serverless Function — Stripe Webhook Handler
// Listens for checkout.session.completed and upgrades the user's plan in Supabase

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Plan mapping: Stripe Price ID → LuxProperty plan name
// Update these with your live price IDs when you switch to live mode
const PRICE_TO_PLAN = {
  // Test mode prices
  "price_1TMEwS1Zq1gPmTir4gM5kw": "professional", // fallback — update below
  // Add your actual price IDs from Stripe dashboard:
  // Stripe Dashboard → Products → click product → copy Price ID (starts with price_)
};

// Product ID → plan mapping (more reliable than price IDs)
const PRODUCT_TO_PLAN = {
  "prod_UKurCblARauIIo": "professional",
  "prod_UKurqNVnd7QTWL": "investor",
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

    const customerEmail = session.customer_details?.email || session.customer_email;
    if (!customerEmail) {
      console.error("No customer email in session:", session.id);
      return res.status(200).json({ received: true }); // 200 so Stripe doesn't retry
    }

    // Determine plan from line items
    let plan = null;
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
      for (const item of lineItems.data) {
        const productId = item.price?.product;
        if (productId && PRODUCT_TO_PLAN[productId]) {
          plan = PRODUCT_TO_PLAN[productId];
          break;
        }
      }
    } catch (err) {
      console.error("Failed to fetch line items:", err.message);
    }

    if (!plan) {
      console.error("Could not determine plan for session:", session.id);
      return res.status(200).json({ received: true });
    }

    // Upgrade the user in Supabase
    const email = customerEmail.toLowerCase().trim();
    const { data, error } = await supabase
      .from("users")
      .update({ plan })
      .eq("email", email)
      .select("id, email, plan");

    if (error) {
      console.error("Supabase update failed:", error.message);
      return res.status(500).json({ error: "Database update failed" });
    }

    if (!data || data.length === 0) {
      // User doesn't have a LuxProperty account yet — log it
      console.warn(`No LuxProperty account found for ${email}. They need to sign up first.`);
      // Still return 200 so Stripe doesn't keep retrying
      return res.status(200).json({ received: true, warning: "No account found" });
    }

    console.log(`Plan upgraded: ${email} → ${plan}`);
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
