"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import type { PublicMatch, LiveSnapshot } from "@/lib/engine-data";
import { getCountryFlag } from "@/lib/country-flags";
import { FavoriteButton } from "@/components/favorite-button";

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Tallinn",
  });
}

function OddsCell({
  value,
  isBest,
}: {
  value: number;
  isBest: boolean;
}) {
  if (!value) {
    return (
      <div className="w-14 text-center font-mono text-sm text-muted-foreground">
        —
      </div>
    );
  }
  return (
    <div
      className={`w-14 rounded py-1 text-center font-mono text-sm ${
        isBest
          ? "bg-green-500/10 text-green-400"
          : "text-muted-foreground"
      }`}
    >
      {value.toFixed(2)}
    </div>
  );
}

function MatchRow({ match, liveSnapshot }: { match: PublicMatch; liveSnapshot?: LiveSnapshot }) {
  const hasOdds = match.hasOdds && (match.bestHome > 0 || match.bestDraw > 0 || match.bestAway > 0);

  // Determine which odds is best (highest = best value for punter)
  const bestIsHome = hasOdds && match.bestHome >= match.bestDraw && match.bestHome >= match.bestAway;
  const bestIsDraw = hasOdds && match.bestDraw > match.bestHome && match.bestDraw >= match.bestAway;
  const bestIsAway = hasOdds && !bestIsHome && !bestIsDraw;

  const isLive = match.status === "live" && !!liveSnapshot;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="group flex h-10 items-center gap-0 px-4 transition-colors hover:bg-white/[0.03]"
    >
      {/* Interest indicator */}
      <div className="w-5 shrink-0 text-xs">
        {match.hasOdds ? (
          <span className="text-orange-400">🔥</span>
        ) : (
          <span className="text-transparent select-none">🔥</span>
        )}
      </div>

      {/* Kickoff time or live score */}
      <div className="w-[4.5rem] shrink-0">
        {isLive ? (
          <div className="flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-green-400 leading-none">
              <span className="size-1.5 animate-pulse rounded-full bg-green-400" />
              LIVE
            </span>
            <span className="font-mono text-[10px] text-muted-foreground leading-none">
              {liveSnapshot!.minute}&apos;
            </span>
          </div>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">
            {formatKickoff(match.kickoff)}
          </span>
        )}
      </div>

      {/* Teams — with live score inline when live */}
      <div className="flex flex-1 items-center justify-center gap-2 overflow-hidden px-2 text-sm">
        <div className="flex flex-1 items-center justify-end gap-1">
          <span className="truncate font-medium text-foreground">
            {match.homeTeam}
          </span>
        </div>
        {isLive ? (
          <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
            {liveSnapshot!.score_home}&thinsp;–&thinsp;{liveSnapshot!.score_away}
          </span>
        ) : (
          <span className="shrink-0 text-[10px] font-bold text-muted-foreground/60">
            VS
          </span>
        )}
        <div className="flex flex-1 items-center gap-1">
          <span className="truncate font-medium text-foreground">
            {match.awayTeam}
          </span>
        </div>
      </div>

      {/* Odds */}
      <div className="ml-4 flex shrink-0 items-center gap-1">
        {hasOdds ? (
          <>
            <OddsCell value={match.bestHome} isBest={bestIsHome} />
            <OddsCell value={match.bestDraw} isBest={bestIsDraw} />
            <OddsCell value={match.bestAway} isBest={bestIsAway} />
          </>
        ) : (
          <div className="w-44 text-center font-mono text-sm text-muted-foreground/40">
            — — —
          </div>
        )}
      </div>

      <div className="ml-1 shrink-0">
        <ChevronRight className="size-4 text-muted-foreground/30 transition-colors group-hover:text-green-500" />
      </div>
    </Link>
  );
}

interface LeagueAccordionProps {
  league: string;
  matches: PublicMatch[];
  defaultExpanded: boolean;
  liveSnapshots?: Record<string, LiveSnapshot>;
}

export function LeagueAccordion({
  league,
  matches,
  defaultExpanded,
  liveSnapshots,
}: LeagueAccordionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasOdds = matches.some((m) => m.hasOdds);
  const oddsCount = matches.filter((m) => m.hasOdds).length;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-card/40">
      {/* League header */}
      {/* League header – uses a div+onClick instead of <button> to avoid nesting buttons (FavoriteButton) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
        className="flex h-12 w-full cursor-pointer items-center justify-between bg-muted/30 px-4 transition-colors hover:bg-muted/50"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="text-base leading-none">{getCountryFlag(league)}</span>
          <span className="text-xs font-black tracking-widest text-foreground uppercase">
            {league}
          </span>
          <FavoriteButton value={league} />
          <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
          </span>
          {hasOdds && (
            <span className="text-sm" title={`${oddsCount} with odds`}>
              🔥
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
      </div>

      {/* Match rows */}
      {expanded && (
        <div className="divide-y divide-white/[0.04]">
          {/* C-2: Odds column header with tooltip */}
          <div className="flex items-center px-4 py-1.5 bg-muted/10">
            <div className="w-5 shrink-0" />
            <div className="w-[4.5rem] shrink-0" />
            <div className="flex-1" />
            <div className="ml-4 flex shrink-0 items-center gap-1">
              <div className="flex w-44 items-center justify-center gap-1">
                <span className="w-14 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">H</span>
                <span className="w-14 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">X</span>
                <span className="w-14 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">A</span>
              </div>
              <div className="group relative ml-1 w-4">
                <Info className="size-3 cursor-help text-muted-foreground/25 transition-colors hover:text-muted-foreground/50" />
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
