export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import { Suspense } from "react";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  getTodayBets,
  getTodayPicks,
  getOddsVerifiedAt,
  getValueBetBookOdds,
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

function deduplicateBets(bets: LiveBet[]): (LiveBet & { botCount: number })[] {
  const seen = new Map<string, LiveBet & { botCount: number }>();
  for (const bet of bets) {
    const [home = "", away = ""] = bet.match.split(" vs ");
    const key = `${bet.kickoff}|${normalizeTeam(home)}|${normalizeTeam(away)}|${bet.market}|${bet.selection}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...bet, botCount: 1 });
    } else {
      existing.botCount += 1;
      if (bet.edge > existing.edge) {
        seen.set(key, { ...bet, botCount: existing.botCount });
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

  const [allBets, todayPicks] = await Promise.all([
    getTodayBets(),
    getTodayPicks(),
  ]);
  const sorted = [...allBets].sort((a, b) => b.edge - a.edge);
  const { bets, totalCount } = sanitizeBets(sorted, isPro, isElite);

  const matchIds = Array.from(new Set(bets.map((b) => b.matchId).filter(Boolean)));
  const [oddsVerifiedAt, bookOdds] = isElite && matchIds.length > 0
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
      />
    </div>
  );
}
