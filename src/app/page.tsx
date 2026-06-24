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
import { Nav } from "@/components/nav";

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

  // Same-window competitor comparisons. All three use the matched
  // 7-week window 2026-05-04 → 2026-06-25 so our same OddsIntel cohort
  // (989 bets, +11.91% ROI) is the comparison baseline across all
  // three competitors. The WinnerOdds row was re-run on this matched
  // window today; previously it used a wider 10-week pull which made
  // the OddsIntel n disagree across rows. Source-of-truth lives in
  // odds-intel-engine/ledger/comparison_*.json.
  const matchedWindow = { start: "2026-05-04", end: "2026-06-25" };
  const ourMatched = { roiPct: 11.91, n: 989 };
  const competitors = [
    {
      name: "WinnerOdds",
      url: "https://winnerodds.com",
      color: "emerald",
      theirN: 1000,    // 7w match window pulled 2026-06-24
      theirRoi: 6.55,  // +€2,285 on €34,871 staked, 55.2% hit
      verifiable: "Their public GraphQL endpoint at app.winnerodds.com:4000",
    },
    {
      name: "SignalOdds",
      url: "https://signalodds.com",
      color: "sky",
      theirN: 1157,
      theirRoi: -0.44,
      verifiable: "Their public /predictions/past pages (HTML scrape)",
    },
    {
      name: "DeepBetting",
      url: "https://deepbetting.io",
      color: "orange",
      theirN: 235,
      theirRoi: -9.15,
      verifiable: "Their public /backend/api/predictions-api.php endpoint",
    },
  ];

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-50 antialiased">
      <Nav />

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

        {/* ───────── One-line methodology — compact replacement for the
            former two-paragraph "How it works / Why CLV matters" block.
            The detail lives on a future /methodology page if anyone wants
            it, but most readers skip past it on a marketing page. ───── */}

        {/* ───────── Comparison — single aggregate card ─────────
           One OddsIntel headline number, one bet count, one window;
           three competitor rows below each with a delta. Reads top
           to bottom in 3 seconds: "we're +11.91% on 989 bets — here's
           how much we beat each competitor by." */}
        <section className="mt-16">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Head-to-head vs other public models
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-600">
              {matchedWindow.start} → {matchedWindow.end} · €10 flat stake
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
            {/* OddsIntel hero strip — shown ONCE at the top */}
            <div className="border-b border-white/[0.06] bg-gradient-to-b from-emerald-500/[0.10] to-emerald-500/[0.02] px-5 py-6 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                OddsIntel · production · pre-match
              </p>
              <p className="mt-2 font-mono text-4xl font-semibold tabular-nums text-emerald-300 sm:text-5xl">
                +{ourMatched.roiPct.toFixed(2)}% ROI
              </p>
              <p className="mt-2 text-xs text-neutral-400">
                <span className="font-mono tabular-nums text-neutral-200">
                  {ourMatched.n.toLocaleString()}
                </span>{" "}
                settled bets in this window
              </p>
            </div>

            {/* Competitor rows — each shows their ROI + delta vs us */}
            <div className="divide-y divide-white/[0.04]">
              {competitors.map((c) => {
                const delta = ourMatched.roiPct - c.theirRoi;
                const initial = c.name[0];
                // Brand-coded letter avatar — better visual than a broken
                // favicon fallback, deterministic, no external image deps.
                const avatarBg =
                  c.color === "emerald" ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                  : c.color === "sky"    ? "bg-sky-500/15 text-sky-300 ring-sky-500/30"
                  :                        "bg-orange-500/15 text-orange-300 ring-orange-500/30";
                return (
                  <div
                    key={c.name}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3.5 sm:gap-5 sm:px-5"
                  >
                    {/* Letter avatar */}
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-sm font-bold ring-1 ring-inset ${avatarBg}`}
                      aria-hidden
                    >
                      {initial}
                    </div>

                    {/* Name + their ROI */}
                    <div className="min-w-0">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="block text-sm font-semibold text-neutral-200 hover:text-neutral-100 hover:underline truncate"
                      >
                        {c.name}{" "}
                        <span className="font-mono text-[10px] font-normal text-neutral-500">↗</span>
                      </a>
                      <p className="mt-0.5 font-mono text-[11px] text-neutral-500 tabular-nums">
                        {c.theirN.toLocaleString()} bets ·{" "}
                        <span className={c.theirRoi >= 0 ? "text-neutral-400" : "text-red-400"}>
                          {c.theirRoi > 0 ? "+" : ""}
                          {c.theirRoi.toFixed(2)}% ROI
                        </span>
                      </p>
                    </div>

                    {/* Delta — hero of the row */}
                    <div className="text-right">
                      <p
                        className={`font-mono text-lg font-bold tabular-nums sm:text-2xl ${
                          delta > 0
                            ? "text-emerald-400"
                            : delta < 0
                              ? "text-red-400"
                              : "text-neutral-400"
                        }`}
                      >
                        {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} +{delta.toFixed(2)}pp
                      </p>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-600">
                        in our favour
                      </p>
                    </div>

                    {/* Per €1k */}
                    <div className="hidden text-right sm:block">
                      <p className="font-mono text-xs text-neutral-500 tabular-nums">
                        per €1k staked
                      </p>
                      <p className="font-mono text-[11px] tabular-nums">
                        <span className="text-emerald-300">
                          +€{(ourMatched.roiPct * 10).toFixed(0)}
                        </span>{" "}
                        <span className="text-neutral-600">vs</span>{" "}
                        <span className={c.theirRoi >= 0 ? "text-neutral-400" : "text-red-400"}>
                          {c.theirRoi > 0 ? "+" : ""}€{(c.theirRoi * 10).toFixed(0)}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-3 text-center text-xs text-neutral-500">
            Same window, same stake, same markets.{" "}
            <Link href="/methodology" className="text-emerald-400 hover:underline">
              How we verify →
            </Link>
          </p>
        </section>

        {/* Verification CTA card removed 2026-06-24 — the one-line methodology
            above + the footer's API/GitHub links already carry this info; the
            standalone card was page-weight without new content. */}

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
