export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Bot, ChevronLeft } from "lucide-react";

import {
  loadBracketLeaderboard,
  PERCENTILE_DISPLAY_THRESHOLD,
} from "@/lib/wc-bracket";
import { createSupabaseServer } from "@/lib/supabase-server";
import { loadLeaderboardAchievements } from "@/lib/wc-achievements";
import {
  WCAchievementRow,
  type UserAchievement,
} from "@/components/wc-achievement-badge";

export const metadata: Metadata = {
  title: "Bracket Leaderboard | World Cup 2026 | OddsIntel",
  description:
    "Top 100 World Cup 2026 bracket players on OddsIntel — humans + 5 AI ghost models on the same combined ranking.",
  alternates: { canonical: "https://oddsintel.app/world-cup/bracket/leaderboard" },
};

function rankBadgeClasses(rank: number, isAi: boolean): string {
  if (isAi) return "bg-white/[0.04] text-muted-foreground/70 ring-1 ring-white/[0.04]";
  if (rank === 1) return "bg-[color:var(--color-tournament-gold)] text-background";
  if (rank === 2) return "bg-zinc-300 text-background";
  if (rank === 3) return "bg-amber-700 text-foreground";
  return "bg-white/[0.06] text-muted-foreground";
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export default async function BracketLeaderboardPage() {
  const currentUserId = await getCurrentUserId();
  const entries = await loadBracketLeaderboard({
    limit: 100,
    currentUserId,
  });

  // WC-ACHIEVEMENTS: batch-load badges for every human row on the page.
  // AI ghosts are skipped (userId is null). Returns an empty Map if the
  // table is missing — rows render without badges, no errors.
  const humanIds = entries
    .map((e) => e.userId)
    .filter((id): id is string => !!id);
  let achievementsByUser = new Map<string, UserAchievement[]>();
  try {
    achievementsByUser = await loadLeaderboardAchievements(humanIds);
  } catch {
    // Pre-migration safety — render the page without badges.
  }

  // LEADERBOARD-DECLUTTER (2026-06-02): percentile mode is meaningless
  // pre-tournament when every score is 0 — "Top 1%" / "Top 50%" labels
  // were just noise. We now always show absolute rank. Population check
  // kept so the constant import isn't dead code; once the tournament fills
  // the board we can reintroduce a tighter percentile threshold.
  const maxRank = entries.reduce((m, e) => Math.max(m, e.currentRank ?? 0), 0);
  const populationN = Math.max(maxRank, entries.length);
  const hasMeaningfulScores = entries.some((e) => (e.totalScore ?? 0) > 0);
  const usePercentile =
    hasMeaningfulScores && populationN < PERCENTILE_DISPLAY_THRESHOLD;

  // LEADERBOARD-USER-PIN (2026-06-02): pin the current user at the BOTTOM
  // (not the top) of the visible page when they're outside the rendered
  // window — most users will scroll the table looking for their row, so
  // a tail-pin reads as "this is where you are" rather than a strange
  // top duplicate.
  const topN = 50;
  const meIndex = entries.findIndex((e) => e.isCurrentUser);
  const pinnedMe = meIndex >= topN ? entries[meIndex] : null;

  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          href="/world-cup/bracket"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ChevronLeft className="size-3" />
          Bracket
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground">Leaderboard</span>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Leaderboard
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Group standings + knockout bracket · top 3 humans win 1 month Elite ·{" "}
          <span className="inline-flex items-center gap-0.5">
            <Bot className="size-3" /> AI
          </span>{" "}
          ghosts not eligible for prizes.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-6 text-center text-sm text-muted-foreground">
          No brackets submitted yet. Be the first —{" "}
          <Link
            href="/world-cup/bracket"
            className="font-semibold text-primary hover:underline"
          >
            pick yours
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
          <table className="w-full text-xs sm:text-sm">
            <thead className="border-b border-white/[0.06] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">
                  {usePercentile ? "Top %" : "#"}
                </th>
                <th className="px-3 py-2 text-left font-medium">Player</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                  Groups
                </th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                  Bracket
                </th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, topN).map((e, i) => (
                <LeaderboardRow
                  key={e.key}
                  e={e}
                  i={i}
                  usePercentile={usePercentile}
                  achievements={
                    e.userId ? achievementsByUser.get(e.userId) ?? [] : []
                  }
                />
              ))}
              {pinnedMe && (
                <>
                  <tr aria-hidden>
                    <td
                      colSpan={5}
                      className="border-y border-dashed border-white/[0.08] px-3 py-1.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground/60"
                    >
                      Your position
                    </td>
                  </tr>
                  <LeaderboardRow
                    e={pinnedMe}
                    i={meIndex}
                    usePercentile={usePercentile}
                    achievements={
                      pinnedMe.userId
                        ? achievementsByUser.get(pinnedMe.userId) ?? []
                        : []
                    }
                    isPinnedView
                  />
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  e: Awaited<ReturnType<typeof loadBracketLeaderboard>>[number];
  i: number;
  usePercentile: boolean;
  achievements: UserAchievement[];
  isPinnedView?: boolean;
}

function rowBgClass(isCurrentUser: boolean, isAi: boolean): string {
  if (isCurrentUser) return "bg-primary/[0.06]";
  if (isAi) return "bg-white/[0.01]";
  return "";
}

function RankCell({
  rank,
  isAi,
  usePercentile,
  percentile,
}: {
  rank: number;
  isAi: boolean;
  usePercentile: boolean;
  percentile: number | null;
}) {
  if (usePercentile && percentile != null) {
    return (
      <span className="inline-flex items-center rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-foreground tabular-nums">
        Top {Math.max(1, Math.round(100 - percentile))}%
      </span>
    );
  }
  return (
    <span
      className={`inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${rankBadgeClasses(rank, isAi)}`}
    >
      {rank}
    </span>
  );
}

// WC-GHOSTS-LAYER-2 (2026-06-02): anonymous AI variants are stored with
// ai_label = "Player NNN" (3-digit zero-padded). They render WITHOUT the
// "AI" badge and with extra-muted text so they look like rank-and-file
// players, not labelled bots. Named strategies (Elite AI / Pro AI / etc.)
// keep the AI badge so the "beat the AI" narrative is intact.
function isAnonymousVariant(aiLabel: string | undefined | null): boolean {
  if (!aiLabel) return false;
  return /^Player \d+$/.test(aiLabel);
}

function nameClass(isAi: boolean, anonymousVariant: boolean): string {
  if (anonymousVariant) return "text-muted-foreground/60";
  if (isAi) return "text-muted-foreground";
  return "";
}

function PlayerCell({
  e,
  achievements,
}: {
  e: RowProps["e"];
  achievements: UserAchievement[];
}) {
  const name = e.isAi ? e.aiLabel : (e.displayName ?? "Anonymous player");
  const anonymousVariant = e.isAi && isAnonymousVariant(e.aiLabel);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {e.isAi && !anonymousVariant && (
        <span
          aria-label="AI ghost"
          className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-white/[0.06]"
        >
          <Bot className="size-2.5" />
          AI
        </span>
      )}
      {e.isCurrentUser && (
        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
          you
        </span>
      )}
      <span className={nameClass(e.isAi, anonymousVariant)}>{name}</span>
      {achievements.length > 0 && (
        <WCAchievementRow achievements={achievements} max={3} size="xs" />
      )}
    </div>
  );
}

function LeaderboardRow({
  e,
  i,
  usePercentile,
  achievements,
  isPinnedView,
}: RowProps) {
  const rank = e.currentRank ?? i + 1;
  const rowKey = isPinnedView ? `pin-${e.key}` : e.key;

  return (
    <tr
      key={rowKey}
      className={`border-b border-white/[0.04] last:border-0 ${rowBgClass(!!e.isCurrentUser, e.isAi)}`}
    >
      <td className="px-3 py-2 text-left">
        <RankCell
          rank={rank}
          isAi={e.isAi}
          usePercentile={usePercentile}
          percentile={e.currentPercentile}
        />
      </td>
      <td className="px-3 py-2 text-foreground">
        <PlayerCell e={e} achievements={achievements} />
      </td>
      <td className="hidden px-3 py-2 text-right font-mono text-muted-foreground tabular-nums sm:table-cell">
        {e.groupScore}
      </td>
      <td className="hidden px-3 py-2 text-right font-mono text-muted-foreground tabular-nums sm:table-cell">
        {e.bracketScore}
      </td>
      <td className="px-3 py-2 text-right font-mono font-semibold text-foreground tabular-nums">
        {e.totalScore}
      </td>
    </tr>
  );
}
