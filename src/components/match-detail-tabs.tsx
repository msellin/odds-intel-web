"use client";

import type { MatchDetail } from "@/lib/types";
import { TierGate } from "@/components/tier-gate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Users,
  Cloud,
  Brain,
  Shield,
  Swords,
  Thermometer,
  Wind,
  Droplets,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Calendar,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function resultBadge(result: "W" | "D" | "L") {
  const colors = {
    W: "bg-green-500/20 text-green-400 border-green-500/30",
    D: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    L: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold border ${colors[result]}`}
    >
      {result}
    </span>
  );
}

function statusBadge(status: "out" | "doubtful" | "questionable") {
  const map = {
    out: { icon: XCircle, cls: "bg-red-500/20 text-red-400 border-red-500/30" },
    doubtful: {
      icon: AlertTriangle,
      cls: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
    questionable: {
      icon: HelpCircle,
      cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    },
  };
  const { icon: Icon, cls } = map[status];
  return (
    <Badge variant="outline" className={`${cls} gap-1 capitalize`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function confidenceBadge(confidence: "high" | "medium" | "low") {
  const cls = {
    high: "bg-green-500/20 text-green-400 border-green-500/30",
    medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    low: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };
  return (
    <Badge variant="outline" className={`${cls[confidence]} capitalize`}>
      {confidence}
    </Badge>
  );
}

function StatBox({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-sm font-semibold ${className ?? ""}`}>
        {value}
      </span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function MatchDetailTabs({ data }: { data: MatchDetail }) {
  const {
    match,
    stats,
    odds,
    oddsMovement,
    injuries,
    homeLineup,
    awayLineup,
    weather,
    referee,
    predictions,
    fixtureCongest,
  } = data;

  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;

  // Best odds per column for the 1X2 market
  const odds1x2 = odds.filter((o) => o.market === "1X2");
  const bestHome = Math.max(...odds1x2.map((o) => o.homeOdds));
  const bestDraw = Math.max(...odds1x2.map((o) => o.drawOdds));
  const bestAway = Math.max(...odds1x2.map((o) => o.awayOdds));

  // Chart data formatting
  const chartData = oddsMovement.map((m) => {
    const d = new Date(m.timestamp);
    return {
      time: `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:00`,
      Home: m.homeOdds,
      Draw: m.drawOdds,
      Away: m.awayOdds,
    };
  });

  return (
    <Tabs defaultValue="stats" className="w-full">
      <TabsList className="grid w-full grid-cols-5 bg-card border border-border">
        <TabsTrigger value="stats" className="gap-1.5 text-xs">
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Stats</span>
        </TabsTrigger>
        <TabsTrigger value="odds" className="gap-1.5 text-xs">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Odds</span>
        </TabsTrigger>
        <TabsTrigger value="team-news" className="gap-1.5 text-xs">
          <Users className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Team News</span>
        </TabsTrigger>
        <TabsTrigger value="conditions" className="gap-1.5 text-xs">
          <Cloud className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Conditions</span>
        </TabsTrigger>
        <TabsTrigger value="ai" className="gap-1.5 text-xs">
          <Brain className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AI Analysis</span>
        </TabsTrigger>
      </TabsList>

      {/* ═══════════ STATS TAB ═══════════ */}
      <TabsContent value="stats" className="space-y-4 mt-4">
        {/* Form Badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Home Form */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-400" />
                {homeTeam.name} — Last 10
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-1.5 flex-wrap">
                {stats.homeForm.results.map((r, i) => (
                  <span key={i}>{resultBadge(r.result)}</span>
                ))}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs">Opponent</TableHead>
                      <TableHead className="text-xs text-center">Res</TableHead>
                      <TableHead className="text-xs text-center">Score</TableHead>
                      <TableHead className="text-xs text-center font-mono">xG</TableHead>
                      <TableHead className="text-xs text-center font-mono">xGA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.homeForm.results.map((r, i) => (
                      <TableRow key={i} className="border-border">
                        <TableCell className="text-xs py-1.5">
                          {r.home ? "" : "@"}{r.opponent}
                        </TableCell>
                        <TableCell className="text-center py-1.5">
                          {resultBadge(r.result)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-1.5">
                          {r.goalsFor}-{r.goalsAgainst}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-1.5">
                          {r.xg.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-1.5">
                          {r.xga.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Away Form */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Swords className="h-4 w-4 text-orange-400" />
                {awayTeam.name} — Last 10
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-1.5 flex-wrap">
                {stats.awayForm.results.map((r, i) => (
                  <span key={i}>{resultBadge(r.result)}</span>
                ))}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs">Opponent</TableHead>
                      <TableHead className="text-xs text-center">Res</TableHead>
                      <TableHead className="text-xs text-center">Score</TableHead>
                      <TableHead className="text-xs text-center font-mono">xG</TableHead>
                      <TableHead className="text-xs text-center font-mono">xGA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.awayForm.results.map((r, i) => (
                      <TableRow key={i} className="border-border">
                        <TableCell className="text-xs py-1.5">
                          {r.home ? "" : "@"}{r.opponent}
                        </TableCell>
                        <TableCell className="text-center py-1.5">
                          {resultBadge(r.result)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-1.5">
                          {r.goalsFor}-{r.goalsAgainst}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-1.5">
                          {r.xg.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-1.5">
                          {r.xga.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Splits + xG */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {homeTeam.shortName} Home Record
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <StatBox
                  label="W-D-L"
                  value={`${stats.homeHomeSplits.w}-${stats.homeHomeSplits.d}-${stats.homeHomeSplits.l}`}
                />
                <StatBox label="GF" value={stats.homeHomeSplits.gf} className="text-green-400" />
                <StatBox label="GA" value={stats.homeHomeSplits.ga} className="text-red-400" />
                <StatBox
                  label="Avg xG"
                  value={stats.homeXg.toFixed(2)}
                  className="text-blue-400"
                />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {awayTeam.shortName} Away Record
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <StatBox
                  label="W-D-L"
                  value={`${stats.awayAwaySplits.w}-${stats.awayAwaySplits.d}-${stats.awayAwaySplits.l}`}
                />
                <StatBox label="GF" value={stats.awayAwaySplits.gf} className="text-green-400" />
                <StatBox label="GA" value={stats.awayAwaySplits.ga} className="text-red-400" />
                <StatBox
                  label="Avg xG"
                  value={stats.awayXg.toFixed(2)}
                  className="text-blue-400"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* H2H */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Swords className="h-4 w-4" />
              Head-to-Head — Last 5 Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Home</TableHead>
                  <TableHead className="text-xs text-center">Score</TableHead>
                  <TableHead className="text-xs">Away</TableHead>
                  <TableHead className="text-xs">Comp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.headToHead.matches.map((m, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell className="font-mono text-xs py-1.5">
                      {m.date}
                    </TableCell>
                    <TableCell className="text-xs py-1.5">{m.homeTeam}</TableCell>
                    <TableCell className="text-center font-mono text-xs font-semibold py-1.5">
                      {m.scoreHome} - {m.scoreAway}
                    </TableCell>
                    <TableCell className="text-xs py-1.5">{m.awayTeam}</TableCell>
                    <TableCell className="text-xs text-muted-foreground py-1.5">
                      {m.competition}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ═══════════ ODDS TAB ═══════════ */}
      <TabsContent value="odds" className="space-y-4 mt-4">
        <TierGate requiredTier="analyst" featureName="Odds Comparison">
        {/* Odds Comparison */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">1X2 Odds Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-xs">Bookmaker</TableHead>
                  <TableHead className="text-xs text-center">
                    Home ({homeTeam.shortName})
                  </TableHead>
                  <TableHead className="text-xs text-center">Draw</TableHead>
                  <TableHead className="text-xs text-center">
                    Away ({awayTeam.shortName})
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {odds1x2.map((o, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell className="text-xs font-medium py-2">
                      {o.bookmaker}
                    </TableCell>
                    <TableCell
                      className={`text-center font-mono text-xs py-2 ${
                        o.homeOdds === bestHome
                          ? "text-green-400 font-bold"
                          : ""
                      }`}
                    >
                      {o.homeOdds.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`text-center font-mono text-xs py-2 ${
                        o.drawOdds === bestDraw
                          ? "text-green-400 font-bold"
                          : ""
                      }`}
                    >
                      {o.drawOdds.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`text-center font-mono text-xs py-2 ${
                        o.awayOdds === bestAway
                          ? "text-green-400 font-bold"
                          : ""
                      }`}
                    >
                      {o.awayOdds.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Odds Movement Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Odds Movement (1X2)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={{ stroke: "#64748b" }}
                    axisLine={{ stroke: "#1e293b" }}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={{ stroke: "#64748b" }}
                    axisLine={{ stroke: "#1e293b" }}
                    domain={["dataMin - 0.1", "dataMax + 0.1"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Home"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#22c55e" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Draw"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#f59e0b" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Away"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#ef4444" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Home
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Draw
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Away
              </span>
            </div>
          </CardContent>
        </Card>
        </TierGate>
      </TabsContent>

      {/* ═══════════ TEAM NEWS TAB ═══════════ */}
      <TabsContent value="team-news" className="space-y-4 mt-4">
        <TierGate requiredTier="analyst" featureName="Team News & Lineups">
        {/* Injuries */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Injuries & Availability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-xs">Player</TableHead>
                  <TableHead className="text-xs">Team</TableHead>
                  <TableHead className="text-xs">Injury</TableHead>
                  <TableHead className="text-xs">Return</TableHead>
                  <TableHead className="text-xs text-center">Missed</TableHead>
                  <TableHead className="text-xs text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {injuries.map((inj, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell className="text-xs font-medium py-2">
                      {inj.player}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-2">
                      {inj.team}
                    </TableCell>
                    <TableCell className="text-xs py-2">{inj.injuryType}</TableCell>
                    <TableCell className="text-xs py-2">
                      {inj.expectedReturn}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs py-2">
                      {inj.matchesMissed}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      {statusBadge(inj.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Lineups */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { lineup: homeLineup, team: homeTeam, label: "Home" },
            { lineup: awayLineup, team: awayTeam, label: "Away" },
          ].map(({ lineup, team, label }) => (
            <Card key={label} className="border-border bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {team.name} — Confirmed XI
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="font-mono text-xs border-blue-500/30 text-blue-400"
                  >
                    {lineup.formation}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-0.5">
                  {lineup.starters.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1 px-2 rounded text-xs hover:bg-muted/30 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground w-5 text-right">
                          {p.number}
                        </span>
                        <span className="font-medium">
                          {p.name}
                          {p.isCaptain && (
                            <span className="ml-1.5 text-amber-400 font-bold">
                              (C)
                            </span>
                          )}
                        </span>
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-5 border-border text-muted-foreground"
                      >
                        {p.position}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Separator className="bg-border" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Substitutes
                  </p>
                  <div className="space-y-0.5">
                    {lineup.subs.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-1 px-2 rounded text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-mono w-5 text-right">
                            {p.number}
                          </span>
                          <span>{p.name}</span>
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-5 border-border text-muted-foreground"
                        >
                          {p.position}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </TierGate>
      </TabsContent>

      {/* ═══════════ CONDITIONS TAB ═══════════ */}
      <TabsContent value="conditions" className="space-y-4 mt-4">
        <TierGate requiredTier="analyst" featureName="Match Conditions">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Weather */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Cloud className="h-4 w-4 text-blue-400" />
                Weather at Kickoff
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Thermometer className="h-5 w-5 text-orange-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Temperature
                    </p>
                    <p className="font-mono text-sm font-semibold">
                      {weather.tempC}°C
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Wind className="h-5 w-5 text-cyan-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Wind
                    </p>
                    <p className="font-mono text-sm font-semibold">
                      {weather.windKmh} km/h {weather.windDirection}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Droplets className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Rain
                    </p>
                    <p className="font-mono text-sm font-semibold">
                      {weather.rainMm} mm
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Droplets className="h-5 w-5 text-indigo-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Humidity
                    </p>
                    <p className="font-mono text-sm font-semibold">
                      {weather.humidity}%
                    </p>
                  </div>
                </div>
              </div>
              <Separator className="my-3 bg-border" />
              <div className="text-center">
                <Badge
                  variant="outline"
                  className="text-xs border-border"
                >
                  {weather.condition}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Referee */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                Referee — {referee.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Yellows / Game
                  </p>
                  <p className="font-mono text-sm font-semibold text-amber-400">
                    {referee.yellowsPerGame}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Reds / Game
                  </p>
                  <p className="font-mono text-sm font-semibold text-red-400">
                    {referee.redsPerGame}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Pens / Game
                  </p>
                  <p className="font-mono text-sm font-semibold">
                    {referee.pensPerGame}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Fouls / Game
                  </p>
                  <p className="font-mono text-sm font-semibold">
                    {referee.foulsPerGame}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Matches This Season
                  </p>
                  <p className="font-mono text-sm font-semibold">
                    {referee.matchesThisSeason}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fixture Congestion */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-400" />
              Fixture Congestion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {homeTeam.name}
                </p>
                <div className="flex gap-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Days Since Last
                    </p>
                    <p className="font-mono text-lg font-bold">
                      {fixtureCongest.homeDaysSinceLast}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Matches in 14d
                    </p>
                    <p className="font-mono text-lg font-bold">
                      {fixtureCongest.homeMatchesIn14Days}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {awayTeam.name}
                </p>
                <div className="flex gap-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Days Since Last
                    </p>
                    <p className="font-mono text-lg font-bold">
                      {fixtureCongest.awayDaysSinceLast}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Matches in 14d
                    </p>
                    <p className="font-mono text-lg font-bold">
                      {fixtureCongest.awayMatchesIn14Days}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </TierGate>
      </TabsContent>

      {/* ═══════════ AI ANALYSIS TAB ═══════════ */}
      <TabsContent value="ai" className="space-y-4 mt-4">
        <TierGate requiredTier="sharp" featureName="AI Analysis">
        <div className="space-y-4">
          {predictions.map((pred, i) => {
            const hasValue = pred.edgePercent > 0;
            return (
              <Card
                key={i}
                className={`border-border bg-card ${
                  hasValue
                    ? "ring-1 ring-green-500/20"
                    : "opacity-70"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-sm">
                        {pred.market}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={`font-medium ${
                          hasValue
                            ? "border-green-500/30 text-green-400"
                            : "border-zinc-500/30 text-zinc-400"
                        }`}
                      >
                        {pred.selection}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {confidenceBadge(pred.confidence)}
                      {!hasValue && (
                        <Badge
                          variant="outline"
                          className="border-zinc-600 text-zinc-500 text-[10px]"
                        >
                          NO VALUE
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Probability Bars */}
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Model Probability
                        </span>
                        <span className="font-mono font-semibold text-blue-400">
                          {(pred.modelProbability * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted/30">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{
                            width: `${pred.modelProbability * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Implied Probability
                        </span>
                        <span className="font-mono font-semibold text-zinc-400">
                          {(pred.impliedProbability * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted/30">
                        <div
                          className="h-full rounded-full bg-zinc-500"
                          style={{
                            width: `${pred.impliedProbability * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Edge + Odds Row */}
                  <div className="flex items-center gap-6 flex-wrap">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Edge
                      </p>
                      <p
                        className={`font-mono text-xl font-bold ${
                          pred.edgePercent > 0
                            ? "text-green-400"
                            : pred.edgePercent < 0
                              ? "text-red-400"
                              : "text-zinc-400"
                        }`}
                      >
                        {pred.edgePercent > 0 ? "+" : ""}
                        {pred.edgePercent.toFixed(1)}%
                      </p>
                    </div>
                    <Separator
                      orientation="vertical"
                      className="h-10 bg-border"
                    />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Best Odds
                      </p>
                      <p className="font-mono text-xl font-bold">
                        {pred.currentOdds.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Bookmaker
                      </p>
                      <p className="text-sm font-medium">
                        {pred.bookmaker}
                      </p>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="rounded-lg bg-muted/20 border border-border p-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {pred.reasoning}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        </TierGate>
      </TabsContent>
    </Tabs>
  );
}
