import { Check, X } from "lucide-react";

interface Props {
  currentTier: "free" | "pro" | "elite";
}

const FEATURES = [
  { name: "Match predictions (1x2)", free: true, pro: true, elite: true },
  { name: "Basic odds (worst available)", free: true, pro: false, elite: false },
  { name: "Best odds across 13 bookmakers", free: false, pro: true, elite: true },
  { name: "Odds movement & line history", free: false, pro: true, elite: true },
  { name: "Value bet alerts (edge > 5%)", free: false, pro: true, elite: true },
  { name: "CLV tracking per bet", free: false, pro: true, elite: true },
  { name: "Full prediction history + filters", free: false, pro: true, elite: true },
  { name: "Injury & form signals", free: false, pro: true, elite: true },
  { name: "Kelly staking recommendations", free: false, pro: false, elite: true },
  { name: "AI bet explanations", free: false, pro: false, elite: true },
  { name: "Full signal stack + confidence breakdown", free: false, pro: false, elite: true },
  { name: "Advanced analytics (CLV by league, edge buckets)", free: false, pro: false, elite: true },
];

export function TierFeatureComparison({ currentTier }: Props) {
  const isPro = currentTier === "pro" || currentTier === "elite";
  const isElite = currentTier === "elite";

  // Don't show if user is already Elite
  if (isElite) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">What Each Tier Unlocks</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {isPro
            ? "You have Pro. Here's what Elite adds on top."
            : "See exactly what you're missing at each level."}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30">
              <th className="py-2 text-left font-medium text-muted-foreground text-[10px] uppercase tracking-wider">
                Feature
              </th>
              <th className="py-2 text-center font-medium text-[10px] uppercase tracking-wider w-16">
                <span className={currentTier === "free" ? "text-foreground font-bold" : "text-muted-foreground"}>
                  Free
                </span>
              </th>
              <th className="py-2 text-center font-medium text-[10px] uppercase tracking-wider w-16">
                <span className={currentTier === "pro" ? "text-blue-400 font-bold" : "text-blue-400/70"}>
                  Pro
                </span>
              </th>
              <th className="py-2 text-center font-medium text-[10px] uppercase tracking-wider w-16">
                <span className="text-emerald-400/70">
                  Elite
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {FEATURES.map((feature) => (
              <tr key={feature.name} className="hover:bg-muted/5">
                <td className="py-2 pr-4 text-muted-foreground">{feature.name}</td>
                <td className="py-2 text-center">
                  {feature.free ? (
                    <Check className="mx-auto h-3.5 w-3.5 text-foreground/50" />
                  ) : (
                    <X className="mx-auto h-3.5 w-3.5 text-muted-foreground/20" />
                  )}
                </td>
                <td className="py-2 text-center">
                  {feature.pro ? (
                    <Check className="mx-auto h-3.5 w-3.5 text-blue-400" />
                  ) : (
                    <X className="mx-auto h-3.5 w-3.5 text-muted-foreground/20" />
                  )}
                </td>
                <td className="py-2 text-center">
                  {feature.elite ? (
                    <Check className="mx-auto h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <X className="mx-auto h-3.5 w-3.5 text-muted-foreground/20" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center pt-1">
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
