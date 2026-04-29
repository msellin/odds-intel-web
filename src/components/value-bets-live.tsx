"use client";

import { useState, useMemo } from "react";
import { Target, Info, Lock, TrendingUp } from "lucide-react";
import { BetExplainButton } from "@/components/bet-explain-button";
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
import type { LiveBet } from "@/lib/engine-data";

interface ValueBetsLiveProps {
  bets: LiveBet[];
  userTier: "free" | "pro" | "elite";
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

function edgeTier(edge: number): { label: string; color: string } {
  const pct = edge * 100;
  if (pct >= 10) return { label: "Strong edge", color: "text-emerald-500" };
  if (pct >= 5) return { label: "Moderate edge", color: "text-amber-500" };
  return { label: "Marginal edge", color: "text-muted-foreground" };
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
    <Badge variant="secondary" className="text-[10px] font-semibold uppercase">
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

// ─── Free tier: teaser only ──────────────────────────────────────────────────

function ValueBetsFreeTeaser({ bets }: { bets: LiveBet[] }) {
  const highEdge = bets.filter((b) => b.edge * 100 >= 10).length;
  const modEdge = bets.filter((b) => b.edge * 100 >= 5 && b.edge * 100 < 10).length;
  const leagues = new Set(bets.map((b) => b.league)).size;
  const maxEdge = bets.length > 0 ? Math.max(...bets.map((b) => b.edge)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-xl font-bold tracking-tight">Value Bets</h1>
          <Badge variant="secondary" className="font-mono text-xs">{bets.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          AI-identified value bets placed by the engine today
        </p>
      </div>

      {/* Summary stats — visible to free */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Total bets today</p>
          <p className="font-mono text-2xl font-bold">{bets.length}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Strong edge (10%+)</p>
          <p className="font-mono text-2xl font-bold text-emerald-500">{highEdge}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Leagues covered</p>
          <p className="font-mono text-2xl font-bold">{leagues}</p>
        </div>
      </div>

      {/* Blurred preview */}
      <div className="relative rounded-xl border border-border/50 overflow-hidden">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm px-6 text-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              {bets.length} value bet{bets.length !== 1 ? "s" : ""} found today
            </p>
            {maxEdge > 0 && (
              <p className="text-sm text-muted-foreground">
                Highest edge: <span className="text-emerald-400 font-mono font-semibold">+{formatEdge(maxEdge)}%</span>
                {modEdge > 0 && ` · ${modEdge + highEdge} above 5% edge`}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Upgrade to Pro to see which matches and direction to bet
            </p>
          </div>
          <a
            href="/profile"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Upgrade to Pro — €4.99/mo
          </a>
        </div>
        {/* Blurred sample rows */}
        <div className="pointer-events-none select-none blur-sm">
          <div className="divide-y divide-border/30">
            {bets.slice(0, 5).map((bet) => (
              <div key={bet.id} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{bet.match}</p>
                  <p className="text-xs text-muted-foreground">{bet.league}</p>
                </div>
                <div className="text-right">
                  <p className={cn("font-mono text-sm font-bold", edgeColor(bet.edge))}>
                    +{formatEdge(bet.edge)}%
                  </p>
                  <p className="text-xs text-muted-foreground">{bet.selection}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pro tier: directional view ───────────────────────────────────────────────

function ValueBetsProView({ bets }: { bets: LiveBet[] }) {
  const [league, setLeague] = useState(ALL);

  const leagues = useMemo(
    () => Array.from(new Set(bets.map((b) => b.league))).sort(),
    [bets]
  );

  const filtered = useMemo(
    () => (league !== ALL ? bets.filter((b) => b.league === league) : bets),
    [bets, league]
  );

  const highEdge = filtered.filter((b) => b.edge * 100 >= 10).length;
  const modEdge = filtered.filter((b) => b.edge * 100 >= 5 && b.edge * 100 < 10).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-xl font-bold tracking-tight">Value Bets</h1>
          <Badge variant="secondary" className="font-mono text-xs">{bets.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Today&apos;s directional picks — upgrade to Elite for exact odds, model probabilities, and stake sizing
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Total bets</p>
          <p className="font-mono text-2xl font-bold">{filtered.length}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Strong edge (10%+)</p>
          <p className="font-mono text-2xl font-bold text-emerald-500">{highEdge}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Moderate edge (5-10%)</p>
          <p className="font-mono text-2xl font-bold text-amber-500">{modEdge}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={league} onValueChange={(v) => setLeague(v ?? ALL)}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue>{league === ALL ? "All leagues" : league}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All leagues</SelectItem>
            {leagues.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered.length !== bets.length && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {bets.length} shown
          </span>
        )}
      </div>

      {/* Elite upgrade banner */}
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <TrendingUp className="h-4 w-4 text-amber-500 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="text-amber-400 font-medium">Pro shows direction only.</span>
          {" "}Upgrade to Elite for exact edge %, model probability, odds and Kelly stake sizing.
        </p>
        <a href="/profile" className="ml-auto shrink-0 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors whitespace-nowrap">
          Upgrade
        </a>
      </div>

      {/* Directional cards */}
      {bets.length === 0 ? (
        <div className="rounded-lg border border-border/50 bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No bets placed today. The model runs at 06:00 UTC — check back later.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((bet) => {
            const tier = edgeTier(bet.edge);
            return (
              <div
                key={bet.id}
                className={cn(
                  "flex items-center gap-4 rounded-lg border border-border/40 bg-card px-4 py-3",
                  bet.edge * 100 >= 10 && "border-emerald-500/20 bg-emerald-500/5"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{bet.match}</p>
                  <p className="text-xs text-muted-foreground">{bet.league}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px]">{bet.market}</Badge>
                  <span className="text-xs font-semibold text-foreground">{bet.selection}</span>
                </div>
                <div className="text-right shrink-0 w-28">
                  <p className={cn("text-xs font-semibold", tier.color)}>{tier.label}</p>
                  <p className="text-[10px] text-muted-foreground">edge hidden</p>
                </div>
                <ResultBadge result={bet.result} />
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No value bets match the selected filter.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Elite tier: full view ────────────────────────────────────────────────────

function ValueBetsEliteView({ bets }: { bets: LiveBet[] }) {
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
    totalBets > 0 ? filtered.reduce((sum, b) => sum + b.edge, 0) / totalBets : 0;
  const highestEdge = totalBets > 0 ? Math.max(...filtered.map((b) => b.edge)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-xl font-bold tracking-tight">Value Bets</h1>
          <Badge variant="secondary" className="font-mono text-xs">{bets.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Today&apos;s picks ranked by edge — placed by the engine when it finds value
        </p>
      </div>

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
          <p className={cn("font-mono text-2xl font-bold", edgeColor(highestEdge))}>
            {formatEdge(highestEdge)}%
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={league} onValueChange={(v) => setLeague(v ?? ALL)}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue>{league === ALL ? "All leagues" : league}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All leagues</SelectItem>
            {leagues.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={bot} onValueChange={(v) => setBot(v ?? ALL)}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue>{bot === ALL ? "All strategies" : formatBot(bot)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All strategies</SelectItem>
            {bots.map((b) => (
              <SelectItem key={b} value={b}>{formatBot(b)}</SelectItem>
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
            No bets placed today. The model runs at 06:00 UTC — check back later.
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
                      <TableHead className="text-xs text-right">Odds</TableHead>
                      <TableHead className="text-xs text-right">Model Prob</TableHead>
                      <TableHead className="text-xs text-right">Implied Prob</TableHead>
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
                      <TableHead className="text-xs text-right">Stake</TableHead>
                      <TableHead className="text-xs text-center">Result</TableHead>
                      <TableHead className="text-xs"></TableHead>
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
                        <TableCell className="font-medium text-sm">{bet.match}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{bet.league}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{bet.market}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{bet.selection}</TableCell>
                        <TableCell className="font-mono text-sm font-bold text-right">{bet.odds.toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-xs text-right">
                          {(bet.modelProb * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right text-muted-foreground">
                          {(bet.impliedProb * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className={cn("font-mono text-sm font-bold text-right", edgeColor(bet.edge))}>
                          +{formatEdge(bet.edge)}%
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right">{bet.stake.toFixed(1)}</TableCell>
                        <TableCell className="text-center">
                          <ResultBadge result={bet.result} />
                        </TableCell>
                        <TableCell>
                          <BetExplainButton betId={bet.id} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
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
                  bet.edge * 100 >= 10 && "border-emerald-500/30 bg-emerald-500/5"
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
                    <span className={cn("font-mono text-lg font-bold", edgeColor(bet.edge))}>
                      +{formatEdge(bet.edge)}%
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{bet.market}</Badge>
                  <span className="text-xs font-medium">{bet.selection}</span>
                  <ResultBadge result={bet.result} />
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Model</p>
                    <p className="font-mono text-xs font-medium">{(bet.modelProb * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Implied</p>
                    <p className="font-mono text-xs text-muted-foreground">{(bet.impliedProb * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Odds</p>
                    <p className="font-mono text-sm font-bold">{bet.odds.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Stake</p>
                    <p className="font-mono text-xs">{bet.stake.toFixed(1)}</p>
                  </div>
                </div>
                {/* BET-EXPLAIN: Elite-only "Why this pick?" */}
                <BetExplainButton betId={bet.id} />
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
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ValueBetsLive({ bets, userTier }: ValueBetsLiveProps) {
  if (userTier === "elite") return <ValueBetsEliteView bets={bets} />;
  if (userTier === "pro") return <ValueBetsProView bets={bets} />;
  return <ValueBetsFreeTeaser bets={bets} />;
}
