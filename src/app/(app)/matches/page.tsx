import Link from "next/link";
import { Suspense } from "react";
import { Clock, CalendarDays, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getTodayOdds } from "@/lib/engine-data";
import { getCountryFlag } from "@/lib/country-flags";
import { LeagueFilter } from "@/components/league-filter";
import type { LiveMatch } from "@/lib/engine-data";

function TierBadge({ tier }: { tier: number }) {
  if (tier === 1) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
        T1
      </span>
    );
  }
  if (tier === 2) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
        T2
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
      T3
    </span>
  );
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Tallinn",
  });
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface MatchesPageProps {
  searchParams: Promise<{ leagues?: string; tier?: string }>;
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const params = await searchParams;
  const allMatches = await getTodayOdds();

  // Build league info for the filter
  const leagueMap = new Map<string, number>();
  for (const m of allMatches) {
    if (!leagueMap.has(m.league)) {
      leagueMap.set(m.league, m.tier);
    }
  }
  const allLeagues = Array.from(leagueMap.entries()).map(([name, tier]) => ({
    name,
    tier,
  }));

  // Filter matches based on search params
  let filtered = allMatches;

  if (params.leagues) {
    const selectedSet = new Set(params.leagues.split(",").filter(Boolean));
    filtered = filtered.filter((m) => selectedSet.has(m.league));
  }

  if (params.tier && params.tier !== "all") {
    const tierNum = parseInt(params.tier);
    filtered = filtered.filter((m) => m.tier === tierNum);
  }

  // Group by league
  const grouped = new Map<string, LiveMatch[]>();
  for (const match of filtered) {
    const existing = grouped.get(match.league) ?? [];
    existing.push(match);
    grouped.set(match.league, existing);
  }

  // Sort matches within each group by kickoff
  for (const matches of grouped.values()) {
    matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  // Sort league groups: tier first, then alphabetically
  const sortedGroups = Array.from(grouped.entries()).sort(([aLeague, aMatches], [bLeague, bMatches]) => {
    const tierDiff = aMatches[0].tier - bMatches[0].tier;
    if (tierDiff !== 0) return tierDiff;
    return aLeague.localeCompare(bLeague);
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Today&apos;s Matches
            </h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-3.5" />
              {formatDate()}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="w-fit">
          {filtered.length} match{filtered.length !== 1 ? "es" : ""}
        </Badge>
      </div>

      {/* League filter */}
      {allLeagues.length > 0 && (
        <Suspense fallback={null}>
          <LeagueFilter leagues={allLeagues} />
        </Suspense>
      )}

      {/* Empty state */}
      {sortedGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/50 bg-card py-16">
          <div className="rounded-full bg-muted p-4">
            <SearchX className="size-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              No matches found for today
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Check back tomorrow or adjust your league filters above to see
              available matches.
            </p>
          </div>
        </div>
      )}

      {/* Grouped by league */}
      {sortedGroups.map(([league, matches]) => (
        <section key={league} className="space-y-3">
          {/* League header */}
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <span className="text-lg leading-none">
              {getCountryFlag(league)}
            </span>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground">
              {league}
            </h2>
            <TierBadge tier={matches[0].tier} />
            <span className="ml-auto text-xs text-muted-foreground">
              {matches.length} match{matches.length !== 1 ? "es" : ""}
            </span>
          </div>

          {/* Match cards grid */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MatchCard({ match }: { match: LiveMatch }) {
  const bestOdds = [match.bestHome, match.bestDraw, match.bestAway];
  const maxOdd = Math.max(...bestOdds);

  return (
    <Link
      href={`/matches/${match.id}`}
      className="group relative flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-primary/40 hover:bg-card/80 hover:shadow-[0_0_15px_-4px] hover:shadow-primary/20"
    >
      {/* Tier badge in corner */}
      <div className="absolute right-3 top-3">
        <TierBadge tier={match.tier} />
      </div>

      {/* Teams */}
      <div className="pr-10">
        <p className="text-sm font-bold text-foreground truncate">
          {match.homeTeam}
        </p>
        <p className="text-xs text-muted-foreground my-0.5">vs</p>
        <p className="text-sm font-bold text-foreground truncate">
          {match.awayTeam}
        </p>
      </div>

      {/* Kickoff */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3" />
        <span>{formatKickoff(match.kickoff)}</span>
      </div>

      {/* Best odds row */}
      {match.bestHome > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs">
          <OddsCell label="H" value={match.bestHome} isBest={match.bestHome === maxOdd} />
          <span className="text-muted-foreground/40">|</span>
          <OddsCell label="D" value={match.bestDraw} isBest={match.bestDraw === maxOdd} />
          <span className="text-muted-foreground/40">|</span>
          <OddsCell label="A" value={match.bestAway} isBest={match.bestAway === maxOdd} />
        </div>
      )}
    </Link>
  );
}

function OddsCell({
  label,
  value,
  isBest,
}: {
  label: string;
  value: number;
  isBest: boolean;
}) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-muted-foreground">{label}:</span>
      <span className={isBest ? "text-emerald-400 font-semibold" : "text-foreground"}>
        {value.toFixed(2)}
      </span>
    </span>
  );
}
