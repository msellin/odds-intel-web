export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Bot, ChevronLeft, Trophy } from "lucide-react";

import {
  loadBracketLeaderboard,
  PERCENTILE_DISPLAY_THRESHOLD,
} from "@/lib/wc-bracket";
import { createSupabaseServer } from "@/lib/supabase-server";

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

  // Total population — drives percentile vs absolute-rank display.
  // Use the largest rank we see as a proxy for N when it's available;
  // any entry whose rank is null fall back to entries.length.
  const maxRank = entries.reduce(
    (m, e) => Math.max(m, e.currentRank ?? 0),
    0
  );
  const populationN = Math.max(maxRank, entries.length);
  const usePercentile = populationN < PERCENTILE_DISPLAY_THRESHOLD;

  // Top-of-list pin: if the current user is in `entries` but outside the
  // top 50, pull a copy of them to render at the very top (as well as in
  // their natural row). When they're in the top 50, no pinning needed.
  const topN = 50;
  const meIndex = entries.findIndex((e) => e.isCurrentUser);
  const pinnedMe =
    meIndex >= topN ? entries[meIndex] : null;

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
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trophy className="size-4 text-[color:var(--color-tournament-gold)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
            Bracket Leaderboard
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Combined leaderboard
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Total = group standings + knockout bracket. Updates after each settled
          match.
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-[11px] text-muted-foreground/80">
          <Bot className="mt-0.5 size-3 shrink-0" />
          <span>
            <span className="text-foreground">🤖 AI ghost</span> entries are our
            model running in 5 different configurations. They compete on the
            same board but are{" "}
            <span className="font-semibold">not eligible for prizes</span> — top
            3 humans win 1 month of Elite, free.
          </span>
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
              {pinnedMe && (
                <LeaderboardRow
                  e={pinnedMe}
                  i={meIndex}
                  usePercentile={usePercentile}
                  isPinnedView
                />
              )}
              {entries.slice(0, topN).map((e, i) => (
                <LeaderboardRow
                  key={e.key}
                  e={e}
                  i={i}
                  usePercentile={usePercentile}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/60">
        🤖 = AI ghost (model entry). Not eligible for prizes; on the board for
        benchmarking.
      </p>
    </div>
  );
}

interface RowProps {
  e: Awaited<ReturnType<typeof loadBracketLeaderboard>>[number];
  i: number;
  usePercentile: boolean;
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

function LeaderboardRow({ e, i, usePercentile, isPinnedView }: RowProps) {
  const rank = e.currentRank ?? i + 1;
  const rowKey = isPinnedView ? `pin-${e.key}` : e.key;
  const name = e.isAi ? e.aiLabel : (e.displayName ?? "Anonymous player");
  const anonymousVariant = e.isAi && isAnonymousVariant(e.aiLabel);

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
        <div className="flex items-center gap-1.5">
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
          <span
            className={
              anonymousVariant
                ? "text-muted-foreground/60"
                : e.isAi
                ? "text-muted-foreground"
                : ""
            }
          >
            {name}
          </span>
        </div>
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
