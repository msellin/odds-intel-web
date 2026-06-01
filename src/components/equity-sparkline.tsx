import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  curve: Array<{ d: string; cum: number }> | null;
}

export function EquitySparkline({ curve }: Props) {
  if (!curve || curve.length < 2) return null;

  const values = curve.map((p) => p.cum);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const endY = values[values.length - 1];
  const range = maxY - minY || 1;

  const width = 600;
  const height = 60;
  const padX = 4;
  const padY = 6;

  const xStep = (width - 2 * padX) / (curve.length - 1);
  const yFor = (v: number) => height - padY - ((v - minY) / range) * (height - 2 * padY);

  const points = curve.map((p, i) => `${padX + i * xStep},${yFor(p.cum)}`).join(" ");
  const areaPath = `M ${padX},${height - padY} L ${points.split(" ").join(" L ")} L ${padX + (curve.length - 1) * xStep},${height - padY} Z`;

  const positive = endY >= 0;
  const stroke = positive ? "#34d399" : "#f87171";
  const fill = positive ? "rgba(52, 211, 153, 0.12)" : "rgba(248, 113, 113, 0.12)";

  const fmtEur = (v: number) => `${v >= 0 ? "+" : "−"}€${Math.abs(v).toFixed(0)}`;
  const startDate = new Date(curve[0].d);
  const endDate = new Date(curve[curve.length - 1].d);
  const dayCount = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" />
            Cumulative P&amp;L · last {dayCount}d
          </span>
          <span className={`font-mono text-sm font-bold tabular-nums ${positive ? "text-emerald-400" : "text-red-400"}`}>
            {fmtEur(endY)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-14"
          role="img"
          aria-label={`Equity curve over the last ${dayCount} days, ending at ${fmtEur(endY)}`}
        >
          <path d={areaPath} fill={fill} />
          <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-[10px] text-muted-foreground mt-1">
          active strategies, settled bets only · {curve.length} days plotted
        </p>
      </CardContent>
    </Card>
  );
}
