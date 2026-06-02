"use client";

/**
 * Thin client polling wrapper for the live WP pill.
 *
 * Strategy:
 *   - SSR renders the initial pill inside <WinProbabilityChart />.
 *   - This component hydrates underneath the SVG and polls
 *     `/api/matches/[id]/wp` every 60s.
 *   - It re-renders ONLY the "Live: …" line — the SVG curve stays static
 *     between full page revalidations (Next.js will pick up the new
 *     snapshot on the next navigation). For v1 that's acceptable; a future
 *     iteration can swap in incremental SVG updates.
 */

import { useEffect, useState } from "react";

interface PillState {
  homePct: number;
  drawPct: number;
  awayPct: number;
  minute: number;
  scoreHome: number;
  scoreAway: number;
}

interface Props {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  initial: PillState | null;
}

export function WinProbabilityChartLive({ matchId, homeTeam, awayTeam, initial }: Props) {
  const [pill, setPill] = useState<PillState | null>(initial);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(`/api/matches/${matchId}/wp`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          minute: number;
          homeProb: number;
          drawProb: number;
          awayProb: number;
          scoreHome: number;
          scoreAway: number;
        };
        if (cancelled) return;
        setPill({
          homePct: Math.round(json.homeProb * 100),
          drawPct: Math.round(json.drawProb * 100),
          awayPct: Math.round(json.awayProb * 100),
          minute: json.minute,
          scoreHome: json.scoreHome,
          scoreAway: json.scoreAway,
        });
      } catch {
        // Silently ignore — stale data is fine.
      }
    }

    // Kick once immediately so the pill catches up quickly after hydration.
    tick();
    const id = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [matchId]);

  if (!pill) return null;

  return (
    <div className="text-[10px] font-mono text-muted-foreground/80 flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/40">
      <span className="text-muted-foreground/60">Live:</span>
      <span className="text-emerald-400">{homeTeam.split(" ").slice(-1)[0]} {pill.homePct}%</span>
      <span className="text-muted-foreground/60">·</span>
      <span className="text-muted-foreground">Draw {pill.drawPct}%</span>
      <span className="text-muted-foreground/60">·</span>
      <span className="text-purple-400">{awayTeam.split(" ").slice(-1)[0]} {pill.awayPct}%</span>
      <span className="ml-auto text-muted-foreground/50">
        {pill.minute}&apos; · {pill.scoreHome}-{pill.scoreAway}
      </span>
    </div>
  );
}
