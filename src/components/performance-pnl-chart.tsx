"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { PublicPnlPoint } from "@/lib/engine-data";

function fmtEur(v: number) {
  if (Math.abs(v) >= 1000) return `${v >= 0 ? "+" : ""}€${(v / 1000).toFixed(1)}k`;
  return `${v >= 0 ? "+" : ""}€${v.toFixed(0)}`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-card px-3 py-2 text-xs shadow-xl">
      <div className="text-muted-foreground mb-1">{label}</div>
      <div className={`font-mono font-bold ${v >= 0 ? "text-emerald-400" : "text-red-400"}`}>
        {fmtEur(v)}
      </div>
    </div>
  );
}

export function PerformancePnlChart({ data }: { data: PublicPnlPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
        No settled bets yet
      </div>
    );
  }
  const last = data[data.length - 1].cumPnl;
  const positive = last >= 0;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={positive ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
            <stop offset="95%" stopColor={positive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={32} />
        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={fmtEur} width={48} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
        <ReferenceLine x="05-06" stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "Pipeline v2", position: "insideTopRight", fontSize: 9, fill: "#f59e0b" }} />
        <ReferenceLine x="05-24" stroke="#a855f7" strokeDasharray="3 3" label={{ value: "Model v2", position: "insideTopRight", fontSize: 9, fill: "#a855f7" }} />
        <Area type="monotone" dataKey="cumPnl" stroke={positive ? "#22c55e" : "#ef4444"} strokeWidth={2} fill="url(#pnlGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
