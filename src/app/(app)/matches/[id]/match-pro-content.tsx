import {
  getMatchEvents,
  getMatchLineups,
  getMatchPlayerStats,
  getTeamSeasonStats,
  getLiveMatchOdds,
  getOddsMovement,
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
import { OddsMovement1X2, OddsMovementOU25 } from "@/components/odds-movement-standalone";
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

/**
 * Match tab Pro content — events, lineups, injuries, player stats, match stats
 */
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
    matchEvents,
    lineups,
    playerStats,
    liveMatch,
    matchStats,
  ] = await Promise.all([
    getMatchEvents(matchId),
    getMatchLineups(matchId),
    getMatchPlayerStats(matchId),
    getMatchById(matchId),
    getMatchStats(matchId),
  ]);

  if (!liveMatch && matchEvents.length === 0 && !lineups && injuries.length === 0 && playerStats.length === 0 && !matchStats) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">No match data available yet.</p>
      </div>
    );
  }

  return (
    <MatchDetailLive
      hideEvents
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
      oddsMovement={[]}
      injuries={injuries}
      matchEvents={matchEvents}
      lineups={lineups}
      playerStats={playerStats}
      homeSeasonStats={null}
      awaySeasonStats={null}
    />
  );
}

/**
 * Intel tab Pro content — signal timeline, why this pick, CLV tracker
 */
export async function IntelProContent({
  matchId,
  publicMatch,
  isElite,
  matchSignals,
}: {
  matchId: string;
  publicMatch: PublicMatch;
  isElite: boolean;
  matchSignals: MatchSignalRow[];
}) {
  const [signalHistory, clvData] = await Promise.all([
    getMatchSignalHistory(matchId),
    isElite ? getMatchCLVData(matchId) : Promise.resolve(null),
  ]);

  return (
    <>
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
    </>
  );
}

/**
 * Odds tab Pro content — live odds chart, odds movement charts
 */
export async function OddsProContent({
  matchId,
  publicMatch,
}: {
  matchId: string;
  publicMatch: PublicMatch;
}) {
  const [liveOdds, oddsMovement] = await Promise.all([
    getLiveMatchOdds(matchId),
    getOddsMovement(matchId) as Promise<OddsMovementPoint[]>,
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

      {oddsMovement.length > 1 && (
        <OddsMovement1X2
          data={oddsMovement}
          homeTeam={publicMatch.homeTeam}
          awayTeam={publicMatch.awayTeam}
        />
      )}

      {oddsMovement.length > 1 && (
        <OddsMovementOU25 data={oddsMovement} />
      )}
    </>
  );
}

/**
 * Context tab Pro content — season stats
 */
export async function ContextProContent({
  homeStanding,
  awayStanding,
  publicMatch,
}: {
  homeStanding: TeamStanding | null;
  awayStanding: TeamStanding | null;
  publicMatch: PublicMatch;
}) {
  const seasonStats = await getTeamSeasonStats(
    homeStanding?.teamApiId ?? null,
    awayStanding?.teamApiId ?? null
  );

  if (!seasonStats.home && !seasonStats.away) return null;

  // Render season stats inline
  const stats = [
    { label: "PLAYED", home: seasonStats.home?.playedTotal, away: seasonStats.away?.playedTotal },
    { label: "W / D / L", home: seasonStats.home ? `${seasonStats.home.winsTotal}/${seasonStats.home.drawsTotal}/${seasonStats.home.lossesTotal}` : null, away: seasonStats.away ? `${seasonStats.away.winsTotal}/${seasonStats.away.drawsTotal}/${seasonStats.away.lossesTotal}` : null },
    { label: "GOALS FOR AVG", home: seasonStats.home?.goalsForAvg?.toFixed(2), away: seasonStats.away?.goalsForAvg?.toFixed(2) },
    { label: "GOALS AGAINST AVG", home: seasonStats.home?.goalsAgainstAvg?.toFixed(2), away: seasonStats.away?.goalsAgainstAvg?.toFixed(2) },
    { label: "CLEAN SHEET %", home: seasonStats.home?.cleanSheetPct != null ? `${Math.round(seasonStats.home.cleanSheetPct)}%` : null, away: seasonStats.away?.cleanSheetPct != null ? `${Math.round(seasonStats.away.cleanSheetPct)}%` : null },
    { label: "FORMATION", home: seasonStats.home?.mostUsedFormation, away: seasonStats.away?.mostUsedFormation },
  ];

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className="text-base">📊</span>
        Team Season Stats
      </h3>
      <div className="space-y-0">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 pb-2">
          <span className="truncate max-w-[120px]">{publicMatch.homeTeam}</span>
          <span className="truncate max-w-[120px] text-right">{publicMatch.awayTeam}</span>
        </div>
        {stats.map(({ label, home, away }) => (
          <div key={label} className="flex items-center justify-between py-1.5 border-t border-white/[0.04]">
            <span className="font-mono text-xs text-foreground">{home ?? "—"}</span>
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">{label}</span>
            <span className="font-mono text-xs text-foreground text-right">{away ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
