import { TrendingUp, Bot, BarChart2, Clock, Archive, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  TrackRecordStats,
  DashboardCache,
  ModelV2Stats,
  CalibratedHeadlineStats,
} from "@/lib/engine-data";
import { EquitySparkline } from "@/components/equity-sparkline";

interface Props {
  stats: TrackRecordStats;
  cache: DashboardCache | null;
  botsTracked?: number | null;
  modelV2Stats?: ModelV2Stats | null;
  activeBotCount?: number | null;
  retiredBotCount?: number | null;
  calibrated?: CalibratedHeadlineStats | null;
}

export function PerformanceHero({ stats, cache, modelV2Stats, activeBotCount, retiredBotCount, calibrated }: Props) {
  const daysRunning = Math.floor((Date.now() - new Date("2026-05-01").getTime()) / 86400000);
  const allTimeSettled = stats.settledBets;

  // ── Block 2: all active bots performance ───────────────────────────────────
  const clv = stats.avgClv;
  const clvDisplay = clv != null
    ? `${clv >= 0 ? "+" : ""}${(clv * 100).toFixed(1)}%`
    : "Tracking…";
  const clvPositive = clv != null && clv > 0;

  const activeSettled  = cache?.active_settled_bets ?? null;
  const activeRoi      = cache?.active_roi_pct ?? cache?.roi_pct ?? null;
  const allTimeRoi     = cache?.roi_pct ?? null;
  const fmtRoi = (r: number | null) =>
    r != null ? `${r >= 0 ? "+" : ""}${r.toFixed(1)}%` : "—";
  const showAllTime = allTimeRoi != null && activeRoi != null && Math.abs(activeRoi - allTimeRoi) >= 0.1;

  // HEADLINE-COHORT (2026-06-24): public headline is calibrated bots,
  // pre-match (1x2/OU/BTTS — no AH), since calibrated tier launched. The
  // previous tiles split into pre-match-30d vs in-play-30d, which (a) hid
  // the +9% all-time number behind a noisy 30d window, (b) mixed AH
  // (calibrated AH = -13%) into the pre-match cohort, (c) gave in-play
  // a headline tile despite higher variance and the InplayBot UUID
  // history. The new tiles surface the honest cut: ROI since calibrated
  // launch + 30d sub-stat for transparency. In-play stays in the system
  // and is still tracked admin-side.
  const cal             = calibrated?.allTime;
  const cal30           = calibrated?.last30d;
  const calRoi          = cal?.roiPct ?? null;
  const calN            = cal?.n ?? 0;
  const calSince        = cal?.sinceDate ?? "2026-05-04";
  const cal30Roi        = cal30?.roiPct ?? null;
  const cal30N          = cal30?.n ?? 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Performance</h1>

      {/* ── Block 1: system overview ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <BarChart2 className="h-3 w-3" />
              Total Settled
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {allTimeSettled.toLocaleString()}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">bets logged, all strategies</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Bot className="h-3 w-3" />
              Active Bots
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {activeBotCount ?? "—"}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">strategies running now</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Archive className="h-3 w-3" />
              Retired Bots
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {retiredBotCount ?? "—"}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">strategies decommissioned</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3 w-3" />
              Days Running
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {daysRunning}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">since May 1 · every bet logged</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Block 2: active bots performance ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Avg CLV
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className={`font-mono text-2xl font-bold tabular-nums ${
              clv == null ? "text-muted-foreground" : clvPositive ? "text-emerald-400" : "text-red-400"
            }`}>
              {clvDisplay}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">active strategies</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <BarChart2 className="h-3 w-3" />
              Settled Bets
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {activeSettled?.toLocaleString() ?? allTimeSettled.toLocaleString()}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">on active strategies</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/[0.04]">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Target className="h-3 w-3" />
              ROI · calibrated · all-time
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className={`font-mono text-2xl font-bold tabular-nums ${
              calRoi == null
                ? "text-muted-foreground"
                : calRoi >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
            }`}>
              {fmtRoi(calRoi)}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">
              {calN.toLocaleString()} pre-match picks · since {calSince}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <BarChart2 className="h-3 w-3" />
              ROI · calibrated · 30d
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className={`font-mono text-2xl font-bold tabular-nums ${
              cal30Roi == null
                ? "text-muted-foreground"
                : cal30Roi >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
            }`}>
              {fmtRoi(cal30Roi)}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">
              {cal30N.toLocaleString()} bets · last 30d window
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Equity sparkline ─────────────────────────────────────────────── */}
      <EquitySparkline curve={cache?.daily_pnl_curve_30d ?? null} />

      {/* ── Model v2 era callout ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-2 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Model v2 · May 24</span>
        <span className="text-[11px] text-muted-foreground">6 new signals · AH overhaul · B-ML3 meta-model · overnight prices</span>
        {modelV2Stats && modelV2Stats.settled > 0 && (
          <span className="ml-auto text-[11px] font-mono font-semibold text-emerald-400">
            {modelV2Stats.settled} bets
            {modelV2Stats.prematchRoi != null && ` · pre-match ${modelV2Stats.prematchRoi >= 0 ? "+" : ""}${modelV2Stats.prematchRoi.toFixed(1)}% ROI`}
            {modelV2Stats.avgClv != null && ` · ${modelV2Stats.avgClv >= 0 ? "+" : ""}${(modelV2Stats.avgClv * 100).toFixed(1)}% CLV`}
          </span>
        )}
      </div>

      {/* ── Next model upgrade callout (PERF-HERO-NEXT-MODEL 2026-06-01) ─── */}
      <NextModelCallout summary={cache?.upcoming_model_summary ?? null} />
    </div>
  );
}

function NextModelCallout({
  summary,
}: {
  summary: DashboardCache["upcoming_model_summary"];
}) {
  if (!summary) return null;
  const deltas = summary.group_deltas ?? {};
  const isPromoted = (summary as { mode?: string }).mode === "recently_promoted";

  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  const fmtMarket = (k: string) =>
    k === "1x2" ? "1X2" : k === "ah" ? "AH" : k === "ou" ? "O/U" : k.toUpperCase();
  const eventDate = summary.trained_at
    ? new Date(summary.trained_at).toLocaleDateString("en", { month: "short", day: "numeric" })
    : null;

  const groupOrder = ["1x2", "ah", "btts", "ou"];
  const chips = groupOrder
    .filter((k) => deltas[k] != null)
    .map((k) => ({ key: k, delta: deltas[k] }));

  if (isPromoted) {
    return (
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-4 py-2 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
          ✓ Model updated{eventDate ? ` · ${eventDate}` : ""}
        </span>
        {chips.length > 0 && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
            {chips.map(({ key, delta }) => {
              const regressed = delta > 1;
              const improved = delta < -1;
              const cls = regressed
                ? "text-rose-300"
                : improved
                  ? "text-emerald-300"
                  : "text-muted-foreground";
              return (
                <span key={key} className={`font-mono font-semibold ${cls}`}>
                  {fmtMarket(key)} {fmtPct(delta)}
                </span>
              );
            })}
            <span className="text-muted-foreground">log-loss vs prev model</span>
          </span>
        )}
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
          {summary.markets_better} improved / {summary.markets_worse} regressed
          {summary.holdout_n ? ` · n=${summary.holdout_n.toLocaleString()}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-2 flex items-center gap-3 flex-wrap">
      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
        Next upgrade{eventDate ? ` · trained ${eventDate}` : ""}
      </span>
      {chips.length > 0 && (
        <span className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
          {chips.map(({ key, delta }) => {
            const regressed = delta > 1;
            const improved = delta < -1;
            const cls = regressed
              ? "text-rose-300"
              : improved
                ? "text-sky-300"
                : "text-muted-foreground";
            return (
              <span key={key} className={`font-mono font-semibold ${cls}`}>
                {fmtMarket(key)} {fmtPct(delta)}
              </span>
            );
          })}
          <span className="text-muted-foreground">log-loss · offline tests</span>
        </span>
      )}
      <span className="ml-auto text-[10px] font-mono text-muted-foreground">
        {summary.markets_better} better / {summary.markets_worse} worse
        {summary.holdout_n ? ` · n=${summary.holdout_n.toLocaleString()}` : ""} · promoting after validation window
      </span>
    </div>
  );
}
