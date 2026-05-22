export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { createSupabaseServer } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Model Performance — OddsIntel",
  description: "Live track record for OddsIntel's AI prediction models. Every bet logged, no cherry-picking — ROI, CLV, and win rate across 16 paper-trading bots.",
  alternates: { canonical: "https://oddsintel.app/performance" },
};
import { getUserTier } from "@/lib/get-user-tier";
import {
  getTrackRecordStats,
  getDashboardCache,
  getAllBets,
  getAllBotsFromDB,
  getRecentSettledBets,
  getPublicPerformanceExtras,
} from "@/lib/engine-data";
import type { LiveBet } from "@/lib/engine-data";
import { PerformanceClient } from "@/components/performance-client";
import type { PublicBotStat, SanitizedBotBet } from "@/components/performance-leaderboard";
import { PerformanceHistory } from "@/components/performance-history";
import { ClvEducation } from "@/components/clv-education";
import { TrackRecordFooterCta } from "@/components/track-record-footer-cta";
import { RetiredStrategiesSection } from "@/components/retired-strategies-section";
import { PerformanceExtras } from "@/components/performance-extras";

// ── Server-side cache → public stats fallback ────────────────────────────────
// Used when toggle is off or for Free users (who don't get aggregateBets).

function buildCachedBotStats(
  cache: Awaited<ReturnType<typeof getDashboardCache>>,
  botsDB: Awaited<ReturnType<typeof getAllBotsFromDB>> | null,
  isPro: boolean,
  isElite: boolean,
): PublicBotStat[] {
  if (!cache) return [];

  const bankrollMap = new Map<string, number>();
  const startingBankrollMap = new Map<string, number>();
  if (botsDB) {
    for (const b of botsDB) {
      bankrollMap.set(b.name, b.currentBankroll);
      startingBankrollMap.set(b.name, b.startingBankroll);
    }
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
      startingBankroll: startingBankrollMap.get(b.name) ?? null,
      hasEnoughData: b.settled >= 5,
    };
  });

  return stats.sort((a, b) => {
    if (a.hasEnoughData !== b.hasEnoughData) return a.hasEnoughData ? -1 : 1;
    if (a.hasEnoughData) return (b.roi ?? -999) - (a.roi ?? -999);
    if (a.settled !== b.settled) return b.settled - a.settled;
    return a.name.localeCompare(b.name);
  });
}

function sanitizeBets(bets: LiveBet[], isElite: boolean): SanitizedBotBet[] {
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
    clv: b.clv,
    bot: b.bot,
  }));
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PerformancePage() {
  const [authResult, trackStats, cache, extras] = await Promise.all([
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
    getPublicPerformanceExtras(),
  ]);

  const { isPro, isElite } = authResult as {
    isPro: boolean;
    isElite: boolean;
    is_superadmin: boolean;
  };

  // Pro+ gets raw bets for the toggle to recompute aggregates client-side
  // (BOT-QUAL-FILTER-DUAL). Free gets last 10 settled for the activity strip.
  // botsDB always fetched (small query) so RetiredStrategiesSection can filter
  // against live retired_at rather than relying on stale dashboard_cache.
  const [allBetsRaw, botsDB, recentSettled] = await Promise.all([
    isPro ? getAllBets() : Promise.resolve(null),
    getAllBotsFromDB(),
    !isPro ? getRecentSettledBets(10) : Promise.resolve(null),
  ]);

  const cachedBots = buildCachedBotStats(cache, botsDB, isPro, isElite);
  const sanitizedBets = allBetsRaw ? sanitizeBets(allBetsRaw, isElite) : null;

  // Filter retired_bot_breakdown against live DB so un-retired bots disappear
  // immediately without waiting for tonight's dashboard_cache refresh.
  const liveRetiredNames = new Set(botsDB.filter((b) => !!b.retiredAt).map((b) => b.name));
  const retiredBreakdown = (cache?.retired_bot_breakdown ?? null)?.filter((r) =>
    liveRetiredNames.has(r.name)
  ) ?? null;

  return (
    <>
      <PerformanceClient
        trackStats={trackStats}
        cache={cache}
        cachedBots={cachedBots}
        isPro={isPro}
        isElite={isElite}
        allBets={sanitizedBets}
        aggregateBets={allBetsRaw}
        botsDB={botsDB}
      />

      {/* Cumulative P&L chart + streak badges + calibration table — visible to all tiers. */}
      <PerformanceExtras data={extras} />

      {/* PERF-HONEST-HEADLINE: every retired bot with its final stats + reason. */}
      <RetiredStrategiesSection retired={retiredBreakdown} />

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
    </>
  );
}
