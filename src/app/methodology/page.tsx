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
