"use client";

import { useState, useEffect, useCallback, useMemo, useRef, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, Search, X, History, Zap, Trophy } from "lucide-react";
import dynamic from "next/dynamic";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useAuth } from "@/components/auth-provider";
import type { PublicMatch, LiveSnapshot } from "@/lib/engine-data";
import { LeagueAccordion, type MatchValueInfo } from "./league-accordion";
import { MatchFavoriteButton } from "./match-favorite-button";
import type { TeaserData } from "@/app/(app)/matches/page";

interface PastSavedMatchRow {
  id: string;
  date: string;
  status: string | null;
  score_home: number | null;
  score_away: number | null;
  home_team: { name: string }[] | { name: string } | null;
  away_team: { name: string }[] | { name: string } | null;
  league: { name: string; country: string }[] | { name: string; country: string } | null;
}

interface PastSavedMatch {
  id: string;
  date: string;
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
  homeTeam: string;
  awayTeam: string;
  league: string;
}

// Lazy — not included in server HTML, so it can never be the LCP element.
const DailyValueTeaser = dynamic(
  () => import("@/components/daily-value-teaser").then((m) => ({ default: m.DailyValueTeaser })),
  { ssr: false, loading: () => <div className="h-[52px]" /> }
);

interface Props {
  sortedGroups: [string, PublicMatch[]][];
  initialSnapshots: Record<string, LiveSnapshot>;
  isPro: boolean;
  counts: { live: number; upcoming: number; finished: number; total: number };
  finishedGroupsPromise: Promise<[string, PublicMatch[]][]>;
  teaserData: TeaserData;
  valueBets: Record<string, MatchValueInfo>;
}

type StatusTab = "all" | "live" | "upcoming" | "finished";
type FilterTab = "all" | "favorites";
type SortMode = "league" | "value" | "kickoff";

export function MatchesClient({ sortedGroups, initialSnapshots, isPro, counts, finishedGroupsPromise, teaserData, valueBets }: Props) {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<Record<string, LiveSnapshot>>(initialSnapshots);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [hasValueFilter, setHasValueFilter] = useState(false);
  const [topLeaguesFilter, setTopLeaguesFilter] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("league");
  const [leagueSearch, setLeagueSearch] = useState("");
  const [favoriteMatchIds, setFavoriteMatchIds] = useState<Set<string>>(new Set());
  const [pastSavedMatches, setPastSavedMatches] = useState<PastSavedMatch[] | null>(null);
  const [pastSavedLoading, setPastSavedLoading] = useState(false);
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

  // IDs of matches currently visible in today's list — used to filter past saved fetch
  const visibleMatchIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [, matches] of sortedGroups) for (const m of matches) ids.add(m.id);
    return ids;
  }, [sortedGroups]);

  // Lazy: fetch past saved matches (saved games that no longer appear in today's list)
  // only when the user opens the My Games tab. Keeps initial bundle/work down.
  useEffect(() => {
    if (!user || filterTab !== "favorites" || favoriteMatchIds.size === 0) return;
    if (pastSavedMatches !== null || pastSavedLoading) return;

    const pastIds = [...favoriteMatchIds].filter((id) => !visibleMatchIds.has(id));
    if (pastIds.length === 0) {
      setPastSavedMatches([]);
      return;
    }

    setPastSavedLoading(true);
    const supabase = createSupabaseBrowser();
    supabase
      .from("matches")
      .select(
        `id, date, status, score_home, score_away,
         home_team:home_team_id(name),
         away_team:away_team_id(name),
         league:league_id(name, country)`
      )
      .in("id", pastIds)
      .order("date", { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as PastSavedMatchRow[];
        const mapped: PastSavedMatch[] = rows.map((r) => {
          const ht = Array.isArray(r.home_team) ? r.home_team[0] : r.home_team;
          const at = Array.isArray(r.away_team) ? r.away_team[0] : r.away_team;
          const lg = Array.isArray(r.league) ? r.league[0] : r.league;
          return {
            id: r.id,
            date: r.date,
            status: r.status ?? "finished",
            scoreHome: r.score_home,
            scoreAway: r.score_away,
            homeTeam: ht?.name ?? "TBD",
            awayTeam: at?.name ?? "TBD",
            league: lg ? `${lg.country} / ${lg.name}` : "Unknown",
          };
        });
        setPastSavedMatches(mapped);
        setPastSavedLoading(false);
      });
  }, [user, filterTab, favoriteMatchIds, visibleMatchIds, pastSavedMatches, pastSavedLoading]);

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

  // Refs so Realtime callbacks can read current values without re-subscribing
  const liveMatchIdsRef = useRef<string[]>(liveMatchIds);
  useEffect(() => { liveMatchIdsRef.current = liveMatchIds; }, [liveMatchIds]);

  const allMatchIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    allMatchIdsRef.current = new Set(sortedGroups.flatMap(([, ms]) => ms).map((m) => m.id));
  }, [sortedGroups]);

  // Realtime: live snapshot inserts → update score/minute overlays (replaces 60s poll)
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const channel = supabase
      .channel("match-list-snapshots")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_match_snapshots" },
        (payload) => {
          const row = payload.new as LiveSnapshot;
          if (liveMatchIdsRef.current.includes(row.match_id)) {
            setSnapshots((prev) => ({ ...prev, [row.match_id]: row }));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Realtime: match status changes → re-fetch server component (replaces 90s router.refresh() poll)
  useEffect(() => {
    if (!counts.upcoming && !counts.live) return;
    const supabase = createSupabaseBrowser();
    let refreshTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel("match-list-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          const newStatus = (payload.new as Record<string, unknown>).status as string;
          if (!allMatchIdsRef.current.has((payload.new as Record<string, unknown>).id as string)) return;
          if (newStatus === "live" || newStatus === "finished") {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => router.refresh(), 500);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      clearTimeout(refreshTimer);
    };
  }, [counts.upcoming, counts.live, router]);

  const favoriteLeagues = profile?.preferred_leagues ?? [];

  // Counts come from the server — cheap COUNT query, not derived from the serialized match data
  const totalCount = counts.total;
  const liveCount = counts.live;
  const finishedCount = counts.finished;
  const upcomingCount = counts.upcoming;

  // Client-side league search filter
  const searchFiltered = useMemo(() => {
    if (!leagueSearch.trim()) return sortedGroups;
    const lower = leagueSearch.toLowerCase();
    return sortedGroups.filter(([league]) => league.toLowerCase().includes(lower));
  }, [sortedGroups, leagueSearch]);

  // Filter by status tab — "finished" is handled by FinishedContent, not here
  const statusFiltered = useMemo(() => {
    if (statusTab === "all" || statusTab === "finished") return searchFiltered;
    return searchFiltered
      .map(([league, matches]) => {
        const filtered = matches.filter((m) => {
          if (statusTab === "live") return m.status === "live";
          if (statusTab === "upcoming") return m.status !== "live" && m.status !== "finished";
          return true;
        });
        return [league, filtered] as [string, PublicMatch[]];
      })
      .filter(([, ms]) => ms.length > 0);
  }, [searchFiltered, statusTab]);

  // "Has value" filter — only show matches with a value bet
  const valueFiltered = useMemo(() => {
    if (!hasValueFilter) return statusFiltered;
    return statusFiltered
      .map(([league, matches]) => {
        const filtered = matches.filter((m) => valueBets[m.id]);
        return [league, filtered] as [string, PublicMatch[]];
      })
      .filter(([, ms]) => ms.length > 0);
  }, [statusFiltered, hasValueFilter, valueBets]);

  // "Top leagues" filter — only show priority leagues (leaguePriority != null)
  const topLeaguesFiltered = useMemo(() => {
    if (!topLeaguesFilter) return valueFiltered;
    return valueFiltered.filter(([, matches]) => matches[0]?.leaguePriority != null);
  }, [valueFiltered, topLeaguesFilter]);

  // Helper: check if a league is in favorites
  const isFavoriteLeague = useCallback(
    (league: string) =>
      favoriteLeagues.some((fl) => league.toLowerCase() === fl.toLowerCase()),
    [favoriteLeagues]
  );

  // Re-sort: priority leagues → my leagues → rest (preserves server sort within tiers)
  const reorderedGroups = useMemo(() => {
    if (favoriteLeagues.length === 0) return topLeaguesFiltered;
    const priority: [string, PublicMatch[]][] = [];
    const favorites: [string, PublicMatch[]][] = [];
    const rest: [string, PublicMatch[]][] = [];

    for (const group of topLeaguesFiltered) {
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
  }, [topLeaguesFiltered, favoriteLeagues, isFavoriteLeague]);

  // Then filter by favorites (my leagues + followed matches)
  const filteredGroups = useMemo(() => {
    if (filterTab === "favorites") {
      if (favoriteLeagues.length === 0 && favoriteMatchIds.size === 0) return [];
      return reorderedGroups
        .map(([league, matches]) => {
          if (isFavoriteLeague(league)) return [league, matches] as [string, typeof matches];
          // Include matches that are individually followed even if league isn't favorited
          const followed = matches.filter((m) => favoriteMatchIds.has(m.id));
          if (followed.length > 0) return [league, followed] as [string, typeof followed];
          return null;
        })
        .filter((g): g is [string, PublicMatch[]] => g !== null);
    }
    return reorderedGroups;
  }, [reorderedGroups, filterTab, favoriteLeagues, favoriteMatchIds, isFavoriteLeague]);

  // Re-sort groups by value or kickoff when sort mode changes
  const sortedForDisplay = useMemo(() => {
    if (sortMode === "league") return filteredGroups;
    return [...filteredGroups]
      .map(([league, matches]) => {
        let sorted: PublicMatch[];
        if (sortMode === "value") {
          sorted = [...matches].sort((a, b) => {
            const aEdge = valueBets[a.id]?.topEdge ?? -1;
            const bEdge = valueBets[b.id]?.topEdge ?? -1;
            return bEdge - aEdge;
          });
        } else {
          sorted = [...matches].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
        }
        return [league, sorted] as [string, PublicMatch[]];
      })
      .sort(([, aMatches], [, bMatches]) => {
        if (sortMode === "value") {
          const aEdge = valueBets[aMatches[0]?.id]?.topEdge ?? -1;
          const bEdge = valueBets[bMatches[0]?.id]?.topEdge ?? -1;
          return bEdge - aEdge;
        }
        const aKo = aMatches[0]?.kickoff ?? "";
        const bKo = bMatches[0]?.kickoff ?? "";
        return aKo.localeCompare(bKo);
      });
  }, [filteredGroups, sortMode, valueBets]);

  const favoriteMatchCount = useMemo(() => {
    const counted = new Set<string>();
    // Count matches from favorite leagues
    for (const [league, matches] of sortedGroups) {
      if (favoriteLeagues.some((fl) => league.toLowerCase() === fl.toLowerCase())) {
        for (const m of matches) counted.add(m.id);
      }
    }
    // Count individually followed matches
    for (const id of favoriteMatchIds) counted.add(id);
    return counted.size;
  }, [sortedGroups, favoriteLeagues, favoriteMatchIds]);

  return (
    <div className="space-y-1 sm:space-y-3">
      {/* Top row: status tabs */}
      <div>
        {/* ML-5: Status tabs — primary navigation */}
        <div className="flex rounded-lg border border-white/[0.06] bg-muted/20 p-1 w-fit max-w-full overflow-x-auto scrollbar-none">
          <button
            onClick={() => setStatusTab("all")}
            className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
              statusTab === "all"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
            {totalCount > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                statusTab === "all" ? "bg-white/[0.08] text-muted-foreground" : "bg-white/[0.06] text-muted-foreground"
              }`}>
                {totalCount}
              </span>
            )}
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
              <span className="ml-1.5 rounded-full bg-white/[0.10] px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
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
              <span className="ml-1.5 rounded-full bg-white/[0.10] px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                {finishedCount}
              </span>
            )}
          </button>
        </div>
        <p className="mt-1 px-1 text-[10px] text-muted-foreground/40">Times in your local timezone</p>
      </div>

      {/* Secondary filter row — my games + value/top filters + search */}
      <div className="flex flex-wrap items-center gap-2">
        {user && (
          <button
            onClick={() => setFilterTab(filterTab === "favorites" ? "all" : "favorites")}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-bold transition-all ${
              filterTab === "favorites"
                ? "border-amber-400/40 bg-amber-400/15 text-amber-400"
                : "border-white/[0.06] bg-muted/20 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Star className={`h-3 w-3 ${filterTab === "favorites" ? "fill-amber-400 text-amber-400" : "text-amber-400"}`} />
            My Games
            {favoriteMatchCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                filterTab === "favorites" ? "bg-amber-400/20 text-amber-400" : "bg-white/[0.06] text-muted-foreground"
              }`}>
                {favoriteMatchCount}
              </span>
            )}
          </button>
        )}

        {/* Has value filter */}
        <button
          onClick={() => setHasValueFilter(!hasValueFilter)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-bold transition-all ${
            hasValueFilter
              ? "border-green-500/40 bg-green-500/15 text-green-400"
              : "border-white/[0.06] bg-muted/20 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Zap className="h-3 w-3" />
          Has value
        </button>

        {/* Top leagues filter */}
        <button
          onClick={() => setTopLeaguesFilter(!topLeaguesFilter)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-bold transition-all ${
            topLeaguesFilter
              ? "border-amber-500/40 bg-amber-500/15 text-amber-500"
              : "border-white/[0.06] bg-muted/20 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Trophy className="h-3 w-3" />
          Top leagues
        </button>

        {(hasValueFilter || topLeaguesFilter) && (
          <button
            onClick={() => { setHasValueFilter(false); setTopLeaguesFilter(false); }}
            className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <X className="size-3" /> clear
          </button>
        )}

        {/* League search */}
        <div className="relative ml-auto flex-1 min-w-[8rem] sm:flex-none sm:w-56">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            value={leagueSearch}
            onChange={(e) => setLeagueSearch(e.target.value)}
            placeholder="Search leagues"
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

      {/* Sort controls — hidden on finished tab */}
      {statusTab !== "finished" && (
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-muted/20 p-0.5 w-fit">
          {(["league", "value", "kickoff"] as SortMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                sortMode === mode
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "league" ? "By league" : mode === "value" ? "⚡ By value" : "By kickoff"}
            </button>
          ))}
        </div>
      )}

      {statusTab === "finished" ? (
        <Suspense fallback={
          <div className="rounded-xl border border-white/[0.06] bg-card/40 py-8 text-center">
            <p className="text-sm text-muted-foreground">Loading results…</p>
          </div>
        }>
          <FinishedContent
            promise={finishedGroupsPromise}
            leagueSearch={leagueSearch}
            filterTab={filterTab}
            favoriteMatchIds={favoriteMatchIds}
            favoriteLeagues={favoriteLeagues}
            isPro={isPro}
            snapshots={snapshots}
            onMatchFavoriteToggle={handleMatchFavoriteToggle}
          />
        </Suspense>
      ) : (
        <>
          {filterTab === "favorites" && sortedForDisplay.length === 0 && (pastSavedMatches?.length ?? 0) === 0 && !pastSavedLoading && (
            <div className="rounded-xl border border-white/[0.06] bg-card/40 py-10 text-center">
              <Star className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">No saved games today</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Star a league or follow individual matches to see them here, or manage your{" "}
                <a href="/profile" className="text-primary underline-offset-2 hover:underline">
                  favourite leagues in your profile
                </a>
                .
              </p>
            </div>
          )}

          {statusTab !== "all" && sortedForDisplay.length === 0 && filterTab !== "favorites" && (
            <div className="rounded-xl border border-white/[0.06] bg-card/40 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {statusTab === "live" ? "No live matches right now." : "No upcoming matches."}
              </p>
            </div>
          )}

          {leagueSearch && sortedForDisplay.length === 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-card/40 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No leagues matching &ldquo;{leagueSearch}&rdquo;.
              </p>
            </div>
          )}

          {teaserData.pick && (
            <DailyValueTeaser
              pick={teaserData.pick}
              totalCount={teaserData.totalCount}
              alreadyUnlocked={teaserData.alreadyUnlocked}
              isPro={teaserData.isPro}
            />
          )}

          {sortedForDisplay.map(([league, matches], i) => (
            <LeagueAccordion
              key={league}
              league={league}
              matches={matches}
              defaultExpanded={matches.some((m) => m.hasOdds) || statusTab === "live"}
              liveSnapshots={snapshots}
              isPro={isPro}
              favoriteMatchIds={favoriteMatchIds}
              onMatchFavoriteToggle={handleMatchFavoriteToggle}
              prioritizeFirstLogos={i === 0}
              valueBets={valueBets}
            />
          ))}

          {filterTab === "favorites" && pastSavedMatches && pastSavedMatches.filter((m) => favoriteMatchIds.has(m.id)).length > 0 && (
            <PastSavedGames
              matches={pastSavedMatches.filter((m) => favoriteMatchIds.has(m.id))}
              favoriteMatchIds={favoriteMatchIds}
              onToggle={handleMatchFavoriteToggle}
            />
          )}
        </>
      )}
    </div>
  );
}

function FinishedContent({
  promise,
  leagueSearch,
  filterTab,
  favoriteMatchIds,
  favoriteLeagues,
  isPro,
  snapshots,
  onMatchFavoriteToggle,
}: {
  promise: Promise<[string, PublicMatch[]][]>;
  leagueSearch: string;
  filterTab: FilterTab;
  favoriteMatchIds: Set<string>;
  favoriteLeagues: string[];
  isPro: boolean;
  snapshots: Record<string, LiveSnapshot>;
  onMatchFavoriteToggle: (matchId: string, isFavorited: boolean) => void;
}) {
  const groups = use(promise);

  const filtered = useMemo(() => {
    let result = groups;

    if (leagueSearch.trim()) {
      const lower = leagueSearch.toLowerCase();
      result = result.filter(([league]) => league.toLowerCase().includes(lower));
    }

    if (filterTab === "favorites") {
      result = result
        .map(([league, matches]) => {
          const isFavLeague = favoriteLeagues.some((fl) => league.toLowerCase() === fl.toLowerCase());
          if (isFavLeague) return [league, matches] as [string, PublicMatch[]];
          const followed = matches.filter((m) => favoriteMatchIds.has(m.id));
          return followed.length > 0 ? [league, followed] as [string, PublicMatch[]] : null;
        })
        .filter((g): g is [string, PublicMatch[]] => g !== null);
    }

    return result;
  }, [groups, leagueSearch, filterTab, favoriteMatchIds, favoriteLeagues]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-card/40 py-8 text-center">
        <p className="text-sm text-muted-foreground">No finished matches yet today.</p>
      </div>
    );
  }

  return (
    <>
      {filtered.map(([league, matches]) => (
        <LeagueAccordion
          key={league}
          league={league}
          matches={matches}
          defaultExpanded={false}
          liveSnapshots={snapshots}
          isPro={isPro}
          favoriteMatchIds={favoriteMatchIds}
          onMatchFavoriteToggle={onMatchFavoriteToggle}
        />
      ))}
    </>
  );
}

function PastSavedGames({
  matches,
  favoriteMatchIds,
  onToggle,
}: {
  matches: PastSavedMatch[];
  favoriteMatchIds: Set<string>;
  onToggle: (matchId: string, isFavorited: boolean) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-card/40">
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-muted/30 px-4 py-2.5">
        <History className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Past saved games
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/60">
          {matches.length}
        </span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {matches.map((m) => {
          const d = new Date(m.date);
          const dateLabel = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
          const hasScore = m.scoreHome != null && m.scoreAway != null;
          return (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
              <MatchFavoriteButton
                matchId={m.id}
                favoriteMatchIds={favoriteMatchIds}
                onToggle={onToggle}
              />
              <Link href={`/matches/${m.id}`} className="flex-1 min-w-0 flex items-center gap-3">
                <span className="font-mono text-[10px] text-muted-foreground w-12 shrink-0">
                  {dateLabel}
                </span>
                <span className="text-sm text-foreground truncate flex-1">
                  {m.homeTeam} <span className="text-muted-foreground/50">vs</span> {m.awayTeam}
                </span>
                <span className="text-[10px] text-muted-foreground/70 truncate max-w-[10rem] hidden sm:inline">
                  {m.league}
                </span>
                {hasScore ? (
                  <span className="font-mono text-xs font-bold text-foreground tabular-nums w-12 text-right shrink-0">
                    {m.scoreHome}–{m.scoreAway}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50 w-12 text-right shrink-0">
                    {m.status === "postponed" ? "PP" : "—"}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
