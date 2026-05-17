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

import { useMemo, useState } from "react";
import { PerformanceHero } from "./performance-hero";
import { PerformanceLeaderboard } from "./performance-leaderboard";
import type { PublicBotStat, SanitizedBotBet } from "./performance-leaderboard";
import type { TrackRecordStats, DashboardCache, LiveBet } from "@/lib/engine-data";
import {
  QUALITY_CUTOFF,
  filterQuality,
  buildPerformanceStats,
  buildPublicBotStats,
} from "@/lib/bot-aggregates";

interface BotDbRow {
  name: string;
  strategy?: string | null;
  currentBankroll: number;
  startingBankroll: number;
  retiredAt?: string | null;
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
}: Props) {
  // Default ON for /performance — paying users see honest current-pipeline
  // numbers by default; toggle off reveals legacy bets for transparency.
  const [qualityOnly, setQualityOnly] = useState(true);

  const canRecompute = isPro && aggregateBets != null && botsDB != null;

  const filteredBets = useMemo(() => {
    if (!canRecompute || !aggregateBets) return null;
    return filterQuality(aggregateBets, qualityOnly);
  }, [canRecompute, aggregateBets, qualityOnly]);

  const computedPerf = useMemo(() => {
    if (!filteredBets) return null;
    return buildPerformanceStats(filteredBets);
  }, [filteredBets]);

  const computedBots = useMemo<PublicBotStat[] | null>(() => {
    if (!filteredBets || !botsDB) return null;
    return buildPublicBotStats(filteredBets, botsDB, { isPro, isElite });
  }, [filteredBets, botsDB, isPro, isElite]);

  // Hero stats: use computed when available; otherwise the original cache-derived values.
  const heroStats: TrackRecordStats = computedPerf
    ? {
        ...trackStats,
        avgClv: computedPerf.avgClv,
        settledBets: computedPerf.settledCount,
      }
    : trackStats;

  // Hero ROI: prefer computed (matches the toggle); fall back to cache.
  const heroCache: DashboardCache | null = computedPerf && cache
    ? { ...cache, roi_pct: computedPerf.roi }
    : cache;

  // Leaderboard rows: computed for Pro+ when toggle data is available, else cache.
  const leaderboardBots: PublicBotStat[] = computedBots ?? cachedBots;

  const legacyCount = useMemo(() => {
    if (!aggregateBets) return 0;
    return aggregateBets.filter((b) => b.placedAt < QUALITY_CUTOFF && b.result !== "void").length;
  }, [aggregateBets]);

  return (
    <div className="space-y-8">
      <PerformanceHero stats={heroStats} cache={heroCache} />

      {canRecompute && (
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-card/40 px-4 py-2.5">
          <div className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Data quality filter:</span>{" "}
            {qualityOnly
              ? `Showing bets placed on or after ${QUALITY_CUTOFF} (current pipeline). ${legacyCount} legacy bets excluded.`
              : `Showing all bets including ${legacyCount} placed before ${QUALITY_CUTOFF} (older calibration).`}
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={qualityOnly}
              onChange={(e) => setQualityOnly(e.target.checked)}
              className="h-3.5 w-3.5"
              data-testid="quality-only-toggle"
            />
            <span>Quality only</span>
          </label>
        </div>
      )}

      <PerformanceLeaderboard
        bots={leaderboardBots}
        isPro={isPro}
        isElite={isElite}
        allBets={allBets}
      />
    </div>
  );
}
