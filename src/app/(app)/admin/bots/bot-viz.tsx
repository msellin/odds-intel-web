// /admin/bots — the pictures (#139, bots-board-ux-spec §4.3, §4.4, §3).
//
// ForestBar: mean ± 95% CI of the family's admissible CLV on ONE shared x-domain for the
// whole page (−8% … +8%; intervals running past it get an arrowhead), with the zero line
// and — on mc-CLV plots — the junk control's dashed line on the bot's own market mix, so
// 20 bots can be compared by eye. WeeklyStrip: 12 ISO weeks of activity,
// coloured by the sign of that week's metric (grey when < 5 measured picks, so small weeks
// cannot flash red/green). Inline SVG, no chart library.

import type { ControlLineRef, Metric, Verdict, WeekBucket } from "./bot-board-model";
import { METRIC_SHORT as METRIC_SHORT_FMT, VERDICT_ORDER } from "./bot-board-model";
import { count, dayMonth, pct } from "./bot-board-format";

export const DOMAIN = 0.08;
const TICKS = [-0.08, -0.04, 0, 0.04, 0.08];

/** Fraction → % position on the shared domain. */
const pos = (v: number) => ((Math.max(-DOMAIN, Math.min(DOMAIN, v)) + DOMAIN) / (2 * DOMAIN)) * 100;

export const VERDICT_STROKE: Record<Verdict, string> = {
  beats: "stroke-success fill-success",
  loses: "stroke-danger fill-danger",
  inconclusive: "stroke-warning fill-warning",
  early: "stroke-muted-foreground fill-muted-foreground",
  noclv: "stroke-muted-foreground fill-muted-foreground",
};

export const VERDICT_BG: Record<Verdict, string> = {
  beats: "bg-success",
  loses: "bg-danger",
  inconclusive: "bg-warning",
  early: "bg-muted-foreground/50",
  noclv: "bg-muted-foreground/25",
};

export function ForestBar({
  mean,
  se,
  n,
  metric,
  verdict,
  control,
  height = 28,
}: {
  mean: number;
  se: number | null;
  n: number | null;
  metric: Metric;
  verdict: Verdict;
  control: ControlLineRef | null;
  height?: number;
}) {
  const half = se != null ? 1.96 * se : null;
  const lo = half != null ? mean - half : null;
  const hi = half != null ? mean + half : null;
  const cy = height / 2;
  const faded = verdict === "early";
  const tone = VERDICT_STROKE[verdict];
  const showControl = metric === "clv_mc" && control != null;
  const cLo = showControl && control.se != null ? control.mean - 1.96 * control.se : null;
  const cHi = showControl && control.se != null ? control.mean + 1.96 * control.se : null;
  const clampLo = lo != null && lo < -DOMAIN;
  const clampHi = hi != null && hi > DOMAIN;
  const label =
    `${METRIC_SHORT_FMT[metric]} ${pct(mean)}` +
    (lo != null && hi != null ? `, 95% interval ${pct(lo)} to ${pct(hi)}` : ", no interval (n < 2)") +
    `, n ${count(n)}` +
    (showControl ? `; junk control ${pct(control.mean)}${control.sameMarket ? " on the same markets" : " (pooled)"}` : "") +
    (clampLo || clampHi || Math.abs(mean) > DOMAIN ? " (runs past the plotted ±8%)" : "");
  return (
    <svg width="100%" height={height} role="img" aria-label={label} className="block overflow-visible">
      <title>{label}</title>
      {cLo != null && cHi != null && (
        <rect x={`${pos(cLo)}%`} width={`${Math.max(0.3, pos(cHi) - pos(cLo))}%`} y={0} height={height} className="fill-warning/10" />
      )}
      <line x1={`${pos(0)}%`} x2={`${pos(0)}%`} y1={0} y2={height} strokeWidth={1} className="stroke-foreground/40" />
      {showControl && (
        <line
          x1={`${pos(control.mean)}%`}
          x2={`${pos(control.mean)}%`}
          y1={0}
          y2={height}
          strokeWidth={1}
          strokeDasharray="3 3"
          className="stroke-warning/70"
        />
      )}
      <g className={tone} opacity={faded ? 0.4 : 1}>
        {lo != null && hi != null && (
          <>
            <line
              x1={`${pos(lo)}%`}
              x2={`${pos(hi)}%`}
              y1={cy}
              y2={cy}
              strokeWidth={2.5}
              strokeDasharray={faded ? "4 3" : undefined}
            />
            {clampLo ? (
              <svg x="0%" y={cy} overflow="visible">
                <polygon points="0,0 6,-5 6,5" stroke="none" />
              </svg>
            ) : (
              <line x1={`${pos(lo)}%`} x2={`${pos(lo)}%`} y1={cy - 3.5} y2={cy + 3.5} strokeWidth={2.5} />
            )}
            {clampHi ? (
              <svg x="100%" y={cy} overflow="visible">
                <polygon points="0,0 -6,-5 -6,5" stroke="none" />
              </svg>
            ) : (
              <line x1={`${pos(hi)}%`} x2={`${pos(hi)}%`} y1={cy - 3.5} y2={cy + 3.5} strokeWidth={2.5} />
            )}
          </>
        )}
        <circle cx={`${pos(mean)}%`} cy={cy} r={5} stroke="none" />
      </g>
    </svg>
  );
}

/** Mini axis (column header, card, drawer): ticks at ±8 / ±4 / 0, 12 px labels. */
export function ForestAxis() {
  return (
    <svg width="100%" height={20} aria-hidden="true" className="block overflow-visible">
      {TICKS.map((t, i) => (
        <g key={t}>
          <line x1={`${pos(t)}%`} x2={`${pos(t)}%`} y1={15} y2={20} strokeWidth={1} className={t === 0 ? "stroke-foreground/60" : "stroke-muted-foreground/50"} />
          <text
            x={`${pos(t)}%`}
            y={11}
            textAnchor={i === 0 ? "start" : i === TICKS.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground font-mono"
            fontSize={12}
          >
            {t === 0 ? "0" : `${t > 0 ? "+" : "\u2212"}${Math.round(Math.abs(t * 100))}%`}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * `compact` (row / card): only the weeks since the bot's first pick in the window, as wider
 * left-aligned bars — most bots are a few weeks old and 12 slots would be mostly empty.
 * The drawer passes compact=false and always shows all 12 weeks.
 */
export function WeeklyStrip({
  weeks: all,
  metric,
  width = 112,
  height = 28,
  fluid = false,
  compact = false,
}: {
  weeks: WeekBucket[];
  metric: Metric;
  width?: number;
  height?: number;
  fluid?: boolean;
  compact?: boolean;
}) {
  const first = all.findIndex((w) => w.picks > 0);
  const weeks = compact ? (first < 0 ? all.slice(-1) : all.slice(first)) : all;
  const max = Math.max(1, ...weeks.map((w) => w.picks));
  const slot = compact ? Math.min(22, width / weeks.length) : width / weeks.length;
  const bw = Math.max(2, slot - 3);
  const total = weeks.reduce((s, w) => s + w.picks, 0);
  const active = weeks.filter((w) => w.picks > 0).length;
  const label = `Picks per week, ${compact ? `${weeks.length} week${weeks.length === 1 ? "" : "s"} since the first pick` : "last 12 weeks"}: ${count(total)} picks in ${active} active weeks.` +
    (metric === "lift" ? " In-play: bars are grey (no CLV)." : " Bar colour = sign of that week's " + METRIC_SHORT_FMT[metric] + " (grey below 5 measured picks).");
  return (
    <svg
      width={fluid ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fluid ? "none" : undefined}
      role="img"
      aria-label={label}
      className="block"
    >
      {weeks.map((w, i) => {
        const x = i * slot + (slot - bw) / 2;
        if (w.picks === 0) {
          return <rect key={w.start} x={x} y={height - 1} width={bw} height={1} className="fill-muted-foreground/30" />;
        }
        const h = Math.max(2, (w.picks / max) * (height - 2));
        const measured = metric !== "lift" && w.clvN >= 5 && w.clvMean != null;
        const cls = !measured
          ? "fill-muted-foreground/40"
          : (w.clvMean as number) > 0
            ? "fill-success/80"
            : (w.clvMean as number) < 0
              ? "fill-danger/80"
              : "fill-muted-foreground/40";
        const title =
          `w/c ${dayMonth(new Date(w.start))} · ${count(w.picks)} pick${w.picks === 1 ? "" : "s"}` +
          (metric === "lift" ? "" : w.clvMean != null ? ` · ${METRIC_SHORT_FMT[metric]} ${pct(w.clvMean)} (n ${w.clvN})` : ` · no ${METRIC_SHORT_FMT[metric]} yet`);
        return (
          <rect key={w.start} x={x} y={height - h} width={bw} height={h} rx={1} className={cls}>
            <title>{title}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function VerdictStackBar({ counts }: { counts: Record<string, number> }) {
  const total = VERDICT_ORDER.reduce((s, k) => s + (counts[k] ?? 0), 0);
  if (total === 0) return <div className="h-2.5 w-full rounded-full bg-muted/40" />;
  return (
    <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-background" role="img" aria-label="Verdict mix of active bots">
      {VERDICT_ORDER.filter((k) => (counts[k] ?? 0) > 0).map((k) => (
        <div
          key={k}
          className={VERDICT_BG[k]}
          style={{ width: `${((counts[k] ?? 0) / total) * 100}%` }}
          title={`${counts[k]} ${k}`}
        />
      ))}
    </div>
  );
}
