import type { Metadata } from "next";
import {
  getPublicMatchById,
  getPublicMatchBookmakerCount,
  getMatchById,
  getMatchStats,
  getOddsMovement,
  getLiveSnapshots,
  getMatchH2H,
  getTeamStandings,
  getMatchInjuries,
  getMatchEvents,
  getMatchLineups,
  getMatchPlayerStats,
  getTeamSeasonStats,
} from "@/lib/engine-data";
import type { LiveMatch, MatchStatsData, OddsMovementPoint } from "@/lib/engine-data";
import { MatchDetailFree } from "@/components/match-detail-free";
import { MatchDetailLive } from "@/components/match-detail-live";
import { MatchScoreDisplay } from "@/components/match-score-display";
import { MatchPickButton } from "@/components/match-pick-button";
import { MatchNotes } from "@/components/match-notes";
import { CommunityVote } from "@/components/community-vote";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Calendar, Shield, MapPin, User } from "lucide-react";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await getPublicMatchById(id);

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

  // Always fetch public match data (works without auth)
  const publicMatch = await getPublicMatchById(id);

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

  // Try to get authenticated data for pro users
  let isAuthenticated = false;
  let liveMatch: LiveMatch | null = null;
  let matchStats: MatchStatsData | null = null;
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      isAuthenticated = true;
      liveMatch = await getMatchById(id);
      matchStats = await getMatchStats(id);
    }
  } catch {
    // Not authenticated — free content only
  }

  // Fetch free-tier enrichment data in parallel
  const [oddsMovement, liveSnapshotsArr, h2h, standings, injuries] = await Promise.all([
    getOddsMovement(id) as Promise<OddsMovementPoint[]>,
    getLiveSnapshots([id]),
    getMatchH2H(id),
    getTeamStandings(publicMatch.homeTeam, publicMatch.awayTeam),
    getMatchInjuries(id),
  ]);

  // Fetch Pro-tier enrichment data if authenticated
  const [matchEvents, lineups, playerStats, seasonStats] = isAuthenticated
    ? await Promise.all([
        getMatchEvents(id),
        getMatchLineups(id),
        getMatchPlayerStats(id),
        getTeamSeasonStats(
          standings.home?.teamApiId ?? null,
          standings.away?.teamApiId ?? null
        ),
      ])
    : [[], null, [], { home: null, away: null }];

  const initialSnapshot = liveSnapshotsArr[0] ?? null;

  // Bookmaker count for the pro teaser
  const bookmakerCount = publicMatch.hasOdds
    ? await getPublicMatchBookmakerCount(id)
    : 0;

  const kickoffDate = new Date(publicMatch.kickoff);
  const dateStr = kickoffDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = kickoffDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Tallinn",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/matches" className="hover:text-foreground transition-colors">
            Matches
          </Link>
          <span>/</span>
          <Link
            href="/matches"
            className="hover:text-foreground transition-colors"
          >
            Matches
          </Link>
          <span>/</span>
          <span className="text-foreground">Detail</span>
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
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-border" />

      {/* User pick + community vote + notes — free signed-in features */}
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
      />

      {/* Free content — always visible */}
      <MatchDetailFree
        match={publicMatch}
        bookmakerCount={bookmakerCount}
        h2h={h2h}
        homeStanding={standings.home}
        awayStanding={standings.away}
        hasInjuries={injuries.length > 0}
        hasLineups={publicMatch.hasLineups}
        hasStats={publicMatch.status === "finished"}
      />

      {/* Match notes — free signed-in feature */}
      <MatchNotes matchId={publicMatch.id} />

      {/* Pro content — show for all authenticated users */}
      {isAuthenticated && (liveMatch || matchEvents.length > 0 || injuries.length > 0 || lineups || playerStats.length > 0 || seasonStats.home || seasonStats.away || matchStats) && (
        <MatchDetailLive
          match={liveMatch ?? {
            id: publicMatch.id,
            homeTeam: publicMatch.homeTeam,
            awayTeam: publicMatch.awayTeam,
            kickoff: publicMatch.kickoff,
            league: publicMatch.league,
            leagueCode: "",
            sport: "soccer",
            tier: publicMatch.tier,
            odds: [],
            bestHome: publicMatch.bestHome,
            bestDraw: publicMatch.bestDraw,
            bestAway: publicMatch.bestAway,
            scrapedAt: new Date().toISOString(),
          }}
          matchStats={matchStats}
          oddsMovement={oddsMovement}
          injuries={injuries}
          matchEvents={matchEvents}
          lineups={lineups}
          playerStats={playerStats}
          homeSeasonStats={seasonStats.home}
          awaySeasonStats={seasonStats.away}
        />
      )}
    </div>
  );
}
