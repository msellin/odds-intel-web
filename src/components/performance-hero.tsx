import { TrendingUp, Bot, Award, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrackRecordStats, DashboardCache } from "@/lib/engine-data";

interface Props {
  stats: TrackRecordStats;
  cache: DashboardCache | null;
}

export function PerformanceHero({ stats, cache }: Props) {
  const clvDisplay = stats.avgClv != null
    ? `${stats.avgClv >= 0 ? "+" : ""}${(stats.avgClv * 100).toFixed(1)}%`
    : "Tracking…";
  const clvPositive = stats.avgClv != null && stats.avgClv > 0;

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
        <p className="text-sm text-muted-foreground">
          {cache?.bot_breakdown?.length ?? 16} paper-trading bots · Running since April 27, 2026 · Every pick logged · No cherry-picking.
        </p>
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
            <p className="text-[10px] text-muted-foreground/80 mt-1">
              {stats.avgClv != null
                ? "beats the closing line"
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
            <p className="text-[10px] text-muted-foreground/80 mt-1">
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
            <p className="text-[10px] text-muted-foreground/80 mt-1">
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
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">{cache?.bot_breakdown?.length ?? "—"}</span>
            <p className="text-[10px] text-muted-foreground/80 mt-1">
              strategies running
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
