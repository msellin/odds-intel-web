import { BarChart3 } from "lucide-react";

interface Props {
  settled: number;
  target?: number;
}

export function SignificanceProgress({ settled, target = 500 }: Props) {
  const pct = Math.min((settled / target) * 100, 100);

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-foreground">Building a Track Record</h2>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {settled} / {target}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-border/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Professional bettors track <strong className="text-foreground/80">500+ bets</strong> before
        judging a system&apos;s profitability. We launched recently and are building toward statistical
        significance. What we <em>can</em> show now: CLV (whether our model spots value before the
        market corrects) and system activity — both meaningful even at small sample sizes.
      </p>
    </div>
  );
}
