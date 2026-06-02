/**
 * PRO-TIER-V2 (2026-06-02) — rolling-30d hero for /value-bets.
 *
 * Server component. Reads stats from dashboard_cache (computed 30-min) — Pro
 * sees the calibrated-cohort tile, Elite sees the all-active cohort.
 *
 * Why dashboard_cache + not a hot-path query: settlement.write_dashboard_cache
 * already aggregates these. Adding two JSONB columns there is free; firing a
 * fresh aggregate on every /value-bets render would burn a real query.
 */

import { TrendingUp } from "lucide-react";

interface Stats {
  n: number;
  win_rate_pct: number | null;
  roi_pct: number | null;
  clv_pct: number | null;
}

interface Props {
  tier: "pro" | "elite";
  stats: Stats | null;
}

function fmtPct(v: number | null, opts: { signed?: boolean } = {}): string {
  if (v == null) return "—";
  const sign = opts.signed && v > 0 ? "+" : "";
  return `${sign}${v.toFixed(opts.signed ? 1 : 1)}%`;
}

function roiClass(v: number | null): string {
  if (v == null) return "text-muted-foreground";
  if (v >= 5)  return "text-emerald-400";
  if (v >= 0)  return "text-foreground";
  return "text-red-400";
}

function clvClass(v: number | null): string {
  if (v == null) return "text-muted-foreground";
  if (v >= 3)  return "text-emerald-400";
  if (v >= 0)  return "text-foreground";
  return "text-amber-500";
}

export function ValueBetsHeroStats({ tier, stats }: Props) {
  if (!stats || stats.n === 0) return null;

  const tierLabel = tier === "elite" ? "All-active" : "Calibrated";

  return (
    <section className="rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] to-card/40 px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold tracking-tight">
            {tier === "elite" ? "Elite picks" : "Pro picks"}
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              · last 30 days
            </span>
          </h2>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
          {tierLabel} cohort
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-3 sm:gap-5">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">ROI</dt>
          <dd className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${roiClass(stats.roi_pct)}`}>
            {fmtPct(stats.roi_pct, { signed: true })}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">CLV</dt>
          <dd className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${clvClass(stats.clv_pct)}`}>
            {fmtPct(stats.clv_pct, { signed: true })}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">Win rate</dt>
          <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums">
            {fmtPct(stats.win_rate_pct)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">Settled</dt>
          <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums">{stats.n}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Live-tracked daily — every pick published, win or lose.
      </p>
    </section>
  );
}
