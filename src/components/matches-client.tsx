"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Star, Bookmark } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useAuth } from "@/components/auth-provider";
import type { PublicMatch, LiveSnapshot } from "@/lib/engine-data";
import { LeagueAccordion } from "./league-accordion";

interface Props {
  sortedGroups: [string, PublicMatch[]][];
  initialSnapshots: Record<string, LiveSnapshot>;
}

type ViewTab = "all" | "favorites" | "saved";

export function MatchesClient({ sortedGroups, initialSnapshots }: Props) {
  const [snapshots, setSnapshots] = useState<Record<string, LiveSnapshot>>(initialSnapshots);
  const [activeTab, setActiveTab] = useState<ViewTab>("all");
  const [savedMatchIds, setSavedMatchIds] = useState<Set<string>>(new Set());
  const { user, profile } = useAuth();

  // Fetch saved match IDs
  useEffect(() => {
    if (!user) return;
    const supabase = createSupabaseBrowser();
    supabase
      .from("saved_matches")
      .select("match_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          setSavedMatchIds(new Set(data.map((r: { match_id: string }) => r.match_id)));
        }
      });
  }, [user]);

  // Stable list of live match IDs (matches table status === 'live')
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

  // Filter for "My Matches" — favorites
  const favoriteTeams = profile?.favorite_teams ?? [];
  const favoriteLeagues = profile?.preferred_leagues ?? [];
  const hasFavorites = favoriteTeams.length > 0 || favoriteLeagues.length > 0;
  const hasSaved = savedMatchIds.size > 0;

  const filteredGroups = useMemo(() => {
    if (activeTab === "all") return sortedGroups;

    if (activeTab === "saved") {
      return sortedGroups
        .map(([league, matches]) => {
          const filtered = matches.filter((m) => savedMatchIds.has(m.id));
          if (filtered.length === 0) return null;
          return [league, filtered] as [string, PublicMatch[]];
        })
        .filter(Boolean) as [string, PublicMatch[]][];
    }

    // favorites
    if (!hasFavorites) return sortedGroups;
    return sortedGroups
      .map(([league, matches]) => {
        const leagueMatch = favoriteLeagues.some((fl) =>
          league.toLowerCase().includes(fl.toLowerCase())
        );
        if (leagueMatch) return [league, matches] as [string, PublicMatch[]];
        const filtered = matches.filter(
          (m) =>
            favoriteTeams.includes(m.homeTeam) ||
            favoriteTeams.includes(m.awayTeam)
        );
        if (filtered.length === 0) return null;
        return [league, filtered] as [string, PublicMatch[]];
      })
      .filter(Boolean) as [string, PublicMatch[]][];
  }, [sortedGroups, activeTab, hasFavorites, favoriteTeams, favoriteLeagues, savedMatchIds]);

  const favoriteMatchCount = useMemo(() => {
    if (!hasFavorites) return 0;
    return sortedGroups.reduce((count, [league, matches]) => {
      const leagueMatch = favoriteLeagues.some((fl) =>
        league.toLowerCase().includes(fl.toLowerCase())
      );
      if (leagueMatch) return count + matches.length;
      return count + matches.filter(
        (m) => favoriteTeams.includes(m.homeTeam) || favoriteTeams.includes(m.awayTeam)
      ).length;
    }, 0);
  }, [sortedGroups, hasFavorites, favoriteTeams, favoriteLeagues]);

  return (
    <div className="space-y-3">
      {/* View tabs: All / My Matches / Saved */}
      {user && (hasFavorites || hasSaved) && (
        <div className="flex rounded-lg border border-white/[0.06] bg-muted/20 p-1 w-fit">
          <button
            onClick={() => setActiveTab("all")}
            className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All matches
          </button>
          {hasFavorites && (
            <button
              onClick={() => setActiveTab("favorites")}
              className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === "favorites"
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              My Matches
              {favoriteMatchCount > 0 && (
                <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                  {favoriteMatchCount}
                </span>
              )}
            </button>
          )}
          {hasSaved && (
            <button
              onClick={() => setActiveTab("saved")}
              className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
                activeTab === "saved"
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bookmark className="h-3 w-3 fill-emerald-400 text-emerald-400" />
              Saved
              <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                {savedMatchIds.size}
              </span>
            </button>
          )}
        </div>
      )}

      {activeTab !== "all" && filteredGroups.length === 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-card/40 py-10 text-center">
          {activeTab === "favorites" ? (
            <>
              <Star className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">No favorite matches today</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Star teams or leagues to see them here
              </p>
            </>
          ) : (
            <>
              <Bookmark className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">No saved matches</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bookmark matches to track them here
              </p>
            </>
          )}
        </div>
      )}

      {filteredGroups.map(([league, matches]) => {
        const leagueHasOdds = matches.some((m) => m.hasOdds);
        return (
          <LeagueAccordion
            key={league}
            league={league}
            matches={matches}
            defaultExpanded={leagueHasOdds}
            liveSnapshots={snapshots}
          />
        );
      })}
    </div>
  );
}
