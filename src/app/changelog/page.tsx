import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Changelog — OddsIntel",
  description: "What's new in OddsIntel — model improvements, new features, and bug fixes.",
};

// ── Changelog data ────────────────────────────────────────────────────────────
// Both engine (pipeline/model) and frontend (UI/UX) changes in one place.

type EntryType = "feature" | "fix" | "model" | "infra";

interface ChangeEntry {
  type: EntryType;
  text: string;
}

interface ChangelogEntry {
  date: string;
  title: string;
  changes: ChangeEntry[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-05-04",
    title: "Bot detail modal · Alignment signals expanded · Matches fix",
    changes: [
      { type: "feature", text: "Bot dashboard: click any bot to see full bet history with bankroll progression chart" },
      { type: "feature", text: "Sharp bookmaker consensus signal: tracks whether Pinnacle, Betfair et al. agree with the model pick" },
      { type: "feature", text: "Pinnacle anchor signal: flags picks where the sharpest market confirms (+) or rejects (–) model probability" },
      { type: "fix", text: "Alignment scoring: bets with no active signals now correctly show NONE instead of LOW" },
      { type: "fix", text: "Matches page: shows today's matches + yesterday's still-in-progress only (was showing finished yesterday matches)" },
      { type: "infra", text: "Track record page now reads from pre-computed nightly cache — significantly faster load" },
    ],
  },
  {
    date: "2026-05-03",
    title: "Platt scaling calibration · Nightly dashboard cache",
    changes: [
      { type: "model", text: "Platt scaling fitted on 400 real match outcomes — probability calibration error (ECE) reduced by 86–97% across all markets" },
      { type: "model", text: "Auto-calibration triggers after settlement once enough data is available" },
      { type: "infra", text: "Dashboard cache written at 21:00 UTC — track record, bot stats, and system status all served from cache" },
    ],
  },
  {
    date: "2026-05-01",
    title: "Bot dashboard · Pipeline monitoring",
    changes: [
      { type: "feature", text: "Superadmin bot dashboard: per-bot P&L, hit rate, stakes, ROI, and market breakdown (16 bots running)" },
      { type: "feature", text: "Daily morning monitoring script: threshold progress, per-bot P&L, calibration health, pipeline status" },
      { type: "infra", text: "GitHub Actions backfill cron disabled — Railway handles all scheduling" },
    ],
  },
  {
    date: "2026-04-29",
    title: "16 bots live · Timing A/B test · Instant settlement",
    changes: [
      { type: "feature", text: "6 new bots added (total 16): BTTS, O/U 1.5, O/U 3.5, draw specialist, and optimised variants" },
      { type: "feature", text: "Timing cohort A/B test: pre-match (2h) vs last-minute (30min) to measure information timing value" },
      { type: "feature", text: "Exposure control: stake halved for 3rd+ bet in same league per bot per day" },
      { type: "fix", text: "Settlement triggers instantly on full-time detection — no more waiting for nightly batch" },
      { type: "model", text: "Closing Line Value (CLV) recorded per bet for ongoing model benchmarking" },
    ],
  },
  {
    date: "2026-04-28",
    title: "Railway pipeline · AI previews · Email digest",
    changes: [
      { type: "infra", text: "All pipeline jobs moved to Railway ($5/mo) — no more GitHub Actions 12-minute limits" },
      { type: "infra", text: "Smart live polling: 30s during live matches, 60s/5min when quiet — fully automatic" },
      { type: "feature", text: "AI match previews published daily at 09:00 UTC (Gemini-powered)" },
      { type: "feature", text: "Email digest: daily picks summary sent to subscribers" },
    ],
  },
  {
    date: "2026-04-27",
    title: "Match list UX · Track record redesign",
    changes: [
      { type: "feature", text: "Team crests on match list and detail pages" },
      { type: "feature", text: "Countdown timer to kick-off for upcoming matches" },
      { type: "feature", text: "Form strip (last 5 results) shown per team" },
      { type: "feature", text: "Track record redesign: leads with Closing Line Value and alignment signals, not bankroll simulation" },
      { type: "feature", text: "Statistical significance progress bars: tracks milestones toward credible sample size" },
    ],
  },
  {
    date: "2026-04-26",
    title: "XGBoost ensemble · Sharp book classification · Signal system",
    changes: [
      { type: "model", text: "XGBoost blended with Poisson model (50/50) — improved on high-variance matches" },
      { type: "model", text: "Sharp bookmaker classification: 13 books scored by historical sharpness, feeds into signal weighting" },
      { type: "model", text: "Dixon-Coles correction applied to Poisson home/away rates" },
      { type: "feature", text: "11 signals tracked per match: odds movement, injuries, lineup news, form delta, ELO gap, H2H, referee, situational, sharp consensus, Pinnacle anchor" },
      { type: "feature", text: "Alignment score per bet: NONE / LOW / MED / HIGH — measures how much supporting evidence exists" },
    ],
  },
  {
    date: "2026-04-25",
    title: "Signal UX · Live odds chart · Bet explanations",
    changes: [
      { type: "feature", text: "Signal accordion on match detail: signals grouped by category with expand/collapse" },
      { type: "feature", text: "Signal delta: shows what changed since your last visit (Pro)" },
      { type: "feature", text: "Intelligence summary card on match detail — key signals at a glance" },
      { type: "feature", text: "Live in-play odds chart for Pro users during live matches" },
      { type: "feature", text: "Bet explanations: Gemini generates natural language reasoning per pick (Elite)" },
      { type: "feature", text: "Tier system: Free / Pro (€4.99/mo) / Elite (€14.99/mo) with Stripe billing" },
    ],
  },
  {
    date: "2026-04-24",
    title: "Data sources · Model foundation · Paper trading begins",
    changes: [
      { type: "infra", text: "API-Football Ultra: fixtures, odds (13 bookmakers), lineups, injuries, H2H, events, player stats" },
      { type: "infra", text: "Kambi scraper: supplementary odds for 41 additional leagues" },
      { type: "infra", text: "Historical backfill: 354,000 matches across 275 leagues for model training" },
      { type: "model", text: "Global ELO ratings covering 8,385 teams" },
      { type: "model", text: "Poisson model with 3-tier fallback (own history → league averages → AF predictions)" },
      { type: "feature", text: "Paper trading started — all bets logged, zero real money" },
    ],
  },
  {
    date: "2026-04-20",
    title: "Launch",
    changes: [
      { type: "feature", text: "OddsIntel public beta launched" },
      { type: "feature", text: "Public matches page (no account required)" },
      { type: "feature", text: "Auth: magic link OTP + Google OAuth" },
      { type: "feature", text: "Free tier: match list, signal grades, today's picks teaser" },
      { type: "feature", text: "Pro tier: full signals, odds movement, lineups, injuries, value bets" },
    ],
  },
];

// ── Badge styles ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<EntryType, string> = {
  feature: "Feature",
  fix: "Fix",
  model: "Model",
  infra: "Infra",
};

const TYPE_CLASSES: Record<EntryType, string> = {
  feature: "bg-green-500/15 text-green-400 border-green-500/30",
  fix: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  model: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  infra: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChangelogPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="font-mono text-xl font-black uppercase italic tracking-tight text-white"
          >
            ODDS<span className="text-green-500">INTEL</span>
          </Link>
          <Link
            href="/matches"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to matches
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Changelog</h1>
          <p className="text-muted-foreground">
            What&apos;s new in OddsIntel — model improvements, new features, and fixes.
            Both pipeline (engine) and UI changes are listed here.
          </p>
        </div>

        <div className="space-y-10">
          {CHANGELOG.map((entry) => (
            <div key={entry.date} className="relative">
              {/* Date + title */}
              <div className="flex items-baseline gap-4 mb-4">
                <span className="font-mono text-sm text-muted-foreground whitespace-nowrap">
                  {entry.date}
                </span>
                <h2 className="text-base font-semibold leading-snug">{entry.title}</h2>
              </div>

              {/* Changes */}
              <ul className="space-y-2 pl-0">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Badge
                      variant="outline"
                      className={`mt-0.5 shrink-0 text-[10px] px-1.5 py-0 h-5 ${TYPE_CLASSES[change.type]}`}
                    >
                      {TYPE_LABELS[change.type]}
                    </Badge>
                    <span className="text-sm text-muted-foreground leading-snug">
                      {change.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Divider */}
              <div className="mt-8 border-b border-white/[0.06]" />
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted-foreground text-center">
          OddsIntel is in public beta. All model predictions are for informational purposes only.
        </p>
      </div>
    </div>
  );
}
