export const dynamic = 'force-dynamic';

import { createSupabaseServer } from "@/lib/supabase-server";
import { getAllBets, getAllBotsFromDB } from "@/lib/engine-data";
import { BotDashboardClient } from "@/components/bot-dashboard-client";

// BOT-QUAL-FILTER-DUAL — server now ships raw bets + DB bot rows only.
// Aggregation (botStats, summary, marketStats) happens inside
// BotDashboardClient via useMemo so the "Quality only" toggle updates
// every metric on the page at once. See src/lib/bot-aggregates.ts.

export default async function BotDashboardPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Access denied.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_superadmin) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Access denied.
      </div>
    );
  }

  const [bets, allBotsDB] = await Promise.all([getAllBets(), getAllBotsFromDB()]);

  return (
    <div className="space-y-8">
      <BotDashboardClient bets={bets} allBotsDB={allBotsDB} />
    </div>
  );
}
