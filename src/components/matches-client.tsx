"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Star } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useAuth } from "@/components/auth-provider";
import type { PublicMatch, LiveSnapshot } from "@/lib/engine-data";
import { LeagueAccordion } from "./league-accordion";

interface Props {
  sortedGroups: [string, PublicMatch[]][];
  initialSnapshots: Record<string, LiveSnapshot>;
}

export function MatchesClient({ sortedGroups, initialSnapshots }: Props) {
  const [snapshots, setSnapshots] = useState<Record<string, LiveSnapshot>>(initialSnapshots);
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");
  const { user, profile } = useAuth();

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

  const filteredGroups = useMemo(() => {
    if (activeTab === "all") return sortedGroups;

    // favorites — filter to leagues the user has starred
    if (favoriteLeagues.length === 0) return [];
    return sortedGroups.filter(([league]) =>
      favoriteLeagues.some((fl) => league.toLowerCase().includes(fl.toLowerCase()))
    );
  }, [sortedGroups, activeTab, favoriteLeagues]);

  const favoriteMatchCount = useMemo(() => {
    if (favoriteLeagues.length === 0) return 0;
    return sortedGroups.reduce((count, [league, matches]) => {
      const leagueMatch = favoriteLeagues.some((fl) =>
        league.toLowerCase().includes(fl.toLowerCase())
      );
      return leagueMatch ? count + matches.length : count;
    }, 0);
  }, [sortedGroups, favoriteLeagues]);

  return (
    <div className="space-y-3">
      {/* Tabs: All / My Matches — always shown for logged-in users */}
      {user && (
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
        </div>
      )}

      {activeTab === "favorites" && filteredGroups.length === 0 && (
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

      {filteredGroups.map(([league, matches]) => (
        <LeagueAccordion
          key={league}
          league={league}
          matches={matches}
          defaultExpanded={matches.some((m) => m.hasOdds)}
          liveSnapshots={snapshots}
        />
      ))}
    </div>
  );
}
