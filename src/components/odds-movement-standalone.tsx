"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { OddsMovementPoint } from "@/lib/engine-data";

function fmtHour(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

interface OddsMovementChartProps {
  data: OddsMovementPoint[];
  homeTeam: string;
  awayTeam: string;
}

export function OddsMovement1X2({ data, homeTeam, awayTeam }: OddsMovementChartProps) {
  const chartData = data.map((p) => ({
    time: fmtHour(p.timestamp),
    Home: p.bestHome > 0 ? p.bestHome : null,
    Draw: p.bestDraw > 0 ? p.bestDraw : null,
    Away: p.bestAway > 0 ? p.bestAway : null,
  }));

  if (chartData.length < 2) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Odds Movement (1X2)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#666" }} />
          <YAxis tick={{ fontSize: 10, fill: "#666" }} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#999" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="Home" stroke="#22c55e" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="Draw" stroke="#3b82f6" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="Away" stroke="#94a3b8" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OddsMovementOU25({ data }: { data: OddsMovementPoint[] }) {
  const chartData = data
    .filter((p) => p.bestOver25 > 0 || p.bestUnder25 > 0)
    .map((p) => ({
      time: fmtHour(p.timestamp),
      Over: p.bestOver25 > 0 ? p.bestOver25 : null,
      Under: p.bestUnder25 > 0 ? p.bestUnder25 : null,
    }));

  if (chartData.length < 2) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Odds Movement (O/U 2.5)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#666" }} />
          <YAxis tick={{ fontSize: 10, fill: "#666" }} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#999" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="Over" stroke="#a855f7" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="Under" stroke="#f97316" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
