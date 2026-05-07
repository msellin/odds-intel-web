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
  getMatchEvents,
  getMatchStats,
  getBotConsensus,
  getMatchPreview,
  getModelMarketUsers,
} from "@/lib/engine-data";
import type { MatchSignalRow } from "@/lib/engine-data";
import { MatchDetailHeader } from "@/components/match-detail-header";
import { MatchDetailTabs } from "@/components/match-detail-tabs";
import { MatchEventTimeline } from "@/components/match-event-timeline";
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
import { MarketImpliedProbabilities } from "@/components/market-implied-probabilities";
import { MatchStatsBars } from "@/components/match-stats-bars";
import { MatchProContent, IntelProContent, OddsProContent, ContextProContent } from "./match-pro-content";

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

  const [
    authResult,
    liveSnapshotsArr,
    h2h,
    standings,
    injuries,
    matchSignals,
    matchEvents,
    matchStats,
    bookmakerCount,
    botConsensus,
    matchPreview,
    modelMarketUsers,
  ] = await Promise.all([
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
    getLiveSnapshots([id]),
    getMatchH2H(id),
    getTeamStandings(publicMatch.homeTeam, publicMatch.awayTeam),
    getMatchInjuries(id),
    getMatchSignals(id),
    getMatchEvents(id),
    getMatchStats(id),
    publicMatch.hasOdds ? getPublicMatchBookmakerCount(id) : Promise.resolve(0),
    getBotConsensus(id),
    getMatchPreview(id),
    getModelMarketUsers(id),
  ]);

  const { isAuthenticated, isPro, isElite } = authResult;
  const initialSnapshot = liveSnapshotsArr[0] ?? null;
  const hasSignals = matchSignals.length > 0;
  const isLive = publicMatch.status === "live";

  // ── Build tab content ──

  const suspenseFallback = (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );

  // Auto-generate match context from H2H + standings
  const contextSentences: string[] = [];
  if (standings.home && standings.away) {
    contextSentences.push(
      `${publicMatch.homeTeam} are #${standings.home.rank} (${standings.home.wins}W ${standings.home.draws}D ${standings.home.losses}L), ` +
      `${publicMatch.awayTeam} are #${standings.away.rank} (${standings.away.wins}W ${standings.away.draws}D ${standings.away.losses}L).`
    );
  }
  if (h2h && (h2h.homeWins + h2h.draws + h2h.awayWins) > 0) {
    const total = h2h.homeWins + h2h.draws + h2h.awayWins;
    const dominant = h2h.homeWins > h2h.awayWins ? publicMatch.homeTeam : h2h.awayWins > h2h.homeWins ? publicMatch.awayTeam : null;
    if (dominant) {
      const wins = h2h.homeWins > h2h.awayWins ? h2h.homeWins : h2h.awayWins;
      contextSentences.push(`${dominant} lead the H2H ${wins}–${Math.min(h2h.homeWins, h2h.awayWins)} in ${total} meetings.`);
    }
  }

  // ── INTEL TAB — our differentiator, shown first ──
  const intelContent = (
    <>
      {/* Auto-generated match context */}
      {contextSentences.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {contextSentences.join(" ")}
          </p>
        </div>
      )}

      {/* Signal Delta (SUX-9) — "what changed since last visit" — Pro only */}
      {isPro && hasSignals && (
        <SignalDelta
          matchId={publicMatch.id}
          signals={matchSignals}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
        />
      )}

      {/* Market Implied Probabilities — always available when odds exist */}
      {publicMatch.hasOdds && publicMatch.bestHome > 0 && (
        <MarketImpliedProbabilities
          bestHome={publicMatch.bestHome}
          bestDraw={publicMatch.bestDraw}
          bestAway={publicMatch.bestAway}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
          modelHome={publicMatch.modelHome}
          modelDraw={publicMatch.modelDraw}
          modelAway={publicMatch.modelAway}
        />
      )}

      {/* Intelligence Summary (SUX-4/7/10) */}
      {hasSignals && (
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

      {/* Model vs Market vs Users triangulation (ENG-12) */}
      {modelMarketUsers && (
        <ModelMarketUsers
          data={modelMarketUsers}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
        />
      )}

      {/* Bot consensus (ENG-6) */}
      {botConsensus && (
        <BotConsensus consensus={botConsensus} isPro={isPro} />
      )}

      {/* AI Match Preview (ENG-3) */}
      {matchPreview && (
        <MatchPreviewCard preview={matchPreview} isPro={isPro} />
      )}

      {/* Match Pick */}
      <MatchPickButton
        matchId={publicMatch.id}
        homeTeam={publicMatch.homeTeam}
        awayTeam={publicMatch.awayTeam}
        bestHome={publicMatch.bestHome}
        bestDraw={publicMatch.bestDraw}
        bestAway={publicMatch.bestAway}
        matchStatus={publicMatch.status}
      />

      {/* Signal group accordion (SUX-5) */}
      {hasSignals && (
        <SignalAccordion
          signals={matchSignals}
          isPro={isPro}
          isElite={isElite}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
        />
      )}

      {/* Pro: signal timeline, why this pick, CLV */}
      {isPro && (
        <Suspense fallback={suspenseFallback}>
          <IntelProContent
            matchId={publicMatch.id}
            publicMatch={publicMatch}
            isElite={isElite}
            matchSignals={matchSignals as MatchSignalRow[]}
          />
        </Suspense>
      )}

      {/* Empty state when truly no intel content */}
      {!hasSignals && !botConsensus && !matchPreview && !modelMarketUsers && !publicMatch.hasOdds && contextSentences.length === 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Intelligence data is being collected for this match.
          </p>
          <p className="text-xs text-muted-foreground/50">
            Signals, predictions, and model analysis will appear here as data flows in.
          </p>
        </div>
      )}
    </>
  );

  // ── MATCH TAB — events, lineups, injuries, stats ──
  const matchContent = (
    <>
      {/* Visual event timeline — shown to all tiers */}
      {matchEvents.length > 0 && (
        <MatchEventTimeline
          events={matchEvents}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
        />
      )}

      {/* Match stats bars — shown to all tiers */}
      {matchStats && (
        <MatchStatsBars
          stats={matchStats}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
        />
      )}

      {isPro ? (
        <Suspense fallback={suspenseFallback}>
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
      ) : (
        <div className="rounded-xl border border-border/50 bg-card p-5 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Match events, lineups, and stats are available on Pro.
          </p>
          {injuries.length > 0 && (
            <p className="text-xs text-muted-foreground/60">
              {injuries.length} injuries tracked for this match.
            </p>
          )}
        </div>
      )}
    </>
  );

  // ── ODDS TAB — odds display, movement charts ──
  const oddsContent = (
    <>
      {/* Best Available Odds — compact display */}
      {publicMatch.hasOdds && publicMatch.bestHome > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Best Available Odds</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Home</div>
              <div className="font-mono text-lg font-bold text-foreground">{publicMatch.bestHome.toFixed(2)}</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Draw</div>
              <div className="font-mono text-lg font-bold text-foreground">{publicMatch.bestDraw.toFixed(2)}</div>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Away</div>
              <div className="font-mono text-lg font-bold text-foreground">{publicMatch.bestAway.toFixed(2)}</div>
            </div>
          </div>
          {bookmakerCount > 1 && (
            <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
              Best prices across {bookmakerCount} bookmakers
            </p>
          )}
        </div>
      )}

      {/* Pro: live odds chart + odds movement */}
      {isPro ? (
        <Suspense fallback={suspenseFallback}>
          <OddsProContent matchId={publicMatch.id} publicMatch={publicMatch} />
        </Suspense>
      ) : publicMatch.hasOdds ? (
        <div className="rounded-xl border border-border/50 bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Odds movement charts and bookmaker comparison available on Pro.
          </p>
        </div>
      ) : null}
    </>
  );

  // ── CONTEXT TAB — H2H, standings, season stats, notes ──
  const contextContent = (
    <>
      {/* Venue + Referee info row */}
      {(publicMatch.venue_name || publicMatch.referee) && (
        <div className="rounded-xl border border-border/50 bg-card px-4 py-3 flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
          {publicMatch.venue_name && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3 shrink-0" />
              {publicMatch.venue_name}
            </span>
          )}
          {publicMatch.referee && (
            <span className="flex items-center gap-1.5">
              <User className="size-3 shrink-0" />
              Ref: {publicMatch.referee}
            </span>
          )}
        </div>
      )}

      {/* H2H + League Table (from MatchDetailFree, hiding odds + coverage) */}
      <MatchDetailFree
        match={publicMatch}
        bookmakerCount={0}
        h2h={h2h}
        homeStanding={standings.home}
        awayStanding={standings.away}
        hasInjuries={false}
        hasLineups={false}
        hasStats={false}
        isAuthenticated={isAuthenticated}
        isPro={isPro}
        hideOdds
        hideCoverage
      />

      {/* Pro: season stats */}
      {isPro && (
        <Suspense fallback={suspenseFallback}>
          <ContextProContent
            homeStanding={standings.home}
            awayStanding={standings.away}
            publicMatch={publicMatch}
          />
        </Suspense>
      )}

      {/* Community Vote */}
      <CommunityVote
        matchId={publicMatch.id}
        homeTeam={publicMatch.homeTeam}
        awayTeam={publicMatch.awayTeam}
        matchStatus={publicMatch.status}
        isAuthenticated={isAuthenticated}
      />

      {/* Match notes */}
      <MatchNotes matchId={publicMatch.id} />
    </>
  );

  return (
    <div className="space-y-3">
      {/* New compact header with team logos, score, AI prediction, grade, inline odds */}
      <MatchDetailHeader
        match={publicMatch}
        initialSnapshot={initialSnapshot}
      />

      <Separator className="bg-border" />

      {/* Tabbed content */}
      <MatchDetailTabs
        intelContent={intelContent}
        matchContent={matchContent}
        oddsContent={oddsContent}
        contextContent={contextContent}
        hasSignals={hasSignals}
        defaultTab={isLive ? "intel" : "intel"}
      />
    </div>
  );
}
