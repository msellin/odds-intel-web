"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
import type { ValueBet } from "@/lib/types";

interface ValueBetsClientProps {
  bets: ValueBet[];
}

const ALL = "__all__";

export function ValueBetsClient({ bets }: ValueBetsClientProps) {
  const [league, setLeague] = useState(ALL);
  const [market, setMarket] = useState(ALL);
  const [confidence, setConfidence] = useState(ALL);

  const leagues = useMemo(
    () => Array.from(new Set(bets.map((b) => b.league))).sort(),
    [bets],
  );

  const filtered = useMemo(() => {
    return bets.filter((b) => {
      if (league !== ALL && b.league !== league) return false;
      if (market !== ALL && b.market !== market) return false;
      if (confidence !== ALL && b.confidence !== confidence) return false;
      return true;
    });
  }, [bets, league, market, confidence]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={league} onValueChange={(v) => setLeague(v ?? ALL)}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue>{league === ALL ? "All leagues" : league}</SelectValue>
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

        <Select value={market} onValueChange={(v) => setMarket(v ?? ALL)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue>{market === ALL ? "All markets" : market}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All markets</SelectItem>
            <SelectItem value="1X2">1X2</SelectItem>
            <SelectItem value="O/U 2.5">O/U 2.5</SelectItem>
            <SelectItem value="BTTS">BTTS</SelectItem>
          </SelectContent>
        </Select>

        <Select value={confidence} onValueChange={(v) => setConfidence(v ?? ALL)}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue>
              {confidence === ALL ? "All confidence" : confidence.charAt(0).toUpperCase() + confidence.slice(1)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All confidence</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {filtered.length !== bets.length && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {bets.length} shown
          </span>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Card className="overflow-hidden border-border/50">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-xs">Match</TableHead>
                  <TableHead className="text-xs">League</TableHead>
                  <TableHead className="text-xs">Kickoff</TableHead>
                  <TableHead className="text-xs">Market</TableHead>
                  <TableHead className="text-xs">Selection</TableHead>
                  <TableHead className="text-xs text-right">Model</TableHead>
                  <TableHead className="text-xs text-right">Implied</TableHead>
                  <TableHead className="text-xs text-right">Edge %</TableHead>
                  <TableHead className="text-xs text-right">Odds</TableHead>
                  <TableHead className="text-xs">Bookmaker</TableHead>
                  <TableHead className="text-xs text-center">Conf</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((bet) => (
                  <TableRow
                    key={bet.id}
                    className={cn(
                      "border-border/30 transition-colors",
                      bet.edgePercent >= 8 && "bg-emerald-500/5",
                    )}
                  >
                    <TableCell className="font-medium">
                      <Link
                        href={`/matches/${bet.matchId}`}
                        className="hover:text-primary hover:underline"
                      >
                        {bet.homeTeam} vs {bet.awayTeam}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {bet.league}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {bet.kickoff}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {bet.market}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {bet.selection}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right">
                      {(bet.modelProbability * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right text-muted-foreground">
                      {(bet.impliedProbability * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-mono text-sm font-bold text-right",
                        bet.edgePercent >= 8
                          ? "text-emerald-500"
                          : bet.edgePercent >= 5
                            ? "text-amber-500"
                            : "text-muted-foreground",
                      )}
                    >
                      +{bet.edgePercent.toFixed(1)}%
                    </TableCell>
                    <TableCell className="font-mono text-sm font-bold text-right">
                      {bet.currentOdds.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {bet.bookmaker}
                    </TableCell>
                    <TableCell className="text-center">
                      <ConfidenceBadge confidence={bet.confidence} />
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={11}
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
              bet.edgePercent >= 8 && "border-emerald-500/30 bg-emerald-500/5",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/matches/${bet.matchId}`}
                  className="text-sm font-medium hover:text-primary hover:underline"
                >
                  {bet.homeTeam} vs {bet.awayTeam}
                </Link>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{bet.league}</span>
                  <span className="font-mono">{bet.kickoff}</span>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={cn(
                    "font-mono text-lg font-bold",
                    bet.edgePercent >= 8
                      ? "text-emerald-500"
                      : bet.edgePercent >= 5
                        ? "text-amber-500"
                        : "text-muted-foreground",
                  )}
                >
                  +{bet.edgePercent.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {bet.market}
              </Badge>
              <span className="text-xs font-medium">{bet.selection}</span>
              <ConfidenceBadge confidence={bet.confidence} />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Model</p>
                <p className="font-mono text-xs font-medium">
                  {(bet.modelProbability * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Implied</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {(bet.impliedProbability * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Odds</p>
                <p className="font-mono text-sm font-bold">
                  {bet.currentOdds.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Book</p>
                <p className="text-xs">{bet.bookmaker}</p>
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
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  return (
    <Badge
      className={cn(
        "text-[10px] font-medium",
        confidence === "high" &&
          "border-emerald-500/50 bg-emerald-500/10 text-emerald-500",
        confidence === "medium" &&
          "border-amber-500/50 bg-amber-500/10 text-amber-500",
        confidence === "low" &&
          "border-border bg-muted/50 text-muted-foreground",
      )}
      variant="outline"
    >
      {confidence}
    </Badge>
  );
}
