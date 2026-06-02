export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Users, ChevronLeft } from "lucide-react";

import { getWorldCupFixtures } from "@/lib/world-cup";
import { loadUserBracket, isBracketLocked } from "@/lib/wc-bracket";
import { WCBracketBoard } from "@/components/wc-bracket-board";

export const metadata: Metadata = {
  title: "World Cup 2026 Bracket Challenge | OddsIntel",
  description:
    "Pick your bracket for FIFA World Cup 2026 — every round, every match. Compete against OddsIntel's model and the community.",
  alternates: { canonical: "https://oddsintel.app/world-cup/bracket" },
};

interface Team {
  id: string;
  name: string;
  logo: string | null;
}

/**
 * Build the candidate-team pool from the WC fixture list. Every team that
 * appears as home or away in a group-stage fixture qualifies for the pool.
 * Once Phase 3 knockout fixtures land, the pool will already include those
 * teams (no special-casing needed).
 */
function teamsFromFixtures(fixtures: ReturnType<typeof getWorldCupFixtures> extends Promise<infer T> ? T : never): Team[] {
  const m = new Map<string, Team>();
  for (const f of fixtures) {
    if (!m.has(f.home.id)) m.set(f.home.id, { id: f.home.id, name: f.home.name, logo: f.home.logo });
    if (!m.has(f.away.id)) m.set(f.away.id, { id: f.away.id, name: f.away.name, logo: f.away.logo });
  }
  return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default async function BracketPage() {
  const fixtures = await getWorldCupFixtures();
  const teams = teamsFromFixtures(fixtures);
  const { picks, meta, isAuthed } = await loadUserBracket();
  const locked = isBracketLocked();

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
              Pick the whole bracket.
            </h1>
            <p className="max-w-md text-xs text-muted-foreground sm:text-sm">
              R32 → Final. Compete against the OddsIntel model and the community. Locks at kick-off
              of the first match (Jun 11, 19:00 UTC).
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
              Score: {meta.currentScore}
            </span>
            {meta.currentRank != null && (
              <span className="text-muted-foreground">Rank #{meta.currentRank}</span>
            )}
            {meta.goldenBootPlayer && (
              <span className="text-muted-foreground">
                Golden Boot: <span className="text-foreground">{meta.goldenBootPlayer}</span>
              </span>
            )}
          </div>
        )}
      </header>

      <WCBracketBoard
        isAuthed={isAuthed}
        isLocked={locked}
        teams={teams}
        initialPicks={picks}
        goldenBoot={meta?.goldenBootPlayer ?? null}
      />

      {/* Scoring legend */}
      <section className="rounded-xl border border-white/[0.06] bg-card/40 p-3 text-xs text-muted-foreground">
        <h3 className="mb-2 font-semibold text-foreground">Scoring</h3>
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
          Max possible: 83 pts. Scoring runs after each settled match.
        </p>
      </section>
    </div>
  );
}
