import { createSupabaseServer } from "@/lib/supabase-server";
import { getTodayBets } from "@/lib/engine-data";
import { ValueBetsLive } from "@/components/value-bets-live";
import { ValueBetsGate } from "@/components/value-bets-gate";
import { TierGate } from "@/components/tier-gate";

export default async function ValueBetsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <ValueBetsGate />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, is_superadmin")
    .eq("id", user.id)
    .single();

  const tier = profile?.tier ?? "free";
  const isElite = profile?.is_superadmin || tier === "elite";

  const bets = await getTodayBets();
  const sorted = [...bets].sort((a, b) => b.edge - a.edge);

  if (!isElite) {
    return (
      <TierGate requiredTier="elite" featureName="Value bets">
        <ValueBetsLive bets={sorted} />
      </TierGate>
    );
  }

  return <ValueBetsLive bets={sorted} />;
}
