import Link from "next/link";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";
import type { WhatChangedItem } from "@/lib/engine-data";

interface Props {
  items: WhatChangedItem[];
  isPro: boolean;
}

function MagnitudeDot({ magnitude }: { magnitude: "small" | "medium" | "large" }) {
  const colors = {
    small: "bg-muted-foreground/40",
    medium: "bg-amber-500/70",
    large: "bg-red-500/80",
  };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors[magnitude]}`} />;
}

export function WhatChangedToday({ items, isPro }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Zap className="size-3.5 text-amber-400" />
        <h2 className="text-sm font-semibold text-foreground">What Changed Today</h2>
        <span className="ml-auto text-xs text-muted-foreground/60">last 8h vs yesterday</span>
      </div>

      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={`${item.matchId}-${item.signalName}-${i}`}>
            <Link
              href={`/matches/${item.matchId}`}
              className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
            >
              {/* Direction indicator */}
              <span className={`shrink-0 ${item.direction === "up" ? "text-emerald-400" : "text-red-400"}`}>
                {item.direction === "up" ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
              </span>

              {/* Match + signal */}
              <div className="min-w-0 flex-1">
                <span className="truncate text-xs font-medium text-foreground group-hover:text-foreground/90">
                  {item.homeTeam} vs {item.awayTeam}
                </span>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  · {item.signalLabel}
                </span>
              </div>

              {/* Delta — Pro sees exact value, free sees magnitude dot */}
              <span className="shrink-0">
                {isPro ? (
                  <span
                    className={`text-xs font-medium tabular-nums ${
                      item.direction === "up" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {item.delta > 0 ? "+" : ""}
                    {item.delta.toFixed(2)}
                  </span>
                ) : (
                  <MagnitudeDot magnitude={item.magnitude} />
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {!isPro && (
        <p className="mt-2 border-t border-white/[0.04] pt-2 text-xs text-muted-foreground/60">
          <Link href="/pricing" className="underline underline-offset-2 hover:text-muted-foreground">
            Pro
          </Link>{" "}
          shows exact values for each change.
        </p>
      )}
    </div>
  );
}
