import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, SearchX } from "lucide-react";
import { getPublicMatches, getLiveSnapshots } from "@/lib/engine-data";
import { LeagueFilter } from "@/components/league-filter";
import { MatchesClient } from "@/components/matches-client";
import { DailyValueTeaser } from "@/components/daily-value-teaser";
import { createSupabaseServer } from "@/lib/supabase-server";
import type { PublicMatch, LiveSnapshot } from "@/lib/engine-data";

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

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  const leagueNames = [...new Set(allMatches.map((m) => m.league))];
  const allLeagues = leagueNames.map((name) => ({ name, tier: 1 }));

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

  // Sort within each group: odds first, then by kickoff
  for (const matches of grouped.values()) {
    matches.sort((a, b) => {
      if (a.hasOdds !== b.hasOdds) return a.hasOdds ? -1 : 1;
      return a.kickoff.localeCompare(b.kickoff);
    });
  }

  // Sort league groups: leagues with odds first, then by match count, then alphabetically
  const sortedGroups = Array.from(grouped.entries()).sort(
    ([, aMatches], [, bMatches]) => {
      const aHasOdds = aMatches.some((m) => m.hasOdds);
      const bHasOdds = bMatches.some((m) => m.hasOdds);
      if (aHasOdds !== bHasOdds) return aHasOdds ? -1 : 1;
      const countDiff = bMatches.length - aMatches.length;
      if (countDiff !== 0) return countDiff;
      return 0;
    }
  );

  const totalWithOdds = allMatches.filter((m) => m.hasOdds).length;

  // Fetch initial live snapshots for live matches
  const liveMatchIds = allMatches.filter((m) => m.status === "live").map((m) => m.id);
  const liveSnapshotsArr = await getLiveSnapshots(liveMatchIds);
  const initialSnapshots: Record<string, LiveSnapshot> = {};
  for (const s of liveSnapshotsArr) {
    initialSnapshots[s.match_id] = s;
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Today&apos;s Matches
          </h1>
          <div className="mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-3.5" />
              {formatDate()}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-sm text-muted-foreground">
              {allMatches.length} matches
            </span>
            {totalWithOdds > 0 && (
              <span className="rounded border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">
                {totalWithOdds} with odds
              </span>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {allLeagues.length > 0 && (
            <Suspense fallback={null}>
              <LeagueFilter leagues={allLeagues} />
            </Suspense>
          )}
          <div className="flex rounded-lg border border-white/[0.06] bg-muted/20 p-1">
            <Link
              href="/matches"
              className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
                params.view !== "odds"
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All matches
            </Link>
            <Link
              href="/matches?view=odds"
              className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
                params.view === "odds"
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              With odds only
            </Link>
          </div>
        </div>
      </div>

      {/* Sign-up banner */}
      {!isAuthenticated && (
        <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/[0.08] px-4 py-3">
          <div className="space-y-0.5">
            <span className="text-sm font-medium text-foreground/90">
              Create a free account to unlock:
            </span>
            <p className="text-xs text-foreground/60">
              Favorite teams, personal picks tracker, match notes, daily value bet teaser & more
            </p>
          </div>
          <Link
            href="/signup"
            className="shrink-0 rounded-md bg-green-600 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-green-700"
          >
            Sign Up Free
          </Link>
        </div>
      )}

      {/* Daily value bet teaser */}
      <DailyValueTeaser />

      {/* Empty state */}
      {sortedGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-white/[0.06] bg-card/40 py-16">
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

      {/* League accordions — MatchesClient handles live score polling */}
      <MatchesClient
        sortedGroups={sortedGroups}
        initialSnapshots={initialSnapshots}
      />
    </div>
  );
}
