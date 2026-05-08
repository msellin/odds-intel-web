"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PublicMatch, LiveSnapshot } from "@/lib/engine-data";
import { MatchScoreDisplay } from "@/components/match-score-display";

function TeamLogo({ logo, name, size = "lg" }: { logo: string | null; name: string; size?: "sm" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const initial = name.charAt(0).toUpperCase();
  const px = size === "lg" ? "size-10 sm:size-12" : "size-6";
  const textSize = size === "lg" ? "text-sm" : "text-[8px]";

  if (logo && !failed) {
    return (
      <div className={`relative ${px} shrink-0 overflow-hidden rounded-full bg-white/[0.06]`}>
        <Image
          src={logo}
          alt={name}
          fill
          sizes={size === "lg" ? "48px" : "24px"}
          className="object-contain p-0.5"
          loading="eager"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${px} shrink-0 rounded-full bg-white/[0.08] flex items-center justify-center`}>
      <span className={`${textSize} font-bold text-muted-foreground`}>{initial}</span>
    </div>
  );
}

const GRADE_STYLES = {
  A: "bg-green-500/20 text-green-400 border-green-500/30",
  B: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  C: "bg-white/[0.06] text-muted-foreground/50 border-white/[0.08]",
} as const;

interface MatchDetailHeaderProps {
  match: PublicMatch;
  initialSnapshot: LiveSnapshot | null;
}

export function MatchDetailHeader({ match, initialSnapshot }: MatchDetailHeaderProps) {
  const hasPrediction = match.predictedHome !== null && match.predictedAway !== null;
  const isFinished = match.status === "finished";
  const hasOdds = !isFinished && match.hasOdds && (match.bestHome > 0 || match.bestDraw > 0 || match.bestAway > 0);

  const kickoffDate = new Date(match.kickoff);
  const dateStr = kickoffDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="space-y-3">
      {/* Breadcrumb + grade badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/matches" className="hover:text-foreground transition-colors">
            Matches
          </Link>
          <span>/</span>
          <span className="text-foreground/70 truncate">{match.league}</span>
        </div>
        {match.dataGrade && (
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold ${GRADE_STYLES[match.dataGrade]}`}>
            Grade {match.dataGrade}
          </span>
        )}
      </div>

      {/* Score hero */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 py-2">
        <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
          <TeamLogo logo={match.logoHome} name={match.homeTeam} />
          <span className="text-[11px] sm:text-sm font-medium text-foreground text-center leading-tight">
            {match.homeTeam}
          </span>
        </div>

        <div className="flex flex-col items-center shrink-0">
          <MatchScoreDisplay
            matchId={match.id}
            status={match.status}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
            finishedScoreHome={match.score_home ?? null}
            finishedScoreAway={match.score_away ?? null}
            initialSnapshot={initialSnapshot}
            compact
          />
          <span className="text-[10px] text-muted-foreground mt-1" suppressHydrationWarning>
            {dateStr}
          </span>
          {match.venue_name && (
            <span className="text-[9px] text-muted-foreground/40 mt-0.5">{match.venue_name}</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
          <TeamLogo logo={match.logoAway} name={match.awayTeam} />
          <span className="text-[11px] sm:text-sm font-medium text-foreground text-center leading-tight max-w-[110px] sm:max-w-none">
            {match.awayTeam}
          </span>
        </div>
      </div>

      {/* AI Prediction + Compact Odds row */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {hasPrediction && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/10 border border-violet-500/20 px-2 py-1 text-[11px] font-bold text-violet-400">
            AI {match.predictedHome}–{match.predictedAway}
          </span>
        )}
        {hasOdds && (
          <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <span className="rounded bg-white/[0.04] px-2 py-1">{match.bestHome.toFixed(2)}</span>
            <span className="rounded bg-white/[0.04] px-2 py-1">{match.bestDraw.toFixed(2)}</span>
            <span className="rounded bg-white/[0.04] px-2 py-1">{match.bestAway.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
