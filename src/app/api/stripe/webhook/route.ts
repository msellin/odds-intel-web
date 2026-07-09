import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SITE_URL = process.env.SITE_URL ?? "https://oddsintel.app";

async function sendUpgradeEmail(to: string, tier: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL ?? "OddsIntel <digest@oddsintel.app>";
  if (!apiKey) return;

  const isPro = tier === "pro";
  const tierLabel = isPro ? "Pro" : "Elite";
  const tierColor = isPro ? "#3b82f6" : "#a855f7";

  const features = isPro
    ? [
        "Full value bets with exact odds and edge %",
        "Odds movement tracking on every match",
        "In-play signals during live matches",
        "Full match intelligence: injuries, lineups, H2H, stats",
        "Daily email digest with today's value bet count",
      ]
    : [
        "Every value bet: selection, odds, model probability, edge %, Kelly stake",
        "AI explanation for each pick (why this bet?)",
        "Bankroll analytics dashboard with drawdown tracking",
        "Full CLV tracking per settled bet",
        "All Pro features included",
      ];

  const featuresHtml = features
    .map(
      (f) =>
        `<tr><td style="padding:6px 0;font-size:14px;color:#0f172a;">` +
        `<span style="color:${tierColor};font-weight:700;margin-right:8px;">✓</span>${f}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;">
    <tr><td align="center" style="padding:32px 16px 24px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#0d1117;border-radius:10px 10px 0 0;padding:24px 32px;text-align:center;">
            <a href="${SITE_URL}" style="text-decoration:none;display:inline-block;">
              <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:0.04em;">ODDS</span><span style="font-size:28px;font-weight:800;color:#22c55e;letter-spacing:0.04em;">INTEL</span>
            </a>
            <div style="margin-top:10px;display:inline-block;padding:4px 14px;background:${tierColor};border-radius:20px;font-size:12px;font-weight:700;color:#ffffff;letter-spacing:0.06em;">${tierLabel.toUpperCase()}</div>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:28px 32px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">You're now on ${tierLabel}</h2>
            <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">Your subscription is active. Here's what just unlocked:</p>
            <table width="100%" cellpadding="0" cellspacing="0">${featuresHtml}</table>
            <div style="margin-top:24px;text-align:center;">
              <a href="${SITE_URL}/performance" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;border-radius:6px;">See live track record →</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;padding:18px 32px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">Questions? Reply to this email — we read everything.</p>
            <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">Not financial or gambling advice. Please gamble responsibly.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: `You're now on OddsIntel ${tierLabel}`, html }),
  });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Admin client bypasses RLS — needed because webhook has no user session.
// Lazy-initialized so build-time page collection doesn't evaluate env vars
// that only exist at runtime.
let _supabaseAdmin: SupabaseClient | null = null;
function supabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url =
    process.env.NEXT_PUBLIC_POSTGREST_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.POSTGREST_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing PostgREST/Supabase env vars for Stripe webhook admin client"
    );
  }
  _supabaseAdmin = createClient(url, key);
  return _supabaseAdmin;
}

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
  const { error: dupError } = await supabaseAdmin()
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

      await supabaseAdmin()
        .from("profiles")
        .update({ tier, stripe_customer_id: session.customer as string })
        .eq("id", userId);

      // Send upgrade confirmation email
      const { data: profile } = await supabaseAdmin()
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();
      if (profile?.email) {
        sendUpgradeEmail(profile.email, tier).catch(() => {});
      }

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const productId = subscription.items.data[0].price.product as string;
      const isActive = ["active", "trialing"].includes(subscription.status);
      const tier = isActive ? (TIER_BY_PRODUCT[productId] ?? "free") : "free";

      await supabaseAdmin()
        .from("profiles")
        .update({ tier })
        .eq("stripe_customer_id", customerId);

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await supabaseAdmin()
        .from("profiles")
        .update({ tier: "free" })
        .eq("stripe_customer_id", customerId);

      break;
    }
  }

  return NextResponse.json({ received: true });
}
