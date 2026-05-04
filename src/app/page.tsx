import Link from "next/link";
import { Check, X, Minus } from "lucide-react";
import { PricingCards } from "@/components/pricing-cards";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const brokenTabs = [
  "SoccerStats",
  "Transfermarkt",
  "WhoScored",
  "OddsPortal",
  "PremierInjuries",
  "Twitter / X",
  "Weather.com",
  "FBref",
];

const sampleBookmakers = [
  { name: "Bet365",      h: "2.10", d: "3.45", a: "1.85", bestH: false, bestD: false, bestA: false },
  { name: "William Hill", h: "2.15", d: "3.40", a: "1.80", bestH: true,  bestD: false, bestA: false },
  { name: "Unibet",      h: "2.05", d: "3.50", a: "1.90", bestH: false, bestD: true,  bestA: true  },
];

/* ── Comparison matrix rows, grouped by tier ── */
type ComparisonRow =
  | { type: "category"; label: string }
  | { type: "row"; feature: string; free: boolean; pro: boolean; elite: boolean };

const comparisonRows: ComparisonRow[] = [
  { type: "category", label: "Always available — no account needed" },
  { type: "row", feature: "All fixtures across 280+ leagues", free: true, pro: true, elite: true },
  { type: "row", feature: "Live scores (auto-refresh)", free: true, pro: true, elite: true },
  { type: "row", feature: "Best available odds (across all bookmakers)", free: true, pro: true, elite: true },
  { type: "row", feature: "H2H, standings & team form", free: true, pro: true, elite: true },

  { type: "category", label: "Free account" },
  { type: "row", feature: "Favourite teams & leagues", free: true, pro: true, elite: true },
  { type: "row", feature: "\"My Matches\" personalised feed", free: true, pro: true, elite: true },
  { type: "row", feature: "Prediction tracker & hit rate", free: true, pro: true, elite: true },
  { type: "row", feature: "Match notes & saved matches", free: true, pro: true, elite: true },
  { type: "row", feature: "Community match voting", free: true, pro: true, elite: true },
  { type: "row", feature: "1 AI value pick per day", free: true, pro: true, elite: true },

  { type: "category", label: "Pro — real-time edge" },
  { type: "row", feature: "Full odds — 13 bookmakers compared", free: false, pro: true, elite: true },
  { type: "row", feature: "Odds movement chart", free: false, pro: true, elite: true },
  { type: "row", feature: "Injury & suspension reports", free: false, pro: true, elite: true },
  { type: "row", feature: "Confirmed lineups + formations", free: false, pro: true, elite: true },
  { type: "row", feature: "Post-match stats (xG, shots, possession)", free: false, pro: true, elite: true },

  { type: "category", label: "Elite — serious analytics" },
  { type: "row", feature: "All AI value bets (full daily list)", free: false, pro: false, elite: true },
  { type: "row", feature: "AI probability & market edge % (vs bookmaker)", free: false, pro: false, elite: true },
  { type: "row", feature: "CLV tracking (did you beat the closing line?)", free: false, pro: false, elite: true },
  { type: "row", feature: "Track record & ROI analytics", free: false, pro: false, elite: true },
  { type: "row", feature: "AI strategy performance data", free: false, pro: false, elite: true },
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
    q: "Is the free plan really free forever?",
    a: "Yes. No credit card, no trial period that expires. The free tier gives you fixtures across 280+ leagues, live scores, personalisation, and 1 AI value pick per day — permanently.",
  },
  {
    q: "How do the AI picks work?",
    a: "Our model combines bookmaker pricing, team form, H2H records, confirmed lineups, and market movement. When it spots a statistical edge it flags the match as a value bet — something you can act on or simply track.",
  },
  {
    q: "What is CLV tracking?",
    a: "Closing Line Value (CLV) measures whether a bet was placed at better odds than where the market closed. It's the most reliable long-term indicator of a profitable strategy. OddsIntel Elite tracks CLV for every AI model pick, so you can see whether the model is consistently finding genuine value.",
  },
  {
    q: "What are the founding member rates?",
    a: "The first 500 Pro subscribers lock in €3.99/mo forever (vs the regular €4.99/mo). The first 200 Elite subscribers lock in €9.99/mo forever. Your rate never increases as long as you stay subscribed.",
  },
];

function CellIcon({ value }: { value: boolean }) {
  return value ? (
    <Check className="mx-auto size-4 text-green-500" />
  ) : (
    <Minus className="mx-auto size-4 text-muted-foreground/30" />
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
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
              <span className="ml-3 font-mono text-[10px] text-muted-foreground/80">oddsintel.app/matches</span>
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
          <p className="mt-2 text-center text-[10px] text-muted-foreground/80">Sample data — illustrative</p>
        </div>
      </section>

      <Separator />

      {/* ───────── Problem / 8 tabs ───────── */}
      <section className="bg-card/20 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="flex flex-col justify-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 md:col-span-4">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Stop opening 8 tabs.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                By the time you&apos;ve checked injuries, lineups, and odds movement across 8 different sites, the value is already gone.
              </p>
            </div>
            <div className="flex flex-col justify-center rounded-xl border border-white/[0.06] p-8 md:col-span-8">
              <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Your typical match-day routine
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {brokenTabs.map((tab) => (
                  <div key={tab} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
                    <X className="size-3.5 shrink-0 text-red-500/70" />
                    <span className="text-muted-foreground">{tab}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2.5 text-center">
                <span className="font-mono text-sm text-green-400">OddsIntel: One screen. 2 seconds.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

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
              <span className="text-[10px] text-muted-foreground/80">Sample data — illustrative only</span>
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
              { stat: "16",   label: "AI strategies running live" },
              { stat: "100+",  label: "European leagues covered" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-center">
                <p className="font-mono text-3xl font-black text-green-400">{item.stat}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            AI strategies have been placing paper bets daily since April 2026.{" "}
            <Link href="/track-record" className="text-green-400 underline underline-offset-2 hover:text-green-300">
              View track record →
            </Link>
          </p>
        </div>
      </section>

      <Separator />

      {/* ───────── Pricing Cards ───────── */}
      <section className="py-14" id="pricing">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Simple pricing. Cancel anytime.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start free. Upgrade when you want deeper betting intelligence.
            </p>
          </div>

          <PricingCards />

        </div>
      </section>

      <Separator />

      {/* ───────── Feature Comparison Matrix ───────── */}
      <section className="py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              What you get at each level
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Free account unlocks personalisation, tracking, and daily AI picks. No credit card needed.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-white/[0.06] bg-muted/30">
                  <th className="py-3 pl-4 pr-2 text-left text-xs font-medium text-muted-foreground w-[52%]">Feature</th>
                  <th className="py-3 px-3 text-center text-xs font-medium text-foreground w-[16%]">
                    <div>Free</div>
                    <div className="font-mono text-[10px] text-green-400">€0</div>
                  </th>
                  <th className="py-3 px-3 text-center text-xs font-medium w-[16%]">
                    <div className="text-green-400">Pro</div>
                    <div className="font-mono text-[10px] text-green-400">€4.99/mo</div>
                  </th>
                  <th className="py-3 pl-3 pr-4 text-center text-xs font-medium w-[16%]">
                    <div className="text-amber-400">Elite</div>
                    <div className="font-mono text-[10px] text-amber-400">€14.99/mo</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {comparisonRows.map((row, i) => {
                  if (row.type === "category") {
                    return (
                      <tr key={i} className="bg-white/[0.02]">
                        <td colSpan={4} className="py-2 pl-4 pr-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                          {row.label}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 pl-4 pr-2 text-sm text-foreground/80">{row.feature}</td>
                      <td className="py-2.5 px-3"><CellIcon value={row.free} /></td>
                      <td className="py-2.5 px-3"><CellIcon value={row.pro} /></td>
                      <td className="py-2.5 pl-3 pr-4"><CellIcon value={row.elite} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      </section>

      <Separator />

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

      {/* ───────── Footer ───────── */}
      <footer className="py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="font-mono text-base font-black uppercase italic tracking-tight text-white whitespace-nowrap">
            ODDS<span className="text-green-500 ml-[0.15em]">INTEL</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} OddsIntel</span>
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
