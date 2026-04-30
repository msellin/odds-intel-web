"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Star, Search, X } from "lucide-react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useAuth } from "@/components/auth-provider";
import type { PublicMatch, LiveSnapshot } from "@/lib/engine-data";
import { LeagueAccordion } from "./league-accordion";
import { MatchFavoriteButton } from "./match-favorite-button";

interface Props {
  sortedGroups: [string, PublicMatch[]][];
  initialSnapshots: Record<string, LiveSnapshot>;
  isPro: boolean;
}

type StatusTab = "all" | "live" | "upcoming" | "finished";
type FilterTab = "all" | "odds" | "favorites";

export function MatchesClient({ sortedGroups, initialSnapshots, isPro }: Props) {
  const [snapshots, setSnapshots] = useState<Record<string, LiveSnapshot>>(initialSnapshots);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [filterTab, setFilterTab] = useState<FilterTab>("odds");
  const [leagueSearch, setLeagueSearch] = useState("");
  const [favoriteMatchIds, setFavoriteMatchIds] = useState<Set<string>>(new Set());
  const { user, profile } = useAuth();

  // Fetch user's match favorites on mount
  useEffect(() => {
    if (!user) return;
    const supabase = createSupabaseBrowser();
    supabase
      .from("user_match_favorites")
      .select("match_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          setFavoriteMatchIds(new Set(data.map((r) => r.match_id)));
        }
      });
  }, [user]);

  const handleMatchFavoriteToggle = useCallback((matchId: string, isFavorited: boolean) => {
    setFavoriteMatchIds((prev) => {
      const next = new Set(prev);
      if (isFavorited) next.add(matchId);
      else next.delete(matchId);
      return next;
    });
  }, []);

  // Stable list of live match IDs
  const liveMatchIds = useMemo(
    () =>
      sortedGroups
        .flatMap(([, matches]) => matches)
        .filter((m) => m.status === "live")
        .map((m) => m.id),
    [sortedGroups]
  );

  const fetchSnapshots = useCallback(async () => {
    if (!liveMatchIds.length) return;
    const supabase = createSupabaseBrowser();
    const { data } = await supabase
      .from("live_match_snapshots")
      .select("match_id, score_home, score_away, minute, captured_at")
      .in("match_id", liveMatchIds)
      .order("captured_at", { ascending: false });

    if (data) {
      const seen = new Set<string>();
      const latest: Record<string, LiveSnapshot> = {};
      for (const row of data as LiveSnapshot[]) {
        if (!seen.has(row.match_id)) {
          seen.add(row.match_id);
          latest[row.match_id] = row;
        }
      }
      setSnapshots((prev) => ({ ...prev, ...latest }));
    }
  }, [liveMatchIds]);

  useEffect(() => {
    if (!liveMatchIds.length) return;
    const id = setInterval(fetchSnapshots, 60_000);
    return () => clearInterval(id);
  }, [liveMatchIds, fetchSnapshots]);

  const favoriteLeagues = profile?.preferred_leagues ?? [];

  // Status counts (from all groups, unaffected by search)
  const allMatches = useMemo(() => sortedGroups.flatMap(([, ms]) => ms), [sortedGroups]);
  const liveCount = useMemo(() => allMatches.filter((m) => m.status === "live").length, [allMatches]);
  const finishedCount = useMemo(() => allMatches.filter((m) => m.status === "finished").length, [allMatches]);
  const upcomingCount = useMemo(() => allMatches.filter((m) => m.status !== "live" && m.status !== "finished").length, [allMatches]);

  // Followed matches (from match-level favorites)
  const followedMatches = useMemo(() => {
    if (favoriteMatchIds.size === 0) return [];
    return allMatches.filter((m) => favoriteMatchIds.has(m.id));
  }, [allMatches, favoriteMatchIds]);

  // Client-side league search filter
  const searchFiltered = useMemo(() => {
    if (!leagueSearch.trim()) return sortedGroups;
    const lower = leagueSearch.toLowerCase();
    return sortedGroups.filter(([league]) => league.toLowerCase().includes(lower));
  }, [sortedGroups, leagueSearch]);

  // Filter by status tab
  const statusFiltered = useMemo(() => {
    if (statusTab === "all") return searchFiltered;
    return searchFiltered
      .map(([league, matches]) => {
        const filtered = matches.filter((m) => {
          if (statusTab === "live") return m.status === "live";
          if (statusTab === "finished") return m.status === "finished";
          if (statusTab === "upcoming") return m.status !== "live" && m.status !== "finished";
          return true;
        });
        return [league, filtered] as [string, PublicMatch[]];
      })
      .filter(([, ms]) => ms.length > 0);
  }, [searchFiltered, statusTab]);

  // Helper: check if a league is in favorites
  const isFavoriteLeague = useCallback(
    (league: string) =>
      favoriteLeagues.some((fl) => league.toLowerCase() === fl.toLowerCase()),
    [favoriteLeagues]
  );

  // Re-sort: priority leagues → my leagues → rest (preserves server sort within tiers)
  const reorderedGroups = useMemo(() => {
    if (favoriteLeagues.length === 0) return statusFiltered;
    const priority: [string, PublicMatch[]][] = [];
    const favorites: [string, PublicMatch[]][] = [];
    const rest: [string, PublicMatch[]][] = [];

    for (const group of statusFiltered) {
      const [, matches] = group;
      const hasPriority = matches[0]?.leaguePriority != null;
      if (hasPriority) {
        priority.push(group);
      } else if (isFavoriteLeague(group[0])) {
        favorites.push(group);
      } else {
        rest.push(group);
      }
    }
    return [...priority, ...favorites, ...rest];
  }, [statusFiltered, favoriteLeagues, isFavoriteLeague]);

  // Then filter by odds/favorites
  const filteredGroups = useMemo(() => {
    if (filterTab === "odds") {
      return reorderedGroups
        .map(([league, matches]) => [league, matches.filter((m) => m.hasOdds)] as [string, typeof matches])
        .filter(([, matches]) => matches.length > 0);
    }
    if (filterTab === "favorites") {
      if (favoriteLeagues.length === 0) return [];
      return reorderedGroups.filter(([league]) => isFavoriteLeague(league));
    }
    return reorderedGroups;
  }, [reorderedGroups, filterTab, favoriteLeagues, isFavoriteLeague]);

  const oddsMatchCount = useMemo(
    () => allMatches.filter((m) => m.hasOdds).length,
    [allMatches]
  );

  const favoriteMatchCount = useMemo(() => {
    if (favoriteLeagues.length === 0) return 0;
    return sortedGroups.reduce((count, [league, matches]) => {
      const leagueMatch = favoriteLeagues.some(
        (fl) => league.toLowerCase() === fl.toLowerCase()
      );
      return leagueMatch ? count + matches.length : count;
    }, 0);
  }, [sortedGroups, favoriteLeagues]);

  return (
    <div className="space-y-3">
      {/* Top row: status tabs + league search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* ML-5: Status tabs — primary navigation */}
        <div className="flex rounded-lg border border-white/[0.06] bg-muted/20 p-1 w-fit">
          <button
            onClick={() => setStatusTab("all")}
            className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
              statusTab === "all"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusTab("live")}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
              statusTab === "live"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {liveCount > 0 && (
              <span className="size-1.5 animate-pulse rounded-full bg-green-400" />
            )}
            Live
            {liveCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                statusTab === "live" ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-500/70"
              }`}>
                {liveCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setStatusTab("upcoming")}
            className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
              statusTab === "upcoming"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Upcoming
            {upcomingCount > 0 && statusTab !== "upcoming" && (
              <span className="ml-1.5 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground/60">
                {upcomingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setStatusTab("finished")}
            className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
              statusTab === "finished"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Finished
            {finishedCount > 0 && statusTab !== "finished" && (
              <span className="ml-1.5 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground/60">
                {finishedCount}
              </span>
            )}
          </button>
        </div>

        {/* Client-side league search */}
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            value={leagueSearch}
            onChange={(e) => setLeagueSearch(e.target.value)}
            placeholder="Filter by league..."
            className="w-full rounded-lg border border-white/[0.06] bg-muted/20 py-1.5 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-green-500/40 focus:outline-none transition-colors"
          />
          {leagueSearch && (
            <button
              onClick={() => setLeagueSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Secondary filter row — odds / my leagues */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterTab(filterTab === "odds" ? "all" : "odds")}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-bold transition-all ${
            filterTab === "odds"
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-white/[0.06] bg-muted/20 text-muted-foreground hover:text-foreground"
          }`}
        >
          With odds
          {oddsMatchCount > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              filterTab === "odds" ? "bg-green-500/20 text-green-400" : "bg-white/[0.06] text-muted-foreground/60"
            }`}>
              {oddsMatchCount}
            </span>
          )}
        </button>

        {user && (
          <button
            onClick={() => setFilterTab(filterTab === "favorites" ? "all" : "favorites")}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-bold transition-all ${
              filterTab === "favorites"
                ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
                : "border-white/[0.06] bg-muted/20 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            My Leagues
            {favoriteMatchCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                filterTab === "favorites" ? "bg-amber-400/20 text-amber-400" : "bg-white/[0.06] text-muted-foreground/60"
              }`}>
                {favoriteMatchCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Followed Games section — shows match-level favorites at the top */}
      {followedMatches.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-400/20 bg-card/40">
          <div className="flex h-10 items-center gap-2 bg-amber-400/5 px-4">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-black tracking-widest text-amber-400/80 uppercase">
              Followed Games
            </span>
            <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400/70">
              {followedMatches.length}
            </span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {followedMatches.map((match) => {
              const snapshot = snapshots[match.id];
              const isLive = match.status === "live" && !!snapshot;
              const isFinished = match.status === "finished";
              return (
                <div key={match.id} className="flex items-center gap-2 px-4 h-10 hover:bg-white/[0.03] transition-colors">
                  <MatchFavoriteButton
                    matchId={match.id}
                    favoriteMatchIds={favoriteMatchIds}
                    onToggle={handleMatchFavoriteToggle}
                  />
                  <Link
                    href={`/matches/${match.id}`}
                    className="flex flex-1 items-center gap-2 text-sm min-w-0"
                  >
                    <span className="text-[10px] text-muted-foreground/50 w-16 shrink-0">
                      {isLive ? (
                        <span className="text-green-400 font-bold">{snapshot!.minute}&apos;</span>
                      ) : isFinished ? (
                        <span className="text-muted-foreground font-bold">FT</span>
                      ) : (
                        new Date(match.kickoff).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                      )}
                    </span>
                    <span className="truncate text-xs font-medium text-foreground">
                      {match.homeTeam}
                    </span>
                    {isLive ? (
                      <span className="font-mono text-xs font-bold tabular-nums text-foreground shrink-0">
                        {snapshot!.score_home}–{snapshot!.score_away}
                      </span>
                    ) : isFinished && match.score_home != null ? (
                      <span className="font-mono text-xs font-bold tabular-nums text-foreground shrink-0">
                        {match.score_home}–{match.score_away}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">vs</span>
                    )}
                    <span className="truncate text-xs font-medium text-foreground">
                      {match.awayTeam}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground/40 shrink-0 hidden sm:block">
                      {match.league}
                    </span>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filterTab === "favorites" && filteredGroups.length === 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-card/40 py-10 text-center">
          <Star className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">No favourite leagues today</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap the star next to any league name to add it here, or manage your{" "}
            <a href="/profile" className="text-primary underline-offset-2 hover:underline">
              favourite leagues in your profile
            </a>
            .
          </p>
        </div>
      )}

      {statusTab !== "all" && filteredGroups.length === 0 && filterTab !== "favorites" && (
        <div className="rounded-xl border border-white/[0.06] bg-card/40 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {statusTab === "live"
              ? "No live matches right now."
              : statusTab === "finished"
              ? "No finished matches yet today."
              : "No upcoming matches."}
          </p>
        </div>
      )}

      {leagueSearch && filteredGroups.length === 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-card/40 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No leagues matching &ldquo;{leagueSearch}&rdquo;.
          </p>
        </div>
      )}

      {filteredGroups.map(([league, matches]) => (
        <LeagueAccordion
          key={league}
          league={league}
          matches={matches}
          defaultExpanded={matches.some((m) => m.hasOdds) || statusTab === "live"}
          liveSnapshots={snapshots}
          isPro={isPro}
          favoriteMatchIds={favoriteMatchIds}
          onMatchFavoriteToggle={handleMatchFavoriteToggle}
        />
      ))}
    </div>
  );
}
