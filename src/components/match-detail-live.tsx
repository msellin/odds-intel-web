"use client";

import type { LiveMatch, MatchStatsData, OddsMovementPoint } from "@/lib/engine-data";
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
import { Clock, BarChart2, TrendingUp } from "lucide-react";
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

// ── Main Component ─────────────────────────────────────────────────────────

interface MatchDetailLiveProps {
  match: LiveMatch;
  matchStats?: MatchStatsData | null;
  oddsMovement?: OddsMovementPoint[];
}

export function MatchDetailLive({ match, matchStats, oddsMovement }: MatchDetailLiveProps) {
  const hasOver25 = match.odds.some((o) => o.over25 > 0);

  // Format movement data for recharts
  const movementChartData = (oddsMovement ?? []).map((p) => ({
    time: fmtHour(p.timestamp),
    Home: p.bestHome > 0 ? p.bestHome : null,
    Draw: p.bestDraw > 0 ? p.bestDraw : null,
    Away: p.bestAway > 0 ? p.bestAway : null,
  }));

  return (
    <div className="space-y-6">
      {/* ── Odds Comparison (Task 4) ─────────────────────────────── */}
      <TierGate requiredTier="analyst" featureName="Odds Comparison">
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TierGate>

      {/* ── Post-match Stats (Task 3) ─────────────────────────────── */}
      {matchStats && (
        <TierGate requiredTier="analyst" featureName="Match Statistics">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Match Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <StatBar
                  label="Shots"
                  home={matchStats.shots_home}
                  away={matchStats.shots_away}
                />
                <StatBar
                  label="Shots on Target"
                  home={matchStats.shots_on_target_home}
                  away={matchStats.shots_on_target_away}
                />
                <StatBar
                  label="Possession"
                  home={matchStats.possession_home}
                  away={matchStats.possession_home != null ? 100 - matchStats.possession_home : null}
                  isPercent
                />
                <StatBar
                  label="Corners"
                  home={matchStats.corners_home}
                  away={matchStats.corners_away}
                />
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

      {/* ── Odds Movement Chart (Task 5) ──────────────────────────── */}
      {movementChartData.length > 1 && (
        <TierGate requiredTier="analyst" featureName="Odds Movement">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Odds Movement
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
    </div>
  );
}
