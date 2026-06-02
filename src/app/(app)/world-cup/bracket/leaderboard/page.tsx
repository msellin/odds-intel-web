export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Trophy } from "lucide-react";

import { loadBracketLeaderboard } from "@/lib/wc-bracket";

export const metadata: Metadata = {
  title: "Bracket Leaderboard | World Cup 2026 | OddsIntel",
  description: "Top 100 World Cup 2026 bracket players on OddsIntel.",
  alternates: { canonical: "https://oddsintel.app/world-cup/bracket/leaderboard" },
};

function rankBadgeClasses(rank: number): string {
  if (rank === 1) return "bg-[color:var(--color-tournament-gold)] text-background";
  if (rank === 2) return "bg-zinc-300 text-background";
  if (rank === 3) return "bg-amber-700 text-foreground";
  return "bg-white/[0.06] text-muted-foreground";
}

export default async function BracketLeaderboardPage() {
  const entries = await loadBracketLeaderboard(100);

  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/world-cup/bracket" className="inline-flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="size-3" />
          Bracket
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground">Leaderboard</span>
      </div>

      <header className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trophy className="size-4 text-[color:var(--color-tournament-gold)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
            Bracket Leaderboard
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Top 100</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Ranked by total score. Updates after each settled match.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-6 text-center text-sm text-muted-foreground">
          No brackets submitted yet. Be the first —{" "}
          <Link href="/world-cup/bracket" className="font-semibold text-primary hover:underline">
            pick yours
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
          <table className="w-full text-xs sm:text-sm">
            <thead className="border-b border-white/[0.06] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Player</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const rank = e.currentRank ?? i + 1;
                return (
                  <tr key={e.userId} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-3 py-2 text-left">
                      <span
                        className={`inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${rankBadgeClasses(rank)}`}
                      >
                        {rank}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {e.displayName ?? <span className="text-muted-foreground">Anonymous player</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-foreground tabular-nums">
                      {e.currentScore}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
