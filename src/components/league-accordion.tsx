"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Info } from "lucide-react";
import type { PublicMatch, LiveSnapshot } from "@/lib/engine-data";
import { getCountryFlag } from "@/lib/country-flags";
import { FavoriteButton } from "@/components/favorite-button";
import { MatchFavoriteButton } from "@/components/match-favorite-button";

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OddsCell({
  value,
  isBest,
  move,
}: {
  value: number;
  isBest: boolean;
  move?: "up" | "down" | null;
}) {
  if (!value) {
    return (
      <div className="w-11 sm:w-14 text-center font-mono text-xs text-muted-foreground/40">
        —
      </div>
    );
  }
  return (
    <div
      className={`relative w-11 sm:w-14 rounded py-0.5 sm:py-1 text-center font-mono text-xs ${
        isBest
          ? "bg-green-500/15 text-white font-semibold"
          : "text-muted-foreground"
      }`}
    >
      {value.toFixed(2)}
      {move === "up" && (
        <TrendingUp className="absolute -top-1 -right-1 size-2.5 text-green-400" />
      )}
      {move === "down" && (
        <TrendingDown className="absolute -top-1 -right-1 size-2.5 text-red-400" />
      )}
    </div>
  );
}

// Team logo — small circle with initials fallback (16px on mobile, 20px on desktop)
function TeamLogo({ logo, name }: { logo: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = name.charAt(0).toUpperCase();

  if (logo && !failed) {
    return (
      <div className="relative size-4 sm:size-5 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
        <Image
          src={logo}
          alt={name}
          fill
          sizes="20px"
          className="object-contain p-0.5"
          loading="lazy"
          unoptimized
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="size-4 sm:size-5 shrink-0 rounded-full bg-white/[0.08] flex items-center justify-center">
      <span className="text-[7px] sm:text-[8px] font-bold text-muted-foreground">{initial}</span>
    </div>
  );
}

// Form dots — last 5 results as coloured dots
function FormStrip({ form }: { form: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {form.split("").map((char, i) => (
        <span
          key={i}
          className={`inline-block size-1.5 rounded-full ${
            char === "W" ? "bg-green-500" : char === "D" ? "bg-amber-500" : "bg-red-500/70"
          }`}
          title={char === "W" ? "Win" : char === "D" ? "Draw" : "Loss"}
        />
      ))}
    </div>
  );
}

const GRADE_STYLES = {
  A: "bg-green-500/20 text-green-400",
  B: "bg-amber-500/20 text-amber-500",
  D: "bg-white/[0.06] text-muted-foreground/50",
} as const;

function MatchRow({
  match,
  liveSnapshot,
  isPro,
  favoriteMatchIds,
  onMatchFavoriteToggle,
}: {
  match: PublicMatch;
  liveSnapshot?: LiveSnapshot;
  isPro: boolean;
  favoriteMatchIds?: Set<string>;
  onMatchFavoriteToggle?: (matchId: string, isFavorited: boolean) => void;
}) {
  const hasOdds = match.hasOdds && (match.bestHome > 0 || match.bestDraw > 0 || match.bestAway > 0);

  const bestIsHome = hasOdds && match.bestHome >= match.bestDraw && match.bestHome >= match.bestAway;
  const bestIsDraw = hasOdds && match.bestDraw > match.bestHome && match.bestDraw >= match.bestAway;
  const bestIsAway = hasOdds && !bestIsHome && !bestIsDraw;

  const isLive = match.status === "live" && !!liveSnapshot;
  const isFinished = match.status === "finished";
  const isPastUnresolved = !isLive && !isFinished && new Date(match.kickoff) < new Date();
  const hasTeasers = (match.teasers?.length ?? 0) > 0;
  const hasPrediction = match.predictedHome !== null && match.predictedAway !== null;
  const hasForm = match.formHome != null && match.formAway != null;

  return (
    <Link
      href={`/matches/${match.id}`}
      className={`group flex flex-col px-3 sm:px-4 transition-colors hover:bg-white/[0.03] ${(hasTeasers || hasForm) ? "py-2 sm:py-1.5" : "py-2 sm:py-0 sm:h-11 sm:justify-center"}`}
    >
      {/* Main row — single line on all sizes */}
      <div className="flex items-center">
        {/* Per-match star — margin-only width */}
        {favoriteMatchIds && onMatchFavoriteToggle && (
          <div className="w-5 shrink-0 flex items-center">
            <MatchFavoriteButton
              matchId={match.id}
              favoriteMatchIds={favoriteMatchIds}
              onToggle={onMatchFavoriteToggle}
            />
          </div>
        )}

        {/* Grade badge — compact, tucked into left margin */}
        <div className="w-6 sm:w-8 shrink-0 flex items-center gap-0.5">
          {match.dataGrade ? (
            <span
              className={`inline-block rounded px-0.5 sm:px-1 text-[8px] sm:text-[9px] font-bold leading-4 ${GRADE_STYLES[match.dataGrade]}`}
              title={`Data grade ${match.dataGrade} — ${match.dataGrade === "A" ? "full data coverage" : match.dataGrade === "B" ? "good data coverage" : "limited data"}${match.signalCount ? ` · ${match.signalCount} signals` : ""}`}
            >
              {match.dataGrade}
            </span>
          ) : (
            <span className="inline-block w-3 sm:w-4" />
          )}
          {match.pulse === "high-alert" && (
            <span className="text-[9px] text-orange-400 leading-none" title="Sharp activity or market divergence">
              ⚡
            </span>
          )}
        </div>

        {/* Kickoff time / LIVE / FT — compact */}
        <div className="w-12 sm:w-[4.5rem] shrink-0">
          {isLive ? (
            <div className="flex items-center gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-green-400 shrink-0" />
              <span className="font-mono text-[10px] font-bold text-green-400">
                {liveSnapshot!.minute}&apos;
              </span>
            </div>
          ) : isFinished ? (
            <span className="font-mono text-[10px] font-bold text-muted-foreground/50">
              FT
            </span>
          ) : isPastUnresolved ? (
            <span className="font-mono text-[10px] font-bold text-amber-500/60" suppressHydrationWarning>
              {formatKickoff(match.kickoff)}
            </span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground" suppressHydrationWarning>
              {formatKickoff(match.kickoff)}
            </span>
          )}
        </div>

        {/* Teams — left-aligned block taking ~60% on mobile */}
        <div className="flex flex-1 items-center justify-center gap-1.5 sm:gap-2 overflow-hidden text-sm min-w-0">
          <div className="flex flex-1 items-center justify-end gap-1 sm:gap-1.5 min-w-0">
            <span className="truncate font-medium text-foreground text-xs sm:text-sm">
              {match.homeTeam}
            </span>
            <TeamLogo logo={match.logoHome} name={match.homeTeam} />
          </div>
          {isLive ? (
            <span className="w-9 sm:w-10 shrink-0 text-center font-mono text-xs sm:text-sm font-bold tabular-nums text-foreground">
              {liveSnapshot!.score_home}&thinsp;–&thinsp;{liveSnapshot!.score_away}
            </span>
          ) : isFinished && match.score_home != null ? (
            <span className="w-9 sm:w-10 shrink-0 text-center font-mono text-xs sm:text-sm font-bold tabular-nums text-foreground">
              {match.score_home}&thinsp;–&thinsp;{match.score_away}
            </span>
          ) : (
            <span className="w-9 sm:w-10 shrink-0 text-center text-[9px] font-bold tracking-widest text-muted-foreground/30">
              VS
            </span>
          )}
          <div className="flex flex-1 items-center gap-1 sm:gap-1.5 min-w-0">
            <TeamLogo logo={match.logoAway} name={match.awayTeam} />
            <span className="truncate font-medium text-foreground text-xs sm:text-sm">
              {match.awayTeam}
            </span>
          </div>
        </div>

        {/* AI predicted score — desktop only */}
        <div className="hidden sm:block w-14 shrink-0 text-center">
          {hasPrediction ? (
            <span className="font-mono text-xs font-bold tabular-nums text-violet-400/80" title="AI predicted score">
              {match.predictedHome}–{match.predictedAway}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/20">—</span>
          )}
        </div>

        {/* Odds — visible on ALL sizes, right-aligned */}
        <div className="flex ml-1 sm:ml-2 shrink-0 items-center gap-0.5 sm:gap-1">
          {isPastUnresolved ? (
            <div className="w-[8.5rem] sm:w-44 text-center font-mono text-[9px] sm:text-[10px] text-amber-500/50">
              pending
            </div>
          ) : hasOdds ? (
            <>
              <OddsCell value={match.bestHome} isBest={bestIsHome} move={isPro ? match.moveHome : null} />
              <OddsCell value={match.bestDraw} isBest={bestIsDraw} move={isPro ? match.moveDraw : null} />
              <OddsCell value={match.bestAway} isBest={bestIsAway} move={isPro ? match.moveAway : null} />
            </>
          ) : (
            <div className="w-[8.5rem] sm:w-44 text-center font-mono text-xs text-muted-foreground/30">
              — — —
            </div>
          )}
        </div>

        {/* Desktop bookmaker count */}
        {hasOdds && match.bookmakerCount > 1 && (
          <span className="hidden sm:inline ml-1 text-[9px] font-bold text-muted-foreground/30 tabular-nums" title={`${match.bookmakerCount} bookmakers`}>
            {match.bookmakerCount}
          </span>
        )}

        <div className="ml-0.5 sm:ml-1 shrink-0">
          <ChevronRight className="size-3.5 sm:size-4 text-muted-foreground/20 transition-colors group-hover:text-green-500" />
        </div>
      </div>

      {/* SUX-3: Free-tier signal teasers */}
      {hasTeasers && (
        <div className="flex gap-3 pl-6 sm:pl-8 mt-0.5">
          {match.teasers.map((teaser, i) => (
            <span key={i} className="text-[10px] italic text-muted-foreground/50">
              {teaser}
            </span>
          ))}
        </div>
      )}

      {/* Form strips */}
      {hasForm && (
        <div className="flex items-center gap-2 pl-6 sm:pl-8 mt-0.5">
          <div className="flex flex-1 items-center justify-end gap-1.5">
            <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wide">form</span>
            <FormStrip form={match.formHome!} />
          </div>
          <div className="w-[2.5rem] shrink-0" />
          <div className="flex flex-1 items-center gap-1.5">
            <FormStrip form={match.formAway!} />
          </div>
        </div>
      )}
    </Link>
  );
}

interface LeagueAccordionProps {
  league: string;
  matches: PublicMatch[];
  defaultExpanded: boolean;
  liveSnapshots?: Record<string, LiveSnapshot>;
  isPro: boolean;
  favoriteMatchIds?: Set<string>;
  onMatchFavoriteToggle?: (matchId: string, isFavorited: boolean) => void;
}

export function LeagueAccordion({
  league,
  matches,
  defaultExpanded,
  liveSnapshots,
  isPro,
  favoriteMatchIds,
  onMatchFavoriteToggle,
}: LeagueAccordionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasOdds = matches.some((m) => m.hasOdds);
  const oddsCount = matches.filter((m) => m.hasOdds).length;
  const hasPredictions = matches.some((m) => m.predictedHome !== null);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-card/40">
      {/* League header — compact, left-aligned name, right-aligned meta */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
        className="flex h-10 sm:h-12 w-full cursor-pointer items-center justify-between bg-muted/30 px-3 sm:px-4 transition-colors hover:bg-muted/50"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-sm sm:text-base leading-none shrink-0">{getCountryFlag(league)}</span>
          <span className="text-[10px] sm:text-xs font-black tracking-widest text-foreground uppercase truncate">
            {league}
          </span>
          <FavoriteButton value={league} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium text-muted-foreground tabular-nums">
            {matches.length}
          </span>
          {hasOdds && (
            <span className="text-xs sm:text-sm" title={`Odds available — ${oddsCount} match${oddsCount === 1 ? "" : "es"} with bookmaker data`}>
              🔥
            </span>
          )}
          {expanded ? (
            <ChevronDown className="size-3.5 sm:size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 sm:size-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Match rows */}
      {expanded && (
        <div className="divide-y divide-white/[0.06]">
          {/* Column header — desktop only */}
          <div className="hidden sm:flex items-center px-4 py-1.5 bg-muted/10">
            {favoriteMatchIds && onMatchFavoriteToggle && <div className="w-5 shrink-0" />}
            <div className="w-8 shrink-0" />
            <div className="w-[4.5rem] shrink-0 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 leading-none">
              local
            </div>
            <div className="flex-1" />
            <div className="w-14 shrink-0 text-center">
              {hasPredictions && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400/40">
                  AI
                </span>
              )}
            </div>
            <div className="ml-2 shrink-0 flex items-center gap-1">
              <span className="w-14 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">H</span>
              <span className="w-14 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">X</span>
              <span className="w-14 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">A</span>
              <div className="group relative ml-1 w-4">
                <Info className="size-3 cursor-help text-muted-foreground/30 transition-colors hover:text-muted-foreground/60" />
                <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg border border-border/60 bg-popover p-3 text-xs text-muted-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                  <p className="mb-1.5 font-semibold text-foreground">Best available odds</p>
                  <p className="mb-2"><strong className="text-foreground/80">H / X / A</strong> — Home win, Draw, Away win (decimal odds).</p>
                  <p className="mb-1.5">These are the <strong className="text-foreground/80">highest odds available</strong> across all bookmakers we track. Green = best value option.</p>
                  <p className="text-muted-foreground/70">Higher odds = better return per euro staked. 2.00 means you double your stake; 1.50 means 50% profit.</p>
                </div>
              </div>
            </div>
            <div className="ml-1 w-4 shrink-0" />
          </div>
          {matches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              liveSnapshot={liveSnapshots?.[match.id]}
              isPro={isPro}
              favoriteMatchIds={favoriteMatchIds}
              onMatchFavoriteToggle={onMatchFavoriteToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
