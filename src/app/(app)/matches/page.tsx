import { CalendarDays, SearchX, Info } from "lucide-react";
import { getPublicMatches, getLiveSnapshots } from "@/lib/engine-data";
import { MatchesClient } from "@/components/matches-client";
import { DailyValueTeaser } from "@/components/daily-value-teaser";
import { SignupBanner } from "@/components/signup-banner";
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

export default async function MatchesPage() {
  // Run matches fetch and auth check in parallel (previously sequential)
  const [allMatches, authResult] = await Promise.all([
    getPublicMatches(),
    (async () => {
      const supabase = await createSupabaseServer();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { isAuthenticated: false, isPro: false };
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier, is_superadmin")
        .eq("id", user.id)
        .single();
      const isElite = profile?.is_superadmin === true || profile?.tier === "elite";
      return { isAuthenticated: true, isPro: isElite || profile?.tier === "pro" };
    })(),
  ]);

  const { isAuthenticated, isPro } = authResult;

  // Group by league
  const grouped = new Map<string, PublicMatch[]>();
  for (const match of allMatches) {
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

  // Sort league groups: priority leagues first (lower number = higher), then alphabetical.
  // Like FlashScore: featured/important leagues on top, rest in alphabetical order.
  const sortedGroups = Array.from(grouped.entries()).sort(
    ([aLeague, aMatches], [bLeague, bMatches]) => {
      const aPrio = aMatches[0]?.leaguePriority;
      const bPrio = bMatches[0]?.leaguePriority;
      // Priority leagues always come before non-priority
      if (aPrio != null && bPrio == null) return -1;
      if (aPrio == null && bPrio != null) return 1;
      // Both have priority: sort by priority number (lower first)
      if (aPrio != null && bPrio != null && aPrio !== bPrio) return aPrio - bPrio;
      // Same priority or both null: leagues with odds before leagues without
      const aHasOdds = aMatches.some((m) => m.hasOdds);
      const bHasOdds = bMatches.some((m) => m.hasOdds);
      if (aHasOdds !== bHasOdds) return aHasOdds ? -1 : 1;
      // Finally: alphabetical by league name
      return aLeague.localeCompare(bLeague);
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
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          Today&apos;s Matches
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {formatDate()}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-sm text-muted-foreground">
            {allMatches.length} fixtures
          </span>
          {totalWithOdds > 0 && (
            <span className="rounded border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">
              {totalWithOdds} with odds
            </span>
          )}
          {/* Tooltip explaining data window */}
          <span className="group relative flex items-center gap-1 cursor-default">
            <Info className="size-3.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors" />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg border border-border/60 bg-popover p-2.5 text-xs text-muted-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
              Includes today&apos;s fixtures plus yesterday&apos;s finished matches. Use the <strong className="text-foreground/80">Finished</strong> tab to filter.
            </span>
          </span>
        </div>
      </div>

      {/* Sign-up banner */}
      {!isAuthenticated && <SignupBanner />}

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
              Check back later — fixtures are loaded daily at 04:00 UTC.
            </p>
          </div>
        </div>
      )}

      {/* League accordions — MatchesClient handles live score polling + client-side filtering */}
      <MatchesClient
        sortedGroups={sortedGroups}
        initialSnapshots={initialSnapshots}
        isPro={isPro}
      />
    </div>
  );
}
