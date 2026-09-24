import { NextResponse } from "next/server";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { isBotBoardDevPreview, loadBotPicks } from "@/lib/bot-board";

/** GET ?bot=<bot_name>[&limit=50&offset=0][&placed=1] -> BotPicksResult
 *  ({ rows: BotPickRow[], error, placedError, pricesError, placementLinked, hasMore, placedPicks, placedOnly })
 *
 *  placed=1 = only picks that carry a real bet, filtered over the bot's WHOLE ledger (the sheet's
 *  "Bet made" filter — #139 UX fix round; it used to filter only the 50 loaded rows).
 *
 *  One page (newest first, 50 by default, ≤ 100) of a bot's `bot_ledger` picks for the
 *  /admin/bots sheet's Picks tab (#139 phase 1; paging + "Bet made" + current prices since
 *  IA move P7 retired /admin/shadow-bots/[bot] — see loadBotPicks in src/lib/bot-board.ts). Read from `bot_ledger_display` (bot_ledger +
 *  home/away team names, migration 411) with a fallback to plain `bot_ledger`
 *  while 411 is not deployed; in-play rows arrive with CLV nulled (spec §13). Fetched on demand so the page load does not
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
  const sp = new URL(req.url).searchParams;
  const limit = Number(sp.get("limit") ?? 50);
  const offset = Number(sp.get("offset") ?? 0);
  if (!Number.isInteger(limit) || !Number.isInteger(offset) || limit < 1 || limit > 100 || offset < 0 || offset > 100_000) {
    return NextResponse.json({ error: "invalid limit/offset" }, { status: 400 });
  }
  const placed = sp.get("placed");
  if (placed != null && placed !== "0" && placed !== "1") {
    return NextResponse.json({ error: "invalid placed" }, { status: 400 });
  }
  const placedOnly = placed === "1";
  const result = await loadBotPicks(bot, { limit, offset, placedOnly });
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
