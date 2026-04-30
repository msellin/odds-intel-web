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
          <span className="rounded-md border border-blue-500/20 px-5 py-2 text-xs font-medium text-blue-400/50 text-center cursor-default">
            Pro — Coming Soon
          </span>
        )}
        {!isElite && (
          <span className="rounded-md border border-emerald-500/20 px-5 py-2 text-xs font-medium text-emerald-400/50 text-center cursor-default">
            Elite — Coming Soon
          </span>
        )}
      </div>
    </div>
  );
}
