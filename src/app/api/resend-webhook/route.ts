import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/resend-webhook
 *
 * Receives email.opened and email.clicked events from Resend (via Svix).
 * Updates profiles.last_email_opened_at / last_email_clicked_at for churn detection.
 * Also updates email_digest_log.status to "opened" when the daily digest is opened.
 *
 * Env vars required:
 *   RESEND_WEBHOOK_SECRET — signing secret from Resend → Webhooks dashboard (whsec_...)
 *   SUPABASE_SERVICE_ROLE_KEY — service role for RLS bypass
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!
);

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("RESEND_WEBHOOK_SECRET not set — rejecting webhook");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await req.text();
  const svixId        = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  const wh = new Webhook(webhookSecret);
  let payload: { type: string; data: Record<string, unknown> };

  try {
    payload = wh.verify(body, {
      "svix-id":        svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = payload;

  // email_id is the Resend message ID — matches resend_id in email_digest_log
  const emailId  = (data.email_id ?? data.id) as string | undefined;
  const emailTo  = (data.to as string[] | undefined)?.[0] ?? (data.to as string | undefined);

  if (!emailTo && !emailId) {
    // Nothing we can act on
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();

  if (type === "email.opened") {
    // Update last_email_opened_at on the profile matching this email address
    if (emailTo) {
      await supabaseAdmin
        .from("profiles")
        .update({ last_email_opened_at: now })
        .eq("email", emailTo);
    }

    // Mark the digest log row as opened (only if currently "sent")
    if (emailId) {
      await supabaseAdmin
        .from("email_digest_log")
        .update({ status: "opened" })
        .eq("resend_id", emailId)
        .eq("status", "sent");
    }
  } else if (type === "email.clicked") {
    if (emailTo) {
      await supabaseAdmin
        .from("profiles")
        .update({ last_email_clicked_at: now })
        .eq("email", emailTo);
    }
  }

  return NextResponse.json({ ok: true });
}
