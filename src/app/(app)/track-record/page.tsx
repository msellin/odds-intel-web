import { historicalBets, trackRecordStats } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Snowflake } from "lucide-react";
import { TrackRecordClient } from "@/components/track-record-client";
import { TierGate } from "@/components/tier-gate";

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "green" | "red" | "neutral";
}) {
  const colorClass =
    color === "green"
      ? "text-emerald-400"
      : color === "red"
        ? "text-red-400"
        : "text-foreground";

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <span className={`font-mono text-xl font-bold tabular-nums ${colorClass}`}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

export default function TrackRecordPage() {
  const stats = trackRecordStats;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Track Record</h1>
          <p className="text-sm text-muted-foreground">
            Full transparency. Every pick, every result.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit font-mono">
          {stats.totalBets} bets tracked
        </Badge>
      </div>

      <TierGate requiredTier="sharp" featureName="Track Record">
        {/* Stats cards row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Total Bets"
            value={stats.totalBets.toString()}
            color="neutral"
          />
          <StatCard
            label="Hit Rate"
            value={`${stats.hitRate}%`}
            color={stats.hitRate > 52 ? "green" : stats.hitRate < 48 ? "red" : "neutral"}
          />
          <StatCard
            label="ROI"
            value={`${stats.roi > 0 ? "+" : ""}${stats.roi}%`}
            color={stats.roi > 0 ? "green" : stats.roi < 0 ? "red" : "neutral"}
          />
          <StatCard
            label="Avg CLV"
            value={`${stats.avgClv > 0 ? "+" : ""}${stats.avgClv.toFixed(2)}`}
            color={stats.avgClv > 0 ? "green" : stats.avgClv < 0 ? "red" : "neutral"}
          />
          <StatCard
            label="Total P&L"
            value={`${stats.totalPnl > 0 ? "+" : ""}${stats.totalPnl.toFixed(0)} EUR`}
            color={stats.totalPnl > 0 ? "green" : stats.totalPnl < 0 ? "red" : "neutral"}
          />
          <StatCard
            label="Bankroll"
            value={`${stats.currentBankroll.toFixed(0)} EUR`}
            color="neutral"
          />
        </div>

        {/* Streak indicators */}
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/80 px-4 py-2">
            <Flame className="size-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Best Win Streak</span>
            <span className="font-mono text-sm font-bold text-emerald-400">
              {stats.longestWinStreak}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/80 px-4 py-2">
            <Snowflake className="size-4 text-red-400" />
            <span className="text-xs text-muted-foreground">Worst Loss Streak</span>
            <span className="font-mono text-sm font-bold text-red-400">
              {stats.longestLossStreak}
            </span>
          </div>
        </div>

        {/* Client component: chart + filters + table */}
        <div className="mt-4">
          <TrackRecordClient bets={historicalBets} />
        </div>

        {/* Honesty note */}
        <p className="border-t border-border/30 pt-4 text-center text-xs text-muted-foreground/70 mt-4">
          All picks shown &mdash; wins AND losses. No cherry-picking. This is real
          performance data.
        </p>
      </TierGate>
    </div>
  );
}
