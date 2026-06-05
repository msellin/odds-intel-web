export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  getTodayBets,
  getTodayPicks,
  getOddsVerifiedAt,
  getValueBetBookOdds,
  getPublicPerformanceExtras,
  getLeagueHitRates,
  type LiveBet,
  type BookOddsEntry,
  type BetCohort,
  type LeagueHitRate,
} from "@/lib/engine-data";
import { ValueBetsScan } from "@/components/value-bets-scan";
import { ValueBetsGate } from "@/components/value-bets-gate";
import { TodayPicksPreview } from "@/components/today-picks-preview";
import { CLVTrustBanner } from "@/components/clv-trust-banner";
import { ValueBetsLiveSection } from "@/components/value-bets-live-section";
import { getUserTier } from "@/lib/get-user-tier";

export const metadata: Metadata = {
  title: "Value Bets Today — OddsIntel",
  description: "AI-powered value bets for today's football matches. Real edge calculated by 17 paper trading bots across 280+ leagues.",
  alternates: { canonical: "https://oddsintel.app/value-bets" },
};

const CLUB_PREFIX_RE = /^(FK|FC|AC|AS|SC|RC|CD|CF|BK|SK|NK|GK|SV|TSV|BSC|SG|RB|SpVgg)\s+/i;
function normalizeTeam(name: string): string {
  return name.replace(CLUB_PREFIX_RE, "").toLowerCase().trim();
}

// BOT-FAMILY-DEDUP (2026-05-24): when multiple bots in the SAME strategy family
// agree on a pick, that's not independent confirmation — they share most of
// their logic. Map each bot to its family; "N bots agree" now counts distinct
// families, not raw bot count. Bots not in this map count as their own family
// (the common case).
//
// Discovered when bot_dc_value + bot_dc_strong_fav were both showing "2 bots
// agree" on every DC pick, but bot_dc_strong_fav is a tightened subset of
// bot_dc_value (every pick is shared) — verified 100% overlap on 34/34 picks.
// bot_dc_strong_fav has since been re-retired but the historical bets remain.
const BOT_FAMILY: Record<string, string> = {
  bot_dc_value: "dc",
  bot_dc_strong_fav: "dc",
  bot_aggressive: "aggressive_1x2",
  bot_aggressive_v2: "aggressive_1x2",
  bot_draw_specialist: "aggressive_1x2", // subset of bot_aggressive's draws
  bot_acca_value: "combo",
  bot_acca_proven: "combo",
  bot_acca_coolbet: "combo",
  bot_combo_system: "combo",
  bot_combo_proven_system: "combo",
};
function botFamily(bot: string): string {
  return BOT_FAMILY[bot] ?? bot;
}

function deduplicateBets(bets: LiveBet[]): (LiveBet & { botCount: number })[] {
  const seen = new Map<string, LiveBet & { botCount: number }>();
  const familiesByKey = new Map<string, Set<string>>();
  for (const bet of bets) {
    const [home = "", away = ""] = bet.match.split(" vs ");
    const key = `${bet.kickoff}|${normalizeTeam(home)}|${normalizeTeam(away)}|${bet.market}|${bet.selection}`;
    const family = botFamily(bet.bot);
    let families = familiesByKey.get(key);
    if (!families) {
      families = new Set();
      familiesByKey.set(key, families);
    }
    const isNewFamily = !families.has(family);
    families.add(family);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...bet, botCount: 1 });
    } else {
      const newCount = isNewFamily ? existing.botCount + 1 : existing.botCount;
      if (bet.edge > existing.edge) {
        seen.set(key, { ...bet, botCount: newCount });
      } else if (isNewFamily) {
        existing.botCount = newCount;
      }
    }
  }
  return Array.from(seen.values());
}

// PRO-TIER-V2 (2026-06-02): tier sanitization on the SERVER, never trusting
// client. Pro and Elite see the same full fields (side, odds, modelProb,
// edge, stake) — they differ only in the BOT COHORT the server queries:
//   Pro    → calibrated, ~18 picks/day, +8% ROI, +14% CLV (May 2026 30d)
//   Elite  → all active, ~45 picks/day, +10% ROI, +10% CLV
// Free keeps the old teaser: one pick, rest blurred + locked.
function sanitizeBets(
  bets: LiveBet[],
  isPro: boolean,
): { bets: (LiveBet & { botCount: number })[]; totalCount: number } {
  const deduped = deduplicateBets(bets);
  const totalCount = deduped.length;

  if (isPro) {
    // Pro AND Elite get full data — the cohort filter is the only difference.
    return { bets: deduped, totalCount };
  }

  // Free: single highlighted row, rest blurred (teaser flow).
  return { bets: deduped.slice(0, 1), totalCount };
}

export default async function ValueBetsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <ValueBetsGate />;
  }

  return (
    <Suspense fallback={<ValueBetsSkeleton />}>
      <ValueBetsContent userId={user.id} />
    </Suspense>
  );
}

function ValueBetsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <p className="text-sm text-muted-foreground px-1">Loading today&apos;s value bets…</p>
      <div className="h-28 rounded-xl border border-white/[0.06] bg-card/40" />
      <div className="h-10 w-64 rounded-lg bg-muted/30" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl border border-white/[0.06] bg-card/40" />
      ))}
    </div>
  );
}

async function ValueBetsContent({ userId }: { userId: string }) {
  const supabase = await createSupabaseServer();
  const { tier: userTier, isPro, isElite } = await getUserTier(userId, supabase);

  // PRO-TIER-V2 (2026-06-02): cohort selection happens HERE on the server.
  // Free still gets the prematch-only feed (matches the legacy teaser path);
  // Pro → calibrated; Elite → all active (calibrated + active + experimental,
  // includes inplay). The query in getTodayBets enforces this via an
  // intermediate bots-table lookup — see lib/engine-data.ts.
  const cohort: BetCohort =
    isElite ? "active" : isPro ? "calibrated" : "prematch";

  // CLV-TRUST-BANNER (2026-06-02): the hero CLV stats now come from
  // <CLVTrustBanner variant="value-bets" />, which does its own dashboard_cache
  // read. We no longer need to pre-fetch cache here for the hero. Kept the
  // public performance extras for the bot-ROI hook + odds-movement view.
  // ELITE-LEAGUE-FILTER (2026-06-03): per-league 90d hit rate only fetched
  // for Elite users; Pro and Free don't render the badge/filter and we don't
  // need to pay the query cost.
  const [allBets, todayPicks, extras, leagueHitRates] = await Promise.all([
    getTodayBets(cohort),
    getTodayPicks(),
    getPublicPerformanceExtras(),
    isElite
      ? getLeagueHitRates(90)
      : Promise.resolve({} as Record<string, LeagueHitRate>),
  ]);

  // PRO-TIER-V2 (2026-06-02): split inplay out of the main feed so it can
  // render in its own "Live now" section with auto-refresh + stale gating.
  // Free tier never sees the live section.
  const inplayBets = isPro ? allBets.filter((b) => b.isInplay && b.result === "pending") : [];
  // UNIFIED-FEED (2026-06-02): the main scan now shows ALL of today's bets
  // that aren't being rendered in the Live now section — including settled
  // (won/lost/void) and inplay bets that have finished. The per-row chips
  // (Pre-match / In-play type + status pill on the right) tell the user
  // what they're looking at. Prior versions filtered to pending-only +
  // prematch-only, which (a) hid bets the user might still want to follow
  // and (b) created a confusing "LIVE on /value-bets but missing on
  // /admin/place" gap.
  //
  // We still exclude inplay-pending here to avoid duplicating Live now
  // entries on Pro+. On Free (no Live now) they fall through naturally.
  const mainBets = allBets.filter((b) => {
    if (isPro && b.isInplay && b.result === "pending") return false;
    return true;
  });

  // Sort: pending first (by edge desc, then KO asc), then settled (by KO desc
  // so today's recent results sit near the top of the settled tail).
  const sorted = [...mainBets].sort((a, b) => {
    const aPending = a.result === "pending";
    const bPending = b.result === "pending";
    if (aPending !== bPending) return aPending ? -1 : 1;
    if (aPending) {
      const edgeDiff = b.edge - a.edge;
      if (Math.abs(edgeDiff) > 0.001) return edgeDiff;
      return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
    }
    // settled: most recent kickoff first
    return new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime();
  });
  const { bets, totalCount } = sanitizeBets(sorted, isPro);

  const matchIds = Array.from(new Set(bets.map((b) => b.matchId).filter(Boolean)));
  // Fetch current best book odds for Pro+ (so they get the line-movement chip),
  // and for Free's single highlighted row.
  const fetchBookOdds = (isPro || bets.length > 0) && matchIds.length > 0;
  const [oddsVerifiedAt, bookOdds] = fetchBookOdds
    ? await Promise.all([
        getOddsVerifiedAt(matchIds),
        getValueBetBookOdds(bets.map((b) => ({ id: b.id, matchId: b.matchId, market: b.market, selection: b.selection }))),
      ])
    : [null, {} as Record<string, BookOddsEntry>];

  // Server-anchored "now" for the live section. The client component diffs
  // each pick's placedAt against this (NOT Date.now()) for the stale gate, so
  // a clock-drifted browser can't fake freshness.
  const serverNow = new Date().toISOString();

  // CLV banner cohort follows the user's tier: Pro sees the calibrated cohort,
  // Elite sees all-active (matches what they're actually consuming on this page).
  const clvCohort = isElite ? "elite" : "pro";

  return (
    <div className="space-y-6">
      {/* COHORT-TRANSPARENCY (2026-06-02): make the Pro/Elite distinction
          unmissable. Free users get a teaser ("here's what's in here").
          Pro users get the curated calibrated-bot feed and a clear Elite
          upgrade hook. Elite users get the firehose and a "this is the
          full feed" confirmation. */}
      {!isPro && (
        <section className="rounded-xl border border-white/[0.06] bg-card/40 p-4 text-sm text-muted-foreground sm:p-5">
          <p className="font-semibold text-foreground">What you'd see as Pro or Elite</p>
          <p className="mt-1.5 text-xs leading-relaxed">
            <span className="font-semibold text-foreground">Pro</span> — every pick from our 4 calibrated AI bots (the ones with proven track record). Side, odds, model probability, edge%.
            {" "}
            <span className="font-semibold text-foreground">Elite</span> — every pick from all 39 active bots (calibrated + experimental + niche specialists). Plus Kelly stake sizing per pick.
          </p>
        </section>
      )}
      {isPro && !isElite && (
        <section className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-3 text-xs sm:p-4 sm:text-sm">
          <div className="flex-1 leading-relaxed">
            <p className="font-semibold text-foreground">You're seeing the calibrated-bot feed</p>
            <p className="mt-1 text-muted-foreground">
              These are picks from our 4 calibrated AI bots — promoted only after proving statistically significant ROI. Quality over quantity. Elite tier unlocks picks from all 39 active bots (~3× the daily pick volume) plus per-bot tracking on /performance.
            </p>
          </div>
        </section>
      )}
      {isElite && (
        <section className="flex items-start gap-3 rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-3 text-xs sm:p-4 sm:text-sm">
          <div className="flex-1 leading-relaxed">
            <p className="font-semibold text-foreground">You're seeing the full feed</p>
            <p className="mt-1 text-muted-foreground">
              Every pick from all 39 active bots — calibrated, experimental, niche specialists. Per-bot ROI + CLV tracking on /performance.
            </p>
          </div>
        </section>
      )}

      {/* Telegram delivery reminder — Pro+ only. Shown to all Pro/Elite users;
          /profile shows the active-or-inactive connect state, so this banner
          just routes them there. */}
      {isPro && (
        <Link
          href="/profile#telegram"
          className="group flex items-center justify-between gap-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-4 py-3 text-xs transition-colors hover:border-sky-500/40 hover:bg-sky-500/[0.10] sm:text-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-base" aria-hidden>📲</span>
            <span className="text-foreground">
              <span className="font-semibold">Get these picks in Telegram</span>
              <span className="ml-2 text-muted-foreground">
                — sent the moment they&apos;re identified, before line movement.
              </span>
            </span>
          </div>
          <span className="text-sky-300 group-hover:text-sky-200">Manage →</span>
        </Link>
      )}

      {/* CLV trust banner — Pro+ only; replaces the old PRO-TIER-V2 hero so
          /value-bets, /world-cup and / all read from a single component. */}
      {isPro && <CLVTrustBanner variant="value-bets" cohort={clvCohort} />}

      {/* Live now — inplay picks, auto-refresh every 60s (Pro+ only) */}
      {isPro && inplayBets.length > 0 && (
        <ValueBetsLiveSection
          initialBets={inplayBets.map((b) => ({
            id: b.id,
            matchId: b.matchId,
            match: b.match,
            league: b.league,
            market: b.market,
            selection: b.selection,
            odds: b.odds,
            modelProb: b.modelProb,
            edge: b.edge,
            kickoff: b.kickoff,
            placedAt: b.placedAt,
            recommendedBookmaker: b.recommendedBookmaker,
            bot: b.bot,
            stake: b.stake,
          }))}
          serverNow={serverNow}
          isElite={isElite}
        />
      )}

      <TodayPicksPreview picks={todayPicks} isPro={isPro} isElite={isElite} />
      <ValueBetsScan
        bets={bets}
        totalCount={totalCount}
        userTier={userTier}
        oddsVerifiedAt={oddsVerifiedAt}
        bookOdds={bookOdds}
        botRecentRoi={extras.botRecentRoi}
        leagueHitRates={leagueHitRates}
      />
    </div>
  );
}
