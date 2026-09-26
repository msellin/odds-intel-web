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
  // 2026-09-26 (owner): the two calibration-bug markers (09-03 / 09-13) were removed — "they distract
  // people". The bug is still disclosed where it belongs: the per-bot detail view flags affected picks
  // and the "work behind it" card counts them (#157). The chart marks product milestones instead.
  { iso: "2026-09-24", label: "New models", color: "#38bdf8" },
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


/**
 * Days a period covers. PERF-CHART-DAY-COUNT (2026-09-22).
 *
 * Owner: *"why 90d says 68 days, 30d says 28 days and only 7d says over 7 days"*.
 * Two separate faults, and the 7d view was the worst of them even though it was
 * the one that looked right.
 *
 * (1) THE LABEL COUNTED DATA POINTS, NOT DAYS. The curve has one row per day
 *     that had a SETTLED bet — `daily_pnl_curve_*` is a GROUP BY DATE over
 *     settled rows, so a quiet day produces no row at all. Measured 2026-09-22:
 *     the 90d curve held 68 points across 89 calendar days (21 days with nothing
 *     settled) and the 30d curve 28 across 30. "over 68d" was therefore counting
 *     days-with-activity while reading as window length.
 *
 * (2) THE 7d WINDOW WAS NOT SEVEN DAYS. It was `slice(-7)` — the last seven
 *     POINTS — which on a quiet book reaches back arbitrarily far. On the day
 *     this was found it spanned Sep 13 → Sep 21, NINE days, while the label said
 *     7d and the number underneath was being read as a week's P&L. It only ever
 *     "agreed" with its label because the label counted the same points the
 *     slice took, so two bugs cancelled into a plausible-looking pair.
 *
 * Every period is now cut by DATE from the latest day in the data, so the window
 * means what the button says, and the subtitle states the real date range rather
 * than a count that can mean either thing.
 */
function sliceByDays(curve: CurvePoint[], days: number): CurvePoint[] {
  if (curve.length === 0) return curve;
  // Anchor on the last day WE HAVE, not on today: settlement lands in batches,
  // so anchoring on today silently shortens every window between runs.
  const end = new Date(`${curve[curve.length - 1].d}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startIso = start.toISOString().slice(0, 10);
  return curve.filter((p) => p.d >= startIso);
}

export function PerformancePnlChartToggle({ curve30d, curve90d }: Props) {
  const [period, setPeriod] = useState<Period>("90d");

  const activeCurve: CurvePoint[] = useMemo(() => {
    if (period === "90d") return sliceByDays(curve90d ?? [], 90);
    if (period === "30d") return sliceByDays(curve30d ?? [], 30);
    // 7d — cut the 30d curve to the last SEVEN DAYS (not the last seven points;
    // see sliceByDays). Derived from the 30d source so the cohort matches.
    const tail = sliceByDays(curve30d ?? [], 7);
    if (tail.length === 0) return tail;
    // Rebase to zero so "7d P&L" reads as movement WITHIN the window rather than
    // the accumulated total carried in from the 90d start.
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
              {/* The date range, not a count. The button already states the
                  window; what a reader cannot otherwise tell is which days it
                  actually covers — and a bare "68d" next to a "90d" button
                  invites exactly the question that produced this fix. */}
              {hasData
                ? `${shortDate(activeCurve[0].d)} – ${shortDate(activeCurve[activeCurve.length - 1].d)} · ${activeCurve.length} settled day${activeCurve.length === 1 ? "" : "s"}`
                : "calibrated cohort"}
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
