export const dynamic = 'force-dynamic';

import { Suspense, use } from "react";
import { SearchX } from "lucide-react";
import Link from "next/link";
import { getActiveMatches, getFinishedMatches, getMatchCounts, getLiveSnapshots, getFreeDailyPick, getWhatChangedToday } from "@/lib/engine-data";
import { MatchesClient } from "@/components/matches-client";
import { SignupBanner } from "@/components/signup-banner";
import { WhatChangedToday } from "@/components/what-changed-today";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import type { PublicMatch, LiveSnapshot } from "@/lib/engine-data";
import type { FreePick } from "@/components/daily-value-teaser";

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

function formatShortDate(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export interface TeaserData {
  pick: FreePick | null;
  totalCount: number;
  alreadyUnlocked: boolean;
  isPro: boolean;
}

// Sync page — renders the heading + tab toggle immediately at TTFB. LCP candidate.
export default function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = use(searchParams);
  const dayOffset = tab === "tomorrow" ? 1 : 0;

  return (
    <div className="space-y-3">
      {/* Static LCP shell — no data needed, renders at TTFB */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <Link
            href="/matches"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              dayOffset === 0
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Today
          </Link>
          <Link
            href="/matches?tab=tomorrow"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              dayOffset === 1
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Tomorrow
          </Link>
        </div>
        <span className="text-sm text-muted-foreground/50">{formatShortDate(dayOffset)}</span>
      </div>

      {/* Streams in after fast queries resolve */}
      <Suspense fallback={null}>
        <AboveFoldContent dayOffset={dayOffset} />
      </Suspense>
    </div>
  );
}

// Awaits fast queries (counts, auth, pick). Renders above-fold chrome and kicks off match list.
async function AboveFoldContent({ dayOffset }: { dayOffset: number }) {
  const [counts, authResult, { pick: freePick, totalCount: freeTotalCount }, changedItems] = await Promise.all([
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

  const { isAuthenticated, isPro, alreadyUnlocked } = authResult;

  // Serialisable — passed to MatchesClient for lazy (ssr:false) rendering below the fold.
  const teaserData: TeaserData = {
    pick: freePick,
    totalCount: freeTotalCount,
    alreadyUnlocked,
    isPro,
  };

  return (
    <>
      {!isAuthenticated && <SignupBanner />}

      {dayOffset === 0 && changedItems.length > 0 && (
        <WhatChangedToday items={changedItems} isPro={isPro} />
      )}

      {/* DailyValueTeaser is injected lazily inside MatchesClient (ssr:false) — not LCP. */}
      <Suspense fallback={null}>
        <MatchListContent dayOffset={dayOffset} isPro={isPro} counts={counts} teaserData={teaserData} />
      </Suspense>
    </>
  );
}

// Awaits the heavy match fetches (500+ rows). Streams in after AboveFoldContent.
async function MatchListContent({
  dayOffset,
  isPro,
  counts,
  teaserData,
}: {
  dayOffset: number;
  isPro: boolean;
  counts: { live: number; upcoming: number; finished: number; total: number };
  teaserData: TeaserData;
}) {
  const finishedGroupsPromise = getFinishedMatches(dayOffset).then(groupAndSort);
  const activeMatches = await getActiveMatches(dayOffset);
  const sortedGroups = groupAndSort(activeMatches);

  const liveMatchIds = activeMatches.filter((m) => m.status === "live").map((m) => m.id);
  const liveSnapshotsArr = await getLiveSnapshots(liveMatchIds);
  const initialSnapshots: Record<string, LiveSnapshot> = {};
  for (const s of liveSnapshotsArr) initialSnapshots[s.match_id] = s;

  if (sortedGroups.length === 0) {
    return (
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
    );
  }

  return (
    <MatchesClient
      sortedGroups={sortedGroups}
      initialSnapshots={initialSnapshots}
      isPro={isPro}
      counts={counts}
      finishedGroupsPromise={finishedGroupsPromise}
      teaserData={teaserData}
    />
  );
}
