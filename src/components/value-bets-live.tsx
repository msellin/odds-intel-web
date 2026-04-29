"use client";

import { useState, useMemo } from "react";
import { Target, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TierGate } from "@/components/tier-gate";
import type { LiveBet } from "@/lib/engine-data";

interface ValueBetsLiveProps {
  bets: LiveBet[];
}

const ALL = "__all__";

function formatEdge(edge: number): string {
  return (edge * 100).toFixed(1);
}

function edgeColor(edge: number): string {
  const pct = edge * 100;
  if (pct >= 10) return "text-emerald-500";
  if (pct >= 5) return "text-amber-500";
  return "text-muted-foreground";
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
      className="text-[10px] font-semibold uppercase"
    >
      {result}
    </Badge>
  );
}

function formatBot(bot: string): string {
  return bot
    .replace("bot_", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ValueBetsLive({ bets }: ValueBetsLiveProps) {
  const [league, setLeague] = useState(ALL);
  const [bot, setBot] = useState(ALL);

  const leagues = useMemo(
    () => Array.from(new Set(bets.map((b) => b.league))).sort(),
    [bets]
  );

  const bots = useMemo(
    () => Array.from(new Set(bets.map((b) => b.bot))).sort(),
    [bets]
  );

  const filtered = useMemo(() => {
    return bets.filter((b) => {
      if (league !== ALL && b.league !== league) return false;
      if (bot !== ALL && b.bot !== bot) return false;
      return true;
    });
  }, [bets, league, bot]);

  const totalBets = filtered.length;
  const avgEdge =
    totalBets > 0
      ? filtered.reduce((sum, b) => sum + b.edge, 0) / totalBets
      : 0;
  const highestEdge =
    totalBets > 0 ? Math.max(...filtered.map((b) => b.edge)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-xl font-bold tracking-tight">
            Value Bets
          </h1>
          <Badge variant="secondary" className="font-mono text-xs">
            {bets.length}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Today&apos;s picks ranked by edge — placed by the engine when it finds
          value
        </p>
      </div>

      <TierGate requiredTier="elite" featureName="Value Bets">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total bets today</p>
            <p className="font-mono text-2xl font-bold">{totalBets}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Avg edge</p>
            <p className={cn("font-mono text-2xl font-bold", edgeColor(avgEdge))}>
              {formatEdge(avgEdge)}%
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Highest edge</p>
            <p
              className={cn(
                "font-mono text-2xl font-bold",
                edgeColor(highestEdge)
              )}
            >
              {formatEdge(highestEdge)}%
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={league} onValueChange={(v) => setLeague(v ?? ALL)}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="All leagues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All leagues</SelectItem>
              {leagues.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={bot} onValueChange={(v) => setBot(v ?? ALL)}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All strategies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All strategies</SelectItem>
              {bots.map((b) => (
                <SelectItem key={b} value={b}>
                  {formatBot(b)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filtered.length !== bets.length && (
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {bets.length} shown
            </span>
          )}
        </div>

        {/* Empty state */}
        {bets.length === 0 ? (
          <div className="rounded-lg border border-border/50 bg-card px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No bets placed today. The model runs hourly — check back later.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Card className="overflow-hidden border-border/50">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="text-xs">Match</TableHead>
                        <TableHead className="text-xs">League</TableHead>
                        <TableHead className="text-xs">Market</TableHead>
                        <TableHead className="text-xs">Selection</TableHead>
                        <TableHead className="text-xs text-right">
                          Odds
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          Model Prob
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          Implied Prob
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          <span className="group relative inline-flex items-center gap-1 cursor-default">
                            Edge %
                            <Info className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors" />
                            <span className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg border border-border/60 bg-popover p-3 text-left text-xs text-muted-foreground font-normal opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                              <span className="mb-1 block font-semibold text-foreground">What is edge %?</span>
                              Edge = model probability minus bookmaker&apos;s implied probability.
                              <span className="mt-1.5 block"><strong className="text-emerald-400">+10%</strong> — model thinks this is 10 percentage points more likely than the odds imply. Strong edge.</span>
                              <span className="mt-1 block"><strong className="text-amber-400">+5%</strong> — moderate edge. Still positive expected value.</span>
                              <span className="mt-1.5 block text-muted-foreground/70">Consistently finding positive edge is what produces long-term profitable betting.</span>
                            </span>
                          </span>
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          Stake
                        </TableHead>
                        <TableHead className="text-xs text-center">
                          Result
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((bet) => (
                        <TableRow
                          key={bet.id}
                          className={cn(
                            "border-border/30 transition-colors",
                            bet.edge * 100 >= 10 && "bg-emerald-500/5"
                          )}
                        >
                          <TableCell className="font-medium text-sm">
                            {bet.match}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {bet.league}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {bet.market}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {bet.selection}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-bold text-right">
                            {bet.odds.toFixed(2)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-right">
                            {(bet.modelProb * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="font-mono text-xs text-right text-muted-foreground">
                            {(bet.impliedProb * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell
                            className={cn(
                              "font-mono text-sm font-bold text-right",
                              edgeColor(bet.edge)
                            )}
                          >
                            +{formatEdge(bet.edge)}%
                          </TableCell>
                          <TableCell className="font-mono text-xs text-right">
                            {bet.stake.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center">
                            <ResultBadge result={bet.result} />
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={10}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No value bets match the selected filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filtered.map((bet) => (
                <Card
                  key={bet.id}
                  className={cn(
                    "border-border/50 p-4",
                    bet.edge * 100 >= 10 &&
                      "border-emerald-500/30 bg-emerald-500/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{bet.match}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{bet.league}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={cn(
                          "font-mono text-lg font-bold",
                          edgeColor(bet.edge)
                        )}
                      >
                        +{formatEdge(bet.edge)}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {bet.market}
                    </Badge>
                    <span className="text-xs font-medium">{bet.selection}</span>
                    <ResultBadge result={bet.result} />
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Model</p>
                      <p className="font-mono text-xs font-medium">
                        {(bet.modelProb * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Implied
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {(bet.impliedProb * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Odds</p>
                      <p className="font-mono text-sm font-bold">
                        {bet.odds.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Stake</p>
                      <p className="font-mono text-xs">{bet.stake.toFixed(1)}</p>
                    </div>
                  </div>
                </Card>
              ))}
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No value bets match the selected filters.
                </p>
              )}
            </div>
          </>
        )}
      </TierGate>
    </div>
  );
}
