"use client";

/**
 * FE-LIVE: Live in-play odds chart
 * Shows best available 1X2 odds by match minute during live matches.
 * Pro tier feature — polled every 5 minutes via client-side refetch.
 */

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  Legend,
} from "recharts";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LiveOddsSnapshot } from "@/lib/engine-data";

interface LiveOddsChartProps {
  matchId: string;
  initialData: LiveOddsSnapshot[];
  isLive: boolean; // true when match status = 'live'
  homeTeam: string;
  awayTeam: string;
}

interface ChartPoint {
  minute: string;
  Home: number | undefined;
  Draw: number | undefined;
  Away: number | undefined;
}

function toChartData(snapshots: LiveOddsSnapshot[]): ChartPoint[] {
  return snapshots.map((s) => ({
    minute: `${s.minute}'`,
    Home: s.bestHome > 0 ? s.bestHome : undefined,
    Draw: s.bestDraw > 0 ? s.bestDraw : undefined,
    Away: s.bestAway > 0 ? s.bestAway : undefined,
  }));
}

export function LiveOddsChart({
  matchId,
  initialData,
  isLive,
  homeTeam,
  awayTeam,
}: LiveOddsChartProps) {
  const [data, setData] = useState<LiveOddsSnapshot[]>(initialData);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    initialData.length > 0 ? new Date() : null
  );

  // Poll every 5 minutes during live matches
  useEffect(() => {
    if (!isLive) return;

    const fetchLive = async () => {
      try {
        const res = await fetch(`/api/live-odds?matchId=${matchId}`);
        if (!res.ok) return;
        const json = (await res.json()) as LiveOddsSnapshot[];
        if (json.length > 0) {
          setData(json);
          setLastUpdated(new Date());
        }
      } catch {
        // silently ignore — stale data is fine
      }
    };

    const interval = setInterval(fetchLive, 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, [matchId, isLive]);

  if (!data.length) {
    if (!isLive) return null; // No live odds and match isn't live
    return (
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-red-500 animate-pulse" />
            Live In-Play Odds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground py-4 text-center">
            Live odds will appear here once the match kicks off and bookmakers update their lines.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = toChartData(data);
  const latestSnapshot = data[data.length - 1];

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            {isLive && <Activity className="h-4 w-4 text-red-500 animate-pulse" />}
            In-Play Odds (1X2)
          </CardTitle>
          <div className="flex items-center gap-3 text-right">
            <div className="text-xs text-muted-foreground">
              {isLive ? (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  Live · {data.length} snapshots
                </span>
              ) : (
                `${data.length} snapshots`
              )}
            </div>
          </div>
        </div>
        {/* Current best odds row */}
        {latestSnapshot && (
          <div className="flex items-center gap-4 mt-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground truncate max-w-[80px]">{homeTeam}</span>
              <span className="font-mono font-bold text-foreground">
                {latestSnapshot.bestHome > 0 ? latestSnapshot.bestHome.toFixed(2) : "—"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Draw</span>
              <span className="font-mono font-bold text-foreground">
                {latestSnapshot.bestDraw > 0 ? latestSnapshot.bestDraw.toFixed(2) : "—"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-muted-foreground truncate max-w-[80px]">{awayTeam}</span>
              <span className="font-mono font-bold text-foreground">
                {latestSnapshot.bestAway > 0 ? latestSnapshot.bestAway.toFixed(2) : "—"}
              </span>
            </div>
            {lastUpdated && (
              <span className="ml-auto text-[10px] text-muted-foreground/60">
                {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="minute"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={{ stroke: "#64748b" }}
                axisLine={{ stroke: "#1e293b" }}
                label={{ value: "Match minute", position: "insideBottom", offset: -2, fontSize: 10, fill: "#64748b" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={{ stroke: "#64748b" }}
                axisLine={{ stroke: "#1e293b" }}
                domain={["dataMin - 0.2", "dataMax + 0.2"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(value) => [typeof value === "number" ? value.toFixed(2) : String(value), ""]}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                formatter={(value) => {
                  if (value === "Home") return homeTeam;
                  if (value === "Away") return awayTeam;
                  return value;
                }}
              />
              <Line
                type="monotone"
                dataKey="Home"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 2, fill: "#22c55e" }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="Draw"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 2, fill: "#f59e0b" }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="Away"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 2, fill: "#ef4444" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
