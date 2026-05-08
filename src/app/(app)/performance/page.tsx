export const dynamic = "force-dynamic";

import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import {
  getTrackRecordStats,
  getDashboardCache,
  getAllBets,
  getAllBotsFromDB,
  getRecentSettledBets,
} from "@/lib/engine-data";
import type { LiveBet } from "@/lib/engine-data";
import { PerformanceHero } from "@/components/performance-hero";
import { PerformanceLeaderboard } from "@/components/performance-leaderboard";
import type { PublicBotStat, SanitizedBotBet } from "@/components/performance-leaderboard";
import { PerformanceHistory } from "@/components/performance-history";
import { ClvEducation } from "@/components/clv-education";
import { TrackRecordFooterCta } from "@/components/track-record-footer-cta";

// ── Server-side sanitization helpers ─────────────────────────────────────────

function buildBotStats(
  cache: Awaited<ReturnType<typeof getDashboardCache>>,
  botsDB: Awaited<ReturnType<typeof getAllBotsFromDB>> | null,
  isPro: boolean,
  isElite: boolean,
): PublicBotStat[] {
  if (!cache) return [];

  const bankrollMap = new Map<string, number>();
  if (botsDB) {
    for (const b of botsDB) bankrollMap.set(b.name, b.currentBankroll);
  }

  const stats: PublicBotStat[] = (cache.bot_breakdown ?? []).map((b) => {
    const clvDir = b.avg_clv == null ? "neutral" : b.avg_clv > 0 ? "positive" : "negative";
    return {
      name: b.name,
      settled: b.settled,
      won: isPro ? b.won : 0,
      lost: isPro ? b.settled - b.won : 0,
      pnl: isPro ? b.total_pnl : null,
      roi: b.roi_pct,
      clvDirection: clvDir as PublicBotStat["clvDirection"],
      avgClv: isElite ? b.avg_clv : null,
      currentBankroll: isElite ? (bankrollMap.get(b.name) ?? null) : null,
      hasEnoughData: b.settled >= 5,
    };
  });

  // Sort: enough data (by ROI desc) → accumulating (some settled) → no bets
  return stats.sort((a, b) => {
    if (a.hasEnoughData !== b.hasEnoughData) return a.hasEnoughData ? -1 : 1;
    if (a.hasEnoughData) return (b.roi ?? -999) - (a.roi ?? -999);
    if (a.settled !== b.settled) return b.settled - a.settled;
    return a.name.localeCompare(b.name);
  });
}

function sanitizeBets(bets: LiveBet[], isPro: boolean, isElite: boolean): SanitizedBotBet[] {
  return bets.map((b) => ({
    id: b.id,
    match: b.match,
    league: b.league,
    placedAt: b.placedAt,
    market: b.market,
    selection: b.selection,
    odds: b.odds,
    stake: isElite ? b.stake : null,
    result: b.result,
    pnl: b.pnl,
    bankrollAfter: isElite ? b.bankrollAfter : null,
    modelProb: b.modelProb,
    clv: b.clv,  // Pro sees direction in modal; exact % shown only if isElite (modal checks)
    bot: b.bot,
  }));
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PerformancePage() {
  const [authResult, trackStats, cache] = await Promise.all([
    (async () => {
      const supabase = await createSupabaseServer();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { isPro: false, isElite: false, is_superadmin: false };
      return getUserTier(user.id, supabase);
    })(),
    getTrackRecordStats(),
    getDashboardCache(),
  ]);

  const { isPro, isElite } = authResult as {
    isPro: boolean;
    isElite: boolean;
    is_superadmin: boolean;
  };

  // Pro+ gets all bets for the per-bot modal; Free gets last 10 for the activity strip.
  const [allBetsRaw, botsDB, recentSettled] = await Promise.all([
    isPro ? getAllBets() : Promise.resolve(null),
    isElite ? getAllBotsFromDB() : Promise.resolve(null),
    !isPro ? getRecentSettledBets(10) : Promise.resolve(null),
  ]);

  const botStats = buildBotStats(cache, botsDB, isPro, isElite);
  const sanitizedBets = allBetsRaw ? sanitizeBets(allBetsRaw, isPro, isElite) : null;

  return (
    <div className="space-y-8">
      <PerformanceHero stats={trackStats} cache={cache} />
      <PerformanceLeaderboard
        bots={botStats}
        isPro={isPro}
        isElite={isElite}
        allBets={sanitizedBets}
      />
      {/* Free users: compact recent-results strip as trust signal + upsell.
          Pro/Elite: full bet history lives inside the per-bot modal. */}
      {!isPro && (
        <PerformanceHistory
          fullBets={null}
          recentSettled={recentSettled}
          isPro={false}
          isElite={false}
        />
      )}
      <ClvEducation />
      <TrackRecordFooterCta isPro={isPro} isElite={isElite} />
    </div>
  );
}
