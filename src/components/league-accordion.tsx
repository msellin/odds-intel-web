"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
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
  move,
}: {
  value: number;
  move?: "up" | "down" | null;
}) {
  if (!value) {
    return (
      <div className="w-12 sm:w-14 text-center font-mono text-xs text-muted-foreground/40">
        —
      </div>
    );
  }
  return (
    <div className="relative w-12 sm:w-14 rounded py-0.5 sm:py-1 text-center font-mono text-xs text-muted-foreground">
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

// Team logo — 16px on mobile, 20px on desktop
function TeamLogo({ logo, name, priority = false }: { logo: string | null; name: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initial = name.charAt(0).toUpperCase();
  const src = logo ? `/api/logo?url=${encodeURIComponent(logo)}&w=20` : null;

  if (src && !failed) {
    return (
      <div className="size-4 sm:size-5 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
        <img
          src={src}
          alt={name}
          width={20}
          height={20}
          loading={priority ? "eager" : "lazy"}
          className="size-full object-contain p-0.5"
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
  C: "bg-white/[0.06] text-muted-foreground/50",
} as const;

function MatchRow({
  match,
  liveSnapshot,
  isPro,
  favoriteMatchIds,
  onMatchFavoriteToggle,
  prioritizeLogos = false,
}: {
  match: PublicMatch;
  liveSnapshot?: LiveSnapshot;
  isPro: boolean;
  favoriteMatchIds?: Set<string>;
  onMatchFavoriteToggle?: (matchId: string, isFavorited: boolean) => void;
  prioritizeLogos?: boolean;
}) {
  const hasOdds = match.hasOdds && (match.bestHome > 0 || match.bestDraw > 0 || match.bestAway > 0);

  const isLive = match.status === "live" && !!liveSnapshot;
  const isFinished = match.status === "finished";
  const isPastUnresolved = !isLive && !isFinished && new Date(match.kickoff) < new Date();
  const hasTeasers = (match.teasers?.length ?? 0) > 0;
  const hasPrediction = match.predictedHome !== null && match.predictedAway !== null;
  const hasForm = match.formHome != null && match.formAway != null;

  const hasScore = isLive || (isFinished && match.score_home != null);
  const scoreHome = isLive ? liveSnapshot!.score_home : match.score_home;
  const scoreAway = isLive ? liveSnapshot!.score_away : match.score_away;

  // Determine which team is ahead (for bold styling)
  const homeAhead = hasScore && scoreHome != null && scoreAway != null && scoreHome > scoreAway;
  const awayAhead = hasScore && scoreHome != null && scoreAway != null && scoreAway > scoreHome;

  // Live scores get red color like Flashscore
  const scoreColor = isLive ? "text-red-500" : "text-foreground";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="group flex flex-col transition-colors hover:bg-white/[0.03]"
    >
      {/* ── MOBILE: two-line stacked layout ── */}
      <div className="flex sm:hidden items-stretch pl-1 pr-1 py-2">
        {/* Left column: star + time/status */}
        <div className="flex flex-col items-center justify-center w-10 shrink-0 gap-1">
          {favoriteMatchIds && onMatchFavoriteToggle && (
            <MatchFavoriteButton
              matchId={match.id}
              favoriteMatchIds={favoriteMatchIds}
              onToggle={onMatchFavoriteToggle}
            />
          )}
          {isLive ? (
            <div className="flex flex-col items-center gap-0.5">
              <span className="size-1.5 animate-pulse rounded-full bg-green-400" />
              <span className="font-mono text-[10px] font-bold text-green-400 leading-none">
                {liveSnapshot!.minute}&apos;
              </span>
            </div>
          ) : isFinished ? (
            <span className="font-mono text-[10px] font-bold text-muted-foreground/50">FT</span>
          ) : isPastUnresolved ? (
            <span className="font-mono text-[10px] font-bold text-amber-500/60" suppressHydrationWarning>
              {formatKickoff(match.kickoff)}
            </span>
          ) : (
            <span className="font-mono text-[11px] text-muted-foreground" suppressHydrationWarning>
              {formatKickoff(match.kickoff)}
            </span>
          )}
        </div>

        {/* Center: stacked team names */}
        <div className="flex flex-col justify-center gap-1 flex-1 min-w-0 ml-1">
          {/* Home team row */}
          <div className="flex items-center gap-1.5">
            <TeamLogo logo={match.logoHome} name={match.homeTeam} priority={prioritizeLogos} />
            <span className={`truncate text-[13px] leading-[19px] ${homeAhead ? "font-bold" : "font-medium"} text-foreground`}>{match.homeTeam}</span>
            {hasScore && (
              <span className={`ml-auto font-mono text-[13px] font-bold tabular-nums shrink-0 ${scoreColor}`}>
                {scoreHome}
              </span>
            )}
          </div>
          {/* Away team row */}
          <div className="flex items-center gap-1.5">
            <TeamLogo logo={match.logoAway} name={match.awayTeam} priority={prioritizeLogos} />
            <span className={`truncate text-[13px] leading-[19px] ${awayAhead ? "font-bold" : "font-medium"} text-foreground`}>{match.awayTeam}</span>
            {hasScore && (
              <span className={`ml-auto font-mono text-[13px] font-bold tabular-nums shrink-0 ${scoreColor}`}>
                {scoreAway}
              </span>
            )}
          </div>
        </div>

        {/* Right: odds columns */}
        <div className="flex items-center gap-0.5 ml-2 shrink-0">
          {hasOdds ? (
            <>
              <OddsCell value={match.bestHome} move={isPro ? match.moveHome : null} />
              <OddsCell value={match.bestDraw} move={isPro ? match.moveDraw : null} />
              <OddsCell value={match.bestAway} move={isPro ? match.moveAway : null} />
            </>
          ) : null}
        </div>
      </div>

      {/* Mobile teasers */}
      {hasTeasers && (
        <div className="flex sm:hidden gap-3 px-1 pb-1.5 pl-12">
          {match.teasers.map((teaser, i) => (
            <span key={i} className="text-[10px] italic text-muted-foreground/80">{teaser}</span>
          ))}
        </div>
      )}

      {/* ── DESKTOP: single-line layout ── */}
      <div className={`hidden sm:flex items-center px-4 transition-colors ${(hasTeasers || hasForm) ? "py-1.5" : "h-11"}`}>
        {favoriteMatchIds && onMatchFavoriteToggle && (
          <div className="w-5 shrink-0 flex items-center">
            <MatchFavoriteButton
              matchId={match.id}
              favoriteMatchIds={favoriteMatchIds}
              onToggle={onMatchFavoriteToggle}
            />
          </div>
        )}

        {/* Grade badge */}
        <div className="w-8 shrink-0 flex items-center gap-0.5">
          {match.dataGrade ? (
            <span
              className={`inline-block rounded px-1 text-[9px] font-bold leading-4 ${GRADE_STYLES[match.dataGrade]}`}
              title={`Data grade ${match.dataGrade} — ${match.dataGrade === "A" ? "full data coverage" : match.dataGrade === "B" ? "good data coverage" : "limited data"}${match.signalCount ? ` · ${match.signalCount} signals` : ""}`}
            >
              {match.dataGrade}
            </span>
          ) : (
            <span className="inline-block w-4" />
          )}
          {match.pulse === "high-alert" && (
            <span className="text-[9px] text-orange-400 leading-none" title="Sharp activity or market divergence">⚡</span>
          )}
        </div>

        {/* Kickoff / status */}
        <div className="w-[4.5rem] shrink-0">
          {isLive ? (
            <div className="flex items-center gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-green-400 shrink-0" />
              <span className="font-mono text-[10px] font-bold text-green-400">{liveSnapshot!.minute}&apos;</span>
            </div>
          ) : isFinished ? (
            <span className="font-mono text-[10px] font-bold text-muted-foreground/50">FT</span>
          ) : isPastUnresolved ? (
            <span className="font-mono text-[10px] font-bold text-amber-500/60" suppressHydrationWarning>{formatKickoff(match.kickoff)}</span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground" suppressHydrationWarning>{formatKickoff(match.kickoff)}</span>
          )}
        </div>

        {/* Teams inline */}
        <div className="flex flex-1 items-center justify-center gap-2 overflow-hidden text-sm">
          <div className="flex flex-1 items-center justify-end gap-1.5 min-w-0">
            <span className={`truncate ${homeAhead ? "font-bold" : "font-medium"} text-foreground`}>{match.homeTeam}</span>
            <TeamLogo logo={match.logoHome} name={match.homeTeam} priority={prioritizeLogos} />
          </div>
          {hasScore ? (
            <span className={`w-10 shrink-0 text-center font-mono text-sm font-bold tabular-nums ${scoreColor}`}>
              {scoreHome}&thinsp;–&thinsp;{scoreAway}
            </span>
          ) : (
            <span className="w-10 shrink-0 text-center text-[9px] font-bold tracking-widest text-muted-foreground/30">VS</span>
          )}
          <div className="flex flex-1 items-center gap-1.5 min-w-0">
            <TeamLogo logo={match.logoAway} name={match.awayTeam} priority={prioritizeLogos} />
            <span className={`truncate ${awayAhead ? "font-bold" : "font-medium"} text-foreground`}>{match.awayTeam}</span>
          </div>
        </div>

        {/* AI predicted score */}
        <div className="w-14 shrink-0 text-center">
          {hasPrediction ? (
            <span className="font-mono text-xs font-bold tabular-nums text-violet-400/80" title="AI predicted score">
              {match.predictedHome}–{match.predictedAway}
            </span>
          ) : null}
        </div>

        {/* Odds */}
        <div className="ml-2 shrink-0 flex items-center gap-1">
          {hasOdds ? (
            <>
              <OddsCell value={match.bestHome} move={isPro ? match.moveHome : null} />
              <OddsCell value={match.bestDraw} move={isPro ? match.moveDraw : null} />
              <OddsCell value={match.bestAway} move={isPro ? match.moveAway : null} />
            </>
          ) : (
            <div className="w-44 text-center font-mono text-sm text-muted-foreground/30">— — —</div>
          )}
        </div>
      </div>

      {/* Desktop teasers */}
      {hasTeasers && (
        <div className="hidden sm:flex gap-3 pl-8 pb-1">
          {match.teasers.map((teaser, i) => (
            <span key={i} className="text-[10px] italic text-muted-foreground/80">{teaser}</span>
          ))}
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
  prioritizeFirstLogos?: boolean;
}

export function LeagueAccordion({
  league,
  matches,
  defaultExpanded,
  liveSnapshots,
  isPro,
  favoriteMatchIds,
  onMatchFavoriteToggle,
  prioritizeFirstLogos = false,
}: LeagueAccordionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasPredictions = matches.some((m) => m.predictedHome !== null);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-card/40">
      {/* League header */}
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400/40">AI</span>
              )}
            </div>
            <div className="ml-2 shrink-0 flex items-center gap-1">
              <span className="w-14 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">H</span>
              <span className="w-14 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">X</span>
              <span className="w-14 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">A</span>
            </div>
          </div>
          {matches.map((match, i) => (
            <MatchRow
              key={match.id}
              match={match}
              liveSnapshot={liveSnapshots?.[match.id]}
              isPro={isPro}
              favoriteMatchIds={favoriteMatchIds}
              onMatchFavoriteToggle={onMatchFavoriteToggle}
              prioritizeLogos={prioritizeFirstLogos && i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
