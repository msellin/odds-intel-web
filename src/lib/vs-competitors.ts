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
        "You bet across multiple sports (NBA + NFL + NHL + MLB alongside football), you want a verified Bet-Analytix track record now (not 'on the roadmap'), or you specifically prefer French / multi-language interfaces.",
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
];

export function getVsCompetitor(slug: string): VsCompetitor | undefined {
  return VS_COMPETITORS.find((c) => c.slug === slug);
}

export const VS_SLUGS = VS_COMPETITORS.map((c) => c.slug);
