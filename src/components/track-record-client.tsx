"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HistoricalBet } from "@/lib/types";

interface Props {
  bets: HistoricalBet[];
}

const INITIAL_SHOW = 50;
const LOAD_MORE_COUNT = 50;

export function TrackRecordClient({ bets }: Props) {
  const [timePeriod, setTimePeriod] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_SHOW);

  // Derive unique values for filters
  const leagues = useMemo(() => [...new Set(bets.map((b) => b.league))].sort(), [bets]);
  const markets = useMemo(() => [...new Set(bets.map((b) => b.market))].sort(), [bets]);
  const strategies = useMemo(() => [...new Set(bets.map((b) => b.botStrategy))].sort(), [bets]);

  // Filter bets
  const filteredBets = useMemo(() => {
    let result = [...bets];

    // Time period
    if (timePeriod !== "all") {
      const days = parseInt(timePeriod);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      result = result.filter((b) => b.date >= cutoffStr);
    }

    if (leagueFilter !== "all") result = result.filter((b) => b.league === leagueFilter);
    if (marketFilter !== "all") result = result.filter((b) => b.market === marketFilter);
    if (strategyFilter !== "all") result = result.filter((b) => b.botStrategy === strategyFilter);

    return result;
  }, [bets, timePeriod, leagueFilter, marketFilter, strategyFilter]);

  // Chart data: bankroll over time from filtered bets
  const chartData = useMemo(() => {
    // Start with the bankroll before the first filtered bet
    const sorted = [...filteredBets].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
    );
    if (sorted.length === 0) return [];

    const startBankroll = sorted[0].bankrollAfter - sorted[0].pnl;
    const points: { date: string; bankroll: number }[] = [
      { date: sorted[0].date, bankroll: Math.round(startBankroll * 100) / 100 },
    ];

    for (const bet of sorted) {
      points.push({
        date: bet.date,
        bankroll: Math.round(bet.bankrollAfter * 100) / 100,
      });
    }

    return points;
  }, [filteredBets]);

  // Newest first for the table
  const sortedForTable = useMemo(
    () =>
      [...filteredBets].sort(
        (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
      ),
    [filteredBets]
  );

  const visibleBets = sortedForTable.slice(0, visibleCount);
  const hasMore = visibleCount < sortedForTable.length;

  return (
    <div className="space-y-6">
      {/* Bankroll Growth Chart */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Bankroll Growth
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bankrollGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                  minTickGap={40}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}`}
                  domain={["dataMin - 50", "dataMax + 50"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                  labelStyle={{ color: "#64748b" }}
                  itemStyle={{ color: "#10b981" }}
                  formatter={(value) => [`${Number(value).toFixed(2)} EUR`, "Bankroll"]}
                />
                <ReferenceLine
                  y={1000}
                  stroke="#64748b"
                  strokeDasharray="6 4"
                  label={{
                    value: "Starting: 1000",
                    position: "insideTopRight",
                    fill: "#64748b",
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="bankroll"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#bankrollGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#10b981" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={timePeriod} onValueChange={(v) => v && setTimePeriod(v)}>
          <SelectTrigger className="w-[140px] text-xs">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        <Select value={leagueFilter} onValueChange={(v) => v && setLeagueFilter(v)}>
          <SelectTrigger className="w-[180px] text-xs">
            <SelectValue placeholder="League" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All leagues</SelectItem>
            {leagues.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={marketFilter} onValueChange={(v) => v && setMarketFilter(v)}>
          <SelectTrigger className="w-[140px] text-xs">
            <SelectValue placeholder="Market" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All markets</SelectItem>
            {markets.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={strategyFilter} onValueChange={(v) => v && setStrategyFilter(v)}>
          <SelectTrigger className="w-[180px] text-xs">
            <SelectValue placeholder="Bot strategy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All strategies</SelectItem>
            {strategies.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filtered stats summary */}
      <div className="text-xs text-muted-foreground">
        Showing {sortedForTable.length} bets
        {filteredBets.length !== bets.length && " (filtered)"}
      </div>

      {/* Bets History Table */}
      <Card className="overflow-hidden border-border/50 bg-card/80">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Match</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">League</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Market</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Selection</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Odds</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Close</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">CLV</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Result</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Stake</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleBets.map((bet) => (
                <TableRow key={bet.id} className="border-border/20 hover:bg-muted/10">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {bet.date}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs font-medium">
                    {bet.match}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{bet.league}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{bet.market}</TableCell>
                  <TableCell className="text-xs">{bet.selection}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{bet.oddsAtPick.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {bet.closingOdds.toFixed(2)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-xs ${
                      bet.clv > 0 ? "text-emerald-400" : bet.clv < 0 ? "text-red-400" : "text-muted-foreground"
                    }`}
                  >
                    {bet.clv > 0 ? "+" : ""}
                    {bet.clv.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        bet.result === "won"
                          ? "default"
                          : bet.result === "lost"
                            ? "destructive"
                            : "secondary"
                      }
                      className={`text-[10px] font-semibold uppercase ${
                        bet.result === "won"
                          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20"
                          : bet.result === "lost"
                            ? "bg-red-500/15 text-red-400 hover:bg-red-500/20"
                            : ""
                      }`}
                    >
                      {bet.result === "won" ? "W" : bet.result === "lost" ? "L" : "V"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {bet.stake.toFixed(2)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-xs font-medium ${
                      bet.pnl > 0 ? "text-emerald-400" : bet.pnl < 0 ? "text-red-400" : "text-muted-foreground"
                    }`}
                  >
                    {bet.pnl > 0 ? "+" : ""}
                    {bet.pnl.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="border-t border-border/20 px-4 py-3 text-center">
            <button
              onClick={() => setVisibleCount((c) => c + LOAD_MORE_COUNT)}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Load more ({sortedForTable.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
