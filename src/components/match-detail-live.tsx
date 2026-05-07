"use client";

import type {
  LiveMatch,
  MatchStatsData,
  OddsMovementPoint,
  MatchEvent,
  MatchInjury,
  LineupData,
  PlayerStat,
  TeamSeasonStat,
} from "@/lib/engine-data";
import { TierGate } from "@/components/tier-gate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  BarChart2,
  TrendingUp,
  AlertTriangle,
  Users,
  Activity,
  Star,
  SplitSquareVertical,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Tallinn",
  });
}

// ── Stat bar row ───────────────────────────────────────────────────────────

function StatBar({
  label,
  home,
  away,
  isPercent = false,
}: {
  label: string;
  home: number | null;
  away: number | null;
  isPercent?: boolean;
}) {
  if (home == null || away == null) return null;
  const total = home + away || 1;
  const homePct = Math.round((home / total) * 100);
  const awayPct = 100 - homePct;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-mono font-medium text-foreground">
          {isPercent ? `${home}%` : home}
        </span>
        <span className="text-center text-[10px] uppercase tracking-wider">{label}</span>
        <span className="font-mono font-medium text-foreground">
          {isPercent ? `${away}%` : away}
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/40">
        <div
          className="bg-emerald-500 transition-all"
          style={{ width: `${homePct}%` }}
        />
        <div
          className="bg-blue-500 transition-all"
          style={{ width: `${awayPct}%` }}
        />
      </div>
    </div>
  );
}

// ── Match events timeline ──────────────────────────────────────────────────

function EventIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t === "goal" || t === "normal goal" || t === "penalty")
    return <span className="text-base">⚽</span>;
  if (t === "own goal") return <span className="text-base">🔴</span>;
  if (t === "yellow card") return <span className="inline-block h-3 w-2 rounded-sm bg-yellow-400" />;
  if (t === "red card" || t === "yellow red card") return <span className="inline-block h-3 w-2 rounded-sm bg-red-500" />;
  if (t === "subst") return <span className="text-xs text-muted-foreground">↕</span>;
  return <span className="text-xs text-muted-foreground">•</span>;
}

function isGoalEvent(type: string) {
  const t = type.toLowerCase();
  return t === "goal" || t === "normal goal" || t === "penalty" || t === "own goal";
}

// ── Formation grid ─────────────────────────────────────────────────────────

function FormationGrid({
  players,
  side,
}: {
  players: { name: string; number: number | null; position: string | null; grid: string | null }[];
  side: "home" | "away";
}) {
  // Group by row (first digit of grid "row:col")
  const rows: Record<number, typeof players> = {};
  for (const p of players) {
    const row = p.grid ? parseInt(p.grid.split(":")[0]) : 0;
    if (!rows[row]) rows[row] = [];
    rows[row].push(p);
  }
  const rowKeys = Object.keys(rows)
    .map(Number)
    .sort((a, b) => (side === "home" ? a - b : b - a));

  return (
    <div className="space-y-2">
      {rowKeys.map((row) => (
        <div key={row} className="flex justify-center gap-3 flex-wrap">
          {rows[row].map((p, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5 min-w-[48px]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted/40 text-[10px] font-mono font-bold">
                {p.number ?? "?"}
              </div>
              <span className="text-[9px] text-muted-foreground text-center leading-tight max-w-[52px] truncate">
                {p.name.split(" ").slice(-1)[0]}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Seasonal stat row ──────────────────────────────────────────────────────

function SeasonRow({ label, home, away, unit = "" }: { label: string; home: string | null; away: string | null; unit?: string }) {
  if (!home && !away) return null;
  return (
    <div className="flex items-center justify-between py-1 text-xs border-b border-border/40 last:border-0">
      <span className="font-mono text-foreground">{home ?? "—"}{unit}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-center flex-1 px-2">{label}</span>
      <span className="font-mono text-foreground">{away ?? "—"}{unit}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface MatchDetailLiveProps {
  match: LiveMatch;
  matchStats?: MatchStatsData | null;
  oddsMovement?: OddsMovementPoint[];
  injuries?: MatchInjury[];
  matchEvents?: MatchEvent[];
  lineups?: LineupData | null;
  playerStats?: PlayerStat[];
  homeSeasonStats?: TeamSeasonStat | null;
  awaySeasonStats?: TeamSeasonStat | null;
  /** Hide events section — already shown via MatchEventTimeline */
  hideEvents?: boolean;
}

export function MatchDetailLive({
  match,
  matchStats,
  oddsMovement,
  injuries = [],
  matchEvents = [],
  lineups,
  playerStats = [],
  homeSeasonStats,
  awaySeasonStats,
  hideEvents,
}: MatchDetailLiveProps) {
  const hasOver25 = match.odds.some((o) => o.over25 > 0);
  const hasOver15 = match.odds.some((o) => o.over15 > 0);
  const hasOver35 = match.odds.some((o) => o.over35 > 0);
  const hasBtts = match.odds.some((o) => o.bttsYes > 0);

  // Format movement data for recharts
  const movementChartData = (oddsMovement ?? []).map((p) => ({
    time: fmtHour(p.timestamp),
    Home: p.bestHome > 0 ? p.bestHome : null,
    Draw: p.bestDraw > 0 ? p.bestDraw : null,
    Away: p.bestAway > 0 ? p.bestAway : null,
  }));

  const ou25ChartData = (oddsMovement ?? [])
    .filter((p) => p.bestOver25 > 0 || p.bestUnder25 > 0)
    .map((p) => ({
      time: fmtHour(p.timestamp),
      Over: p.bestOver25 > 0 ? p.bestOver25 : null,
      Under: p.bestUnder25 > 0 ? p.bestUnder25 : null,
    }));

  // Free events: goals + cards only
  const freeEvents = matchEvents.filter(
    (e) => isGoalEvent(e.eventType) || e.eventType.toLowerCase().includes("card")
  );

  const homeInjuries = injuries.filter((i) => i.teamSide === "home");
  const awayInjuries = injuries.filter((i) => i.teamSide === "away");
  const homePlayerStats = playerStats.filter((p) => p.teamSide === "home");
  const awayPlayerStats = playerStats.filter((p) => p.teamSide === "away");

  return (
    <div className="space-y-6">
      {/* ── Match Events Timeline (#12) — hidden when MatchEventTimeline is used ── */}
      {!hideEvents && freeEvents.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Match Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Free: goals + cards */}
            <div className="space-y-1.5">
              {freeEvents.map((e, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 text-xs ${
                    e.team === "home" ? "flex-row" : "flex-row-reverse"
                  }`}
                >
                  <span className="font-mono text-muted-foreground w-8 shrink-0 text-center">
                    {e.minute}&apos;{e.addedTime > 0 ? `+${e.addedTime}` : ""}
                  </span>
                  <EventIcon type={e.eventType} />
                  <span className="text-foreground/90">{e.playerName ?? "Unknown"}</span>
                  {e.assistName && (
                    <span className="text-muted-foreground">(assist: {e.assistName})</span>
                  )}
                </div>
              ))}
            </div>

            {/* Pro: full events (subs etc.) */}
            {matchEvents.length > freeEvents.length && (
              <TierGate requiredTier="pro" featureName="Full Match Events">
                <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                  {matchEvents
                    .filter((e) => !freeEvents.includes(e))
                    .map((e, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 text-xs ${
                          e.team === "home" ? "flex-row" : "flex-row-reverse"
                        }`}
                      >
                        <span className="font-mono text-muted-foreground w-8 shrink-0 text-center">
                          {e.minute}&apos;{e.addedTime > 0 ? `+${e.addedTime}` : ""}
                        </span>
                        <EventIcon type={e.eventType} />
                        <span className="text-foreground/90">{e.playerName ?? "Unknown"}</span>
                        {e.assistName && (
                          <span className="text-muted-foreground">{e.assistName}</span>
                        )}
                      </div>
                    ))}
                </div>
              </TierGate>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Odds Comparison ─────────────────────────────────────────── */}
      {match.odds.length > 0 && (
        <TierGate requiredTier="pro" featureName="Odds Comparison">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">1X2 Odds Comparison</CardTitle>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Updated {timeAgo(match.scrapedAt)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs">Operator</TableHead>
                      <TableHead className="text-xs text-center">Home</TableHead>
                      <TableHead className="text-xs text-center">Draw</TableHead>
                      <TableHead className="text-xs text-center">Away</TableHead>
                      {hasOver25 && (
                        <>
                          <TableHead className="text-xs text-center">O 2.5</TableHead>
                          <TableHead className="text-xs text-center">U 2.5</TableHead>
                        </>
                      )}
                      {hasBtts && (
                        <>
                          <TableHead className="text-xs text-center">BTTS Y</TableHead>
                          <TableHead className="text-xs text-center">BTTS N</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {match.odds.map((o) => {
                      const isBestHome = o.home > 0 && o.home === match.bestHome;
                      const isBestDraw = o.draw > 0 && o.draw === match.bestDraw;
                      const isBestAway = o.away > 0 && o.away === match.bestAway;
                      const bestOver = hasOver25
                        ? Math.max(...match.odds.filter((x) => x.over25 > 0).map((x) => x.over25))
                        : 0;
                      const bestUnder = hasOver25
                        ? Math.max(...match.odds.filter((x) => x.under25 > 0).map((x) => x.under25))
                        : 0;
                      const isBestOver = o.over25 > 0 && o.over25 === bestOver;
                      const isBestUnder = o.under25 > 0 && o.under25 === bestUnder;
                      const bestBttsYes = hasBtts
                        ? Math.max(...match.odds.filter((x) => x.bttsYes > 0).map((x) => x.bttsYes))
                        : 0;
                      const bestBttsNo = hasBtts
                        ? Math.max(...match.odds.filter((x) => x.bttsNo > 0).map((x) => x.bttsNo))
                        : 0;
                      const isBestBttsYes = o.bttsYes > 0 && o.bttsYes === bestBttsYes;
                      const isBestBttsNo = o.bttsNo > 0 && o.bttsNo === bestBttsNo;

                      return (
                        <TableRow key={o.operator} className="border-border">
                          <TableCell className="text-xs font-medium py-2">{o.operator}</TableCell>
                          <TableCell className={`text-center font-mono text-xs py-2 ${isBestHome ? "text-green-400 font-bold" : ""}`}>
                            {o.home > 0 ? o.home.toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className={`text-center font-mono text-xs py-2 ${isBestDraw ? "text-green-400 font-bold" : ""}`}>
                            {o.draw > 0 ? o.draw.toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className={`text-center font-mono text-xs py-2 ${isBestAway ? "text-green-400 font-bold" : ""}`}>
                            {o.away > 0 ? o.away.toFixed(2) : "-"}
                          </TableCell>
                          {hasOver25 && (
                            <>
                              <TableCell className={`text-center font-mono text-xs py-2 ${isBestOver ? "text-green-400 font-bold" : ""}`}>
                                {o.over25 > 0 ? o.over25.toFixed(2) : "-"}
                              </TableCell>
                              <TableCell className={`text-center font-mono text-xs py-2 ${isBestUnder ? "text-green-400 font-bold" : ""}`}>
                                {o.under25 > 0 ? o.under25.toFixed(2) : "-"}
                              </TableCell>
                            </>
                          )}
                          {hasBtts && (
                            <>
                              <TableCell className={`text-center font-mono text-xs py-2 ${isBestBttsYes ? "text-green-400 font-bold" : ""}`}>
                                {o.bttsYes > 0 ? o.bttsYes.toFixed(2) : "-"}
                              </TableCell>
                              <TableCell className={`text-center font-mono text-xs py-2 ${isBestBttsNo ? "text-green-400 font-bold" : ""}`}>
                                {o.bttsNo > 0 ? o.bttsNo.toFixed(2) : "-"}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TierGate>
      )}

      {/* ── Additional O/U Lines ────────────────────────────────────── */}
      {(hasOver15 || hasOver35) && (
        <TierGate requiredTier="pro" featureName="Additional O/U Lines">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Over/Under Lines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs">Operator</TableHead>
                      {hasOver15 && (
                        <>
                          <TableHead className="text-xs text-center">O 1.5</TableHead>
                          <TableHead className="text-xs text-center">U 1.5</TableHead>
                        </>
                      )}
                      {hasOver35 && (
                        <>
                          <TableHead className="text-xs text-center">O 3.5</TableHead>
                          <TableHead className="text-xs text-center">U 3.5</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {match.odds
                      .filter((o) => (hasOver15 && (o.over15 > 0 || o.under15 > 0)) || (hasOver35 && (o.over35 > 0 || o.under35 > 0)))
                      .map((o) => {
                        const bestO15 = hasOver15 ? Math.max(...match.odds.filter((x) => x.over15 > 0).map((x) => x.over15)) : 0;
                        const bestU15 = hasOver15 ? Math.max(...match.odds.filter((x) => x.under15 > 0).map((x) => x.under15)) : 0;
                        const bestO35 = hasOver35 ? Math.max(...match.odds.filter((x) => x.over35 > 0).map((x) => x.over35)) : 0;
                        const bestU35 = hasOver35 ? Math.max(...match.odds.filter((x) => x.under35 > 0).map((x) => x.under35)) : 0;

                        return (
                          <TableRow key={o.operator} className="border-border">
                            <TableCell className="text-xs font-medium py-2">{o.operator}</TableCell>
                            {hasOver15 && (
                              <>
                                <TableCell className={`text-center font-mono text-xs py-2 ${o.over15 > 0 && o.over15 === bestO15 ? "text-green-400 font-bold" : ""}`}>
                                  {o.over15 > 0 ? o.over15.toFixed(2) : "-"}
                                </TableCell>
                                <TableCell className={`text-center font-mono text-xs py-2 ${o.under15 > 0 && o.under15 === bestU15 ? "text-green-400 font-bold" : ""}`}>
                                  {o.under15 > 0 ? o.under15.toFixed(2) : "-"}
                                </TableCell>
                              </>
                            )}
                            {hasOver35 && (
                              <>
                                <TableCell className={`text-center font-mono text-xs py-2 ${o.over35 > 0 && o.over35 === bestO35 ? "text-green-400 font-bold" : ""}`}>
                                  {o.over35 > 0 ? o.over35.toFixed(2) : "-"}
                                </TableCell>
                                <TableCell className={`text-center font-mono text-xs py-2 ${o.under35 > 0 && o.under35 === bestU35 ? "text-green-400 font-bold" : ""}`}>
                                  {o.under35 > 0 ? o.under35.toFixed(2) : "-"}
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TierGate>
      )}

      {/* ── Injury List (#7) ─────────────────────────────────────────── */}
      {injuries.length > 0 && (
        <TierGate requiredTier="pro" featureName="Injury Report">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Injury Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { label: match.homeTeam, list: homeInjuries },
                  { label: match.awayTeam, list: awayInjuries },
                ].map(({ label, list }) => (
                  <div key={label}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                      {label}
                    </p>
                    {list.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No injuries reported</p>
                    ) : (
                      <div className="space-y-1.5">
                        {list.map((inj, i) => (
                          <div key={i} className="flex items-start justify-between gap-2">
                            <span className="text-xs text-foreground">{inj.playerName}</span>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] rounded bg-amber-500/10 text-amber-400 px-1.5 py-0.5 border border-amber-500/20">
                                {inj.status}
                              </span>
                              {inj.reason && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{inj.reason}</p>
                              )}
                              {inj.injuryCount != null && inj.injuryCount >= 3 && (
                                <p className="text-[10px] text-orange-400 mt-0.5" title="Career injury episodes">
                                  {inj.injuryCount}× injury history
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TierGate>
      )}

      {/* ── Lineup Card (#11) ────────────────────────────────────────── */}
      {lineups && (lineups.startXIHome.length > 0 || lineups.startXIAway.length > 0) && (
        <TierGate requiredTier="pro" featureName="Confirmed Lineups">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Confirmed Lineups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-medium">
                    {match.homeTeam}
                  </p>
                  {lineups.formationHome && (
                    <p className="font-mono text-xs text-foreground mb-3">{lineups.formationHome}</p>
                  )}
                  {lineups.coachHome && (
                    <p className="text-[10px] text-muted-foreground mb-3">Coach: {lineups.coachHome}</p>
                  )}
                  <FormationGrid players={lineups.startXIHome} side="home" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-medium">
                    {match.awayTeam}
                  </p>
                  {lineups.formationAway && (
                    <p className="font-mono text-xs text-foreground mb-3">{lineups.formationAway}</p>
                  )}
                  {lineups.coachAway && (
                    <p className="text-[10px] text-muted-foreground mb-3">Coach: {lineups.coachAway}</p>
                  )}
                  <FormationGrid players={lineups.startXIAway} side="away" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TierGate>
      )}

      {/* ── Team Season Stats (#6) ────────────────────────────────────── */}
      {(homeSeasonStats || awaySeasonStats) && (
        <TierGate requiredTier="pro" featureName="Team Season Stats">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Team Season Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate max-w-[120px]">
                  {match.homeTeam}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate max-w-[120px] text-right">
                  {match.awayTeam}
                </span>
              </div>
              <div className="space-y-0">
                <SeasonRow
                  label="Played"
                  home={homeSeasonStats?.playedTotal != null ? String(homeSeasonStats.playedTotal) : null}
                  away={awaySeasonStats?.playedTotal != null ? String(awaySeasonStats.playedTotal) : null}
                />
                <SeasonRow
                  label="W / D / L"
                  home={homeSeasonStats ? `${homeSeasonStats.winsTotal}/${homeSeasonStats.drawsTotal}/${homeSeasonStats.lossesTotal}` : null}
                  away={awaySeasonStats ? `${awaySeasonStats.winsTotal}/${awaySeasonStats.drawsTotal}/${awaySeasonStats.lossesTotal}` : null}
                />
                <SeasonRow
                  label="Goals For avg"
                  home={homeSeasonStats?.goalsForAvg != null ? homeSeasonStats.goalsForAvg.toFixed(2) : null}
                  away={awaySeasonStats?.goalsForAvg != null ? awaySeasonStats.goalsForAvg.toFixed(2) : null}
                />
                <SeasonRow
                  label="Goals Against avg"
                  home={homeSeasonStats?.goalsAgainstAvg != null ? homeSeasonStats.goalsAgainstAvg.toFixed(2) : null}
                  away={awaySeasonStats?.goalsAgainstAvg != null ? awaySeasonStats.goalsAgainstAvg.toFixed(2) : null}
                />
                <SeasonRow
                  label="Clean sheet %"
                  home={homeSeasonStats?.cleanSheetPct != null ? homeSeasonStats.cleanSheetPct.toFixed(0) : null}
                  away={awaySeasonStats?.cleanSheetPct != null ? awaySeasonStats.cleanSheetPct.toFixed(0) : null}
                  unit="%"
                />
                <SeasonRow
                  label="Formation"
                  home={homeSeasonStats?.mostUsedFormation ?? null}
                  away={awaySeasonStats?.mostUsedFormation ?? null}
                />
              </div>
            </CardContent>
          </Card>
        </TierGate>
      )}

      {/* ── Post-match Stats ─────────────────────────────────────────── */}
      {matchStats && (
        <TierGate requiredTier="pro" featureName="Match Statistics">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Match Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <StatBar label="Shots" home={matchStats.shots_home} away={matchStats.shots_away} />
                <StatBar label="Shots on Target" home={matchStats.shots_on_target_home} away={matchStats.shots_on_target_away} />
                <StatBar
                  label="Possession"
                  home={matchStats.possession_home}
                  away={matchStats.possession_home != null ? 100 - matchStats.possession_home : null}
                  isPercent
                />
                <StatBar label="Corners" home={matchStats.corners_home} away={matchStats.corners_away} />
                {matchStats.xg_home != null && matchStats.xg_away != null && (
                  <StatBar label="xG" home={matchStats.xg_home} away={matchStats.xg_away} />
                )}
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
                {match.homeTeam}
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mx-1 ml-3" />
                {match.awayTeam}
              </p>
            </CardContent>
          </Card>
        </TierGate>
      )}

      {/* ── HT vs FT Stats Comparison (#8) ───────────────────────────── */}
      {matchStats &&
        matchStats.shots_home_ht != null &&
        matchStats.shots_away_ht != null && (
          <TierGate requiredTier="pro" featureName="HT vs FT Comparison">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <SplitSquareVertical className="h-4 w-4" />
                  Half-time vs Full-time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    First Half
                  </p>
                  <StatBar label="Shots" home={matchStats.shots_home_ht} away={matchStats.shots_away_ht} />
                  {matchStats.shots_on_target_home_ht != null && matchStats.shots_on_target_away_ht != null && (
                    <StatBar label="Shots on Target" home={matchStats.shots_on_target_home_ht} away={matchStats.shots_on_target_away_ht} />
                  )}
                  <StatBar
                    label="Possession"
                    home={matchStats.possession_home_ht}
                    away={matchStats.possession_home_ht != null ? 100 - matchStats.possession_home_ht : null}
                    isPercent
                  />
                  <StatBar label="Corners" home={matchStats.corners_home_ht} away={matchStats.corners_away_ht} />
                  {matchStats.xg_home_ht != null && matchStats.xg_away_ht != null && (
                    <StatBar label="xG" home={matchStats.xg_home_ht} away={matchStats.xg_away_ht} />
                  )}
                  {matchStats.fouls_home_ht != null && matchStats.fouls_away_ht != null && (
                    <StatBar label="Fouls" home={matchStats.fouls_home_ht} away={matchStats.fouls_away_ht} />
                  )}
                  {matchStats.yellow_cards_home_ht != null && matchStats.yellow_cards_away_ht != null && (
                    <StatBar label="Yellow Cards" home={matchStats.yellow_cards_home_ht} away={matchStats.yellow_cards_away_ht} />
                  )}

                  {matchStats.shots_home != null && matchStats.shots_away != null && (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-4 pt-4 border-t border-border">
                        Second Half
                      </p>
                      <StatBar
                        label="Shots"
                        home={
                          matchStats.shots_home_ht != null
                            ? matchStats.shots_home - matchStats.shots_home_ht
                            : null
                        }
                        away={
                          matchStats.shots_away_ht != null
                            ? matchStats.shots_away - matchStats.shots_away_ht
                            : null
                        }
                      />
                    </>
                  )}
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
                  {match.homeTeam}
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mx-1 ml-3" />
                  {match.awayTeam}
                </p>
              </CardContent>
            </Card>
          </TierGate>
        )}

      {/* ── Player Ratings (#15) ─────────────────────────────────────── */}
      {playerStats.length > 0 && (
        <TierGate requiredTier="pro" featureName="Player Ratings">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-400" />
                Player Ratings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {[
                  { label: match.homeTeam, list: homePlayerStats },
                  { label: match.awayTeam, list: awayPlayerStats },
                ].map(({ label, list }) => (
                  <div key={label}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                      {label}
                    </p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-[10px] py-1.5">#</TableHead>
                            <TableHead className="text-[10px] py-1.5">Player</TableHead>
                            <TableHead className="text-[10px] py-1.5 text-center">Pos</TableHead>
                            <TableHead className="text-[10px] py-1.5 text-center">Rat</TableHead>
                            <TableHead className="text-[10px] py-1.5 text-center">G</TableHead>
                            <TableHead className="text-[10px] py-1.5 text-center">A</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {list
                            .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
                            .map((p, i) => (
                              <TableRow key={i} className="border-border">
                                <TableCell className="text-[10px] font-mono py-1.5 text-muted-foreground">
                                  {p.shirtNumber ?? "—"}
                                </TableCell>
                                <TableCell className="text-[10px] py-1.5 max-w-[100px] truncate">
                                  {p.playerName ?? "—"}
                                </TableCell>
                                <TableCell className="text-[10px] py-1.5 text-center text-muted-foreground">
                                  {p.position ?? "—"}
                                </TableCell>
                                <TableCell className={`text-[10px] font-mono py-1.5 text-center font-bold ${
                                  p.rating != null && p.rating >= 8
                                    ? "text-emerald-400"
                                    : p.rating != null && p.rating < 6
                                      ? "text-red-400"
                                      : "text-foreground"
                                }`}>
                                  {p.rating != null ? p.rating.toFixed(1) : "—"}
                                </TableCell>
                                <TableCell className="text-[10px] font-mono py-1.5 text-center">
                                  {p.goals ?? 0}
                                </TableCell>
                                <TableCell className="text-[10px] font-mono py-1.5 text-center">
                                  {p.assists ?? 0}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TierGate>
      )}

      {/* ── Odds Movement Chart (1X2) ─────────────────────────────────── */}
      {movementChartData.length > 1 && (
        <TierGate requiredTier="pro" featureName="Odds Movement">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Odds Movement (1X2)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={movementChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v.toFixed(2)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#14141f",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => (typeof value === "number" ? value.toFixed(2) : value)}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line
                    type="monotone"
                    dataKey="Home"
                    stroke="#22c55e"
                    dot={false}
                    strokeWidth={1.5}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="Draw"
                    stroke="#6b7280"
                    dot={false}
                    strokeWidth={1.5}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="Away"
                    stroke="#3b82f6"
                    dot={false}
                    strokeWidth={1.5}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TierGate>
      )}

      {/* ── Odds Movement Chart (O/U 2.5) ────────────────────────────── */}
      {ou25ChartData.length > 1 && (
        <TierGate requiredTier="pro" featureName="O/U 2.5 Movement">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-400" />
                Odds Movement (O/U 2.5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={ou25ChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v.toFixed(2)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#14141f",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => (typeof value === "number" ? value.toFixed(2) : value)}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line
                    type="monotone"
                    dataKey="Over"
                    stroke="#a855f7"
                    dot={false}
                    strokeWidth={1.5}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="Under"
                    stroke="#f97316"
                    dot={false}
                    strokeWidth={1.5}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TierGate>
      )}
    </div>
  );
}
