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
  getCalibratedHeadlineStats,
  getPublicCohortBotNames,
  CALIBRATED_PUBLIC_MARKETS,
  CALIBRATED_SINCE,
} from "@/lib/engine-data";
import type { LiveBet, ModelV2Stats, CalibratedHeadlineStats } from "@/lib/engine-data";
import { PerformanceClient } from "@/components/performance-client";
import type { PublicBotStat, SanitizedBotBet } from "@/components/performance-leaderboard";
import { PerformanceHistory } from "@/components/performance-history";
import type { FullBetItem } from "@/components/performance-history";
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
    closingOdds: isElite ? b.closingOdds : null,
    edge: isElite ? b.edge : null,
    bot: b.bot,
    strategyProfile: b.strategyProfile,
  }));
}

function toFullBetItems(bets: SanitizedBotBet[]): FullBetItem[] {
  return bets.map((b) => {
    const clvExact = b.clv;
    const clvSign: "positive" | "negative" | "neutral" | null =
      clvExact == null ? null : clvExact > 0 ? "positive" : clvExact < 0 ? "negative" : "neutral";
    return {
      id: b.id,
      match: b.match,
      league: b.league,
      date: b.placedAt,
      market: b.market,
      selection: b.selection,
      odds: b.odds,
      stake: b.stake,
      result: b.result,
      pnl: b.pnl,
      clvSign,
      clvExact,
      closingOdds: b.closingOdds,
      botName: b.bot,
    };
  });
}

// ── Streaming section for logged-in users (slow allBets query) ────────────────
// Renders the leaderboard recompute (fresh retirement state) AND the full
// filterable bet history. Both need the same allBets fetch, so they share one
// Suspense boundary. Anonymous users skip this entirely — they get the cached
// leaderboard + a 10-bet ledger teaser.

interface LoggedInSectionProps {
  isPro: boolean;
  isElite: boolean;
  trackStats: Awaited<ReturnType<typeof getTrackRecordStats>>;
  cache: Awaited<ReturnType<typeof getDashboardCache>>;
  cachedBots: PublicBotStat[];
  botsDB: Awaited<ReturnType<typeof getAllBotsFromDB>>;
  modelV2Stats: ModelV2Stats | null;
  calibrated: CalibratedHeadlineStats | null;
  extras: Awaited<ReturnType<typeof getPublicPerformanceExtras>>;
}

async function LoggedInPerformanceSection({
  isPro,
  isElite,
  trackStats,
  cache,
  cachedBots,
  botsDB,
  modelV2Stats,
  calibrated,
  extras,
}: LoggedInSectionProps) {
  const allBetsRaw = await getAllBets();
  const sanitizedBets = sanitizeBets(allBetsRaw, isElite);

  // PERF-HISTORY-COHORT-MATCH (2026-08-21): the "+X% n=Y" ROI headline is
  // getCalibratedHeadlineStats — filtered to production public cohort. The
  // history table shows the exact same cohort so the row count reconciles
  // with the headline. Filter mirrors getCalibratedHeadlineStats (kept in
  // one place via the exported constants).
  //
  // PERF-COHORT-FRESH-BOTS (2026-08-21): read the bot-name allowlist fresh
  // from DB (not from the 30-min-cached botsDB) so newly-retired bots
  // disappear from the ledger immediately — otherwise history lagged hero
  // by up to 30 min after a retirement.
  const publicBotNames = await getPublicCohortBotNames();
  const publicMarkets = new Set<string>(CALIBRATED_PUBLIC_MARKETS as unknown as string[]);
  const sinceIso = `${CALIBRATED_SINCE}T00:00:00Z`;
  const cohortBets = sanitizedBets.filter(
    (b) =>
      publicBotNames.has(b.bot) &&
      publicMarkets.has(b.market) &&
      b.placedAt >= sinceIso,
  );
  const fullBets: FullBetItem[] = toFullBetItems(cohortBets);

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
        modelV2Stats={modelV2Stats}
        calibrated={calibrated}
      />
      <PerformanceExtras data={extras} cache={cache} />
      <PerformanceHistory
        fullBets={fullBets}
        recentSettled={null}
        isLoggedIn={true}
        isElite={isElite}
      />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PerformancePage() {
  // All fast fetches run in parallel — botsDB moved here since it doesn't need isPro.
  const [authResult, trackStats, cache, extras, modelV2Stats, botsDB, calibrated] = await Promise.all([
    (async () => {
      const supabase = await createSupabaseServer();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { userId: null as string | null, isPro: false, isElite: false, is_superadmin: false };
      const tier = await getUserTier(user.id);
      return { userId: user.id, ...tier };
    })(),
    getTrackRecordStats(),
    getDashboardCache(),
    getPublicPerformanceExtras(),
    getModelV2Stats(),
    getAllBotsFromDB(),
    getCalibratedHeadlineStats(),
  ]);

  const { userId, isPro, isElite } = authResult as {
    userId: string | null;
    isPro: boolean;
    isElite: boolean;
    is_superadmin: boolean;
  };
  const isLoggedIn = !!userId;

  // Anonymous only: last 10 settled bets for the ledger teaser.
  // PERF-SIGNUP-HISTORY (2026-08-21): logged-in users get the full filterable
  // history via the streaming section below — no need to fetch the small feed.
  const recentSettled = !isLoggedIn ? await getRecentSettledBets(10) : null;

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

  // (retired_bot_breakdown filter removed with RetiredStrategiesSection)

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
    calibrated,
  };

  return (
    // PERFORMANCE-NARROW (2026-06-24, fixed 2026-06-25):
    // wrap in max-w-4xl to match the landing page width. The earlier
    // version included `-mx-2 sm:-mx-4` to cancel the (app) layout's
    // padding, but Tailwind applied that AFTER `mx-auto`, breaking
    // centering and shifting the container off-screen on mobile.
    // The (app) layout's px-2/px-4 is small enough that we don't
    // need to fight it — just constrain to 4xl + auto-center.
    <div className="mx-auto w-full max-w-4xl">
      {isLoggedIn ? (
        <Suspense
          fallback={
            <>
              <PerformanceClient {...cachedClientProps} />
              <PerformanceExtras data={extras} cache={cache} />
              <PerformanceHistory
                fullBets={null}
                recentSettled={null}
                isLoggedIn={true}
                isElite={isElite}
              />
            </>
          }
        >
          <LoggedInPerformanceSection
            isPro={isPro}
            isElite={isElite}
            trackStats={trackStats}
            cache={cache}
            cachedBots={cachedBots}
            botsDB={botsDB}
            modelV2Stats={modelV2Stats}
            calibrated={calibrated}
            extras={extras}
          />
        </Suspense>
      ) : (
        <>
          <PerformanceClient {...cachedClientProps} />
          <PerformanceExtras data={extras} cache={cache} />
          <PerformanceHistory
            fullBets={null}
            recentSettled={recentSettled}
            isLoggedIn={false}
            isElite={false}
          />
        </>
      )}
    </div>
  );
}
