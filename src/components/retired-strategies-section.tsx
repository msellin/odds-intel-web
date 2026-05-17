"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RetiredBotBreakdownRow } from "@/lib/engine-data";

interface Props {
  retired: RetiredBotBreakdownRow[] | null;
}

// PERF-HONEST-HEADLINE (2026-05-17): collapsed-by-default section that surfaces
// every retired bot with its final stats + retire date + reason text. The point
// is transparency: we don't pretend the experiments that didn't work never
// happened. Default closed so the leaderboard stays the visual headline, but
// expand reveals the full story.
export function RetiredStrategiesSection({ retired }: Props) {
  const [open, setOpen] = useState(false);
  if (!retired || retired.length === 0) return null;

  // Sort: most-recently-retired first, ties broken by abs P&L (bigger story first).
  const sorted = [...retired].sort((a, b) => {
    const aDate = a.retired_at ? new Date(a.retired_at).getTime() : 0;
    const bDate = b.retired_at ? new Date(b.retired_at).getTime() : 0;
    if (bDate !== aDate) return bDate - aDate;
    return Math.abs(b.total_pnl) - Math.abs(a.total_pnl);
  });

  return (
    <Card className="border-border/50 bg-card/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/30"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">Retired Strategies ({sorted.length})</span>
          <span className="text-xs text-muted-foreground">kept for transparency</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {open ? "hide" : "show"}
        </span>
      </button>

      {open && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="space-y-3">
            {sorted.map((b) => {
              const roi = b.roi_pct;
              const roiDisplay =
                roi != null ? `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` : "—";
              const pnlDisplay = `${b.total_pnl >= 0 ? "+" : ""}€${b.total_pnl.toFixed(0)}`;
              const retiredDate = b.retired_at
                ? new Date(b.retired_at).toISOString().slice(0, 10)
                : null;
              return (
                <div
                  key={b.name}
                  className="rounded-md border border-border/40 bg-muted/20 px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-sm font-semibold">{b.name}</span>
                      {retiredDate && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          retired {retiredDate}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                      <span className="text-muted-foreground">
                        {b.settled} bets · {b.won}W
                      </span>
                      <span
                        className={
                          roi == null
                            ? "text-muted-foreground"
                            : roi >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                        }
                      >
                        {roiDisplay}
                      </span>
                      <span
                        className={
                          b.total_pnl >= 0 ? "text-emerald-400/80" : "text-red-400/80"
                        }
                      >
                        {pnlDisplay}
                      </span>
                    </div>
                  </div>
                  {b.retired_reason && (
                    <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
                      {b.retired_reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Header version exists if Card's header style was preferred; keeping for refactor headroom
export { Card, CardHeader, CardTitle };
