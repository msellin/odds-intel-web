/**
 * GET /api/performance/bot-legs?bot=<name> — the /performance detail view's picks ([[#159]]).
 *
 * The detail view opens for EVERY reader (owner, 2026-09-25). It used to open for Pro only and
 * draw from a raw-bet array shipped to Pro browsers; now it fetches exactly the legs its row is
 * computed from (engine view bot_ledger_display, in_record — the same legs as bot_performance),
 * so the list a reader counts reconciles with the row, on the one public price basis.
 *
 * Guards, all server-side:
 *   * only a bot /performance LISTS (calibrated / beta, VIP, show_on_performance, or a published
 *     forward-test arm; never retired). Experimental bots are admin-only by design (#155) — a
 *     guessed name must not read their ledger through this public route.
 *   * VIP + hide_pending bots: SETTLED legs only. Their pending picks are the paid product
 *     (#148); this route reads with service_role, so this filter is what keeps them private.
 *   * stake / edge only for Elite (superadmin), as before.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import { getAllBotsFromDB } from "@/lib/engine-data";
import { isPublicBot, isVipBot, LEDGER_BACKED_BOTS } from "@/lib/bot-aggregates";
import { getBotLegs } from "@/lib/bot-performance";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const bot = req.nextUrl.searchParams.get("bot") ?? "";
  if (!/^[a-z0-9_]{1,64}$/.test(bot)) {
    return NextResponse.json({ error: "bad bot" }, { status: 400 });
  }
  const bots = await getAllBotsFromDB();
  const b = bots.find((x) => x.name === bot);
  const listed =
    !!b && !b.retiredAt &&
    (isPublicBot(b.maturityLabel) || isVipBot(b) || b.showOnPerformance === true || LEDGER_BACKED_BOTS.has(b.name));
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

  const legs = await getBotLegs(bot, { settledOnly: isVipBot(b) || b.hidePending, isElite });
  return NextResponse.json(
    { legs },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
