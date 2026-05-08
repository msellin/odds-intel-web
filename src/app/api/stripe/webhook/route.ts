import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Admin client bypasses RLS — needed because webhook has no user session
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!
);

const TIER_BY_PRODUCT: Record<string, string> = {
  [process.env.STRIPE_PRO_PRODUCT_ID!]: "pro",
  [process.env.STRIPE_ELITE_PRODUCT_ID!]: "elite",
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: insert event.id before processing.
  // If already processed (e.g. Stripe retry), the UNIQUE constraint fires and we
  // return 200 immediately without re-applying side effects.
  // event.id comes from the verified JSON payload — not the Stripe-Signature header,
  // which is per-attempt and would NOT deduplicate retries.
  const { error: dupError } = await supabaseAdmin
    .from("processed_events")
    .insert({ event_id: event.id, event_type: event.type });

  if (dupError) {
    if (dupError.code === "23505") {
      // Already processed — idempotent success
      return NextResponse.json({ received: true });
    }
    // Unexpected DB error — return 500 so Stripe retries later
    console.error("processed_events insert failed:", dupError);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;

      const userId = session.metadata?.supabase_user_id;
      if (!userId || !session.subscription) break;

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      const productId = subscription.items.data[0].price.product as string;
      const tier = TIER_BY_PRODUCT[productId] ?? "free";

      await supabaseAdmin
        .from("profiles")
        .update({ tier, stripe_customer_id: session.customer as string })
        .eq("id", userId);

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const productId = subscription.items.data[0].price.product as string;
      const isActive = ["active", "trialing"].includes(subscription.status);
      const tier = isActive ? (TIER_BY_PRODUCT[productId] ?? "free") : "free";

      await supabaseAdmin
        .from("profiles")
        .update({ tier })
        .eq("stripe_customer_id", customerId);

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await supabaseAdmin
        .from("profiles")
        .update({ tier: "free" })
        .eq("stripe_customer_id", customerId);

      break;
    }
  }

  return NextResponse.json({ received: true });
}
