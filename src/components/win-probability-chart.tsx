/**
 * Live in-play Win Probability chart — server-rendered SVG.
 *
 * Three stacked areas (home / draw / away) plotted against match minute.
 * No chart library — keeps the bundle light and lets us SSR the initial
 * paint so the curve is visible before any JS hydrates.
 *
 * Auto-updates for live matches are handled by the thin client wrapper
 * `WinProbabilityChartLive` (lazy-loaded), which polls `/api/matches/[id]/wp`
 * every 60s and re-renders just the pill + a trailing dot.
 *
 * Mobile-first: the SVG uses a viewBox so it scales fluidly down to 320px.
 * Padding, fonts and event markers stay readable at the smallest size.
 */

import type { MatchEvent } from "@/lib/engine-data";
import type { WPSeriesPoint } from "@/lib/wp-series";
import { WinProbabilityChartLive } from "@/components/win-probability-chart-live";

/**
 * WC-D3 — goal annotation surfaced as a diamond on the curve. Optional so
 * the chart stays backwards-compatible with non-WC club callers that never
 * pass a `goals` prop.
 */
export interface WpChartGoal {
  minute: number;
  team: "home" | "away";
  scorer?: string | null;
  score_after_home?: number;
  score_after_away?: number;
}

interface WinProbabilityChartProps {
  matchId: string;
  series: WPSeriesPoint[];
  current: WPSeriesPoint | null;
  homeTeam: string;
  awayTeam: string;
  /** "scheduled" | "live" | "finished" — drives polling + title decoration */
  status: string;
  /** Pro tier sees event markers + labels; Free sees the curve + pill only. */
  isPro: boolean;
  matchEvents?: MatchEvent[];
  /**
   * WC-D3: tournament-green/gold diamond markers at every goal minute.
   * Optional — when omitted (every non-WC club call site) the chart still
   * renders unchanged.
   */
  goals?: WpChartGoal[];
}

// ─── Geometry constants (SVG user units) ────────────────────────────────────
//
// We render into a 600×220 viewBox. The SVG itself is `width="100%"` so it
// scales to the container. At a typical phone width of 375px the on-screen
// height is ≈137px which is the sweet spot for "readable but doesn't take the
// whole fold".

const VB_W = 600;
const VB_H = 220;
const PAD_LEFT = 24;
const PAD_RIGHT = 8;
const PAD_TOP = 18;
const PAD_BOTTOM = 22;
const PLOT_W = VB_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VB_H - PAD_TOP - PAD_BOTTOM;

// Colour palette — matches the rest of match-detail (green = home, gray =
// draw, purple = away).
const COLOR_HOME = "#22c55e";
const COLOR_DRAW = "#6b7280";
const COLOR_AWAY = "#a855f7";

// WC-D3 — diamond palette. Tournament green for the home scorer, gold for the
// away scorer. Picked to read clearly against both the green/gray/purple band
// stack and the existing Pro circle markers without colliding with either.
const DIAMOND_HOME = "#10b981";
const DIAMOND_AWAY = "#facc15";
const DIAMOND_HALF = 5.5; // half-diagonal in SVG user units

function xFor(minute: number): number {
  return PAD_LEFT + (Math.max(0, Math.min(90, minute)) / 90) * PLOT_W;
}

function yFor(frac: number): number {
  // frac is 0-1, y-axis flipped (0% at bottom, 100% at top).
  return PAD_TOP + (1 - Math.max(0, Math.min(1, frac))) * PLOT_H;
}

interface BandPath {
  /** SVG path "d" attribute */
  d: string;
}

/**
 * Build three stacked-area paths from the series.
 *
 * Stacking order (bottom → top): home / draw / away.
 * That way the "home certain" region is a thick band at the bottom and the
 * "away certain" region pushes everything up.
 */
function buildBands(series: WPSeriesPoint[]): { home: BandPath; draw: BandPath; away: BandPath } {
  if (series.length === 0) {
    return { home: { d: "" }, draw: { d: "" }, away: { d: "" } };
  }

  // Top edges of each band (in 0-1 fractional space, stacked).
  const homeTop = series.map((p) => p.homeProb);
  const drawTop = series.map((p) => p.homeProb + p.drawProb);
  const awayTop = series.map(() => 1); // always 1

  const buildArea = (topFrac: number[], bottomFrac: number[]) => {
    const parts: string[] = [];
    // Top edge (left → right)
    series.forEach((p, i) => {
      const x = xFor(p.minute);
      const y = yFor(topFrac[i]);
      parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    });
    // Bottom edge (right → left)
    for (let i = series.length - 1; i >= 0; i--) {
      const x = xFor(series[i].minute);
      const y = yFor(bottomFrac[i]);
      parts.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
    }
    parts.push("Z");
    return parts.join(" ");
  };

  const zero = series.map(() => 0);

  return {
    home: { d: buildArea(homeTop, zero) },
    draw: { d: buildArea(drawTop, homeTop) },
    away: { d: buildArea(awayTop, drawTop) },
  };
}

// ─── Event markers ──────────────────────────────────────────────────────────

interface EventMarker {
  minute: number;
  team: "home" | "away";
  kind: "goal" | "red";
  label: string | null;
}

function selectMarkers(events: MatchEvent[] | undefined): EventMarker[] {
  if (!events?.length) return [];
  const out: EventMarker[] = [];
  for (const e of events) {
    const t = e.eventType.toLowerCase();
    const isGoal = t === "goal" || t === "normal goal" || t === "penalty" || t === "own goal";
    const isRed = t === "red card" || t === "yellow red card";
    if (!isGoal && !isRed) continue;
    out.push({
      minute: Math.min(e.minute + (e.addedTime || 0), 90),
      team: e.team,
      kind: isGoal ? "goal" : "red",
      label: e.playerName,
    });
  }
  return out;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WinProbabilityChart({
  matchId,
  series,
  current,
  homeTeam,
  awayTeam,
  status,
  isPro,
  matchEvents,
  goals,
}: WinProbabilityChartProps) {
  // Pre-match: render a teaser instead of a flat line.
  if (status === "scheduled" || series.length < 2) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Win Probability
        </h3>
        <p className="text-xs text-muted-foreground/80">
          Win probability tracking will start when the match kicks off.
        </p>
      </div>
    );
  }

  const bands = buildBands(series);
  const markers = isPro ? selectMarkers(matchEvents) : [];

  // WC-D3 — resolve each goal's y position by snapping to the nearest series
  // point's homeProb (top edge of the home band). That places the diamond
  // right on the curve at the band boundary, so the marker hugs the actual
  // probability split at the minute the goal was scored. If the series is
  // empty or the goal sits outside it, fall back to mid-plot.
  function yForGoal(minute: number): number {
    if (series.length === 0) return PAD_TOP + PLOT_H / 2;
    let nearest = series[0];
    let bestDist = Math.abs(nearest.minute - minute);
    for (const p of series) {
      const d = Math.abs(p.minute - minute);
      if (d < bestDist) {
        nearest = p;
        bestDist = d;
      }
    }
    return yFor(nearest.homeProb);
  }
  const goalMarkers = (goals ?? []).map((g) => ({
    ...g,
    minute: Math.max(0, Math.min(90, g.minute)),
  }));

  const pill = current
    ? {
        homePct: Math.round(current.homeProb * 100),
        drawPct: Math.round(current.drawProb * 100),
        awayPct: Math.round(current.awayProb * 100),
        minute: current.minute,
        scoreHome: current.scoreHome,
        scoreAway: current.scoreAway,
      }
    : null;

  const isLive = status === "live";

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      {/* Header + pill */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {isLive && (
            <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
          Win Probability
          {status === "finished" && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-normal">
              · final
            </span>
          )}
        </h3>
        {pill && (
          <div className="text-[11px] font-mono flex items-center gap-1.5 flex-wrap">
            <span className="text-emerald-400">{homeTeam.split(" ").slice(-1)[0]} {pill.homePct}%</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground">Draw {pill.drawPct}%</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-purple-400">{awayTeam.split(" ").slice(-1)[0]} {pill.awayPct}%</span>
          </div>
        )}
      </div>

      {/* SVG */}
      <div className="w-full">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Win probability over time for ${homeTeam} vs ${awayTeam}`}
        >
          {/* Plot background */}
          <rect
            x={PAD_LEFT}
            y={PAD_TOP}
            width={PLOT_W}
            height={PLOT_H}
            fill="rgba(255,255,255,0.02)"
          />

          {/* Y-axis gridlines at 25/50/75% */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={PAD_LEFT}
              x2={PAD_LEFT + PLOT_W}
              y1={yFor(f)}
              y2={yFor(f)}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          ))}

          {/* Y-axis labels — 50% only, to keep mobile clutter low */}
          <text
            x={PAD_LEFT - 4}
            y={yFor(0.5) + 3}
            fill="rgba(255,255,255,0.4)"
            fontSize="9"
            textAnchor="end"
          >
            50%
          </text>

          {/* Stacked area bands */}
          <path d={bands.home.d} fill={COLOR_HOME} fillOpacity={0.75} />
          <path d={bands.draw.d} fill={COLOR_DRAW} fillOpacity={0.55} />
          <path d={bands.away.d} fill={COLOR_AWAY} fillOpacity={0.75} />

          {/* Half-time divider */}
          <line
            x1={xFor(45)}
            x2={xFor(45)}
            y1={PAD_TOP}
            y2={PAD_TOP + PLOT_H}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text
            x={xFor(45)}
            y={PAD_TOP - 4}
            fill="rgba(255,255,255,0.5)"
            fontSize="9"
            textAnchor="middle"
          >
            HT
          </text>

          {/* X-axis ticks every 15 min */}
          {[0, 15, 30, 45, 60, 75, 90].map((m) => (
            <g key={m}>
              <line
                x1={xFor(m)}
                x2={xFor(m)}
                y1={PAD_TOP + PLOT_H}
                y2={PAD_TOP + PLOT_H + 3}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={1}
              />
              <text
                x={xFor(m)}
                y={PAD_TOP + PLOT_H + 14}
                fill="rgba(255,255,255,0.4)"
                fontSize="9"
                textAnchor="middle"
              >
                {m === 0 ? "KO" : m === 90 ? "FT" : m}
              </text>
            </g>
          ))}

          {/* Event markers (Pro only) */}
          {markers.map((m, i) => {
            const x = xFor(m.minute);
            const y = m.team === "home" ? PAD_TOP + 4 : PAD_TOP + PLOT_H - 4;
            const fill = m.kind === "goal" ? "#fbbf24" : "#ef4444";
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill={fill}
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth={0.6}
                >
                  <title>
                    {m.kind === "goal" ? "Goal" : "Red card"} —{" "}
                    {m.label ?? "Unknown"} ({m.minute}&apos;)
                  </title>
                </circle>
                {m.label && (
                  <text
                    x={x}
                    y={m.team === "home" ? y - 6 : y + 11}
                    fill="rgba(255,255,255,0.7)"
                    fontSize="8"
                    textAnchor="middle"
                  >
                    {m.label.split(" ").slice(-1)[0]}
                  </text>
                )}
              </g>
            );
          })}

          {/* WC-D3 — Goal diamonds. Tournament green for home, gold for away.
              Renders on top of the bands so the marker is always visible,
              regardless of which side has the larger probability mass. */}
          {goalMarkers.map((g, i) => {
            const x = xFor(g.minute);
            const y = yForGoal(g.minute);
            const fill = g.team === "home" ? DIAMOND_HOME : DIAMOND_AWAY;
            const titleParts: string[] = [];
            if (g.scorer) titleParts.push(g.scorer);
            titleParts.push(`${g.minute}'`);
            if (g.score_after_home != null && g.score_after_away != null) {
              titleParts.push(`${g.score_after_home}-${g.score_after_away}`);
            }
            const title = `Goal — ${titleParts.join(" · ")}`;
            // Diamond = rotated square: a 4-point polygon around (x, y).
            const points = [
              `${x},${y - DIAMOND_HALF}`,
              `${x + DIAMOND_HALF},${y}`,
              `${x},${y + DIAMOND_HALF}`,
              `${x - DIAMOND_HALF},${y}`,
            ].join(" ");
            return (
              <g key={`goal-${i}`} tabIndex={0} className="focus:outline-none">
                <polygon
                  points={points}
                  fill={fill}
                  stroke="rgba(0,0,0,0.85)"
                  strokeWidth={1}
                >
                  <title>{title}</title>
                </polygon>
              </g>
            );
          })}

          {/* Trailing dot at current minute (live + finished) */}
          {current && (
            <circle
              cx={xFor(current.minute)}
              cy={yFor(current.homeProb + current.drawProb / 2)}
              r={3}
              fill="white"
              stroke="rgba(0,0,0,0.7)"
              strokeWidth={0.8}
            />
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/80 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: COLOR_HOME }} />
          {homeTeam}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: COLOR_DRAW }} />
          Draw
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: COLOR_AWAY }} />
          {awayTeam}
        </span>
        {pill && (
          <span className="ml-auto text-muted-foreground/60">
            {pill.minute}&apos; · {pill.scoreHome}-{pill.scoreAway}
          </span>
        )}
      </div>

      {/* Client-side live pill refresh — hydrates only when live */}
      {isLive && (
        <WinProbabilityChartLive
          matchId={matchId}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          initial={pill}
        />
      )}
    </div>
  );
}
