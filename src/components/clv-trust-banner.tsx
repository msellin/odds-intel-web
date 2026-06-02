/**
 * CLV-as-hero-metric trust banner.
 *
 * Why CLV and not ROI: Closing Line Value is variance-proof. A −ROI month with
 * +CLV proves the model is finding edge even when results don't cooperate; ROI
 * alone gaslights both ways (lucky week looks like skill, unlucky week looks
 * like a broken product). The metric we want above the fold is CLV.
 *
 * Server component — reads dashboard_cache (computed every 30 min by
 * settlement.write_dashboard_cache). When the cache row is missing or the
 * cohort has < 30 settled picks, falls back to honest "tracking starts at
 * first 30 settled picks" copy. No invented numbers.
 *
 * Three variants:
 *   landing     — full-width strip, gold-on-dark, mobile-first big number
 *   world-cup   — compact card sized to fit inside the Overview tab
 *   value-bets  — inline tile that replaces the old PRO-TIER-V2 hero
 *
 * Cohort:
 *   "all" / "elite" → cache.elite_value_bets_30d (max picks)
 *   "pro"           → cache.pro_value_bets_30d  (calibrated)
 *
 * Honesty rules baked into the rendering:
 *   - Never display ROI as the hero number — CLV is the hero.
 *   - Always pair CLV with N. Without N, the claim is meaningless.
 *   - Empty state ("CLV tracking starts at first 30 settled picks") on missing
 *     data — do not invent a number.
 */

import { TrendingUp } from "lucide-react";
import { getDashboardCache } from "@/lib/engine-data";

type Variant = "landing" | "world-cup" | "value-bets";
type Cohort = "pro" | "elite" | "all";

interface Props {
  variant: Variant;
  cohort?: Cohort;
}

interface Stats {
  n: number;
  win_rate_pct: number | null;
  roi_pct: number | null;
  clv_pct: number | null;
}

const CLV_MIN_N = 30;
const CLV_EXPLAINER =
  "Closing Line Value (CLV) measures whether our picks beat where the market settled. Sustained +CLV is the cleanest signal a model is finding real value, independent of variance.";

function fmtSignedPct(v: number | null): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtPlainPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function clvToneClass(v: number | null): string {
  if (v == null) return "text-muted-foreground";
  if (v >= 3) return "text-emerald-400";
  if (v >= 0) return "text-foreground";
  return "text-amber-400";
}

async function loadStats(cohort: Cohort): Promise<Stats | null> {
  const cache = await getDashboardCache();
  if (!cache) return null;
  if (cohort === "pro") return cache.pro_value_bets_30d;
  return cache.elite_value_bets_30d; // "elite" and "all" both go here
}

export async function CLVTrustBanner({ variant, cohort = "all" }: Props) {
  let stats: Stats | null = null;
  try {
    stats = await loadStats(cohort);
  } catch {
    stats = null;
  }

  const hasEnoughData = stats != null && stats.n >= CLV_MIN_N && stats.clv_pct != null;

  if (variant === "landing") {
    return <LandingVariant stats={hasEnoughData ? stats : null} />;
  }
  if (variant === "world-cup") {
    return <WorldCupVariant stats={hasEnoughData ? stats : null} />;
  }
  return <ValueBetsVariant stats={hasEnoughData ? stats : null} />;
}

// ─────────────────────────── Landing variant ──────────────────────────────────
// Full-width strip. Big number, gold-on-dark, lives between hero and the
// "broken tabs" section. Mobile-first: number must be readable on 375px without
// the supporting copy wrapping awkwardly.

function LandingVariant({ stats }: { stats: Stats | null }) {
  return (
    <section
      aria-label="Closing Line Value — 30 day trust metric"
      className="border-y border-amber-500/20 bg-gradient-to-b from-amber-500/[0.06] via-background to-background"
    >
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:justify-center sm:gap-8 sm:text-left">
          {stats ? (
            <>
              <div className="flex shrink-0 flex-col items-center sm:items-start">
                <p
                  className={`font-mono text-5xl font-black leading-none tracking-tight tabular-nums sm:text-6xl ${clvToneClass(
                    stats.clv_pct
                  )}`}
                >
                  {fmtSignedPct(stats.clv_pct)}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-amber-300/80 sm:text-xs">
                  Avg CLV · last 30 days
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                  on {stats.n.toLocaleString()} settled picks
                </p>
              </div>
              <div className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                <p>{CLV_EXPLAINER}</p>
                <p className="mt-2 text-xs text-muted-foreground/80">
                  Win rate {fmtPlainPct(stats.win_rate_pct)} · ROI{" "}
                  {fmtSignedPct(stats.roi_pct)} (variance-confounded — CLV is
                  the honest scoreboard).
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <div className="flex items-center gap-2 text-amber-300">
                <TrendingUp className="size-4" />
                <p className="font-mono text-xs uppercase tracking-widest">
                  Closing Line Value
                </p>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                CLV tracking starts at the first 30 settled picks. {CLV_EXPLAINER}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────── World Cup variant ────────────────────────────────
// Compact card. Sized to slot inside the Overview tab between the featured
// banner / hero and the scorecard. Same data, smaller footprint.

function WorldCupVariant({ stats }: { stats: Stats | null }) {
  return (
    <section
      aria-label="Closing Line Value — 30 day trust metric"
      className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] via-card/40 to-card/40 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        {stats ? (
          <>
            <div className="flex items-baseline gap-3">
              <p
                className={`font-mono text-3xl font-black leading-none tabular-nums sm:text-4xl ${clvToneClass(
                  stats.clv_pct
                )}`}
              >
                {fmtSignedPct(stats.clv_pct)}
              </p>
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-widest text-amber-300/80">
                  Avg CLV · 30d
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {stats.n.toLocaleString()} settled picks
                </span>
              </div>
            </div>
            <p className="max-w-sm text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              CLV measures whether our picks beat where the market settled —
              the cleanest signal the model is finding real value.
            </p>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <TrendingUp className="size-4 text-amber-300" />
            <p className="text-xs text-muted-foreground sm:text-sm">
              CLV tracking starts at first 30 settled picks. CLV measures
              whether our picks beat where the market settled.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────── Value-bets variant ───────────────────────────────
// Inline tile — replaces the old PRO-TIER-V2 hero (single source of truth).
// Keeps the supporting ROI / win-rate / settled grid, but the CLV cell is the
// hero with bigger weight + amber accent.

function ValueBetsVariant({ stats }: { stats: Stats | null }) {
  if (!stats) {
    return (
      <section className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.05] to-card/40 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-amber-300" />
          <h2 className="text-sm font-semibold tracking-tight">
            Closing Line Value
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              · last 30 days
            </span>
          </h2>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          CLV tracking starts at first 30 settled picks. {CLV_EXPLAINER}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.07] to-card/40 px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-amber-300" />
          <h2 className="text-sm font-semibold tracking-tight">
            Closing Line Value
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              · last 30 days
            </span>
          </h2>
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
          {stats.n.toLocaleString()} settled picks
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-3 sm:gap-5">
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
            CLV (hero)
          </dt>
          <dd
            className={`mt-0.5 font-mono text-2xl font-black tabular-nums sm:text-3xl ${clvToneClass(
              stats.clv_pct
            )}`}
          >
            {fmtSignedPct(stats.clv_pct)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
            ROI
          </dt>
          <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums">
            {fmtSignedPct(stats.roi_pct)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
            Win rate
          </dt>
          <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums">
            {fmtPlainPct(stats.win_rate_pct)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
            Settled
          </dt>
          <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums">
            {stats.n.toLocaleString()}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {CLV_EXPLAINER}
      </p>
    </section>
  );
}
