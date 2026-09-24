import { NextResponse } from "next/server";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { isBotBoardDevPreview, loadBotLedger } from "@/lib/bot-board";

/** GET ?bot=<bot_name> -> { rows: BotLedgerRow[], error: string | null }
 *
 *  The 30 most recent `bot_ledger` picks for one bot, for the /admin/bots
 *  detail drawer (#139 phase 1). Fetched on demand so the page load does not
 *  scan the ledger for every bot. Superadmin only (bot_ledger is not anon-readable).
 */
export async function GET(req: Request) {
  if (!isBotBoardDevPreview()) {
    const denied = await superadminDenial();
    if (denied) return denied;
  }
  const bot = new URL(req.url).searchParams.get("bot")?.trim();
  if (!bot || bot.length > 200 || !/^[a-z0-9_]+$/i.test(bot)) {
    return NextResponse.json({ error: "invalid bot" }, { status: 400 });
  }
  const result = await loadBotLedger(bot, 30);
  return NextResponse.json(result);
}

async function superadminDenial() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const db = createServerServiceClient();
  const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
  if (!profile?.is_superadmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}
