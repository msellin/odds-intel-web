export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import { Suspense } from "react";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  getTodayBets,
  getTodayPicks,
  getOddsVerifiedAt,
  getValueBetBookOdds,
  getPublicPerformanceExtras,
  type LiveBet,
  type BookOddsEntry,
} from "@/lib/engine-data";
import { ValueBetsLive } from "@/components/value-bets-live";
import { ValueBetsGate } from "@/components/value-bets-gate";
import { TodayPicksPreview } from "@/components/today-picks-preview";
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

function sanitizeBets(
  bets: LiveBet[],
  isPro: boolean,
  isElite: boolean
): { bets: (LiveBet & { botCount: number })[]; totalCount: number } {
  const deduped = deduplicateBets(bets);
  const totalCount = deduped.length;

  if (isElite) return { bets: deduped, totalCount };

  if (isPro) {
    const stripped = deduped.map((b) => ({
      ...b,
      selection: "",
      odds: 0,
      modelProb: 0,
      impliedProb: 0,
      stake: 0,
      pnl: 0,
      bankrollAfter: null,
      closingOdds: null,
      clv: null,
    }));
    return { bets: stripped, totalCount };
  }

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

  const [allBets, todayPicks, extras] = await Promise.all([
    getTodayBets(),
    getTodayPicks(),
    // Used for the free-tier "this bot's last-30-day ROI" hook + Pro odds-movement view.
    getPublicPerformanceExtras(),
  ]);
  // COOLBET-FIRST-SORT (2026-05-25): bets with Coolbet as the recommended
  // book come first — Coolbet is the operator's primary placement venue,
  // so surfacing those bets reduces friction. Within each group, sort by
  // edge descending (the original sort).
  const sorted = [...allBets].sort((a, b) => {
    const aCoolbet = (a.recommendedBookmaker ?? "").toLowerCase() === "coolbet" ? 1 : 0;
    const bCoolbet = (b.recommendedBookmaker ?? "").toLowerCase() === "coolbet" ? 1 : 0;
    if (aCoolbet !== bCoolbet) return bCoolbet - aCoolbet;
    return b.edge - a.edge;
  });
  const { bets, totalCount } = sanitizeBets(sorted, isPro, isElite);

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

  return (
    <div className="space-y-6">
      <TodayPicksPreview picks={todayPicks} isPro={isPro} isElite={isElite} />
      <ValueBetsLive
        bets={bets}
        totalCount={totalCount}
        userTier={userTier}
        oddsVerifiedAt={oddsVerifiedAt}
        bookOdds={bookOdds}
        botRecentRoi={extras.botRecentRoi}
      />
    </div>
  );
}
