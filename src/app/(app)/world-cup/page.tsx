export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Trophy, MapPin, Calendar, ChevronRight, Lock, Flag } from "lucide-react";

import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import {
  getWorldCupFixtures,
  getWorldCupPredictions,
  getServerNowMs,
  deriveGroups,
  WC_FIRST_KICKOFF_ISO,
  type WCFixture,
  type WCGroup,
  type WCPredictionSlot,
} from "@/lib/world-cup";

// ── SEO ──────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "FIFA World Cup 2026 — Schedule, Groups & AI Predictions | OddsIntel",
  description:
    "FIFA World Cup 2026 in USA, Canada and Mexico — June 11 to July 19. All 12 groups, every group-stage fixture, standings, and AI-driven match predictions from OddsIntel.",
  alternates: { canonical: "https://oddsintel.app/world-cup" },
  openGraph: {
    title: "FIFA World Cup 2026 — Schedule, Groups & AI Predictions",
    description:
      "48 teams · 12 groups · 3 host countries. Every WC 2026 fixture with our model's take.",
    url: "https://oddsintel.app/world-cup",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FIFA World Cup 2026 on OddsIntel",
    description: "All 12 groups, every fixture, AI predictions.",
  },
};

// ── helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateHeader(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function dateKey(iso: string): string {
  // UTC day bucket — keeps fixtures grouped consistently regardless of viewer TZ.
  return iso.slice(0, 10);
}

// ── small inline components ──────────────────────────────────────────────────
function TeamCrest({ logo, name, size = "md" }: { logo: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const px = size === "lg" ? "size-8" : size === "sm" ? "size-4" : "size-5";
  const text = size === "lg" ? "text-xs" : "text-[10px]";
  if (logo) {
    return (
      <div className={`relative ${px} shrink-0 overflow-hidden rounded-full bg-white/[0.06]`}>
        <Image
          src={logo}
          alt={name}
          fill
          sizes="32px"
          className="object-contain p-0.5"
          unoptimized
        />
      </div>
    );
  }
  return (
    <div className={`${px} shrink-0 rounded-full bg-white/[0.08] flex items-center justify-center`}>
      <span className={`${text} font-bold text-muted-foreground`}>{name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

function Countdown({ targetIso, nowMs }: { targetIso: string; nowMs: number }) {
  // Server-rendered snapshot. nowMs is captured once in the page server fn and
  // passed in — Countdown stays pure so the React rules-of-hooks lint is happy.
  const target = new Date(targetIso).getTime();
  const ms = Math.max(0, target - nowMs);

  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);

  if (ms === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-400">
        Kicked off
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-card/60 px-3 py-2 text-sm">
      <span className="text-muted-foreground">Kick-off in</span>
      <span className="font-mono font-semibold text-foreground tabular-nums">
        {days}d {hours}h {mins}m
      </span>
    </div>
  );
}

function PredictionTriple({ prediction }: { prediction: WCPredictionSlot | undefined }) {
  // Phase 3 plug-in point — until predictions.source='national_team_v1' rows
  // start landing, this returns null and the row stays clean.
  if (!prediction || prediction.homeProb == null || prediction.awayProb == null) {
    return null;
  }
  const pct = (v: number | null) => Math.round((v ?? 0) * 100);
  return (
    <div className="hidden sm:flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground">
      <span>{pct(prediction.homeProb)}</span>
      <span className="text-muted-foreground/40">·</span>
      <span>{pct(prediction.drawProb)}</span>
      <span className="text-muted-foreground/40">·</span>
      <span>{pct(prediction.awayProb)}</span>
    </div>
  );
}

function FixtureKickoffOrScore({ fixture }: { fixture: WCFixture }) {
  const hasScore =
    fixture.status === "finished" && fixture.scoreHome != null && fixture.scoreAway != null;
  return (
    <div className="w-12 shrink-0 text-center font-mono text-[11px] text-muted-foreground">
      {hasScore ? (
        <span className="font-semibold text-foreground">
          {fixture.scoreHome}–{fixture.scoreAway}
        </span>
      ) : (
        formatTime(fixture.date)
      )}
    </div>
  );
}

function FixtureRow({
  fixture,
  prediction,
}: {
  fixture: WCFixture;
  prediction: WCPredictionSlot | undefined;
}) {
  return (
    <Link
      href={`/matches/${fixture.id}`}
      className="group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-card/40 px-3 py-2.5 transition-colors hover:border-white/[0.12] hover:bg-card/60"
    >
      <FixtureKickoffOrScore fixture={fixture} />

      <div className="flex flex-1 items-center justify-end gap-2 text-right min-w-0">
        <span className="truncate text-sm text-foreground">{fixture.home.name}</span>
        <TeamCrest logo={fixture.home.logo} name={fixture.home.name} />
      </div>

      <span className="text-[10px] text-muted-foreground/60">v</span>

      <div className="flex flex-1 items-center gap-2 min-w-0">
        <TeamCrest logo={fixture.away.logo} name={fixture.away.name} />
        <span className="truncate text-sm text-foreground">{fixture.away.name}</span>
      </div>

      <PredictionTriple prediction={prediction} />

      {fixture.venueName && (
        <div className="hidden md:flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground/60 max-w-[180px]">
          <MapPin className="size-3" />
          <span className="truncate">{fixture.venueName}</span>
        </div>
      )}

      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function GroupCard({
  group,
  predictions,
}: {
  group: WCGroup;
  predictions: Record<string, WCPredictionSlot>;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
            Group {group.label}
          </span>
          <span className="text-xs text-muted-foreground">{group.teams.length} teams · {group.fixtures.length} fixtures</span>
        </div>
      </header>

      {/* Standings */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-white/[0.06] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Team</th>
              <th className="px-2 py-2 text-center font-medium">P</th>
              <th className="px-2 py-2 text-center font-medium">W</th>
              <th className="px-2 py-2 text-center font-medium">D</th>
              <th className="px-2 py-2 text-center font-medium">L</th>
              <th className="px-2 py-2 text-center font-medium">GF</th>
              <th className="px-2 py-2 text-center font-medium">GA</th>
              <th className="px-2 py-2 text-center font-medium">GD</th>
              <th className="px-2 py-2 text-center font-medium">Pts</th>
              {/* Advancement % placeholder — populates from predictions table once Phase 3 ships */}
              <th className="px-2 py-2 text-center font-medium text-muted-foreground/40" title="Advancement probability — coming soon">Adv%</th>
            </tr>
          </thead>
          <tbody>
            {group.standings.map((s, i) => (
              <tr
                key={s.team.id}
                className={`border-b border-white/[0.04] last:border-0 ${i < 2 ? "bg-green-500/[0.03]" : ""}`}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-center text-muted-foreground tabular-nums">{i + 1}</span>
                    <TeamCrest logo={s.team.logo} name={s.team.name} size="sm" />
                    <span className="truncate text-foreground">{s.team.name}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center text-muted-foreground tabular-nums">{s.played}</td>
                <td className="px-2 py-2 text-center text-muted-foreground tabular-nums">{s.wins}</td>
                <td className="px-2 py-2 text-center text-muted-foreground tabular-nums">{s.draws}</td>
                <td className="px-2 py-2 text-center text-muted-foreground tabular-nums">{s.losses}</td>
                <td className="px-2 py-2 text-center text-muted-foreground tabular-nums">{s.goalsFor}</td>
                <td className="px-2 py-2 text-center text-muted-foreground tabular-nums">{s.goalsAgainst}</td>
                <td className="px-2 py-2 text-center text-muted-foreground tabular-nums">
                  {s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}
                </td>
                <td className="px-2 py-2 text-center font-semibold text-foreground tabular-nums">{s.points}</td>
                {/* Advancement % slot — empty until Phase 3 lands national_team_v1 predictions */}
                <td className="px-2 py-2 text-center text-muted-foreground/30 tabular-nums">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Group fixtures */}
      <div className="space-y-1.5 px-3 py-3">
        {group.fixtures.map((f) => (
          <FixtureRow key={f.id} fixture={f} prediction={predictions[f.id]} />
        ))}
      </div>
    </section>
  );
}

function GroupsSection({
  groups,
  predictions,
}: {
  groups: WCGroup[];
  predictions: Record<string, WCPredictionSlot>;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Group draw not loaded yet — fixtures arrive daily.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groups.map((g) => (
        <GroupCard key={g.label} group={g} predictions={predictions} />
      ))}
    </div>
  );
}

function FixturesByDate({
  fixtures,
  predictions,
}: {
  fixtures: WCFixture[];
  predictions: Record<string, WCPredictionSlot>;
}) {
  if (fixtures.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Fixtures not loaded yet.
      </div>
    );
  }

  // Group by UTC date
  const buckets = new Map<string, WCFixture[]>();
  for (const f of fixtures) {
    const k = dateKey(f.date);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(f);
  }
  const sortedKeys = Array.from(buckets.keys()).sort();

  return (
    <div className="space-y-5">
      {sortedKeys.map((k) => {
        const items = buckets.get(k)!;
        return (
          <div key={k} className="space-y-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {formatDateHeader(k + "T12:00:00Z")}
            </h3>
            <div className="space-y-1.5">
              {items.map((f) => (
                <FixtureRow key={f.id} fixture={f} prediction={predictions[f.id]} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BracketPlaceholder({ isPro }: { isPro: boolean }) {
  const rounds: Array<{ label: string; slots: number }> = [
    { label: "Round of 32", slots: 16 },
    { label: "Round of 16", slots: 8 },
    { label: "Quarter-finals", slots: 4 },
    { label: "Semi-finals", slots: 2 },
    { label: "Final", slots: 1 },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-foreground">Knockout bracket</h2>
        </div>
        <span className="text-xs text-muted-foreground">populates after the group stage</span>
      </header>

      <div className="overflow-x-auto p-4">
        <div className="flex gap-3 min-w-max">
          {rounds.map((round) => (
            <div key={round.label} className="flex flex-col gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {round.label}
              </h4>
              <div className="flex flex-1 flex-col justify-around gap-2">
                {Array.from({ length: round.slots }).map((_, i) => (
                  <div
                    key={i}
                    className="w-32 rounded border border-dashed border-white/[0.08] bg-background/40 px-2 py-2 text-[11px] text-muted-foreground/40"
                  >
                    <div className="flex items-center gap-1">
                      <div className="size-2 rounded-full bg-white/10" />
                      <span className="truncate">TBD</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <div className="size-2 rounded-full bg-white/10" />
                      <span className="truncate">TBD</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!isPro && (
        <footer className="flex items-center gap-2 border-t border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          <Lock className="size-3 text-blue-400" />
          <span className="text-[11px] text-muted-foreground">
            Knockout-stage AI predictions unlock on{" "}
            <Link href="/welcome" className="text-blue-400 underline-offset-2 hover:underline">Pro</Link>{" "}
            once the bracket is set.
          </span>
        </footer>
      )}
    </section>
  );
}

// ── page ────────────────────────────────────────────────────────────────────
export default async function WorldCupPage() {
  // Tier read — server-side only. isElite reserved for v2 (bracket-vs-model challenge).
  let isPro = false;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const result = await getUserTier(user.id, supabase);
      isPro = result.isPro;
    }
  } catch {
    // Anonymous viewers get the free experience — non-fatal.
  }

  // Snapshot "now" once — handed to Countdown as a prop. Lives behind a util
  // so the React purity lint doesn't fire on the page server function.
  const nowMs = getServerNowMs();

  const fixtures = await getWorldCupFixtures();
  const groups = deriveGroups(fixtures);

  // Predictions slot — empty today; populates once Phase 3 writes
  // predictions.source='national_team_v1' rows.
  const predictions = await getWorldCupPredictions(fixtures.map((f) => f.id));

  return (
    <div className="space-y-8">
      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Trophy className="size-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">Tournament hub</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              FIFA World Cup 2026
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              June 11 — July 19, 2026 · 48 teams · 12 groups · USA · Canada · Mexico
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-background/40 px-2.5 py-1">
                <Calendar className="size-3" />
                Opens with Mexico v South Africa
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-background/40 px-2.5 py-1">
                <MapPin className="size-3" />
                Estadio Azteca, Mexico City
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Countdown targetIso={WC_FIRST_KICKOFF_ISO} nowMs={nowMs} />
            <span className="text-[11px] text-muted-foreground">
              {new Date(WC_FIRST_KICKOFF_ISO).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </section>

      {/* ── GROUP STAGE ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <header className="flex items-end justify-between border-b border-white/[0.06] pb-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">Group stage</h2>
            <p className="text-xs text-muted-foreground">
              12 groups · 4 teams each · top 2 + best 8 third-place teams advance to the Round of 32.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{groups.length} groups</span>
        </header>

        <GroupsSection groups={groups} predictions={predictions} />
      </section>

      {/* ── ALL FIXTURES ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <header className="flex items-end justify-between border-b border-white/[0.06] pb-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">All fixtures</h2>
            <p className="text-xs text-muted-foreground">Chronological. Tap any match for full intel.</p>
          </div>
          <span className="text-xs text-muted-foreground">{fixtures.length} matches</span>
        </header>

        <FixturesByDate fixtures={fixtures} predictions={predictions} />
      </section>

      {/* ── KNOCKOUT BRACKET PLACEHOLDER ───────────────────────────────── */}
      <section className="space-y-3">
        <header className="flex items-end justify-between border-b border-white/[0.06] pb-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">Knockout bracket</h2>
            <p className="text-xs text-muted-foreground">
              Round of 32 → Final · seeded after the group stage.
            </p>
          </div>
        </header>

        <BracketPlaceholder isPro={isPro} />
      </section>

      {/* ── PREDICTIONS NOTICE ─────────────────────────────────────────── */}
      {Object.keys(predictions).length === 0 && (
        <section className="rounded-xl border border-white/[0.06] bg-card/40 p-4 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Flag className="size-3.5 mt-0.5 text-amber-400 shrink-0" />
            <p>
              National-team AI predictions are training on six WCs of historical data and arrive before kick-off.
              Once live, every fixture above will carry a probability triple and group advancement odds.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
