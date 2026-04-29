import { createSupabaseServer } from "@/lib/supabase-server";
import { getTodayBets } from "@/lib/engine-data";
import { ValueBetsLive } from "@/components/value-bets-live";
import { ValueBetsGate } from "@/components/value-bets-gate";

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

  const isElite = profile?.is_superadmin || profile?.tier === "elite";
  const isPro = !isElite && profile?.tier === "pro";
  const userTier: "free" | "pro" | "elite" = isElite ? "elite" : isPro ? "pro" : "free";

  const bets = await getTodayBets();
  const sorted = [...bets].sort((a, b) => b.edge - a.edge);

  return <ValueBetsLive bets={sorted} userTier={userTier} />;
}
