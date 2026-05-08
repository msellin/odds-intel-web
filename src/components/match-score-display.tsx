"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { LiveSnapshot } from "@/lib/engine-data";

interface Props {
  matchId: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  finishedScoreHome: number | null;
  finishedScoreAway: number | null;
  initialSnapshot: LiveSnapshot | null;
  /** Compact mode: score + status only, no team names (used in new header with logos) */
  compact?: boolean;
}

export function MatchScoreDisplay({
  matchId,
  status,
  homeTeam,
  awayTeam,
  finishedScoreHome,
  finishedScoreAway,
  initialSnapshot,
  compact,
}: Props) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(initialSnapshot);
  const isLive = status === "live";

  useEffect(() => {
    if (!isLive) return;
    const supabase = createSupabaseBrowser();
    const channel = supabase
      .channel(`score-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_match_snapshots",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => setSnapshot(payload.new as LiveSnapshot)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [matchId, isLive]);

  // ── Compact mode: score + status badge only ──
  if (compact) {
    if (isLive && snapshot) {
      return (
        <div className="flex flex-col items-center">
          <span className="font-mono text-3xl font-bold text-red-500 tabular-nums">
            {snapshot.score_home}&thinsp;–&thinsp;{snapshot.score_away}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded bg-green-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400 mt-1">
            <span className="size-1.5 animate-pulse rounded-full bg-green-400" />
            LIVE {snapshot.minute}&apos;
          </span>
        </div>
      );
    }
    if (finishedScoreHome != null && finishedScoreAway != null) {
      return (
        <div className="flex flex-col items-center">
          <span className="font-mono text-3xl font-bold text-foreground tabular-nums">
            {finishedScoreHome}&thinsp;–&thinsp;{finishedScoreAway}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground/50 mt-1">FT</span>
        </div>
      );
    }
    return (
      <span className="text-sm font-bold tracking-widest text-muted-foreground/40">VS</span>
    );
  }

  // ── Full mode (legacy — used on desktop or fallback) ──

  // Live match with a snapshot
  if (isLive && snapshot) {
    return (
      <div className="flex items-center gap-4 mb-2">
        <span className="text-lg font-semibold text-foreground">{homeTeam}</span>
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-3xl font-bold text-foreground tabular-nums">
            {snapshot.score_home}&thinsp;–&thinsp;{snapshot.score_away}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded bg-green-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">
            <span className="size-1.5 animate-pulse rounded-full bg-green-400" />
            LIVE {snapshot.minute}&apos;
          </span>
        </div>
        <span className="text-lg font-semibold text-foreground">{awayTeam}</span>
      </div>
    );
  }

  // Finished match
  if (finishedScoreHome != null && finishedScoreAway != null) {
    return (
      <div className="flex items-center gap-4 mb-2">
        <span className="text-lg font-semibold text-foreground">{homeTeam}</span>
        <span className="font-mono text-3xl font-bold text-foreground tabular-nums">
          {finishedScoreHome} – {finishedScoreAway}
        </span>
        <span className="text-lg font-semibold text-foreground">{awayTeam}</span>
      </div>
    );
  }

  // Pre-match
  return (
    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
      {homeTeam}{" "}
      <span className="text-muted-foreground font-normal">vs</span>{" "}
      {awayTeam}
    </h1>
  );
}
