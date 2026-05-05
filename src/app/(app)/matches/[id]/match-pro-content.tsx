import {
  getOddsMovement,
  getMatchEvents,
  getMatchLineups,
  getMatchPlayerStats,
  getTeamSeasonStats,
  getLiveMatchOdds,
  getMatchSignalHistory,
  getMatchCLVData,
  getMatchById,
  getMatchStats,
} from "@/lib/engine-data";
import type {
  PublicMatch,
  TeamStanding,
  MatchInjury,
  MatchSignalRow,
  OddsMovementPoint,
} from "@/lib/engine-data";
import { LiveOddsChart } from "@/components/live-odds-chart";
import { SignalTimeline } from "@/components/signal-timeline";
import { WhyThisPick } from "@/components/why-this-pick";
import { CLVTracker } from "@/components/clv-tracker";
import { MatchDetailLive } from "@/components/match-detail-live";

interface MatchProContentProps {
  matchId: string;
  publicMatch: PublicMatch;
  isElite: boolean;
  injuries: MatchInjury[];
  homeStanding: TeamStanding | null;
  awayStanding: TeamStanding | null;
  matchSignals: MatchSignalRow[];
}

export async function MatchProContent({
  matchId,
  publicMatch,
  isElite,
  injuries,
  homeStanding,
  awayStanding,
  matchSignals,
}: MatchProContentProps) {
  const [
    oddsMovement,
    matchEvents,
    lineups,
    playerStats,
    seasonStats,
    liveOdds,
    signalHistory,
    clvData,
    liveMatch,
    matchStats,
  ] = await Promise.all([
    getOddsMovement(matchId) as Promise<OddsMovementPoint[]>,
    getMatchEvents(matchId),
    getMatchLineups(matchId),
    getMatchPlayerStats(matchId),
    getTeamSeasonStats(
      homeStanding?.teamApiId ?? null,
      awayStanding?.teamApiId ?? null
    ),
    getLiveMatchOdds(matchId),
    getMatchSignalHistory(matchId),
    isElite ? getMatchCLVData(matchId) : Promise.resolve(null),
    getMatchById(matchId),
    getMatchStats(matchId),
  ]);

  return (
    <>
      {(publicMatch.status === "live" || publicMatch.status === "finished") && (
        <LiveOddsChart
          matchId={matchId}
          initialData={liveOdds}
          isLive={publicMatch.status === "live"}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
        />
      )}

      {(signalHistory as MatchSignalRow[]).length > 0 && (
        <SignalTimeline
          signals={signalHistory as MatchSignalRow[]}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
        />
      )}

      {isElite && matchSignals.length > 0 && (
        <WhyThisPick
          signals={matchSignals}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
        />
      )}

      {isElite && clvData && (
        <CLVTracker
          clvData={clvData}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
          matchStatus={publicMatch.status}
        />
      )}

      {(liveMatch ||
        matchEvents.length > 0 ||
        injuries.length > 0 ||
        lineups ||
        playerStats.length > 0 ||
        seasonStats.home ||
        seasonStats.away ||
        matchStats) && (
        <MatchDetailLive
          match={
            liveMatch ?? {
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
            }
          }
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
    </>
  );
}
