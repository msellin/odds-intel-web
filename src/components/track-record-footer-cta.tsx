import Link from "next/link";
import { TrendingUp } from "lucide-react";

interface Props {
  isPro: boolean;
  isElite: boolean;
}

export function TrackRecordFooterCta({ isPro, isElite }: Props) {
  if (isElite) return null;

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-5 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-foreground">
          Betting intelligence compounds over time
        </h2>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
        {isPro
          ? "You're capturing better odds with Pro. Elite adds Kelly staking, AI explanations, and the full signal stack — turning intelligence into optimal execution."
          : "Every match we scan 13 bookmakers, detect mispriced odds, and track closing line value. The edge is there — Pro and Elite give you the tools to capture it."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {!isPro && (
          <Link
            href="/how-it-works"
            className="rounded-md bg-blue-600 px-5 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors text-center"
          >
            Start with Pro
          </Link>
        )}
        {!isElite && (
          <Link
            href="/how-it-works"
            className="rounded-md bg-emerald-600 px-5 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors text-center"
          >
            {isPro ? "Upgrade to Elite" : "Go Elite"}
          </Link>
        )}
        {!isPro && (
          <Link
            href="/signup"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors text-center"
          >
            Or start free — no credit card required
          </Link>
        )}
      </div>
    </div>
  );
}
