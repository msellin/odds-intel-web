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
import { Database, GitCommit, Anchor, Terminal } from "lucide-react";
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
  windowStart: string;   // e.g. "2026-05-04" — from comparison_*.json .window.start
  windowEnd: string;     // e.g. "2026-07-06"
  snapshotAt: string;    // e.g. "2026-07-05" — date portion of snapshot_at_utc
}

const COMP_META: Omit<CompetitorRow, "theirN" | "theirRoi" | "ourN" | "ourRoi" | "ourMatched" | "windowStart" | "windowEnd" | "snapshotAt">[] = [
  { name: "WinnerOdds",  url: "https://winnerodds.com",     color: "emerald", ledgerKey: "winnerodds" },
  { name: "SignalOdds",  url: "https://signalodds.com",     color: "sky",     ledgerKey: "signalodds" },
  { name: "DeepBetting", url: "https://deepbetting.io",     color: "orange",  ledgerKey: "deepbetting" },
  { name: "Tipstrr",     url: "https://tipstrr.com/football", color: "rose",  ledgerKey: "tipstrr" },
  { name: "Forebet",     url: "https://www.forebet.com",    color: "amber",   ledgerKey: "forebet" },
];

// Last-known good values, refreshed weekly by odds-intel-engine's
// competitor_audits_weekly.yml (Sunday 02:00 UTC). If the GitHub fetch
// fails or the JSON shape is unexpected, we fall back to these so the
// landing never renders empty rows.
// LAST-REFRESH: 2026-07-06 audit snapshot.
const COMP_FALLBACK: Record<
  string,
  { theirN: number; theirRoi: number; ourN: number; ourRoi: number;
    windowStart: string; windowEnd: string; snapshotAt: string }
> = {
  winnerodds:  { theirN: 1124, theirRoi:  6.49, ourN:  963, ourRoi: 12.97,
                 windowStart: "2026-05-04", windowEnd: "2026-06-25", snapshotAt: "2026-07-05" },
  signalodds:  { theirN: 1157, theirRoi: -0.44, ourN: 1039, ourRoi: 12.56,
                 windowStart: "2026-05-04", windowEnd: "2026-07-06", snapshotAt: "2026-07-05" },
  deepbetting: { theirN:  235, theirRoi: -9.15, ourN: 1039, ourRoi: 12.56,
                 windowStart: "2026-05-04", windowEnd: "2026-07-06", snapshotAt: "2026-07-05" },
  tipstrr:     { theirN:  209, theirRoi: -5.22, ourN: 1039, ourRoi: 12.56,
                 windowStart: "2026-05-04", windowEnd: "2026-07-06", snapshotAt: "2026-07-05" },
  forebet:     { theirN: 1434, theirRoi: 15.33, ourN: 1039, ourRoi: 12.56,
                 windowStart: "2026-05-04", windowEnd: "2026-07-06", snapshotAt: "2026-07-05" },
};

const LEDGER_RAW =
  "https://raw.githubusercontent.com/msellin/odds-intel-engine/main/ledger";

// Human-friendly date rendering. Landing surfaces ISO strings from the
// engine (2026-05-04) but they read as machine-y — mobile audit flagged
// non-technical visitors parse "May 4" much faster. Kept short so the
// audit-window line stays a single row on narrow viewports.
function fmtDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

// Year-less variant for cramped meta rows (WinnerOdds' outlier-window
// annotation inline with the bet count on iPhone SE). Year context
// lives in the hero card date range above.
function fmtShortDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [, m, d] = iso.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[m - 1]} ${d}`;
}

async function loadCompetitors(): Promise<CompetitorRow[]> {
  const rows = await Promise.all(
    COMP_META.map(async (m) => {
      const fb = COMP_FALLBACK[m.ledgerKey];
      let theirN = fb.theirN;
      let theirRoi = fb.theirRoi;
      let ourN = fb.ourN;
      let ourRoi = fb.ourRoi;
      let windowStart = fb.windowStart;
      let windowEnd = fb.windowEnd;
      let snapshotAt = fb.snapshotAt;
      try {
        const res = await fetch(
          `${LEDGER_RAW}/comparison_${m.ledgerKey}.json`,
          { next: { revalidate: 21600 } }, // 6h
        );
        if (res.ok) {
          const j = (await res.json()) as {
            status?: string;
            snapshot_at_utc?: string;
            window?: { start?: string; end?: string };
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
            windowStart = j.window?.start ?? windowStart;
            windowEnd = j.window?.end ?? windowEnd;
            // snapshot_at_utc is a full ISO datetime; the landing shows
            // just the date portion so the string stays readable.
            snapshotAt = j.snapshot_at_utc?.slice(0, 10) ?? snapshotAt;
          }
        }
      } catch {
        // network error → keep fallback values
      }
      return {
        ...m,
        theirN, theirRoi, ourN, ourRoi,
        ourMatched: { roiPct: ourRoi, n: ourN },
        windowStart, windowEnd, snapshotAt,
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
  // COHORT-DISCLOSURE (2026-07-06): pick the widest-window competitor for
  // the hero card, not competitors[0]. WinnerOdds' window closes ~10 days
  // earlier than the others, so competitors[0] undercounts our matched
  // cohort by ~75 bets. Pick by max n across all comparisons so the hero
  // reflects the broadest same-window sample we can honestly show.
  const heroComp =
    competitors.reduce<CompetitorRow | null>(
      (best, c) => (best === null || c.ourN > best.ourN ? c : best),
      null,
    );
  const ourMatched = heroComp?.ourMatched ?? { roiPct: 12.56, n: 1039 };
  const heroWindowStart = heroComp?.windowStart ?? "2026-05-04";
  const heroWindowEnd = heroComp?.windowEnd ?? "2026-07-06";
  const heroSnapshotAt = heroComp?.snapshotAt ?? "2026-07-05";

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-50 antialiased">
      <Nav />

      {/* ───────── Hero ───────── */}
      {/* Container widened max-w-4xl → max-w-5xl per desktop audit —
          at ≥1440px the previous 896px column left ~54% of the viewport
          as empty gutter. The hero copy stays narrow via its own
          nested max-w wrapper so ledger CTAs don't spread thin. */}
      <main className="mx-auto max-w-5xl px-4">
        <section className="pt-14 pb-10 sm:pt-20">
          <div className="mx-auto max-w-3xl space-y-5 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
              Verified football track record
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              {roi !== null ? (
                <>
                  <span className="text-emerald-400">
                    {roi > 0 ? "+" : ""}
                    {roi.toFixed(2)}% ROI
                  </span>
                  <span className="mt-2 block text-lg font-normal text-neutral-400 sm:text-2xl">
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
            {/* CTAs stack vertically on mobile so Telegram doesn't orphan
                onto its own row; row layout at ≥sm as before. */}
            <div className="flex flex-col items-stretch justify-center gap-3 pt-1 sm:flex-row sm:items-center">
              <Link
                href="/picks"
                className="rounded-md bg-emerald-500 px-5 py-2.5 text-center text-sm font-semibold text-neutral-950 hover:bg-emerald-400"
              >
                See today&apos;s picks
              </Link>
              <Link
                href="/performance"
                className="rounded-md border border-white/15 bg-white/[0.04] px-5 py-2.5 text-center text-sm font-semibold text-neutral-100 hover:bg-white/[0.08]"
              >
                View track record
              </Link>
              <Link
                href="https://t.me/oddsintelpicks"
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-center text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                Telegram
              </Link>
            </div>
          </div>
        </section>

        {/* ───────── Metric strip — the ledger self-label ─────────
            Divider color bumped from bg-white/[0.02] → bg-white/[0.08]
            so the 4-cell grid stays visually separated on mobile
            (previous contrast disappeared into a single blob).
            The scope caption below is the anchor that answers
            "which cohort is this?" without a separate footnote:
            all pre-match markets, actual placed stakes. */}
        <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.08]">
          <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
            <Metric
              label="Settled bets"
              value={total.toLocaleString()}
              sub={`since ${fmtDate(since)}`}
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
              sub="vs closing line"
              accent={beat !== null && beat >= 50 ? "positive" : null}
            />
          </div>
          <p className="border-t border-white/[0.04] bg-neutral-950 px-4 py-2.5 text-center text-[11px] uppercase tracking-widest text-neutral-500">
            Full pre-match cohort · 1X2 + OU 2.5 + BTTS · actual placed stakes
          </p>
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
        <section className="mt-14">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Head-to-head vs other public models
          </h2>

          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
            {/* OddsIntel hero strip — shown ONCE at the top. Now
                self-labels its cohort inline (1X2 + OU 2.5 · €10 flat
                stake · matched window) so the reader can see, at the
                same visual level as the number, why this ROI differs
                from the ledger strip above. Replaces the paragraph
                footnote that used to live below the comparison block. */}
            <div className="border-b border-white/[0.06] bg-gradient-to-b from-emerald-500/[0.10] to-emerald-500/[0.02] px-5 py-6 text-center">
              <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-400">
                Matched-window audit
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
              <p className="mt-3 text-[11px] uppercase tracking-widest text-neutral-500">
                1X2 + OU 2.5 · €10 flat stake
              </p>
              <p className="mt-1 font-mono text-[11px] tabular-nums text-neutral-500">
                {fmtDate(heroWindowStart)} → {fmtDate(heroWindowEnd)}
                <span className="mx-2 text-neutral-700">·</span>
                audit {fmtDate(heroSnapshotAt)}
              </p>
            </div>

            {/* Competitor rows — trimmed per UX audit:
                  · Dropped the text-[9px] "in our favour" / "against us"
                    micro-label (arrow color already conveys direction).
                  · Dropped per-row window strings (all four non-WinnerOdds
                    rows had identical dates — repetition, and on iPhone SE
                    the string wrapped to 3 lines and broke row alignment).
                    Common window lives in the hero card above; only
                    WinnerOdds — the outlier ending 2026-06-25 — is
                    annotated inline so honest disclosure survives. */}
            <div className="divide-y divide-white/[0.04]">
              {competitors.map((c) => {
                // Per-competitor delta: each row uses ITS OWN matched-window
                // ourRoi (not the global one) so the math is internally
                // consistent for any sub-window like WinnerOdds' shorter
                // cutoff or Forebet's 38-day cap.
                const delta = c.ourRoi - c.theirRoi;
                const initial = c.name[0];
                const isOutlierWindow = c.windowEnd !== heroWindowEnd;
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
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full font-mono text-sm font-bold ring-1 ring-inset ${avatarBg}`}
                      aria-hidden
                    >
                      {initial}
                    </div>

                    <div className="min-w-0">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="block truncate text-sm font-semibold text-neutral-200 hover:text-neutral-100 hover:underline"
                      >
                        {c.name}{" "}
                        <span className="font-mono text-[10px] font-normal text-neutral-500">↗</span>
                      </a>
                      <p className={`mt-0.5 font-mono text-base font-semibold tabular-nums sm:text-lg ${
                        c.theirRoi >= 0 ? "text-neutral-300" : "text-red-400"
                      }`}>
                        {c.theirRoi > 0 ? "+" : ""}{c.theirRoi.toFixed(2)}% ROI
                      </p>
                      <p className="font-mono text-[11px] tabular-nums text-neutral-500">
                        {c.theirN.toLocaleString()} bets
                        {isOutlierWindow && (
                          <>
                            <span className="mx-1.5 text-neutral-700">·</span>
                            {/* Short form "→ Jun 25" fits on one line at
                                iPhone SE (375px) alongside the bet count;
                                the previous "through Jun 25, 2026" was 3
                                chars too wide and wrapped to 3 lines,
                                making WinnerOdds visibly taller than the
                                other 4 rows. Year context stays in the
                                hero card window above. */}
                            → {fmtShortDate(c.windowEnd)}
                          </>
                        )}
                      </p>
                    </div>

                    {/* Delta — arrow + color carry direction; no
                        text label needed. Sign handled inside toFixed(),
                        prefix "+" added only for positive deltas so
                        negative rows don't render "+-N.NN". */}
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
                        {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : "— "}
                        {delta.toFixed(2)}pp
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ───────── Verification strip ─────────
            Surfaces the 4 independent trust anchors that make the
            landing's ROI numbers falsifiable: public API, GitHub-signed
            commits, Bitcoin/OpenTimestamps proofs, and the audit scripts
            themselves. Sat previously as one inline "How we verify →"
            link buried in a footnote — the desktop UX audit called that
            the biggest credibility miss on the page.
            Layout: single column on mobile (the initial 2-col grid
            truncated pill titles on iPhone SE — only ~99px available for
            text after the icon container, but "Signed daily commits"
            needs ~124px), 4-col row on ≥sm. mt-8 tightened from mt-10
            per the desktop audit's whitespace nit above this strip. */}
        <section className="mt-8" aria-label="Verification">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Every pick is independently verifiable
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <VerifyPill
              href="/api/v1/track-record"
              icon={<Database className="h-4 w-4" />}
              title="Public JSON API"
              sub="every settled bet"
            />
            <VerifyPill
              href="https://github.com/msellin/odds-intel-engine/tree/main/ledger"
              icon={<GitCommit className="h-4 w-4" />}
              title="Signed daily commits"
              sub="GitHub-authored"
            />
            <VerifyPill
              href="/methodology#opentimestamps"
              icon={<Anchor className="h-4 w-4" />}
              title="Bitcoin timestamps"
              sub="tamper-evident"
            />
            <VerifyPill
              href="https://github.com/msellin/odds-intel-engine/tree/main/scripts"
              icon={<Terminal className="h-4 w-4" />}
              title="Reproducible audits"
              sub="rerun the scripts"
            />
          </div>
          <p className="mt-3 text-center text-[11px] text-neutral-500">
            <Link href="/methodology" className="text-emerald-400 hover:underline">
              Full methodology →
            </Link>
          </p>
        </section>

        {/* ───────── Follow-along email capture ─────────
            Reframed from "Premium tier — coming later" (which read as
            a hesitant paid-tier tease at ~0 users pre-PMF). Now positions
            the list honestly as a "notify me when something ships" signup
            — new picks, milestones, or a paid tier if we build one. Same
            underlying /api/v1/waitlist endpoint. */}
        <section className="mt-12">
          <PremiumWaitlistForm />
        </section>

        {/* ───────── Responsible Gambling notice ───────── */}
        <div className="mt-10 rounded-lg border border-white/[0.06] bg-white/[0.03] px-6 py-3 text-center text-xs text-neutral-400">
          <span className="font-semibold text-neutral-100">Responsible Gambling:</span>{" "}
          Betting involves risk. Data provides intelligence, not certainty.
          18+ Only.
        </div>

        {/* ───────── Footer ─────────
            Partner badges demoted from a standalone mt-12 section into
            a subdued grayscale row here — preserves the reciprocal
            backlinks (Twelve Tools + AIBoom poll this page) without
            the "affiliate-y" visual weight the desktop audit flagged. */}
        <footer className="mt-16 mb-12 border-t border-white/[0.06] pt-8 text-xs text-neutral-500">
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
          {/* Partner badges — equal-column grid so the three badges
              (which have different intrinsic widths) all center inside
              consistent slots instead of clustering left with a lonely
              orphan on the right. h-5 keeps them subordinate to the
              footer copy above. */}
          <div
            aria-label="Featured on"
            className="mt-6 grid grid-cols-3 items-center gap-4 opacity-40 grayscale transition-opacity hover:opacity-70"
          >
            <a
              href="https://twelve.tools"
              target="_blank"
              rel="noopener noreferrer"
              className="flex justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://twelve.tools/badge0-dark.svg"
                alt="Featured on Twelve Tools"
                className="h-5 w-auto"
                loading="lazy"
              />
            </a>
            <a
              href="https://wired.business"
              target="_blank"
              rel="noopener noreferrer"
              className="flex justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://wired.business/badge0-dark.svg"
                alt="Featured on Wired Business"
                className="h-5 w-auto"
                loading="lazy"
              />
            </a>
            <a
              href="https://aiboom.tools"
              target="_blank"
              rel="noopener noreferrer"
              className="flex justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://aiboom.tools/badge/badge_dark.svg"
                alt="Featured on AIBoom.Tools"
                className="h-5 w-auto"
                loading="lazy"
              />
            </a>
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
      <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
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
        // Sub-label size + contrast bumped per mobile audit — these
        // carry the most concrete verification detail (P&L, staked
        // total, CLV vs Pinnacle) and were previously the smallest text
        // on the page. text-xs is the WCAG-safe floor for small text.
        <p className="mt-1.5 text-xs text-neutral-400">{sub}</p>
      )}
    </div>
  );
}

// Verification-strip pill. External links get target=_blank; internal
// links (/api/v1/track-record, /methodology) don't. Kept simple —
// icon + two-line label — to fit four per row on desktop and two per
// row on mobile without wrapping.
function VerifyPill({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  const external = href.startsWith("http");
  const cls =
    "group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-emerald-500/25 hover:bg-white/[0.04]";
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/15">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-neutral-200">
          {title}
        </span>
        <span className="block truncate text-[11px] text-neutral-500">
          {sub}
        </span>
      </span>
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="nofollow noopener noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}
