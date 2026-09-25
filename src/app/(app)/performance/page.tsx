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
  getAllBotsFromDB,
  getRecentSettledBets,
  getPublicPerformanceExtras,
  getModelV2Stats,
  getCalibratedHeadlineStats,
  getPublicCohortBotNames,
  CALIBRATED_PUBLIC_MARKETS,
  CALIBRATED_SINCE,
} from "@/lib/engine-data";
import { PerformanceClient } from "@/components/performance-client";
import type { PublicBotStat } from "@/components/performance-leaderboard";
import { getForwardTestBotRecord } from "@/lib/engine-data";
import { isPublicBot, isVipBot, LEDGER_BACKED_BOTS } from "@/lib/bot-aggregates";
import {
  getBotPerformance,
  getCohortLegs,
  PERF_FLAT_STAKE_EUR,
  PERF_START_BANKROLL,
  type BotLeg,
  type BotPerformance,
} from "@/lib/bot-performance";
import { PerformanceHistory } from "@/components/performance-history";
import type { FullBetItem } from "@/components/performance-history";
import { PerformanceExtras } from "@/components/performance-extras";

// ── Leaderboard rows: ONE source ([[#159]]) ──────────────────────────────────
//
// Every row's settled / W-L / ROI / P&L / CLV is read from the engine view `bot_performance`
// (lib/bot-performance.ts) — the same view /admin/bots' bot_scoreboard projects and
// dashboard_cache.bot_breakdown copies. Nothing on this page recomputes a per-bot figure.
// Before 2026-09-25 a Pro reader got a client-side recompute from raw bets (stake-weighted,
// our-books price, legacy `clv`) while everyone else got the cache (a different basis again),
// so the same bot read three ways on three surfaces.
//
// PUBLIC basis: flat EUR 10 at the best price available when the pick was made (all books);
// CLV = against the sharp-anchor close. W/L and P&L are shown to every reader — the
// "Pro unlocks W/L, P&L, charts" split on this page ended with #159 (owner).
//
// ONE ROW RULE ([[#159]] e): < 5 settled = "in development" (muted) for EVERY row, the
// forward-test rows included — they used to skip it, so a published arm with 0 current-rule
// settled picks rendered as a full row of dashes.
const MIN_SETTLED_FOR_ROW = 5;

function rowFromPerformance(
  name: string,
  p: BotPerformance | undefined,
  dbBot: { displayName?: string | null; maturityLabel?: string; isVip?: boolean } | undefined,
  isElite: boolean,
  fallbackLabel = "active",
): PublicBotStat {
  const settled = p?.settled ?? 0;
  const clv = p && p.clvN > 0 ? p.clv : null;
  const pnlEur = (p?.pnlUnits ?? 0) * PERF_FLAT_STAKE_EUR;
  return {
    name,
    displayName: dbBot?.displayName ?? null,
    settled,
    won: p?.won ?? 0,
    lost: p?.lost ?? 0,
    pnl: settled > 0 ? pnlEur : null,
    roi: p?.roi == null ? null : p.roi * 100,
    clvDirection: clv == null ? "neutral" : clv > 0 ? "positive" : "negative",
    avgClv: isElite ? clv : null,
    currentBankroll: isElite ? PERF_START_BANKROLL + pnlEur : null,
    startingBankroll: PERF_START_BANKROLL,
    hasEnoughData: settled >= MIN_SETTLED_FOR_ROW,
    maturityLabel: dbBot?.maturityLabel ?? fallbackLabel,
    isVip: isVipBot(dbBot),
    record: {
      clv,
      clvN: p?.clvN ?? 0,
      clvNPinnacle: p?.clvNPinnacle ?? 0,
      clvNConsensus: p?.clvNConsensus ?? 0,
      roiStaked: p?.roiStaked == null ? null : p.roiStaked * 100,
      nRecordedPrice: p?.nRecordedPrice ?? 0,
      pending: p?.pending ?? 0,
    },
  };
}

function toFullBetItems(legs: BotLeg[], isElite: boolean): FullBetItem[] {
  return legs.map((b) => {
    const clvExact = isElite ? b.clv : null;
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
      stake: isElite ? PERF_FLAT_STAKE_EUR : null,
      result: b.result,
      pnl: b.pnl,
      clvSign,
      clvExact,
      closingOdds: null,
      botName: b.bot,
    };
  });
}

// ── Streaming section for logged-in users (the full history table) ──────────
// The leaderboard no longer needs raw bets (its rows come from bot_performance, and each
// row's detail view fetches its own legs from /api/performance/bot-legs), so this section
// only streams the filterable history. Anonymous readers keep the 10-bet teaser.

interface LoggedInSectionProps {
  isElite: boolean;
  botsDB: Awaited<ReturnType<typeof getAllBotsFromDB>>;
}

async function LoggedInHistorySection({ isElite, botsDB }: LoggedInSectionProps) {
  // PERF-HISTORY-COHORT-MATCH (2026-08-21) + PERF-COHORT-FRESH-BOTS: the same cohort as the
  // hero headline (fresh bot list, public markets, since CALIBRATED_SINCE), now read from the
  // same per-leg view the rows and the hero are summed from ([[#159]]).
  // VIP-PERFORMANCE-SETTLED-ONLY (#148): VIP + hide_pending bots contribute settled legs only.
  const publicBotNames = await getPublicCohortBotNames();
  const hidePending = new Set(botsDB.filter((b) => isVipBot(b) || b.hidePending).map((b) => b.name));
  const legs = await getCohortLegs({
    bots: [...publicBotNames],
    markets: CALIBRATED_PUBLIC_MARKETS,
    since: `${CALIBRATED_SINCE}T00:00:00Z`,
    hidePendingBots: hidePending,
    isElite,
  });
  return (
    <PerformanceHistory
      fullBets={toFullBetItems(legs, isElite)}
      recentSettled={null}
      isLoggedIn={true}
      isElite={isElite}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PerformancePage() {
  // All fast fetches run in parallel — botsDB moved here since it doesn't need isPro.
  const [authResult, trackStats, cache, extras, modelV2Stats, botsDB, calibrated, perf] = await Promise.all([
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
    // [[#159]] THE per-bot source for every row below.
    getBotPerformance(),
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

  // Which bots are listed (unchanged rules, only the NUMBERS moved to bot_performance):
  //  * PERF-PUBLIC-IS-CALIBRATED-OR-BETA (2026-09-16, owner): `calibrated` / `beta` — bots with
  //    live results behind them. Experimental shadow bots are admin-only by design (#155).
  //  * #148: the VIP bot, whatever its label (its rows reach the page settled-only).
  //  * #152: owner-chosen TESTING bots (bots.show_on_performance).
  //  * never retired bots (live state, not the 30-min cache); never an in-play bot.
  //  * ledger-backed (forward-test) bots are added below from PUBLISHED_ARM_BOTS.
  const cachedBots: PublicBotStat[] = botsDB
    .filter((b) => !b.retiredAt && !LEDGER_BACKED_BOTS.has(b.name))
    .filter((b) => isPublicBot(b.maturityLabel) || isVipBot(b) || b.showOnPerformance === true)
    .map((b) => rowFromPerformance(b.name, perf[b.name], b, isElite));

  // PICKS-BOT-IN-LEADERBOARD-2026-09-14 / [[#068]] / [[#095]] / [[#122]]: one row per PUBLISHED
  // forward-test arm, so the strategy readers actually receive is always in the table — its
  // record lives in picks_forward_test, not simulated_bets. Looped over a list so a new arm
  // appears by adding it here.
  //
  // [[#156]] CURRENT rule only + sharp-anchor CLV; [[#158]] earlier-rule picks that passed the
  // current rule on pick-time data count in it. Since [[#159]] the row's FIGURES come from
  // bot_performance like every other row (its forward-test branch IS that #158 record, pinned by
  // smoke ONE-ROI-CLV-PARITY); picks_forward_test_bot_record is read only for what the detail
  // view says about the record: the rule label, the re-checked count, the earlier-rule lines
  // and the own-book margin-corrected CLV (the labelled secondary).
  //
  // No private threshold and no "published > 0" exception any more: the ONE row rule
  // (settled >= 5) applies here too; the row is still listed from its first pick, muted in
  // "in development" until then (owner, 2026-09-25).
  const PUBLISHED_ARM_BOTS: Array<{
    arm: string; bot: string; grade?: "B" | "C" | "D"; market?: "1x2" | "over_under_25";
  }> = [
    { arm: "live", market: "1x2", bot: "bot_sharp_1x2_v1" },
    { arm: "live", market: "over_under_25", bot: "bot_sharp_ou_v1" },
    { arm: "consensus_anchor", grade: "B", bot: "bot_consensus_b_v1" },
    { arm: "consensus_anchor", grade: "C", bot: "bot_consensus_c_v1" },
    { arm: "consensus_anchor", grade: "D", bot: "bot_consensus_d_v1" },
  ];
  const armRecords = await Promise.all(PUBLISHED_ARM_BOTS.map(async (x) => ({
    ...x, record: await getForwardTestBotRecord(x.arm, x.grade, x.market),
  })));
  const shortRule = (rv: string) => {
    const m = /_v(\d+)_/.exec(rv);
    return m ? `v${m[1]}` : rv;
  };
  for (const { bot, record } of armRecords) {
    const cur = record?.current ?? null;
    const p = perf[bot];
    if (!cur || cur.published === 0 || !p) continue;
    const armBot = botsDB.find((db) => db.name === bot);
    // legend: "TESTING (still collecting)" if the bot row is missing, so the chip is never empty.
    const row = rowFromPerformance(bot, p, armBot, isElite, "testing");
    row.forwardTest = {
      ruleVersion: cur.ruleVersion,
      rule: shortRule(cur.ruleVersion),
      sharpClv: row.record?.clv ?? null,
      nSharp: row.record?.clvN ?? 0,
      nPinnacle: row.record?.clvNPinnacle ?? 0,
      nConsensus: row.record?.clvNConsensus ?? 0,
      ownClv: cur.clvMarginCorrected,
      nOwn: cur.nClvMc,
      nRechecked: cur.nRechecked,
      earlier: (record?.earlier ?? []).map((e) => ({
        rule: shortRule(e.ruleVersion),
        settled: e.settled,
        sharpClv: e.nAnchor > 0 ? e.clvAnchor : null,
        nSharp: e.nAnchor,
        failedRecheck: e.failedRecheck,
      })),
    };
    cachedBots.push(row);
  }

  const clientProps = {
    trackStats,
    cache,
    bots: cachedBots,
    isPro,
    isElite,
    botsDB,
    modelV2Stats,
    calibrated,
  };

  return (
    // PERFORMANCE-NARROW (2026-06-24, fixed 2026-06-25): max-w-4xl matches the landing page.
    <div className="mx-auto w-full max-w-4xl">
      {/* PANELS REMOVED 2026-09-22 (owner): the graph and the numbers first; the published arms
          are rows in the leaderboard like every other bot (PUBLISHED-ARM-HAS-A-RECORD). */}
      <PerformanceClient {...clientProps} />
      <PerformanceExtras data={extras} cache={cache} />
      {isLoggedIn ? (
        <Suspense
          fallback={
            <PerformanceHistory fullBets={null} recentSettled={null} isLoggedIn={true} isElite={isElite} />
          }
        >
          <LoggedInHistorySection isElite={isElite} botsDB={botsDB} />
        </Suspense>
      ) : (
        <PerformanceHistory
          fullBets={null}
          recentSettled={recentSettled}
          isLoggedIn={false}
          isElite={false}
        />
      )}
    </div>
  );
}
