"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ModelAccuracyData, TrackRecordStats } from "@/lib/engine-data";

interface Props {
  accuracy: ModelAccuracyData;
  trackStats: TrackRecordStats;
}

export function EarlyResults({ accuracy, trackStats }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { stats } = accuracy;

  if (stats.total === 0) return null;

  const clvStr = trackStats.avgClv != null
    ? `${trackStats.avgClv >= 0 ? "+" : ""}${(trackStats.avgClv * 100).toFixed(1)}%`
    : "Pending";
  const clvPositive = trackStats.avgClv != null && trackStats.avgClv > 0;

  const rows = [
    {
      metric: "Predictions settled",
      value: String(stats.total),
      context: "500+ needed for significance",
    },
    {
      metric: "1x2 accuracy",
      value: `${stats.hitRate.toFixed(1)}%`,
      context: "Random baseline: 33.3%",
    },
    {
      metric: "Avg CLV on bets",
      value: clvStr,
      context: "Positive = edge confirmed",
    },
    {
      metric: "Value bets placed",
      value: String(trackStats.totalValueBets),
      context: `Avg edge: ${trackStats.avgEdge.toFixed(1)}%`,
    },
  ];

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-muted/5 transition-colors"
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground">Early Results</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {stats.total} predictions · {stats.hitRate.toFixed(0)}% accuracy (vs 33% random) · CLV: {clvStr}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/30 px-5 py-4 space-y-4">
          {/* Metrics table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="pb-2 text-left font-medium uppercase tracking-wider text-muted-foreground/60 text-[10px]">Metric</th>
                  <th className="pb-2 text-right font-medium uppercase tracking-wider text-muted-foreground/60 text-[10px]">Value</th>
                  <th className="pb-2 text-right font-medium uppercase tracking-wider text-muted-foreground/60 text-[10px]">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {rows.map((row) => (
                  <tr key={row.metric}>
                    <td className="py-2 text-muted-foreground">{row.metric}</td>
                    <td className={`py-2 text-right font-mono font-medium ${
                      row.metric === "Avg CLV on bets" && trackStats.avgClv != null
                        ? clvPositive ? "text-emerald-400" : "text-red-400"
                        : row.metric === "1x2 accuracy" && stats.hitRate > 33
                        ? "text-emerald-400"
                        : "text-foreground"
                    }`}>
                      {row.value}
                    </td>
                    <td className="py-2 text-right text-muted-foreground/50">{row.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By-outcome breakdown */}
          <div className="grid grid-cols-3 gap-2">
            {(["home", "draw", "away"] as const).map((o) => {
              const s = stats.byOutcome[o];
              const rate = s.total > 0 ? (s.correct / s.total) * 100 : 0;
              return (
                <div key={o} className="rounded-lg border border-border/30 bg-card/40 px-3 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    {o === "home" ? "Home" : o === "draw" ? "Draw" : "Away"}
                  </p>
                  <p className={`mt-0.5 font-mono text-sm font-bold ${rate >= 45 ? "text-emerald-400" : rate >= 33 ? "text-amber-400" : "text-muted-foreground"}`}>
                    {s.total > 0 ? `${rate.toFixed(0)}%` : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50">
                    {s.correct}/{s.total}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground/50 text-center">
            Results are volatile at this sample size. CLV and edge % are more reliable indicators.
          </p>
        </div>
      )}
    </div>
  );
}
