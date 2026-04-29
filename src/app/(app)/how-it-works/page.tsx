import Link from "next/link";
import { Check, Info, Zap, TrendingUp, BarChart3, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const FREE_FEATURES = [
  "Today's matches from 30+ leagues",
  "Live odds from 13 bookmakers side-by-side",
  "Best available odds highlighted automatically",
  "Model predictions: Home / Draw / Away for every match",
  "Prediction confidence level (statistical probability)",
  "Full track record — every prediction, every result",
  "Star leagues to personalise your matches view",
  "Personal picks tracker",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Value bets — where the model beats the bookmakers",
  "Edge % shown per bet (how much the model outprices the market)",
  "Daily value bet teaser (preview of today's best opportunities)",
  "Advanced match-level signal details",
];

const ELITE_FEATURES = [
  "Everything in Pro",
  "Additional markets: Over/Under 2.5, BTTS, handicap lines",
  "Odds movement alerts (when a line shifts significantly)",
  "Higher-volume value bet feed",
  "Priority support",
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
          What the model does, what each tier unlocks, and why the free tier is already useful.
        </p>
      </div>

      {/* Section 1: The model */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">The Prediction Model</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          OddsIntel runs a statistical ensemble model — a blend of{" "}
          <strong className="text-foreground/80">Poisson regression</strong> and{" "}
          <strong className="text-foreground/80">XGBoost</strong> — trained on historical match data
          from 30+ leagues. Every day at 05:30 UTC it processes available fixtures and outputs
          a probability for each 1×2 outcome (Home win / Draw / Away win).
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The model ingests: team form (last 5–10 matches), head-to-head history, current league
          standings, home/away performance splits, and a Dixon-Coles correction to reduce the
          well-known bias in Poisson models against low-scoring draws.
        </p>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground/80">What confidence % means:</strong> When the model says "Home — 62%", it means
              the algorithm believes the home team wins with 62% probability. This is purely statistical,
              derived from the features above — it does <em>not</em> compare against bookmaker odds.
              That comparison is what unlocks real betting value, and it&apos;s what Pro and Elite tiers add.
            </p>
          </div>
        </div>
      </section>

      <Separator className="opacity-30" />

      {/* Section 2: From prediction to value bet */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">From Prediction to Value Bet</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A raw prediction ("Home is most likely") is what every stats site already shows.
          The interesting question is: <strong className="text-foreground/80">what are the bookmakers pricing it at?</strong>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-card/40 p-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step 1 — Model</p>
            <p className="font-mono text-lg font-bold text-foreground">62%</p>
            <p className="mt-1 text-xs text-muted-foreground">Model says Home wins with 62% probability</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step 2 — Market</p>
            <p className="font-mono text-lg font-bold text-foreground">1.85 odds</p>
            <p className="mt-1 text-xs text-muted-foreground">Bookmaker implies 54% probability (100/1.85)</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400/70">Step 3 — Edge</p>
            <p className="font-mono text-lg font-bold text-emerald-400">+8%</p>
            <p className="mt-1 text-xs text-muted-foreground">Model beats market by 8 percentage points — a value bet</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Free users see Steps 1 (the prediction) and the Track Record of how accurate those predictions are.
          Pro and Elite users see Step 3 — the edge — and only for matches where the model is confident
          enough to be actionable.
        </p>
      </section>

      <Separator className="opacity-30" />

      {/* Section 3: Tier comparison */}
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
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {FREE_FEATURES.map((f) => <FeatureRow key={f} text={f} />)}
              </ul>
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pro</CardTitle>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                  Launching soon
                </Badge>
              </div>
              <p className="text-2xl font-bold">€4.99<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {PRO_FEATURES.map((f) => <FeatureRow key={f} text={f} />)}
              </ul>
            </CardContent>
          </Card>

          {/* Elite */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Elite</CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  Launching soon
                </Badge>
              </div>
              <p className="text-2xl font-bold">€14.99<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {ELITE_FEATURES.map((f) => <FeatureRow key={f} text={f} />)}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator className="opacity-30" />

      {/* Section 4: Common questions */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Common Questions</h2>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "Is the free tier actually useful?",
              a: "Yes. You get the full odds comparison across 13 bookmakers, the model's daily predictions, and a complete transparent track record. Most sports bettors don't have access to this kind of odds aggregation without paying for a dedicated tool.",
            },
            {
              q: "What's the difference between a prediction and a value bet?",
              a: "A prediction tells you who the model thinks will win. A value bet tells you where the model disagrees with the bookmakers enough that betting is statistically profitable in the long run. You can predict correctly and still lose money if you bet at bad odds — value betting solves that.",
            },
            {
              q: "How reliable are the Track Record numbers?",
              a: "Every settled prediction is logged automatically — no manual curation, no removing losses. The 'Strong (60%+)' filter shows predictions the model was most confident about; historically these have higher hit rates. You can verify everything in the table.",
            },
            {
              q: "What leagues are covered?",
              a: "30+ leagues including Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Championship, Eredivisie, Primeira Liga, Champions League and more. Coverage expands as the API data improves.",
            },
            {
              q: "When are predictions published?",
              a: "The pipeline runs daily at 05:30 UTC. Predictions for the day's fixtures are available by 06:00 UTC.",
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
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Start Free
          </Link>
          <Link
            href="/track-record"
            className="rounded-md border border-border px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View Track Record
          </Link>
        </div>
      </div>

    </div>
  );
}
