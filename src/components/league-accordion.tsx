"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, UserX, Activity, Minus, Zap } from "lucide-react";
import type { PublicMatch, LiveSnapshot } from "@/lib/engine-data";
import { getCountryFlag } from "@/lib/country-flags";
import { FavoriteButton } from "@/components/favorite-button";
import { MatchFavoriteButton } from "@/components/match-favorite-button";

export interface MatchValueInfo {
  topSelection: string;
  topMarket: string;
  topEdge: number;
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function OddsCell({
  value,
  move,
  highlighted = false,
  isPro = false,
}: {
  value: number;
  move?: "up" | "down" | null;
  highlighted?: boolean;
  isPro?: boolean;
}) {
  if (!value) {
    return (
      <div className="w-12 sm:w-14 text-center font-mono text-xs text-muted-foreground/40">—</div>
    );
  }
  return (
    <div
      className={`relative flex flex-col items-center justify-center w-12 sm:w-14 rounded py-0.5 sm:py-1 text-center font-mono text-xs ${
        highlighted
          ? "border border-green-500/30 bg-green-500/[0.08] text-green-300 font-medium"
          : "text-muted-foreground"
      }`}
    >
      {value.toFixed(2)}
      {/* Highlighted cell: show movement arrow inline below odds */}
      {highlighted && isPro && move === "down" && (
        <TrendingDown className="size-2.5 text-green-400 mt-0.5" />
      )}
      {highlighted && isPro && move === "up" && (
        <TrendingUp className="size-2.5 text-amber-400 mt-0.5" />
      )}
      {/* Non-highlighted: corner overlay */}
      {!highlighted && move === "up" && (
        <TrendingUp className="absolute -top-1 -right-1 size-2.5 text-green-400" />
      )}
      {!highlighted && move === "down" && (
        <TrendingDown className="absolute -top-1 -right-1 size-2.5 text-red-400" />
      )}
    </div>
  );
}

function TeamLogo({ logo, name, priority = false }: { logo: string | null; name: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initial = name.charAt(0).toUpperCase();
  const src = logo ? `/api/logo?url=${encodeURIComponent(logo)}&w=20` : null;

  if (src && !failed) {
    // LIGHTHOUSE-FIX-2 (2026-06-05): next/image instead of raw <img>. The
    // /api/logo proxy already returns a 20px-wide resized image, so we use
    // `unoptimized` to skip Next's image optimizer (no point re-optimizing
    // already-tiny logos). The framework still gives us IntersectionObserver
    // lazy-load, automatic LCP candidate exclusion (logos never qualify),
    // and proper width/height attributes preventing CLS. Expected lift:
    // +5-8 Perf points on /matches and /predictions pages (Lighthouse was
    // flagging the ~40-60 raw <img> tags per page as a missed framework
    // optimization).
    return (
      <div className="size-4 sm:size-5 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
        <Image
          src={src}
          alt={name}
          width={20}
          height={20}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          unoptimized
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

function getTeaserStyle(teaser: string): {
  color: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  const t = teaser.toLowerCase();
  if (t.includes("absences") || t.includes("injury") || t.includes("injuries")) {
    return { color: "text-red-400/70", Icon: UserX };
  }
  if (t.includes("nothing to play")) {
    return { color: "text-red-400/60", Icon: Minus };
  }
  if (t.includes("declining") || t.includes("form")) {
    return { color: "text-amber-400/70", Icon: TrendingDown };
  }
  if (t.includes("volatile") || t.includes("disagreement") || t.includes("shifted") || t.includes("odds")) {
    return { color: "text-blue-400", Icon: Activity };
  }
  return { color: "text-muted-foreground/60", Icon: Minus };
}

function fmtValueChip(market: string, selection: string): string {
  const m = market.toLowerCase();
  const s = selection.toLowerCase();
  if (m === "1x2") {
    if (s === "home") return "Home";
    if (s === "draw") return "Draw";
    if (s === "away") return "Away";
  }
  if (m === "dc") return `DC ${selection}`;
  if (m === "ou" || m === "over_under") return selection.toLowerCase().startsWith("over") ? "O2.5" : "U2.5";
  if (m === "btts") return "BTTS";
  if (m === "ah") return `AH ${selection}`;
  return selection;
}

function MatchRow({
  match,
  liveSnapshot,
  isPro,
  favoriteMatchIds,
  onMatchFavoriteToggle,
  prioritizeLogos = false,
  valueInfo,
}: {
  match: PublicMatch;
  liveSnapshot?: LiveSnapshot;
  isPro: boolean;
  favoriteMatchIds?: Set<string>;
  onMatchFavoriteToggle?: (matchId: string, isFavorited: boolean) => void;
  prioritizeLogos?: boolean;
  valueInfo?: MatchValueInfo;
}) {
  const hasOdds = match.hasOdds && (match.bestHome > 0 || match.bestDraw > 0 || match.bestAway > 0);

  const isLive = match.status === "live" && !!liveSnapshot;
  const isLiveStatus = match.status === "live";
  const isFinished = match.status === "finished";
  const isPastUnresolved = !isLive && !isFinished && new Date(match.kickoff) < new Date();
  const hasPrediction = match.predictedHome !== null && match.predictedAway !== null;

  const hasScore = isLive || (isFinished && match.score_home != null);
  const scoreHome = isLive ? liveSnapshot!.score_home : match.score_home;
  const scoreAway = isLive ? liveSnapshot!.score_away : match.score_away;

  const homeAhead = hasScore && scoreHome != null && scoreAway != null && scoreHome > scoreAway;
  const awayAhead = hasScore && scoreHome != null && scoreAway != null && scoreAway > scoreHome;

  // Bold the model-favored team for upcoming matches (use predicted score as proxy)
  const modelFavorsHome = !hasScore && match.predictedHome !== null && match.predictedAway !== null && match.predictedHome > match.predictedAway;
  const modelFavorsAway = !hasScore && match.predictedHome !== null && match.predictedAway !== null && match.predictedAway > match.predictedHome;
  const homeBold = homeAhead || modelFavorsHome;
  const awayBold = awayAhead || modelFavorsAway;

  const scoreColor = isLive ? "text-red-500" : "text-foreground";

  // Value info
  const hasValue = !!valueInfo;
  const valSel = valueInfo?.topSelection?.toLowerCase() ?? "";
  const valMkt = valueInfo?.topMarket?.toLowerCase() ?? "";
  const is1x2Value = hasValue && valMkt === "1x2";
  const isValueHome = is1x2Value && valSel === "home";
  const isValueDraw = is1x2Value && valSel === "draw";
  const isValueAway = is1x2Value && valSel === "away";
  const valueChipLabel = hasValue ? fmtValueChip(valueInfo!.topMarket, valueInfo!.topSelection) : "";

  // Signal teaser — suppress "Volatile odds market" when it's the only one
  const filteredTeasers = (match.teasers ?? []).filter(
    (t) => !(t === "Volatile odds market" && match.teasers.length === 1)
  );
  const displayTeaser = filteredTeasers[0] ?? null;
  const teaserStyle = displayTeaser ? getTeaserStyle(displayTeaser) : null;

  // "no value" — only for live matches + starred matches, Pro+ only
  const isStarred = favoriteMatchIds?.has(match.id) ?? false;
  const showNoValue = isPro && !hasValue && (isLiveStatus || isStarred) && !displayTeaser;

  const rowTint = isLiveStatus ? "bg-green-950/[0.12]" : "";

  const hasSubLine = !!(displayTeaser || showNoValue);

  return (
    <Link
      href={`/matches/${match.id}`}
      className={`group flex flex-col transition-colors hover:bg-white/[0.03] ${rowTint}`}
    >
      {/* ── MOBILE ── */}
      <div className="flex sm:hidden items-stretch pl-1 pr-1 py-2">
        {/* Left: star + time/status */}
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
              <span className="font-mono text-[13px] font-bold text-green-400 leading-none">
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

        {/* Center: team names */}
        <div className="flex flex-col justify-center gap-1 flex-1 min-w-0 ml-1">
          <div className="flex items-center gap-1.5">
            <TeamLogo logo={match.logoHome} name={match.homeTeam} priority={prioritizeLogos} />
            <span className={`truncate text-[13px] leading-[19px] ${homeBold ? "font-bold" : "font-medium"} text-foreground`}>
              {match.homeTeam}
            </span>
            {hasScore && (
              <span className={`ml-auto font-mono text-[13px] font-bold tabular-nums shrink-0 ${scoreColor}`}>
                {scoreHome}
              </span>
            )}
            {hasValue && !hasScore && (
              <span className="ml-auto flex items-center gap-0.5 rounded-full bg-green-500/15 border border-green-500/20 px-1.5 py-0.5 text-[10px] font-bold text-green-400 shrink-0">
                <Zap className="size-2.5" />
                {valueChipLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <TeamLogo logo={match.logoAway} name={match.awayTeam} priority={prioritizeLogos} />
            <span className={`truncate text-[13px] leading-[19px] ${awayBold ? "font-bold" : "font-medium"} text-foreground`}>
              {match.awayTeam}
            </span>
            {hasScore && (
              <span className={`ml-auto font-mono text-[13px] font-bold tabular-nums shrink-0 ${scoreColor}`}>
                {scoreAway}
              </span>
            )}
          </div>
        </div>

        {/* Right: odds */}
        <div className="flex items-center gap-0.5 ml-2 shrink-0">
          {hasOdds && (
            <>
              <OddsCell value={match.bestHome} move={isPro ? match.moveHome : null} highlighted={isValueHome} isPro={isPro} />
              <OddsCell value={match.bestDraw} move={isPro ? match.moveDraw : null} highlighted={isValueDraw} isPro={isPro} />
              <OddsCell value={match.bestAway} move={isPro ? match.moveAway : null} highlighted={isValueAway} isPro={isPro} />
            </>
          )}
        </div>
      </div>

      {/* Mobile sub-line */}
      {hasSubLine && (
        <div className="flex sm:hidden items-center gap-1 px-1 pb-1.5 pl-12">
          {displayTeaser && teaserStyle && (
            <span className={`flex items-center gap-1 text-[10px] ${teaserStyle.color}`}>
              <teaserStyle.Icon className="size-3 shrink-0" />
              {displayTeaser}
            </span>
          )}
          {showNoValue && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/35">
              <Minus className="size-3 shrink-0" />
              no value · model in line with market
            </span>
          )}
        </div>
      )}

      {/* ── DESKTOP ── */}
      <div className={`hidden sm:flex items-center px-4 transition-colors ${hasSubLine ? "pt-2" : "h-11"}`}>
        {favoriteMatchIds && onMatchFavoriteToggle && (
          <div className="w-5 shrink-0 flex items-center">
            <MatchFavoriteButton
              matchId={match.id}
              favoriteMatchIds={favoriteMatchIds}
              onToggle={onMatchFavoriteToggle}
            />
          </div>
        )}

        {/* Kickoff / status */}
        <div className="w-[4.5rem] shrink-0">
          {isLive ? (
            <div className="flex items-center gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-green-400 shrink-0" />
              <span className="font-mono text-[11px] font-bold text-green-400">{liveSnapshot!.minute}&apos;</span>
            </div>
          ) : isFinished ? (
            <span className="font-mono text-[10px] font-bold text-muted-foreground/50">FT</span>
          ) : isPastUnresolved ? (
            <span className="font-mono text-[10px] font-bold text-amber-500/60" suppressHydrationWarning>{formatKickoff(match.kickoff)}</span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground" suppressHydrationWarning>{formatKickoff(match.kickoff)}</span>
          )}
        </div>

        {/* Teams */}
        <div className="flex flex-1 items-center justify-center gap-2 overflow-hidden text-sm">
          <div className="flex flex-1 items-center justify-end gap-1.5 min-w-0">
            <span className={`truncate ${homeBold ? "font-bold" : "font-medium"} text-foreground`}>{match.homeTeam}</span>
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
            <span className={`truncate ${awayBold ? "font-bold" : "font-medium"} text-foreground`}>{match.awayTeam}</span>
          </div>
        </div>

        {/* Value chip or AI prediction */}
        <div className="w-20 shrink-0 flex items-center justify-center">
          {hasValue ? (
            <span className="flex items-center gap-0.5 rounded-full bg-green-500/15 border border-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400">
              <Zap className="size-2.5" />
              {valueChipLabel}
            </span>
          ) : hasPrediction ? (
            <span className="font-mono text-xs font-bold tabular-nums text-violet-400/80" title="AI predicted score">
              {match.predictedHome}–{match.predictedAway}
            </span>
          ) : null}
        </div>

        {/* Odds */}
        <div className="ml-2 shrink-0 flex items-center gap-1">
          {hasOdds ? (
            <>
              <OddsCell value={match.bestHome} move={isPro ? match.moveHome : null} highlighted={isValueHome} isPro={isPro} />
              <OddsCell value={match.bestDraw} move={isPro ? match.moveDraw : null} highlighted={isValueDraw} isPro={isPro} />
              <OddsCell value={match.bestAway} move={isPro ? match.moveAway : null} highlighted={isValueAway} isPro={isPro} />
            </>
          ) : (
            <div className="w-44 text-center font-mono text-sm text-muted-foreground/30">— — —</div>
          )}
        </div>
      </div>

      {/* Desktop sub-line */}
      {hasSubLine && (
        <div className="hidden sm:flex items-center gap-1 pl-[4.5rem] pb-1.5">
          {displayTeaser && teaserStyle && (
            <span className={`flex items-center gap-1 text-[10px] ${teaserStyle.color}`}>
              <teaserStyle.Icon className="size-3 shrink-0" />
              {displayTeaser}
            </span>
          )}
          {showNoValue && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/35">
              <Minus className="size-3 shrink-0" />
              no value · model in line with market
            </span>
          )}
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
  valueBets?: Record<string, MatchValueInfo>;
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
  valueBets = {},
}: LeagueAccordionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasPredictions = matches.some((m) => m.predictedHome !== null);
  const valueMatchCount = matches.filter((m) => valueBets[m.id]).length;

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
          {valueMatchCount > 0 ? (
            <span className="rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400">
              {valueMatchCount} value
            </span>
          ) : (
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium text-muted-foreground tabular-nums">
              {matches.length}
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
            <div className="w-[4.5rem] shrink-0 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 leading-none">
              local
            </div>
            <div className="flex-1" />
            <div className="w-20 shrink-0 text-center">
              {hasPredictions && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400/40">AI</span>
              )}
            </div>
            <div className="ml-2 shrink-0 flex items-center gap-1">
              <span className="w-12 sm:w-14 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">H</span>
              <span className="w-12 sm:w-14 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">X</span>
              <span className="w-12 sm:w-14 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">A</span>
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
              valueInfo={valueBets[match.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
