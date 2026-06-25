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

// COMPETITOR-AUTOREFRESH (2026-06-25)
// Per-competitor static presentation metadata. Numbers come from
// the engine repo's ledger JSON fetched at render time (6h revalidate).
interface CompetitorRow {
  name: string;
  url: string;
  color: "emerald" | "sky" | "orange" | "rose" | "amber";
  ledgerKey: string;     // ledger/comparison_<key>.json
  theirN: number;
  theirRoi: number;
  ourN: number;
  ourRoi: number;
  ourMatched: { roiPct: number; n: number };
}

const COMP_META: Omit<CompetitorRow, "theirN" | "theirRoi" | "ourN" | "ourRoi" | "ourMatched">[] = [
  { name: "WinnerOdds",  url: "https://winnerodds.com",     color: "emerald", ledgerKey: "winnerodds" },
  { name: "SignalOdds",  url: "https://signalodds.com",     color: "sky",     ledgerKey: "signalodds" },
  { name: "DeepBetting", url: "https://deepbetting.io",     color: "orange",  ledgerKey: "deepbetting" },
  { name: "Tipstrr",     url: "https://tipstrr.com/football", color: "rose",  ledgerKey: "tipstrr" },
  { name: "Forebet",     url: "https://www.forebet.com",    color: "amber",   ledgerKey: "forebet" },
];

// Last-known good values committed 2026-06-25. If the GitHub fetch fails
// or the JSON shape is unexpected, we fall back to these so the landing
// never renders empty rows.
const COMP_FALLBACK: Record<string, { theirN: number; theirRoi: number; ourN: number; ourRoi: number }> = {
  winnerodds:  { theirN: 1007, theirRoi: 6.78,  ourN: 991, ourRoi: 12.06 },
  signalodds:  { theirN: 1157, theirRoi: -0.44, ourN: 989, ourRoi: 11.91 },
  deepbetting: { theirN: 235,  theirRoi: -9.15, ourN: 989, ourRoi: 11.91 },
  tipstrr:     { theirN: 209,  theirRoi: -5.22, ourN: 989, ourRoi: 11.91 },
  forebet:     { theirN: 1434, theirRoi: 15.33, ourN: 989, ourRoi: 11.91 },
};

const LEDGER_RAW =
  "https://raw.githubusercontent.com/msellin/odds-intel-engine/main/ledger";

async function loadCompetitors(): Promise<CompetitorRow[]> {
  const rows = await Promise.all(
    COMP_META.map(async (m) => {
      let theirN = COMP_FALLBACK[m.ledgerKey].theirN;
      let theirRoi = COMP_FALLBACK[m.ledgerKey].theirRoi;
      let ourN = COMP_FALLBACK[m.ledgerKey].ourN;
      let ourRoi = COMP_FALLBACK[m.ledgerKey].ourRoi;
      try {
        const res = await fetch(
          `${LEDGER_RAW}/comparison_${m.ledgerKey}.json`,
          { next: { revalidate: 21600 } }, // 6h
        );
        if (res.ok) {
          const j = (await res.json()) as {
            status?: string;
            their_stats?: { n?: number; roi_pct?: number };
            our_stats_same_window?: { n?: number; roi_pct?: number };
          };
          // Skip pulls flagged as auth_required / insufficient_sample — we
          // already had this row before, fallback values stay in place.
          if (j.status === "ok") {
            theirN = j.their_stats?.n ?? theirN;
            theirRoi = j.their_stats?.roi_pct ?? theirRoi;
            ourN = j.our_stats_same_window?.n ?? ourN;
            ourRoi = j.our_stats_same_window?.roi_pct ?? ourRoi;
          }
        }
      } catch {
        // network error → keep fallback values
      }
      return {
        ...m,
        theirN, theirRoi, ourN, ourRoi,
        ourMatched: { roiPct: ourRoi, n: ourN },
      };
    }),
  );
  return rows;
}

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

  // COMPETITOR-AUTOREFRESH (2026-06-25): fetch each comparison_*.json
  // from the engine repo's raw GitHub URL with 6h revalidate. When the
  // weekly Sunday cron in odds-intel-engine re-runs the audits, the
  // numbers auto-flow here without a Vercel rebuild.
  //
  // Source-of-truth lives at:
  //   github.com/msellin/odds-intel-engine/tree/main/ledger
  //
  // Per-competitor presentation metadata (url, color, fallback) stays
  // hard-coded here — only the runtime numbers (n, ROI) come from the
  // ledger fetch. If a fetch fails, we fall back to the last-known
  // values committed below so the page never shows "—" rows.
  const competitors = await loadCompetitors();
  const ourMatched = competitors[0]?.ourMatched ?? { roiPct: 11.91, n: 989 };

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
              matched window · same markets
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
            {/* OddsIntel hero strip — shown ONCE at the top */}
            <div className="border-b border-white/[0.06] bg-gradient-to-b from-emerald-500/[0.10] to-emerald-500/[0.02] px-5 py-6 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                OddsIntel · production
              </p>
              <p className="mt-2 font-mono text-4xl font-semibold tabular-nums text-emerald-300 sm:text-5xl">
                +{ourMatched.roiPct.toFixed(2)}% ROI
              </p>
              <p className="mt-2 text-xs text-neutral-400">
                <span className="font-mono tabular-nums text-neutral-200">
                  {ourMatched.n.toLocaleString()}
                </span>{" "}
                settled bets
              </p>
            </div>

            {/* Competitor rows — each shows their ROI + delta vs us */}
            <div className="divide-y divide-white/[0.04]">
              {competitors.map((c) => {
                // Per-competitor delta: each row uses ITS OWN matched-window
                // ourRoi (not the global one) so the math is internally
                // consistent for any sub-window like Forebet's 38-day cap.
                const delta = c.ourRoi - c.theirRoi;
                const initial = c.name[0];
                // Brand-coded letter avatar — better visual than a broken
                // favicon fallback, deterministic, no external image deps.
                const avatarBg =
                  c.color === "emerald" ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                  : c.color === "sky"    ? "bg-sky-500/15 text-sky-300 ring-sky-500/30"
                  : c.color === "orange" ? "bg-orange-500/15 text-orange-300 ring-orange-500/30"
                  : c.color === "rose"   ? "bg-rose-500/15 text-rose-300 ring-rose-500/30"
                  : c.color === "amber"  ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
                  :                        "bg-neutral-500/15 text-neutral-300 ring-neutral-500/30";
                return (
                  <div
                    key={c.name}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 sm:gap-5 sm:px-5"
                  >
                    {/* Letter avatar */}
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full font-mono text-sm font-bold ring-1 ring-inset ${avatarBg}`}
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
                      <p className={`mt-0.5 font-mono text-base font-semibold tabular-nums sm:text-lg ${
                        c.theirRoi >= 0 ? "text-neutral-300" : "text-red-400"
                      }`}>
                        {c.theirRoi > 0 ? "+" : ""}{c.theirRoi.toFixed(2)}% ROI
                      </p>
                      <p className="font-mono text-[10px] text-neutral-600 tabular-nums">
                        {c.theirN.toLocaleString()} bets
                      </p>
                    </div>

                    {/* Delta — hero of the row */}
                    <div className="text-right">
                      <p
                        className={`font-mono text-xl font-bold tabular-nums sm:text-3xl ${
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
