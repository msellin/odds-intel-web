import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import { getTodayBets, type BetCohort, type LiveBet } from "@/lib/engine-data";

/**
 * PRO-TIER-V2 (2026-06-02) — GET /api/value-bets/live
 *
 * Returns the current set of inplay picks for the caller's tier (the same
 * cohort filter `/value-bets` uses server-side). Client polls every 60s so
 * the "Live now" section reflects the latest set without a full page reload.
 *
 * Tier rules:
 *   Free   → 403 (free tier doesn't see inplay picks at all — too time-critical)
 *   Pro    → calibrated bots only
 *   Elite  → all active bots
 *
 * Response shape (matches the server-rendered initial state in
 * components/value-bets-live-section.tsx):
 *   {
 *     now: string,           // server timestamp ISO — drives the stale gate
 *     bets: Array<{ id, matchId, match, league, market, selection, odds,
 *                   modelProb, edge, kickoff, placedAt, recommendedBookmaker,
 *                   bot, stake }>
 *   }
 *
 * Why `now` is server-side: the stale badge (>120s since pick_time) must not
 * trust the client clock, which can drift or be manipulated. The client
 * subtracts `now` from each row's `placedAt` to render the age.
 */
export const dynamic = "force-dynamic";

type LivePickPayload = {
  id: string;
  matchId: string;
  match: string;
  league: string;
  market: string;
  selection: string;
  odds: number;
  modelProb: number;
  edge: number;
  kickoff: string;
  placedAt: string;
  recommendedBookmaker: string | null;
  bot: string;
  stake: number;
};

function toPayload(b: LiveBet): LivePickPayload {
  return {
    id: b.id,
    matchId: b.matchId,
    match: b.match,
    league: b.league,
    market: b.market,
    selection: b.selection,
    odds: b.odds,
    modelProb: b.modelProb,
    edge: b.edge,
    kickoff: b.kickoff,
    placedAt: b.placedAt,
    recommendedBookmaker: b.recommendedBookmaker,
    bot: b.bot,
    stake: b.stake,
  };
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { isPro, isElite } = await getUserTier(user.id, supabase);
  if (!isPro) {
    // Free tier never sees the live section.
    return NextResponse.json({ error: "Pro required" }, { status: 403 });
  }

  const cohort: BetCohort = isElite ? "active" : "calibrated";
  const all = await getTodayBets(cohort);
  // Only pending inplay picks belong in the live section — settled ones drop
  // out the moment the match finishes.
  const live = all.filter((b) => b.isInplay && b.result === "pending");

  return NextResponse.json({
    now: new Date().toISOString(),
    bets: live.map(toPayload),
  });
}
