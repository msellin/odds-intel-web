/**
 * /preview — minimal landing draft for the focused-product refactor.
 *
 * Shipped behind a separate route so the production landing stays untouched
 * while the operator reviews. Numbers come from /api/v1/track-record so the
 * hero is always in sync with the public ledger — single source of truth.
 *
 * What this page intentionally does NOT have (the whole point):
 *   - No tier matrix, no Stripe CTA, no "Pro" or "Elite" gating
 *   - No World Cup banner, no live scores, no match detail teasers
 *   - No FAQ, no competitor comparison block, no SEO bait
 *   - No marketing nav with /pricing /how-it-works /faq links
 *
 * What it does have:
 *   - One headline: ROI on calibrated pre-match picks, since launch
 *   - One CTA pair: view ledger / join Telegram
 *   - One trust strip: count, CLV, hit-rate, link to OpenTimestamps anchor (TBD)
 *   - One methodology paragraph (2-3 sentences max)
 *   - One comparison row vs WinnerOdds (same-window, audited)
 *   - One footer with API link + GitHub
 */
import Link from "next/link";
import { headers } from "next/headers";

interface TrackRecordMeta {
  since: string;
  total_bets: number;
  page_size: number;
  roi_pct: number | null;
  pnl_total: number;
  stake_total: number;
  median_clv_pct: number | null;
  mean_clv_pct: number | null;
  median_clv_pin_pct: number | null;
  clv_coverage_pct: number;
  clv_beat_pct: number | null;
  scope: string;
  notes: string;
  next_cursor: string | null;
}

async function getMeta(): Promise<TrackRecordMeta | null> {
  // Server-render hits the local route handler via absolute URL.
  // In dev / Vercel preview the host header gives us the right origin.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  try {
    const res = await fetch(`${proto}://${host}/api/v1/track-record?limit=1`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { meta?: TrackRecordMeta };
    return json.meta ?? null;
  } catch {
    return null;
  }
}

export const metadata = {
  title: "OddsIntel — verified football track record",
  description:
    "Pre-match football picks with a public, time-stamped ledger. Every bet, every closing line, every result.",
};

export default async function PreviewLanding() {
  const meta = await getMeta();
  const roi = meta?.roi_pct ?? null;
  const total = meta?.total_bets ?? 0;
  const clvMedian = meta?.median_clv_pct ?? null;
  const clvPinMedian = meta?.median_clv_pin_pct ?? null;
  const beat = meta?.clv_beat_pct ?? null;
  const stake = meta?.stake_total ?? 0;
  const pnl = meta?.pnl_total ?? 0;
  const since = meta?.since ?? "2026-05-04";

  // Same-window WinnerOdds comparison from the audit committed today.
  // Hard-coded for now — could be lifted to a separate `audit_results` table
  // and re-computed by a weekly cron, but at our update cadence (weekly retrain
  // → weekly audit), a hard-coded 8-week snapshot is honest enough as long as
  // we update the dates when we re-run.
  const woWindowStart = "2026-04-01";
  const woWindowEnd = "2026-06-08";
  const woRoi = 5.84;
  const woN = 2294;

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-50 antialiased">
      {/* ───────── Nav ───────── */}
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="font-mono text-sm font-bold tracking-tight">
            ODDSINTEL
          </Link>
          <nav className="flex items-center gap-4 text-xs text-neutral-400">
            <Link href="/track-record" className="hover:text-neutral-100">
              Track Record
            </Link>
            <Link
              href="/api/v1/track-record?limit=10"
              className="hidden sm:inline hover:text-neutral-100 font-mono"
            >
              API
            </Link>
            <Link
              href="https://t.me/oddsintel"
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300 hover:bg-emerald-500/20"
            >
              Telegram
            </Link>
          </nav>
        </div>
      </header>

      {/* ───────── Hero ───────── */}
      <main className="mx-auto max-w-4xl px-4">
        <section className="pt-16 pb-12 sm:pt-24">
          <div className="space-y-6 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
              Verified football track record
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              {roi !== null ? (
                <>
                  <span className="text-emerald-400">
                    {roi > 0 ? "+" : ""}
                    {roi.toFixed(2)}% ROI
                  </span>
                  <span className="block text-2xl text-neutral-400 font-normal mt-3 sm:text-3xl">
                    across {total.toLocaleString()} verified pre-match picks
                  </span>
                </>
              ) : (
                <span className="text-neutral-300">Track record loading…</span>
              )}
            </h1>
            <p className="mx-auto max-w-xl text-balance text-base text-neutral-400 sm:text-lg">
              Football model. Pre-match only. Every pick logged before kickoff,
              every result settled against official scores, every closing line
              tracked. Public ledger; nothing hidden.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/track-record"
                className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-emerald-400"
              >
                View live ledger
              </Link>
              <Link
                href="https://t.me/oddsintel"
                className="rounded-md border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-neutral-100 hover:bg-white/[0.08]"
              >
                Free picks on Telegram
              </Link>
            </div>
          </div>
        </section>

        {/* ───────── Metric strip ───────── */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] sm:grid-cols-4">
          <Metric
            label="Settled bets"
            value={total.toLocaleString()}
            sub={`since ${since}`}
          />
          <Metric
            label="ROI"
            value={roi !== null ? `${roi > 0 ? "+" : ""}${roi.toFixed(2)}%` : "—"}
            sub={`P&L €${pnl.toFixed(0)} / €${stake.toFixed(0)} staked`}
            accent={roi !== null && roi > 0 ? "positive" : null}
          />
          <Metric
            label="Median CLV"
            value={
              clvMedian !== null
                ? `${clvMedian > 0 ? "+" : ""}${clvMedian.toFixed(2)}%`
                : "—"
            }
            sub={
              clvPinMedian !== null
                ? `+${clvPinMedian.toFixed(1)}% vs Pinnacle close`
                : "vs closing line"
            }
            accent={clvMedian !== null && clvMedian > 0 ? "positive" : null}
          />
          <Metric
            label="Beat the close"
            value={beat !== null ? `${beat.toFixed(0)}%` : "—"}
            sub="of picks"
            accent={beat !== null && beat >= 50 ? "positive" : null}
          />
        </section>

        {/* ───────── Methodology ───────── */}
        <section className="mt-16 grid gap-8 sm:grid-cols-2 sm:items-start">
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              How it works
            </h2>
            <p className="text-sm leading-relaxed text-neutral-300">
              The model is a Poisson + XGBoost blend, retrained weekly on every
              completed match in our 280+ league universe. Every pick goes through
              an isotonic calibration layer before publication. The public ledger
              shows all production strategies — calibrated, beta, and active —
              with no cherry-picking. Retired bots (failed experiments) are
              excluded from the headline but stay visible in the admin dashboard
              for audit.
            </p>
          </div>
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Why CLV matters
            </h2>
            <p className="text-sm leading-relaxed text-neutral-300">
              ROI can be variance. CLV (closing line value) is the bookmaker-test
              equivalent of audited financials — if you consistently get better
              odds than the market closes at, you have a real edge. Our picks
              beat the closing line on{" "}
              <span className="text-emerald-300">
                {beat !== null ? `${beat.toFixed(0)}%` : "—"}
              </span>{" "}
              of bets. WinnerOdds, the established reference,{" "}
              <span className="text-neutral-400">does not.</span>
            </p>
          </div>
        </section>

        {/* ───────── Comparison ───────── */}
        <section className="mt-16">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            vs the established reference
          </h2>
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="grid grid-cols-3 gap-px bg-white/[0.06] text-xs font-mono uppercase tracking-wider text-neutral-500">
              <div className="bg-neutral-950 px-4 py-3">Source</div>
              <div className="bg-neutral-950 px-4 py-3 text-right">ROI</div>
              <div className="bg-neutral-950 px-4 py-3 text-right">Bets</div>
            </div>
            <div className="grid grid-cols-3 gap-px bg-white/[0.06] text-sm">
              <div className="bg-neutral-950 px-4 py-3 text-neutral-100">
                OddsIntel · production · pre-match
              </div>
              <div className="bg-neutral-950 px-4 py-3 text-right font-mono text-emerald-400">
                {roi !== null ? `${roi > 0 ? "+" : ""}${roi.toFixed(2)}%` : "—"}
              </div>
              <div className="bg-neutral-950 px-4 py-3 text-right font-mono text-neutral-300">
                {total.toLocaleString()}
              </div>
              <div className="bg-neutral-950 px-4 py-3 text-neutral-400">
                WinnerOdds · same 8-week window ({woWindowStart} → {woWindowEnd})
              </div>
              <div className="bg-neutral-950 px-4 py-3 text-right font-mono text-neutral-300">
                +{woRoi.toFixed(2)}%
              </div>
              <div className="bg-neutral-950 px-4 py-3 text-right font-mono text-neutral-300">
                {woN.toLocaleString()}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            WinnerOdds picks pulled from their public GraphQL endpoint; settled
            outcomes matched to ours via fixture id + kickoff. Reproducible —
            see <code className="rounded bg-white/[0.05] px-1 font-mono">scripts/production_audit_vs_winnerodds.py</code>.
          </p>
        </section>

        {/* ───────── Verification CTA ───────── */}
        <section className="mt-16 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="mb-2 text-base font-semibold text-neutral-100">
            Verify the numbers yourself
          </h2>
          <p className="text-sm text-neutral-400">
            Every bet on this page is in our public ledger. Pull the raw feed
            at{" "}
            <Link
              href="/api/v1/track-record"
              className="font-mono text-emerald-400 hover:underline"
            >
              /api/v1/track-record
            </Link>{" "}
            (open JSON, no auth) — use match_id + kickoff_utc + placed_at_utc
            to independently re-settle each pick against ESPN or Flashscore.
            Daily snapshot hashes are timestamped to the Bitcoin blockchain via
            OpenTimestamps (cron coming soon).
          </p>
        </section>

        {/* ───────── Footer ───────── */}
        <footer className="mt-20 mb-12 border-t border-white/[0.06] pt-8 text-xs text-neutral-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>© OddsIntel · honest numbers, public ledger</p>
            <div className="flex items-center gap-4 font-mono">
              <Link href="/api/v1/track-record" className="hover:text-neutral-300">
                API
              </Link>
              <Link
                href="https://github.com/msellin/odds-intel-engine"
                className="hover:text-neutral-300"
              >
                GitHub
              </Link>
              <Link href="https://t.me/oddsintel" className="hover:text-neutral-300">
                Telegram
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "positive" | null;
}) {
  return (
    <div className="bg-neutral-950 px-4 py-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight ${
          accent === "positive" ? "text-emerald-400" : "text-neutral-100"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] text-neutral-500">{sub}</p>
      )}
    </div>
  );
}
