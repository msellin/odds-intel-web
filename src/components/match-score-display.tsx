"use client";

import { useState, useEffect, useCallback } from "react";
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
}

export function MatchScoreDisplay({
  matchId,
  status,
  homeTeam,
  awayTeam,
  finishedScoreHome,
  finishedScoreAway,
  initialSnapshot,
}: Props) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(initialSnapshot);
  const isLive = status === "live";

  const fetchSnapshot = useCallback(async () => {
    const supabase = createSupabaseBrowser();
    const { data } = await supabase
      .from("live_match_snapshots")
      .select("match_id, score_home, score_away, minute, captured_at")
      .eq("match_id", matchId)
      .order("captured_at", { ascending: false })
      .limit(1)
      .single();
    if (data) setSnapshot(data as LiveSnapshot);
  }, [matchId]);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(fetchSnapshot, 60_000);
    return () => clearInterval(id);
  }, [isLive, fetchSnapshot]);

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
