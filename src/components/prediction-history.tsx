"use client";

import { useState } from "react";
import { Check, X, Lock, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import type { ModelPredictionRow } from "@/lib/engine-data";

interface Props {
  rows: ModelPredictionRow[];
  isPro: boolean;
  isElite: boolean;
}

const FREE_VISIBLE = 20;

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

export function PredictionHistory({ rows, isPro, isElite }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(isPro ? 50 : FREE_VISIBLE);

  if (rows.length === 0) return null;

  const displayRows = expanded ? rows.slice(0, visible) : [];
  const hasMore = visible < rows.length && isPro;
  const freeLimit = !isPro && rows.length > FREE_VISIBLE;

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-muted/5 transition-colors"
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground">Prediction History</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {rows.length} settled predictions — every result, no cherry-picking
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/30">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="py-2.5 pl-4 pr-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                  <th className="py-2.5 px-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Match
                  </th>
                  <th className="py-2.5 px-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Pick
                  </th>
                  <th className="py-2.5 px-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Confidence
                  </th>
                  <th className="py-2.5 px-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Min odds
                  </th>
                  {/* Pro columns */}
                  <th className="py-2.5 px-2 text-center text-[10px] font-medium uppercase tracking-wider">
                    {isPro ? (
                      <span className="text-muted-foreground">Best odds</span>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-blue-400/70">
                        <Lock className="h-2.5 w-2.5" />
                        Best odds
                        <span className="rounded bg-blue-500/10 px-1 py-0.5 font-bold text-blue-400" style={{ fontSize: 9 }}>PRO</span>
                      </span>
                    )}
                  </th>
                  {/* Elite columns */}
                  <th className="py-2.5 px-2 text-center text-[10px] font-medium uppercase tracking-wider">
                    {isElite ? (
                      <span className="group relative inline-flex items-center gap-1 text-muted-foreground cursor-default">
                        Edge %
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 z-50 mb-2 w-60 rounded-lg border border-border/60 bg-popover p-2.5 text-left text-[10px] font-normal normal-case tracking-normal opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                          Model probability minus market implied probability. Negative = market overpriced this outcome vs our model. Bots only place bets when edge is positive.
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-emerald-400/70">
                        <Lock className="h-2.5 w-2.5" />
                        Edge %
                        <span className="rounded bg-emerald-500/10 px-1 py-0.5 font-bold text-emerald-400" style={{ fontSize: 9 }}>ELITE</span>
                      </span>
                    )}
                  </th>
                  <th className="py-2.5 pl-2 pr-4 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {displayRows.map((row) => (
                  <tr key={row.matchId} className="hover:bg-muted/10">
                    <td className="py-2.5 pl-4 pr-2 font-mono text-xs text-muted-foreground">
                      {row.date}
                    </td>
                    <td className="py-2.5 px-2 text-xs font-medium max-w-[180px] truncate">
                      {row.home} vs {row.away}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="rounded bg-white/[0.06] px-2 py-0.5 text-xs font-medium">
                        {outcomeLabel(row.modelCall)}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {confidenceBadge(row.confidence)}
                    </td>
                    {/* Min odds (worst bookmaker — free) */}
                    <td className="py-2.5 px-2 text-center font-mono text-xs text-muted-foreground/70">
                      {row.worstOddsForPick.toFixed(2)}
                    </td>
                    {/* Best odds — Pro */}
                    <td className="py-2.5 px-2 text-center">
                      {isPro ? (
                        <span className="font-mono text-xs font-medium text-foreground/80">
                          {row.bestOddsForPick.toFixed(2)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-blue-500/20 bg-blue-500/5 px-2 py-0.5 text-[10px] text-blue-400/50">
                          <Lock className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </td>
                    {/* Edge % — Elite (computed: model confidence minus implied prob from best odds) */}
                    <td className="py-2.5 px-2 text-center">
                      {isElite ? (() => {
                        const edge = row.confidence - (1 / row.bestOddsForPick);
                        const edgePct = edge * 100;
                        return (
                          <span className={`font-mono text-xs font-medium ${edgePct >= 5 ? "text-emerald-400" : edgePct >= 0 ? "text-amber-400" : "text-red-400/70"}`}>
                            {edgePct >= 0 ? "+" : ""}{edgePct.toFixed(1)}%
                          </span>
                        );
                      })() : (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[10px] text-emerald-400/50">
                          <Lock className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </td>
                    {/* Result */}
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

          {/* Free user limit banner */}
          {freeLimit && (
            <div className="border-t border-border/20 px-4 py-4 text-center space-y-2 bg-blue-500/5">
              <p className="text-xs text-muted-foreground">
                Showing {FREE_VISIBLE} of {rows.length} predictions
              </p>
              <Link
                href="/how-it-works"
                className="inline-block rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Upgrade to Pro — full history + best odds per pick
              </Link>
            </div>
          )}

          {/* Pro load more */}
          {hasMore && (
            <div className="border-t border-border/20 px-4 py-3 text-center">
              <button
                onClick={() => setVisible((v) => v + 50)}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Load more ({rows.length - visible} remaining)
              </button>
            </div>
          )}

          <div className="border-t border-border/20 px-4 py-3 text-center space-y-1">
            <p className="text-[11px] text-muted-foreground/50">
              Every prediction shown — wins and losses. No cherry-picking.
            </p>
            <p className="text-[11px] text-muted-foreground/40">
              This is the full model output. Bots only place bets on picks where edge is positive at the time of betting.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
