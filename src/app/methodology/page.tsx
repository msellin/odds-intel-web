/**
 * /methodology — the technical detail behind the landing claims.
 *
 * The landing keeps copy minimal ("Same window, same stake. Learn more →")
 * and offloads anything technical here. Anyone who wants to verify our
 * ROI / CLV / competitor comparison claims gets the full mechanism in one
 * scrollable page, with links to the actual code on GitHub.
 *
 * Intentionally text-only (no charts, no live data). The /performance and
 * /picks pages carry the live numbers; this is the "how" page.
 */
import Link from "next/link";
import { Nav } from "@/components/nav";
import { StakeSimulator } from "@/components/stake-simulator";

export const metadata = {
  title: "Methodology — OddsIntel",
  description:
    "How OddsIntel's football model is built, how every pick is logged before kickoff, how the public ledger is anchored to the Bitcoin blockchain, and how competitor comparisons are computed.",
};

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 text-xs font-semibold uppercase tracking-widest text-emerald-400">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-sm leading-relaxed text-neutral-300">{children}</p>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-neutral-300">
      {children}
    </code>
  );
}

export default function MethodologyPage() {
  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-50 antialiased">
      <Nav />

      <main className="mx-auto max-w-3xl px-4 pt-12 pb-20">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Methodology
        </h1>
        <p className="mt-3 text-sm text-neutral-400">
          The mechanism behind every claim on the landing page — model,
          tiers, comparison math, verification stack, code.
        </p>

        <H>The model</H>
        <P>
          Two predictors blended at training time:
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-300">
          <li>
            A <strong>Poisson goal-rate model</strong> (Dixon-Coles
            correction for low-scoring outcomes, per-league rho fitted
            from historical scoreline frequencies)
          </li>
          <li>
            An <strong>XGBoost gradient-boosted classifier</strong> trained
            on form, ELO, expected-goals, lineups, injuries, market
            movement signals
          </li>
          <li>
            Blended weights are optimised on a rolling holdout; weights
            refit weekly via <Code>workers/jobs/weekly_blend_refit.py</Code>
          </li>
        </ul>
        <P>
          Retrained weekly on every completed match across 280+ leagues
          via <Code>workers/jobs/weekly_retrain.py</Code> (Sunday 03:00
          UTC). Promotion stays manual — a new model only goes live after
          a comparison report (<Code>scripts/compare_models.py</Code>) and
          the operator flips the <Code>MODEL_VERSION</Code> env on Railway.
        </P>

        <H>Calibration</H>
        <P>
          The raw model outputs are not betting probabilities yet — they
          tend to be over-confident at the tails. We run two calibration
          stages:
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-300">
          <li>
            <strong>Shrinkage toward Pinnacle</strong> (sharp-book anchor)
            scaled by data tier
          </li>
          <li>
            <strong>Platt scaling</strong> per market (1X2, O/U 2.5, BTTS,
            AH, DC) fitted on settled bets; 2-feature logistic for O/U
            2.5
          </li>
          <li>
            <strong>Isotonic regression</strong> as the final layer
            (one-time fit during training)
          </li>
        </ul>
        <P>
          Platt weights refit weekly via
          <Code>scripts/fit_platt_live.py</Code>.
        </P>

        <H>Bot strategies</H>
        <P>
          Production runs ~16 paper-trading bots simultaneously, each with
          its own market / league / edge-threshold filter. They share the
          same prediction backbone; the filters differ:
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-300">
          <li>
            <strong>Calibrated</strong> — promotion-grade. The only tier
            that places real money via the Coolbet placer. ~6 bots today.
          </li>
          <li>
            <strong>Beta</strong> — paper-only, accumulating live evidence
            after a backtest passes. Auto-promoted by{" "}
            <Code>scripts/weekly_bot_review.py</Code> at ROI ≥ +10% / CLV
            ≥ +5% on 60+ settled.
          </li>
          <li>
            <strong>Active</strong> — paper-only, observation tier.
          </li>
          <li>
            <strong>Retired</strong> — failed experiments. Excluded from
            headline numbers but kept in shadow_bets so they continue to
            be evaluated — reactivation gated on shadow performance
            recovery.
          </li>
        </ul>

        <H>How pick rows are computed</H>
        <P>
          Every settled bet on the public ledger represents one row in our{" "}
          <Code>simulated_bets</Code> table. The pipeline writes a row{" "}
          before kickoff with:
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-300">
          <li><Code>match_id</Code> + <Code>kickoff_utc</Code> — the fixture</li>
          <li><Code>market</Code> + <Code>selection</Code> — what we&apos;re betting</li>
          <li><Code>odds_at_pick</Code> + <Code>recommended_bookmaker</Code> — the price + book</li>
          <li><Code>edge_percent</Code> + <Code>calibrated_prob</Code> — the model&apos;s edge estimate</li>
          <li><Code>placed_at_utc</Code> — timestamp of the row insert</li>
        </ul>
        <P>
          After the match completes, settlement adds <Code>result</Code>,{" "}
          <Code>pnl</Code>, <Code>closing_odds</Code>, <Code>clv</Code>,{" "}
          <Code>clv_pinnacle</Code>. All historical rows are
          immutable — we never edit a settled bet.
        </P>

        <H>How competitor comparisons work</H>
        <P>
          For each competitor we pull their public per-bet history, filter
          to the same time window + same markets + same settlement state,
          and compute ROI assuming a €10 flat stake on every side. Scripts
          live in the engine repo:
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-300">
          <li>
            <Code>scripts/production_audit_vs_winnerodds.py</Code> —
            WinnerOdds public GraphQL endpoint at
            <Code>app.winnerodds.com:4000</Code>
          </li>
          <li>
            <Code>scripts/audit_vs_signalodds.py</Code> — SignalOdds
            paginated HTML at{" "}
            <Code>signalodds.com/predictions/past</Code>
          </li>
          <li>
            <Code>scripts/audit_vs_deepbetting.py</Code> — DeepBetting{" "}
            <Code>/backend/api/predictions-api.php?type=stats</Code>
          </li>
        </ul>
        <P>
          The output of each audit lands at{" "}
          <Code>ledger/comparison_*.json</Code> — same hash committed by
          GitHub Actions, anyone can clone the repo and re-run.
        </P>

        <H>Set your own stake</H>
        <P>
          The landing comparison uses €10 flat as a clean apples-to-apples
          unit. Drag the slider below to see what the same matched-window
          ROI translates to at any per-bet stake.
        </P>
        <div className="my-6">
          <StakeSimulator />
        </div>

        <H>Why flat stake, not Kelly</H>
        <P>
          Conventional wisdom says Kelly sizing maximises bankroll growth
          when your edge estimate is well-calibrated. We checked. On the
          same n=1,181 production-cohort pre-match sample since 2026-05-04:
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-300">
          <li>
            <strong>Flat €10 stake</strong> — ROI{" "}
            <span className="font-mono text-emerald-300">+9.08%</span>{" "}
            (€612 on €6,741 staked)
          </li>
          <li>
            <strong>Kelly-weighted</strong> — ROI{" "}
            <span className="font-mono text-neutral-300">+7.31%</span>{" "}
            (same picks, sized by model edge × bankroll fraction)
          </li>
        </ul>
        <P>
          Flat <strong>beats</strong> Kelly by ~1.8pp on our current
          sample. Reason: Kelly sizes up the highest-edge picks, and our
          highest-edge picks are exactly where the model&apos;s known
          longshot miscalibration hurts most (see "Conditional
          miscalibration at high odds" in{" "}
          <a
            href="https://github.com/msellin/odds-intel-engine/blob/main/MODEL_WHITEPAPER.md#11-known-limitations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            MODEL_WHITEPAPER §11
          </a>
          ). Kelly amplifies the bets we&apos;re most overconfident on.
        </P>
        <P>
          We surface flat €10 as the publishable headline because (a) it
          honestly matches the comparison baseline, and (b) it&apos;s
          currently our best strategy. Once the calibration fix lands
          (CAL-ALPHA-ODDS), we&apos;ll re-run this comparison — Kelly
          should win after the high-odds correction.
        </P>
        <P>
          Competitor stake methods, as best we can tell from their
          public surfaces: WinnerOdds publishes "unit" stakes (Kelly-like
          internally); SignalOdds shows EV%-weighted; DeepBetting shows
          per-confidence-tier flat; Tipstrr shows "level stakes" (flat);
          Forebet doesn&apos;t publish stake — we apply €10 flat at our
          end to settle their picks. Translation: our €10-flat
          comparison is internally consistent on OUR side; per-competitor
          stake differences add minor noise we can&apos;t correct for
          from outside their books.
        </P>

        <H>Per-competitor caveats</H>
        <P>
          Each competitor row on the landing is the headline number. A
          few have noteworthy structure worth knowing:
        </P>
        <ul className="mb-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-300">
          <li>
            <strong>Forebet</strong> — algorithmic predictor with a free
            public history. Their +15.33% headline is driven entirely by
            Over/Under 2.5 (+35.67% on n=611 in this window); their
            1X2 picks alone return essentially break-even at +0.23% on
            n=823. The OU lift is consistent with a low-scoring stretch
            of European fixtures during this audit window — likely to
            mean-revert as the new season starts. We show the headline
            honestly; the OU dependency is what to watch.
          </li>
          <li>
            <strong>Tipstrr</strong> — only monthly aggregates are
            public, per-bet detail is paywalled. The audit pools three
            active football tipsters (<Code>star-tips</Code>,{" "}
            <Code>mls-value</Code>,{" "}
            <Code>main-draws-model-top-euros</Code>) and covers all
            football bet types (1X2 + O/U + AH + BTTS) — slightly wider
            than ours (1X2 + O/U only). The wider scope works in their
            favour; even so, they&apos;re at -5.22% in the matched
            window.
          </li>
          <li>
            <strong>Betaminic</strong> — public strategies list is
            auth-walled (free signup gate plus paid tiers). Status is
            <Code>auth_required</Code> in{" "}
            <Code>ledger/comparison_betaminic.json</Code> with the
            activation lever documented{" "}
            (<Code>BETAMINIC_COOKIE</Code> env). Not displayed on the
            landing comparison until we have credible data.
          </li>
          <li>
            <strong>WinnerOdds + SignalOdds + DeepBetting</strong> —
            fully public per-bet history, no paywall, scope notes pinned
            to the same 1X2 + OU 2.5 cohort as ours.
          </li>
        </ul>

        <H>Why the comparison count differs from the hero count</H>
        <P>
          The landing page hero shows{" "}
          <strong>1,181 settled bets at +9.08% ROI</strong> — that&apos;s
          our full production cohort across 1X2 + O/U 2.5 + BTTS since
          the calibrated tier launched.
        </P>
        <P>
          The comparison card on the landing shows{" "}
          <strong>989 bets at +11.91% ROI</strong> — a subset, because
          SignalOdds and DeepBetting both publish 1X2 + O/U only, not
          BTTS. To stay apples-to-apples we drop BTTS from BOTH sides.
          Dropping BTTS actually lifts our ROI from +9.08% to +11.91%
          because our BTTS model is weaker than 1X2/OU (see Known
          Limitations in MODEL_WHITEPAPER.md). Both numbers are real;
          they measure different cohorts.
        </P>
        <P>
          Why the window starts 2026-05-04: that&apos;s the day our
          calibrated bot tier launched. Going further back would mix in
          pre-calibration bets we don&apos;t deploy real money on. The
          window will grow as more weeks of live evidence accumulate.
        </P>

        <H>Verification stack</H>
        <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-300">
          <li>
            <strong>Live API</strong> —{" "}
            <Link href="/api/v1/track-record" className="text-emerald-400 hover:underline">
              /api/v1/track-record
            </Link>
            (settled) and{" "}
            <Link href="/api/v1/upcoming" className="text-emerald-400 hover:underline">
              /api/v1/upcoming
            </Link>{" "}
            (live picks). Public, no auth, JSON, CORS-open.
          </li>
          <li>
            <strong>Daily GitHub commit</strong> — every night at 22:45
            UTC, a deterministic JSON of the day&apos;s settled bets is
            committed to{" "}
            <a
              href="https://github.com/msellin/odds-intel-engine/tree/main/ledger"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              ledger/YYYY-MM-DD.json
            </a>{" "}
            and signed by <Code>github-actions[bot]</Code>.
          </li>
          <li>
            <strong>Bitcoin blockchain anchor</strong> via{" "}
            <a
              href="https://opentimestamps.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              OpenTimestamps
            </a>
            . Each daily JSON is hashed and committed into a Bitcoin
            block. After ~1-6 hours the proof is permanent — anyone with{" "}
            <Code>ots verify</Code> can confirm "this exact JSON existed
            at this Bitcoin block height" without trusting GitHub or us.
          </li>
        </ul>

        <H>Source code</H>
        <P>
          Both repos are open source on GitHub:
        </P>
        <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-300">
          <li>
            <a
              href="https://github.com/msellin/odds-intel-engine"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-emerald-400 hover:underline"
            >
              msellin/odds-intel-engine
            </a>{" "}
            — the model, training, scheduler, scrapers, ledger
          </li>
          <li>
            <a
              href="https://github.com/msellin/odds-intel-web"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-emerald-400 hover:underline"
            >
              msellin/odds-intel-web
            </a>{" "}
            — this site, the picks page, the API routes
          </li>
        </ul>

        <H>What we&apos;re not</H>
        <P>
          This is a research project that publishes its track record. It is
          not financial advice, not a guarantee of future returns, and not
          a substitute for your own judgment. Past results are <em>real</em>{" "}
          (every row is in the public ledger), but the future is variance.
          Bet responsibly.
        </P>

        <div className="mt-10 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-sm text-neutral-400">
            Have a question this page doesn&apos;t answer? Open an issue on{" "}
            <a
              href="https://github.com/msellin/odds-intel-engine/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              GitHub
            </a>{" "}
            or message the{" "}
            <a
              href="https://t.me/oddsintelpicks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              Telegram channel
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
