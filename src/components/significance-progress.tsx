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
          <h2 className="text-sm font-semibold text-foreground">Statistical Significance</h2>
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
        500 settled bets is the threshold where results stop being noise and start being signal.
        We&apos;re not there yet — and we&apos;re saying so upfront. What the early data{" "}
        <em>does</em> show: CLV (whether the market agrees with our model before kickoff) is
        positive, which is the most reliable early indicator of real edge.
      </p>
    </div>
  );
}
