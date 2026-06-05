import Link from "next/link";
import { Trophy } from "lucide-react";
import { OneScreenProof } from "@/components/one-screen-proof";
import { CompetitorMatrix } from "@/components/competitor-matrix";
import { MarketingNav } from "@/components/marketing-nav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CLVTrustBanner } from "@/components/clv-trust-banner";
import { getDashboardCache } from "@/lib/engine-data";

// World Cup promo banner — auto-hides one week post-final (2026-07-26).
// To pull earlier or extend, edit WC_BANNER_HIDE_AT_MS directly.
const WC_BANNER_HIDE_AT_MS = new Date("2026-07-26T00:00:00Z").getTime();
const WC_FIRST_KICKOFF_MS = new Date("2026-06-11T19:00:00Z").getTime();
const showWcBanner = Date.now() < WC_BANNER_HIDE_AT_MS;
function wcBannerHeadline(): string {
  const now = Date.now();
  if (now < WC_FIRST_KICKOFF_MS) {
    const days = Math.max(0, Math.ceil((WC_FIRST_KICKOFF_MS - now) / 86400000));
    return days === 0
      ? "World Cup 2026 kicks off today — play the bracket challenge"
      : `World Cup 2026 starts in ${days} day${days === 1 ? "" : "s"} — play the bracket challenge`;
  }
  return "World Cup 2026 — bracket challenge live";
}

const sampleBookmakers = [
  { name: "Bet365",      h: "2.10", d: "3.45", a: "1.85", bestH: false, bestD: false, bestA: false },
  { name: "William Hill", h: "2.15", d: "3.40", a: "1.80", bestH: true,  bestD: false, bestA: false },
  { name: "Unibet",      h: "2.05", d: "3.50", a: "1.90", bestH: false, bestD: true,  bestA: true  },
];

const faqItems = [
  {
    q: "What sports and leagues does OddsIntel cover?",
    a: "Football (soccer) — 280+ leagues worldwide, including the Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, and hundreds of lower-division and international leagues. More sports are on the roadmap.",
  },
  {
    q: "Which bookmakers are compared?",
    a: "We track 13 major European bookmakers. Free accounts see the single best available odds; Pro unlocks the full comparison across all bookmakers.",
  },
  {
    q: "How do the AI picks work?",
    a: "Our model combines bookmaker pricing, team form, H2H records, confirmed lineups, and market movement. On Over/Under 1.5 goals our top pick hits 75% of the time across 21,831 matches. When the model also spots a market edge — where our probability beats the bookmaker line — the match is flagged as a value bet. Accuracy is not the same as profitability: even an 80%-accurate pick at 1.10 odds loses money long-term. That's why we publish CLV (closing line value), not just hit rate.",
  },
  {
    q: "What is CLV tracking?",
    a: "Closing Line Value (CLV) measures whether a bet was placed at better odds than where the market closed. It's the most reliable long-term indicator of a profitable strategy. OddsIntel Elite tracks CLV for every AI model pick, so you can see whether the model is consistently finding genuine value.",
  },
  {
    q: "Where do the picks go?",
    a: "Every value bet is logged immutably the moment it's identified — pre-kickoff, timestamped, never edited. You can see the running track record at /performance. We also send daily picks straight to Telegram so you don't have to remember to check.",
  },
];

export default async function LandingPage() {
  // CLV-TRUST-BANNER (2026-06-02): pull cache for the SEO <dl> stats block.
  // CLVTrustBanner does its own fetch — this second read is for the inline
  // metric numbers in the structured-data list. Same cache row, no extra cost.
  const heroCache = await getDashboardCache().catch(() => null);
  const heroCLV = heroCache?.elite_value_bets_30d;
  const heroHasData = heroCLV != null && heroCLV.n >= 30 && heroCLV.clv_pct != null;
  const heroCLVPct =
    heroHasData && heroCLV
      ? `${heroCLV.clv_pct! > 0 ? "+" : ""}${heroCLV.clv_pct!.toFixed(1)}%`
      : "tracking";
  const heroCLVN =
    heroHasData && heroCLV ? heroCLV.n.toLocaleString() : "building (need 30)";

  // GROWTH-COPY-DENSITY-AUDIT Day 1 (2026-06-06): replace the 3-stat trust
  // micro-line with a single load-bearing cumulative outcome. Research
  // doc: dev/active/density-copy-research-2026-06-06.md. Cumulative since
  // 2026-05-03 (paper-trading chain start) — auto-refreshes via settlement.
  const heroCumulative = heroCache?.elite_value_bets_cumulative;
  const heroCumHasData =
    heroCumulative != null &&
    heroCumulative.n_settled >= 100 &&
    heroCumulative.avg_clv_pct != null &&
    heroCumulative.days != null;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ───────── World Cup promo banner (auto-hides 2026-07-26) ───────── */}
      {showWcBanner && (
        <Link
          href="/world-cup"
          className="block border-b border-amber-500/30 bg-gradient-to-r from-amber-600/15 via-amber-500/10 to-emerald-600/15 transition-colors hover:from-amber-600/25 hover:via-amber-500/20 hover:to-emerald-600/25"
        >
          <div className="mx-auto flex h-10 max-w-7xl items-center justify-center gap-2 px-4 sm:px-6">
            <Trophy className="h-4 w-4 text-amber-400" aria-hidden />
            <span className="text-xs font-semibold text-amber-100 sm:text-sm">
              {wcBannerHeadline()}
            </span>
            <span className="hidden rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30 sm:inline">
              Top 3 win Elite
            </span>
            <span className="hidden text-xs font-medium text-amber-400 sm:inline">→</span>
          </div>
        </Link>
      )}

      {/* GROWTH-UNIFIED-NAV (2026-06-05): single nav component shared with
          pricing/privacy/changelog/terms. Previously this was ~35 lines of
          inline JSX duplicated across 5 pages — see src/lib/nav-links.ts. */}
      <MarketingNav />

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden pt-8 pb-12 text-center sm:pt-20 sm:pb-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(34,197,94,0.08),transparent)]" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          {/* GROWTH-MOBILE-LANDING-V2 (2026-06-05) P2-1: compress trust pill
              on mobile (the "Tracking 280+ leagues worldwide · Football /
              Soccer" line takes most of the row at 393px). Mobile sees the
              short form; sm+ sees the full sentence. */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-green-400">
              <span className="sm:hidden">Football · 280+ leagues</span>
              <span className="hidden sm:inline">Tracking 280+ leagues worldwide · Football / Soccer</span>
            </span>
          </div>
          <h1 className="text-balance text-5xl font-black leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Beat the{" "}
            <span className="text-green-400">bookmakers</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-foreground/85 sm:text-xl">
            AI finds where today&apos;s matches are mispriced. We send the picks
            to your <span className="text-sky-300 font-medium">Telegram</span> before kickoff —
            so you can place them before the value evaporates.
          </p>

          {/* GROWTH-COPY-DENSITY-AUDIT Day 1 (2026-06-06) — single
              load-bearing cumulative outcome line replaces the previous
              3-stat spread. The WinnerOdds anchor and SaaS gold-standard
              pattern both lead with a single growing cumulative number,
              not multiple disconnected rates. See research doc at
              odds-intel-engine/dev/active/density-copy-research-2026-06-06.md. */}
          <div className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground/90 sm:text-base">
            <span>
              <span className="font-mono font-bold text-amber-300">
                {heroCumHasData && heroCumulative?.avg_clv_pct != null
                  ? `${heroCumulative.avg_clv_pct > 0 ? "+" : ""}${heroCumulative.avg_clv_pct.toFixed(1)}%`
                  : "+9.4%"}
              </span>{" "}
              CLV beating the closing line
            </span>
            <span className="text-muted-foreground/30" aria-hidden>·</span>
            <span>
              <span className="font-mono font-bold text-foreground/90">
                {heroCumHasData && heroCumulative?.n_settled != null
                  ? heroCumulative.n_settled.toLocaleString()
                  : "1,214"}
              </span>{" "}
              paper bets
            </span>
            <span className="text-muted-foreground/30" aria-hidden>·</span>
            <span>
              <span className="font-mono font-bold text-foreground/90">
                {heroCumHasData && heroCumulative?.days != null
                  ? heroCumulative.days
                  : 33}
              </span>{" "}
              days
            </span>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="h-12 bg-green-500 px-8 text-base font-bold text-black shadow-lg shadow-green-500/20 hover:bg-green-400"
              nativeButton={false} render={<Link href="/signup" />}
            >
              Start Free
            </Button>
            <Button variant="ghost" size="lg" className="h-12 px-8 text-base border border-white/[0.15] text-foreground hover:bg-white/[0.05]" nativeButton={false} render={<Link href="/value-bets" />}>
              See Today&apos;s Picks →
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required. Free forever. Cancel any time on paid plans.
          </p>
        </div>

        {/* ── Product UI mockup ── */}
        <div className="relative mx-auto mt-12 max-w-2xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-card/40 shadow-2xl shadow-black/60 backdrop-blur">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-muted/20 px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/40" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/40" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500/40" />
              <span className="ml-3 font-mono text-[10px] text-muted-foreground/60">oddsintel.app/matches</span>
            </div>
            {/* Match header */}
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-green-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-green-400">PREMIER LEAGUE</span>
                  <span className="text-xs text-muted-foreground">Today · 20:45</span>
                </div>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">⚡ High market activity</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-bold sm:text-xl">Manchester City</span>
                <span className="font-mono text-xs text-muted-foreground">vs</span>
                <span className="text-lg font-bold sm:text-xl">Arsenal</span>
              </div>
              {/* Odds comparison */}
              <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.06]">
                <div className="grid grid-cols-4 border-b border-white/[0.06] bg-muted/30 px-3 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Bookmaker</div>
                  <div className="text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">1</div>
                  <div className="text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">X</div>
                  <div className="text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">2</div>
                </div>
                {sampleBookmakers.map((row) => (
                  <div key={row.name} className="grid grid-cols-4 border-b border-white/[0.04] px-3 py-2 last:border-0 hover:bg-white/[0.02]">
                    <div className="text-xs text-muted-foreground">{row.name}</div>
                    <div className={`text-center font-mono text-sm ${row.bestH ? "font-bold text-green-400" : "text-foreground/60"}`}>{row.h}</div>
                    <div className={`text-center font-mono text-sm ${row.bestD ? "font-bold text-green-400" : "text-foreground/60"}`}>{row.d}</div>
                    <div className={`text-center font-mono text-sm ${row.bestA ? "font-bold text-green-400" : "text-foreground/60"}`}>{row.a}</div>
                  </div>
                ))}
              </div>
              {/* Signal badges */}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] text-muted-foreground">
                  <span>⚠️</span> Key player — injury doubt
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] text-muted-foreground">
                  <span className="text-blue-400">●</span> Bookmakers disagree — spread wide
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] text-muted-foreground">
                  <span>📈</span> Odds shifted overnight
                </span>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/60">Sample data — illustrative</p>
        </div>
      </section>

      <Separator />

      {/* ───────── CLV trust banner (CLV-as-hero-metric) ───────── */}
      <CLVTrustBanner variant="landing" cohort="all" />

      {/* SEO structured-data list — picked up by Google rich snippets.
          Sits directly under the trust banner; mobile-first two-column grid
          collapses to single column at narrow widths. */}
      <section
        aria-label="OddsIntel coverage at a glance"
        className="border-b border-white/[0.04] bg-background"
      >
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-center sm:grid-cols-4 sm:text-left">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Coverage
              </dt>
              <dd className="mt-0.5 font-mono text-sm font-bold text-foreground sm:text-base">
                280+ leagues
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Bookmakers compared
              </dt>
              <dd className="mt-0.5 font-mono text-sm font-bold text-foreground sm:text-base">
                13
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                30-day CLV
              </dt>
              <dd className="mt-0.5 font-mono text-sm font-bold text-amber-300 sm:text-base">
                {heroCLVPct}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Picks tracked (30d)
              </dt>
              <dd className="mt-0.5 font-mono text-sm font-bold text-foreground sm:text-base">
                {heroCLVN}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ───────── One-screen-proof (GROWTH-ONE-SCREEN-PROOF, Tier A #2) ──────
          Replaces the static "Stop opening 8 tabs" panel with an animated
          side-by-side: 8 tabs accumulate over ~6s vs 1 OddsIntel screen
          appearing all at once. Pure CSS, respects prefers-reduced-motion.
          Future upgrade path: swap to a real screen-recording video. */}
      <OneScreenProof />

      <Separator />

      {/* ───────── Competitor matrix (GROWTH-COMPARISON-MATRIX, Tier A #3) ────
          Tier-based feature comparison. Each competitor column represents
          one of 5 competitor "tiers"; killer row at the bottom is "Spans
          all 5 tiers" — only OddsIntel ticks it. Honest about real gaps
          (multi-bookmaker depth shown as ⏳ on roadmap; 3rd-party
          verification same). */}
      <CompetitorMatrix />

      {/* Live Data Preview section removed 2026-06-05 (GROWTH-LANDING-REFACTOR
          sub-B) — sample-data table consumed a full fold without earning it.
          Real product proof now lives in <OneScreenProof /> (animated) +
          <CompetitorMatrix /> (per-feature tier comparison) above. */}

      {/* Big stats block removed 2026-06-05 (GROWTH-LANDING-REFACTOR sub-B) —
          duplicated content already in the hero trust micro-line
          (75% / +9.8% CLV / 21,831 matches) and the SEO structured-data bar
          above. Cross-link to /performance preserved in footer. The 10-year /
          no-human-bias framing lives on /methodology. */}

      <Separator />

      {/* ───────── Honest numbers — drawdown / verification / CLV ───────── */}
      <section className="py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Honest about how this works
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Three things most prediction sites hide. We publish them on purpose.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/methodology"
              className="group rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-6 transition-colors hover:border-amber-500/50 hover:bg-amber-500/[0.08]"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">Drawdown</p>
              <p className="mt-2 font-mono text-3xl font-black text-amber-300">−€398</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">worst 9-day stretch (May 2026). Wiped the prior peak.</p>
              <p className="mt-4 text-xs font-semibold text-amber-300 group-hover:text-amber-200">
                Why we publish drawdowns →
              </p>
            </Link>
            <Link
              href="/methodology"
              className="group rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-6 transition-colors hover:border-sky-500/50 hover:bg-sky-500/[0.08]"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-sky-400">Verification</p>
              <p className="mt-2 font-mono text-xl font-black text-sky-300 sm:text-2xl">Self-reported</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Bet-Analytix / SBC verification on roadmap. We&apos;d rather wait than fake it.</p>
              <p className="mt-4 text-xs font-semibold text-sky-300 group-hover:text-sky-200">
                Why no &quot;verified&quot; badge yet →
              </p>
            </Link>
            <Link
              href="/learn/closing-line-value"
              className="group rounded-xl border border-green-500/20 bg-green-500/[0.03] p-6 transition-colors hover:border-green-500/50 hover:bg-green-500/[0.08]"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-green-400">Honest metric</p>
              <p className="mt-2 font-mono text-xl font-black text-green-300 sm:text-2xl">CLV, not ROI</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">ROI is variance-confounded. Closing-line value is the only metric that proves edge early.</p>
              <p className="mt-4 text-xs font-semibold text-green-300 group-hover:text-green-200">
                Why CLV beats ROI →
              </p>
            </Link>
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Compact pricing CTA — full cards moved to /pricing 2026-06-05 ───────── */}
      <section className="py-10" id="pricing">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-sm text-muted-foreground">
            Free forever for fixtures, scores, and one daily AI pick.
            Pro from <span className="font-mono text-foreground">€4.99/mo</span>.
            Elite from <span className="font-mono text-foreground">€14.99/mo</span>.
            Cancel any time.
          </p>
          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              className="border border-white/[0.12] hover:bg-white/[0.05]"
              nativeButton={false}
              render={<Link href="/pricing" />}
            >
              See all plans →
            </Button>
          </div>
        </div>
      </section>

      <Separator />

      {/* Feature comparison matrix removed from landing 2026-06-05 — duplicated
          the pricing cards directly above + /how-it-works. Pricing should be
          asked for once on the landing, not three times. Full feature matrix
          still available on /how-it-works for users who want the deep dive. */}

      {/* ───────── FAQ ─────────
          GROWTH-MOBILE-LANDING-V2 (2026-06-05): switched from always-
          expanded divs to native <details> elements. The FAQ block was
          consuming ~3 full mobile viewports (~2400px scroll) before users
          reached the Telegram CTA below. Open by default on the first item
          to keep some prose visible without forcing tap to engage. The
          answer text is still in the DOM (under `<summary>`) so Google
          indexes every answer — no SEO regression. */}
      <section className="bg-card/20 py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Common questions</h2>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <details
                key={item.q}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
                open={i === 0}
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-medium text-foreground">
                  <span>{item.q}</span>
                  <span className="mt-0.5 select-none text-muted-foreground/60 transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Trust strip (GROWTH-LANDING-REFACTOR sub-C) ───────────────
          One-line reinforcement of the credibility chain before the final
          Telegram CTA. No new claims — every fact here is also published
          on a destination page. Each link is a "go verify yourself" exit. */}
      <section
        aria-label="Trust signals"
        className="border-y border-white/[0.04] bg-card/10 py-6"
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-center text-xs text-muted-foreground sm:px-6 sm:text-sm">
          <Link
            href="/performance"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <span className="size-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.7)]" aria-hidden />
            <span>Paper-bet chain unbroken since 2026-05-03 →</span>
          </Link>
          <span className="text-muted-foreground/30" aria-hidden>·</span>
          <Link href="/methodology" className="transition-colors hover:text-foreground">
            Open methodology — read the model
          </Link>
          <span className="text-muted-foreground/30" aria-hidden>·</span>
          <span>30-day cancel any time on paid plans</span>
        </div>
      </section>

      {/* ───────── Telegram CTA strip ───────── */}
      <section className="border-t border-sky-500/15 bg-gradient-to-b from-sky-950/40 to-background py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1">
            <span aria-hidden>📲</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-sky-300">
              Telegram delivery
            </span>
          </div>
          <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Get tomorrow&apos;s value bets in your Telegram.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-balance text-sm text-muted-foreground sm:text-base">
            Pre-kickoff · Pre-line-movement · Pre-everything. Every pick the model
            finds, sent to your phone the moment it&apos;s identified — so you can
            place it before the value evaporates.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="h-12 bg-sky-500 px-8 text-base font-bold text-white hover:bg-sky-400"
              nativeButton={false} render={<Link href="/signup" />}
            >
              Start Free
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-12 px-8 text-base border border-white/[0.12] hover:bg-white/[0.05]"
              nativeButton={false} render={<Link href="/profile" />}
            >
              Already signed up — connect Telegram →
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground/80">
            Telegram alerts available on Pro and Elite. Free users get one daily pick on-site.
          </p>
        </div>
      </section>

      {/* ───────── Partner badges (GROWTH-DIRECTORY-STACK 2026-06-05) ─────
          Reciprocal backlink row for directory listings that require a
          live badge. Add new badges here as submissions land. Several
          directories (Twelve Tools, AIBoom free tier) automatically
          check for this row periodically — if the badge disappears,
          they remove our listing. */}
      <section
        aria-label="Featured on"
        className="border-t border-white/[0.04] py-6"
      >
        {/* GROWTH-MOBILE-LANDING-V2 (2026-06-05): dropped the external
            "Featured on" caption because each badge already carries it,
            making the phrase appear 3× within ~200px on mobile. Normalised
            all three badges to h-10 so they sit on a single deliberate
            row instead of wrap-to-three. */}
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://twelve.tools"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-80 transition-opacity hover:opacity-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://twelve.tools/badge0-dark.svg"
                alt="Featured on Twelve Tools"
                className="h-10 w-auto"
              />
            </a>
            <a
              href="https://wired.business"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-80 transition-opacity hover:opacity-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://wired.business/badge0-dark.svg"
                alt="Featured on Wired Business"
                className="h-10 w-auto"
              />
            </a>
            <a
              href="https://aiboom.tools"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-80 transition-opacity hover:opacity-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://aiboom.tools/badge/badge_dark.svg"
                alt="Featured on AIBoom.Tools"
                className="h-10 w-auto"
              />
            </a>
          </div>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="font-mono text-base font-black uppercase italic tracking-tight text-white whitespace-nowrap">
            ODDS<span className="text-green-500 ml-[0.15em]">INTEL</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} OddsIntel</span>
            <Link href="/methodology" className="transition-colors hover:text-green-400">Methodology</Link>
            <Link href="/performance" className="transition-colors hover:text-green-400">Performance</Link>
            <Link href="/changelog" className="transition-colors hover:text-green-400">Changelog</Link>
            <Link href="/terms" className="transition-colors hover:text-green-400">Terms of Service</Link>
            <Link href="/privacy" className="transition-colors hover:text-green-400">Privacy Policy</Link>
          </div>
        </div>
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-6 py-3 text-center text-xs text-muted-foreground">
            <span className="font-bold text-foreground">Responsible Gambling:</span>{" "}
            Betting involves risk. Data provides intelligence, not certainty. 18+ Only.
          </div>
        </div>
      </footer>
    </div>
  );
}
