/**
 * WC-ACTIVITY-TILES (2026-06-02) — small stat row above the WC tab strip.
 *
 * Three counters refreshed on every page render (server component):
 *   • 🎯 brackets locked in    — distinct entries with any pick
 *   • 📊 picks made today      — group + bracket + 1X2 picks in last 24h
 *   • 👥 group standings predicted — distinct entries with any group pick
 *
 * Counters aggregate humans + AI ghosts together — the WC leaderboard does the
 * same, so the numbers stay honest with the displayed ranking.
 */

import { Target, Activity, Users } from "lucide-react";

import type { WCActivityStats } from "@/lib/wc-bracket";

interface Tile {
  icon: typeof Target;
  label: string;
  value: number;
  emoji: string;
}

export function WCActivityTiles({ stats }: { stats: WCActivityStats }) {
  // Don't render the row at all if every counter is zero — pre-launch we'd
  // rather show nothing than three goose-eggs that imply the game is dead.
  const total =
    stats.bracketsLockedIn +
    stats.picksMadeToday +
    stats.groupStandingsPredicted;
  if (total === 0) return null;

  const tiles: Tile[] = [
    {
      icon: Target,
      emoji: "🎯",
      label: "brackets locked in",
      value: stats.bracketsLockedIn,
    },
    {
      icon: Activity,
      emoji: "📊",
      label: "picks made today",
      value: stats.picksMadeToday,
    },
    {
      icon: Users,
      emoji: "👥",
      label: "group standings predicted",
      value: stats.groupStandingsPredicted,
    },
  ];

  return (
    <section
      aria-label="Tournament activity"
      className="grid grid-cols-3 gap-2 sm:gap-3"
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-xl border border-white/[0.06] bg-card/40 px-3 py-2 sm:px-4 sm:py-3"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[11px]">
            <span aria-hidden>{t.emoji}</span>
            <span className="truncate">{t.label}</span>
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-foreground tabular-nums sm:text-2xl">
            {t.value.toLocaleString()}
          </div>
        </div>
      ))}
    </section>
  );
}
