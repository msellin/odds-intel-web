export const dynamic = 'force-dynamic';

import { createSupabaseServer } from "@/lib/supabase-server";
import { getAllBets, getAllBotsFromDB } from "@/lib/engine-data";
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

  // Fetch both in parallel — bots table is the authoritative list of all 16 bots
  const [bets, allBotsDB] = await Promise.all([getAllBets(), getAllBotsFromDB()]);

  // ── Aggregate per-bot stats ─────────────────────────────────────────────────
  const betsByBot: Record<string, LiveBet[]> = {};
  for (const bet of bets) {
    if (!betsByBot[bet.bot]) betsByBot[bet.bot] = [];
    betsByBot[bet.bot].push(bet);
  }

  // Build stats for ALL bots from DB (not just those with bets)
  const botStats = allBotsDB.map((dbBot) => {
    const botBets = betsByBot[dbBot.name] || [];
    const settled = botBets.filter((b) => b.result !== "pending" && b.result !== "void");
    const won = settled.filter((b) => b.result === "won").length;
    const totalPnl = settled.reduce((s, b) => s + b.pnl, 0);
    const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
    return {
      name: dbBot.name,
      description: dbBot.strategy || "",
      total: botBets.length,
      pending: botBets.filter((b) => b.result === "pending").length,
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
      currentBankroll: dbBot.currentBankroll,
    };
  }).sort((a, b) => {
    // Bots with settled bets first (by P&L), then pending-only, then zero-bet bots last
    if (a.settled > 0 && b.settled === 0) return -1;
    if (a.settled === 0 && b.settled > 0) return 1;
    if (a.settled > 0 && b.settled > 0) return b.totalPnl - a.totalPnl;
    if (a.total > 0 && b.total === 0) return -1;
    if (a.total === 0 && b.total > 0) return 1;
    return a.name.localeCompare(b.name);
  });

  const activeBots = botStats.filter((b) => b.settled > 0);
  const pendingBots = botStats.filter((b) => b.settled === 0 && b.total > 0);
  const inactiveBots = botStats.filter((b) => b.total === 0);

  // ── Summary numbers ─────────────────────────────────────────────────────────
  const totalBets = bets.length;
  const allSettled = bets.filter((b) => b.result !== "pending" && b.result !== "void");
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
    if (bet.result !== "pending" && bet.result !== "void") {
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
        pendingBots={pendingBots}
        inactiveBots={inactiveBots}
        marketStats={marketStats}
        summary={{
          totalBots: allBotsDB.length,
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
