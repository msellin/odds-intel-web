import Link from "next/link";
import { Check, Info, Zap, TrendingUp, BarChart3, Star, Database, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ─── Tier feature lists (sourced from TIER_ACCESS_MATRIX.md + ROADMAP.md) ───

const FREE_FEATURES = [
  "All fixtures from 280+ leagues — daily",
  "Live scores (auto-refresh every minute)",
  "Best available odds per match (single best across bookmakers)",
  "Model predictions: Home / Draw / Away for every match",
  "Prediction confidence (statistical probability, 3 levels)",
  "Full track record — every prediction, every result, no cherry-picking",
  "Star leagues → My Matches personalised feed",
  "Personal picks tracker (log & track your own predictions)",
  "Match notes — private journal per match",
  "Community sentiment voting (what the crowd thinks)",
  "1 free value bet teaser per day",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Full odds comparison across 13 bookmakers",
  "Pre-match odds movement timeline",
  "Team form, H2H, goals stats, standings",
  "AI injury & suspension alerts per match",
  "Confirmed lineups + formation view",
  "Directional model signal — Home lean / Away lean / Even (no raw %)",
  "Full match history, not just today",
  "Post-match stats: shots, possession, xG",
];

const ELITE_FEATURES = [
  "Everything in Pro",
  "Exact model probability % per outcome",
  "Edge % — how much the model beats each bookmaker",
  "Value bets list — every match where edge > threshold today",
  "Closing line value (CLV) tracking — the gold standard for +EV betting",
  "Natural language explanations: why the model likes this pick",
  "Tips from top-performing bot once ROI is validated (launching Q3)",
  "Early access to new signal groups and league coverage",
];

const SIGNAL_GROUPS = [
  {
    name: "Model",
    count: 4,
    desc: "Poisson regression, XGBoost, API-Football predictions, calibrated ensemble",
  },
  {
    name: "Market",
    count: 8,
    desc: "Opening implied probabilities, bookmaker disagreement, overnight line moves, odds volatility, steam moves",
  },
  {
    name: "Form & Strength",
    count: 22,
    desc: "ELO ratings, 10-match form PPG, form slope, venue splits, season goals, standings position, H2H records, rest days",
  },
  {
    name: "News & Injuries",
    count: 6,
    desc: "Injury counts, players out, lineup confirmation status, AI news impact score (4× daily via Gemini)",
  },
  {
    name: "Context",
    count: 10,
    desc: "Fixture importance, motivation asymmetry, referee tendencies (cards, home bias, over 2.5 rate), league meta stats",
  },
  {
    name: "Live",
    count: 8,
    desc: "Score, minute, shots, xG, possession, live odds, red cards, goals (updated every 5 minutes during matches)",
  },
];

function FeatureRow({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
      <span className="text-sm text-muted-foreground">{text}</span>
    </li>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12 py-2">

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">How OddsIntel Works</h1>
        <p className="text-muted-foreground">
          What the model does, what each tier unlocks, and why you can trust the track record.
        </p>
      </div>

      {/* Section 1: The model */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">The Prediction Model</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every day at 05:30 UTC our pipeline runs for every match with enough data. It blends three
          sources into a single <strong className="text-foreground/80">ensemble probability</strong>:
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/40 bg-card/40 p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Poisson</p>
            <p className="text-xs text-muted-foreground">Models goals scored and conceded as independent Poisson processes. Dixon-Coles correction reduces bias on low-scoring draws.</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/40 p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">XGBoost</p>
            <p className="text-xs text-muted-foreground">Gradient boosting on 36+ features — ELO, form, standings, H2H, rest days, injuries. Learns non-linear patterns Poisson misses.</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/40 p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">API-Football</p>
            <p className="text-xs text-muted-foreground">Third-party predictions used as a cross-check signal and fallback for leagues where our historical data is thinner.</p>
          </div>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground/80">What confidence % means:</strong> The algorithm&apos;s raw statistical probability for the most likely outcome. It does not compare against bookmaker odds — that comparison is what Pro and Elite add. Higher confidence matches have historically higher hit rates.
            </p>
          </div>
        </div>
      </section>

      <Separator className="opacity-30" />

      {/* Section 2: Signal groups */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Signal Groups</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Our pipeline collects data across 6 groups throughout the day. Most signals are available for any match
          with odds; some (lineups, live xG) depend on what the league supports. Data grade reflects which prediction
          model ran — not how many signals were collected.
        </p>
        <div className="space-y-2">
          {SIGNAL_GROUPS.map((g) => (
            <div key={g.name} className="flex items-start gap-4 rounded-xl border border-border/30 bg-card/30 px-4 py-3">
              <div className="w-8 shrink-0 text-right">
                <span className="font-mono text-lg font-bold text-foreground">{g.count}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{g.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{g.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/70">
          Signals are collected throughout the day. Lineups (T-1h), injury updates (4× daily), and live data
          (every 5 min) all update the picture before and during a match.
        </p>
      </section>

      <Separator className="opacity-30" />

      {/* Section 3: From prediction to value bet */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">From Prediction to Value Bet</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A prediction tells you who is most likely to win. A value bet tells you where the bookmakers have
          underpriced that probability. These are different things.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-card/40 p-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step 1 — Free tier</p>
            <p className="font-mono text-lg font-bold text-foreground">62%</p>
            <p className="mt-1 text-xs text-muted-foreground">Model says Home wins with 62% probability</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step 2 — Pro tier</p>
            <p className="font-mono text-lg font-bold text-foreground">1.85 odds</p>
            <p className="mt-1 text-xs text-muted-foreground">Bookmaker implies 54% probability (1/1.85). You see the full spread across 13 bookmakers.</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400/70">Step 3 — Elite tier</p>
            <p className="font-mono text-lg font-bold text-emerald-400">+8% edge</p>
            <p className="mt-1 text-xs text-muted-foreground">Model beats market by 8 pp — a value bet. Kelly stake calculated automatically.</p>
          </div>
        </div>
      </section>

      <Separator className="opacity-30" />

      {/* Section 4: Tier comparison */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">What Each Tier Includes</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Free */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Free</CardTitle>
              <p className="text-2xl font-bold">€0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground">Curious about the product</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {FREE_FEATURES.map((f) => <FeatureRow key={f} text={f} />)}
              </ul>
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pro</CardTitle>
              <p className="text-2xl font-bold">€4.99<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground">Does own research, wants better data</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {PRO_FEATURES.map((f) => <FeatureRow key={f} text={f} />)}
              </ul>
            </CardContent>
          </Card>

          {/* Elite */}
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Elite</CardTitle>
              <p className="text-2xl font-bold">€14.99<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground">Serious bettor, wants model-backed picks</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {ELITE_FEATURES.map((f) => <FeatureRow key={f} text={f} />)}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-lg border border-border/30 bg-card/30 px-4 py-3 text-xs text-muted-foreground">
          <strong className="text-foreground/80">Founding member rates</strong> — first 500 Pro subscribers lock in €3.99/mo forever. First 200 Elite subscribers lock in €9.99/mo forever. These rates will not be offered again after the cohorts fill.
        </div>
      </section>

      <Separator className="opacity-30" />

      {/* Section 5: Symbols & Icons guide */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Symbols &amp; Icons Guide</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Here&apos;s what every symbol on the matches page means at a glance.
        </p>

        <div className="space-y-2">
          {/* Data Grade */}
          <div className="rounded-xl border border-border/30 bg-card/30 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Data Grade</p>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex items-center gap-2">
                <span className="inline-block rounded bg-green-500/20 px-1.5 text-[10px] font-bold leading-5 text-green-400">A</span>
                <span className="text-xs text-muted-foreground">Full model — XGBoost + Poisson ensemble with rich historical data. Highest confidence predictions.</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-start gap-4">
              <div className="flex items-center gap-2">
                <span className="inline-block rounded bg-amber-500/20 px-1.5 text-[10px] font-bold leading-5 text-amber-500">B</span>
                <span className="text-xs text-muted-foreground">Statistical model — Poisson only. Good predictions but less historical depth for this league.</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-start gap-4">
              <div className="flex items-center gap-2">
                <span className="inline-block rounded bg-white/[0.06] px-1.5 text-[10px] font-bold leading-5 text-muted-foreground/50">C</span>
                <span className="text-xs text-muted-foreground">Prediction-based — limited historical data for this league. Uses API-Football probabilities as baseline.</span>
              </div>
            </div>
          </div>

          {/* Match Pulse */}
          <div className="rounded-xl border border-border/30 bg-card/30 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Match Pulse</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-orange-400">⚡</span>
              <span className="text-xs text-muted-foreground"><strong className="text-foreground/80">High Alert</strong> — sharp line movement, bookmaker disagreement, or significant market activity detected. Worth a closer look.</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-block size-2 rounded-full bg-amber-500/60" />
              <span className="text-xs text-muted-foreground"><strong className="text-foreground/80">Interesting</strong> — moderate signals detected (mild odds shift or some bookmaker divergence).</span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground/60">
              Most matches (~80%) are &quot;Routine&quot; — no special indicator shown. The pulse only flags the ~15-20% of matches with unusual activity.
            </p>
          </div>

          {/* Fire icon on league header */}
          <div className="rounded-xl border border-border/30 bg-card/30 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-foreground">League Header</p>
            <div className="flex items-center gap-2">
              <span className="text-sm">🔥</span>
              <span className="text-xs text-muted-foreground"><strong className="text-foreground/80">Odds available</strong> — at least one match in this league has bookmaker odds data from our 13-bookmaker feed.</span>
            </div>
          </div>

          {/* Predicted Score */}
          <div className="rounded-xl border border-border/30 bg-card/30 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Predicted Score</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-violet-400/80">2–1</span>
              <span className="text-xs text-muted-foreground">AI predicted most likely scoreline. Rounded from the model&apos;s expected goals output. Available for ~40% of matches.</span>
            </div>
          </div>

          {/* Odds + Movement */}
          <div className="rounded-xl border border-border/30 bg-card/30 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Odds &amp; Movement</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-emerald-400">2.45</span>
              <span className="text-xs text-muted-foreground"><strong className="text-foreground/80">Green highlight</strong> — best available odds across bookmakers for this selection (Home / Draw / Away).</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-green-400">▲</span>
              <span className="text-xs text-muted-foreground"><strong className="text-foreground/80">Odds rising</strong> — odds have increased vs ~24h ago (less likely according to the market). <span className="italic text-muted-foreground/50">Pro only.</span></span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-red-400">▼</span>
              <span className="text-xs text-muted-foreground"><strong className="text-foreground/80">Odds dropping</strong> — odds have decreased vs ~24h ago (more likely according to the market). <span className="italic text-muted-foreground/50">Pro only.</span></span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[9px] font-bold text-muted-foreground/40 tabular-nums">13</span>
              <span className="text-xs text-muted-foreground"><strong className="text-foreground/80">Bookmaker count</strong> — number of bookmakers with odds for this match. More bookmakers = more liquid market.</span>
            </div>
          </div>

          {/* Form Strip */}
          <div className="rounded-xl border border-border/30 bg-card/30 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Form Strip</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <span className="inline-block size-2 rounded-full bg-green-500" />
                <span className="inline-block size-2 rounded-full bg-green-500" />
                <span className="inline-block size-2 rounded-full bg-amber-500" />
                <span className="inline-block size-2 rounded-full bg-red-500/70" />
                <span className="inline-block size-2 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-muted-foreground">Last 5 results. <span className="text-green-400">Green</span> = Win, <span className="text-amber-400">Amber</span> = Draw, <span className="text-red-400/70">Red</span> = Loss. Read left-to-right (oldest to most recent).</span>
            </div>
          </div>

          {/* Signal Teasers */}
          <div className="rounded-xl border border-border/30 bg-card/30 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Signal Teasers</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] italic text-muted-foreground/60">&quot;High bookmaker disagreement&quot;</span>
              <span className="text-xs text-muted-foreground">— Plain-English summaries of notable signals. Shown on ~30-40% of matches where something stands out.</span>
            </div>
          </div>

          {/* Match Status */}
          <div className="rounded-xl border border-border/30 bg-card/30 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Match Status</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-green-400 leading-none">
                  <span className="size-1.5 rounded-full bg-green-400" />
                  LIVE
                </span>
                <span className="text-xs text-muted-foreground">Match is currently in play. Minute shown below. Scores update every 60 seconds.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground/40">FT</span>
                <span className="text-xs text-muted-foreground">Full time — match is finished.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground/40">HT</span>
                <span className="text-xs text-muted-foreground">Half time — match is at the break.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">22:00</span>
                <span className="text-xs text-muted-foreground">Scheduled kickoff time (your local timezone).</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator className="opacity-30" />

      {/* Section 6: Common questions */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Common Questions</h2>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "Is the free tier actually useful?",
              a: "Yes. You get predictions for 280+ leagues daily, a picks tracker to build your own record, and our full transparent track record. Most bettors have never had access to this kind of data without paying for a professional tool.",
            },
            {
              q: "What's the difference between a prediction and a value bet?",
              a: "A prediction says 'Home is most likely to win at 62%'. A value bet says 'Home is 62% likely but the bookmakers are only pricing it at 54%, so you have an 8% edge'. You can predict correctly and still lose money if you consistently bet at bad odds. Value betting solves that.",
            },
            {
              q: "What does edge % mean?",
              a: "Edge = model probability minus bookmaker's implied probability. +8% means our model thinks the true probability is 8 percentage points higher than what the odds imply. Over a large sample, consistently finding positive edge is what produces profitable betting.",
            },
            {
              q: "How reliable are the track record numbers?",
              a: "Every settled prediction is logged automatically when the pipeline runs — no manual curation, no removing losses. The 'Strong (60%+)' filter shows predictions the model was most confident about. You can verify every row in the table.",
            },
            {
              q: "What leagues are covered?",
              a: "280+ leagues worldwide. Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Championship, Eredivisie, Primeira Liga, Scottish Premiership, Champions League, and many more. Grade A data (best signals) is available for European top leagues. Leagues with less history have Grade B–D coverage.",
            },
            {
              q: "When are predictions published?",
              a: "The pipeline runs at 05:30 UTC. Predictions are available by 06:00 UTC. Injury and lineup signals update throughout the day (4× news scans, lineups at T-1h).",
            },
            {
              q: "When does Elite launch?",
              a: "Elite launches once 60+ bets have settled and we can show validated ROI. We're paper-trading now — the track record page shows model accuracy. Value bets are visible to signed-in users already as we build toward the paid launch.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-xl border border-border/40 bg-card/40 px-5 py-4">
              <p className="mb-1.5 text-sm font-semibold text-foreground">{q}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="rounded-xl border border-border/50 bg-card/60 px-6 py-8 text-center">
        <p className="mb-1 text-lg font-semibold">Ready to see today&apos;s predictions?</p>
        <p className="mb-5 text-sm text-muted-foreground">Free forever. No credit card required.</p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Start Free
          </Link>
          <Link
            href="/track-record"
            className="rounded-md border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View Track Record
          </Link>
        </div>
        <p className="mt-5 text-xs text-muted-foreground/60">
          Want the full technical detail?{" "}
          <Link href="/methodology" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
            Read the model methodology →
          </Link>
        </p>
      </div>

    </div>
  );
}
