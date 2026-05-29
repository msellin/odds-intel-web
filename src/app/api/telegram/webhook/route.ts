import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// MANUAL-PLACE: only this chat id can use the "Record at Coolbet" button.
// Mirrors the engine's TELEGRAM_CHAT_ID — env name kept identical so a single
// value drives both sides.
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function sendReply(chatId: number, text: string) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// MANUAL-PLACE: ack the button tap. Telegram requires a callback_query response
// within ~15s or the button shows a spinner forever; we ack immediately, the
// actual placement happens asynchronously on Railway.
async function answerCallbackQuery(callbackQueryId: string, text: string, alert = false) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: alert,
    }),
  });
}

async function handleCallbackQuery(
  cq: Record<string, unknown>,
  admin: ReturnType<typeof createAdmin>,
) {
  const cqId = cq.id as string | undefined;
  const data = (cq.data as string | undefined) ?? "";
  const from = cq.from as Record<string, unknown> | undefined;
  const fromId = from?.id as number | undefined;
  const message = cq.message as Record<string, unknown> | undefined;
  const messageId = message?.message_id as number | undefined;
  const chatId = (message?.chat as Record<string, unknown> | undefined)?.id as
    | number
    | undefined;

  if (!cqId || !fromId) return;

  // Admin-gate: only the configured admin chat can place. Any other user
  // taps a forwarded message → instant "not authorised" alert.
  if (!ADMIN_CHAT_ID || String(fromId) !== String(ADMIN_CHAT_ID)) {
    await answerCallbackQuery(cqId, "🚫 Not authorised", true);
    return;
  }

  if (!data.startsWith("place:")) {
    await answerCallbackQuery(cqId, "Unknown action");
    return;
  }

  const simulatedBetId = data.slice("place:".length).trim();
  if (!UUID_RE.test(simulatedBetId)) {
    await answerCallbackQuery(cqId, "❌ Invalid bet id", true);
    return;
  }

  // Short-circuit: already in real_bets → ack without queueing
  const { data: existing } = await admin
    .from("real_bets")
    .select("id")
    .eq("simulated_bet_id", simulatedBetId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await answerCallbackQuery(cqId, "✓ Already recorded", false);
    return;
  }

  // Dedup: don't queue twice if a previous tap is still pending/processing
  const { data: inflight } = await admin
    .from("manual_placement_queue")
    .select("id, status")
    .eq("simulated_bet_id", simulatedBetId)
    .in("status", ["pending", "processing"])
    .limit(1)
    .maybeSingle();

  if (inflight) {
    await answerCallbackQuery(cqId, "⏳ Already queued, working on it…");
    return;
  }

  const { error: insertErr } = await admin
    .from("manual_placement_queue")
    .insert({
      simulated_bet_id: simulatedBetId,
      requested_by_chat_id: fromId,
      telegram_chat_id: chatId ?? null,
      telegram_message_id: messageId ?? null,
    });

  if (insertErr) {
    console.error("manual_placement_queue insert failed", insertErr);
    await answerCallbackQuery(cqId, "❌ Queue insert failed — check logs", true);
    return;
  }

  await answerCallbackQuery(cqId, "📝 Queued — recording at Coolbet…");
}

export async function POST(req: NextRequest) {
  // Verify the request comes from Telegram via the shared secret
  if (WEBHOOK_SECRET) {
    const incoming = req.headers.get("x-telegram-bot-api-secret-token");
    if (incoming !== WEBHOOK_SECRET) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const admin = createAdmin();

  // MANUAL-PLACE: button-tap path (callback_query updates from Telegram)
  const callbackQuery = body.callback_query as Record<string, unknown> | undefined;
  if (callbackQuery) {
    await handleCallbackQuery(callbackQuery, admin);
    return new NextResponse("OK", { status: 200 });
  }

  const message = body.message as Record<string, unknown> | undefined;
  if (!message) return new NextResponse("OK", { status: 200 });

  const chatId = (message.from as Record<string, unknown>)?.id as number | undefined;
  const text = (message.text as string | undefined)?.trim() ?? "";

  if (!chatId) return new NextResponse("OK", { status: 200 });

  if (text.startsWith("/start")) {
    // /start <user_uuid>  — links this Telegram chat to the OddsIntel profile
    const parts = text.split(" ");
    const uuid = parts[1]?.trim();

    if (!uuid || !UUID_RE.test(uuid)) {
      await sendReply(chatId, "❌ Invalid link. Go to your OddsIntel profile page and click 'Connect Telegram' to get a fresh link.");
      return new NextResponse("OK", { status: 200 });
    }

    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, tier")
      .eq("id", uuid)
      .maybeSingle();

    if (error || !profile) {
      await sendReply(chatId, "❌ Account not found. Make sure you're using the link from your own OddsIntel profile page.");
      return new NextResponse("OK", { status: 200 });
    }

    if (!["pro", "elite"].includes(profile.tier)) {
      await sendReply(chatId, "ℹ️ Telegram alerts are available on Pro and Elite plans. Upgrade at oddsintel.app/profile.");
      return new NextResponse("OK", { status: 200 });
    }

    await admin
      .from("profiles")
      .update({ telegram_chat_id: chatId })
      .eq("id", uuid);

    await sendReply(chatId, "✅ Connected! You'll receive value bet alerts here as soon as new picks are found.\n\nSend /stop to unsubscribe.");
  } else if (text === "/stop") {
    // Disconnect by chat_id — no UUID needed, the chat_id IS the identity
    await admin
      .from("profiles")
      .update({ telegram_chat_id: null })
      .eq("telegram_chat_id", chatId);

    await sendReply(chatId, "👋 Disconnected. You won't receive bet alerts any more. Send /start to reconnect.");
  }

  return new NextResponse("OK", { status: 200 });
}
