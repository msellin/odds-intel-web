"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";

export interface RealBetsChartPoint {
  date: string;
  real: number;
  paper: number | null;
}

function fmtEur(v: number) {
  return `${v >= 0 ? "+" : ""}€${v.toFixed(0)}`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number | null; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-card px-3 py-2 text-xs shadow-xl space-y-1">
      <div className="text-muted-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}</span>
          <span
            className={`font-mono font-semibold ml-auto ${
              p.value == null ? "text-muted-foreground" : p.value >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {p.value == null ? "—" : `${p.value >= 0 ? "+" : ""}€${p.value.toFixed(2)}`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RealBetsChart({ data }: { data: RealBetsChartPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No settled bets yet
      </div>
    );
  }

  const last = data[data.length - 1];
  const realPositive = (last?.real ?? 0) >= 0;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => fmtEur(v)}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
        <Legend
          verticalAlign="top"
          height={24}
          iconType="circle"
          wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
        />
        <Line
          type="monotone"
          dataKey="real"
          name="Real"
          stroke={realPositive ? "#22c55e" : "#ef4444"}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="paper"
          name="Paper (same picks)"
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
