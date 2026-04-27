"use client";

import { useState, useMemo } from "react";
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
import { cn } from "@/lib/utils";
import { TierGate } from "@/components/tier-gate";
import type { LiveBet } from "@/lib/engine-data";

interface Stats {
  totalBets: number;
  pending: number;
  won: number;
  lost: number;
  hitRate: number;
  roi: number;
  totalStaked: number;
  totalPnl: number;
  allPending: boolean;
}

interface TrackRecordLiveProps {
  bets: LiveBet[];
  stats: Stats;
}

const ALL = "__all__";
const INITIAL_SHOW = 50;
const LOAD_MORE_COUNT = 50;

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "green" | "red" | "neutral";
}) {
  const colorClass =
    color === "green"
      ? "text-emerald-400"
      : color === "red"
        ? "text-red-400"
        : "text-foreground";

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <span
          className={`font-mono text-xl font-bold tabular-nums ${colorClass}`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

function ResultBadge({ result }: { result: string }) {
  if (result === "won") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-semibold uppercase border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
      >
        Won
      </Badge>
    );
  }
  if (result === "lost") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-semibold uppercase border-red-500/50 bg-red-500/10 text-red-500"
      >
        Lost
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="text-[10px] font-semibold uppercase animate-pulse"
    >
      Pending
    </Badge>
  );
}

function formatBot(bot: string): string {
  return bot
    .replace("bot_", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(isoStr: string): string {
  try {
    return isoStr.split("T")[0];
  } catch {
    return isoStr;
  }
}

export function TrackRecordLive({ bets, stats }: TrackRecordLiveProps) {
  const [botFilter, setBotFilter] = useState(ALL);
  const [leagueFilter, setLeagueFilter] = useState(ALL);
  const [resultFilter, setResultFilter] = useState(ALL);
  const [visibleCount, setVisibleCount] = useState(INITIAL_SHOW);

  const botOptions = useMemo(
    () => Array.from(new Set(bets.map((b) => b.bot))).sort(),
    [bets]
  );

  const leagueOptions = useMemo(
    () => Array.from(new Set(bets.map((b) => b.league))).sort(),
    [bets]
  );

  const filtered = useMemo(() => {
    return bets.filter((b) => {
      if (botFilter !== ALL && b.bot !== botFilter) return false;
      if (leagueFilter !== ALL && b.league !== leagueFilter) return false;
      if (resultFilter !== ALL && b.result !== resultFilter) return false;
      return true;
    });
  }, [bets, botFilter, leagueFilter, resultFilter]);

  const visibleBets = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Track Record</h1>
          <p className="text-sm text-muted-foreground">
            Full transparency. Every pick, every result.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit font-mono">
          {stats.totalBets} bets tracked
        </Badge>
      </div>

      <TierGate requiredTier="sharp" featureName="Track Record">
        {/* Empty state */}
        {stats.totalBets === 0 ? (
          <div className="rounded-lg border border-border/50 bg-card px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No bets in the system yet. Paper trading will begin once the model
              is running.
            </p>
          </div>
        ) : (
          <>
            {/* All pending notice */}
            {stats.allPending && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-center">
                <p className="text-sm text-amber-400">
                  All bets pending — results will update after matches complete
                </p>
              </div>
            )}

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <StatCard
                label="Total Bets"
                value={stats.totalBets.toString()}
                color="neutral"
              />
              <StatCard
                label="Pending"
                value={stats.pending.toString()}
                color="neutral"
              />
              <StatCard
                label="Won"
                value={stats.won.toString()}
                color="green"
              />
              <StatCard
                label="Lost"
                value={stats.lost.toString()}
                color="red"
              />
              <StatCard
                label="Hit Rate"
                value={
                  stats.won + stats.lost > 0
                    ? `${stats.hitRate.toFixed(1)}%`
                    : "--"
                }
                color={
                  stats.hitRate > 52
                    ? "green"
                    : stats.hitRate < 48 && stats.won + stats.lost > 0
                      ? "red"
                      : "neutral"
                }
              />
              <StatCard
                label="ROI"
                value={
                  stats.won + stats.lost > 0
                    ? `${stats.roi > 0 ? "+" : ""}${stats.roi.toFixed(1)}%`
                    : "--"
                }
                color={
                  stats.roi > 0
                    ? "green"
                    : stats.roi < 0
                      ? "red"
                      : "neutral"
                }
              />
              <StatCard
                label="Total Staked"
                value={`${stats.totalStaked.toFixed(0)}`}
                color="neutral"
              />
              <StatCard
                label="Total P&L"
                value={`${stats.totalPnl > 0 ? "+" : ""}${stats.totalPnl.toFixed(2)}`}
                color={
                  stats.totalPnl > 0
                    ? "green"
                    : stats.totalPnl < 0
                      ? "red"
                      : "neutral"
                }
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <Select
                value={botFilter}
                onValueChange={(v) => v && setBotFilter(v)}
              >
                <SelectTrigger className="w-[180px] text-xs">
                  <SelectValue placeholder="Bot strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All strategies</SelectItem>
                  {botOptions.map((b) => (
                    <SelectItem key={b} value={b}>
                      {formatBot(b)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={leagueFilter}
                onValueChange={(v) => v && setLeagueFilter(v)}
              >
                <SelectTrigger className="w-[200px] text-xs">
                  <SelectValue placeholder="League" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All leagues</SelectItem>
                  {leagueOptions.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={resultFilter}
                onValueChange={(v) => v && setResultFilter(v)}
              >
                <SelectTrigger className="w-[140px] text-xs">
                  <SelectValue placeholder="Result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All results</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>

              {filtered.length !== bets.length && (
                <span className="self-center text-xs text-muted-foreground">
                  {filtered.length} of {bets.length} shown
                </span>
              )}
            </div>

            {/* Bets table */}
            <Card className="overflow-hidden border-border/50 bg-card/80">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead className="text-[11px] uppercase tracking-wider">
                        Date
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">
                        Match
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">
                        League
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">
                        Bot
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">
                        Market
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">
                        Selection
                      </TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">
                        Odds
                      </TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">
                        Edge %
                      </TableHead>
                      <TableHead className="text-center text-[11px] uppercase tracking-wider">
                        Result
                      </TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">
                        Stake
                      </TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wider">
                        P&L
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleBets.map((bet) => (
                      <TableRow
                        key={bet.id}
                        className="border-border/20 hover:bg-muted/10"
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {formatDate(bet.placedAt)}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs font-medium">
                          {bet.match}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {bet.league}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatBot(bet.bot)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {bet.market}
                        </TableCell>
                        <TableCell className="text-xs">{bet.selection}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {bet.odds.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono text-xs font-medium",
                            bet.edge * 100 >= 10
                              ? "text-emerald-400"
                              : bet.edge * 100 >= 5
                                ? "text-amber-400"
                                : "text-muted-foreground"
                          )}
                        >
                          +{(bet.edge * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <ResultBadge result={bet.result} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {bet.stake.toFixed(1)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono text-xs font-medium",
                            bet.pnl > 0
                              ? "text-emerald-400"
                              : bet.pnl < 0
                                ? "text-red-400"
                                : "text-muted-foreground"
                          )}
                        >
                          {bet.pnl > 0 ? "+" : ""}
                          {bet.pnl.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={11}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          No bets match the selected filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="border-t border-border/20 px-4 py-3 text-center">
                  <button
                    onClick={() =>
                      setVisibleCount((c) => c + LOAD_MORE_COUNT)
                    }
                    className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Load more ({filtered.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </Card>

            {/* Honesty note */}
            <p className="border-t border-border/30 pt-4 text-center text-xs text-muted-foreground/70">
              All picks shown — wins AND losses. No cherry-picking. This is real
              performance data.
            </p>
          </>
        )}
      </TierGate>
    </div>
  );
}
