/**
 * GROWTH-VS-PAGES (2026-06-05) — competitor comparison data for /vs/[slug] SEO pages.
 *
 * Each entry powers a long-form comparison page (Linear-vs-Jira pattern). Pages
 * rank for high-intent "[competitor] alternative" / "[competitor] vs" Google
 * searches — visitors are already shopping for our category.
 *
 * **Editorial rules baked into the data:**
 *   - `whereTheyWin` is required and must be non-empty. Pages that say "we win
 *     on everything" lose credibility instantly. Honest gaps build trust.
 *   - `oddsIntelWins` should be concrete (numbers, named features), not vague
 *     ("better UX" is banned — say WHY).
 *   - `verdict` is the operator's pick + reasoning. Operator says exactly when
 *     someone should NOT pick OddsIntel. The audience self-selects.
 *
 * Sources for each row: the per-competitor research log in PRIORITY_QUEUE.md
 * Phase 4 + the competitor matrix on the landing.
 */

/**
 * Cell value. Standard glyphs render in the matching colour; any other
 * string renders as plain text (used for rich annotations like "~ (13 leagues)"
 * where we want to embed a number alongside the symbol).
 */
export type VsCell = "✅" | "⏳" | "❌" | "~" | string;

export interface VsFeature {
  label: string;
  competitor: VsCell;
  oddsintel: VsCell;
}

export interface VsCompetitor {
  /** URL slug — /vs/[slug] */
  slug: string;
  /** Display name as it appears in headings */
  name: string;
  /** Tier category from the landing matrix */
  tier: string;
  /** Their canonical site (linked from the page in the Linear/Jira pattern) */
  homeUrl: string;
  /** One-line summary of what they are */
  oneliner: string;
  /** Traffic snapshot (approximate, from Similarweb research 2026-06-04) */
  traffic: string;
  /** Pricing summary */
  pricing: string;
  /** 3-5 things they genuinely do better than us (honesty is the wedge) */
  whereTheyWin: string[];
  /** 3-5 things we do that they don't / can't (the conversion argument) */
  oddsIntelWins: string[];
  /** Feature rows — keep to ~8-10 most-relevant for this specific competitor */
  matrix: VsFeature[];
  /** Operator verdict — when each side is the right pick */
  verdict: {
    pickThem: string;
    pickUs: string;
  };
  /** 2-3 FAQ entries specific to this comparison */
  faq: Array<{ q: string; a: string }>;
}

// ──────────────────────────────────────────────────────────────────────────────

export const VS_COMPETITORS: VsCompetitor[] = [
  {
    slug: "winnerodds",
    name: "WinnerOdds",
    tier: "Value-bet engine",
    homeUrl: "https://winnerodds.com",
    oneliner:
      "Long-running value-bet tipster service for football and tennis, SBC-endorsed since 2016.",
    traffic: "~17K visits/month (Similarweb, 2026-06)",
    pricing: "€59/mo (Football only) · €295/6mo",
    whereTheyWin: [
      "**Third-party verification.** SBC (Smart Betting Club) has recommended them for years; Bet-Analytix tracks every pick. We're still working on our verification (gated on OUT-OF-BETA-CUTOFF).",
      "**Track record length.** Public results since 2016 with ~5.61% all-time ROI across 16K+ bets. Our paper chain only goes back to April 2026 — time is a moat we don't have yet.",
      "**Multi-bookmaker depth.** 80+ books in their odds scanner vs our 13. More books = more detectable edges; this is a real product gap.",
      "**Tennis coverage.** They cover tennis with the same methodology. We're football-only by design.",
      "**Named expert endorsements.** Joseph Buchdahl (ex-Pinnacle quant) and Pete Ling (SBC) have publicly backed them. We have no comparable named backing yet.",
    ],
    oddsIntelWins: [
      "**Price.** €4.99/mo Pro and €14.99/mo Elite vs their €59/mo. We're priced for adoption while we build the public CLV chain.",
      "**280+ leagues** vs WinnerOdds' ~10 (top European football only). If you bet outside the major European leagues, we cover it.",
      "**Match-detail intelligence.** Lineups, injuries, live xG, odds drift, bot consensus — they're picks-only with no match-context surface.",
      "**Telegram-native delivery.** Pre-kickoff alerts straight to your phone. They publish via web/app dashboard — no live alert channel.",
      "**Per-bet AI explanation (Elite).** LLM explains why each pick was made. Helps you build betting intuition over time.",
    ],
    matrix: [
      { label: "Verified third-party track record (SBC / Bet-Analytix)", competitor: "✅", oddsintel: "⏳" },
      { label: "Years of public history", competitor: "✅", oddsintel: "❌" },
      { label: "Multi-bookmaker depth (50+)", competitor: "✅", oddsintel: "⏳" },
      { label: "Tennis coverage", competitor: "✅", oddsintel: "❌" },
      { label: "280+ football leagues", competitor: "❌", oddsintel: "✅" },
      { label: "Match-detail intelligence (lineups / injuries / live xG)", competitor: "❌", oddsintel: "✅" },
      { label: "Telegram delivery", competitor: "❌", oddsintel: "✅" },
      { label: "Per-bet AI explanation", competitor: "❌", oddsintel: "✅" },
      { label: "CLV-tracked publicly", competitor: "✅", oddsintel: "✅" },
      { label: "Free tier", competitor: "❌", oddsintel: "✅" },
    ],
    verdict: {
      pickThem:
        "You want a multi-year verified track record before spending a euro, you bet primarily on top-5 European leagues + tennis, and the €59/mo price is comfortable. Their SBC endorsement is a real credibility advantage for sceptical buyers.",
      pickUs:
        "You want broad league coverage (lower-division football, internationals, the long tail), you'd rather see match context and value-bet reasoning together in one place, you want picks delivered to Telegram before kickoff, and you'd rather pay €4.99-14.99/mo while we earn the same kind of verified track record over the next year.",
    },
    faq: [
      {
        q: "Why is OddsIntel cheaper than WinnerOdds?",
        a: "Because we're earlier-stage. Our public CLV chain is 6 weeks old, not 9 years. We can charge €4.99-14.99/mo for adoption now; once we have a multi-year SBC- or Bet-Analytix-verified track record, that becomes a real price-anchoring asset and we'll raise.",
      },
      {
        q: "Will OddsIntel ever get SBC-verified like WinnerOdds?",
        a: "It's queued (GROWTH-SBC-SUBMISSION in our public task tracker). We've intentionally delayed submitting until the v2 model cohort stabilises, because the first verified number SBC publishes becomes a permanent public anchor. We'd rather wait and publish a verified honest number than rush an unverified flattering one.",
      },
      {
        q: "Can I use both?",
        a: "Yes, and a lot of value-bettors do. WinnerOdds for picks-only on top European football, OddsIntel for broader league coverage + match context + Telegram delivery. Different products solving different jobs.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────

  {
    slug: "inplayguru",
    name: "InPlayGuru",
    tier: "In-play scanner",
    homeUrl: "https://inplayguru.com",
    oneliner:
      "Real-time in-play soccer scanner with Telegram alerts; 30K+ paying users and strong Eastern European traction.",
    traffic: "~1M visits/month (Similarweb, 2026-06)",
    pricing: "Free tier · Pro (price hidden until checkout) · 50% off annual",
    whereTheyWin: [
      "**Real-time in-play strategy alerts at scale.** Their entire product is live-match scanning + Telegram triggers. They've optimised the loop for years.",
      "**Eastern European audience.** UA 24%, DE 17%, HU 15% of their traffic — markets we don't currently serve.",
      "**User-defined strategy builder.** Users can compose their own trigger conditions (e.g., \"alert when team is 0-1 in min 60 with 15+ shots\"). Personalisation engine we don't have.",
      "**Audience scale.** 30K+ paying users — they have community gravity. We have ~35 signups.",
      "**Legal-as-feature framing.** They explicitly position as a \"statistical analysis platform\" not a betting product — clever regulatory shielding for global operation.",
    ],
    oddsIntelWins: [
      "**Pre-match value bets.** Our core product is pre-kickoff value detection — fundamentally different game than chasing the live line.",
      "**CLV-tracked picks.** Every value bet logged before kickoff and scored against the closing line. In-play CLV is structurally noisier; pre-match is cleaner.",
      "**Per-bookmaker odds comparison.** We compare 13 books per pick. They don't surface multi-book comparison.",
      "**Honest methodology page.** Open description of the Poisson + XGBoost ensemble + signals stack. They keep their strategy builder open but the underlying model is a black box.",
      "**Transparent track record.** Every paper bet visible at /performance with per-strategy ROI and CLV. They publish strategy stats, not per-bet history.",
    ],
    matrix: [
      { label: "Real-time in-play scanner", competitor: "✅", oddsintel: "✅" },
      { label: "User-defined strategy builder", competitor: "✅", oddsintel: "❌" },
      { label: "Eastern European localisation", competitor: "✅", oddsintel: "⏳" },
      { label: "Pre-match AI value-bet detection", competitor: "⏳", oddsintel: "✅" },
      { label: "Multi-bookmaker odds comparison", competitor: "❌", oddsintel: "~" },
      { label: "CLV-tracked picks (publicly)", competitor: "❌", oddsintel: "✅" },
      { label: "Match-detail intelligence (lineups, injuries, xG)", competitor: "⏳", oddsintel: "✅" },
      { label: "Telegram alerts", competitor: "✅", oddsintel: "✅" },
      { label: "Open methodology page", competitor: "❌", oddsintel: "✅" },
      { label: "Free tier", competitor: "✅", oddsintel: "✅" },
    ],
    verdict: {
      pickThem:
        "You bet primarily in-play (during the match, reacting to live state), you want to compose your own trigger strategies, or you're in Eastern Europe and value the localised audience and content.",
      pickUs:
        "You bet primarily pre-match (before kickoff, on AI-detected mispricing), you want CLV-tracked value with public per-bet history, you want match context (lineups + injuries + xG) alongside the pick, and you value an open methodology over a closed strategy engine.",
    },
    faq: [
      {
        q: "Do you have in-play alerts too?",
        a: "Yes — our InplayBot ensemble runs 17 in-play strategies that send Telegram alerts to Pro+ users when an edge is detected. It's not our primary product surface, but the infrastructure is live. See /live (coming soon).",
      },
      {
        q: "Why is OddsIntel pre-match-focused?",
        a: "Pre-match CLV is cleaner than in-play CLV — the closing line is well-defined pre-kickoff, less so during a constantly re-pricing live market. Our edge is in honest measurement, so we lead with the side of the market where measurement is cleanest.",
      },
      {
        q: "Can I use both?",
        a: "Many serious bettors do. InPlayGuru for in-play strategy triggers, OddsIntel for pre-kickoff value bets + match intelligence. Different jobs, complementary stacks.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────

  {
    slug: "deepbetting",
    name: "DeepBetting",
    tier: "AI prediction site",
    homeUrl: "https://deepbetting.io",
    oneliner:
      "French AI sports prediction startup covering 15+ leagues across football, NBA, NFL, NHL, and MLB.",
    traffic: "~20K visits/month (Similarweb, 2026-06)",
    pricing: "Free · Football €34.99/mo · US Sports €34.99/mo · Ultimate €59.99/mo",
    whereTheyWin: [
      "**Multi-sport coverage.** Football + NBA + NFL + NHL + MLB. We're football-only.",
      "**Verified track record via Bet-Analytix.** Every pick timestamped on an outside platform — same kind of third-party proof we're still working toward.",
      "**Multi-language audience.** Heavy traffic from France + Nigeria — they've localised content beyond English.",
      "**Team credentials surfaced.** They publicly list backgrounds (data science / healthcare analytics / aerospace IT). Real social proof.",
    ],
    oddsIntelWins: [
      "**Their verification reveals a negative ROI.** DeepBetting's Bet-Analytix-tracked record is **-3.7% ROI**, and our scrape of their visible free-pick history shows **-0.99% ROI** at 63.0% hit rate on 1.62 avg odds over 92 settled bets (2026-05-23 → 2026-06-04). Verified ≠ profitable. Our paper-trading chain is +€340 in May 2026 with worst drawdown -€398, transparently published.",
      "**280+ football leagues vs their ~15.** Order-of-magnitude broader football coverage. If you bet outside the top European leagues, we have you.",
      "**CLV-first metric framing.** They publish results; we publish CLV — the *honest* metric that proves edge in weeks, not years. ROI alone (which they emphasise) is variance-confounded.",
      "**Telegram delivery.** Pre-kickoff alerts to your phone. They publish via web; no live alert channel.",
      "**Per-bet AI explanation.** LLM explains why each Elite pick was made. They give you the pick; we give you the why.",
      "**Match-detail intelligence.** Lineups, injuries, live xG, multi-bookmaker drift. They're picks-only.",
      "**Honest drawdown disclosure.** We publish our worst drawdown (−€398 over 9 days in May 2026); they don't surface drawdowns prominently.",
    ],
    matrix: [
      { label: "Football coverage", competitor: "~ (13 leagues)", oddsintel: "✅ (280+)" },
      { label: "US sports (NBA / NFL / NHL / MLB)", competitor: "✅", oddsintel: "❌" },
      { label: "Bet-Analytix verified", competitor: "✅", oddsintel: "⏳" },
      { label: "CLV-first metric", competitor: "❌", oddsintel: "✅" },
      { label: "Telegram delivery", competitor: "❌", oddsintel: "✅" },
      { label: "Per-bet AI explanation", competitor: "❌", oddsintel: "✅" },
      { label: "Match-detail intelligence", competitor: "❌", oddsintel: "✅" },
      { label: "Honest drawdown disclosure", competitor: "~", oddsintel: "✅" },
      { label: "Open methodology page", competitor: "~", oddsintel: "✅" },
      { label: "Free tier", competitor: "✅", oddsintel: "✅" },
    ],
    verdict: {
      pickThem:
        "You bet across multiple sports (NBA + NFL + NHL + MLB alongside football), you want a verified Bet-Analytix track record now (their -3.7% ROI is at least independently confirmed), or you specifically prefer French / multi-language interfaces.",
      pickUs:
        "You bet primarily on football (especially outside top-5 European leagues), you want CLV — not just ROI — published openly, you want picks delivered to Telegram before kickoff, and you want match context alongside the pick. €4.99-14.99/mo vs their €35-60/mo is also a meaningful difference.",
    },
    faq: [
      {
        q: "How is OddsIntel different from DeepBetting?",
        a: "Three big things: (1) we cover 280+ football leagues vs their 15; (2) we publish CLV (closing line value) — the metric that actually proves edge in weeks, not just ROI that takes years and is variance-confounded; (3) we deliver value bets to your Telegram pre-kickoff so you can act before line movement.",
      },
      {
        q: "Should I use OddsIntel if I bet NBA / NFL?",
        a: "Not yet. We're football-only by design — we want to be the deepest football product before broadening. Multi-sport is a future roadmap item.",
      },
      {
        q: "Both claim 'no human bias'. What's the actual difference?",
        a: "That phrase is now a commodity claim — every AI prediction site says it. What matters is what each side actually publishes. DeepBetting publishes hit-rate + ROI by league. OddsIntel publishes CLV per pick + open methodology + per-strategy track record at /performance. CLV is the honest scoreboard; if you don't see CLV figures, the 'no human bias' claim is doing positioning work, not measurement work.",
      },
      {
        q: "Is DeepBetting actually profitable?",
        a: "Their own Bet-Analytix verification page shows a -3.7% ROI. We also scraped the visible free-pick history and computed -0.99% ROI on 92 settled bets at 63% hit rate / 1.62 avg odds. They're a coin-flip product priced at €35-60/mo. Verified track records are valuable for credibility — but only when the verified number is positive. Right now theirs isn't, and that's the load-bearing point: most paid prediction sites at this price point don't actually beat the closing line, which is why CLV (does the model beat the line?) matters more than ROI (which sample of luck did they post?).",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────

  {
    slug: "soccer-rating",
    name: "soccer-rating.com",
    tier: "AI prediction site",
    homeUrl: "https://www.soccer-rating.com",
    oneliner:
      "Football prediction site with dual 'Value Index' + 'Confidence Index' scoring across major leagues.",
    traffic: "Small — exact figure unavailable in Similarweb research",
    pricing: "Free tier + paid VIP tier (price not transparent on landing)",
    whereTheyWin: [
      "**Dual scoring system.** Their 'Value Index' (0-100%) and 'Confidence Index' (0-100%) as separate scores is actually clever pedagogy — explicitly separates 'will it happen' from 'is the price right'. Worth borrowing.",
      "**Free predictions for every fixture.** Volume of free content drives SEO traffic on long-tail '[team] vs [team] prediction' searches.",
    ],
    oddsIntelWins: [
      "**Real CLV tracking.** They claim '104% ROI' but no verified closing-line-value publicly published per pick. ROI claims on betting tipster sites are nearly always cherry-picked or variance-driven — CLV is the honest scoreboard.",
      "**Open methodology.** Their model is opaque. Ours is described in detail at /methodology — Poisson + XGBoost ensemble + named signals.",
      "**280+ leagues vs their narrower coverage.** We index the long tail.",
      "**Per-bet AI explanation.** LLM-generated explanation for each Elite pick.",
      "**Honest drawdown disclosure.** We publish our worst drawdown publicly; tipster sites that hide drawdowns are either lucky-sampled or selectively reporting.",
      "**Multi-bookmaker odds comparison + Telegram delivery + match-detail intelligence.** They're a single-stat-per-fixture site; we're an integrated platform.",
    ],
    matrix: [
      { label: "Dual Value / Confidence score", competitor: "✅", oddsintel: "⏳" },
      { label: "Free predictions for every fixture", competitor: "✅", oddsintel: "~" },
      { label: "Published per-pick CLV", competitor: "❌", oddsintel: "✅" },
      { label: "Open methodology page", competitor: "❌", oddsintel: "✅" },
      { label: "Honest drawdown disclosure", competitor: "❌", oddsintel: "✅" },
      { label: "Match-detail intelligence", competitor: "❌", oddsintel: "✅" },
      { label: "Multi-bookmaker odds comparison", competitor: "❌", oddsintel: "~" },
      { label: "Telegram delivery", competitor: "❌", oddsintel: "✅" },
      { label: "Free tier", competitor: "✅", oddsintel: "✅" },
    ],
    verdict: {
      pickThem:
        "You want a single, opinionated 'Value Index + Confidence Index' read on every fixture and you don't need any of the supporting infrastructure (CLV tracking, multi-book, lineups, Telegram).",
      pickUs:
        "You take betting seriously enough to care that the model's claimed accuracy is actually proven via CLV, that drawdowns are disclosed honestly, and that you can see *why* the model picked what it picked. Integrated platform vs single-stat site.",
    },
    faq: [
      {
        q: "soccer-rating.com claims 104% ROI. Is that real?",
        a: "Without a CLV figure published alongside, ROI claims on tipster sites are almost always either cherry-picked timeframes, narrowly-bucketed strategy slices, or variance-driven luck that hasn't reverted yet. A model with a real +3% edge can show +100% ROI over a small sample by chance. The only way to detect real edge is CLV — does the model consistently beat the closing line? — and that's the metric we lead with.",
      },
      {
        q: "Will OddsIntel add a 'Confidence' display like theirs?",
        a: "Yes — their dual-score idea (separate 'will it happen' confidence from 'is it priced right' value) is actually clever pedagogy and it's on our roadmap (referenced in our internal accuracy-page task).",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────

  {
    slug: "soccerbot-ai",
    name: "soccerbot.ai",
    tier: "Bet-builder AI",
    homeUrl: "https://www.soccerbot.ai",
    oneliner:
      "AI bet-builder and accumulator tool for football with bet-builder-focused workflow.",
    traffic: "Small — exact figure unavailable",
    pricing: "Free tier + 'SoccerBot Coins' paid model (specific pricing not public)",
    whereTheyWin: [
      "**Bet-builder + accumulator focus.** Some bettors want a 'compose a parlay from 5 markets' workflow specifically. They've built that interface; we haven't.",
      "**Mobile-app distribution.** They have an iOS / Android app. We're web + Telegram only.",
      "**Community-driven sharing.** Users share built slips. We don't have a community sharing surface.",
    ],
    oddsIntelWins: [
      "**Single-bet value detection over bet-builder gimmicks.** Bet-builders are systematically worse EV than individual value bets — the multiplication of margins compounds against you. We don't build acca workflows because acca workflows are how recreational money pays for sharp money.",
      "**CLV-tracked picks.** They emphasise 'bet builder with confidence scores'; we emphasise 'picks that beat the closing line'. The former is engagement; the latter is edge.",
      "**Open methodology + honest drawdown.** We publish how the model works and what its worst-case looks like. They market 'AI confidence' without auditable methodology.",
      "**Multi-bookmaker odds + match intelligence + Telegram.** Same integrated-platform advantage.",
    ],
    matrix: [
      { label: "Bet-builder / accumulator workflow", competitor: "✅", oddsintel: "❌" },
      { label: "Native mobile app", competitor: "✅", oddsintel: "⏳" },
      { label: "Community slip sharing", competitor: "✅", oddsintel: "~" },
      { label: "Single-bet AI value detection", competitor: "~", oddsintel: "✅" },
      { label: "Published per-pick CLV", competitor: "❌", oddsintel: "✅" },
      { label: "Open methodology", competitor: "❌", oddsintel: "✅" },
      { label: "Honest drawdown disclosure", competitor: "❌", oddsintel: "✅" },
      { label: "Match-detail intelligence", competitor: "~", oddsintel: "✅" },
      { label: "Multi-bookmaker odds comparison", competitor: "~", oddsintel: "~" },
      { label: "Telegram delivery", competitor: "❌", oddsintel: "✅" },
    ],
    verdict: {
      pickThem:
        "You enjoy building accumulators and parlays for entertainment value rather than +EV optimisation. Their tooling for that specific workflow is more developed than ours, and we don't plan to compete there.",
      pickUs:
        "You want to actually beat the bookmaker over time. Bet-builders are how books extract recreational money — every market you stack into a parlay multiplies the bookie's margin against you. Single +EV picks with CLV tracking is the only honest path to long-term edge.",
    },
    faq: [
      {
        q: "Why doesn't OddsIntel have a bet-builder?",
        a: "Because bet-builders are systematically worse EV than single bets. When you combine 5 markets at 1.5 odds each into a 7.59 acca, the bookmaker's margin on each market gets multiplied — typical bookie acca margin is 8-15% vs ~3-5% on a single market. We could build this; we don't, because it would contradict the +EV positioning we lead with.",
      },
      {
        q: "I just want a fun parlay tool. Is OddsIntel right for me?",
        a: "Probably not — soccerbot.ai is better at that specific workflow. We're built for bettors who want to maximise long-term edge, which usually means single picks with measurable CLV, not multi-leg parlays.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────

  {
    slug: "forebet",
    name: "Forebet",
    tier: "Free prediction site",
    homeUrl: "https://www.forebet.com",
    oneliner:
      "Ad-supported football prediction publisher with 700+ league coverage and 13.5M monthly visits, operating since 2009.",
    traffic: "~13.5M visits/month (Similarweb Mar 2026, -13% MoM)",
    pricing: "Free (display ads + bookmaker affiliate links)",
    whereTheyWin: [
      "**SEO dominance.** 16 years of programmatic prediction pages indexed since 2009. They own the long tail of \"[Team A] vs [Team B] prediction\" Google queries. We can't catch this organically in 1-2 years.",
      "**Free + zero friction.** No signup, no paywall, no email. The lowest possible threshold for casual readers.",
      "**League breadth.** 700-850 football leagues vs our 280+. They've solved scraping at scale.",
      "**Brand recognition.** \"Forebet predictions\" is a Google search term in its own right.",
      "**Free Kelly Criterion value-bet section.** Lower-quality version of what we sell — but free is free.",
    ],
    oddsIntelWins: [
      "**Multi-bookmaker live odds.** We track 13 bookmakers in real time and identify pricing inefficiencies. Forebet displays generic odds against their own model probabilities — much cruder value-bet detection.",
      "**CLV-tracked picks.** We measure closing line value on every pick; Forebet shows aggregate accuracy %. Accuracy is the wrong metric — 68% accurate at 1.40 odds loses money.",
      "**Honest drawdown disclosure.** We publish our worst drawdown (−€398 over 9 days in May 2026). Forebet shows aggregate accuracy with no variance or risk surface.",
      "**Telegram pre-kickoff delivery.** They're a website you visit; we push to your phone before the line moves.",
      "**Match-detail intelligence.** Live xG + lineups + injuries + per-bookmaker odds drift alongside the pick. Forebet is prematch-only with one set of generic odds.",
      "**Per-bet AI explanation (Elite tier).** They show probabilities; we explain why each pick was made.",
    ],
    matrix: [
      { label: "700+ football leagues", competitor: "✅", oddsintel: "~ (280+)" },
      { label: "Free, no signup", competitor: "✅", oddsintel: "✅ (Free tier)" },
      { label: "Multi-bookmaker odds comparison", competitor: "❌", oddsintel: "~ (13 books)" },
      { label: "Per-pick CLV tracked", competitor: "❌", oddsintel: "✅" },
      { label: "Honest drawdown disclosure", competitor: "❌", oddsintel: "✅" },
      { label: "Match-detail intelligence (xG / lineups / injuries)", competitor: "❌", oddsintel: "✅" },
      { label: "Telegram pre-kickoff alerts", competitor: "❌", oddsintel: "✅" },
      { label: "Per-bet AI explanation", competitor: "❌", oddsintel: "✅" },
      { label: "Open methodology page", competitor: "❌", oddsintel: "✅" },
      { label: "In-play / live xG", competitor: "❌", oddsintel: "✅" },
    ],
    verdict: {
      pickThem:
        "You want free, no-signup predictions for every fixture, you treat predictions as a casual reference (not as actionable bets you'd actually stake on), or you bet in markets we don't cover (e.g., lower-division regional football). Forebet's breadth and zero-friction price are unmatched for that use case.",
      pickUs:
        "You want to actually beat the bookmaker over time, you care that predictions are validated by CLV (not just aggregate hit-rate), and you want context (lineups, injuries, odds drift) alongside the pick. Forebet is a reference tool; OddsIntel is a decision tool.",
    },
    faq: [
      {
        q: "Is Forebet accurate?",
        a: "They claim 52-58% accuracy on top European leagues. The catch: accuracy ≠ profitability. At 1.50 average odds you need 67% accuracy just to break even after the bookmaker's margin. Forebet doesn't publish ROI or CLV — the metrics that would actually tell you whether their predictions make money. The \"accuracy\" headline is doing positioning work, not measurement work.",
      },
      {
        q: "Why pay when Forebet is free?",
        a: "Free is the right price for what Forebet is — a reference publication with unverified accuracy claims, monetised via ads and bookmaker affiliate clicks. Our paid tier exists because we measure CLV per pick, deliver alerts before line movement, explain why each pick was made, and surface match context (lineups + xG + odds drift) alongside the pick. Different products doing different jobs.",
      },
      {
        q: "Will Forebet's free tier kill OddsIntel's pricing?",
        a: "No, because Forebet doesn't sell what we sell. They're an SEO + affiliate funnel: their incentive is to drive bookmaker signups, not to be honest about pick quality. We're a CLV-tracked subscription: our incentive is for our picks to actually beat the closing line over time. Casual readers go to Forebet; bettors who track ROI come to us.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────

  {
    slug: "oddspedia",
    name: "Oddspedia",
    tier: "Odds aggregator",
    homeUrl: "https://oddspedia.com",
    oneliner:
      "Odds comparison platform with 250+ bookmakers, free AI value-bet tool (SmartBet), and widget syndication network.",
    traffic: "~1.89M visits/month (Similarweb Jul 2025), 12:13 avg session, 48.6% organic",
    pricing: "Free (affiliate + widget syndication revenue, no subscription tier)",
    whereTheyWin: [
      "**250 bookmaker coverage.** We track 13. For pure odds comparison — the \"where can I get the best price on this pick\" use case — they win on raw volume.",
      "**Widget syndication network.** Publishers embed Oddspedia widgets on their own sites; clicks split 50/50. A distributed traffic acquisition channel we can't easily replicate.",
      "**Free + zero friction.** No signup, no paywall on SmartBet, value bets, or odds comparison. The floor is \"consume forever for free.\"",
      "**12-minute average session.** Casual bettors hang around browsing odds. They've built genuine browse-time engagement.",
      "**Multi-sport breadth.** Football + tennis + basketball + NFL etc. We're football-only by design.",
    ],
    oddsIntelWins: [
      "**CLV-tracked picks.** Oddspedia's SmartBet flags \"value %\" but doesn't publish closing line value. We can't tell from their surface whether SmartBet's flagged picks actually beat the closing line. We do, and we publish per-pick CLV.",
      "**Honest variance + drawdown disclosure.** We publish our worst drawdown (−€398, 9 days, May 2026). Oddspedia doesn't surface drawdowns at all.",
      "**Subscription accountability.** We sell a product where every pick is timestamped and tracked. Their affiliate model rewards engagement, not pick accuracy — they have no incentive to be honest about quality.",
      "**Per-bet AI explanation (Elite).** SmartBet flags value but doesn't explain rationale per pick. Ours does.",
      "**Live in-play bots + xG tracking.** Prematch-focused odds comparison vs our integrated in-play tracker.",
      "**Telegram-native delivery.** They're a destination site you visit. We push to your phone before kickoff.",
    ],
    matrix: [
      { label: "Bookmaker coverage", competitor: "✅ (250)", oddsintel: "~ (13)" },
      { label: "AI value-bet detection", competitor: "✅ (SmartBet)", oddsintel: "✅" },
      { label: "Per-pick CLV tracked", competitor: "❌", oddsintel: "✅" },
      { label: "Honest drawdown disclosure", competitor: "❌", oddsintel: "✅" },
      { label: "Per-bet AI explanation", competitor: "❌", oddsintel: "✅" },
      { label: "Telegram pre-kickoff alerts", competitor: "❌", oddsintel: "✅" },
      { label: "In-play / live xG", competitor: "❌", oddsintel: "✅" },
      { label: "Multi-sport coverage", competitor: "✅", oddsintel: "❌ (football-only)" },
      { label: "Embeddable widgets", competitor: "✅", oddsintel: "❌" },
      { label: "Free tier", competitor: "✅ (everything free)", oddsintel: "✅" },
    ],
    verdict: {
      pickThem:
        "You want odds comparison across many bookmakers (the \"where do I bet this?\" question), you want a free value-bet detection tool with no signup, or you bet multi-sport. Their widget ecosystem and bookmaker breadth are real advantages for those specific jobs.",
      pickUs:
        "You want the curated decision rather than the raw odds buffet, you care that value-bet detection is validated by CLV (not just a \"value %\" badge), and you want picks delivered to Telegram with rationale and match context. Oddspedia is a reference layer; OddsIntel is a decision layer.",
    },
    faq: [
      {
        q: "Is SmartBet (Oddspedia's value-bet tool) any good?",
        a: "SmartBet identifies markets where their model's implied probability differs from the bookmaker's. The math is reasonable, but they don't publish CLV — meaning we don't know whether SmartBet's flagged value bets actually beat the closing line. Without that, you're trusting their model's calibration on faith. We publish per-pick CLV specifically because that's the only metric that proves a model has real edge in weeks, not years.",
      },
      {
        q: "Why do you cover only 13 bookmakers if Oddspedia covers 250?",
        a: "We focus on the EU bookmakers our users can actually access. The other 200+ Oddspedia indexes are mostly US/Asian books, affiliate-friendly small operators, or grey-market sites. 13 is enough to find genuine pricing inefficiencies at the books that matter for our audience. Breadth for breadth's sake serves the affiliate funnel, not the bettor.",
      },
      {
        q: "Can I use both?",
        a: "Sure. Oddspedia for odds reference + multi-bookmaker browsing. OddsIntel for curated value bets with CLV tracking, Telegram delivery, and match context. Different jobs.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────

  {
    slug: "sportbot-ai",
    name: "SportBot AI",
    tier: "AI chat + bankroll",
    homeUrl: "https://www.sportbotai.com",
    oneliner:
      "Conversational AI sports analyst with bankroll tracking, edge alerts, behavioural \"AI Coach\", and multi-sport coverage.",
    traffic: "Small — exact figure unavailable in Similarweb research",
    pricing:
      "Free · Pro $18.99/mo · Premium $39.99/mo · Lifetime Pro $299 · Lifetime Premium $999",
    whereTheyWin: [
      "**Conversational chat UX.** \"Ask the AI about this match\" interface is their core product. We have per-bet AI explanations but no chat surface yet (GROWTH-CHAT-AI-SPIKE is roadmapped).",
      "**AI Coach — behavioural coaching layer.** Weekly audits for tilt, loss-chasing, overstaking, bankroll mismanagement. Genuinely novel; we don't have this.",
      "**Multi-sport breadth.** Soccer + NBA + NFL + NHL + EuroLeague + Tennis. We're football-only.",
      "**Bankroll tracker with Kelly sizing built in.** They've productised the bet-log workflow.",
      "**iOS native app.** We're web + Telegram only.",
      "**Lifetime pricing tier.** $299 / $999 one-time — a cash-forward pricing lever we don't offer.",
    ],
    oddsIntelWins: [
      "**Their published ROI is -27% over 30 days** (22W-30L at 1.71 avg odds). Chat alone isn't a profitability driver — pair our chat (when we ship it) with the +CLV detection engine for actual edge.",
      "**CLV — not just ROI — as the honest scoreboard.** They've climbed from accuracy to ROI (good). We're one step further to CLV (better — variance-resistant). Their 30-day -27% ROI is statistically meaningless at that sample; CLV is meaningful in weeks.",
      "**Methodology transparency.** Our /methodology page documents the model, data sources, drawdown. Theirs doesn't disclose what AI model they use, what data they ingest, or who built it.",
      "**Named operator + engineering credentials.** Operator background is on the site. Theirs is anonymous — a credibility gap for a paid betting product.",
      "**Honest negative-result publication.** They publish -27% ROI but don't explain it. We publish -€398 drawdown with educational context (\"this is the cost of being a +EV bettor\"). Same data, much better framing.",
      "**Per-bet rationale on every pick.** Their chat is conversational but the picks themselves are delivered without per-bet rationale.",
      "**Telegram delivery + EU bookmaker accessibility.** Built for EU bettors with the books they can actually access. They're US-leaning (\"$\" pricing, NBA/NFL/NHL focus).",
    ],
    matrix: [
      { label: "Conversational chat UX", competitor: "✅", oddsintel: "⏳" },
      { label: "Weekly behavioural audits (AI Coach)", competitor: "✅", oddsintel: "⏳" },
      { label: "Bankroll tracker + Kelly sizing", competitor: "✅", oddsintel: "~" },
      { label: "Multi-sport coverage", competitor: "✅", oddsintel: "❌" },
      { label: "iOS native app", competitor: "✅", oddsintel: "⏳" },
      { label: "CLV-tracked picks (publicly)", competitor: "❌", oddsintel: "✅" },
      { label: "Open methodology page", competitor: "❌", oddsintel: "✅" },
      { label: "Named team / operator", competitor: "❌", oddsintel: "✅" },
      { label: "Per-bet rationale on picks", competitor: "❌", oddsintel: "✅" },
      { label: "Telegram pre-kickoff alerts", competitor: "❌", oddsintel: "✅" },
    ],
    verdict: {
      pickThem:
        "You want a conversational chat-with-the-AI interface right now, you bet US sports (NBA + NFL + NHL alongside football), you want behavioural bankroll coaching today, or you'd consider a $299-999 lifetime tier over monthly subscriptions.",
      pickUs:
        "You want CLV (not just ROI) as the proof metric, you want a named operator and open methodology behind the product, you care about per-bet rationale tied to specific signals, or you bet primarily on EU bookmakers and football. Our €4.99-14.99/mo Elite tier vs their $18.99-39.99/mo is also 3-4× cheaper for the chat-AI feature once we ship it.",
    },
    faq: [
      {
        q: "SportBot AI markets itself as a profitable AI. Is it?",
        a: "Their own published ROI is -27% over 30 days (22W-30L at 1.71 avg odds). The product is interesting — chat UX + AI Coach + bankroll tracking are all genuinely novel — but the underlying model hasn't shown edge in their published sample. We're upfront when our paper chain has bad weeks too; see /methodology for the -€398 worst drawdown.",
      },
      {
        q: "Will OddsIntel build chat AI like SportBot?",
        a: "Yes — GROWTH-CHAT-AI-SPIKE is in our roadmap. We're scoping Elite-only single-match chat, deferred until our v2 model cohort has more verified-ROI data. SportBot AI's existence confirms market demand at the $20-40/mo price point — we'll be 3-4× cheaper for the same feature.",
      },
      {
        q: "What about the AI Coach feature?",
        a: "Sunday email/Telegram analysing your last 7 days of bets, flagging behavioural patterns (tilt, loss-chasing, overstaking). It's a genuinely novel feature — added to our backlog as GROWTH-AI-COACH-WEEKLY-AUDIT. Trivial to build technically (~$0.005 per audit × users × 4 weeks), deferred until we have N≥200 paying users to make it meaningful.",
      },
    ],
  },
];

export function getVsCompetitor(slug: string): VsCompetitor | undefined {
  return VS_COMPETITORS.find((c) => c.slug === slug);
}

export const VS_SLUGS = VS_COMPETITORS.map((c) => c.slug);
