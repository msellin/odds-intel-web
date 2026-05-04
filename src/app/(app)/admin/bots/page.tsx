import { createSupabaseServer } from "@/lib/supabase-server";
import { getAllBets } from "@/lib/engine-data";
import type { LiveBet } from "@/lib/engine-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  // Split bots with settled bets vs those that haven't been tested yet
  const activeBots = botStats.filter((b) => b.settled > 0);
  const inactiveBots = botStats.filter((b) => b.settled === 0);

  // ── Summary numbers ─────────────────────────────────────────────────────────
  const totalBets = bets.length;
  const allSettled = bets.filter((b) => b.result !== "pending");
  const allWon = allSettled.filter((b) => b.result === "won").length;
  const allPnl = allSettled.reduce((s, b) => s + b.pnl, 0);
  const allStaked = allSettled.reduce((s, b) => s + b.stake, 0);
  const overallHitRate =
    allSettled.length > 0 ? (allWon / allSettled.length) * 100 : null;
  const overallRoi =
    allStaked > 0 ? (allPnl / allStaked) * 100 : null;

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

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fmt = (n: number) =>
    (n >= 0 ? "+" : "") + n.toFixed(2);
  const fmtPct = (n: number | null) =>
    n == null ? "—" : n.toFixed(1) + "%";

  const pnlClass = (n: number) =>
    n > 0
      ? "text-green-400 font-semibold"
      : n < 0
        ? "text-red-400 font-semibold"
        : "text-muted-foreground";

  const roiClass = (n: number | null) =>
    n == null
      ? "text-muted-foreground"
      : n > 0
        ? "text-green-400"
        : n < 0
          ? "text-red-400"
          : "text-muted-foreground";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Bot Dashboard</h1>
            <Badge variant="outline" className="border-amber-500/50 text-amber-400">
              Superadmin
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Paper trading · Started 2026-04-27 · €1,000/bot starting bankroll
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{bets.length} bets loaded</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total Bets
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{totalBets}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allSettled.length} settled · {totalBets - allSettled.length} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Settled
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{allSettled.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allWon}W · {allSettled.length - allWon}L
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Hit Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{fmtPct(overallHitRate)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">on settled bets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total P&L
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-2xl font-bold ${pnlClass(allPnl)}`}>
              {fmt(allPnl)}€
            </p>
            <p className={`text-xs mt-0.5 ${roiClass(overallRoi)}`}>
              ROI {fmtPct(overallRoi)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-bot table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Bot Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bot Name</TableHead>
                <TableHead className="text-right">Bets</TableHead>
                <TableHead className="text-right">Settled</TableHead>
                <TableHead className="text-right">Won</TableHead>
                <TableHead className="text-right">Lost</TableHead>
                <TableHead className="text-right">Hit Rate</TableHead>
                <TableHead className="text-right">P&L (€)</TableHead>
                <TableHead className="text-right">ROI%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeBots.map((bot) => (
                <TableRow key={bot.name}>
                  <TableCell className="font-mono text-xs">{bot.name}</TableCell>
                  <TableCell className="text-right text-sm">{bot.total}</TableCell>
                  <TableCell className="text-right text-sm">{bot.settled}</TableCell>
                  <TableCell className="text-right text-sm text-green-400">{bot.won}</TableCell>
                  <TableCell className="text-right text-sm text-red-400">{bot.lost}</TableCell>
                  <TableCell className="text-right text-sm">{fmtPct(bot.hitRate)}</TableCell>
                  <TableCell className={`text-right text-sm ${pnlClass(bot.totalPnl)}`}>
                    {fmt(bot.totalPnl)}
                  </TableCell>
                  <TableCell className={`text-right text-sm ${roiClass(bot.roi)}`}>
                    {fmtPct(bot.roi)}
                  </TableCell>
                </TableRow>
              ))}
              {inactiveBots.length > 0 && (
                <>
                  {inactiveBots.map((bot) => (
                    <TableRow key={bot.name} className="opacity-40">
                      <TableCell className="font-mono text-xs">{bot.name}</TableCell>
                      <TableCell className="text-right text-sm">{bot.total}</TableCell>
                      <TableCell className="text-right text-sm">0</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                      <TableCell className="text-right text-sm">—</TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Market breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Market Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Market</TableHead>
                <TableHead className="text-right">Total Bets</TableHead>
                <TableHead className="text-right">Settled</TableHead>
                <TableHead className="text-right">Hit Rate</TableHead>
                <TableHead className="text-right">P&L (€)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marketStats.map((m) => (
                <TableRow key={m.market}>
                  <TableCell className="font-mono text-xs uppercase">{m.market}</TableCell>
                  <TableCell className="text-right text-sm">{m.total}</TableCell>
                  <TableCell className="text-right text-sm">{m.settled}</TableCell>
                  <TableCell className="text-right text-sm">{fmtPct(m.hitRate)}</TableCell>
                  <TableCell className={`text-right text-sm ${pnlClass(m.pnl)}`}>
                    {m.settled > 0 ? fmt(m.pnl) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground pb-4">
        All bets shown — no cherry-picking. {allSettled.length} settled bets is too small for statistical significance.
      </p>
    </div>
  );
}
