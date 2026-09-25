"use client";

/**
 * /performance client wrapper — the hero and the per-bot leaderboard.
 *
 * [[#159]] (2026-09-25): both render SERVER-computed figures only. The leaderboard rows come
 * from the engine view `bot_performance` (see /performance/page.tsx and lib/bot-performance.ts);
 * the hero from getCalibratedHeadlineStats, which sums the same per-leg public figure. The
 * client-side recompute from raw bets that used to run here for Pro readers
 * (buildPublicBotStats — stake-weighted, our-books price, the legacy `clv` column) is GONE:
 * it was a second definition of ROI and CLV, and the reason the same bot read differently to a
 * Pro and a Free reader. Freshness no longer needs it — the view is read live (2-min cache).
 */

import { PerformanceHero } from "./performance-hero";
import { PerformanceLeaderboard } from "./performance-leaderboard";
import type { PublicBotStat } from "./performance-leaderboard";
import type { TrackRecordStats, DashboardCache, ModelV2Stats, CalibratedHeadlineStats } from "@/lib/engine-data";
import { isLiveBot, isPublicBot } from "@/lib/bot-aggregates";

interface BotDbRow {
  name: string;
  retiredAt?: string | null;
  maturityLabel?: string;
}

interface Props {
  trackStats: TrackRecordStats;
  cache: DashboardCache | null;
  bots: PublicBotStat[];
  isPro: boolean;
  isElite: boolean;
  botsDB: BotDbRow[] | null;
  modelV2Stats: ModelV2Stats | null;
  calibrated: CalibratedHeadlineStats | null;
}

export function PerformanceClient({
  trackStats,
  cache,
  bots,
  isElite,
  botsDB,
  modelV2Stats,
  calibrated,
}: Props) {
  // VIP-PERFORMANCE-SETTLED-ONLY (#148): the VIP bot is listed in the table but never counted
  // in the hero numbers.
  const botsTracked = bots.filter((b) => b.hasEnoughData && !b.isVip).length || null;

  // PERF-COHORT-RECONCILE (2026-08-21) / PERF-PUBLIC-IS-CALIBRATED-OR-BETA (2026-09-16): the
  // "strategies live" count must match the table's public cohort.
  const activeBotCount = botsDB
    ? botsDB.filter(
        (b) => !b.retiredAt && !isLiveBot(b.name) && isPublicBot(b.maturityLabel),
      ).length
    : null;
  const retiredBotCount = botsDB ? botsDB.filter((b) => !!b.retiredAt).length : null;

  return (
    <div className="space-y-8">
      <PerformanceHero
        stats={trackStats}
        cache={cache}
        botsTracked={botsTracked}
        modelV2Stats={modelV2Stats}
        activeBotCount={activeBotCount}
        retiredBotCount={retiredBotCount}
        calibrated={calibrated}
      />

      <PerformanceLeaderboard
        bots={bots}
        isElite={isElite}
        retiredBotCount={retiredBotCount ?? 0}
      />
    </div>
  );
}
