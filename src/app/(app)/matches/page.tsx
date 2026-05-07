export const dynamic = 'force-dynamic';

import { Suspense, use } from "react";
import { CalendarDays, SearchX, Info } from "lucide-react";
import Link from "next/link";
import { getActiveMatches, getFinishedMatches, getMatchCounts, getLiveSnapshots, getFreeDailyPick, getWhatChangedToday } from "@/lib/engine-data";
import { MatchesClient } from "@/components/matches-client";
import { DailyValueTeaser } from "@/components/daily-value-teaser";
import { SignupBanner } from "@/components/signup-banner";
import { WhatChangedToday } from "@/components/what-changed-today";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import type { PublicMatch, LiveSnapshot } from "@/lib/engine-data";

function groupAndSort(matches: PublicMatch[]): [string, PublicMatch[]][] {
  const grouped = new Map<string, PublicMatch[]>();
  for (const match of matches) {
    const existing = grouped.get(match.league) ?? [];
    existing.push(match);
    grouped.set(match.league, existing);
  }
  for (const ms of grouped.values()) {
    ms.sort((a, b) => {
      if (a.hasOdds !== b.hasOdds) return a.hasOdds ? -1 : 1;
      return a.kickoff.localeCompare(b.kickoff);
    });
  }
  return Array.from(grouped.entries()).sort(([aLeague, aMatches], [bLeague, bMatches]) => {
    const aPrio = aMatches[0]?.leaguePriority;
    const bPrio = bMatches[0]?.leaguePriority;
    if (aPrio != null && bPrio == null) return -1;
    if (aPrio == null && bPrio != null) return 1;
    if (aPrio != null && bPrio != null && aPrio !== bPrio) return aPrio - bPrio;
    const aHasOdds = aMatches.some((m) => m.hasOdds);
    const bHasOdds = bMatches.some((m) => m.hasOdds);
    if (aHasOdds !== bHasOdds) return aHasOdds ? -1 : 1;
    return aLeague.localeCompare(bLeague);
  });
}

function formatDate(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function MatchesSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-9 w-40 rounded-lg bg-white/[0.06]" />
      <div className="space-y-2 pt-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

// Sync page — renders the h1 + date + tab toggle immediately at TTFB.
// This makes the h1 the fast LCP element (~20ms) instead of waiting for data (~2.5s).
export default function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = use(searchParams);
  const dayOffset = tab === "tomorrow" ? 1 : 0;

  return (
    <div className="space-y-3">
      {/* Static shell — no data needed, streams in first bytes */}
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {formatDate(dayOffset)}
          </span>
        </div>
        <div className="flex gap-1">
          <Link
            href="/matches"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              dayOffset === 0
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Today
          </Link>
          <Link
            href="/matches?tab=tomorrow"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              dayOffset === 1
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Tomorrow
          </Link>
        </div>
      </div>

      {/* Dynamic content — streams when data fetches complete */}
      <Suspense fallback={null}>
        <MatchesContent dayOffset={dayOffset} />
      </Suspense>
    </div>
  );
}

async function MatchesContent({ dayOffset }: { dayOffset: number }) {
  const [activeMatches, counts, authResult, { pick: freePick, totalCount: freeTotalCount }, changedItems] = await Promise.all([
    getActiveMatches(dayOffset),
    getMatchCounts(dayOffset),
    (async () => {
      const supabase = await createSupabaseServer();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isAuthenticated: false, isPro: false, alreadyUnlocked: false };
      const today = new Date().toISOString().split("T")[0];
      const [{ isPro }, unlockRes] = await Promise.all([
        getUserTier(user.id, supabase),
        supabase.from("daily_unlocks").select("id")
          .eq("user_id", user.id).eq("unlock_date", today).maybeSingle(),
      ]);
      return { isAuthenticated: true, isPro, alreadyUnlocked: !!unlockRes.data };
    })(),
    getFreeDailyPick(),
    getWhatChangedToday(),
  ]);

  const finishedGroupsPromise = getFinishedMatches(dayOffset).then(groupAndSort);
  const { isAuthenticated, isPro, alreadyUnlocked } = authResult;
  const sortedGroups = groupAndSort(activeMatches);

  const liveMatchIds = activeMatches.filter((m) => m.status === "live").map((m) => m.id);
  const liveSnapshotsArr = await getLiveSnapshots(liveMatchIds);
  const initialSnapshots: Record<string, LiveSnapshot> = {};
  for (const s of liveSnapshotsArr) initialSnapshots[s.match_id] = s;

  return (
    <>
      {/* Fixture count — shown once data is ready */}
      <div className="flex flex-wrap items-center gap-3 -mt-2">
        <span className="text-sm text-muted-foreground">{counts.total} fixtures</span>
        {dayOffset === 0 && (
          <span className="group relative flex items-center gap-1 cursor-default">
            <Info className="size-3.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors" />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg border border-border/60 bg-popover p-2.5 text-xs text-muted-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
              Includes today&apos;s fixtures plus yesterday&apos;s ongoing matches. Use the <strong className="text-foreground/80">Finished</strong> tab to filter.
            </span>
          </span>
        )}
      </div>

      {!isAuthenticated && <SignupBanner />}

      {dayOffset === 0 && changedItems.length > 0 && (
        <WhatChangedToday items={changedItems} isPro={isPro} />
      )}

      <DailyValueTeaser
        pick={freePick}
        totalCount={freeTotalCount}
        alreadyUnlocked={alreadyUnlocked}
        isPro={isPro}
      />

      {sortedGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-white/[0.06] bg-card/40 py-16">
          <div className="rounded-full bg-muted p-4">
            <SearchX className="size-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No matches found</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Check back later — fixtures are loaded daily at 04:00 UTC.
            </p>
          </div>
        </div>
      )}

      <MatchesClient
        sortedGroups={sortedGroups}
        initialSnapshots={initialSnapshots}
        isPro={isPro}
        counts={counts}
        finishedGroupsPromise={finishedGroupsPromise}
      />
    </>
  );
}
