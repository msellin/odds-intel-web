"use client";

/**
 * TodayPicksPreview — shows today's model picks as "pending" rows.
 *
 * The "Best Odds" and "Kelly Stake" columns are intentionally absent from the
 * API response for these rows (not fetched, not mocked). We render the columns
 * as grayed locked placeholders to demonstrate what Pro/Elite would surface in
 * real-time, before the match ends.
 *
 * After a match settles it moves into ModelAccuracy (the settled history table)
 * where the real historical odds are revealed — so users can see the counterfactual.
 */

import { Lock, Clock, TrendingUp } from "lucide-react";
import type { TodayPick } from "@/lib/engine-data";

interface Props {
  picks: TodayPick[];
}

const FLAT_STAKE = 10;

function outcomeLabel(o: "home" | "draw" | "away"): string {
  return o === "home" ? "Home" : o === "draw" ? "Draw" : "Away";
}

function confidenceColor(c: number) {
  if (c >= 0.6) return "text-emerald-400 bg-emerald-500/10";
  if (c >= 0.5) return "text-amber-400 bg-amber-500/10";
  return "text-muted-foreground bg-white/[0.04]";
}

function formatKickoff(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function TodayPicksPreview({ picks }: Props) {
  if (picks.length === 0) return null;

  return (
    <div className="space-y-4 rounded-xl border border-border/50 bg-card/60 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <h2 className="text-base font-semibold text-foreground">
              Today&apos;s picks — {picks.length} pending
            </h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            These are today&apos;s model predictions before the matches settle.
            Pro shows you the <strong className="text-foreground/80">best available odds</strong> right
            now so you can act before the game starts. After each match settles, the real
            odds are revealed in the history table below — so you can see exactly what the edge
            was worth.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border/30">
        <table className="w-full min-w-[580px] text-xs">
          <thead>
            <tr className="border-b border-border/30 bg-card/40">
              <th className="py-2 pl-4 pr-2 text-left font-medium uppercase tracking-wider text-muted-foreground text-[10px]">
                Kickoff
              </th>
              <th className="py-2 px-2 text-left font-medium uppercase tracking-wider text-muted-foreground text-[10px]">
                Match
              </th>
              <th className="py-2 px-2 text-center font-medium uppercase tracking-wider text-muted-foreground text-[10px]">
                Pick
              </th>
              <th className="py-2 px-2 text-center font-medium uppercase tracking-wider text-muted-foreground text-[10px]">
                Conf
              </th>
              <th className="py-2 px-2 text-center font-medium uppercase tracking-wider text-muted-foreground text-[10px]">
                Flat stake
              </th>
              <th className="py-2 px-2 text-center font-medium uppercase tracking-wider text-[10px]">
                <span className="flex items-center justify-center gap-1 text-blue-400/70">
                  <Lock className="h-2.5 w-2.5" />
                  Best odds
                  <span className="rounded bg-blue-500/10 px-1 py-0.5 font-bold text-blue-400" style={{ fontSize: 9 }}>PRO</span>
                </span>
              </th>
              <th className="py-2 pl-2 pr-4 text-center font-medium uppercase tracking-wider text-[10px]">
                <span className="flex items-center justify-center gap-1 text-emerald-400/70">
                  <Lock className="h-2.5 w-2.5" />
                  Kelly stake
                  <span className="rounded bg-emerald-500/10 px-1 py-0.5 font-bold text-emerald-400" style={{ fontSize: 9 }}>ELITE</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {picks.map((pick) => (
              <tr key={pick.matchId} className="hover:bg-muted/5">
                {/* Kickoff */}
                <td className="py-2.5 pl-4 pr-2 font-mono text-muted-foreground">
                  {formatKickoff(pick.kickoff)}
                </td>

                {/* Match */}
                <td className="py-2.5 px-2 max-w-[180px]">
                  <p className="font-medium truncate text-foreground/90">{pick.home} vs {pick.away}</p>
                  <p className="text-[10px] text-muted-foreground/60 truncate">{pick.league}</p>
                </td>

                {/* Pick */}
                <td className="py-2.5 px-2 text-center">
                  <span className="rounded bg-white/[0.06] px-2 py-0.5 font-medium">
                    {outcomeLabel(pick.modelCall)}
                  </span>
                </td>

                {/* Confidence */}
                <td className="py-2.5 px-2 text-center">
                  <span className={`rounded px-2 py-0.5 font-medium ${confidenceColor(pick.confidence)}`}>
                    {(pick.confidence * 100).toFixed(0)}%
                  </span>
                </td>

                {/* Flat stake — free data */}
                <td className="py-2.5 px-2 text-center font-mono text-foreground/80">
                  €{FLAT_STAKE}
                </td>

                {/* Best odds — locked (not in API response) */}
                <td className="py-2.5 px-2 text-center">
                  <span className="inline-flex items-center gap-1 rounded border border-blue-500/20 bg-blue-500/5 px-2 py-0.5 text-[10px] text-blue-400/50">
                    <Lock className="h-2.5 w-2.5" />
                    hidden
                  </span>
                </td>

                {/* Kelly stake — locked (not in API response) */}
                <td className="py-2.5 pl-2 pr-4 text-center">
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[10px] text-emerald-400/50">
                    <Lock className="h-2.5 w-2.5" />
                    hidden
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer explainer */}
      <div className="flex flex-col gap-2 rounded-lg border border-border/30 bg-card/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          <p className="text-[11px] text-muted-foreground">
            Once each match settles, scroll down to the history table — the best odds and Kelly calculation
            are revealed, showing you exactly what edge was available before the game.
          </p>
        </div>
        <a
          href="/how-it-works"
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Get real-time odds →
        </a>
      </div>
    </div>
  );
}
