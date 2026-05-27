import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
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

  const message = body.message as Record<string, unknown> | undefined;
  if (!message) return new NextResponse("OK", { status: 200 });

  const chatId = (message.from as Record<string, unknown>)?.id as number | undefined;
  const text = (message.text as string | undefined)?.trim() ?? "";

  if (!chatId) return new NextResponse("OK", { status: 200 });

  const admin = createAdmin();

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
