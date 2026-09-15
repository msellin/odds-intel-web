export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import { createSupabaseServer } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Track Record — OddsIntel",
  description:
    "Live football prediction track record. Every bet logged before kickoff, every result settled against official scores, every closing line tracked. Filter by league, market, or strategy.",
  alternates: { canonical: "https://oddsintel.app/performance" },
  openGraph: {
    title: "OddsIntel — Live Track Record",
    description:
      "Every pre-match football pick logged with odds, result, and closing line. Filter by league, market, or bot. Public JSON API + Bitcoin-anchored ledger.",
    url: "https://oddsintel.app/performance",
    siteName: "OddsIntel",
    type: "website",
    images: [
      {
        url: "https://oddsintel.app/opengraph-image",
        width: 1200,
        height: 630,
        alt: "OddsIntel Live Track Record — verified football model performance",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OddsIntel — Live Track Record",
    description:
      "Every pre-match football pick logged. Full ledger, filters, ROI. Public JSON + Bitcoin-anchored.",
    images: ["https://oddsintel.app/opengraph-image"],
  },
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
import PicksForwardTestPanel from "@/components/picks-forward-test-panel";
import {
  getPicksForwardTestSummary,
  getPicksForwardTestBets,
  PICKS_FORWARD_TEST_STAKE_EUR,
  PICKS_FORWARD_TEST_START_BANKROLL,
} from "@/lib/engine-data";
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
    // CLV-PUBLIC-WITHDRAWN (2026-09-06, completed 2026-09-07): the headline CLV
    // tiles were removed from the hero and landing, and the meta + per-row CLV
    // fields were dropped from the auth-free /api/v1/track-record route — but
    // this per-row cell survived, ungated, rendering `simulated_bets.clv`
    // (odds_at_pick / closing − 1: raw, un-de-vigged, priced at a MAX
    // high-water mark) as a ClvCell to every anonymous visitor. Same
    // incomplete-withdrawal shape as the endpoint leak that shipped and had to
    // be caught by reading the live API. Gate it exactly like closingOdds /
    // edge / stake below: Elite/superadmin still see it, the public surface
    // does not, until CLV is both positive and shown to predict return
    // (CLV-EXECUTABLE-PRICE-SUBSET).
    clv: isElite ? b.clv : null,
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
  // PERF-PAGE-COLD-RENDER-2026-09-06: getAllBets() and getPublicCohortBotNames()
  // were two SERIAL round-trips, and nothing in the second depends on the first.
  // getAllBets is the heavier of the two — it pulls the bet rows with four
  // levels of embedded resources (bot, match -> home_team / away_team / league)
  // through PostgREST — so running them one after the other paid its latency
  // twice over for no reason. Parallel now.
  const [allBetsRaw, publicBotNames] = await Promise.all([
    getAllBets(),
    getPublicCohortBotNames(),
  ]);
  const sanitizedBets = sanitizeBets(allBetsRaw, isElite);
  // PICKS-BOT-ACTS-LIKE-THE-OTHERS-2026-09-14: its bets come from
  // picks_forward_test, not simulated_bets, so they are appended to the same
  // array the chart and expandable bet list already read. Without this the row
  // would open to an empty chart — present but inert, which is worse than
  // absent because it reads as "this strategy has done nothing".
  const picksBets = (await getPicksForwardTestBets()).map((b) => ({
    ...b, bot: "bot_sharp_forward_test_v1",
  })) as unknown as SanitizedBotBet[];
  sanitizedBets.push(...picksBets);

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
  // (publicBotNames is fetched above, in parallel with getAllBets.)
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
  // PERFORMANCE-SHOWS-EVERY-BOT (2026-09-15, owner). The experimental filter
  // that stood here was undocumented and hid 13 of 15 active bots. This page is
  // the measurement surface; curation of what customers are OFFERED happens on
  // /picks via bots.show_on_picks.
  const cachedBots = buildCachedBotStats(cache, botsDB, isPro, isElite)
    .filter(b => !liveRetiredNames.has(b.name));

  // PICKS-BOT-IN-LEADERBOARD-2026-09-14. bot_sharp_forward_test_v1 is the bot
  // that actually produces the picks readers receive, and it was missing from
  // the leaderboard entirely — it writes NO simulated_bets (it reads through to
  // picks_forward_test), and `bot_breakdown` is built from simulated_bets. So
  // the fleet table listed everything EXCEPT the one strategy we publish.
  //
  // Injected from its own ledger rather than faked into simulated_bets: writing
  // it there would pull it into every bot-cohort query in the codebase and
  // re-contaminate the track record (see migration 342's header).
  //
  // TWO DELIBERATE CHOICES so this row cannot mislead:
  //  * hasEnoughData uses ITS OWN pre-registered checkpoint (200 settled), not
  //    the table's loose `settled >= 5`. At n=5 it currently reads +25.8% ROI,
  //    and the table sorts the "enough data" group by ROI — so the default
  //    convention would rank a five-bet sample above bots with 640. It sits in
  //    "still collecting", sorted by n, until its own rule says otherwise.
  //  * avgClv is the MARGIN-CORRECTED number, not the raw ratio. Break-even CLV
  //    is the closing book's margin, not zero; the raw figure would read
  //    positive while the honest one is negative.
  // FORWARD-TEST-VERSIONS-DO-NOT-VANISH (2026-09-15): the getter now returns
  // every rule version that has published, newest first. The leaderboard row
  // reads the CURRENT one only — pooling a closed test's n into a running one
  // is the discipline failure the pre-registration exists to prevent. The
  // closed versions are rendered by PicksForwardTestPanel, not dropped.
  const picksSummary = (await getPicksForwardTestSummary())?.current ?? null;
  if (picksSummary && picksSummary.published > 0) {
    const mc = picksSummary.clvMarginCorrected;
    cachedBots.push({
      name: "bot_sharp_forward_test_v1",
      settled: picksSummary.settled,
      won: isPro ? picksSummary.won : 0,
      lost: isPro ? picksSummary.settled - picksSummary.won : 0,
      pnl: isPro ? picksSummary.pnlUnits : null,
      roi: picksSummary.roi == null ? null : picksSummary.roi * 100,
      clvDirection: mc == null ? "neutral" : mc > 0 ? "positive" : "negative",
      avgClv: isElite ? (mc == null ? null : mc * 100) : null,
      // Same basis as every other row: EUR 1000 start, EUR 10 flat. The rule
      // stakes 1 unit; showing 1.03 next to EUR 1,339 would make the newest
      // strategy look like a rounding error. Scaling changes no stored value
      // and no stopping rule — those read CLV in units.
      currentBankroll: isElite
        ? PICKS_FORWARD_TEST_START_BANKROLL + picksSummary.pnlUnits * PICKS_FORWARD_TEST_STAKE_EUR
        : null,
      startingBankroll: PICKS_FORWARD_TEST_START_BANKROLL,
      // Same bar as every other bot on this page (settled >= 5), so it lands in
      // the main list rather than "in development (< 5 bets)" — a label that was
      // simply false for a bot with 8 published and 5 settled.
      //
      // I had set this to its own pre-registered checkpoint (200) to stop a
      // five-bet sample out-ranking a 640-bet one, since the proven group sorts
      // by ROI. That protection now comes from the TESTING chip instead, which
      // the page's own legend already defines as "still collecting" — the same
      // mechanism that marks bot_high_roi_global_v2 as BETA at n=51. Using a
      // private threshold for one bot made the page inconsistent AND mislabelled
      // it; the chip is the honest signal and it is already there.
      hasEnoughData: picksSummary.settled >= 5,
      maturityLabel: "testing",   // legend: "TESTING (still collecting)"
    });
  }

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
      {/* PICKS-ON-PERFORMANCE-2026-09-14 — above the leaderboard and outside the
          logged-in branch, deliberately. These are the picks we actually send to
          readers; the leaderboard below is the bot fleet, which is a different
          thing and mostly operator-facing. Ungated for the same reason the
          pre-registration requires: the published set and the recorded set must
          be identical, so a tier-dependent cut would evaluate the stopping rules
          on a cohort no reader saw. */}
      <PicksForwardTestPanel />
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
