"use client";

/**
 * UI-METRIC-SOT — /performance client wrapper. Renders hero from cache (the
 * single source of truth for headline metrics) and the per-bot leaderboard
 * from a client-side recompute over raw bets so retirements and new picks
 * appear immediately without waiting on the 30-minute dashboard_cache refresh.
 */

import { useMemo } from "react";
import { PerformanceHero } from "./performance-hero";
import { PerformanceLeaderboard } from "./performance-leaderboard";
import type { PublicBotStat, SanitizedBotBet } from "./performance-leaderboard";
import type { TrackRecordStats, DashboardCache, LiveBet, ModelV2Stats, CalibratedHeadlineStats } from "@/lib/engine-data";
import {
  filterExperimental,
  buildPublicBotStats,
  isLiveBot,
} from "@/lib/bot-aggregates";

interface BotDbRow {
  name: string;
  strategy?: string | null;
  currentBankroll: number;
  startingBankroll: number;
  retiredAt?: string | null;
  maturityLabel?: string;
}

interface Props {
  trackStats: TrackRecordStats;
  cache: DashboardCache | null;
  cachedBots: PublicBotStat[];
  isPro: boolean;
  isElite: boolean;
  // For Pro+ users we ship raw bets so the toggle can recompute everything.
  // `allBets` is sanitized for display (used by the modal); `aggregateBets`
  // is the unsanitized superset used for math.
  allBets: SanitizedBotBet[] | null;
  aggregateBets: LiveBet[] | null;
  botsDB: BotDbRow[] | null;
  modelV2Stats: ModelV2Stats | null;
  calibrated: CalibratedHeadlineStats | null;
}

export function PerformanceClient({
  trackStats,
  cache,
  cachedBots,
  isPro,
  isElite,
  allBets,
  aggregateBets,
  botsDB,
  modelV2Stats,
  calibrated,
}: Props) {
  // UI-METRIC-SOT (2026-06-06): dashboard_cache is the single source of truth
  // for hero metrics. Settlement.py writes active_avg_clv / active_roi_pct /
  // active_settled_bets over the SAME cohort the client used to recompute
  // (active + non-experimental + non-retired, settled = won/lost), so the
  // previous client-side overrides were identity ops on a good day and a
  // flicker on a stale-cache day. They are gone.
  //
  // The leaderboard is still recomputed from raw bets for Pro+ so retirements
  // / new bot rows reflect immediately rather than waiting up to 30min for
  // the next dashboard_cache rebuild.
  const nonExperimentalBets = useMemo(() => {
    if (!aggregateBets) return null;
    return filterExperimental(aggregateBets);
  }, [aggregateBets]);

  const computedBots = useMemo<PublicBotStat[] | null>(() => {
    if (!nonExperimentalBets || !botsDB) return null;
    return buildPublicBotStats(nonExperimentalBets, botsDB, { isPro, isElite });
  }, [nonExperimentalBets, botsDB, isPro, isElite]);

  // Leaderboard rows: computed for Pro+ when toggle data is available, else cache.
  //
  // LEADERBOARD-ROW-FLASH-2026-09-14: this used to be a bare
  // `computedBots ?? cachedBots`, which made bot_sharp_forward_test_v1 appear on
  // load and then vanish. The Suspense FALLBACK renders `cachedBots` (where the
  // published-picks row is injected server-side), then the resolved section
  // swaps in `computedBots` — rebuilt from `aggregateBets`, i.e. from
  // simulated_bets, a table that bot deliberately does not write to. So the
  // recompute silently dropped it, and the row flickered out.
  //
  // Merge instead of replace: keep every computed row (that is the point of the
  // live recompute — fresh retirements and new bots without waiting for the
  // 30-min cache rebuild), and carry over any cache-only row it has no opinion
  // about. Written generally rather than name-matching the one bot, because any
  // future read-through strategy hits exactly this.
  const leaderboardBots: PublicBotStat[] = useMemo(() => {
    if (!computedBots) return cachedBots;
    const seen = new Set(computedBots.map((b) => b.name));
    return [...computedBots, ...cachedBots.filter((b) => !seen.has(b.name))];
  }, [computedBots, cachedBots]);

  // Count non-experimental active bots with enough data for the scale row
  const botsTracked = leaderboardBots.filter(b => b.hasEnoughData).length || null;

  // PERF-COHORT-RECONCILE (2026-08-21): "strategies live" in the hero must
  // match the leaderboard funnel line ("Tested to date: N · X proven · ...").
  // The leaderboard funnel counts non-in-play, non-experimental, non-retired
  // strategies (5 proven + 5 underperforming + 15 maturing = 25 typical);
  // the previous `!retiredAt` count was 43 because it also included in-play
  // + experimental bots, which produced a confusing 43 vs 25 mismatch on the
  // same page.
  // PERFORMANCE-SHOWS-EVERY-BOT (2026-09-15): the count must match the table.
  // It previously excluded experimental bots while the table did too; now both
  // include them, so the number a reader counts and the number we print agree.
  const activeBotCount = botsDB
    ? botsDB.filter((b) => !b.retiredAt && !isLiveBot(b.name)).length
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
        bots={leaderboardBots}
        isPro={isPro}
        isElite={isElite}
        allBets={allBets}
        retiredBotCount={retiredBotCount ?? 0}
      />
    </div>
  );
}
