import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase-server";
import { checkRateLimit } from "@/lib/rate-limit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!
);

const ELITE_FOUNDING_CAP = 200;

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 5 requests/hour per user — prevents hammering Stripe API
  const rl = checkRateLimit(`stripe-upgrade:${user.id}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests — please try again later." }, { status: 429 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, tier")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  // Resolve Elite price — founding rate if cap not reached
  const { count: eliteCount } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("tier", "elite");

  const elitePriceId =
    (eliteCount ?? 0) < ELITE_FOUNDING_CAP
      ? process.env.STRIPE_ELITE_FOUNDING_PRICE_ID!
      : process.env.STRIPE_ELITE_MONTHLY_PRICE_ID!;

  // Find active subscription
  const subscriptions = await stripe.subscriptions.list({
    customer: profile.stripe_customer_id,
    status: "active",
    limit: 1,
  });

  if (!subscriptions.data.length) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 400 });
  }

  const subscription = subscriptions.data[0];
  const itemId = subscription.items.data[0].id;

  // Update subscription price — Stripe handles proration automatically
  await stripe.subscriptions.update(subscription.id, {
    items: [{ id: itemId, price: elitePriceId }],
    proration_behavior: "create_prorations",
  });

  // Update tier immediately (webhook will also fire but this is faster)
  await supabaseAdmin
    .from("profiles")
    .update({ tier: "elite" })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
