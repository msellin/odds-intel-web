"use client";

import { useState } from "react";
import type { LiveBet } from "@/lib/engine-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BotStat {
  name: string;
  total: number;
  settled: number;
  won: number;
  lost: number;
  hitRate: number | null;
  totalPnl: number;
  totalStaked: number;
  roi: number | null;
}

export interface MarketStat {
  market: string;
  total: number;
  settled: number;
  won: number;
  pnl: number;
  hitRate: number | null;
}

export interface Summary {
  totalBets: number;
  settledCount: number;
  wonCount: number;
  allPnl: number;
  allStaked: number;
  hitRate: number | null;
  roi: number | null;
}

interface Props {
  bets: LiveBet[];
  activeBots: BotStat[];
  inactiveBots: BotStat[];
  marketStats: MarketStat[];
  summary: Summary;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

function fmtPct(n: number | null) {
  return n == null ? "—" : n.toFixed(1) + "%";
}

function pnlClass(n: number) {
  return n > 0
    ? "text-green-400 font-semibold"
    : n < 0
      ? "text-red-400 font-semibold"
      : "text-muted-foreground";
}

function roiClass(n: number | null) {
  return n == null
    ? "text-muted-foreground"
    : n > 0
      ? "text-green-400"
      : n < 0
        ? "text-red-400"
        : "text-muted-foreground";
}

function resultBadge(result: string) {
  if (result === "won")
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">W</Badge>;
  if (result === "lost")
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">L</Badge>;
  if (result === "void")
    return <Badge variant="outline" className="text-xs">Void</Badge>;
  return <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">Pending</Badge>;
}

// ── Bankroll chart data ───────────────────────────────────────────────────────

function buildBankrollData(bets: LiveBet[]) {
  const settled = bets
    .filter((b) => b.result !== "pending" && b.result !== "void")
    .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

  if (settled.length === 0) return [];

  // If we have bankrollAfter from DB, use it; otherwise reconstruct
  const hasBankrollData = settled.some((b) => b.bankrollAfter != null);

  let running = 1000;
  return settled.map((b, i) => {
    const bankroll = hasBankrollData && b.bankrollAfter != null
      ? b.bankrollAfter
      : (running += b.pnl, running);
    return {
      idx: i + 1,
      bankroll: Math.round(bankroll * 100) / 100,
      date: new Date(b.placedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
      result: b.result,
    };
  });
}

// ── Bot detail modal ─────────────────────────────────────────────────────────

function BotDetailModal({
  bot,
  bets,
  onClose,
}: {
  bot: BotStat;
  bets: LiveBet[];
  onClose: () => void;
}) {
  const botBets = bets
    .filter((b) => b.bot === bot.name)
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

  const chartData = buildBankrollData(botBets);
  const startLine = 1000;
  const minBankroll = chartData.length > 0
    ? Math.min(...chartData.map((d) => d.bankroll), 1000)
    : 900;
  const maxBankroll = chartData.length > 0
    ? Math.max(...chartData.map((d) => d.bankroll), 1000)
    : 1100;
  const yDomain = [
    Math.floor((minBankroll - 20) / 50) * 50,
    Math.ceil((maxBankroll + 20) / 50) * 50,
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono">{bot.name}</span>
            <span className={`text-base font-semibold ${pnlClass(bot.totalPnl)}`}>
              {fmt(bot.totalPnl)}€
            </span>
            {bot.hitRate != null && (
              <span className="text-sm text-muted-foreground">
                {fmtPct(bot.hitRate)} hit rate · {bot.settled} settled
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Bankroll chart */}
        {chartData.length > 1 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-2">Bankroll progression (€)</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="idx"
                  tick={{ fontSize: 10, fill: "#888" }}
                  tickLine={false}
                  label={{ value: "Bet #", position: "insideBottom", offset: -2, fontSize: 10, fill: "#888" }}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 10, fill: "#888" }}
                  tickLine={false}
                  width={50}
                  tickFormatter={(v) => `€${v}`}
                />
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }}
                  formatter={(value) => [`€${Number(value).toFixed(2)}`, "Bankroll"]}
                  labelFormatter={(label) => {
                    const d = chartData[Number(label) - 1];
                    return d ? `Bet #${label} · ${d.date}` : `Bet #${label}`;
                  }}
                />
                <ReferenceLine y={startLine} stroke="#555" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="bankroll"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const color = payload.result === "won" ? "#22c55e" : "#ef4444";
                    return <circle key={`dot-${props.index}`} cx={cx} cy={cy} r={3} fill={color} stroke="none" />;
                  }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartData.length <= 1 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {bot.settled === 0 ? "No settled bets yet." : "Need 2+ settled bets for chart."}
          </p>
        )}

        {/* Bets table */}
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-2">All bets ({botBets.length} total, newest first)</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Match</TableHead>
                  <TableHead className="text-xs">Market</TableHead>
                  <TableHead className="text-xs text-right">Odds</TableHead>
                  <TableHead className="text-xs text-right">Stake</TableHead>
                  <TableHead className="text-xs text-center">Result</TableHead>
                  <TableHead className="text-xs text-right">P&L</TableHead>
                  <TableHead className="text-xs text-right">CLV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {botBets.map((bet) => (
                  <TableRow key={bet.id} className="text-xs">
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(bet.placedAt).toLocaleDateString("en-GB", {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate" title={bet.match}>
                      {bet.match}
                    </TableCell>
                    <TableCell className="font-mono uppercase text-muted-foreground">
                      {bet.market} · {bet.selection}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{bet.odds.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">€{bet.stake.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{resultBadge(bet.result)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${bet.result !== "pending" ? pnlClass(bet.pnl) : "text-muted-foreground"}`}>
                      {bet.result !== "pending" ? fmt(bet.pnl) : "—"}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${bet.clv != null ? (bet.clv > 0 ? "text-green-400" : bet.clv < 0 ? "text-red-400" : "text-muted-foreground") : "text-muted-foreground"}`}>
                      {bet.clv != null ? (bet.clv >= 0 ? "+" : "") + (bet.clv * 100).toFixed(1) + "%" : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BotDashboardClient({
  bets,
  activeBots,
  inactiveBots,
  marketStats,
  summary,
}: Props) {
  const [selectedBot, setSelectedBot] = useState<BotStat | null>(null);

  return (
    <>
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
            <p className="text-2xl font-bold">{summary.totalBets}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.settledCount} settled · {summary.totalBets - summary.settledCount} pending
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
            <p className="text-2xl font-bold">{summary.settledCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.wonCount}W · {summary.settledCount - summary.wonCount}L
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
            <p className="text-2xl font-bold">{fmtPct(summary.hitRate)}</p>
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
            <p className={`text-2xl font-bold ${pnlClass(summary.allPnl)}`}>
              {fmt(summary.allPnl)}€
            </p>
            <p className={`text-xs mt-0.5 ${roiClass(summary.roi)}`}>
              ROI {fmtPct(summary.roi)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-bot table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Per-Bot Performance
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Click a row to see bets
            </span>
          </CardTitle>
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
                <TableRow
                  key={bot.name}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedBot(bot)}
                >
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
              {inactiveBots.map((bot) => (
                <TableRow
                  key={bot.name}
                  className="opacity-40 cursor-pointer hover:opacity-60 transition-opacity"
                  onClick={() => setSelectedBot(bot)}
                >
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
        All bets shown — no cherry-picking. {summary.settledCount} settled bets is too small for statistical significance.
      </p>

      {/* Bot detail modal */}
      {selectedBot && (
        <BotDetailModal
          bot={selectedBot}
          bets={bets}
          onClose={() => setSelectedBot(null)}
        />
      )}
    </>
  );
}
