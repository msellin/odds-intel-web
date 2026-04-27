import Link from "next/link";
import { Suspense } from "react";
import { Clock, CalendarDays, SearchX, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPublicMatches } from "@/lib/engine-data";
import { getCountryFlag } from "@/lib/country-flags";
import { interestScore, interestIndicator } from "@/lib/match-utils";
import { LeagueFilter } from "@/components/league-filter";
import { createSupabaseServer } from "@/lib/supabase-server";
import type { PublicMatch } from "@/lib/engine-data";

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
  searchParams: Promise<{ leagues?: string; view?: string }>;
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const params = await searchParams;
  const allMatches = await getPublicMatches();

  // Check if user is authenticated (for sign-up banner)
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  // TODO: If authenticated, fetch additional Pro-tier data (Milestone 2)

  // Build league info for the filter
  const leagueNames = [...new Set(allMatches.map((m) => m.league))];
  const allLeagues = leagueNames.map((name) => ({ name, tier: 1 }));

  // Filter matches
  let filtered = allMatches;

  if (params.leagues) {
    const selectedSet = new Set(params.leagues.split(",").filter(Boolean));
    filtered = filtered.filter((m) => selectedSet.has(m.league));
  }

  if (params.view === "odds") {
    filtered = filtered.filter((m) => m.hasOdds);
  }

  // Group by league
  const grouped = new Map<string, PublicMatch[]>();
  for (const match of filtered) {
    const existing = grouped.get(match.league) ?? [];
    existing.push(match);
    grouped.set(match.league, existing);
  }

  // Sort matches within each group: matches with odds first, then by kickoff
  for (const matches of grouped.values()) {
    matches.sort((a, b) => {
      if (a.hasOdds !== b.hasOdds) return a.hasOdds ? -1 : 1;
      return a.kickoff.localeCompare(b.kickoff);
    });
  }

  // Sort league groups: leagues with any odds first, then by match count, then alphabetically
  const sortedGroups = Array.from(grouped.entries()).sort(
    ([aLeague, aMatches], [bLeague, bMatches]) => {
      const aHasOdds = aMatches.some((m) => m.hasOdds);
      const bHasOdds = bMatches.some((m) => m.hasOdds);
      if (aHasOdds !== bHasOdds) return aHasOdds ? -1 : 1;
      const countDiff = bMatches.length - aMatches.length;
      if (countDiff !== 0) return countDiff;
      return aLeague.localeCompare(bLeague);
    }
  );

  const totalWithOdds = filtered.filter((m) => m.hasOdds).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Today&apos;s Matches
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {formatDate()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="w-fit">
            {filtered.length} match{filtered.length !== 1 ? "es" : ""}
          </Badge>
          {totalWithOdds > 0 && (
            <Badge
              variant="outline"
              className="w-fit border-emerald-500/30 text-emerald-400"
            >
              {totalWithOdds} with odds
            </Badge>
          )}
        </div>
      </div>

      {/* Sign-up banner for logged-out users */}
      {!isAuthenticated && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Sign up free to track your favourite leagues
          </p>
          <Link
            href="/signup"
            className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      )}

      {/* View toggle + League filter */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Show:
          </span>
          <Link
            href="/matches"
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              params.view !== "odds"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All matches
          </Link>
          <Link
            href="/matches?view=odds"
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              params.view === "odds"
                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            With odds only
          </Link>
        </div>

        {allLeagues.length > 0 && (
          <Suspense fallback={null}>
            <LeagueFilter leagues={allLeagues} />
          </Suspense>
        )}
      </div>

      {/* Empty state */}
      {sortedGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/50 bg-card py-16">
          <div className="rounded-full bg-muted p-4">
            <SearchX className="size-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              No matches found
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {params.view === "odds"
                ? "No matches with odds data today. Try showing all matches."
                : "Check back tomorrow or adjust your league filters above."}
            </p>
          </div>
        </div>
      )}

      {/* Grouped by league */}
      {sortedGroups.map(([league, matches]) => {
        const withOdds = matches.filter((m) => m.hasOdds);
        const withoutOdds = matches.filter((m) => !m.hasOdds);

        return (
          <section key={league} className="space-y-3">
            {/* League header */}
            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
              <span className="text-lg leading-none">
                {getCountryFlag(league)}
              </span>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground">
                {league}
              </h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {matches.length} match{matches.length !== 1 ? "es" : ""}
                {withOdds.length > 0 && (
                  <span className="text-emerald-400">
                    {" "}
                    ({withOdds.length} with odds)
                  </span>
                )}
              </span>
            </div>

            {/* Matches with odds: card grid */}
            {withOdds.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {withOdds.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            )}

            {/* Matches without odds: compact rows */}
            {withoutOdds.length > 0 && (
              <div className="rounded-lg border border-border/30 divide-y divide-border/20">
                {withoutOdds.map((match) => (
                  <CompactMatchRow key={match.id} match={match} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MatchCard({ match }: { match: PublicMatch }) {
  const interest = interestScore(match);
  const indicator = interestIndicator(interest);

  return (
    <Link
      href={`/matches/${match.id}`}
      className="group relative flex flex-col gap-2.5 rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-primary/40 hover:bg-card/80 hover:shadow-[0_0_15px_-4px] hover:shadow-primary/20"
    >
      {/* Interest indicator */}
      <div className="absolute right-3 top-3">
        <span className="text-sm" title={interest}>
          {indicator}
        </span>
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
    </Link>
  );
}

function CompactMatchRow({ match }: { match: PublicMatch }) {
  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30 group"
    >
      <span className="text-xs text-muted-foreground font-mono w-11 shrink-0">
        {formatKickoff(match.kickoff)}
      </span>
      <span className="text-sm text-foreground truncate">
        {match.homeTeam}
        <span className="text-muted-foreground"> vs </span>
        {match.awayTeam}
      </span>
      <ChevronRight className="size-3.5 text-muted-foreground/40 ml-auto shrink-0 group-hover:text-muted-foreground transition-colors" />
    </Link>
  );
}
