import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { todayMatches } from "@/lib/mock-data";
import type { Match } from "@/lib/types";

export default function MatchesPage() {
  // Group matches by league
  const grouped = todayMatches.reduce<Record<string, Match[]>>(
    (acc, match) => {
      const key = match.league.name;
      if (!acc[key]) acc[key] = [];
      acc[key].push(match);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Today&apos;s Matches
          </h1>
          <p className="text-sm text-muted-foreground">April 26, 2026</p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {todayMatches.length} matches
        </Badge>
      </div>

      {/* Grouped by league */}
      {Object.entries(grouped).map(([leagueName, matches]) => {
        const league = matches[0].league;
        return (
          <section key={leagueName} className="space-y-3">
            {/* League header */}
            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
              <span className="text-lg leading-none">{league.flag}</span>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground">
                {leagueName}
              </h2>
              <span className="text-xs text-muted-foreground">
                {league.country}
              </span>
            </div>

            {/* Match cards grid */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {matches.map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="group relative flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-primary/40 hover:bg-card/80 hover:shadow-[0_0_12px_-4px] hover:shadow-primary/20"
                >
                  {/* AI badge */}
                  {match.hasDetailedData && (
                    <div className="absolute right-3 top-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                        <Sparkles className="size-3" />
                        AI Analysis
                      </span>
                    </div>
                  )}

                  {/* Teams */}
                  <div className="flex items-center justify-between gap-2 pr-20">
                    <span className="truncate font-mono text-sm font-medium text-foreground">
                      {match.homeTeam.shortName}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      vs
                    </span>
                    <span className="truncate text-right font-mono text-sm font-medium text-foreground">
                      {match.awayTeam.shortName}
                    </span>
                  </div>

                  {/* Full names */}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{match.homeTeam.name}</span>
                    <span className="truncate text-right">
                      {match.awayTeam.name}
                    </span>
                  </div>

                  {/* Kickoff */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    <span>{match.kickoff}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
