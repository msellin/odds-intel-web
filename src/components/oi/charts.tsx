"use client";

// Interactive chart cards (#139 admin visual direction §6) on recharts 3 (already a dependency).
// Every card follows one interaction standard: hover tooltip with a crosshair, a legend whose items
// toggle their series, and an optional range switch (7d/30d/90d-style) in the header. Styling is the
// site's: dashed horizontal grid in --border, no axis lines, muted 11px ticks, rounded bar tops.
//
// Data honesty: a bucket with too few samples is passed as null and renders as a GAP
// (connectNulls={false}); a chart never draws a smooth line through missing data.

import { useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, PanelHeader } from "./panel";

export interface Series {
  key: string;
  label: string;
  /** Any CSS colour; prefer var(--chart-n) / var(--color-method-*). */
  color: string;
  dashed?: boolean;
  /** Bars only: colour each bar by its sign (success ≥ 0, danger < 0) — for P/L. */
  signed?: boolean;
}

type Row = Record<string, string | number | null>;

const AXIS = { tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 11 } } as const;

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-8 items-center rounded-lg border border-border bg-muted/30 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`h-7 rounded-md px-2.5 text-xs transition-colors ${
            o.value === value ? "bg-accent text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function fmtDefault(v: number | string | null | undefined) {
  if (v == null) return "—";
  return typeof v === "number" ? v.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : v;
}

function TooltipBox({
  active,
  payload,
  label,
  series,
  fmt,
  labelFmt,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string | null }[];
  label?: string | number;
  series: Series[];
  fmt: (v: number | string | null | undefined, key: string) => string;
  labelFmt?: (l: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  const byKey = new Map(series.map((s) => [s.key, s]));
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      {label != null && <div className="mb-1 font-medium">{labelFmt ? labelFmt(label) : label}</div>}
      <ul className="space-y-0.5">
        {payload.map((p) => {
          const s = byKey.get(String(p.dataKey));
          if (!s) return null;
          return (
            <li key={s.key} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                {s.label}
              </span>
              <span className="font-mono tabular-nums text-foreground">{fmt(p.value, s.key)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Legend({ series, hidden, toggle }: { series: Series[]; hidden: Set<string>; toggle: (k: string) => void }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 px-4 pt-2 text-xs" aria-label="Series (click to show or hide)">
      {series.map((s) => {
        const off = hidden.has(s.key);
        return (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => toggle(s.key)}
              aria-pressed={!off}
              className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent ${off ? "opacity-40 line-through" : ""}`}
            >
              <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
              <span className="text-muted-foreground">{s.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function useHidden(initial: string[] = []) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(initial));
  const toggle = (k: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  return { hidden, toggle };
}

/**
 * Round axis ticks that always include 0 (UX re-test 2026-09-25: the CLV axis read +4.7%, +2.7%,
 * −0.3%, −3.3% with no 0). Picks a step from 1/2/2.5/5 × 10^k so there are ~4–6 ticks.
 */
export function niceTicks(values: (number | null | undefined)[]): number[] | undefined {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (v.length === 0) return undefined;
  const lo = Math.min(0, ...v);
  const hi = Math.max(0, ...v);
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= Math.ceil(hi / step) * step + step / 1e6; t += step) {
    out.push(Math.round(t / step) * step);
  }
  return out;
}

export interface RangeOption {
  value: string;
  label: string;
  /** How many trailing rows of `data` this range shows. */
  last: number;
}

/**
 * A chart card: bars (stacked or grouped), area or line over a category x-axis.
 */
export function ChartCard({
  title,
  description,
  data,
  xKey,
  series,
  kind,
  stacked = false,
  ranges,
  defaultRange,
  height = 240,
  fmt = fmtDefault as (v: number | string | null | undefined, key: string) => string,
  xFmt,
  yFmt,
  zeroLine = false,
  yDomain,
  yTicks,
  defaultHidden,
  empty,
  footer,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  data: Row[];
  xKey: string;
  series: Series[];
  kind: "bar" | "area" | "line";
  stacked?: boolean;
  ranges?: RangeOption[];
  defaultRange?: string;
  height?: number;
  fmt?: (v: number | string | null | undefined, key: string) => string;
  xFmt?: (v: string) => string;
  yFmt?: (v: number) => string;
  zeroLine?: boolean;
  /** Passed to the Y axis, e.g. [(m) => Math.min(0, m), (M) => Math.max(0, M)] to keep 0 in view. */
  yDomain?: [number | string | ((v: number) => number), number | string | ((v: number) => number)];
  /** Explicit round ticks (see niceTicks); the axis domain follows them. */
  yTicks?: number[];
  /** Series keys hidden until the viewer turns them on in the legend (opt-in series). */
  defaultHidden?: string[];
  empty?: ReactNode;
  footer?: ReactNode;
  id?: string;
}) {
  const { hidden, toggle } = useHidden(defaultHidden);
  const [range, setRange] = useState(defaultRange ?? ranges?.[ranges.length - 1]?.value ?? "");
  const rows = useMemo(() => {
    const r = ranges?.find((o) => o.value === range);
    return r ? data.slice(-r.last) : data;
  }, [data, range, ranges]);
  const visible = series.filter((s) => !hidden.has(s.key));
  const hasData = rows.some((r) => series.some((s) => r[s.key] != null && r[s.key] !== 0));

  const common = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
      <XAxis dataKey={xKey} {...AXIS} tickFormatter={xFmt} minTickGap={12} />
      <YAxis {...AXIS} width={48} tickFormatter={yFmt} ticks={yTicks} domain={yTicks ? [yTicks[0], yTicks[yTicks.length - 1]] : yDomain} allowDecimals interval={0} />
      {zeroLine && <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.4} />}
      <Tooltip
        cursor={kind === "bar" ? { fill: "var(--accent)", opacity: 0.4 } : { stroke: "var(--border)" }}
        content={<TooltipBox series={series} fmt={fmt} labelFmt={xFmt ? (l) => xFmt(String(l)) : undefined} />}
      />
    </>
  );

  return (
    <Panel id={id}>
      <PanelHeader
        title={title}
        description={footer ? <>{description}{description ? <><br /><br /></> : null}{footer}</> : description}
        actions={ranges && <Segmented label="Range" options={ranges} value={range} onChange={setRange} />}
      />
      <Legend series={series} hidden={hidden} toggle={toggle} />
      <div className="px-2 pb-3 pt-2" style={{ height }}>
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{empty ?? "No data in this range."}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}>
            {kind === "bar" ? (
              <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                {common}
                {visible.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    stackId={stacked ? "a" : undefined}
                    fill={s.color}
                    radius={stacked ? (i === visible.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]) : [3, 3, 0, 0]}
                    maxBarSize={36}
                    isAnimationActive={false}
                  >
                    {s.signed &&
                      rows.map((r, j) => (
                        <Cell key={j} fill={Number(r[s.key] ?? 0) < 0 ? "var(--color-danger)" : "var(--color-success)"} />
                      ))}
                  </Bar>
                ))}
              </BarChart>
            ) : kind === "area" ? (
              <AreaChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  {series.map((s) => (
                    <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                {common}
                {visible.map((s) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stackId={stacked ? "a" : undefined}
                    stroke={s.color}
                    strokeWidth={2}
                    strokeDasharray={s.dashed ? "4 3" : undefined}
                    fill={s.dashed ? "none" : `url(#g-${s.key})`}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                {common}
                {visible.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={2}
                    strokeDasharray={s.dashed ? "4 3" : undefined}
                    dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      {/* answer-first pass: the footer's small print joins the ⓘ tip (see PanelHeader) */}
    </Panel>
  );
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
  href?: string;
}

/** Donut with a centre figure and a clickable legend list (TailAdmin's "target" card, our tokens). */
export function DonutCard({
  title,
  description,
  slices,
  center,
  centerLabel,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  slices: Slice[];
  center: ReactNode;
  centerLabel: ReactNode;
  id?: string;
}) {
  const { hidden, toggle } = useHidden();
  const shown = slices.filter((s) => !hidden.has(s.key) && s.value > 0);
  const total = slices.reduce((a, s) => a + s.value, 0);
  return (
    <Panel id={id}>
      <PanelHeader title={title} description={description} />
      <div className="flex flex-col items-center gap-4 p-4 sm:flex-row lg:flex-col 2xl:flex-row">
        <div className="relative size-40 shrink-0">
          {total > 0 ? (
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}>
              <PieChart>
                <Pie data={shown} dataKey="value" nameKey="label" innerRadius="68%" outerRadius="100%" paddingAngle={shown.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
                  {shown.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                        {String(payload[0].name)}: <span className="font-mono tabular-nums">{String(payload[0].value)}</span>
                      </div>
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="size-full rounded-full border-[14px] border-muted" />
          )}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-semibold tabular-nums">{center}</div>
            <div className="text-[11px] text-muted-foreground">{centerLabel}</div>
          </div>
        </div>
        <ul className="w-full min-w-0 space-y-1 text-sm">
          {slices.map((s) => {
            const off = hidden.has(s.key);
            return (
              <li key={s.key} className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => toggle(s.key)} aria-pressed={!off} className={`inline-flex min-w-0 items-center gap-2 rounded px-1 hover:bg-accent ${off ? "opacity-40 line-through" : ""}`}>
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                  <span className="truncate text-muted-foreground">{s.label}</span>
                </button>
                {s.href ? (
                  <a href={s.href} className="font-mono tabular-nums hover:underline">{s.value}</a>
                ) : (
                  <span className="font-mono tabular-nums">{s.value}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
