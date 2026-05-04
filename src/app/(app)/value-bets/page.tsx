import { createSupabaseServer } from "@/lib/supabase-server";
import { getTodayBets } from "@/lib/engine-data";
import { ValueBetsLive } from "@/components/value-bets-live";
import { ValueBetsGate } from "@/components/value-bets-gate";
import { getUserTier } from "@/lib/get-user-tier";

export default async function ValueBetsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <ValueBetsGate />;
  }

  const { tier: userTier } = await getUserTier(user.id, supabase);

  const bets = await getTodayBets();
  const sorted = [...bets].sort((a, b) => b.edge - a.edge);

  return <ValueBetsLive bets={sorted} userTier={userTier} />;
}
