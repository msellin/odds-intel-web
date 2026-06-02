export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Users, ChevronLeft } from "lucide-react";

import {
  loadUserBracket,
  isBracketLocked,
  loadBracketState,
  currentOpenRound,
  nextRound,
  PERCENTILE_DISPLAY_THRESHOLD,
} from "@/lib/wc-bracket";
import { ROUND_LABELS } from "@/lib/wc-bracket-types";
import { WCBracketBoard } from "@/components/wc-bracket-board";

export const metadata: Metadata = {
  title: "World Cup 2026 Bracket Challenge | OddsIntel",
  description:
    "Pick your bracket for FIFA World Cup 2026 stage-by-stage — each knockout round opens when the previous one finishes. Compete against OddsIntel's model and the community.",
  alternates: { canonical: "https://oddsintel.app/world-cup/bracket" },
};

/** Choose the right rank pill to render. */
function MetaRankPill({
  rank,
  percentile,
}: {
  rank: number | null;
  percentile: number | null | undefined;
}) {
  if (percentile != null && (rank ?? 0) > PERCENTILE_DISPLAY_THRESHOLD) {
    return (
      <span className="text-muted-foreground">
        Top {Math.max(1, Math.round(100 - percentile))}%
      </span>
    );
  }
  if (rank != null) {
    return <span className="text-muted-foreground">Rank #{rank}</span>;
  }
  return null;
}

export default async function BracketPage() {
  const [{ picks, meta, isAuthed }, roundStates] = await Promise.all([
    loadUserBracket(),
    loadBracketState(),
  ]);
  const goldenBootLocked = isBracketLocked();
  const open = currentOpenRound(roundStates);
  const upcoming = nextRound(roundStates);

  return (
    <div className="space-y-4 pb-12 sm:space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/world-cup" className="inline-flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="size-3" />
          Tournament hub
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground">Bracket</span>
      </div>

      <header className="overflow-hidden rounded-2xl border border-[color:var(--color-tournament-gold)]/20 bg-gradient-to-br from-card via-card to-[color:var(--color-tournament-gold)]/5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Trophy className="size-4 text-[color:var(--color-tournament-gold)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
                Bracket Challenge
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Pick each round when it opens.
            </h1>
            <p className="max-w-md text-xs text-muted-foreground sm:text-sm">
              Stage-gated like BBC / ESPN. Each knockout round opens after the previous one
              finishes — you pick the winner of each matchup, then the next round seeds.
            </p>
            {open ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/30">
                Now open: {ROUND_LABELS[open.round]}
              </p>
            ) : upcoming ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-white/[0.06]">
                Next round: {ROUND_LABELS[upcoming.round]}
              </p>
            ) : null}
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-tournament-gold)]/15 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-tournament-gold)] ring-1 ring-[color:var(--color-tournament-gold)]/30">
              <Trophy className="size-3" />
              Top 3 brackets win 1 month Elite — free
            </p>
          </div>
          <Link
            href="/world-cup/bracket/leaderboard"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.08] bg-card/40 px-3 py-2 text-xs font-semibold text-foreground hover:border-white/[0.16]"
          >
            <Users className="size-3" />
            Leaderboard
          </Link>
        </div>
        {meta && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3 text-xs">
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-semibold text-primary">
              Total: {meta.totalScore ?? meta.currentScore} pt
            </span>
            <span className="text-muted-foreground">
              Bracket {meta.currentScore} · Groups {meta.groupStandingsScore ?? 0}
            </span>
            <MetaRankPill rank={meta.currentRank} percentile={meta.currentPercentile} />
            {meta.goldenBootPlayer && (
              <span className="text-muted-foreground">
                Golden Boot: <span className="text-foreground">{meta.goldenBootPlayer}</span>
              </span>
            )}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3 text-xs">
          <Link
            href="/world-cup/groups-predictor"
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-card/40 px-3 py-2 font-semibold text-foreground hover:border-white/[0.16]"
          >
            Pick group standings (48 picks · +192 pt)
          </Link>
        </div>
      </header>

      <WCBracketBoard
        isAuthed={isAuthed}
        roundStates={roundStates}
        initialPicks={picks}
        goldenBoot={meta?.goldenBootPlayer ?? null}
        isGoldenBootLocked={goldenBootLocked}
      />

      {/* Scoring legend */}
      <section className="rounded-xl border border-white/[0.06] bg-card/40 p-3 text-xs text-muted-foreground">
        <h3 className="mb-2 font-semibold text-foreground">Scoring (per correct matchup)</h3>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <li>R32: <span className="font-mono text-foreground">+1</span></li>
          <li>R16: <span className="font-mono text-foreground">+2</span></li>
          <li>QF: <span className="font-mono text-foreground">+4</span></li>
          <li>SF: <span className="font-mono text-foreground">+8</span></li>
          <li>Final: <span className="font-mono text-foreground">+16</span></li>
          <li>Champion: <span className="font-mono text-[color:var(--color-tournament-gold)]">+32</span></li>
          <li>Golden Boot: <span className="font-mono text-foreground">+10</span></li>
        </ul>
        <p className="mt-2 text-[10px] text-muted-foreground/60">
          Max possible: 122 pts (bracket 112 + Golden Boot 10). Scoring runs after each
          settled match. You pick the winner of each specific matchup — not a generic
          team-advances pool.
        </p>
      </section>
    </div>
  );
}
