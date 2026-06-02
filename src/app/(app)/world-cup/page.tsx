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
  WC_FIRST_KICKOFF_ISO,
} from "@/lib/world-cup";
import type {
  WCFixture,
  WCPredictionSlot,
  GroupAdvancementProb,
  WCGroup,
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
import { CLVTrustBanner } from "@/components/clv-trust-banner";

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
const TABS: WCTab[] = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "groups", label: "Groups", icon: LayoutGrid },
  { id: "knockouts", label: "Knockouts", icon: Trophy },
  { id: "bracket", label: "Bracket Challenge", icon: Target },
  { id: "scorers", label: "Top Scorers", icon: Activity },
];

function resolveTab(raw: string | undefined): string {
  if (!raw) return "overview";
  return TABS.some((t) => t.id === raw) ? raw : "overview";
}

// ── Knockout placeholder (kept inline — used in the Knockouts tab) ───────────
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
          <Trophy className="size-4 text-[color:var(--color-tournament-gold)]" />
          <h2 className="text-sm font-semibold text-foreground">Knockout bracket</h2>
        </div>
        <span className="text-xs text-muted-foreground">populates after the group stage</span>
      </header>

      <div className="overflow-x-auto p-4">
        <div className="flex min-w-max gap-3">
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

async function readAuthAndTier(): Promise<{ isAuthed: boolean; isPro: boolean }> {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { isAuthed: false, isPro: false };
    const result = await getUserTier(user.id, supabase);
    return { isAuthed: true, isPro: result.isPro };
  } catch {
    return { isAuthed: false, isPro: false };
  }
}

interface PageData {
  fixtures: WCFixture[];
  groups: WCGroup[];
  predictions: Record<string, WCPredictionSlot>;
  advancement: Record<string, GroupAdvancementProb>;
  userPicks: Record<string, WCPick>;
  scorecard: WCScorecardType;
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

  return { fixtures, groups, predictions, advancement, userPicks, scorecard };
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
    <div className="space-y-5 sm:space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-5 sm:p-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[color:var(--color-tournament-gold)]/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Trophy className="size-4 text-[color:var(--color-tournament-gold)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
                Tournament hub
              </span>
            </div>
            <h1 className="text-3xl font-black leading-tight tracking-tight text-foreground sm:text-5xl">
              FIFA World Cup 2026
            </h1>
            <p className="max-w-md text-sm text-muted-foreground sm:text-base">
              June 11 — July 19, 2026 · 48 teams · 12 groups · USA · Canada · Mexico
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-muted-foreground sm:text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-background/40 px-2.5 py-1">
                <Calendar className="size-3" />
                Opens with Mexico v South Africa
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-background/40 px-2.5 py-1">
                <MapPin className="size-3" />
                Estadio Azteca, Mexico City
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href="/world-cup/bracket"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[color:var(--color-tournament-gold)] px-3 py-2 text-xs font-bold text-background hover:brightness-110 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Trophy className="size-3.5" />
                Play bracket challenge
              </Link>
              <Link
                href="/world-cup/bracket/leaderboard"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/[0.08] bg-card/40 px-3 py-2 text-xs font-semibold text-foreground hover:border-white/[0.16] sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Users className="size-3.5" />
                Leaderboard
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <WCCountdown targetIso={WC_FIRST_KICKOFF_ISO} variant="card" liveLabel="Tournament live" />
            <span className="text-[10px] text-muted-foreground sm:text-[11px]">
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
}: {
  groups: WCGroup[];
  predictions: Record<string, WCPredictionSlot>;
  advancement: Record<string, GroupAdvancementProb>;
  nowMs: number;
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

      <WCGroupTabs
        labels={groups.map((g) => g.label)}
        panels={groups.map((g) => (
          <WCGroupCard
            key={g.label}
            group={g}
            predictions={predictions}
            advancement={advancement}
            nowMs={nowMs}
          />
        ))}
      />
    </section>
  );
}

function KnockoutsPanel({ isPro }: { isPro: boolean }) {
  return (
    <section className="space-y-3">
      <header className="flex items-end justify-between border-b border-white/[0.06] pb-2">
        <div>
          <h2 className="text-base font-bold text-foreground sm:text-lg">Knockout bracket</h2>
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            Round of 32 → Final · seeded after the group stage.{" "}
            <Link href="/world-cup/bracket" className="text-primary hover:underline">
              Pick yours →
            </Link>
          </p>
        </div>
      </header>

      <BracketPlaceholder isPro={isPro} />
    </section>
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

  const { isAuthed, isPro } = await readAuthAndTier();
  const { fixtures, groups, predictions, advancement, scorecard } = await loadPageData();

  const nowMs = getServerNowMs();
  const featured = pickFeaturedFixture(fixtures, nowMs);
  const featuredPrediction = featured ? predictions[featured.id] : undefined;

  // Next upcoming fixture (used in Overview "what's next" strip).
  const nextFixture =
    fixtures.find((f) => new Date(f.date).getTime() >= nowMs) ?? fixtures[0] ?? null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <FeaturedBannerSlot featured={featured} prediction={featuredPrediction} />

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
        nowMs={nowMs}
        nextFixture={nextFixture}
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
  nowMs,
  nextFixture,
}: {
  tab: string;
  groups: WCGroup[];
  fixtures: WCFixture[];
  predictions: Record<string, WCPredictionSlot>;
  advancement: Record<string, GroupAdvancementProb>;
  scorecard: WCScorecardType;
  isAuthed: boolean;
  isPro: boolean;
  nowMs: number;
  nextFixture: WCFixture | null;
}) {
  switch (tab) {
    case "schedule":
      return <WCSchedule fixtures={fixtures} predictions={predictions} nowMs={nowMs} />;
    case "groups":
      return (
        <GroupsPanel
          groups={groups}
          predictions={predictions}
          advancement={advancement}
          nowMs={nowMs}
        />
      );
    case "knockouts":
      return <KnockoutsPanel isPro={isPro} />;
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
