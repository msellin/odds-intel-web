/**
 * WC-ACHIEVEMENTS (2026-06-02): pure-presentational achievement badge.
 *
 * Takes a slug + earned_at + optional JSONB detail. Renders an emoji + title
 * + a tooltip on hover/focus. Mobile-first — `size="xs"` is tiny enough to
 * sit inside a leaderboard row without crowding the player name on 375px.
 *
 * The slug catalog is server-authoritative — see
 *   odds-intel-engine/workers/jobs/wc_achievement_detection.py
 * If a slug appears here but is missing in the engine, the badge will
 * simply never be awarded. If a slug appears in the engine but is missing
 * here, we render a generic fallback (so a new server-side badge doesn't
 * crash old clients).
 */

export type AchievementSlug =
  | "first_to_lock"
  | "early_bird"
  | "last_minute"
  | "groups_perfect_one"
  | "groups_perfect_three"
  | "groups_all_perfect"
  | "r32_beat_ai"
  | "final_called"
  | "champion_correct"
  | "called_the_upset"
  | "vs_you_streak_5"
  | "vs_you_streak_10"
  | "vs_you_perfect_day"
  | "viewed_all_groups"
  | "golden_boot_correct";

export interface UserAchievement {
  slug: string;
  earnedAt: string;
  detail?: Record<string, unknown> | null;
}

interface BadgeMeta {
  emoji: string;
  title: string;
  description: string;
  /** Tone token used for ring + tint. Keys map to Tailwind class fragments. */
  tone: "gold" | "emerald" | "amber" | "violet" | "sky" | "rose" | "muted";
  /** Prestige rank — higher means render first on tight surfaces (1..10). */
  prestige: number;
}

const META: Record<AchievementSlug, BadgeMeta> = {
  champion_correct: {
    emoji: "👑",
    title: "Champion oracle",
    description: "Picked the actual World Cup champion.",
    tone: "gold",
    prestige: 10,
  },
  groups_all_perfect: {
    emoji: "🧙",
    title: "Group oracle",
    description: "Called every single group's 1-4 standings correctly.",
    tone: "gold",
    prestige: 9,
  },
  r32_beat_ai: {
    emoji: "🤖",
    title: "Outsmarted the AI",
    description: "Beat OddsIntel Elite AI in Round of 32 picks.",
    tone: "amber",
    prestige: 8,
  },
  groups_perfect_three: {
    emoji: "🎯",
    title: "Triple threat",
    description: "Nailed three full groups' standings.",
    tone: "emerald",
    prestige: 7,
  },
  final_called: {
    emoji: "🏟️",
    title: "Called the final",
    description: "Picked both finalists correctly.",
    tone: "violet",
    prestige: 7,
  },
  golden_boot_correct: {
    emoji: "⚽",
    title: "Top-scorer oracle",
    description: "Predicted the Golden Boot winner.",
    tone: "gold",
    prestige: 7,
  },
  vs_you_streak_10: {
    emoji: "🔥",
    title: "10-match streak",
    description: "Ten consecutive correct per-match picks.",
    tone: "rose",
    prestige: 6,
  },
  groups_perfect_one: {
    emoji: "🎯",
    title: "Perfect group caller",
    description: "Got an entire group's 1-4 standings right.",
    tone: "emerald",
    prestige: 5,
  },
  called_the_upset: {
    emoji: "💥",
    title: "Upset alert",
    description: "Backed a lower-rated team that actually advanced.",
    tone: "violet",
    prestige: 5,
  },
  vs_you_streak_5: {
    emoji: "🔥",
    title: "5-match streak",
    description: "Five consecutive correct per-match picks.",
    tone: "rose",
    prestige: 4,
  },
  vs_you_perfect_day: {
    emoji: "📅",
    title: "Perfect day",
    description: "All matches on one day, all correct.",
    tone: "sky",
    prestige: 3,
  },
  first_to_lock: {
    emoji: "🥇",
    title: "First to lock",
    description: "Locked your bracket in the earliest 10%.",
    tone: "gold",
    prestige: 3,
  },
  early_bird: {
    emoji: "🐦",
    title: "Early bird",
    description: "Locked your bracket >24h before kickoff.",
    tone: "muted",
    prestige: 2,
  },
  last_minute: {
    emoji: "⏱️",
    title: "Last minute",
    description: "Locked your bracket within an hour of kickoff.",
    tone: "muted",
    prestige: 2,
  },
  viewed_all_groups: {
    emoji: "📖",
    title: "Tournament scholar",
    description: "Browsed all 12 group views.",
    tone: "muted",
    prestige: 1,
  },
};

const FALLBACK_META: BadgeMeta = {
  emoji: "🏅",
  title: "Achievement",
  description: "Earned a World Cup badge.",
  tone: "muted",
  prestige: 0,
};

function metaFor(slug: string): BadgeMeta {
  return META[slug as AchievementSlug] ?? FALLBACK_META;
}

const TONE_CLASSES: Record<BadgeMeta["tone"], string> = {
  gold: "bg-[color:var(--color-tournament-gold)]/15 text-[color:var(--color-tournament-gold)] ring-[color:var(--color-tournament-gold)]/40",
  emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  violet: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  sky: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  muted: "bg-white/[0.04] text-muted-foreground ring-white/[0.06]",
};

const SIZE_CLASSES = {
  xs: "h-5 min-w-5 px-1 text-[10px]",
  sm: "h-6 min-w-6 px-1.5 text-[11px]",
  md: "h-7 min-w-7 px-2 text-xs",
} as const;

export interface WCAchievementBadgeProps {
  achievement: UserAchievement;
  /** "xs" — leaderboard rows. "sm" — bracket header. "md" — profile section. */
  size?: keyof typeof SIZE_CLASSES;
  /** When true, show the title text next to the emoji. Defaults to false
   * (icon-only). Useful for the profile section. */
  showLabel?: boolean;
}

export function WCAchievementBadge({
  achievement,
  size = "sm",
  showLabel = false,
}: WCAchievementBadgeProps) {
  const meta = metaFor(achievement.slug);
  return (
    <span
      title={`${meta.title} — ${meta.description}`}
      aria-label={`${meta.title}: ${meta.description}`}
      className={[
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold leading-none ring-1 tabular-nums",
        TONE_CLASSES[meta.tone],
        SIZE_CLASSES[size],
      ].join(" ")}
    >
      <span aria-hidden>{meta.emoji}</span>
      {showLabel && <span className="truncate">{meta.title}</span>}
    </span>
  );
}

export interface WCAchievementRowProps {
  achievements: UserAchievement[];
  /** Cap the number of badges shown; the rest collapses into "+N". */
  max?: number;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

/**
 * Renders a horizontal row of badges sorted by prestige DESC, capped at
 * `max`. Designed for mobile-first — at 375px viewport a row of 3 size="xs"
 * badges fits in ~80px next to a 5-char user name without truncating the
 * name. Use max=2 or 3 on leaderboard rows; use max=8+ on the bracket
 * header where there's room to breathe.
 */
export function WCAchievementRow({
  achievements,
  max = 3,
  size = "xs",
  className,
}: WCAchievementRowProps) {
  if (!achievements || achievements.length === 0) return null;
  const sorted = [...achievements].sort(
    (a, b) => metaFor(b.slug).prestige - metaFor(a.slug).prestige
  );
  const visible = sorted.slice(0, max);
  const overflow = sorted.length - visible.length;
  return (
    <span
      className={[
        "inline-flex flex-wrap items-center gap-1",
        className ?? "",
      ].join(" ")}
    >
      {visible.map((a) => (
        <WCAchievementBadge key={a.slug} achievement={a} size={size} />
      ))}
      {overflow > 0 && (
        <span
          title={`${overflow} more achievement${overflow === 1 ? "" : "s"}`}
          aria-label={`${overflow} more achievements`}
          className={[
            "inline-flex items-center justify-center rounded-full bg-white/[0.04] font-semibold text-muted-foreground ring-1 ring-white/[0.06]",
            SIZE_CLASSES[size],
          ].join(" ")}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
