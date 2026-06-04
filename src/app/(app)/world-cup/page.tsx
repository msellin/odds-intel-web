export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import {
  Trophy,
  MapPin,
  Calendar,
  Lock,
  Flag,
  Users,
  Activity,
  Target,
  LayoutGrid,
  Home,
  Globe,
} from "lucide-react";

import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import {
  getWorldCupFixtures,
  getWorldCupPredictions,
  getInternationalElos,
  getServerNowMs,
  computeAdvancement,
  pickFeaturedFixture,
  deriveGroups,
  getWorldCupPreviews,
  WC_FIRST_KICKOFF_ISO,
} from "@/lib/world-cup";
import type {
  WCFixture,
  WCPredictionSlot,
  GroupAdvancementProb,
  WCGroup,
  WCMatchPreview,
} from "@/lib/world-cup";
import { getUserWcPicks, buildScorecard } from "@/lib/wc-vs-you";
import type { WCPick, WCScorecard as WCScorecardType } from "@/lib/wc-vs-you";

import { WCCountdown } from "@/components/wc-countdown";
import { WCFeaturedBanner } from "@/components/wc-featured-banner";
import { WCGroupTabs } from "@/components/wc-group-tabs";
import { WCGroupCard } from "@/components/wc-group-card";
import { WCScorecard } from "@/components/wc-scorecard";
import { WCTabStrip, type WCTab } from "@/components/wc-tab-strip";
import { WCSchedule } from "@/components/wc-schedule";
import { WCActivityTiles } from "@/components/wc-activity-tiles";
import { CLVTrustBanner } from "@/components/clv-trust-banner";
import { loadWcActivityStats } from "@/lib/wc-bracket";

// ── SEO ──────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "FIFA World Cup 2026 — Schedule, Groups & AI Predictions | OddsIntel",
  description:
    "FIFA World Cup 2026 in USA, Canada and Mexico — June 11 to July 19. All 12 groups, every group-stage fixture, advancement %, bracket challenge, and AI predictions from OddsIntel.",
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
    description: "All 12 groups, every fixture, AI predictions, bracket challenge.",
  },
};

// ── Tab registry ─────────────────────────────────────────────────────────────
// WC-TAB-RESTRUCTURE (2026-06-02): clearer mental model than the original
// six tabs. Each tab now has a focused purpose:
//   Overview     — at-a-glance: hero + countdown + featured next match
//   Schedule     — chronological fixtures (date-grouped)
//   Groups       — group standings + CTA → group-predictor game
//   Knockouts    — knockout-stage info + CTA → bracket-challenge game
//   Leaderboard  — inline top players + AI ghosts; full list link
//   Top Scorers  — placeholder (no player-goal data yet)
//
// Bracket Challenge tab → repurposed as Leaderboard (showing scores is
// more useful than another CTA — users follow the Knockouts-tab CTA to
// /world-cup/bracket where they actually make picks).
const TABS: WCTab[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "groups", label: "Groups", icon: LayoutGrid },
  { id: "knockouts", label: "Bracket", icon: Trophy },
  { id: "teams", label: "Teams", icon: Globe, href: "/world-cup/teams" },
  { id: "leaderboard", label: "Leaderboard", icon: Target },
  { id: "scorers", label: "Top Scorers", icon: Activity },
];

function resolveTab(raw: string | undefined): string {
  if (!raw) return "overview";
  return TABS.some((t) => t.id === raw) ? raw : "overview";
}

// ── Knockout placeholder (kept inline — used in the Knockouts tab) ───────────
// WC-KO-PLACEHOLDER-V2 (2026-06-02): the previous version rendered 31 dashed
// "TBD" cards in a justify-around horizontal tree. The Final column had 1
// card with ~750px of dead space above and below it (the column inherited
// R32's 16-card height). Pre-tournament those identical TBDs carry no info.
//
// New design: a compact 5-row schedule (one row per round) showing dates +
// match count, plus a tiny mini-bracket SVG on the right that visually
// echoes the tree without faking 31 empty cards. Dense, mobile-friendly,
// and the user actually learns *when* each round runs.
function BracketPlaceholder({ isPro }: { isPro: boolean }) {
  const rounds: Array<{
    label: string;
    matches: number;
    window: string;
  }> = [
    { label: "Round of 32", matches: 16, window: "Jun 28 – Jul 3" },
    { label: "Round of 16", matches: 8, window: "Jul 4 – Jul 7" },
    { label: "Quarter-finals", matches: 4, window: "Jul 9 – Jul 11" },
    { label: "Semi-finals", matches: 2, window: "Jul 14 – Jul 15" },
    { label: "Final", matches: 1, window: "Jul 19" },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-[color:var(--color-tournament-gold)]" />
          <h2 className="text-sm font-semibold text-foreground">Knockout schedule</h2>
        </div>
        <span className="text-[10px] text-muted-foreground sm:text-xs">
          fixtures seed after group stage
        </span>
      </header>

      <div className="grid grid-cols-1 gap-0 sm:grid-cols-[1fr_auto]">
        <ol className="divide-y divide-white/[0.04]">
          {rounds.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  aria-hidden
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-tournament-gold)]/15 text-[10px] font-bold text-[color:var(--color-tournament-gold)]"
                >
                  {r.matches}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">
                    {r.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground sm:text-[11px]">
                    {r.matches} {r.matches === 1 ? "match" : "matches"} · {r.window}
                  </p>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                TBD
              </span>
            </li>
          ))}
        </ol>

        {/* Mini-bracket SVG — desktop only. Keeps the tree visual identity
            without the empty-card stacks. */}
        <div className="hidden border-l border-white/[0.06] px-4 py-3 sm:flex sm:items-center">
          <svg
            viewBox="0 0 120 100"
            className="h-24 w-32 text-muted-foreground/30"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            aria-hidden
          >
            {/* R32 hint — 8 short lines on far left */}
            {[10, 22, 34, 46, 58, 70, 82, 94].map((y) => (
              <line key={`l-${y}`} x1="0" y1={y} x2="14" y2={y} />
            ))}
            {/* R16 connectors */}
            {[
              [10, 22],
              [34, 46],
              [58, 70],
              [82, 94],
            ].map(([y1, y2]) => (
              <g key={`g-${y1}`}>
                <line x1="14" y1={y1} x2="22" y2={y1} />
                <line x1="14" y1={y2} x2="22" y2={y2} />
                <line x1="22" y1={y1} x2="22" y2={y2} />
                <line x1="22" y1={(y1 + y2) / 2} x2="40" y2={(y1 + y2) / 2} />
              </g>
            ))}
            {/* QF connectors */}
            {[
              [16, 40],
              [64, 88],
            ].map(([y1, y2]) => (
              <g key={`qf-${y1}`}>
                <line x1="40" y1={y2} x2="40" y2={y1} />
                <line x1="40" y1={(y1 + y2) / 2} x2="60" y2={(y1 + y2) / 2} />
              </g>
            ))}
            {/* SF connectors */}
            <line x1="60" y1="28" x2="60" y2="76" />
            <line x1="60" y1="52" x2="90" y2="52" />
            {/* Final / trophy node */}
            <circle
              cx="100"
              cy="52"
              r="7"
              className="text-[color:var(--color-tournament-gold)]/60"
              stroke="currentColor"
              fill="none"
            />
          </svg>
        </div>
      </div>

      {!isPro && (
        <footer className="flex items-center gap-2 border-t border-white/[0.06] bg-white/[0.02] px-4 py-2">
          <Lock className="size-3 text-blue-400" />
          <span className="text-[11px] text-muted-foreground">
            Knockout-stage AI predictions unlock on{" "}
            <Link href="/welcome" className="text-blue-400 underline-offset-2 hover:underline">
              Pro
            </Link>{" "}
            once the bracket is set.
          </span>
        </footer>
      )}
    </section>
  );
}

async function readAuthAndTier(): Promise<{
  isAuthed: boolean;
  isPro: boolean;
  userId: string | null;
}> {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { isAuthed: false, isPro: false, userId: null };
    const result = await getUserTier(user.id, supabase);
    return { isAuthed: true, isPro: result.isPro, userId: user.id };
  } catch {
    return { isAuthed: false, isPro: false, userId: null };
  }
}

interface PageData {
  fixtures: WCFixture[];
  groups: WCGroup[];
  predictions: Record<string, WCPredictionSlot>;
  advancement: Record<string, GroupAdvancementProb>;
  userPicks: Record<string, WCPick>;
  scorecard: WCScorecardType;
  previews: Record<string, WCMatchPreview>;
}

async function loadPageData(): Promise<PageData> {
  const fixtures = await getWorldCupFixtures();
  const groups = deriveGroups(fixtures);

  const predictions = await getWorldCupPredictions(fixtures.map((f) => f.id));
  const allTeamIds = Array.from(new Set(fixtures.flatMap((f) => [f.home.id, f.away.id])));
  const elos = await getInternationalElos(allTeamIds);

  const haveAnyProb = Object.keys(predictions).length > 0 || Object.keys(elos).length > 0;
  const advancement = haveAnyProb ? computeAdvancement(groups, predictions, elos, 5_000) : {};

  const userPicks = await getUserWcPicks(fixtures.map((f) => f.id));
  const scorecard = buildScorecard(fixtures, predictions, userPicks);

  // WC-AI-PREVIEW: Gemini-generated previews for fixtures in the next 7d.
  // Stored in `match_previews`; lookup is O(1) by match_id at render time.
  const previews = await getWorldCupPreviews(fixtures.map((f) => f.id));

  return { fixtures, groups, predictions, advancement, userPicks, scorecard, previews };
}

// ── Tab panels ───────────────────────────────────────────────────────────────

function OverviewPanel({
  scorecard,
  isAuthed,
  nextFixture,
  totalFixtures,
}: {
  scorecard: WCScorecardType;
  isAuthed: boolean;
  nextFixture: WCFixture | null;
  totalFixtures: number;
}) {
  return (
    <div className="space-y-3 sm:space-y-6">
      {/* WC-MOBILE-COMPRESS (2026-06-02): hero was eating ~75% of mobile
          viewport before any content. Smaller h1, tighter padding, drop
          the redundant location/leaderboard pills on mobile (countdown
          + 1 primary CTA is what people need above the fold). The richer
          layout returns at sm:+. */}
      <section className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-3 sm:rounded-2xl sm:p-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[color:var(--color-tournament-gold)]/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Trophy className="size-3.5 text-[color:var(--color-tournament-gold)] sm:size-4" />
              <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
                Tournament hub
              </span>
            </div>
            <h1 className="text-2xl font-black leading-tight tracking-tight text-foreground sm:text-5xl">
              FIFA World Cup 2026
            </h1>
            <p className="max-w-md text-xs text-muted-foreground sm:text-base">
              June 11 — July 19 · 48 teams · 12 groups · USA · Canada · Mexico
            </p>
            {/* Location chips: desktop only — mobile keeps the hero tight. */}
            <div className="hidden flex-wrap items-center gap-2 pt-1 text-[10px] text-muted-foreground sm:flex sm:text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-background/40 px-2.5 py-1">
                <Calendar className="size-3" />
                Opens with Mexico v South Africa
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-background/40 px-2.5 py-1">
                <MapPin className="size-3" />
                Estadio Azteca, Mexico City
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 sm:pt-2">
              <Link
                href="/world-cup/bracket"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[color:var(--color-tournament-gold)] px-3 py-1.5 text-xs font-bold text-background hover:brightness-110 sm:min-h-[44px] sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Trophy className="size-3.5" />
                Play bracket challenge
              </Link>
              {/* Leaderboard button: desktop only — on mobile users tap
                  the Leaderboard tab instead. */}
              <Link
                href="/world-cup/bracket/leaderboard"
                className="hidden min-h-[44px] items-center gap-1.5 rounded-lg border border-white/[0.08] bg-card/40 px-4 py-2.5 text-sm font-semibold text-foreground hover:border-white/[0.16] sm:inline-flex"
              >
                <Users className="size-3.5" />
                Leaderboard
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-2">
            <WCCountdown targetIso={WC_FIRST_KICKOFF_ISO} variant="card" liveLabel="Tournament live" />
            <span className="hidden text-[10px] text-muted-foreground sm:inline sm:text-[11px]">
              {new Date(WC_FIRST_KICKOFF_ISO).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </section>

      {/* CLV trust banner — compact world-cup variant. Sits between the
          tournament hero (above) and the vs-you scorecard (below). */}
      <CLVTrustBanner variant="world-cup" cohort="all" />

      {/* Scorecard (vs-You) */}
      <WCScorecard card={scorecard} isAuthed={isAuthed} />

      {/* What's next strip */}
      <section className="rounded-xl border border-white/[0.08] bg-card/40 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="size-3.5 text-[color:var(--color-tournament-gold)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
                What&apos;s next
              </span>
            </div>
            <p className="text-sm text-foreground sm:text-base">
              {nextFixture
                ? `${nextFixture.home.name} v ${nextFixture.away.name} — ${new Date(
                    nextFixture.date
                  ).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}`
                : "Group draw not loaded yet — fixtures arrive daily."}
            </p>
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              {totalFixtures > 0
                ? `${totalFixtures} fixtures across the tournament — see the Schedule tab.`
                : "Schedule populates as fixtures land."}
            </p>
          </div>
          <Link
            href="/world-cup?tab=schedule"
            scroll={false}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg border border-white/[0.08] bg-background/40 px-3 py-2 text-xs font-semibold text-foreground hover:border-white/[0.16]"
          >
            View full schedule
          </Link>
        </div>
      </section>
    </div>
  );
}

function GroupsPanel({
  groups,
  predictions,
  advancement,
  nowMs,
  previews,
  userPicks,
  isAuthed,
}: {
  groups: WCGroup[];
  predictions: Record<string, WCPredictionSlot>;
  advancement: Record<string, GroupAdvancementProb>;
  nowMs: number;
  previews: Record<string, WCMatchPreview>;
  userPicks: Record<string, WCPick>;
  isAuthed: boolean;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-card/40 p-6 text-center text-sm text-muted-foreground">
        Group draw not loaded yet — fixtures arrive daily.
      </div>
    );
  }
  return (
    <section className="space-y-3">
      <header className="flex items-end justify-between border-b border-white/[0.06] pb-2">
        <div>
          <h2 className="text-base font-bold text-foreground sm:text-lg">Group stage</h2>
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            12 groups · 4 teams each · top 2 + best 8 third-place advance to the Round of 32.
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground sm:text-xs">{groups.length} groups</span>
      </header>

      {/* WC-TAB-CLEANUP (2026-06-02): surface the group-standings predictor
          right here on the Groups tab. Previously only reachable via the
          Bracket page CTA — users browsing groups didn't know it existed. */}
      <Link
        href="/world-cup/groups-predictor"
        className="block rounded-lg border border-[color:var(--color-tournament-gold)]/30 bg-gradient-to-r from-[color:var(--color-tournament-gold)]/10 via-[color:var(--color-tournament-gold)]/5 to-transparent px-3 py-2.5 transition-colors hover:from-[color:var(--color-tournament-gold)]/20 hover:to-[color:var(--color-tournament-gold)]/5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground sm:text-sm">
              Predict the group standings · 48 picks · +192 pt
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
              Pick 1st, 2nd, 3rd, 4th in every group before kick-off. Counts toward your bracket-challenge total.
            </p>
          </div>
          <span className="shrink-0 text-xs text-[color:var(--color-tournament-gold)]">→</span>
        </div>
      </Link>

      <WCGroupTabs
        labels={groups.map((g) => g.label)}
        panels={groups.map((g) => (
          <WCGroupCard
            key={g.label}
            group={g}
            predictions={predictions}
            advancement={advancement}
            nowMs={nowMs}
            previews={previews}
            userPicks={userPicks}
            isAuthed={isAuthed}
          />
        ))}
      />
    </section>
  );
}

function KnockoutsPanel({ isAuthed, isPro }: { isAuthed: boolean; isPro: boolean }) {
  return (
    <section className="space-y-3">
      <header className="flex items-end justify-between border-b border-white/[0.06] pb-2">
        <div>
          <h2 className="text-base font-bold text-foreground sm:text-lg">Knockout bracket</h2>
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            Round of 32 → Final · seeded after the group stage.
          </p>
        </div>
      </header>

      {/* WC-TAB-RESTRUCTURE (2026-06-02): primary CTA — open the bracket
          picker. Same prominence + copy as the old Bracket Challenge tab
          since this is now where users go to play. */}
      <Link
        href="/world-cup/bracket"
        className="block rounded-xl border border-[color:var(--color-tournament-gold)]/30 bg-gradient-to-r from-[color:var(--color-tournament-gold)]/15 via-[color:var(--color-tournament-gold)]/8 to-transparent p-4 transition-colors hover:from-[color:var(--color-tournament-gold)]/25 sm:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-[color:var(--color-tournament-gold)] shrink-0" />
              <p className="text-sm font-bold text-foreground sm:text-base">
                {isAuthed ? "Open my bracket" : "Pick the bracket"}
              </p>
              <span className="hidden sm:inline rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                Top 3 win Elite
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              R32 → Final. Each round opens after the previous resolves. Compete vs OddsIntel AI and the community.
            </p>
          </div>
          <span className="shrink-0 text-base text-[color:var(--color-tournament-gold)]">→</span>
        </div>
      </Link>

      <BracketPlaceholder isPro={isPro} />
    </section>
  );
}

// WC-TAB-RESTRUCTURE (2026-06-02): inline leaderboard panel that lives
// on the Leaderboard tab. Top 20 entries (humans + AI ghosts) with a
// link to the full /world-cup/bracket/leaderboard for the rest of the
// 100-row table + filtering. Pre-tournament every score is 0, so the
// order is essentially alphabetical-by-ai_label until matches start
// resolving — that's fine; the page is here so users can see WHO'S
// playing, not just rankings.
//
// LEADERBOARD-USER-PIN (2026-06-02): the loader appends the signed-in
// user when they're outside the top-N. We render that row at the bottom
// of the table with a divider, so users always see "I'm #47" with one
// glance regardless of where they actually sit. When they're inside the
// top 20 we just highlight their natural row.
async function LeaderboardPanel({ currentUserId }: { currentUserId: string | null }) {
  const { loadBracketLeaderboard } = await import("@/lib/wc-bracket");
  const entries = await loadBracketLeaderboard({ limit: 20, currentUserId });

  const meIndex = entries.findIndex((e) => e.isCurrentUser);
  const meInTop = meIndex >= 0 && meIndex < 20;
  const topEntries = entries.slice(0, 20);
  // Loader appends the user row at position 20 when they're outside top-N.
  const pinnedMe = !meInTop && meIndex >= 20 ? entries[meIndex] : null;

  return (
    <section className="space-y-3">
      <header className="flex items-end justify-between border-b border-white/[0.06] pb-2">
        <div>
          <h2 className="text-base font-bold text-foreground sm:text-lg">Leaderboard</h2>
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            Group standings + knockout bracket. Top 3 humans win 1 month Elite.
          </p>
        </div>
        <Link
          href="/world-cup/bracket/leaderboard"
          className="text-xs text-primary hover:underline"
        >
          Full ranking →
        </Link>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-6 text-center text-sm text-muted-foreground">
          No brackets yet. <Link href="/world-cup/bracket" className="font-semibold text-primary hover:underline">Be the first to pick yours</Link>.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
          <table className="w-full text-xs sm:text-sm">
            <thead className="border-b border-white/[0.06] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium w-10">#</th>
                <th className="px-3 py-2 text-left font-medium">Player</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {topEntries.map((e, i) => (
                <LeaderboardInlineRow key={e.key} e={e} rank={i + 1} />
              ))}
              {pinnedMe && (
                <>
                  <tr aria-hidden>
                    <td colSpan={3} className="border-y border-dashed border-white/[0.08] px-3 py-1.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      Your position
                    </td>
                  </tr>
                  <LeaderboardInlineRow e={pinnedMe} rank={pinnedMe.currentRank ?? meIndex + 1} />
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LeaderboardInlineRow({
  e,
  rank,
}: {
  e: Awaited<ReturnType<typeof import("@/lib/wc-bracket").loadBracketLeaderboard>>[number];
  rank: number;
}) {
  const isAnon = e.isAi && /^Player \d+$/.test(e.aiLabel ?? "");
  const name = e.isAi ? e.aiLabel : (e.displayName ?? "Anonymous");
  const rowBg = e.isCurrentUser
    ? "bg-primary/[0.08]"
    : e.isAi
    ? "bg-white/[0.01]"
    : "";
  return (
    <tr className={`border-b border-white/[0.04] last:border-0 ${rowBg}`}>
      <td className="px-3 py-2 text-left text-muted-foreground tabular-nums">{rank}</td>
      <td className="min-w-0 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {e.isAi && !isAnon && (
            <span className="shrink-0 rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-white/[0.06]">
              AI
            </span>
          )}
          {e.isCurrentUser && (
            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
              you
            </span>
          )}
          <span className={`truncate ${isAnon ? "text-muted-foreground/60" : (e.isAi ? "text-muted-foreground" : "text-foreground")}`}>{name}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-right font-mono font-semibold text-foreground tabular-nums">{e.totalScore}</td>
    </tr>
  );
}

function BracketChallengePanel({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-tournament-gold)]/20 bg-gradient-to-br from-card via-card to-[color:var(--color-tournament-gold)]/5 p-5 sm:p-7">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trophy className="size-4 text-[color:var(--color-tournament-gold)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
            Bracket Challenge
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Pick the whole bracket.
        </h2>
        <p className="mt-2 max-w-md text-xs text-muted-foreground sm:text-sm">
          R32 → Final. Compete against the OddsIntel model and the community. Locks at kick-off
          of the first match (Jun 11, 19:00 UTC).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/world-cup/bracket"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[color:var(--color-tournament-gold)] px-4 py-2 text-sm font-bold text-background hover:brightness-110"
          >
            <Trophy className="size-4" />
            {isAuthed ? "Open my bracket" : "Start picking"}
          </Link>
          <Link
            href="/world-cup/bracket/leaderboard"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/[0.08] bg-card/40 px-4 py-2 text-sm font-semibold text-foreground hover:border-white/[0.16]"
          >
            <Users className="size-4" />
            Leaderboard
          </Link>
        </div>
        {!isAuthed && (
          <p className="mt-3 text-[11px] text-muted-foreground sm:text-xs">
            Free account required to save your picks. You can preview the predictor without
            signing in.
          </p>
        )}
      </div>
    </section>
  );
}

function ScorersPanel() {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-card/40 p-8 text-center">
      <Activity className="mx-auto size-8 text-muted-foreground/40" />
      <h2 className="mt-3 text-lg font-bold text-foreground sm:text-xl">Top scorers</h2>
      <p className="mx-auto mt-2 max-w-sm text-xs text-muted-foreground sm:text-sm">
        The tournament hasn&apos;t started yet — top scorers will appear here once matches go live.
      </p>
      <p className="mx-auto mt-2 max-w-sm text-[11px] text-muted-foreground/70">
        First kick-off: Jun 11, 19:00 UTC · Mexico v South Africa.
      </p>
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function WorldCupPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab = resolveTab(rawTab);

  const { isAuthed, isPro, userId } = await readAuthAndTier();
  const [
    { fixtures, groups, predictions, advancement, scorecard, previews, userPicks },
    activityStats,
  ] = await Promise.all([loadPageData(), loadWcActivityStats()]);

  const nowMs = getServerNowMs();
  const featured = pickFeaturedFixture(fixtures, nowMs);
  const featuredPrediction = featured ? predictions[featured.id] : undefined;

  // Next upcoming fixture (used in Overview "what's next" strip).
  const nextFixture =
    fixtures.find((f) => new Date(f.date).getTime() >= nowMs) ?? fixtures[0] ?? null;

  // WC-SCHEDULE-VITALITY-V2: fixture→group letter lookup so the Schedule tab
  // can show the same A/B/C chip the Groups tab uses. Knockouts aren't in any
  // group, so they're absent from the map (Schedule renders a spacer).
  const groupByFixtureId: Record<string, string> = {};
  for (const g of groups) {
    for (const f of g.fixtures) {
      groupByFixtureId[f.id] = g.label;
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <FeaturedBannerSlot featured={featured} prediction={featuredPrediction} />

      {/* Activity tiles — humans + AI ghost counts on the leaderboard. */}
      <WCActivityTiles stats={activityStats} />

      {/* Tab strip — sticky at top of viewport */}
      <WCTabStrip tabs={TABS} active={tab} />

      {/* Tab panels */}
      <ActiveTabPanel
        tab={tab}
        groups={groups}
        fixtures={fixtures}
        predictions={predictions}
        advancement={advancement}
        scorecard={scorecard}
        isAuthed={isAuthed}
        isPro={isPro}
        userId={userId}
        nowMs={nowMs}
        nextFixture={nextFixture}
        previews={previews}
        userPicks={userPicks}
        groupByFixtureId={groupByFixtureId}
      />

      {/* Predictions notice — kept site-wide, last (small, low-impact). */}
      {Object.keys(predictions).length === 0 &&
        (tab === "groups" || tab === "schedule" || tab === "overview") && (
          <section className="rounded-xl border border-white/[0.06] bg-card/40 p-4 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <Flag className="size-3.5 mt-0.5 text-[color:var(--color-tournament-gold)] shrink-0" />
              <p>
                National-team AI predictions are training on six WCs of historical data and arrive
                before kick-off. Advancement % is computed from international ELO ratings until full
                predictions land.
              </p>
            </div>
          </section>
        )}
    </div>
  );
}

function FeaturedBannerSlot({
  featured,
  prediction,
}: {
  featured: WCFixture | null;
  prediction: WCPredictionSlot | undefined;
}) {
  if (!featured) return null;
  const triple =
    prediction?.homeProb != null && prediction.awayProb != null
      ? {
          home: prediction.homeProb,
          draw: prediction.drawProb ?? 0,
          away: prediction.awayProb,
        }
      : null;
  return (
    <WCFeaturedBanner
      matchId={featured.id}
      homeName={featured.home.name}
      homeLogo={featured.home.logo}
      awayName={featured.away.name}
      awayLogo={featured.away.logo}
      kickoffIso={featured.date}
      venueName={featured.venueName}
      predictionTriple={triple}
    />
  );
}

// Extracted to keep the page component below the complexity lint threshold.
function ActiveTabPanel({
  tab,
  groups,
  fixtures,
  predictions,
  advancement,
  scorecard,
  isAuthed,
  isPro,
  userId,
  nowMs,
  nextFixture,
  previews,
  userPicks,
  groupByFixtureId,
}: {
  tab: string;
  groups: WCGroup[];
  fixtures: WCFixture[];
  predictions: Record<string, WCPredictionSlot>;
  advancement: Record<string, GroupAdvancementProb>;
  scorecard: WCScorecardType;
  isAuthed: boolean;
  isPro: boolean;
  userId: string | null;
  nowMs: number;
  nextFixture: WCFixture | null;
  previews: Record<string, WCMatchPreview>;
  userPicks: Record<string, WCPick>;
  groupByFixtureId: Record<string, string>;
}) {
  switch (tab) {
    case "schedule":
      return (
        <WCSchedule
          fixtures={fixtures}
          predictions={predictions}
          nowMs={nowMs}
          previews={previews}
          groupByFixtureId={groupByFixtureId}
          userPicks={userPicks}
          isAuthed={isAuthed}
        />
      );
    case "groups":
      return (
        <GroupsPanel
          groups={groups}
          predictions={predictions}
          advancement={advancement}
          nowMs={nowMs}
          previews={previews}
          userPicks={userPicks}
          isAuthed={isAuthed}
        />
      );
    case "knockouts":
      return <KnockoutsPanel isAuthed={isAuthed} isPro={isPro} />;
    case "leaderboard":
      return <LeaderboardPanel currentUserId={userId} />;
    // Legacy /world-cup?tab=bracket URLs still route to the bracket page.
    case "bracket":
      return <BracketChallengePanel isAuthed={isAuthed} />;
    case "scorers":
      return <ScorersPanel />;
    case "overview":
    default:
      return (
        <OverviewPanel
          scorecard={scorecard}
          isAuthed={isAuthed}
          nextFixture={nextFixture}
          totalFixtures={fixtures.length}
        />
      );
  }
}
