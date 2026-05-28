"use client";

/**
 * BOT-QUAL-FILTER-DUAL — owns the "Quality only" toggle for /performance
 * and feeds both the hero and the leaderboard so every metric on the
 * page updates together when the toggle flips.
 *
 * Architecture:
 * - Free users: no toggle, hero/leaderboard render from server-side cache.
 * - Pro+ users: toggle visible; aggregates recompute client-side from
 *   `allBets` filtered to post-QUALITY_CUTOFF when on.
 *
 * The cache path is preserved as a fallback so non-toggle render is
 * identical to before this refactor.
 */

import { useMemo } from "react";
import { PerformanceHero } from "./performance-hero";
import { PerformanceLeaderboard } from "./performance-leaderboard";
import type { PublicBotStat, SanitizedBotBet } from "./performance-leaderboard";
import type { TrackRecordStats, DashboardCache, LiveBet, ModelV2Stats } from "@/lib/engine-data";
import {
  filterExperimental,
  buildPerformanceStats,
  buildPublicBotStats,
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
}: Props) {
  const canRecompute = isPro && aggregateBets != null && botsDB != null;

  // Strip experimental bots once before any aggregation — they must not appear
  // in any headline number, chart, or leaderboard on /performance.
  const nonExperimentalBets = useMemo(() => {
    if (!aggregateBets) return null;
    return filterExperimental(aggregateBets);
  }, [aggregateBets]);

  // Include all bets — the pre-May 6 period is only 44 bets with 0.41pp impact
  // on headline ROI. Hiding them contradicts "every bet logged · no cherry-picking".
  const filteredBets = nonExperimentalBets;

  const activeBotNames = useMemo(() => {
    if (!botsDB) return null;
    return new Set(botsDB.filter((b) => !b.retiredAt).map((b) => b.name));
  }, [botsDB]);

  // All-bets perf (for ROI/CLV all-time — excludes experimental via filteredBets).
  const computedPerf = useMemo(() => {
    if (!filteredBets) return null;
    return buildPerformanceStats(filteredBets);
  }, [filteredBets]);

  // Active-bots-only perf (for the headline ROI and "N on active strategies").
  const computedActivePerf = useMemo(() => {
    if (!filteredBets || !activeBotNames) return null;
    return buildPerformanceStats(filteredBets.filter((b) => activeBotNames.has(b.bot)));
  }, [filteredBets, activeBotNames]);

  // Grand total settled count — ALL bots, no filter, no quality cutoff.
  // Shown as the "Settled Bets" headline to represent total work done across
  // every strategy ever run, including retired and experimental ones.
  const grandTotalSettled = useMemo(() => {
    if (!aggregateBets) return null;
    return aggregateBets.filter((b) => b.result !== "pending" && b.result !== "void").length;
  }, [aggregateBets]);

  const computedBots = useMemo<PublicBotStat[] | null>(() => {
    if (!filteredBets || !botsDB) return null;
    return buildPublicBotStats(filteredBets, botsDB, { isPro, isElite });
  }, [filteredBets, botsDB, isPro, isElite]);

  // Hero stats: use computed when available; otherwise the original cache-derived values.
  const heroStats: TrackRecordStats = computedPerf
    ? {
        ...trackStats,
        avgClv: computedActivePerf?.avgClv ?? computedPerf.avgClv,
        settledBets: grandTotalSettled ?? computedPerf.settledCount,
      }
    : trackStats;

  // Hero ROI + active counts: update all quality-sensitive fields so the toggle
  // actually changes the headline numbers (roi_pct = all-time incl. retired,
  // active_roi_pct = active-bots-only — both quality-filtered).
  const heroCache: DashboardCache | null = computedPerf && cache
    ? {
        ...cache,
        roi_pct: computedPerf.roi,
        active_roi_pct: computedActivePerf?.roi ?? null,
        active_settled_bets: computedActivePerf?.settledCount ?? null,
      }
    : cache;

  // Leaderboard rows: computed for Pro+ when toggle data is available, else cache.
  const leaderboardBots: PublicBotStat[] = computedBots ?? cachedBots;

  // Count non-experimental active bots with enough data for the scale row
  const botsTracked = leaderboardBots.filter(b => b.hasEnoughData).length || null;

  const activeBotCount  = botsDB ? botsDB.filter((b) => !b.retiredAt).length : null;
  const retiredBotCount = botsDB ? botsDB.filter((b) => !!b.retiredAt).length : null;

  return (
    <div className="space-y-8">
      <PerformanceHero
        stats={heroStats}
        cache={heroCache}
        botsTracked={botsTracked}
        modelV2Stats={modelV2Stats}
        activeBotCount={activeBotCount}
        retiredBotCount={retiredBotCount}
      />


      <PerformanceLeaderboard
        bots={leaderboardBots}
        isPro={isPro}
        isElite={isElite}
        allBets={allBets}
      />
    </div>
  );
}
