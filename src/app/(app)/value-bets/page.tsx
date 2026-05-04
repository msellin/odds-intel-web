import { createSupabaseServer } from "@/lib/supabase-server";
import { getTodayBets, getTodayPicks, type LiveBet } from "@/lib/engine-data";
import { ValueBetsLive } from "@/components/value-bets-live";
import { ValueBetsGate } from "@/components/value-bets-gate";
import { TodayPicksPreview } from "@/components/today-picks-preview";
import { getUserTier } from "@/lib/get-user-tier";

// Strip fields that a given tier should never receive.
// This runs server-side — the result is what gets serialized into the RSC
// payload, so anything not included here never reaches the browser.
function sanitizeBets(
  bets: LiveBet[],
  isPro: boolean,
  isElite: boolean
): { bets: LiveBet[]; totalCount: number } {
  const totalCount = bets.length;

  if (isElite) return { bets, totalCount };

  if (isPro) {
    // Pro sees all bets but not Elite-only columns
    const stripped = bets.map((b) => ({
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

  // Free: only the top bet (highest edge), everything else is a server-side count.
  // The blurred placeholder rows in the UI are fake — no real data sent.
  const top = bets.slice(0, 1);
  return { bets: top, totalCount };
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
