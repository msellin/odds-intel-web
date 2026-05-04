import { createSupabaseServer } from "@/lib/supabase-server";
import { getAllBets } from "@/lib/engine-data";
import { BotDashboardClient } from "@/components/bot-dashboard-client";
import type { LiveBet } from "@/lib/engine-data";

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

  const bets = await getAllBets();

  // ── Aggregate per-bot stats ─────────────────────────────────────────────────
  const botMap: Record<string, { bets: LiveBet[] }> = {};
  for (const bet of bets) {
    if (!botMap[bet.bot]) botMap[bet.bot] = { bets: [] };
    botMap[bet.bot].bets.push(bet);
  }

  const botStats = Object.entries(botMap)
    .map(([name, { bets: botBets }]) => {
      const settled = botBets.filter((b) => b.result !== "pending");
      const won = settled.filter((b) => b.result === "won").length;
      const totalPnl = settled.reduce((s, b) => s + b.pnl, 0);
      const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
      return {
        name,
        total: botBets.length,
        settled: settled.length,
        won,
        lost: settled.length - won,
        hitRate: settled.length > 0 ? (won / settled.length) * 100 : null,
        totalPnl,
        totalStaked,
        roi:
          totalStaked > 0 && settled.length > 0
            ? (totalPnl / totalStaked) * 100
            : null,
      };
    })
    .sort((a, b) => (b.totalPnl ?? 0) - (a.totalPnl ?? 0));

  const activeBots = botStats.filter((b) => b.settled > 0);
  const inactiveBots = botStats.filter((b) => b.settled === 0);

  // ── Summary numbers ─────────────────────────────────────────────────────────
  const totalBets = bets.length;
  const allSettled = bets.filter((b) => b.result !== "pending");
  const allWon = allSettled.filter((b) => b.result === "won").length;
  const allPnl = allSettled.reduce((s, b) => s + b.pnl, 0);
  const allStaked = allSettled.reduce((s, b) => s + b.stake, 0);

  // ── Market breakdown ────────────────────────────────────────────────────────
  const marketMap: Record<
    string,
    { total: number; settled: number; won: number; pnl: number }
  > = {};
  for (const bet of bets) {
    const key = bet.market || "unknown";
    if (!marketMap[key]) marketMap[key] = { total: 0, settled: 0, won: 0, pnl: 0 };
    marketMap[key].total++;
    if (bet.result !== "pending") {
      marketMap[key].settled++;
      marketMap[key].pnl += bet.pnl;
      if (bet.result === "won") marketMap[key].won++;
    }
  }
  const marketStats = Object.entries(marketMap)
    .map(([market, s]) => ({
      market,
      ...s,
      hitRate: s.settled > 0 ? (s.won / s.settled) * 100 : null,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-8">
      <BotDashboardClient
        bets={bets}
        activeBots={activeBots}
        inactiveBots={inactiveBots}
        marketStats={marketStats}
        summary={{
          totalBets,
          settledCount: allSettled.length,
          wonCount: allWon,
          allPnl,
          allStaked,
          hitRate: allSettled.length > 0 ? (allWon / allSettled.length) * 100 : null,
          roi: allStaked > 0 ? (allPnl / allStaked) * 100 : null,
        }}
      />
    </div>
  );
}
