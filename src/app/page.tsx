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
import { PremiumWaitlistForm } from "@/components/premium-waitlist-form";

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

  // Same-window competitor comparisons from the audits committed in
  // odds-intel-engine/ledger/comparison_*.json. Hard-coded for now —
  // could be lifted to a weekly cron, but the underlying audits already
  // commit to the engine repo so the JSON IS the source of truth and
  // updating these constants is a one-line change.
  const competitors = [
    {
      // scripts/production_audit_vs_winnerodds.py
      name: "WinnerOdds",
      url: "https://winnerodds.com",
      windowStart: "2026-04-01",
      windowEnd: "2026-06-08",
      theirN: 2294,
      theirRoi: 5.84,
      ourN: total, // production cohort full sample (we beat them on n=1181 vs 2294)
      ourRoi: roi,
      verifiable: "Their public GraphQL endpoint at app.winnerodds.com:4000",
    },
    {
      // ledger/comparison_signalodds.json (2026-06-24 scrape)
      name: "SignalOdds",
      url: "https://signalodds.com",
      windowStart: "2026-05-04",
      windowEnd: "2026-06-25",
      theirN: 1157,
      theirRoi: -0.44,
      ourN: 989,
      ourRoi: 11.91,
      verifiable: "Their public /predictions/past pages (HTML scrape)",
    },
    {
      // ledger/comparison_deepbetting.json (2026-06-24 scrape)
      name: "DeepBetting",
      url: "https://deepbetting.io",
      windowStart: "2026-05-04",
      windowEnd: "2026-06-25",
      theirN: 235,
      theirRoi: -9.15,
      ourN: 989,
      ourRoi: 11.91,
      verifiable: "Their public /backend/api/predictions-api.php endpoint",
    },
  ];

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-50 antialiased">
      {/* ───────── Nav ───────── */}
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="font-mono text-sm font-bold tracking-tight">
            ODDSINTEL
          </Link>
          <nav className="flex items-center gap-4 text-xs text-neutral-400">
            <Link href="/picks" className="hover:text-neutral-100">
              Live Picks
            </Link>
            <Link href="/performance" className="hover:text-neutral-100">
              Track Record
            </Link>
            <Link
              href="/api/v1/track-record?limit=10"
              className="hidden sm:inline hover:text-neutral-100 font-mono"
            >
              API
            </Link>
            <Link
              href="https://t.me/oddsintelpicks"
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
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/picks"
                className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-emerald-400"
              >
                See today&apos;s picks
              </Link>
              <Link
                href="/performance"
                className="rounded-md border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-neutral-100 hover:bg-white/[0.08]"
              >
                View track record
              </Link>
              <Link
                href="https://t.me/oddsintelpicks"
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                Telegram
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
            vs other public football models
          </h2>
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] text-sm">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-3 border-b border-white/[0.06] font-mono text-xs uppercase tracking-wider text-neutral-500">
              <div>Source</div>
              <div className="text-right">ROI</div>
              <div className="text-right">Bets</div>
            </div>
            {competitors.map((c) => {
              const weeks = Math.round(
                (new Date(c.windowEnd).getTime() - new Date(c.windowStart).getTime())
                  / (7 * 24 * 3600 * 1000),
              );
              const windowTip = `${c.windowStart} → ${c.windowEnd} (${weeks}w) · ${c.verifiable}`;
              return (
                <div key={c.name} className="border-b border-white/[0.04] last:border-b-0">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-3 bg-emerald-500/[0.04]">
                    <div className="text-neutral-100">OddsIntel · production</div>
                    <div className="text-right font-mono text-emerald-400">
                      {c.ourRoi !== null
                        ? `${c.ourRoi > 0 ? "+" : ""}${c.ourRoi.toFixed(2)}%`
                        : "—"}
                    </div>
                    <div className="text-right font-mono text-neutral-300">
                      {c.ourN.toLocaleString()}
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-3">
                    <div className="text-neutral-400">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="text-neutral-300 hover:text-neutral-100 hover:underline"
                      >
                        {c.name}
                      </a>
                      <span
                        title={windowTip}
                        className="ml-2 cursor-help text-[10px] font-mono uppercase tracking-wider text-neutral-600 underline decoration-dotted underline-offset-2 hover:text-neutral-400"
                      >
                        {weeks}w window
                      </span>
                    </div>
                    <div className={`text-right font-mono ${c.theirRoi > 0 ? "text-neutral-300" : "text-red-400"}`}>
                      {c.theirRoi > 0 ? "+" : ""}{c.theirRoi.toFixed(2)}%
                    </div>
                    <div className="text-right font-mono text-neutral-300">
                      {c.theirN.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Each competitor pulled via their public endpoint, settled outcomes
            matched to ours by match id + kickoff, ROI at €10 flat stake.
            Hover the <span className="font-mono text-neutral-400">Nw window</span>{" "}
            badge for exact dates + source. Reproducible —{" "}
            <code className="rounded bg-white/[0.05] px-1 font-mono">scripts/audit_vs_*.py</code>{" "}
            +{" "}
            <code className="rounded bg-white/[0.05] px-1 font-mono">ledger/comparison_*.json</code>.
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
            OpenTimestamps.
          </p>
        </section>

        {/* ───────── Premium waitlist (demand-signal capture) ───────── */}
        <section className="mt-12">
          <PremiumWaitlistForm />
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
              <Link href="https://t.me/oddsintelpicks" className="hover:text-neutral-300">
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
