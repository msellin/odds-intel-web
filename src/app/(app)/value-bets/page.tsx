import { createSupabaseServer } from "@/lib/supabase-server";
import { getTodayBets, getTodayPicks } from "@/lib/engine-data";
import { ValueBetsLive } from "@/components/value-bets-live";
import { ValueBetsGate } from "@/components/value-bets-gate";
import { TodayPicksPreview } from "@/components/today-picks-preview";
import { getUserTier } from "@/lib/get-user-tier";

export default async function ValueBetsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <ValueBetsGate />;
  }

  const { tier: userTier, isPro, isElite } = await getUserTier(user.id, supabase);

  const [bets, todayPicks] = await Promise.all([
    getTodayBets(),
    getTodayPicks(),
  ]);
  const sorted = [...bets].sort((a, b) => b.edge - a.edge);

  return (
    <div className="space-y-6">
      <TodayPicksPreview picks={todayPicks} isPro={isPro} isElite={isElite} />
      <ValueBetsLive bets={sorted} userTier={userTier} />
    </div>
  );
}
