/**
 * WC-E2 — per-nation team detail pages for FIFA World Cup 2026.
 *
 * Route: /world-cup/teams/[name]  (slug = lowercase team name, spaces → hyphens)
 *
 * Server component. All data loads happen here:
 *   - team identity (resolved from WC fixtures' team set)
 *   - group + standings (re-derived from the shared WC fixture list)
 *   - all of the team's WC fixtures (group + any seeded knockouts)
 *   - latest international ELO rating (team_elo_international)
 *   - last 6 international results (matches table, league.country='World')
 *
 * Static-params lists all 48 WC nations — but we keep `dynamic = "force-dynamic"`
 * because standings + form update frequently.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  Calendar,
  Activity,
  Sparkles,
} from "lucide-react";

import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabasePublic } from "@/lib/supabase-public";
import { flagForTeam } from "@/lib/wc-flags";
import {
  getWorldCupFixtures,
  getWorldCupPredictions,
  getInternationalElos,
  getServerNowMs,
  getWorldCupPreviews,
  deriveGroups,
  buildWorldCup2026EventLd,
} from "@/lib/world-cup";
import type {
  WCFixture,
  WCGroup,
  WCPredictionSlot,
  WCTeam,
} from "@/lib/world-cup";
import {
  getUserWcPicks,
  modelPickFromTriple,
  type WCPick,
} from "@/lib/wc-vs-you";
import { getUserTier } from "@/lib/get-user-tier";
import { WCVsYouPicker } from "@/components/wc-vs-you-picker";
import {
  ProbBar,
  ProbNumbersRow,
  AiPickPill,
  favouriteClass,
} from "@/components/wc-prob-display";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oddsintel.app";

// ─── Slug helpers ────────────────────────────────────────────────────────────

/**
 * Slugify a team name for use in the URL.
 * "South Korea" → "south-korea", "Côte d'Ivoire" → "cote-d-ivoire".
 *
 * Kept inline (not in a shared lib) to avoid bloating world-cup.ts core logic.
 */
function slugifyTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    // strip combining diacritics
    .replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Static params (all 48 WC nations) ───────────────────────────────────────

export async function generateStaticParams(): Promise<Array<{ name: string }>> {
  const fixtures = await getWorldCupFixtures();
  const seen = new Set<string>();
  const out: Array<{ name: string }> = [];
  for (const f of fixtures) {
    for (const t of [f.home, f.away]) {
      const slug = slugifyTeam(t.name);
      if (slug && !seen.has(slug)) {
        seen.add(slug);
        out.push({ name: slug });
      }
    }
  }
  return out;
}

// ─── Data loaders ────────────────────────────────────────────────────────────

interface PageContext {
  team: WCTeam;
  group: WCGroup | null;
  fixtures: WCFixture[];
  predictions: Record<string, WCPredictionSlot>;
  previews: Awaited<ReturnType<typeof getWorldCupPreviews>>;
  elo: number | null;
  recentForm: RecentResult[];
  userPicks: Record<string, WCPick>;
  isAuthed: boolean;
}

interface RecentResult {
  matchId: string;
  date: string;
  isHome: boolean;
  result: "W" | "D" | "L";
  scoreFor: number;
  scoreAgainst: number;
  opponentName: string;
}

interface RecentMatchRow {
  id: string;
  date: string;
  status: string;
  score_home: number | null;
  score_away: number | null;
  home_team_id: string;
  away_team_id: string;
  home_team: { name: string } | { name: string }[] | null;
  away_team: { name: string } | { name: string }[] | null;
  league: { country: string | null } | { country: string | null }[] | null;
}

function flattenOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function rowToRecentResult(row: RecentMatchRow, teamId: string): RecentResult | null {
  if (row.score_home == null || row.score_away == null) return null;
  const isHome = row.home_team_id === teamId;
  const scoreFor = isHome ? row.score_home : row.score_away;
  const scoreAgainst = isHome ? row.score_away : row.score_home;
  const result: "W" | "D" | "L" =
    scoreFor > scoreAgainst ? "W" : scoreFor < scoreAgainst ? "L" : "D";
  const opponent = isHome ? flattenOne(row.away_team) : flattenOne(row.home_team);
  return {
    matchId: row.id,
    date: row.date,
    isHome,
    result,
    scoreFor,
    scoreAgainst,
    opponentName: opponent?.name ?? "—",
  };
}

async function fetchRecentForm(teamId: string): Promise<RecentResult[]> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("matches")
    .select(
      `id, date, status, score_home, score_away,
       home_team_id, away_team_id,
       home_team:home_team_id(name),
       away_team:away_team_id(name),
       league:league_id!inner(country)`,
    )
    .eq("status", "finished")
    .eq("league.country", "World")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("date", { ascending: false })
    .limit(12);

  if (error || !data) return [];

  const out: RecentResult[] = [];
  for (const row of data as RecentMatchRow[]) {
    const r = rowToRecentResult(row, teamId);
    if (r) out.push(r);
    if (out.length >= 6) break;
  }
  return out;
}

async function loadTeamContext(slug: string): Promise<PageContext | null> {
  const fixtures = await getWorldCupFixtures();
  if (fixtures.length === 0) return null;

  // Build a unique team list from fixtures, find by slug.
  const teamsBySlug = new Map<string, WCTeam>();
  for (const f of fixtures) {
    for (const t of [f.home, f.away]) {
      const s = slugifyTeam(t.name);
      if (!teamsBySlug.has(s)) teamsBySlug.set(s, t);
    }
  }
  const team = teamsBySlug.get(slug);
  if (!team) return null;

  const groups = deriveGroups(fixtures);
  const group = groups.find((g) => g.teams.some((t) => t.id === team.id)) ?? null;

  // All fixtures involving this team (group + knockouts when seeded).
  const teamFixtures = fixtures
    .filter((f) => f.home.id === team.id || f.away.id === team.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  const fixtureIds = teamFixtures.map((f) => f.id);
  const predictions = await getWorldCupPredictions(fixtureIds);
  const previews = await getWorldCupPreviews(fixtureIds);

  const elos = await getInternationalElos([team.id]);
  const elo = elos[team.id] ?? null;

  const recentForm = await fetchRecentForm(team.id);

  // Auth + picks (anonymous viewers get an empty map).
  const userPicks = await getUserWcPicks(fixtureIds);
  let isAuthed = false;
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthed = !!user;
    if (user) {
      // pre-warm tier so future tier-gated sections can layer in later
      // (we don't currently render Pro-only content on this page, but
      // calling the helper is cheap and keeps the auth path warm).
      await getUserTier(user.id, supabase);
    }
  } catch {
    isAuthed = false;
  }

  return {
    team,
    group,
    fixtures: teamFixtures,
    predictions,
    previews,
    elo,
    recentForm,
    userPicks,
    isAuthed,
  };
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const ctx = await loadTeamContext(name);
  if (!ctx) {
    return {
      title: "Team not found — FIFA World Cup 2026 | OddsIntel",
      description: "This team is not part of FIFA World Cup 2026.",
    };
  }
  const tn = ctx.team.name;
  const groupLabel = ctx.group ? `Group ${ctx.group.label}` : "Group TBD";
  const url = `${SITE}/world-cup/teams/${name}`;
  const title = `${tn} at FIFA World Cup 2026 — Schedule, Group, Predictions | OddsIntel`;
  const description = `${tn} (${groupLabel}) at FIFA World Cup 2026 — all fixtures, model rating, advancement probability, and recent form.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${tn} — FIFA World Cup 2026`,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${tn} at FIFA World Cup 2026`,
      description,
    },
  };
}

// ─── UI building blocks ──────────────────────────────────────────────────────

function TeamFlag({ name, size = 24 }: { name: string; size?: number }) {
  const flag = flagForTeam(name);
  if (flag) {
    return (
      <span
        aria-hidden
        className="shrink-0 leading-none"
        style={{ fontSize: size, width: size, display: "inline-block" }}
      >
        {flag}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-bold text-muted-foreground"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function TeamLogoOrFlag({
  name,
  logo,
  size,
}: {
  name: string;
  logo: string | null;
  size: number;
}) {
  const flag = flagForTeam(name);
  if (flag) {
    return (
      <span
        aria-hidden
        className="shrink-0 leading-none"
        style={{ fontSize: size, width: size, display: "inline-block" }}
      >
        {flag}
      </span>
    );
  }
  if (logo) {
    return (
      <span
        className="relative shrink-0 overflow-hidden rounded-full bg-white/[0.06]"
        style={{ width: size, height: size }}
      >
        <Image src={logo} alt="" fill sizes="24px" className="object-contain p-0.5" unoptimized />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-bold text-muted-foreground"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({
  team,
  group,
  elo,
}: {
  team: WCTeam;
  group: WCGroup | null;
  elo: number | null;
}) {
  return (
    <section
      data-hero
      className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-8"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[color:var(--color-tournament-gold)]/10 blur-3xl"
      />
      <Link
        href="/world-cup"
        className="relative inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground sm:text-xs"
      >
        <ChevronLeft className="size-3" />
        World Cup hub
      </Link>
      <div className="relative mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <TeamFlag name={team.name} size={56} />
          <div className="space-y-1">
            <h1 className="text-2xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
              {team.name}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-background/40 px-2 py-0.5">
                <Trophy className="size-3 text-[color:var(--color-tournament-gold)]" />
                {group ? `Group ${group.label}` : "Group TBD"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-background/40 px-2 py-0.5">
                FIFA rank: —
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
          <div className="rounded-lg border border-white/[0.08] bg-background/40 px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Model ELO
            </p>
            <p className="font-mono text-base font-bold text-foreground tabular-nums sm:text-lg">
              {elo != null ? Math.round(elo) : "—"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Group standings (mini-table, highlights current team) ────────────────────

function GroupContext({ group, teamId }: { group: WCGroup; teamId: string }) {
  return (
    <section
      data-group-context
      className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40"
    >
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
            Group {group.label}
          </span>
          <span className="text-[10px] text-muted-foreground sm:text-xs">
            {group.teams.length} teams · {group.fixtures.length} fixtures
          </span>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] sm:text-xs">
          <thead className="border-b border-white/[0.06] text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium sm:px-3 sm:py-2">Team</th>
              <th className="px-1.5 py-1.5 text-center font-medium sm:px-2 sm:py-2">P</th>
              <th className="hidden px-2 py-2 text-center font-medium sm:table-cell">W</th>
              <th className="hidden px-2 py-2 text-center font-medium sm:table-cell">D</th>
              <th className="hidden px-2 py-2 text-center font-medium sm:table-cell">L</th>
              <th className="hidden px-2 py-2 text-center font-medium md:table-cell">GD</th>
              <th className="px-1.5 py-1.5 text-center font-medium sm:px-2 sm:py-2">Pts</th>
            </tr>
          </thead>
          <tbody>
            {group.standings.map((s, i) => {
              const isThis = s.team.id === teamId;
              return (
                <tr
                  key={s.team.id}
                  className={`border-b border-white/[0.04] last:border-0 ${
                    isThis ? "bg-primary/[0.10]" : i < 2 ? "bg-[color:var(--color-tournament-green)]/[0.04]" : ""
                  }`}
                >
                  <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 text-center text-muted-foreground tabular-nums">
                        {i + 1}
                      </span>
                      <TeamLogoOrFlag name={s.team.name} logo={s.team.logo} size={16} />
                      {isThis ? (
                        <span className="truncate font-semibold text-foreground">{s.team.name}</span>
                      ) : (
                        <Link
                          href={`/world-cup/teams/${slugifyTeam(s.team.name)}`}
                          className="truncate text-foreground hover:underline"
                        >
                          {s.team.name}
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-1.5 py-1.5 text-center text-muted-foreground tabular-nums sm:px-2 sm:py-2">
                    {s.played}
                  </td>
                  <td className="hidden px-2 py-2 text-center text-muted-foreground tabular-nums sm:table-cell">
                    {s.wins}
                  </td>
                  <td className="hidden px-2 py-2 text-center text-muted-foreground tabular-nums sm:table-cell">
                    {s.draws}
                  </td>
                  <td className="hidden px-2 py-2 text-center text-muted-foreground tabular-nums sm:table-cell">
                    {s.losses}
                  </td>
                  <td className="hidden px-2 py-2 text-center text-muted-foreground tabular-nums md:table-cell">
                    {s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}
                  </td>
                  <td className="px-1.5 py-1.5 text-center font-semibold text-foreground tabular-nums sm:px-2 sm:py-2">
                    {s.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Fixtures list (re-uses prob bar + AI pill + picker) ──────────────────────

function FixtureScanRow({
  fixture,
  modelPick,
  hasScore,
  thisTeamId,
}: {
  fixture: WCFixture;
  modelPick: WCPick | null;
  hasScore: boolean;
  thisTeamId: string;
}) {
  const homeIsThis = fixture.home.id === thisTeamId;
  const awayIsThis = fixture.away.id === thisTeamId;
  return (
    <Link
      href={`/matches/${fixture.id}`}
      className="wc-row-hover group grid min-h-[44px] grid-cols-[56px_1fr_auto_1fr_auto] items-center gap-2 rounded-lg px-2.5 py-2 sm:gap-3 sm:px-3 sm:py-2.5"
    >
      <div className="text-center font-mono text-[10px] text-muted-foreground sm:text-[11px]">
        {hasScore ? (
          <span className="font-semibold text-foreground">
            {fixture.scoreHome}–{fixture.scoreAway}
          </span>
        ) : (
          <>
            <div>{formatDay(fixture.date)}</div>
            <div className="text-[9px]">{formatTime(fixture.date)}</div>
          </>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1.5 text-right">
        <span
          className={`truncate text-xs sm:text-sm ${favouriteClass(modelPick, "home")} ${
            homeIsThis ? "font-bold text-primary" : ""
          }`}
        >
          {fixture.home.name}
        </span>
        <TeamLogoOrFlag name={fixture.home.name} logo={fixture.home.logo} size={16} />
      </div>
      <span className="text-[9px] text-muted-foreground/60">v</span>
      <div className="flex min-w-0 items-center gap-1.5">
        <TeamLogoOrFlag name={fixture.away.name} logo={fixture.away.logo} size={16} />
        <span
          className={`truncate text-xs sm:text-sm ${favouriteClass(modelPick, "away")} ${
            awayIsThis ? "font-bold text-primary" : ""
          }`}
        >
          {fixture.away.name}
        </span>
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function FixtureEngagementStrip({
  fixture,
  prediction,
  modelPick,
  isLocked,
  userPick,
  isAuthed,
}: {
  fixture: WCFixture;
  prediction: WCPredictionSlot;
  modelPick: WCPick | null;
  isLocked: boolean;
  userPick: WCPick | null;
  isAuthed: boolean;
}) {
  return (
    <div className="border-t border-white/[0.04] px-2.5 py-1.5 sm:px-3">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <ProbBar
          className="flex-1"
          home={prediction.homeProb!}
          draw={prediction.drawProb!}
          away={prediction.awayProb!}
        />
        <WCVsYouPicker
          matchId={fixture.id}
          homeName={fixture.home.name}
          awayName={fixture.away.name}
          initialPick={userPick}
          isAuthed={isAuthed}
          isLocked={isLocked}
          modelPick={modelPick}
          variant="compact"
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <ProbNumbersRow
          home={prediction.homeProb!}
          draw={prediction.drawProb!}
          away={prediction.awayProb!}
        />
        {modelPick && (
          <AiPickPill pick={modelPick} homeName={fixture.home.name} awayName={fixture.away.name} />
        )}
      </div>
    </div>
  );
}

function hasAllProbs(p: WCPredictionSlot | undefined): p is WCPredictionSlot {
  return !!p && p.homeProb != null && p.drawProb != null && p.awayProb != null;
}

function FixtureRow({
  fixture,
  prediction,
  preview,
  nowMs,
  userPick,
  isAuthed,
  thisTeamId,
}: {
  fixture: WCFixture;
  prediction: WCPredictionSlot | undefined;
  preview: { previewText: string } | undefined;
  nowMs: number;
  userPick: WCPick | null;
  isAuthed: boolean;
  thisTeamId: string;
}) {
  const hasScore = fixture.status === "finished" && fixture.scoreHome != null;
  const isLocked = hasScore || new Date(fixture.date).getTime() <= nowMs;
  const probs = hasAllProbs(prediction) ? prediction : null;
  const modelPick = probs ? modelPickFromTriple(probs) : null;

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-card/40 hover:border-white/[0.12] hover:bg-card/60">
      <FixtureScanRow
        fixture={fixture}
        modelPick={modelPick}
        hasScore={hasScore}
        thisTeamId={thisTeamId}
      />
      {probs && (
        <FixtureEngagementStrip
          fixture={fixture}
          prediction={probs}
          modelPick={modelPick}
          isLocked={isLocked}
          userPick={userPick}
          isAuthed={isAuthed}
        />
      )}
      {preview && (
        <details className="group/preview border-t border-white/[0.04]">
          <summary className="flex min-h-[36px] cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-purple-400/80 hover:text-purple-300 sm:text-[11px]">
            <Sparkles className="size-3 shrink-0" />
            AI preview
          </summary>
          <div className="px-3 pb-3 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            {preview.previewText}
          </div>
        </details>
      )}
    </div>
  );
}

function FixturesSection({
  fixtures,
  predictions,
  previews,
  nowMs,
  userPicks,
  isAuthed,
  thisTeamId,
}: {
  fixtures: WCFixture[];
  predictions: Record<string, WCPredictionSlot>;
  previews: Awaited<ReturnType<typeof getWorldCupPreviews>>;
  nowMs: number;
  userPicks: Record<string, WCPick>;
  isAuthed: boolean;
  thisTeamId: string;
}) {
  return (
    <section
      data-fixtures
      className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40"
    >
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <Calendar className="size-3.5 text-[color:var(--color-tournament-gold)]" />
          <h2 className="text-sm font-semibold text-foreground">Fixtures</h2>
        </div>
        <span className="text-[10px] text-muted-foreground sm:text-xs">
          {fixtures.length} {fixtures.length === 1 ? "match" : "matches"}
        </span>
      </header>
      {fixtures.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No fixtures available yet.
        </div>
      ) : (
        <div className="space-y-1.5 px-2.5 py-2.5 sm:px-3 sm:py-3">
          {fixtures.map((f) => (
            <FixtureRow
              key={f.id}
              fixture={f}
              prediction={predictions[f.id]}
              preview={previews[f.id]}
              nowMs={nowMs}
              userPick={userPicks[f.id] ?? null}
              isAuthed={isAuthed}
              thisTeamId={thisTeamId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Recent form ──────────────────────────────────────────────────────────────

function FormPill({ r }: { r: RecentResult }) {
  const colour =
    r.result === "W"
      ? "bg-[color:var(--color-tournament-green)]/15 text-[color:var(--color-tournament-green)] ring-1 ring-[color:var(--color-tournament-green)]/30"
      : r.result === "L"
        ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/30"
        : "bg-white/[0.04] text-muted-foreground ring-1 ring-white/[0.08]";
  return (
    <li className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-card/40 px-2.5 py-1.5">
      <span
        className={`inline-flex size-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold ${colour}`}
      >
        {r.result}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-foreground sm:text-xs">
        {r.scoreFor}-{r.scoreAgainst}
      </span>
      <span className="truncate text-[10px] text-muted-foreground sm:text-xs">
        {r.isHome ? "vs" : "at"} {r.opponentName}
      </span>
    </li>
  );
}

function RecentFormSection({ results }: { results: RecentResult[] }) {
  return (
    <section
      data-form
      className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40"
    >
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 text-[color:var(--color-tournament-gold)]" />
          <h2 className="text-sm font-semibold text-foreground">Recent form</h2>
        </div>
        <span className="text-[10px] text-muted-foreground sm:text-xs">
          last {results.length} international{results.length === 1 ? "" : "s"}
        </span>
      </header>
      {results.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No recent international results.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 p-3 sm:grid-cols-2 sm:p-4">
          {results.map((r) => (
            <FormPill key={r.matchId} r={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ── AI summary placeholder (Wave 3) ──────────────────────────────────────────

function AISummaryPlaceholder({ teamName }: { teamName: string }) {
  return (
    <section
      data-ai-summary
      className="rounded-xl border border-dashed border-white/[0.08] bg-card/30 p-4 text-center sm:p-5"
    >
      <Sparkles className="mx-auto size-5 text-purple-400/50" />
      <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
        AI summary for {teamName} arrives before the tournament — strengths, weaknesses, key players.
      </p>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const ctx = await loadTeamContext(name);
  if (!ctx) {
    notFound();
  }
  const nowMs = getServerNowMs();

  // JSON-LD: SportsTeam schema. Helps Google interpret this as a team page
  // (rather than generic content) and surfaces the team name/sport/group in
  // knowledge-panel entity matching.
  const teamUrl = `${SITE}/world-cup/teams/${name}`;
  const teamJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: ctx.team.name,
    sport: "Soccer",
    url: teamUrl,
    // GSC flagged "Missing startDate / location" on this nested SportsEvent —
    // Google validates embedded events the same as top-level ones. Shared
    // helper keeps every WC page in sync.
    memberOf: buildWorldCup2026EventLd(SITE),
  };
  if (ctx.team.logo) {
    teamJsonLd.logo = ctx.team.logo;
  }
  if (ctx.group) {
    teamJsonLd.subOrganization = {
      "@type": "SportsOrganization",
      name: `FIFA World Cup 2026 — Group ${ctx.group.label}`,
    };
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <script
        type="application/ld+json"
        // SAFETY: jsonLd is built from static + DB-string fields only; serialize
        // with replace to neutralise </script> escape attempts.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(teamJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Hero team={ctx.team} group={ctx.group} elo={ctx.elo} />

      {ctx.group && <GroupContext group={ctx.group} teamId={ctx.team.id} />}

      <FixturesSection
        fixtures={ctx.fixtures}
        predictions={ctx.predictions}
        previews={ctx.previews}
        nowMs={nowMs}
        userPicks={ctx.userPicks}
        isAuthed={ctx.isAuthed}
        thisTeamId={ctx.team.id}
      />

      <RecentFormSection results={ctx.recentForm} />

      <AISummaryPlaceholder teamName={ctx.team.name} />
    </div>
  );
}
