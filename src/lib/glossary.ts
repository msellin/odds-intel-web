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
    title: "Closing Line Value (CLV)",
    shortDef: "Whether your odds were better than the market's final price before kickoff.",
    body: `Closing Line Value (CLV) measures whether the odds you took were better than the closing odds — the price the market settled at just before the match started.

**Why it matters:** Sharp money pushes odds toward their true value as kickoff approaches. If you consistently beat the closing line, it's evidence you found genuine edges before the market corrected them. It's the fastest way to validate a betting system — results need hundreds of bets to be statistically significant, but CLV is measurable within weeks.

**Formula:** CLV = (1 / your_odds) / (1 / closing_odds) − 1

A CLV of +3% means your implied probability was 3 percentage points lower than the closing implied probability — you got better odds than the market's final consensus.

The OddsIntel track record shows pseudo-CLV on every settled prediction.`,
    relatedTerms: ["expected-value", "value-betting", "odds-movement"],
    faqItems: [
      {
        q: "What's a good CLV?",
        a: "Consistently beating the closing line by 2–4% is considered excellent. The best professional bettors average +3–5% CLV.",
      },
      {
        q: "What is pseudo-CLV?",
        a: "Since we compare our morning pick price to the price at our last recorded snapshot before kickoff (not a true live closing line), we call it 'pseudo-CLV'. It's directionally correct but slightly noisier than exchange closing lines.",
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
