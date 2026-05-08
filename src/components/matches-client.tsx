"use client";

import { useState, useEffect, useCallback, useMemo, useRef, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Star, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useAuth } from "@/components/auth-provider";
import type { PublicMatch, LiveSnapshot } from "@/lib/engine-data";
import { LeagueAccordion } from "./league-accordion";
import type { TeaserData } from "@/app/(app)/matches/page";

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
}

type StatusTab = "all" | "live" | "upcoming" | "finished";
type FilterTab = "all" | "favorites";
type GradeFilter = "A" | "B" | "C" | null;

export function MatchesClient({ sortedGroups, initialSnapshots, isPro, counts, finishedGroupsPromise, teaserData }: Props) {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<Record<string, LiveSnapshot>>(initialSnapshots);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>(null);
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

  // Grade filter — applied at match level within each league group
  const gradeFiltered = useMemo(() => {
    if (!gradeFilter) return statusFiltered;
    return statusFiltered
      .map(([league, matches]) => {
        const filtered = matches.filter((m) => m.dataGrade === gradeFilter);
        return [league, filtered] as [string, PublicMatch[]];
      })
      .filter(([, ms]) => ms.length > 0);
  }, [statusFiltered, gradeFilter]);

  // Helper: check if a league is in favorites
  const isFavoriteLeague = useCallback(
    (league: string) =>
      favoriteLeagues.some((fl) => league.toLowerCase() === fl.toLowerCase()),
    [favoriteLeagues]
  );

  // Re-sort: priority leagues → my leagues → rest (preserves server sort within tiers)
  const reorderedGroups = useMemo(() => {
    if (favoriteLeagues.length === 0) return gradeFiltered;
    const priority: [string, PublicMatch[]][] = [];
    const favorites: [string, PublicMatch[]][] = [];
    const rest: [string, PublicMatch[]][] = [];

    for (const group of gradeFiltered) {
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
            {totalCount > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                statusTab === "all" ? "bg-white/[0.08] text-muted-foreground/70" : "bg-white/[0.06] text-muted-foreground/60"
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
      </div>

      {/* Secondary filter row — my games + grade filter + search */}
      <div className="flex flex-wrap items-center gap-2">
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
            My Games
            {favoriteMatchCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                filterTab === "favorites" ? "bg-amber-400/20 text-amber-400" : "bg-white/[0.06] text-muted-foreground/60"
              }`}>
                {favoriteMatchCount}
              </span>
            )}
          </button>
        )}

        {/* Grade filter */}
        {(["A", "B", "C"] as const).map((g) => {
          const active = gradeFilter === g;
          const styles = {
            A: active
              ? "border-green-500/40 bg-green-500/20 text-green-400"
              : "border-white/[0.06] bg-muted/20 text-muted-foreground hover:border-green-500/20 hover:text-green-400/70",
            B: active
              ? "border-amber-500/40 bg-amber-500/20 text-amber-500"
              : "border-white/[0.06] bg-muted/20 text-muted-foreground hover:border-amber-500/20 hover:text-amber-500/70",
            C: active
              ? "border-white/[0.15] bg-white/[0.08] text-muted-foreground"
              : "border-white/[0.06] bg-muted/20 text-muted-foreground/50 hover:border-white/[0.10] hover:text-muted-foreground",
          }[g];
          return (
            <button
              key={g}
              onClick={() => setGradeFilter(active ? null : g)}
              className={`rounded-md border px-2.5 py-1 text-xs font-bold transition-all ${styles}`}
            >
              {g}
            </button>
          );
        })}
        {gradeFilter && (
          <button
            onClick={() => setGradeFilter(null)}
            className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <X className="size-3" /> clear
          </button>
        )}

        {/* League search — right-aligned, inline with grade filter on both mobile and desktop */}
        <div className="relative ml-auto flex-1 min-w-[8rem] sm:flex-none sm:w-56">
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


      {statusTab === "finished" ? (
        <Suspense fallback={
          <div className="rounded-xl border border-white/[0.06] bg-card/40 py-8 text-center">
            <p className="text-sm text-muted-foreground">Loading results…</p>
          </div>
        }>
          <FinishedContent
            promise={finishedGroupsPromise}
            gradeFilter={gradeFilter}
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
          {filterTab === "favorites" && filteredGroups.length === 0 && (
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

          {statusTab !== "all" && filteredGroups.length === 0 && filterTab !== "favorites" && (
            <div className="rounded-xl border border-white/[0.06] bg-card/40 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {statusTab === "live" ? "No live matches right now." : "No upcoming matches."}
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

          {teaserData.pick && (
            <DailyValueTeaser
              pick={teaserData.pick}
              totalCount={teaserData.totalCount}
              alreadyUnlocked={teaserData.alreadyUnlocked}
              isPro={teaserData.isPro}
            />
          )}

          {filteredGroups.map(([league, matches], i) => (
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
            />
          ))}
        </>
      )}
    </div>
  );
}

function FinishedContent({
  promise,
  gradeFilter,
  leagueSearch,
  filterTab,
  favoriteMatchIds,
  favoriteLeagues,
  isPro,
  snapshots,
  onMatchFavoriteToggle,
}: {
  promise: Promise<[string, PublicMatch[]][]>;
  gradeFilter: GradeFilter;
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

    if (gradeFilter) {
      result = result
        .map(([league, matches]) => [league, matches.filter((m) => m.dataGrade === gradeFilter)] as [string, PublicMatch[]])
        .filter(([, ms]) => ms.length > 0);
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
  }, [groups, leagueSearch, gradeFilter, filterTab, favoriteMatchIds, favoriteLeagues]);

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
