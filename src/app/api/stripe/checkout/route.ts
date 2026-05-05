import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase-server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!
);

const PRO_FOUNDING_CAP = 500;
const ELITE_FOUNDING_CAP = 200;

// Returns the price to actually charge — founding rate if cap not reached, else regular
async function resolvePrice(requestedPriceId: string): Promise<string> {
  const proFounding = process.env.STRIPE_PRO_FOUNDING_PRICE_ID!;
  const eliteFounding = process.env.STRIPE_ELITE_FOUNDING_PRICE_ID!;
  const proMonthly = process.env.STRIPE_PRO_MONTHLY_PRICE_ID!;
  const eliteMonthly = process.env.STRIPE_ELITE_MONTHLY_PRICE_ID!;

  if (requestedPriceId === proFounding) {
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("tier", "pro");
    return (count ?? 0) >= PRO_FOUNDING_CAP ? proMonthly : proFounding;
  }

  if (requestedPriceId === eliteFounding) {
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("tier", "elite");
    return (count ?? 0) >= ELITE_FOUNDING_CAP ? eliteMonthly : eliteFounding;
  }

  return requestedPriceId;
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  let requestedPriceId: string = body.priceId;

  // Allow callers to pass { tier: "pro" | "elite" } instead of a raw price ID
  if (!requestedPriceId && body.tier) {
    requestedPriceId = body.tier === "pro"
      ? process.env.STRIPE_PRO_FOUNDING_PRICE_ID!
      : process.env.STRIPE_ELITE_FOUNDING_PRICE_ID!;
  }

  if (!requestedPriceId) {
    return NextResponse.json({ error: "Missing priceId or tier" }, { status: 400 });
  }
  const priceId = await resolvePrice(requestedPriceId);

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id as string | undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const origin = req.headers.get("origin") ?? "https://oddsintel.app";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { trial_period_days: 7 },
    allow_promotion_codes: true,
    success_url: `${origin}/profile?checkout=success`,
    cancel_url: `${origin}/profile?checkout=cancelled`,
    metadata: { supabase_user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
