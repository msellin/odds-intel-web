/**
 * GET /api/performance/bot-legs?bot=<name> — the /performance detail view's picks ([[#159]]).
 *
 * The detail view opens for EVERY reader (owner, 2026-09-25). It used to open for Pro only and
 * draw from a raw-bet array shipped to Pro browsers; now it fetches exactly the legs its row is
 * computed from (engine view bot_ledger_display, in_record — the same legs as bot_performance),
 * so the list a reader counts reconciles with the row, on the one public price basis.
 *
 * Guards, all server-side:
 *   * only a bot /performance LISTS (testing / active, VIP, show_on_performance, or a published
 *     forward-test arm; never retired). Experimental bots are admin-only by design (#155) — a
 *     guessed name must not read their ledger through this public route.
 *   * VIP + hide_pending bots: SETTLED legs only. Their pending picks are the paid product
 *     (#148); this route reads with service_role, so this filter is what keeps them private.
 *   * EXPERIMENTAL bots are never listed (unless VIP) — the #161 twin arms are ledger-backed
 *     but admin-only ([[#164]]).
 *   * a free bot's HELD-BACK pending pick (VIP holds it or would take it, [[#164]]) is dropped
 *     until kickoff — `bot_ledger_display.held_back`, decided once by the engine.
 *   * stake / edge only for Elite (superadmin), as before.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import { getAllBotsFromDB } from "@/lib/engine-data";
import { isPublicBot, isVipBot } from "@/lib/bot-aggregates";
import { getBotLegs, getBotPerformanceFresh, getBotEvBands } from "@/lib/bot-performance";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const bot = req.nextUrl.searchParams.get("bot") ?? "";
  if (!/^[a-z0-9_]{1,64}$/.test(bot)) {
    return NextResponse.json({ error: "bad bot" }, { status: 400 });
  }
  const bots = await getAllBotsFromDB();
  const b = bots.find((x) => x.name === bot);
  // [[#164]] (flagged by #162): an EXPERIMENTAL bot is admin-only (#155) even when it is ledger-backed
  // — the #161 twin arms (bot_sharp_aligned_v1, bot_consensus_pinconf_v1) are LEDGER_BACKED_BOTS and
  // were readable here, pending legs included. VIP bots are listed whatever their status (settled only).
  // [[#155]] ONE STATUS DECIDES DISTRIBUTION: listed iff the STATUS is TESTING / BETA / CALIBRATED
  // (VIP bots too, settled only) — the same rule as the /performance table. No second switch
  // (show_on_performance, "ledger-backed", "VIP whatever its label") any more.
  const listed = !!b && !b.retiredAt && isPublicBot(b.maturityLabel);
  if (!b || !listed) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let isElite = false;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) isElite = (await getUserTier(user.id)).isElite;
  } catch {
    isElite = false;
  }

  // Held-back free picks ([[#164]] VIP FIRST) are dropped inside getBotLegs for every bot.
  // [[#155]] the header reads the bot's bot_performance row from THIS request (uncached), so it
  // always describes the same legs as the chart and table below it. VIP bots also get the
  // EV8 / EV5 split of the same record (bot_performance_ev_band — sums back to the row).
  const [legs, perf, evBands] = await Promise.all([
    getBotLegs(bot, { settledOnly: isVipBot(b) || b.hidePending, isElite }),
    getBotPerformanceFresh(bot),
    isVipBot(b) ? getBotEvBands(bot) : Promise.resolve([]),
  ]);
  return NextResponse.json(
    { legs, perf, evBands },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
