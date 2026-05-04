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
  description: string;
  total: number;
  pending: number;
  settled: number;
  won: number;
  lost: number;
  hitRate: number | null;
  totalPnl: number;
  totalStaked: number;
  roi: number | null;
  currentBankroll: number;
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
  totalBots: number;
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
  pendingBots: BotStat[];
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
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0 h-5">W</Badge>;
  if (result === "lost")
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0 h-5">L</Badge>;
  if (result === "void")
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">Void</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-yellow-400 border-yellow-500/30">Pending</Badge>;
}

// ── Bankroll chart data ───────────────────────────────────────────────────────

function buildBankrollData(bets: LiveBet[]) {
  const settled = bets
    .filter((b) => b.result !== "pending" && b.result !== "void")
    .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

  if (settled.length === 0) return [];

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
  const bankrollValues = chartData.map((d) => d.bankroll);
  const minBankroll = bankrollValues.length > 0 ? Math.min(...bankrollValues, 1000) : 900;
  const maxBankroll = bankrollValues.length > 0 ? Math.max(...bankrollValues, 1000) : 1100;
  const yDomain = [
    Math.floor((minBankroll - 30) / 50) * 50,
    Math.ceil((maxBankroll + 30) / 50) * 50,
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-base">{bot.name}</span>
            {bot.settled > 0 && (
              <span className={`text-base font-semibold ${pnlClass(bot.totalPnl)}`}>
                {fmt(bot.totalPnl)}€
              </span>
            )}
            <span className="text-sm text-muted-foreground font-normal">
              {bot.settled > 0
                ? `${fmtPct(bot.hitRate)} hit rate · ${bot.settled} settled · ${bot.pending} pending`
                : bot.total > 0
                  ? `${bot.total} pending bets · no settled results yet`
                  : "No bets placed yet"}
            </span>
          </DialogTitle>
          {bot.description && (
            <p className="text-xs text-muted-foreground mt-1">{bot.description}</p>
          )}
        </DialogHeader>

        {/* Bankroll chart */}
        {chartData.length > 1 ? (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-2">Bankroll progression (€) — {chartData.length} settled bets</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="idx"
                  tick={{ fontSize: 11, fill: "#888" }}
                  tickLine={false}
                  label={{ value: "Bet #", position: "insideBottom", offset: -2, fontSize: 11, fill: "#888" }}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11, fill: "#888" }}
                  tickLine={false}
                  width={58}
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
                <ReferenceLine y={startLine} stroke="#555" strokeDasharray="4 4" label={{ value: "€1,000 start", fontSize: 10, fill: "#666" }} />
                <Line
                  type="monotone"
                  dataKey="bankroll"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const color = payload.result === "won" ? "#22c55e" : "#ef4444";
                    return <circle key={`dot-${props.index}`} cx={cx} cy={cy} r={3.5} fill={color} stroke="none" />;
                  }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : bot.settled === 0 ? (
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-sm text-muted-foreground">
            {bot.total > 0
              ? `${bot.total} pending bet${bot.total > 1 ? "s" : ""} — waiting for match results.`
              : "This bot hasn't placed any bets yet. It's waiting for qualifying matches (odds range, edge threshold, league/tier filters)."}
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted-foreground text-center py-4">
            Need 2+ settled bets for chart.
          </div>
        )}

        {/* Bets table */}
        {botBets.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">
              All bets ({botBets.length} total, newest first)
            </p>
            <div className="rounded-md border border-white/[0.08] overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.08]">
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Match</TableHead>
                    <TableHead className="text-xs">League</TableHead>
                    <TableHead className="text-xs">Market · Selection</TableHead>
                    <TableHead className="text-xs text-right">Odds</TableHead>
                    <TableHead className="text-xs text-right">Stake</TableHead>
                    <TableHead className="text-xs text-right">Model%</TableHead>
                    <TableHead className="text-xs text-center">Result</TableHead>
                    <TableHead className="text-xs text-right">P&L</TableHead>
                    <TableHead className="text-xs text-right">CLV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {botBets.map((bet) => (
                    <TableRow key={bet.id} className="text-xs border-white/[0.06]">
                      <TableCell className="text-muted-foreground whitespace-nowrap py-2">
                        {new Date(bet.placedAt).toLocaleDateString("en-GB", {
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="py-2 max-w-[200px]">
                        <span className="block truncate" title={bet.match}>{bet.match}</span>
                      </TableCell>
                      <TableCell className="py-2 max-w-[140px] text-muted-foreground">
                        <span className="block truncate text-[10px]" title={bet.league}>{bet.league}</span>
                      </TableCell>
                      <TableCell className="font-mono uppercase text-muted-foreground py-2 whitespace-nowrap text-[10px]">
                        {bet.market} · {bet.selection}
                      </TableCell>
                      <TableCell className="text-right tabular-nums py-2">{bet.odds.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums py-2 whitespace-nowrap">€{bet.stake.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums py-2 text-muted-foreground">
                        {(bet.modelProb * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-center py-2">{resultBadge(bet.result)}</TableCell>
                      <TableCell className={`text-right tabular-nums py-2 ${bet.result !== "pending" ? pnlClass(bet.pnl) : "text-muted-foreground"}`}>
                        {bet.result !== "pending" ? fmt(bet.pnl) : "—"}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums py-2 ${bet.clv != null ? (bet.clv > 0 ? "text-green-400" : bet.clv < 0 ? "text-red-400" : "text-muted-foreground") : "text-muted-foreground"}`}>
                        {bet.clv != null ? (bet.clv >= 0 ? "+" : "") + (bet.clv * 100).toFixed(1) + "%" : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Bot row ───────────────────────────────────────────────────────────────────

function BotRow({
  bot,
  dimmed,
  onClick,
}: {
  bot: BotStat;
  dimmed: boolean;
  onClick: () => void;
}) {
  const bankrollDelta = bot.currentBankroll - 1000;

  return (
    <TableRow
      className={`cursor-pointer transition-colors hover:bg-muted/50 ${dimmed ? "opacity-35" : ""}`}
      onClick={onClick}
    >
      <TableCell className="font-mono text-xs py-2.5">{bot.name}</TableCell>
      <TableCell className="text-right text-sm py-2.5">{bot.total > 0 ? bot.total : <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="text-right text-sm py-2.5">{bot.settled > 0 ? bot.settled : <span className="text-muted-foreground">{bot.pending > 0 ? `${bot.pending}p` : "—"}</span>}</TableCell>
      <TableCell className="text-right text-sm py-2.5 text-green-400">{bot.won > 0 ? bot.won : <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="text-right text-sm py-2.5 text-red-400">{bot.lost > 0 ? bot.lost : <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="text-right text-sm py-2.5">{fmtPct(bot.hitRate)}</TableCell>
      <TableCell className={`text-right text-sm py-2.5 ${bot.settled > 0 ? pnlClass(bot.totalPnl) : "text-muted-foreground"}`}>
        {bot.settled > 0 ? fmt(bot.totalPnl) : "—"}
      </TableCell>
      <TableCell className={`text-right text-sm py-2.5 ${roiClass(bot.roi)}`}>
        {fmtPct(bot.roi)}
      </TableCell>
      <TableCell className={`text-right text-sm py-2.5 tabular-nums ${bankrollDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
        {bot.total > 0 ? `€${bot.currentBankroll.toFixed(0)}` : <span className="text-muted-foreground">€1,000</span>}
      </TableCell>
    </TableRow>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BotDashboardClient({
  bets,
  activeBots,
  pendingBots,
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
            Paper trading · Started 2026-04-27 · €1,000/bot starting bankroll · {summary.totalBots} bots configured
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{bets.length} bets loaded</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Bets</CardTitle>
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
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Settled</CardTitle>
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
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hit Rate</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{fmtPct(summary.hitRate)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">on settled bets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total P&L</CardTitle>
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
              Click any row to see bets · {summary.totalBots} bots total
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
                <TableHead className="text-right">Bankroll</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeBots.map((bot) => (
                <BotRow key={bot.name} bot={bot} dimmed={false} onClick={() => setSelectedBot(bot)} />
              ))}
              {pendingBots.map((bot) => (
                <BotRow key={bot.name} bot={bot} dimmed={false} onClick={() => setSelectedBot(bot)} />
              ))}
              {inactiveBots.length > 0 && (
                <>
                  <TableRow>
                    <TableCell colSpan={9} className="py-1 px-4">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                        {inactiveBots.length} bots waiting for qualifying conditions
                      </span>
                    </TableCell>
                  </TableRow>
                  {inactiveBots.map((bot) => (
                    <BotRow key={bot.name} bot={bot} dimmed={true} onClick={() => setSelectedBot(bot)} />
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
