import { TrendingUp, Bot, BarChart2, Clock, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrackRecordStats, DashboardCache, ModelV2Stats } from "@/lib/engine-data";

interface Props {
  stats: TrackRecordStats;
  cache: DashboardCache | null;
  botsTracked?: number | null;
  modelV2Stats?: ModelV2Stats | null;
  activeBotCount?: number | null;
  retiredBotCount?: number | null;
}

export function PerformanceHero({ stats, cache, modelV2Stats, activeBotCount, retiredBotCount }: Props) {
  const daysRunning = Math.floor((Date.now() - new Date("2026-05-01").getTime()) / 86400000);
  const allTimeSettled = stats.settledBets;

  // ── Block 2: active model performance ──────────────────────────────────────
  const clv = modelV2Stats?.avgClv ?? stats.avgClv;
  const clvDisplay = clv != null
    ? `${clv >= 0 ? "+" : ""}${(clv * 100).toFixed(1)}%`
    : "Tracking…";
  const clvPositive = clv != null && clv > 0;

  const prematchRoi = modelV2Stats?.prematchRoi ?? null;
  const inplayRoi   = modelV2Stats?.inplayRoi ?? null;
  const fmtRoi = (r: number | null) =>
    r != null ? `${r >= 0 ? "+" : ""}${r.toFixed(1)}%` : "—";

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

      {/* ── Model v2 era callout ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-2 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Model v2 · May 24</span>
        <span className="text-[11px] text-muted-foreground">6 new signals · AH overhaul · B-ML3 meta-model · overnight prices</span>
      </div>

      {/* ── Block 2: active bots performance ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/50 bg-card/80 sm:col-span-1">
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
            <p className="text-[10px] text-muted-foreground mt-1">pre-match · model v2</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <BarChart2 className="h-3 w-3" />
              Settled (v2)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {modelV2Stats?.settled ?? "—"}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">
              {modelV2Stats
                ? `${modelV2Stats.prematchSettled} pre-match · ${modelV2Stats.inplaySettled} in-play`
                : "active strategies"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <BarChart2 className="h-3 w-3" />
              Pre-match ROI
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className={`font-mono text-2xl font-bold tabular-nums ${
              prematchRoi == null ? "text-muted-foreground" : prematchRoi >= 0 ? "text-emerald-400" : "text-red-400"
            }`}>
              {fmtRoi(prematchRoi)}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">
              {modelV2Stats?.prematchSettled ? `${modelV2Stats.prematchSettled} bets` : "model v2"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <BarChart2 className="h-3 w-3" />
              In-play ROI
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className={`font-mono text-2xl font-bold tabular-nums ${
              inplayRoi == null ? "text-muted-foreground" : inplayRoi >= 0 ? "text-emerald-400" : "text-red-400"
            }`}>
              {fmtRoi(inplayRoi)}
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">
              {modelV2Stats?.inplaySettled ? `${modelV2Stats.inplaySettled} bets · no CLV` : "live bets"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
