import { Lightbulb } from "lucide-react";
import Link from "next/link";

export function ClvEducation() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-foreground">What is Closing Line Value?</h2>
      </div>

      <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
        <p>
          CLV measures whether our model spots value <strong className="text-foreground/80">before the market corrects</strong>.
          Consistently positive CLV is the #1 predictor of long-term betting profitability.
        </p>

        {/* Visual example */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border/30 bg-card/40 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">Our model says</p>
            <p className="font-mono text-sm font-bold text-foreground">52%</p>
            <p className="text-[10px] text-muted-foreground/50">Team A wins</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-amber-400/70 mb-1">Bookmaker offers</p>
            <p className="font-mono text-sm font-bold text-amber-400">2.10</p>
            <p className="text-[10px] text-amber-400/60">Implied 47.6%</p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-400/70 mb-1">At kickoff</p>
            <p className="font-mono text-sm font-bold text-emerald-400">1.85</p>
            <p className="text-[10px] text-emerald-400/60">Market agreed</p>
          </div>
        </div>

        <p className="text-muted-foreground/70">
          If you bet at 2.10 and the line closed at 1.85, you captured{" "}
          <strong className="text-emerald-400">+13.5% CLV</strong> — the market moved in your direction,
          confirming the edge was real. This matters even when individual bets lose.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Link
          href="/value-bets"
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
        >
          See today&apos;s value opportunities
        </Link>
        <Link
          href="/how-it-works"
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          How does the model work?
        </Link>
      </div>
    </div>
  );
}
