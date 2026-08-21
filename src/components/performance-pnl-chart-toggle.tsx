"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurvePoint {
  d: string; // YYYY-MM-DD
  cum: number;
}

type Period = "7d" | "30d" | "90d";

interface Props {
  curve30d: CurvePoint[] | null;
  curve90d: CurvePoint[] | null;
}

const PERIOD_LABEL: Record<Period, string> = {
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
};

function fmtEur(v: number): string {
  const sign = v >= 0 ? "+" : "−";
  const abs = Math.abs(v);
  if (abs >= 1000) return `${sign}€${(abs / 1000).toFixed(1)}k`;
  return `${sign}€${abs.toFixed(0)}`;
}

function shortDate(iso: string): string {
  // "2026-08-14" → "Aug 14"
  const [, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[(m ?? 1) - 1]} ${d}`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { d: string; cum: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const iso = payload[0].payload.d;
  return (
    <div className="rounded-lg border border-white/[0.1] bg-neutral-950/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="text-neutral-400 mb-1">{iso ? shortDate(iso) : label}</div>
      <div className={`font-mono text-sm font-bold ${v >= 0 ? "text-emerald-400" : "text-red-400"}`}>
        {fmtEur(v)}
      </div>
    </div>
  );
}

export function PerformancePnlChartToggle({ curve30d, curve90d }: Props) {
  const [period, setPeriod] = useState<Period>("90d");

  const activeCurve: CurvePoint[] = useMemo(() => {
    if (period === "90d") return curve90d ?? [];
    if (period === "30d") return curve30d ?? [];
    // 7d — slice the tail of the 30d curve. Only compute here so it stays
    // consistent with the 30d data source (same cohort).
    const src = curve30d ?? [];
    if (src.length <= 7) return src;
    // Slice last 7, rebase to zero so "7d P&L" reads as movement in the window,
    // not the accumulated total from the 90d start.
    const tail = src.slice(-7);
    const base = tail[0].cum;
    return tail.map((p) => ({ d: p.d, cum: Number((p.cum - base).toFixed(2)) }));
  }, [period, curve30d, curve90d]);

  const hasData = activeCurve.length >= 2;
  const endY = hasData ? activeCurve[activeCurve.length - 1].cum : 0;
  const startY = hasData ? activeCurve[0].cum : 0;
  const delta = endY - startY;
  const positive = delta >= 0;

  const peak = hasData ? Math.max(...activeCurve.map((p) => p.cum)) : 0;
  // PERF-CHART-DRAWDOWN-FIX (2026-08-21): max drawdown is the largest
  // peak-to-trough drop IN SEQUENCE (a low that came after a peak), not
  // simply max(curve) - min(curve). Previous formula gave wrong results
  // when the trough happened before the peak.
  let runningMax = -Infinity;
  let maxDrawdown = 0;
  for (const p of activeCurve) {
    if (p.cum > runningMax) runningMax = p.cum;
    const dd = runningMax - p.cum;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const points = activeCurve.map((p) => ({
    d: p.d,
    date: shortDate(p.d),
    cum: p.cum,
  }));

  const strokeColor = positive ? "#22c55e" : "#ef4444";

  return (
    <div className="rounded-xl border border-white/[0.08] bg-neutral-950/60 p-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
            Cumulative P&amp;L
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`font-mono text-2xl font-bold tabular-nums ${positive ? "text-emerald-400" : "text-red-400"}`}>
              {fmtEur(delta)}
            </span>
            <span className="text-xs text-neutral-500">
              over {activeCurve.length}d · calibrated cohort
            </span>
          </div>
        </div>

        {/* Period toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-neutral-900/60 p-0.5">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                period === p
                  ? "bg-white/[0.08] text-neutral-100"
                  : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100",
              )}
              aria-pressed={period === p}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="mt-4">
        {!hasData ? (
          <div className="flex h-52 items-center justify-center text-sm text-neutral-500">
            Not enough settled bets in this window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={points} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGradToggle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
                  <stop offset="80%" stopColor={strokeColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtEur}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "3 3" }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
              {period === "90d" && (
                <>
                  <ReferenceLine
                    x="May 6"
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{ value: "Pipeline v2", position: "insideTopRight", fontSize: 9, fill: "#f59e0b" }}
                  />
                  <ReferenceLine
                    x="May 24"
                    stroke="#a855f7"
                    strokeDasharray="3 3"
                    label={{ value: "Model v2", position: "insideTopRight", fontSize: 9, fill: "#a855f7" }}
                  />
                </>
              )}
              <Area
                type="monotone"
                dataKey="cum"
                stroke={strokeColor}
                strokeWidth={2}
                fill="url(#pnlGradToggle)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer stat strip */}
      {hasData && (
        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/[0.05] pt-3">
          <FooterStat
            icon={positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            label="Window Δ"
            value={fmtEur(delta)}
            tone={positive ? "pos" : "neg"}
          />
          <FooterStat label="Peak" value={fmtEur(peak)} tone="neutral" />
          <FooterStat label="Max drawdown" value={`−€${maxDrawdown.toFixed(0)}`} tone="neutral" />
        </div>
      )}
    </div>
  );
}

function FooterStat({
  icon,
  label,
  value,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone: "pos" | "neg" | "neutral";
}) {
  const color =
    tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-neutral-200";
  return (
    <div>
      <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        {icon}
        {label}
      </p>
      <p className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
