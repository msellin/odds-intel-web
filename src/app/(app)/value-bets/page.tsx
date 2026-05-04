export const dynamic = 'force-dynamic';

import { createSupabaseServer } from "@/lib/supabase-server";
import { getTodayBets, getTodayPicks, type LiveBet } from "@/lib/engine-data";
import { ValueBetsLive } from "@/components/value-bets-live";
import { ValueBetsGate } from "@/components/value-bets-gate";
import { TodayPicksPreview } from "@/components/today-picks-preview";
import { getUserTier } from "@/lib/get-user-tier";

// Deduplicate bets by match+market+selection — multiple bots can place the
// same pick independently, which creates duplicate rows. We keep the highest-edge
// instance and track the bot count for Elite display.
function deduplicateBets(bets: LiveBet[]): (LiveBet & { botCount: number })[] {
  const seen = new Map<string, LiveBet & { botCount: number }>();
  for (const bet of bets) {
    const key = `${bet.match}|${bet.market}|${bet.selection}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...bet, botCount: 1 });
    } else {
      existing.botCount += 1;
      // Keep highest-edge row's data
      if (bet.edge > existing.edge) {
        seen.set(key, { ...bet, botCount: existing.botCount });
      }
    }
  }
  return Array.from(seen.values());
}

// Strip fields that a given tier should never receive.
// This runs server-side — the result is what gets serialized into the RSC
// payload, so anything not included here never reaches the browser.
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

  // Free: only the top bet. Blurred placeholder rows in the UI are fake.
  return { bets: deduped.slice(0, 1), totalCount };
}

export default async function ValueBetsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <ValueBetsGate />;
  }

  const { tier: userTier, isPro, isElite } = await getUserTier(user.id, supabase);

  const [allBets, todayPicks] = await Promise.all([
    getTodayBets(),
    getTodayPicks(),
  ]);
  const sorted = [...allBets].sort((a, b) => b.edge - a.edge);
  const { bets, totalCount } = sanitizeBets(sorted, isPro, isElite);

  return (
    <div className="space-y-6">
      <TodayPicksPreview picks={todayPicks} isPro={isPro} isElite={isElite} />
      <ValueBetsLive bets={bets} totalCount={totalCount} userTier={userTier} />
    </div>
  );
}
