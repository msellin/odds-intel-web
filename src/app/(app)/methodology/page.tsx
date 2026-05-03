import type { Metadata } from "next";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Model Methodology — OddsIntel",
  description: "How OddsIntel's prediction model works: Poisson regression, XGBoost ensemble, signal weighting, calibration, and Kelly sizing.",
};

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 py-2">

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Model Methodology</h1>
        <p className="text-muted-foreground text-sm">
          Full technical description of the prediction pipeline, calibration approach, and bet sizing logic.
          Published for transparency — no other retail betting tool does this.
        </p>
      </div>

      <Separator className="opacity-30" />

      {/* 1. Pipeline overview */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">1. Daily Pipeline</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every morning at 04:00 UTC the pipeline runs five sequential stages for all matches with kickoff that day:
        </p>
        <ol className="space-y-2 text-sm text-muted-foreground list-none">
          {[
            ["Fixtures", "Fetch all matches from API-Football (280+ leagues). Store in matches table with team IDs, league, kickoff, venue, referee."],
            ["Enrichment", "Fetch standings, H2H records, team stats, and injury reports. Runs again at 12:00 and 16:00 UTC to pick up late injury news."],
            ["Odds", "Fetch pre-match odds from 13 bookmakers via API-Football bulk endpoint. Runs every 2 hours 07:00–22:00 UTC. Closing line snapshot taken at 13:30 and 17:30 UTC."],
            ["Predictions", "Run Poisson model + XGBoost ensemble for each match. Compute ensemble probability. Store to predictions table."],
            ["Betting", "Apply calibration + Kelly sizing. 16 paper-trading bots evaluate their configured markets. Qualifying bets stored to simulated_bets."],
          ].map(([step, desc], i) => (
            <li key={step} className="flex gap-3 rounded-lg border border-border/30 bg-card/30 px-4 py-3">
              <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-muted-foreground/50">{i + 1}</span>
              <div>
                <span className="font-semibold text-foreground/80">{step}. </span>
                <span>{desc}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Separator className="opacity-30" />

      {/* 2. Prediction model */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">2. Prediction Model</h2>

        <h3 className="text-base font-semibold text-foreground/80">2a. Poisson Model</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Goals for each team are modelled as independent Poisson processes:
        </p>
        <div className="rounded-lg border border-border/40 bg-card/30 px-4 py-3 font-mono text-xs text-muted-foreground">
          λ_home = attack_home × defence_away × home_advantage<br />
          λ_away = attack_away × defence_home<br />
          P(score = k) = e^(−λ) × λ^k / k!
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A Dixon-Coles correction (ρ = −0.13) reduces systematic overestimation of 0-0 and 1-0 draws.
          Attack and defence parameters are estimated from the last 10 matches with an exponential decay weighting
          (recent matches count more).
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Poisson model is computed for every match regardless of data availability — it serves as the
          baseline and as the fallback for leagues where XGBoost has insufficient training data.
        </p>

        <h3 className="text-base font-semibold text-foreground/80 pt-2">2b. XGBoost Classifier</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A gradient-boosted tree trained on 95,000+ historical matches predicts 1X2 and Over/Under outcomes.
          Training features include:
        </p>
        <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
          {[
            ["ELO ratings", "Home/away ELO from an independent system updated after every match"],
            ["Form PPG", "Points per game (last 10 matches, exponentially weighted)"],
            ["Form slope", "Is form trending up or down? Linear regression over last 6 results"],
            ["Venue splits", "Home/away form computed separately — some teams are dramatically better at home"],
            ["Rest days", "Days since last match for each team. Fatigue and rotation risk"],
            ["League standings", "Position, GD, pts gap to top/relegation. Motivation proxy"],
            ["H2H record", "Last 10 head-to-head results and typical goal counts"],
            ["Injuries", "Count of first-team players out, severity-weighted"],
            ["Market structure", "Pinnacle/best-price implied probability as a feature — uses market wisdom"],
            ["Bookmaker agreement", "Spread across bookmakers. High divergence = uncertainty"],
          ].map(([name, desc]) => (
            <div key={name} className="rounded-lg border border-border/30 bg-card/30 p-3">
              <p className="font-semibold text-foreground/80 mb-0.5">{name}</p>
              <p>{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          XGBoost is only deployed for Grade A/B matches (European top leagues + secondary leagues with sufficient
          historical data). Grade C/D matches use Poisson only.
        </p>

        <h3 className="text-base font-semibold text-foreground/80 pt-2">2c. Ensemble Blending</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The final ensemble probability blends Poisson + XGBoost using a tier-specific alpha parameter:
        </p>
        <div className="rounded-lg border border-border/40 bg-card/30 px-4 py-3 font-mono text-xs text-muted-foreground">
          p_blended = α × p_model + (1 − α) × p_market<br />
          <br />
          Tier 1 (Premier League, etc.): α = 0.20 — trust market more<br />
          Tier 2 (Championship, etc.):   α = 0.30<br />
          Tier 3 (lower leagues):         α = 0.50<br />
          Tier 4 (minor leagues):         α = 0.65 — trust model more
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Lower alpha in efficient markets (Premier League) reflects the bookmakers&apos; superior information.
          Higher alpha in less liquid markets (lower league) reflects that our Poisson model likely captures
          information the bookmaker&apos;s line doesn&apos;t fully price in.
        </p>

        <h3 className="text-base font-semibold text-foreground/80 pt-2">2d. Platt Scaling (Post-hoc Calibration)</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          After blending, a Platt sigmoid correction is applied per market using parameters fit on settled predictions:
        </p>
        <div className="rounded-lg border border-border/40 bg-card/30 px-4 py-3 font-mono text-xs text-muted-foreground">
          p_calibrated = 1 / (1 + exp(−(α × p_blended + β)))
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          α and β are fit by minimising log-loss on settled 1X2 predictions every Sunday.
          Requires 100+ settled predictions per market. This corrects systematic over- or under-confidence
          that survives the blending step.
        </p>
      </section>

      <Separator className="opacity-30" />

      {/* 3. Signals */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">3. Signal Collection (58 per match)</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Separately from the model, the pipeline collects up to 58 signals per match into a
          normalised EAV (entity-attribute-value) table. Signals inform the Intelligence Summary on
          the match detail page and feed the meta-model (training, not yet live).
        </p>
        <div className="space-y-2 text-sm text-muted-foreground">
          {[
            ["Market signals (8)", "Opening implied probs, bookmaker disagreement spread (BDM), overnight line move, odds volatility (24h std dev), steam move detection"],
            ["Team quality signals (22)", "ELO rating, form PPG (home/away/overall), form slope, venue split, season goal stats, xG, clean sheet rate, scoring rate"],
            ["Context signals (10)", "Fixture importance index, motivation asymmetry, rest day differential, referee cards avg, referee home-win%, referee Over 2.5%"],
            ["News & injury signals (6)", "Home/away injury count, away injury severity, suspension risk, lineup confirmation flag, AI news impact score"],
            ["Model signals (4)", "Poisson home/draw/away probs, XGBoost probability where available"],
            ["Live signals (8)", "Minute, score, xG pace, shots on target, possession, red cards — updated every 30s during matches"],
          ].map(([group, desc]) => (
            <div key={group} className="rounded-lg border border-border/30 bg-card/30 px-4 py-3">
              <p className="font-semibold text-foreground/80 mb-0.5">{group}</p>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <Separator className="opacity-30" />

      {/* 4. Bet sizing */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">4. Bet Sizing (Kelly Criterion)</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Stakes are sized using fractional Kelly:
        </p>
        <div className="rounded-lg border border-border/40 bg-card/30 px-4 py-3 font-mono text-xs text-muted-foreground">
          kelly = (p × odds − 1) / (odds − 1)<br />
          stake = kelly × 0.15 × bankroll × data_tier_multiplier<br />
          max_stake = 1% of bankroll
        </div>
        <div className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground mt-2">
          {[
            ["Kelly fraction", "0.15× (quarter-Kelly)", "Conservative — reduces variance, prevents ruin on model error"],
            ["Max stake cap", "1% bankroll", "Hard cap regardless of Kelly output. Prevents single-match blow-ups"],
            ["Grade A", "1.0× multiplier", "Full tier weight for top-league matches with rich feature sets"],
            ["Grade B", "0.75×", "Reduced stake for Poisson-only matches"],
            ["Grade C", "0.5×", "Minimal stake for AF-prediction-only matches"],
            ["Minimum stake", "€1.00", "Below this threshold the bet is skipped — micro-stakes add no useful signal"],
          ].map(([label, value, desc]) => (
            <div key={label} className="rounded-lg border border-border/30 bg-card/30 p-3">
              <p className="font-semibold text-foreground/80">{label}</p>
              <p className="font-mono text-[11px] text-primary/80 my-0.5">{value}</p>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <Separator className="opacity-30" />

      {/* 5. Track record + CLV */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">5. Track Record & CLV</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The track record page shows every settled prediction — no cherry-picking, no removing losses.
          The two metrics we use to evaluate model quality:
        </p>
        <div className="grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
          <div className="rounded-lg border border-border/40 bg-card/30 px-4 py-4">
            <p className="font-semibold text-foreground/80 mb-1">Hit Rate</p>
            <p>What % of predictions were correct. A useful sanity check — a profitable model must be right more often than the odds imply (or right <em>enough</em> when it is right).</p>
          </div>
          <div className="rounded-lg border border-border/40 bg-card/30 px-4 py-4">
            <p className="font-semibold text-foreground/80 mb-1">Closing Line Value (CLV)</p>
            <p>Did we get better odds than the closing price? CLV is the gold standard metric in professional betting: a model that consistently beats the closing line is finding real value, even when short-term results disappoint due to variance.</p>
            <p className="mt-2 font-mono text-xs text-primary/70">CLV = (entry_odds / closing_odds) − 1</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Positive CLV over a large sample is a stronger predictor of long-term profitability than raw
          hit rate. Results take hundreds of bets to converge; CLV signal appears much sooner.
        </p>
      </section>

      <Separator className="opacity-30" />

      {/* 6. What we don't do */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">6. What We Don&apos;t Do</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          {[
            ["No survivor bias", "The track record includes every bet placed. We do not remove underperforming bots or retroactively adjust strategy based on results."],
            ["No selective publishing", "Predictions are generated and stored before kickoff. They cannot be modified after the result is known."],
            ["No guarantee of profit", "Expected value betting is long-run positive, but variance over short samples is high. Any 50-bet sample can be negative even with a genuine edge."],
            ["No single-source data", "We cross-validate API-Football with Kambi odds and flag discrepancies. No single data source failure breaks the pipeline."],
          ].map(([label, desc]) => (
            <div key={label} className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-3">
              <p className="font-semibold text-foreground/80 mb-0.5">{label}</p>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
