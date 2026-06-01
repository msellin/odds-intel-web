export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
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
  getModelV2Stats,
} from "@/lib/engine-data";
import type { LiveBet, ModelV2Stats } from "@/lib/engine-data";
import { PerformanceClient } from "@/components/performance-client";
import type { PublicBotStat, SanitizedBotBet } from "@/components/performance-leaderboard";
import { PerformanceHistory } from "@/components/performance-history";
import { ClvEducation } from "@/components/clv-education";
import { TrackRecordFooterCta } from "@/components/track-record-footer-cta";
import { RetiredStrategiesSection } from "@/components/retired-strategies-section";
import { PerformanceExtras } from "@/components/performance-extras";

// ── Server-side cache → public stats fallback ────────────────────────────────

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
    const dbBot = botsDB?.find(db => db.name === b.name);
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
      maturityLabel: dbBot?.maturityLabel ?? 'active',
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
    edge: isElite ? b.edge : null,
    bot: b.bot,
    strategyProfile: b.strategyProfile,
  }));
}

// ── Streaming component for Pro bets (slow query) ─────────────────────────────
// Rendered inside Suspense so the cached hero/leaderboard shows immediately.

interface ProSectionProps {
  isPro: boolean;
  isElite: boolean;
  trackStats: Awaited<ReturnType<typeof getTrackRecordStats>>;
  cache: Awaited<ReturnType<typeof getDashboardCache>>;
  cachedBots: PublicBotStat[];
  botsDB: Awaited<ReturnType<typeof getAllBotsFromDB>>;
  modelV2Stats: ModelV2Stats | null;
}

async function ProPerformanceSection({
  isPro,
  isElite,
  trackStats,
  cache,
  cachedBots,
  botsDB,
  modelV2Stats,
}: ProSectionProps) {
  const allBetsRaw = await getAllBets();
  const sanitizedBets = sanitizeBets(allBetsRaw, isElite);

  return (
    <PerformanceClient
      trackStats={trackStats}
      cache={cache}
      cachedBots={cachedBots}
      isPro={isPro}
      isElite={isElite}
      allBets={sanitizedBets}
      aggregateBets={allBetsRaw}
      botsDB={botsDB}
      modelV2Stats={modelV2Stats}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PerformancePage() {
  // All fast fetches run in parallel — botsDB moved here since it doesn't need isPro.
  const [authResult, trackStats, cache, extras, modelV2Stats, botsDB] = await Promise.all([
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
    getModelV2Stats(),
    getAllBotsFromDB(),
  ]);

  const { isPro, isElite } = authResult as {
    isPro: boolean;
    isElite: boolean;
    is_superadmin: boolean;
  };

  // Free users: fetch last 10 settled bets (small, fast).
  const recentSettled = !isPro ? await getRecentSettledBets(10) : null;

  // Live retirement state. Drives two cache-staleness fixes below so the
  // /performance page reflects a fresh retirement without waiting up to 30min
  // for the next dashboard_cache rebuild.
  const liveRetiredNames = new Set(botsDB.filter((b) => !!b.retiredAt).map((b) => b.name));

  // Drop retired bots from the active leaderboard. The settlement.py
  // bot_breakdown query already filters retired bots at write time, but a bot
  // retired between cache rebuilds would otherwise still show in the active
  // list. Same pattern as the retired_breakdown filter below, inverse direction.
  const cachedBots = buildCachedBotStats(cache, botsDB, isPro, isElite)
    .filter(b => b.maturityLabel !== 'experimental')
    .filter(b => !liveRetiredNames.has(b.name));

  // Filter retired_bot_breakdown against live DB so un-retired bots disappear
  // immediately without waiting for tonight's dashboard_cache refresh.
  const retiredBreakdown = (cache?.retired_bot_breakdown ?? null)?.filter((r) =>
    liveRetiredNames.has(r.name)
  ) ?? null;

  // Shared cached fallback props — used both as the Suspense fallback for Pro
  // and as the direct render for Free users.
  const cachedClientProps = {
    trackStats,
    cache,
    cachedBots,
    isPro,
    isElite,
    allBets: null as SanitizedBotBet[] | null,
    aggregateBets: null as LiveBet[] | null,
    botsDB,
    modelV2Stats,
  };

  return (
    <>
      {isPro ? (
        // Pro: show cached hero immediately, stream in full bet data behind Suspense.
        <Suspense fallback={<PerformanceClient {...cachedClientProps} />}>
          <ProPerformanceSection
            isPro={isPro}
            isElite={isElite}
            trackStats={trackStats}
            cache={cache}
            cachedBots={cachedBots}
            botsDB={botsDB}
            modelV2Stats={modelV2Stats}
          />
        </Suspense>
      ) : (
        <PerformanceClient {...cachedClientProps} />
      )}

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
