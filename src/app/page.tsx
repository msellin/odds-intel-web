import Link from "next/link";
import { Trophy } from "lucide-react";
import { OneScreenProof } from "@/components/one-screen-proof";
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

      {/* ───────── Nav ───────── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-mono text-xl font-black uppercase italic tracking-tight text-white whitespace-nowrap">
              ODDS<span className="text-green-500 ml-[0.15em]">INTEL</span>
            </span>
            <span className="rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 px-1.5 py-0.5 border border-amber-500/30">Beta</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/matches" className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block">
              Matches
            </Link>
            <Link href="/pricing" className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block">
              Pricing
            </Link>
            <Link href="/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Log In
            </Link>
            <Button size="sm" className="bg-green-700 text-white hover:bg-green-800" nativeButton={false} render={<Link href="/signup" />}>
              Sign Up Free
            </Button>
          </div>
        </div>
      </nav>

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden pt-20 pb-16 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(34,197,94,0.08),transparent)]" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-green-400">
              Tracking 280+ leagues worldwide · Football / Soccer
            </span>
          </div>
          <h1 className="text-balance text-4xl font-black leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Spot value before the market moves.{" "}
            <span className="text-green-500">One screen.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            Compare odds across 13 bookmakers, check confirmed lineups and injuries, get daily AI value picks — all in one place.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-balance text-sm text-sky-300/90">
            <span aria-hidden>📲</span> Every value bet straight to your Telegram — the moment we find it.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="h-12 bg-green-700 px-8 text-base font-bold text-white hover:bg-green-800"
              nativeButton={false} render={<Link href="/signup" />}
            >
              Start Free
            </Button>
            <Button variant="ghost" size="lg" className="h-12 px-8 text-base border border-white/[0.12] hover:bg-white/[0.05]" nativeButton={false} render={<Link href="/matches" />}>
              See Live Matches
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required. Free forever — upgrade when you&apos;re ready.
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
                <span className="text-base font-bold sm:text-lg">Manchester City</span>
                <span className="font-mono text-xs text-muted-foreground">vs</span>
                <span className="text-base font-bold sm:text-lg">Arsenal</span>
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

      {/* ───────── Live Data Preview ───────── */}
      <section className="py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Live data preview
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Football · Premier League · La Liga · Bundesliga · Serie A · Champions League · and 280+ more leagues worldwide
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.06]">
            <div className="grid grid-cols-12 items-center border-b border-white/[0.06] bg-muted/30 px-4 py-2.5">
              <div className="col-span-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Time</div>
              <div className="col-span-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Matchup</div>
              <div className="col-span-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">1</div>
              <div className="col-span-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">X</div>
              <div className="col-span-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">2</div>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {[
                { time: "19:45", home: "Liverpool", away: "Real Madrid", h: 2.1, d: 3.45, a: 3.1, hot: true, bestIdx: 0 },
                { time: "20:00", home: "AC Milan", away: "Dortmund", h: 2.45, d: 3.2, a: 2.85, hot: false, bestIdx: 2 },
                { time: "20:00", home: "PSG", away: "Newcastle", h: 1.65, d: 4.1, a: 5.5, hot: true, bestIdx: 0 },
              ].map((m, i) => (
                <div key={i} className="grid h-10 grid-cols-12 items-center px-4 hover:bg-white/[0.02]">
                  <div className="col-span-1 font-mono text-xs text-muted-foreground">{m.time}</div>
                  <div className="col-span-5 flex items-center gap-2 text-sm font-medium text-foreground">
                    {m.hot && <span className="text-xs">🔥</span>}
                    {m.home} vs {m.away}
                  </div>
                  <div className={`col-span-2 text-center font-mono text-sm ${m.bestIdx === 0 ? "font-bold text-green-400" : "text-muted-foreground"}`}>{m.h.toFixed(2)}</div>
                  <div className={`col-span-2 text-center font-mono text-sm ${m.bestIdx === 1 ? "font-bold text-green-400" : "text-muted-foreground"}`}>{m.d.toFixed(2)}</div>
                  <div className={`col-span-2 text-center font-mono text-sm ${m.bestIdx === 2 ? "font-bold text-green-400" : "text-muted-foreground"}`}>{m.a.toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/[0.06] bg-muted/10 px-4 py-2 text-right">
              <span className="text-[10px] text-muted-foreground/60">Sample data — illustrative only</span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Trust / Stats ───────── */}
      <section className="bg-card/20 py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Built on real data, not guesswork</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every number on OddsIntel comes from live sources — updated continuously throughout the day.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { stat: "280+", label: "leagues tracked worldwide" },
              { stat: "13",   label: "bookmakers compared" },
              { stat: "75%",  label: "accuracy on Over/Under 1.5 goals" },
              { stat: "100+",  label: "European leagues covered" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-center">
                <p className="font-mono text-3xl font-black text-green-400">{item.stat}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Tracked across 21,831 finished matches since 2023. AI strategies place paper bets daily since April 2026.{" "}
            <Link href="/performance" className="text-green-400 underline underline-offset-2 hover:text-green-300">
              View track record →
            </Link>
          </p>
          <p className="mt-3 text-center text-xs text-muted-foreground/80">
            Built on 10+ years of historical match data. No tipsters, no human bias — just statistical models updated continuously.
          </p>
        </div>
      </section>

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
              className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:border-amber-500/30 hover:bg-amber-500/[0.04]"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400/80">Drawdown</p>
              <p className="mt-2 font-mono text-2xl font-black text-amber-300">−€398</p>
              <p className="mt-1 text-xs text-muted-foreground">worst 9-day stretch (May 2026). Wiped the prior peak.</p>
              <p className="mt-3 text-xs font-medium text-amber-400 group-hover:text-amber-300">
                Why we publish drawdowns →
              </p>
            </Link>
            <Link
              href="/methodology"
              className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:border-blue-500/30 hover:bg-blue-500/[0.04]"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-blue-400/80">Verification</p>
              <p className="mt-2 font-mono text-2xl font-black text-blue-300">Self-reported</p>
              <p className="mt-1 text-xs text-muted-foreground">Bet-Analytix / SBC verification on roadmap. We&apos;d rather wait than fake it.</p>
              <p className="mt-3 text-xs font-medium text-blue-400 group-hover:text-blue-300">
                Why no &quot;verified&quot; badge yet →
              </p>
            </Link>
            <Link
              href="/learn/clv"
              className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:border-green-500/30 hover:bg-green-500/[0.04]"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-green-400/80">Honest metric</p>
              <p className="mt-2 font-mono text-2xl font-black text-green-300">CLV, not ROI</p>
              <p className="mt-1 text-xs text-muted-foreground">ROI is variance-confounded. Closing-line value is the only metric that proves edge early.</p>
              <p className="mt-3 text-xs font-medium text-green-400 group-hover:text-green-300">
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

      {/* ───────── FAQ ───────── */}
      <section className="bg-card/20 py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Common questions</h2>
          </div>
          <div className="space-y-3">
            {faqItems.map((item) => (
              <div key={item.q} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-5">
                <p className="font-medium text-foreground">{item.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

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
            Pre-kickoff. Pre-line-movement. Pre-everything. Every pick the model
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
