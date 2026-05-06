export const dynamic = 'force-dynamic';

import { Suspense, cache } from "react";
import type { Metadata } from "next";
import {
  getPublicMatchById,
  getPublicMatchBookmakerCount,
  getLiveSnapshots,
  getMatchH2H,
  getTeamStandings,
  getMatchInjuries,
  getMatchSignals,
  getBotConsensus,
  getMatchPreview,
  getModelMarketUsers,
} from "@/lib/engine-data";
import type { MatchSignalRow } from "@/lib/engine-data";
import { MatchDetailFree } from "@/components/match-detail-free";
import { MatchScoreDisplay } from "@/components/match-score-display";
import { MatchSignalSummary } from "@/components/match-signal-summary";
import { SignalAccordion } from "@/components/signal-accordion";
import { SignalDelta } from "@/components/signal-delta";
import { MatchPickButton } from "@/components/match-pick-button";
import { MatchNotes } from "@/components/match-notes";
import { CommunityVote } from "@/components/community-vote";
import { BotConsensus } from "@/components/bot-consensus";
import { MatchPreviewCard } from "@/components/match-preview-card";
import { MatchViewingCounter } from "@/components/match-viewing-counter";
import { ModelMarketUsers } from "@/components/model-market-users";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Calendar, Shield, MapPin, User } from "lucide-react";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import { MatchProContent } from "./match-pro-content";

// Deduplicate between generateMetadata and page — same request, one DB call
const getPublicMatchCached = cache(getPublicMatchById);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await getPublicMatchCached(id);

  if (!match) {
    return { title: "Match Not Found — OddsIntel" };
  }

  const kickoff = new Date(match.kickoff);
  const dateStr = kickoff.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const title = `${match.homeTeam} vs ${match.awayTeam} — ${match.league} | OddsIntel`;
  const description = `${match.homeTeam} vs ${match.awayTeam} on ${dateStr}. Odds, H2H, injuries, standings and AI predictions on OddsIntel.`;
  const url = `https://oddsintel.app/matches/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Start supabase client creation in parallel with the match fetch
  const [publicMatch, supabase] = await Promise.all([
    getPublicMatchCached(id),
    createSupabaseServer().catch(() => null),
  ]);

  if (!publicMatch) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6">
        <div className="rounded-xl border border-border/50 bg-card px-8 py-10 text-center space-y-4 max-w-md w-full">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-muted bg-muted/30 mx-auto">
            <Shield className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">
              Match not found
            </h1>
            <p className="text-sm text-muted-foreground">
              No data available for this match. It may have been removed or
              hasn&apos;t been analyzed yet.
            </p>
          </div>
          <Link
            href="/matches"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to Matches
          </Link>
        </div>
      </div>
    );
  }

  // Run auth check AND data queries in parallel — data doesn't depend on auth
  const [
    authResult,
    liveSnapshotsArr,
    h2h,
    standings,
    injuries,
    matchSignals,
    bookmakerCount,
    botConsensus,
    matchPreview,
    modelMarketUsers,
  ] = await Promise.all([
    // Auth check (server-side field stripping — B3)
    (async () => {
      try {
        if (!supabase) return { isAuthenticated: false, isPro: false, isElite: false };
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { isAuthenticated: false, isPro: false, isElite: false };
        const tierResult = await getUserTier(user.id, supabase);
        return { isAuthenticated: true, isPro: tierResult.isPro, isElite: tierResult.isElite };
      } catch {
        return { isAuthenticated: false, isPro: false, isElite: false };
      }
    })(),
    // Data queries — all public, no auth needed
    getLiveSnapshots([id]),
    getMatchH2H(id),
    getTeamStandings(publicMatch.homeTeam, publicMatch.awayTeam),
    getMatchInjuries(id),
    getMatchSignals(id),
    publicMatch.hasOdds ? getPublicMatchBookmakerCount(id) : Promise.resolve(0),
    getBotConsensus(id),
    getMatchPreview(id),
    getModelMarketUsers(id),
  ]);

  const { isAuthenticated, isPro, isElite } = authResult;

  const initialSnapshot = liveSnapshotsArr[0] ?? null;

  const kickoffDate = new Date(publicMatch.kickoff);
  const dateStr = kickoffDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  // Time formatted in UTC (server-side); client will re-render in local timezone via suppressHydrationWarning
  const timeStr = kickoffDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/matches" className="hover:text-foreground transition-colors">
            Matches
          </Link>
          <span>/</span>
          <span className="text-foreground">{publicMatch.homeTeam} vs {publicMatch.awayTeam}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            {/* Score display — handles live (with polling), finished, and pre-match */}
            <MatchScoreDisplay
              matchId={publicMatch.id}
              status={publicMatch.status}
              homeTeam={publicMatch.homeTeam}
              awayTeam={publicMatch.awayTeam}
              finishedScoreHome={publicMatch.score_home ?? null}
              finishedScoreAway={publicMatch.score_away ?? null}
              initialSnapshot={initialSnapshot}
            />
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="text-xs border-border gap-1.5"
              >
                {publicMatch.league}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className="font-mono">{dateStr}</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="font-mono">{timeStr}</span>
              </span>
              {publicMatch.venue_name && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{publicMatch.venue_name}</span>
                </span>
              )}
              {publicMatch.referee && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{publicMatch.referee}</span>
                </span>
              )}
              <MatchViewingCounter matchId={publicMatch.id} />
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-border" />

      {/* Free content — always visible, shown first so users see data before CTAs */}
      <MatchDetailFree
        match={publicMatch}
        bookmakerCount={bookmakerCount}
        h2h={h2h}
        homeStanding={standings.home}
        awayStanding={standings.away}
        hasInjuries={injuries.length > 0}
        hasLineups={publicMatch.hasLineups}
        hasStats={publicMatch.status === "finished"}
        isAuthenticated={isAuthenticated}
        isPro={isPro}
      />

      {/* Signal Delta (SUX-9) — "what changed since last visit" — Pro only, client-side localStorage */}
      {isPro && matchSignals.length > 0 && (
        <SignalDelta
          matchId={publicMatch.id}
          signals={matchSignals}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
        />
      )}

      {/* Intelligence Summary (SUX-4/7/10) — free gets post-match reveal or teaser, pro/elite get full */}
      {matchSignals.length > 0 && (
        <MatchSignalSummary
          signals={matchSignals}
          isPro={isPro}
          isElite={isElite}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
          matchStatus={publicMatch.status}
          scoreHome={publicMatch.score_home ?? null}
          scoreAway={publicMatch.score_away ?? null}
        />
      )}

      {/* Signal group accordion (SUX-5) — Pro gets full breakdown, Free gets locked preview */}
      {matchSignals.length > 0 && (
        <SignalAccordion
          signals={matchSignals}
          isPro={isPro}
          isElite={isElite}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
        />
      )}

      {/* AI Match Preview (ENG-3) — Free gets teaser, Pro/Elite get full */}
      {matchPreview && (
        <MatchPreviewCard preview={matchPreview} isPro={isPro} />
      )}

      {/* User pick + community vote + notes — below the data so users see match info first */}
      <MatchPickButton
        matchId={publicMatch.id}
        homeTeam={publicMatch.homeTeam}
        awayTeam={publicMatch.awayTeam}
        bestHome={publicMatch.bestHome}
        bestDraw={publicMatch.bestDraw}
        bestAway={publicMatch.bestAway}
        matchStatus={publicMatch.status}
      />

      <CommunityVote
        matchId={publicMatch.id}
        homeTeam={publicMatch.homeTeam}
        awayTeam={publicMatch.awayTeam}
        matchStatus={publicMatch.status}
        isAuthenticated={isAuthenticated}
      />

      {/* ENG-12: Model vs Market vs Users triangulation */}
      {modelMarketUsers && (
        <ModelMarketUsers
          data={modelMarketUsers}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
        />
      )}

      {/* ENG-6: Bot consensus — free sees count+lock, pro sees full breakdown */}
      {botConsensus && (
        <BotConsensus
          consensus={botConsensus}
          isPro={isPro}
        />
      )}

      {/* Match notes — free signed-in feature */}
      <MatchNotes matchId={publicMatch.id} />

      {/* Pro content — streamed in after free content renders (B3: server-side field stripping) */}
      {isPro && (
        <Suspense fallback={
          <div className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        }>
          <MatchProContent
            matchId={publicMatch.id}
            publicMatch={publicMatch}
            isElite={isElite}
            injuries={injuries}
            homeStanding={standings.home}
            awayStanding={standings.away}
            matchSignals={matchSignals as MatchSignalRow[]}
          />
        </Suspense>
      )}
    </div>
  );
}
