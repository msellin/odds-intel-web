export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, LayoutGrid, Lock, Trophy } from "lucide-react";

import {
  getWorldCupFixtures,
  deriveGroups,
  WC_FIRST_KICKOFF_ISO,
} from "@/lib/world-cup";
import {
  isBracketLocked,
  loadUserGroupPicks,
  MAX_GROUP_STANDINGS_SCORE,
} from "@/lib/wc-bracket";
import { WCGroupStandingsPicker } from "@/components/wc-group-standings-picker";
import { createSupabaseServer } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "World Cup 2026 Group Standings Predictor | OddsIntel",
  description:
    "Predict 1st, 2nd, 3rd and 4th in every World Cup 2026 group. Locks at kick-off (Jun 11, 19:00 UTC).",
  alternates: {
    canonical: "https://oddsintel.app/world-cup/groups-predictor",
  },
  openGraph: {
    title: "Predict the World Cup 2026 Group Standings — OddsIntel",
    description:
      "Pick 1st–4th in all 12 groups. 192 points up for grabs. Free to play, locks 11 June 19:00 UTC.",
    url: "https://oddsintel.app/world-cup/groups-predictor",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "World Cup 2026 — Predict the Group Standings",
    description:
      "12 groups, 192 points, locks at first kickoff. Free to play on OddsIntel.",
  },
};

async function isAuthed(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}

export default async function GroupsPredictorPage() {
  const fixtures = await getWorldCupFixtures();
  const groups = deriveGroups(fixtures);
  const [authed, savedPicks] = await Promise.all([
    isAuthed(),
    loadUserGroupPicks(),
  ]);
  const locked = isBracketLocked();

  // Build a {letter: {position: teamId}} map of saved picks so we can
  // pre-populate the picker. Missing positions fall back to alphabetical
  // order of the group's teams — the user can then reorder.
  const savedByLetter: Record<string, Record<number, string>> = {};
  for (const p of savedPicks) {
    if (!savedByLetter[p.groupLetter]) savedByLetter[p.groupLetter] = {};
    savedByLetter[p.groupLetter][p.position] = p.pickedTeamId;
  }

  const pickerGroups = groups.map((g) => {
    const teamIds = g.teams.map((t) => t.id);
    const saved = savedByLetter[g.label];
    // Start from saved order; fall back to natural team order for any
    // missing positions.
    const order: string[] = [];
    if (saved) {
      for (let pos = 1; pos <= 4; pos += 1) {
        const id = saved[pos];
        if (id && teamIds.includes(id) && !order.includes(id)) order.push(id);
      }
    }
    for (const id of teamIds) if (!order.includes(id)) order.push(id);
    return {
      letter: g.label,
      teams: g.teams.map((t) => ({ id: t.id, name: t.name, logo: t.logo })),
      initialOrder: order.slice(0, 4),
    };
  });

  const lockIso = new Date(WC_FIRST_KICKOFF_ISO).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <div className="space-y-4 pb-12 sm:space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          href="/world-cup"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ChevronLeft className="size-3" />
          Tournament hub
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground">Group standings</span>
      </div>

      <header className="overflow-hidden rounded-2xl border border-[color:var(--color-tournament-gold)]/20 bg-gradient-to-br from-card via-card to-[color:var(--color-tournament-gold)]/5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <LayoutGrid className="size-4 text-[color:var(--color-tournament-gold)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
                Group Standings Predictor
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Pick 1st, 2nd, 3rd, 4th — every group.
            </h1>
            <p className="max-w-md text-xs text-muted-foreground sm:text-sm">
              48 picks total. 12 groups × 4 positions. Resolves when the
              group stage ends (~Jun 27). Locks at the same instant as your
              knockout bracket — {lockIso}.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-tournament-gold)]/15 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-tournament-gold)] ring-1 ring-[color:var(--color-tournament-gold)]/30">
              <Trophy className="size-3" />
              Combined leaderboard with knockout bracket — top 3 humans win Elite
            </p>
          </div>
          <Link
            href="/world-cup/bracket"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.08] bg-card/40 px-3 py-2 text-xs font-semibold text-foreground hover:border-white/[0.16]"
          >
            Bracket
          </Link>
        </div>
        {locked && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
            <Lock className="size-3" /> Locked
          </div>
        )}
      </header>

      {pickerGroups.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-card/40 p-6 text-center text-sm text-muted-foreground">
          Group draw not loaded yet — fixtures arrive daily.
        </div>
      ) : (
        <WCGroupStandingsPicker
          groups={pickerGroups}
          isAuthed={authed}
          isLocked={locked}
        />
      )}

      {/* Scoring legend */}
      <section className="rounded-xl border border-white/[0.06] bg-card/40 p-3 text-xs text-muted-foreground">
        <h3 className="mb-2 font-semibold text-foreground">Scoring (per group)</h3>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <li>
            1st: <span className="font-mono text-foreground">+5</span>
          </li>
          <li>
            2nd: <span className="font-mono text-foreground">+3</span>
          </li>
          <li>
            3rd: <span className="font-mono text-foreground">+2</span>
          </li>
          <li>
            4th: <span className="font-mono text-foreground">+1</span>
          </li>
          <li>
            Perfect group:{" "}
            <span className="font-mono text-[color:var(--color-tournament-gold)]">+5</span>
          </li>
        </ul>
        <p className="mt-2 text-[10px] text-muted-foreground/60">
          Max per group: 16 · Max total: {MAX_GROUP_STANDINGS_SCORE} pts across 12 groups.
        </p>
      </section>
    </div>
  );
}
