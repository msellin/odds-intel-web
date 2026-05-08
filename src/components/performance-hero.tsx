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

  const roi = cache?.roi_pct ?? null;
  const roiDisplay = roi != null ? `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` : "—";
  const roiPositive = roi != null && roi > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
        <p className="text-sm text-muted-foreground">
          16 paper-trading bots · Running since April 27, 2026 · Every pick logged · No cherry-picking.
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
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              {stats.avgClv != null
                ? "beats the closing line"
                : "appears after bets settle"}
            </p>
          </CardContent>
        </Card>

        {/* Settled bets */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Award className="h-3 w-3" />
              Settled Bets
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {stats.settledBets}
            </span>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              results confirmed
            </p>
          </CardContent>
        </Card>

        {/* ROI */}
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
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              on all settled stakes
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
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">16</span>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              strategies running
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
