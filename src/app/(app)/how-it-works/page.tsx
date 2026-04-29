import Link from "next/link";
import { Check, Info, Zap, TrendingUp, BarChart3, Star, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ─── Tier feature lists (sourced from TIER_ACCESS_MATRIX.md + ROADMAP.md) ───

const FREE_FEATURES = [
  "All fixtures from 280+ leagues — daily",
  "Live scores (auto-refresh every minute)",
  "Best odds from 2–3 bookmakers per match",
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

      {/* Section 2: 58 signals */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">58 Signals Per Match</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The model ingests up to 58 signals per match across 6 groups. More signals = higher data grade (A–D).
          Grade A matches (European top leagues) have the most data; Grade D matches have only basic predictions.
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pro</CardTitle>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
                  Launching soon
                </Badge>
              </div>
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Elite</CardTitle>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                  Launching soon
                </Badge>
              </div>
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

      {/* Section 5: Common questions */}
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
      </div>

    </div>
  );
}
