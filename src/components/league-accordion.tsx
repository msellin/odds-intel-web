"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PublicMatch } from "@/lib/engine-data";
import { getCountryFlag } from "@/lib/country-flags";

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

function MatchRow({ match }: { match: PublicMatch }) {
  const hasOdds = match.hasOdds && (match.bestHome > 0 || match.bestDraw > 0 || match.bestAway > 0);

  // Determine which odds is best (highest = best value for punter)
  const bestIsHome = hasOdds && match.bestHome >= match.bestDraw && match.bestHome >= match.bestAway;
  const bestIsDraw = hasOdds && match.bestDraw > match.bestHome && match.bestDraw >= match.bestAway;
  const bestIsAway = hasOdds && !bestIsHome && !bestIsDraw;

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

      {/* Kickoff time */}
      <div className="w-14 shrink-0 font-mono text-xs text-muted-foreground">
        {formatKickoff(match.kickoff)}
      </div>

      {/* Teams */}
      <div className="flex flex-1 items-center justify-center gap-2 overflow-hidden px-2 text-sm">
        <span className="flex-1 truncate text-right font-medium text-foreground">
          {match.homeTeam}
        </span>
        <span className="shrink-0 text-[10px] font-bold text-muted-foreground/60">
          VS
        </span>
        <span className="flex-1 truncate text-left font-medium text-foreground">
          {match.awayTeam}
        </span>
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

      {/* Arrow */}
      <div className="ml-2 shrink-0">
        <ChevronRight className="size-4 text-muted-foreground/30 transition-colors group-hover:text-green-500" />
      </div>
    </Link>
  );
}

interface LeagueAccordionProps {
  league: string;
  matches: PublicMatch[];
  defaultExpanded: boolean;
}

export function LeagueAccordion({
  league,
  matches,
  defaultExpanded,
}: LeagueAccordionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasOdds = matches.some((m) => m.hasOdds);
  const oddsCount = matches.filter((m) => m.hasOdds).length;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-card/40">
      {/* League header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex h-12 w-full items-center justify-between bg-muted/30 px-4 transition-colors hover:bg-muted/50"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="text-base leading-none">{getCountryFlag(league)}</span>
          <span className="text-xs font-black tracking-widest text-foreground uppercase">
            {league}
          </span>
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
      </button>

      {/* Match rows */}
      {expanded && (
        <div className="divide-y divide-white/[0.04]">
          {matches.map((match) => (
            <MatchRow key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
