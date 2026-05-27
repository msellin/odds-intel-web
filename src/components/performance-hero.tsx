import { TrendingUp, Bot, Award, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrackRecordStats, DashboardCache, ModelV2Stats } from "@/lib/engine-data";

interface Props {
  stats: TrackRecordStats;
  cache: DashboardCache | null;
  botsTracked?: number | null;
  modelV2Stats?: ModelV2Stats | null;
}

export function PerformanceHero({ stats, cache, botsTracked, modelV2Stats }: Props) {
  const activeClv = cache?.active_avg_clv ?? null;
  const allTimeClv = cache?.avg_clv ?? null;
  // For Pro+ users stats.avgClv is computed from active bots live; for free
  // users it comes from the cache (all-time). Show all-time in subtext when
  // the two differ meaningfully, mirroring the ROI card pattern.
  const clv = stats.avgClv;
  const clvDisplay = clv != null
    ? `${clv >= 0 ? "+" : ""}${(clv * 100).toFixed(1)}%`
    : "Tracking…";
  const clvPositive = clv != null && clv > 0;
  const allTimeClvDisplay = allTimeClv != null && clv != null && Math.abs(clv - allTimeClv) >= 0.001
    ? `${allTimeClv >= 0 ? "+" : ""}${(allTimeClv * 100).toFixed(1)}%`
    : null;

  // PERF-HONEST-HEADLINE (2026-05-17): two-row ROI display. Big number is
  // "active strategies only" — what the engine is currently producing. Subtext
  // shows all-time incl. retired so we're not hiding the experiments.
  const activeRoi = cache?.active_roi_pct ?? null;
  const allTimeRoi = cache?.roi_pct ?? null;
  // Prefer the active number for the headline; fall back to all-time if active
  // is null (e.g. legacy cache row from before migration 104).
  const roi = activeRoi ?? allTimeRoi;
  const roiDisplay = roi != null ? `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` : "—";
  const roiPositive = roi != null && roi > 0;
  const allTimeRoiDisplay =
    allTimeRoi != null ? `${allTimeRoi >= 0 ? "+" : ""}${allTimeRoi.toFixed(1)}%` : null;
  const showBothRoi = activeRoi != null && allTimeRoi != null && Math.abs(activeRoi - allTimeRoi) >= 0.1;

  const activeSettled = cache?.active_settled_bets ?? null;
  const allTimeSettled = stats.settledBets;

  const meaningfulBotCount = cache?.bot_breakdown?.filter((b) => b.settled >= 5).length ?? null;

  const daysRunning = Math.floor((Date.now() - new Date("2026-05-01").getTime()) / 86400000);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
        <p className="text-sm text-muted-foreground">
          {meaningfulBotCount ?? (cache?.bot_breakdown?.length ?? 16)} strategies with data · {daysRunning} days running · Every bet logged · No cherry-picking.
        </p>
      </div>

      {/* Era callout */}
      <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-2 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Model v2 · May 24</span>
        <span className="text-[11px] text-muted-foreground">6 new signals · AH overhaul · B-ML3 meta-model · overnight prices</span>
        {modelV2Stats && modelV2Stats.settled > 0 && (
          <span className="ml-auto text-[11px] font-mono font-semibold text-emerald-400">
            {modelV2Stats.settled} bets
            {modelV2Stats.roi != null && ` · ${modelV2Stats.roi >= 0 ? "+" : ""}${modelV2Stats.roi.toFixed(1)}% ROI`}
            {modelV2Stats.avgClv != null && ` · ${modelV2Stats.avgClv >= 0 ? "+" : ""}${(modelV2Stats.avgClv * 100).toFixed(1)}% CLV`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* CLV — hero metric */}
        <Card className="border-border/50 bg-card/80 sm:col-span-1">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Avg CLV
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className={`font-mono text-2xl font-bold tabular-nums ${
              stats.avgClv == null ? "text-muted-foreground" : clvPositive ? "text-emerald-400" : "text-red-400"
            }`}>
              {clvDisplay}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">
              {clv != null
                ? <>active{allTimeClvDisplay ? <> · all-time {allTimeClvDisplay}</> : null}</>
                : "appears after bets settle"}
            </p>
          </CardContent>
        </Card>

        {/* Settled bets — big number is all-time (1k+ credibility); subtext shows active */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Award className="h-3 w-3" />
              Settled Bets
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {allTimeSettled}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">
              {activeSettled != null && activeSettled !== allTimeSettled
                ? `${activeSettled} on active strategies`
                : "results confirmed"}
            </p>
          </CardContent>
        </Card>

        {/* ROI — big number = active strategies; subtext = all-time incl. retired (PERF-HONEST-HEADLINE) */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <BarChart2 className="h-3 w-3" />
              System ROI
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className={`font-mono text-2xl font-bold tabular-nums ${
              roi == null ? "text-muted-foreground" : roiPositive ? "text-emerald-400" : "text-red-400"
            }`}>
              {roiDisplay}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">
              {showBothRoi
                ? `active · all-time ${allTimeRoiDisplay}`
                : "on all settled stakes"}
            </p>
          </CardContent>
        </Card>

        {/* Active bots */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Bot className="h-3 w-3" />
              Active Bots
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">{meaningfulBotCount ?? cache?.bot_breakdown?.length ?? "—"}</span>
            <p className="text-[10px] text-muted-foreground mt-1">
              strategies with data
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
