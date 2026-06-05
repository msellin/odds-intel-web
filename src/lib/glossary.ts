export interface GlossaryTerm {
  slug: string;
  title: string;
  shortDef: string;       // one-liner for cards and SEO description
  body: string;           // full explanation (markdown-ish, rendered as prose)
  relatedTerms?: string[]; // slugs
  faqItems?: { q: string; a: string }[];
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    slug: "expected-value",
    title: "Expected Value (EV)",
    shortDef: "The average return you can expect per bet over many repetitions.",
    body: `Expected Value (EV) is the cornerstone of professional betting. A positive EV bet is one where the true probability of winning is higher than the probability implied by the bookmaker's odds.

**Formula:** EV = (probability of winning × potential profit) − (probability of losing × stake)

**Example:** If you estimate a team has a 55% chance to win and the bookmaker offers odds of 2.10 (implying 47.6%), your EV per €10 stake is:

(0.55 × €11) − (0.45 × €10) = €6.05 − €4.50 = **+€1.55 per bet**

Over hundreds of bets, positive EV bets produce profit even if individual results vary. The OddsIntel model hunts for these edges.`,
    relatedTerms: ["value-betting", "kelly-criterion", "closing-line-value"],
    faqItems: [
      {
        q: "Can you have positive EV and still lose money?",
        a: "Yes, in the short run. Variance can produce losing streaks even with positive EV bets. Over 500+ bets, however, positive EV reliably produces positive results.",
      },
      {
        q: "How does OddsIntel calculate EV?",
        a: "The model estimates true win probability using a Poisson + XGBoost ensemble, then compares it to the bookmaker-implied probability (1 / odds). The difference, adjusted for margin, is the edge.",
      },
    ],
  },
  {
    slug: "closing-line-value",
    title: "Closing Line Value (CLV) — Why It Beats ROI",
    shortDef: "The honest scoreboard for a betting model. CLV proves edge in weeks; ROI takes years.",
    body: `Closing Line Value (CLV) measures whether the odds you took were better than the closing odds — the price the market settled at just before the match started. It is the single most important number in serious sports betting, and the reason every honest tracker (Bet-Analytix, Smart Betting Club, Pinnacle's own analytics) leads with it.

**The headline: ROI lies. CLV is the honest scoreboard.**

If your model is genuinely finding edges, you will consistently beat the closing line. If you are just lucky, you will not. Variance can hide either truth for months — but CLV is visible immediately.

---

**Why ROI alone is misleading**

ROI is the obvious metric: total profit divided by total amount staked. But ROI is **variance-confounded** — a model with a real +3% edge can show −10% ROI over 200 bets and still be a winning model. A coin-flip bettor on heavy favourites can show +5% ROI for six months and still be a losing strategy in the long run.

The math is brutal: a model with +2% edge needs **~1,500 settled bets** to distinguish itself from luck at 95% confidence. At a realistic 5 bets per day, that is nearly a full year of patience before you can trust the ROI signal at all. Almost no recreational bettor lasts that long without quitting in a drawdown.

CLV solves this. Because the closing line is a near-efficient estimate of true probability, a model that consistently beats it is finding edges that *the rest of the market eventually agrees with*. You can detect that signal in **50–100 bets** — within weeks, not years.

---

**Formula**

\`\`\`
CLV = (1 / your_odds) / (1 / closing_odds) − 1
\`\`\`

A CLV of +3% means your implied probability was 3 percentage points lower than the closing implied probability — you got better odds than the market's final consensus.

**Example:** You bet Over 2.5 at 1.85 (implied 54.1%). Market closes at 1.75 (implied 57.1%). Your CLV = (1/1.85) / (1/1.75) − 1 = +5.7%. Whether the bet won or lost is irrelevant to your CLV — you got better odds than the line settled at. Over hundreds of bets, that compounds into profit even if any individual bet loses.

---

**What's a good CLV?**

- **+0% to +1%**: You are roughly market-efficient. No edge.
- **+1% to +3%**: Modest edge. Pinnacle's own arbers and most syndicate runners aim here.
- **+3% to +5%**: Strong edge. Most professional bettors who survive long term land here.
- **+5%+**: Exceptional. Watch for sample-size effects; numbers above +8% over <500 bets are usually noise.

OddsIntel currently runs at **+9.8% CLV (30 days)** across our active value-bet cohort. The 9-month all-time number will be lower as the sample grows — that is expected.

---

**Why we publish CLV everywhere we can**

Every value bet OddsIntel logs gets a CLV score after settlement. The 30-day rolling CLV is the single number shown in the landing hero, the trust banner, and the dashboard. It is the cleanest signal that the model is doing real work — independent of variance, of how many bets won this week, of which leagues happen to be in form.

**Pseudo-CLV** — we don't have a true real-time closing-line feed for every market, so we use the price at our last pre-kickoff snapshot as a proxy. It is directionally identical to true CLV and slightly noisier. Every figure published on /performance and in the landing micro-line uses pseudo-CLV; the methodology page lays out exactly how we compute it.

This is the metric we'd want a third-party verifier (Bet-Analytix, SBC) to track if they audited us tomorrow. We publish it now because we'd rather earn trust through visible numbers than wait until verification ships.`,
    relatedTerms: ["expected-value", "value-betting", "odds-movement"],
    faqItems: [
      {
        q: "Why don't you lead with ROI like other sites?",
        a: "Because ROI on small samples is mostly luck. Sites that lead with ROI are either (a) lucky, (b) cherry-picking timeframes, or (c) honest but giving you variance-confounded noise. CLV is reproducible — anyone can compute it from the same data — and stable in fewer bets. We optimise for the honest metric.",
      },
      {
        q: "What's a good CLV target?",
        a: "Consistently +2-4% across 500+ settled bets is excellent. Above +5% over similar samples is the realm of professional bettors. Below +1% means you are roughly market-efficient — no edge.",
      },
      {
        q: "What is pseudo-CLV?",
        a: "Since we compare our pick price to the price at our last recorded snapshot before kickoff (not a true live closing line), we call it 'pseudo-CLV'. It's directionally correct but slightly noisier than exchange closing lines. Within ~1% of true CLV on liquid markets.",
      },
      {
        q: "Can CLV be faked?",
        a: "Yes, if a tracker only includes their best bets in the CLV calculation. OddsIntel logs every value bet the model identifies immediately at pick-time, before result is known, and never edits or removes rows. The full per-bet history is auditable on /performance.",
      },
    ],
  },
  {
    slug: "kelly-criterion",
    title: "Kelly Criterion",
    shortDef: "A formula for sizing bets to maximise long-run bankroll growth.",
    body: `The Kelly Criterion, developed by mathematician John Kelly in 1956, tells you exactly what percentage of your bankroll to stake on a bet with known edge.

**Formula:** Kelly fraction = (edge) / (odds − 1)

Where edge = (model probability − implied probability) and odds are in decimal format.

**Example:** If your model gives a 60% win probability and the odds are 2.00 (50% implied), the full Kelly stake is (0.10) / (1.00) = 10% of bankroll.

**Why use fractional Kelly?** Full Kelly is mathematically optimal but causes enormous swings. Most professionals use half-Kelly (5%) or quarter-Kelly (2.5%) to reduce variance. OddsIntel uses quarter-Kelly capped at 1% bankroll per bet.`,
    relatedTerms: ["expected-value", "bankroll-management", "value-betting"],
    faqItems: [
      {
        q: "Should I use full Kelly?",
        a: "Almost never. Full Kelly maximises long-run growth but tolerates drawdowns of 50–80%. Most bettors use quarter-Kelly or less.",
      },
    ],
  },
  {
    slug: "value-betting",
    title: "Value Betting",
    shortDef: "Consistently betting when you believe the true probability exceeds the bookmaker's implied probability.",
    body: `Value betting is the discipline of only placing bets where your estimated true probability is higher than the bookmaker's implied probability. It's the opposite of betting on favourites regardless of odds.

**A bet has value when:** Your probability > 1 / odds

**Example:** If you estimate Arsenal have a 65% chance to win and Bet365 offers 1.70 (implied 58.8%), you have a value bet with ~6.2% edge.

Value betting requires an edge — some informational or analytical advantage over the bookmaker's line. OddsIntel's model attempts to find this edge through Poisson goals modelling, ELO ratings, market structure analysis, and news/injury signals.

Value bets lose often (that's why bookmakers offer them), but positive EV bets produce profit over large samples.`,
    relatedTerms: ["expected-value", "kelly-criterion", "closing-line-value"],
    faqItems: [
      {
        q: "What win rate do I need for value betting to be profitable?",
        a: "It depends on odds. At odds of 2.00 you need >50%. At 1.50 you need >66.7%. The key is that your actual win rate exceeds the break-even rate implied by the odds.",
      },
    ],
  },
  {
    slug: "poisson-distribution",
    title: "Poisson Distribution",
    shortDef: "A statistical model for predicting the number of goals in a football match.",
    body: `The Poisson distribution models the probability of a given number of independent events occurring in a fixed interval. In football, goals are approximately Poisson-distributed — each goal is roughly independent and rare.

**How OddsIntel uses it:**
1. Estimate expected goals (xG) for each team using historical form, ELO, H2H, and league-specific goal rates
2. Apply the Poisson probability mass function to each possible scoreline
3. Sum scoreline probabilities to get P(home win), P(draw), P(away win), P(over 2.5), etc.

**Dixon-Coles correction:** Standard Poisson slightly underestimates 0-0 and 1-0/0-1 draws. Our model applies the Dixon-Coles (1997) correction to adjust low-score probabilities.

The Poisson model is blended 50/50 with an XGBoost model trained on 96,000 historical matches.`,
    relatedTerms: ["expected-goals", "value-betting", "btts"],
    faqItems: [
      {
        q: "Is Poisson modelling accurate?",
        a: "It's a strong baseline. Poisson correctly assumes goals are rare and roughly independent, but misses correlations between goals (e.g. a late goal changes game state). The Dixon-Coles correction and XGBoost blend partially address this.",
      },
    ],
  },
  {
    slug: "expected-goals",
    title: "Expected Goals (xG)",
    shortDef: "A measure of shot quality: how many goals a team 'should' have scored based on their chances.",
    body: `Expected Goals (xG) assigns each shot a probability of being scored based on factors like distance, angle, assist type, and game situation. Summing these probabilities gives a team's xG for a match.

**Why xG matters for betting:** Goals are highly variable — a team can win 3-0 by converting weak shots while the other team has 2.5 xG. xG reveals the "true" performance beneath the scoreline.

Teams that consistently over or underperform their xG are likely due to revert to the mean — an exploitable signal.

**OddsIntel uses xG in two ways:**
1. **Pre-match:** Expected goals per team (from form and stats) feed into the Poisson model
2. **In-play:** Live xG accumulation indicates whether the current score reflects real dominance or randomness

xG data comes from post-match statistics provided by API-Football.`,
    relatedTerms: ["poisson-distribution", "value-betting"],
    faqItems: [
      {
        q: "What's a good xG for a home team?",
        a: "Average is roughly 1.4–1.6 xG at home in most European leagues. Above 2.0 xG against suggests significant home dominance.",
      },
    ],
  },
  {
    slug: "btts",
    title: "Both Teams to Score (BTTS)",
    shortDef: "A bet on whether both teams will score at least one goal each.",
    body: `Both Teams to Score (BTTS) is a popular side market betting on whether both sides will net at least once. It's independent of the final score — a 3-1 win counts the same as a 1-1 draw.

**BTTS Yes** wins if the score is, e.g., 1-1, 2-1, 1-2, 2-2, 3-1 etc.
**BTTS No** wins if either team keeps a clean sheet — 1-0, 2-0, 0-0, 0-1, etc.

**How OddsIntel models it:** The Poisson model computes a joint probability distribution across all possible scorelines, then sums the probabilities of scorelines where both teams score at least one goal.

BTTS rates vary significantly by league. The Bundesliga (high-scoring, strong attacks) sees BTTS Yes ~60% of the time. Defensive leagues (e.g. Serie A in certain eras) can be below 50%.`,
    relatedTerms: ["poisson-distribution", "expected-goals", "over-under"],
    faqItems: [
      {
        q: "Is BTTS a good bet?",
        a: "Like any market, BTTS is good when your probability estimate exceeds the implied probability from the odds. Factors that increase BTTS probability: both teams have strong attacks, poor defences, high stakes with incentives to attack.",
      },
    ],
  },
  {
    slug: "over-under",
    title: "Over/Under (Totals)",
    shortDef: "A bet on whether the total goals in a match will be above or below a line (most commonly 2.5).",
    body: `Over/Under betting (also called Totals) is a market on the total number of goals in a match. The most common line is 2.5 goals — "Over 2.5" wins if there are 3 or more goals, "Under 2.5" wins if there are 0, 1, or 2 goals.

**Common lines:** 1.5, 2.5, 3.5 goals (the .5 eliminates push outcomes)

**How OddsIntel models it:** The Poisson model sums all scoreline probabilities above/below the line. OddsIntel tracks O/U 1.5, O/U 2.5, and O/U 3.5. XGBoost provides additional signal for the O/U 2.5 line.

**Factors that shift O/U probability:**
- Team attacking/defensive strength (ELO-adjusted)
- Playing style (high press vs. low block)
- Motivation (dead rubber matches tend to be low-scoring)
- Weather (wind reduces goal probability)`,
    relatedTerms: ["btts", "poisson-distribution", "expected-goals"],
    faqItems: [
      {
        q: "What's the most efficient totals market?",
        a: "O/U 2.5 is the most liquid and heavily priced. O/U 1.5 and 3.5 have less liquidity and can offer more value for bettors with a modelling edge.",
      },
    ],
  },
  {
    slug: "odds-movement",
    title: "Odds Movement",
    shortDef: "How bookmaker odds change from opening to closing, revealing market opinion shifts.",
    body: `Odds movement (also called line movement) tracks how prices change between when they first appear and kickoff. Movement is driven by betting volume — heavy money on one side pushes those odds down (and the other side up).

**Why it matters:**
- **Sharp money:** When odds shorten sharply, professionals ("sharps") are betting that outcome. Sharp moves are a signal of genuine edge.
- **Drift:** Odds drifting out (lengthening) can indicate public backing the other side or late injury news suppressing bets.

**OddsIntel metrics:**
- **Drift %:** (current implied prob − opening implied prob) / opening implied prob
- **Steam move:** >5% drift within 30 minutes — a strong sharp signal
- **Velocity:** Rate of odds change over time

Odds movement is one of OddsIntel's 20+ signals and feeds into the alignment score.`,
    relatedTerms: ["closing-line-value", "value-betting", "bookmaker-margin"],
    faqItems: [
      {
        q: "Should I always follow line movement?",
        a: "Not blindly. Sharp moves are informative but the public also moves lines. Look for moves that go against public sentiment — those are more likely to be sharp.",
      },
    ],
  },
  {
    slug: "bookmaker-margin",
    title: "Bookmaker Margin (Vig / Juice)",
    shortDef: "The built-in profit the bookmaker takes on every market, embedded in the odds.",
    body: `The bookmaker margin (also called vig, vigorish, or juice) is the built-in fee charged by bookmakers on every bet. It's embedded in the odds by making the sum of implied probabilities exceed 100%.

**Example (1x2 market):**
- Home: 2.00 → implied 50%
- Draw: 3.40 → implied 29.4%
- Away: 3.80 → implied 26.3%
- Sum: **105.7%** → 5.7% margin

The true probabilities sum to 100%, but you're paying 5.7% more. This means the break-even win rate is higher than the implied probability suggests.

**Removing the margin:** To get the fair implied probability, divide each implied probability by the sum: 50% / 1.057 = 47.3%.

Soft bookmakers (Bet365, William Hill) run 5–8% margins. Sharp books (Pinnacle, Asian books) run 2–3%, making them more accurate price setters. OddsIntel uses Pinnacle's line as a calibration benchmark.`,
    relatedTerms: ["value-betting", "expected-value", "odds-movement"],
    faqItems: [
      {
        q: "How do I beat the margin?",
        a: "You need a modelling edge that consistently identifies outcomes where the true probability exceeds the de-vigged implied probability. Even a 3% consistent edge beats a 5% margin over large samples.",
      },
    ],
  },
  {
    slug: "elo-rating",
    title: "ELO Rating",
    shortDef: "A dynamic team strength rating that updates after every match based on results.",
    body: `ELO is a rating system originally developed for chess that has been adapted for football. Each team has a numerical ELO score that goes up after a win and down after a loss, with the magnitude proportional to how unexpected the result was.

**Key properties:**
- **Dynamic:** Updates after every match
- **Self-correcting:** Consistent underperformance pushes ratings down
- **Head-to-head insight:** ELO difference between teams is a strong predictor of match outcome

**OddsIntel's ELO implementation:**
- Initialised from historical results going back to 2015
- Updated after every settled match
- Uses league-specific K-factors (top leagues = more weight per match)
- ELO difference is one of the primary features in the Poisson model

An ELO gap of 100 points corresponds to roughly 64% probability for the stronger team in a neutral-venue match.`,
    relatedTerms: ["poisson-distribution", "value-betting"],
    faqItems: [
      {
        q: "Does ELO account for home advantage?",
        a: "In OddsIntel's model, yes. The home team receives a bonus of approximately 65 ELO points when computing match outcome probability at a home venue.",
      },
    ],
  },
  {
    slug: "bankroll-management",
    title: "Bankroll Management",
    shortDef: "The discipline of sizing bets to survive variance and grow wealth long-term.",
    body: `Bankroll management is how you size bets to avoid ruin while growing your capital. Even with a genuine edge, poor bankroll management can lead to going broke before the edge manifests.

**Core principles:**
1. **Never bet more than you can afford to lose** — treat your bankroll as risk capital
2. **Fixed-fraction staking** — bet a consistent percentage of your bankroll rather than fixed amounts
3. **Kelly sizing** — mathematical optimum for long-run growth (most use quarter-Kelly)
4. **Diversification** — spread across multiple independent bets, not one large stake
5. **Drawdown limits** — if you lose 30% of bankroll, re-evaluate your strategy

**OddsIntel's model parameters:**
- Quarter-Kelly sizing (0.25 × Kelly fraction)
- Maximum 1% of bankroll per bet
- 50% stake reduction after 3 bets in the same league (correlation risk)

Good bankroll management is the difference between professional bettors who last decades and punters who blow up within a season.`,
    relatedTerms: ["kelly-criterion", "expected-value", "value-betting"],
    faqItems: [
      {
        q: "What bankroll should I start with?",
        a: "Whatever you can afford to lose entirely. A practical starting point is 50–100 units where one unit is 1% of bankroll. This gives enough runway to see edge materialize over 500+ bets.",
      },
    ],
  },
];

export function getTermBySlug(slug: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((t) => t.slug === slug);
}

export const ALL_SLUGS = GLOSSARY_TERMS.map((t) => t.slug);
