import { TrendingUp, Search, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrackRecordStats } from "@/lib/engine-data";

interface Props {
  stats: TrackRecordStats;
}

export function TrackRecordHero({ stats }: Props) {
  const clvDisplay = stats.avgClv != null
    ? `${stats.avgClv >= 0 ? "+" : ""}${(stats.avgClv * 100).toFixed(1)}%`
    : "Tracking...";
  const clvPositive = stats.avgClv != null && stats.avgClv > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Betting Intelligence</h1>
        <p className="text-sm text-muted-foreground">
          How our signals perform in real markets — CLV, value detection, and coverage.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* CLV */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Avg Closing Line Value
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
                ? `${stats.posClvPct.toFixed(0)}% of bets beat the closing line`
                : "CLV appears after bets settle"}
            </p>
          </CardContent>
        </Card>

        {/* Value bets found */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Search className="h-3 w-3" />
              Value Bets Identified
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {stats.totalValueBets}
            </span>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Mispriced odds detected by our model
            </p>
          </CardContent>
        </Card>

        {/* Coverage */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Globe className="h-3 w-3" />
              Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {stats.leaguesCovered > 0 ? stats.leaguesCovered : 41}
            </span>
            <span className="text-sm text-muted-foreground ml-1.5">leagues</span>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              {stats.bookmakersCovered > 0 ? stats.bookmakersCovered : 13} bookmakers, updated every 2h
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
