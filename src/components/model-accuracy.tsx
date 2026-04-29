"use client";

import { useState, useMemo } from "react";
import { Check, X, Info } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ModelAccuracyData, ModelPredictionRow } from "@/lib/engine-data";

const INITIAL_SHOW = 50;

const CONFIDENCE_LEVELS = [
  { value: "all", label: "All picks", min: 0 },
  { value: "medium", label: "Confident (50%+)", min: 0.5 },
  { value: "high", label: "Strong (60%+)", min: 0.6 },
];

interface Props {
  data: ModelAccuracyData;
}

function outcomeLabel(o: "home" | "draw" | "away"): string {
  return o === "home" ? "Home" : o === "draw" ? "Draw" : "Away";
}

function confidenceBadge(confidence: number) {
  if (confidence >= 0.6) {
    return (
      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
        {(confidence * 100).toFixed(0)}%
      </span>
    );
  }
  if (confidence >= 0.5) {
    return (
      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
        {(confidence * 100).toFixed(0)}%
      </span>
    );
  }
  return (
    <span className="font-mono text-xs text-muted-foreground">
      {(confidence * 100).toFixed(0)}%
    </span>
  );
}

export function ModelAccuracy({ data }: Props) {
  const { rows, stats } = data;
  const [period, setPeriod] = useState("all");
  const [confidenceLevel, setConfidenceLevel] = useState("all");
  const [visible, setVisible] = useState(INITIAL_SHOW);

  const minConfidence = CONFIDENCE_LEVELS.find((c) => c.value === confidenceLevel)?.min ?? 0;

  const filtered = useMemo(() => {
    let result = rows;
    if (period !== "all") {
      const days = parseInt(period);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      result = result.filter((r) => r.date >= cutoffStr);
    }
    if (minConfidence > 0) {
      result = result.filter((r) => r.confidence >= minConfidence);
    }
    return result;
  }, [rows, period, minConfidence]);

  const filteredStats = useMemo(() => {
    const total = filtered.length;
    const correct = filtered.filter((r) => r.correct).length;
    const hitRate = total > 0 ? (correct / total) * 100 : 0;
    const byOutcome = {
      home: { total: 0, correct: 0 },
      draw: { total: 0, correct: 0 },
      away: { total: 0, correct: 0 },
    };
    for (const r of filtered) {
      byOutcome[r.modelCall].total++;
      if (r.correct) byOutcome[r.modelCall].correct++;
    }
    return { total, correct, hitRate, byOutcome };
  }, [filtered]);

  const visibleRows = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Model Predictions</h1>
          <p className="text-sm text-muted-foreground">
            Full transparency — every prediction, every result. No cherry-picking.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit font-mono">
          {stats.total} predictions tracked
        </Badge>
      </div>

      {/* Confidence explanation banner */}
      <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/40 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
        <p className="text-xs text-muted-foreground">
          These are <strong className="text-foreground/80">pure statistical predictions</strong> — the model picks the most probable outcome (Home / Draw / Away) based on historical data, form, and head-to-head records. No bookmaker odds comparison.{" "}
          <Link href="/how-it-works" className="text-primary underline-offset-2 hover:underline">
            Pro and Elite tiers
          </Link>{" "}
          add value bet detection on top — showing you exactly where the bookmakers have mispriced the odds.
        </p>
      </div>

      {filteredStats.total === 0 && stats.total === 0 ? (
        <div className="rounded-lg border border-border/50 bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No settled predictions yet — check back after today&apos;s matches complete.
          </p>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-border/50 bg-card/80">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Predictions
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <span className="font-mono text-xl font-bold tabular-nums">
                  {filteredStats.total}
                </span>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/80">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Correct
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <span className="font-mono text-xl font-bold tabular-nums text-emerald-400">
                  {filteredStats.correct}
                </span>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/80">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Hit Rate
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <span className={`font-mono text-xl font-bold tabular-nums ${
                  filteredStats.hitRate >= 45
                    ? "text-emerald-400"
                    : filteredStats.hitRate >= 33
                    ? "text-amber-400"
                    : "text-red-400"
                }`}>
                  {filteredStats.total > 0 ? `${filteredStats.hitRate.toFixed(1)}%` : "—"}
                </span>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/80">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  vs Random
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <span className={`font-mono text-xl font-bold tabular-nums ${
                  filteredStats.total > 0 && filteredStats.hitRate > 33 ? "text-emerald-400" : "text-muted-foreground"
                }`}>
                  {filteredStats.total > 0
                    ? `${filteredStats.hitRate - 33 >= 0 ? "+" : ""}${(filteredStats.hitRate - 33).toFixed(1)}%`
                    : "—"}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* By outcome breakdown */}
          <div className="grid grid-cols-3 gap-3">
            {(["home", "draw", "away"] as const).map((o) => {
              const s = filteredStats.byOutcome[o];
              const rate = s.total > 0 ? (s.correct / s.total) * 100 : 0;
              return (
                <div key={o} className="rounded-xl border border-border/50 bg-card/40 px-4 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {outcomeLabel(o)} win
                  </p>
                  <p className={`mt-1 font-mono text-lg font-bold ${rate >= 45 ? "text-emerald-400" : rate >= 33 ? "text-amber-400" : "text-muted-foreground"}`}>
                    {s.total > 0 ? `${rate.toFixed(0)}%` : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {s.correct}/{s.total} correct
                  </p>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={period} onValueChange={(v) => { if (v) { setPeriod(v); setVisible(INITIAL_SHOW); } }}>
              <SelectTrigger className="w-[140px] text-xs">
                <SelectValue placeholder="Time period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <Select value={confidenceLevel} onValueChange={(v) => { if (v) { setConfidenceLevel(v); setVisible(INITIAL_SHOW); } }}>
                <SelectTrigger className="w-[180px] text-xs">
                  <SelectValue placeholder="Confidence level" />
                </SelectTrigger>
                <SelectContent>
                  {CONFIDENCE_LEVELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Tooltip */}
              <div className="group relative">
                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors" />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-lg border border-border/60 bg-popover p-3 text-xs text-muted-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                  <p className="mb-1.5 font-semibold text-foreground">What does confidence mean?</p>
                  <p className="mb-2">This is the model&apos;s raw statistical probability — how sure the algorithm is that this outcome is most likely, based on historical data and form.</p>
                  <p className="mb-1.5">
                    <span className="text-emerald-400 font-medium">Strong (60%+)</span> — model is highly certain. Hit rates are historically higher in this tier.
                  </p>
                  <p className="mb-2">
                    <span className="text-amber-400 font-medium">Confident (50%+)</span> — model leans clearly toward this outcome.
                  </p>
                  <p className="border-t border-border/40 pt-2 text-muted-foreground/70">
                    Pro & Elite tiers layer value bet detection on top — identifying where the bookmakers have underpriced the probability.{" "}
                    <span className="text-primary">See how it works →</span>
                  </p>
                </div>
              </div>
            </div>

            {(filtered.length !== rows.length) && (
              <span className="text-xs text-muted-foreground">
                {filtered.length} of {rows.length} predictions
              </span>
            )}
          </div>

          {filteredStats.total === 0 ? (
            <div className="rounded-lg border border-border/50 bg-card px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No predictions match this filter combination.
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <Card className="overflow-hidden border-border/50 bg-card/80">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="py-2.5 pl-4 pr-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Date
                        </th>
                        <th className="py-2.5 px-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Match
                        </th>
                        <th className="py-2.5 px-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                          League
                        </th>
                        <th className="py-2.5 px-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Model called
                        </th>
                        <th className="py-2.5 px-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Confidence
                        </th>
                        <th className="py-2.5 px-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Actual
                        </th>
                        <th className="py-2.5 pl-2 pr-4 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Result
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {visibleRows.map((row: ModelPredictionRow) => (
                        <tr key={row.matchId} className="hover:bg-muted/10">
                          <td className="py-2.5 pl-4 pr-2 font-mono text-xs text-muted-foreground">
                            {row.date}
                          </td>
                          <td className="py-2.5 px-2 text-xs font-medium max-w-[180px] truncate">
                            {row.home} vs {row.away}
                          </td>
                          <td className="py-2.5 px-2 text-xs text-muted-foreground hidden sm:table-cell max-w-[160px] truncate">
                            {row.league}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="rounded bg-white/[0.06] px-2 py-0.5 text-xs font-medium">
                              {outcomeLabel(row.modelCall)}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {confidenceBadge(row.confidence)}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="text-xs text-muted-foreground">
                              {outcomeLabel(row.actual)}
                            </span>
                          </td>
                          <td className="py-2.5 pl-2 pr-4 text-center">
                            {row.correct ? (
                              <Check className="mx-auto h-4 w-4 text-emerald-400" />
                            ) : (
                              <X className="mx-auto h-4 w-4 text-red-400/60" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hasMore && (
                  <div className="border-t border-border/20 px-4 py-3 text-center">
                    <button
                      onClick={() => setVisible((v) => v + INITIAL_SHOW)}
                      className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Load more ({filtered.length - visible} remaining)
                    </button>
                  </div>
                )}
              </Card>

              <div className="flex flex-col items-center gap-2 border-t border-border/30 pt-4">
                <p className="text-center text-xs text-muted-foreground/70">
                  Every prediction shown — wins and losses. No cherry-picking.
                </p>
                <Link
                  href="/how-it-works"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  How does the model work, and what do Pro & Elite add? →
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
