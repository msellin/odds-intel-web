import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getTodayBets } from "@/lib/engine-data";
import { ValueBetsLive } from "@/components/value-bets-live";

// TODO F5: proper Elite tier gating needed here before paid launch.
// Currently requires login only. Full fix: check profile.tier === 'elite'
// and show a locked teaser for free/pro users instead of the full picks.
// Depends on Stripe integration (F8) so tier is meaningful.

export default async function ValueBetsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const bets = await getTodayBets();
  const sorted = [...bets].sort((a, b) => b.edge - a.edge);

  return <ValueBetsLive bets={sorted} />;
}
