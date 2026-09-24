// KPI card (#139 admin visual direction §5): icon tile + eyebrow + trend pill, big number with a
// sparkline, one-line footnote, optional "View →" link. Pure server component — the sparkline is
// plain SVG, so a strip of six cards costs no client JavaScript.
//
// Honesty rule: an unknown value renders "—" with an amber "Unknown" badge and no trend, never 0.

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { StatusBadge, TONE_BG, TONE_TEXT, type Tone } from "./status-badge";

export function Sparkline({
  values,
  tone = "success",
  kind = "area",
  signed = false,
  className = "h-7 w-20",
}: {
  /** Oldest first. null = a gap (too few samples in that bucket). */
  values: (number | null)[];
  tone?: Tone;
  kind?: "area" | "bars";
  /** Bars: colour each bar by its own sign (success ≥ 0, danger < 0). */
  signed?: boolean;
  className?: string;
}) {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length < 2) return null;
  const W = 80;
  const H = 28;
  const lo = Math.min(0, ...nums);
  const hi = Math.max(0, ...nums, lo + 1e-9);
  const y = (v: number) => H - 2 - ((v - lo) / (hi - lo)) * (H - 4);
  const step = values.length > 1 ? W / (values.length - 1) : W;
  const color = `var(--color-${tone === "neutral" ? "muted-foreground" : ["sharp", "consensus", "model"].includes(tone) ? `method-${tone}` : tone})`;
  if (kind === "bars") {
    const bw = Math.max(2, W / values.length - 2);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden="true" preserveAspectRatio="none">
        {values.map((v, i) =>
          v == null ? null : (
            // bars grow from the zero line: up for positive values, down for negative ones
            <rect key={i} x={(i * W) / values.length + 1} y={Math.min(y(v), y(0))} width={bw} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={1} fill={signed ? (v < 0 ? "var(--color-danger)" : "var(--color-success)") : color} opacity={i === values.length - 1 ? 1 : 0.55} />
          ),
        )}
      </svg>
    );
  }
  // split into runs at gaps
  const runs: [number, number][][] = [];
  let cur: [number, number][] = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (cur.length) runs.push(cur);
      cur = [];
    } else cur.push([i * step, y(v)]);
  });
  if (cur.length) runs.push(cur);
  const id = `spark-${tone}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {runs.map((r, k) => {
        const line = r.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)},${yy.toFixed(1)}`).join(" ");
        const area = `${line} L${r[r.length - 1][0].toFixed(1)},${H} L${r[0][0].toFixed(1)},${H} Z`;
        return (
          <g key={k}>
            <path d={area} fill={`url(#${id})`} />
            <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </svg>
  );
}

export function StatCard({
  label,
  value,
  unknown = false,
  icon: Icon,
  tone = "neutral",
  trend,
  foot,
  spark,
  href,
  hrefLabel = "View",
  danger = false,
}: {
  label: ReactNode;
  value: ReactNode;
  unknown?: boolean;
  icon?: LucideIcon;
  tone?: Tone;
  trend?: ReactNode;
  foot?: ReactNode;
  spark?: ReactNode;
  href?: string;
  hrefLabel?: string;
  /** Whole-card red (Real money ARMED is the one use). */
  danger?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && (
            <span className={`hidden size-8 shrink-0 items-center justify-center rounded-lg sm:flex ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}>
              <Icon size={16} aria-hidden="true" />
            </span>
          )}
          <span className="truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        {!unknown && trend}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div className="whitespace-nowrap text-2xl font-semibold tabular-nums">{unknown ? "—" : value}</div>
        {unknown ? <StatusBadge tone="warning">Unknown</StatusBadge> : spark}
      </div>
      {foot && <div className="mt-1 text-xs text-muted-foreground">{foot}</div>}
      {href && (
        <div className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
          {hrefLabel} <ArrowRight size={12} aria-hidden="true" />
        </div>
      )}
    </>
  );
  const cls = `block rounded-xl border p-4 ${danger ? "border-destructive bg-destructive/10" : "border-border bg-card"}`;
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
