import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Changelog — OddsIntel",
  description: "What's new in OddsIntel — model improvements, new features, and bug fixes.",
};

// ── Changelog data ────────────────────────────────────────────────────────────
// Both engine (pipeline/model) and frontend (UI/UX) changes in one place.

type EntryType = "feature" | "fix" | "model" | "infra" | "data";

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
    date: "2026-05-27",
    title: "UI polish · Copy accuracy · Off-season empty state",
    changes: [
      { type: "fix", text: "Profile page copy corrected: starred matches now accurately described as pinned to top of your feed" },
      { type: "fix", text: "Watchlist alerts description updated to accurately say 'starred leagues' instead of saved matches" },
      { type: "fix", text: "Predictions page now shows a clear off-season explanation (Aug–May cycle) instead of a confusing 'check back tomorrow' message" },
      { type: "fix", text: "Contrast improvements across several pages — low-opacity labels lifted to meet accessibility standards" },
    ],
  },
  {
    date: "2026-05-25",
    title: "Value bets · Performance page · Draw No Bet · Meta-model",
    changes: [
      { type: "feature", text: "Bot consensus chip ('N bots agree') now visible to all tiers on the value bets page, not just Elite" },
      { type: "feature", text: "Line direction chip per pick: ↓ green means the market has moved toward our pick (sharpness signal), ↑ blue means the value is widening" },
      { type: "feature", text: "Compact league, kick-off time, and best bookmaker subtitle on every value bet row for quick line-shopping" },
      { type: "feature", text: "Free tier: highlighted pick now shows last-30-day ROI and sample size as a conversion hook" },
      { type: "feature", text: "Performance page: platform-wide cumulative P&L chart (90-day, daily buckets) as the headline trust signal" },
      { type: "feature", text: "Performance page: win streak and losing streak badges with sample-size disclaimer" },
      { type: "feature", text: "Performance page: calibration table (5 probability buckets) showing model accuracy vs actual outcomes" },
      { type: "data", text: "Draw No Bet (DNB) market now available on match pages — real DNB odds ingested from 13 bookmakers" },
      { type: "model", text: "Second-layer meta-model (B-ML3-V2) integrated into the pipeline — scores each pick's expected closing line value before selection; currently in passive monitoring mode" },
      { type: "data", text: "Overnight odds capture at 02:00 and 04:00 UTC — morning value picks now use significantly fresher line prices" },
    ],
  },
  {
    date: "2026-05-24",
    title: "6 new model signals · Asian Handicap overhaul · BTTS in-play bots",
    changes: [
      { type: "model", text: "6 new prediction signals added: season phase (fatigue and urgency patterns in early/mid/late-season matches), line velocity (how fast Pinnacle moves before kick-off), per-league draw rate, xG overperformance (regression-to-mean on expected goals), injury severity weighting (ACL/fracture counts 3× more than a knock), and rolling player ratings" },
      { type: "model", text: "Asian Handicap model overhauled: retired the away-dog bot (12-day backtest: −31.8% ROI), re-activated with a handicap line floor that lifts it to +43% ROI in backtesting, and filtered the home-fav bot to avoid a miscalibrated handicap zone (was −49% ROI on +0 lines)" },
      { type: "feature", text: "2 new BTTS in-play bots: one fires on 1-0 / 0-1 score states with active shot creation, one targets 0-0 games entering the final 25 minutes with high shot volume — both calibrating on first real results" },
    ],
  },
  {
    date: "2026-05-19",
    title: "Expanded league coverage · Model improvements · In-play signals",
    changes: [
      { type: "data", text: "Model predictions now cover 13 additional leagues: USA, Brazil, Argentina, Mexico, Japan, Sweden, Norway, Poland, Austria, Denmark, Czech Republic, China, and Russia" },
      { type: "model", text: "Improved in-play signal accuracy — in-play picks now go through stricter evidence filters before being surfaced" },
      { type: "model", text: "Added BTTS (Both Teams to Score) in-play signals — new market type available during live matches" },
      { type: "model", text: "Added Under 1.5 goals market to value picks" },
    ],
  },
  {
    date: "2026-05-17",
    title: "Performance page accuracy · Retired strategies",
    changes: [
      { type: "fix", text: "Performance page headline now shows active-strategy ROI separately from all-time ROI — no more mixing active and retired results" },
      { type: "fix", text: "Retired strategies now shown in a separate collapsible section rather than polluting the active leaderboard" },
      { type: "fix", text: "Performance charts now correctly start at each strategy's starting bankroll (not first bet outcome)" },
      { type: "fix", text: "Strategies with zero bets or no retirement reason hidden from the retired section" },
    ],
  },
  {
    date: "2026-05-13",
    title: "New inplay strategies · Performance quality filter",
    changes: [
      { type: "model", text: "2 new inplay strategies added: Underdog Hold (backs the underdog when the leading team stalls in the second half) and Post-Equalizer (picks up value in the minutes immediately after an equalizer)" },
      { type: "feature", text: "Quality filter toggle on the performance page — switch between all strategies and high-quality-only view" },
      { type: "fix", text: "Value bets: 'N bots agree' chip repositioned inline with the match name for a cleaner layout" },
    ],
  },
  {
    date: "2026-05-12",
    title: "Value bets display · Odds quality · Mobile improvements",
    changes: [
      { type: "feature", text: "Value bets page now shows Pinnacle odds and a live edge indicator — see how much value remains vs the sharpest book" },
      { type: "feature", text: "Stale pick dimming: value bets where odds have moved significantly are visually dimmed with an explicit status badge" },
      { type: "fix", text: "Asian Handicap labels now display correctly (e.g. Away +2 instead of Away -2)" },
      { type: "fix", text: "Value bets page now shows calibrated probability instead of raw model probability" },
      { type: "fix", text: "Mobile layout for value bets replaced with a proper card layout — no more truncated table rows" },
      { type: "fix", text: "Page load speed improvements: Lighthouse scores improved across SEO, accessibility, and LCP" },
    ],
  },
  {
    date: "2026-05-10",
    title: "Odds quality · Duplicate fixtures cleaned up",
    changes: [
      { type: "fix", text: "Over/Under odds cleaned up: 3 unreliable sources removed, plus an implied-sum sanity check to catch malformed lines" },
      { type: "fix", text: "1,425 duplicate fixture entries removed — match list and predictions pages no longer show the same match twice" },
    ],
  },
  {
    date: "2026-05-07",
    title: "Match detail redesign · Signal improvements · Predictions expansion",
    changes: [
      { type: "feature", text: "Match detail fully redesigned with tabbed layout: Overview, Intel, Context, and Stats tabs" },
      { type: "feature", text: "Model probabilities now shown in the Intel tab — see exact predicted win/draw/loss percentages" },
      { type: "feature", text: "Venue and referee shown in the Context tab for all matches" },
      { type: "feature", text: "Tab badge counts — e.g. Intel tab shows number of active signals without opening it" },
      { type: "feature", text: "Predictions pages now show league fixtures grouped by day with team crests and a 2-column grid layout" },
      { type: "fix", text: "Odds and probabilities correctly hidden for finished matches — Intel tab promoted to primary view post-match" },
      { type: "model", text: "Tier D renamed to Tier C across the model — clearer coverage tier labelling" },
    ],
  },
  {
    date: "2026-05-06",
    title: "Matches page UX · Today/Tomorrow tabs · Performance fixes",
    changes: [
      { type: "feature", text: "Today and Tomorrow tabs on the matches page — browse the next day's fixtures without refreshing" },
      { type: "feature", text: "Matches page now covers all active leagues (previously limited to top-tier leagues)" },
      { type: "fix", text: "Live scores shown in red, winning team bold — consistent with Flashscore-style visual conventions" },
      { type: "fix", text: "Match rows cleaned up on mobile: two-line team layout, slimmer headers, removed visual noise" },
      { type: "fix", text: "Match times shown in your local timezone (was showing UTC)" },
      { type: "fix", text: "Duplicate match entries on predictions pages fixed (PSG, Bayern Munich, and cross-league name variants)" },
    ],
  },
  {
    date: "2026-05-05",
    title: "Magic link sign-in · Branded auth emails · Auth flow improvements",
    changes: [
      { type: "feature", text: "Email sign-in now uses one-click magic link — no more typing a 6-digit code" },
      { type: "feature", text: "Entering an unknown email on the login page auto-redirects to signup with email pre-filled" },
      { type: "infra", text: "Auth emails (confirm, magic link) now sent from noreply@oddsintel.app via Resend — no more supabase.co sender" },
      { type: "infra", text: "Branded magic link email template with OddsIntel dark styling" },
    ],
  },
  {
    date: "2026-05-04",
    title: "Bot detail modal · Alignment signals expanded · Matches fix",
    changes: [
      { type: "feature", text: "Payments live: Pro (€4.99/mo) and Elite (€14.99/mo) subscriptions now accept real payments via Stripe" },
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
    date: "2026-04-29",
    title: "16 bots live · Instant settlement",
    changes: [
      { type: "feature", text: "6 new bots added (total 16): BTTS, O/U 1.5, O/U 3.5, draw specialist, and optimised variants" },
      { type: "fix", text: "Settlement triggers instantly on full-time detection — no more waiting for nightly batch" },
    ],
  },
  {
    date: "2026-04-28",
    title: "AI previews · Email digest · Live polling",
    changes: [
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
    title: "Data sources · Model foundation",
    changes: [
      { type: "data", text: "Odds from 13 bookmakers including Pinnacle, Betfair, Unibet, and Bet365 — covering 13 top-tier leagues" },
      { type: "data", text: "Supplementary odds coverage extended to 41 additional leagues" },
      { type: "model", text: "Global ELO ratings covering 8,385 teams" },
      { type: "model", text: "Poisson model with 3-tier fallback (own history → league averages → league predictions)" },
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
  data: "Data",
};

const TYPE_CLASSES: Record<EntryType, string> = {
  feature: "bg-green-500/15 text-green-400 border-green-500/30",
  fix: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  model: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  infra: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  data: "bg-amber-500/15 text-amber-400 border-amber-500/30",
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
            <div key={entry.date}>
              <div className="grid grid-cols-[auto_1fr] gap-x-6">
                <span className="font-mono text-sm text-muted-foreground whitespace-nowrap pt-0.5">
                  {entry.date}
                </span>
                <div>
                  <h2 className="text-base font-semibold leading-snug mb-4">{entry.title}</h2>
                  <ul className="space-y-2">
                    {entry.changes.map((change, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] px-0 py-0 h-5 w-14 justify-center ${TYPE_CLASSES[change.type]}`}
                        >
                          {TYPE_LABELS[change.type]}
                        </Badge>
                        <span className="text-sm text-muted-foreground leading-snug">
                          {change.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
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
