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

/**
 * Dated engine events worth marking on the curve, so a reader can tell a change
 * WE made apart from variance.
 *
 * Previously two markers were hardcoded as `x="May 6"` / `x="May 24"` behind a
 * `period === "90d"` check. Recharts matches a categorical `x` against a value
 * present in the data, so once those dates fell out of the 90-day window the
 * lines silently stopped rendering — the check guarded the wrong thing. Driving
 * this from ISO dates and filtering on "is this day actually in the window"
 * makes a marker appear in every period it belongs to and disappear honestly
 * when it does not.
 */
const EVENTS: { iso: string; label: string; color: string }[] = [
  { iso: "2026-05-06", label: "Pipeline v2", color: "#f59e0b" },
  { iso: "2026-05-24", label: "Model v2", color: "#a855f7" },
  // OU-CALIBRATOR-DOMAIN-MISMATCH. The O/U calibration curve shipped on 09-03
  // was fitted on one probability and applied to another, which inflated every
  // long-priced O/U selection and turned the 8% edge floor into a longshot
  // filter. Removed 09-13. Both ends are marked because the drawdown between
  // them is ours, not the market's, and a reader deserves to see which is which.
  { iso: "2026-09-03", label: "Calibration bug", color: "#ef4444" },
  { iso: "2026-09-13", label: "Bug fixed", color: "#22c55e" },
];

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

  // A marker is only drawn on a day the curve actually has, because Recharts
  // matches a categorical x against the data and a miss renders nothing at all.
  const inWindow = new Set(activeCurve.map((p) => p.d));
  const visibleEvents = EVENTS.filter((e) => inWindow.has(e.iso));
  const showsBugWindow =
    visibleEvents.some((e) => e.iso === "2026-09-03") &&
    visibleEvents.some((e) => e.iso === "2026-09-13");

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
              {visibleEvents.map((e) => (
                <ReferenceLine
                  key={e.iso}
                  x={shortDate(e.iso)}
                  stroke={e.color}
                  strokeDasharray="3 3"
                  label={{ value: e.label, position: "insideTopRight", fontSize: 9, fill: e.color }}
                />
              ))}
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

      {/* What the two September markers mean, stated plainly.
          The x-axis is the day a pick was MADE (settlement.py groups the curve by
          DATE(pick_time)), so the two markers bracket exactly the picks generated
          under the bug — which is the honest way to show it. Two caveats belong
          here rather than in a footnote: both marker days are MIXED, because the
          bug shipped mid-morning on the 3rd and was removed in the evening of the
          13th; and the right-hand edge keeps filling in as newer bets settle, so
          the last few days always read low until they catch up. */}
      {hasData && showsBugWindow && (
        <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
          <span className="text-red-400">Sep 3</span> — a calibration bug began
          inflating our own edge estimate on over/under picks, so the engine
          published far more of them, at longer prices, than it should have.
          Everything between the markers is a pick made under that bug, and the
          drawdown there is ours, not variance.{" "}
          <span className="text-emerald-400">Sep 13</span> — found and removed.
          Both marker days are mixed (the bug shipped 10:49 UTC on the 3rd and was
          removed 21:00 UTC on the 13th), and because a day only counts a bet once
          it has settled, the newest days on the right keep filling in for a while
          — so read the recovery once that edge has caught up, not on day one.
        </p>
      )}

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
