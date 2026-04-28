import Link from "next/link";
import { Check, X, Minus } from "lucide-react";
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

const sampleMatches = [
  { time: "19:45", home: "Liverpool", away: "Real Madrid", h: 2.1, d: 3.45, a: 3.1, hot: true, bestIdx: 0 },
  { time: "20:00", home: "AC Milan", away: "Dortmund", h: 2.45, d: 3.2, a: 2.85, hot: false, bestIdx: 2 },
  { time: "20:00", home: "PSG", away: "Newcastle", h: 1.65, d: 4.1, a: 5.5, hot: true, bestIdx: 0 },
];

/* ── Comparison matrix rows ── */
const comparisonRows = [
  { feature: "Browse 400+ daily fixtures", anonymous: true, free: true, pro: true, elite: true },
  { feature: "Live scores (auto-refresh)", anonymous: true, free: true, pro: true, elite: true },
  { feature: "Best odds (1 bookmaker)", anonymous: true, free: true, pro: true, elite: true },
  { feature: "H2H, standings & team form", anonymous: true, free: true, pro: true, elite: true },
  { feature: "Favorite teams & leagues", anonymous: false, free: true, pro: true, elite: true },
  { feature: "\"My Matches\" personalized feed", anonymous: false, free: true, pro: true, elite: true },
  { feature: "Prediction tracker & hit rate", anonymous: false, free: true, pro: true, elite: true },
  { feature: "Match notes & saved matches", anonymous: false, free: true, pro: true, elite: true },
  { feature: "Community match voting", anonymous: false, free: true, pro: true, elite: true },
  { feature: "1 free AI value pick per day", anonymous: false, free: true, pro: true, elite: true },
  { feature: "Full odds — multiple bookmakers", anonymous: false, free: false, pro: true, elite: true },
  { feature: "Odds movement chart", anonymous: false, free: false, pro: true, elite: true },
  { feature: "Injury & suspension alerts", anonymous: false, free: false, pro: true, elite: true },
  { feature: "Confirmed lineups + formations", anonymous: false, free: false, pro: true, elite: true },
  { feature: "Post-match stats (xG, shots, possession)", anonymous: false, free: false, pro: true, elite: true },
  { feature: "All AI value bets (full list)", anonymous: false, free: false, pro: false, elite: true },
  { feature: "Model probability & edge %", anonymous: false, free: false, pro: false, elite: true },
  { feature: "CLV tracking", anonymous: false, free: false, pro: false, elite: true },
  { feature: "Track record & ROI analytics", anonymous: false, free: false, pro: false, elite: true },
  { feature: "Bot-validated strategies", anonymous: false, free: false, pro: false, elite: true },
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
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-mono text-xl font-black uppercase italic tracking-tight text-white">
            ODDS<span className="text-green-500">INTEL</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/matches" className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block">
              Matches
            </Link>
            <Link href="/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Log In
            </Link>
            <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" render={<Link href="/signup" />}>
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
              Tracking 400+ fixtures daily
            </span>
          </div>
          <h1 className="text-balance text-4xl font-black leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            All your pre-match intelligence.{" "}
            <span className="text-green-500">One screen.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            Compare odds across bookmakers, check lineups and injuries, track your picks — all in one place. Free to start.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="h-12 bg-green-600 px-8 text-base font-bold text-white hover:bg-green-700"
              render={<Link href="/signup" />}
            >
              Create Free Account
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-8 text-base" render={<Link href="/matches" />}>
              Browse Matches
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required. Free forever — upgrade when you&apos;re ready.
          </p>
        </div>
      </section>

      <Separator />

      {/* ───────── Problem ───────── */}
      <section className="bg-card/20 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="flex flex-col justify-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 md:col-span-4">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Stop opening 8 tabs.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Fragmented data leads to slow decisions. OddsIntel unifies lineups, injuries, and odds in one view.
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
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Live data preview
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            400+ fixtures daily across 30+ leagues. Instant odds comparison.
          </p>

          <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.06]">
            <div className="grid grid-cols-12 items-center border-b border-white/[0.06] bg-muted/30 px-4 py-2.5">
              <div className="col-span-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Time</div>
              <div className="col-span-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Matchup</div>
              <div className="col-span-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">1</div>
              <div className="col-span-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">X</div>
              <div className="col-span-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">2</div>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {sampleMatches.map((m, i) => (
                <div key={i} className="grid h-10 grid-cols-12 items-center px-4 hover:bg-white/[0.02]">
                  <div className="col-span-1 font-mono text-xs text-muted-foreground">{m.time}</div>
                  <div className="col-span-5 flex items-center gap-2 text-sm font-medium text-foreground">
                    {m.hot && <span className="text-xs text-orange-400">🔥</span>}
                    {m.home} vs {m.away}
                  </div>
                  <div className={`col-span-2 text-center font-mono text-sm ${m.bestIdx === 0 ? "font-bold text-green-400" : "text-muted-foreground"}`}>{m.h.toFixed(2)}</div>
                  <div className={`col-span-2 text-center font-mono text-sm ${m.bestIdx === 1 ? "font-bold text-green-400" : "text-muted-foreground"}`}>{m.d.toFixed(2)}</div>
                  <div className={`col-span-2 text-center font-mono text-sm ${m.bestIdx === 2 ? "font-bold text-green-400" : "text-muted-foreground"}`}>{m.a.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Feature Comparison Matrix ───────── */}
      <section className="py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              What you get at each level
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Free account unlocks personalization, tracking, and daily AI picks. No credit card needed.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-white/[0.06] bg-muted/30">
                  <th className="py-3 pl-4 pr-2 text-left text-xs font-medium text-muted-foreground w-[40%]">Feature</th>
                  <th className="py-3 px-2 text-center text-xs font-medium text-muted-foreground w-[15%]">
                    <span className="text-muted-foreground/60">No account</span>
                  </th>
                  <th className="py-3 px-2 text-center text-xs font-medium text-foreground w-[15%]">
                    <div>Free</div>
                    <div className="font-mono text-[10px] text-green-400">€0</div>
                  </th>
                  <th className="py-3 px-2 text-center text-xs font-medium w-[15%]">
                    <div className="text-green-400">Pro</div>
                    <div className="font-mono text-[10px] text-green-400">€4.99/mo</div>
                  </th>
                  <th className="py-3 pl-2 pr-4 text-center text-xs font-medium w-[15%]">
                    <div className="text-amber-400">Elite</div>
                    <div className="font-mono text-[10px] text-amber-400">€14.99/mo</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pl-4 pr-2 text-sm text-foreground/80">{row.feature}</td>
                    <td className="py-2.5 px-2"><CellIcon value={row.anonymous} /></td>
                    <td className="py-2.5 px-2"><CellIcon value={row.free} /></td>
                    <td className="py-2.5 px-2"><CellIcon value={row.pro} /></td>
                    <td className="py-2.5 pl-2 pr-4"><CellIcon value={row.elite} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-center">
            <Button size="lg" className="h-12 bg-green-600 px-8 text-base font-bold text-white hover:bg-green-700" render={<Link href="/signup" />}>
              Create Free Account
            </Button>
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Pricing Cards with Founding Member + Annual ───────── */}
      <section className="py-14" id="pricing">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Simple pricing. Cancel anytime.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start free. Upgrade when you want deeper intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Free */}
            <div className="relative flex flex-col rounded-xl border border-white/[0.06] bg-card/20 p-7">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Free</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">€0</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Personalize, track picks, daily AI teaser</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {[
                  "All fixtures + live scores",
                  "Favorite teams & My Matches",
                  "Prediction tracker & hit rate",
                  "1 free AI value pick / day",
                  "Match notes & community voting",
                  "Saved matches watchlist",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button className="w-full" variant="outline" render={<Link href="/signup" />}>
                  Create Free Account
                </Button>
              </div>
            </div>

            {/* Pro */}
            <div className="relative flex flex-col rounded-xl border-2 border-green-500 bg-card/60 p-7 shadow-2xl shadow-green-500/5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-black">
                Most Popular
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pro</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">€4.99</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground line-through">€4.99</span>
                <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-bold text-green-400">
                  Founders: €3.99/mo
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Annual: €39.99/yr (€3.33/mo)
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {[
                  "Everything in Free",
                  "Odds comparison — multiple bookmakers",
                  "Odds movement chart",
                  "AI injury & suspension alerts",
                  "Lineups + formation view",
                  "Post-match stats & xG",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button className="w-full bg-green-500 font-bold text-black hover:bg-green-400" render={<Link href="/signup" />}>
                  Start Pro
                </Button>
              </div>
            </div>

            {/* Elite */}
            <div className="relative flex flex-col rounded-xl border border-amber-500/30 bg-card/20 p-7">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-black">
                Coming Soon
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Elite</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">€14.99</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground line-through">€14.99</span>
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                  Founders: €9.99/mo
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Annual: €119.99/yr (€9.99/mo)
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {[
                  "Everything in Pro",
                  "All AI value bets (full daily list)",
                  "Model probability & edge %",
                  "CLV tracking — beat the closing line",
                  "Track record & ROI analytics",
                  "Bot-validated strategies",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10" variant="outline" render={<Link href="/signup" />}>
                  Join Waitlist
                </Button>
              </div>
            </div>
          </div>

          {/* Founding member urgency */}
          <div className="mt-6 rounded-lg border border-green-500/20 bg-green-500/[0.06] px-5 py-4 text-center">
            <p className="text-sm text-foreground">
              <span className="font-bold text-green-400">Founding Member pricing</span> — first 500 subscribers lock in reduced rates forever.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pro at €3.99/mo and Elite at €9.99/mo — prices go up after launch.
            </p>
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Elite Coming Soon ───────── */}
      <section className="py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] px-8 py-10 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(245,158,11,0.06),transparent)]" />
            <div className="relative space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
                  Elite Tier — Coming Q2 2026
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-foreground">
                We only launch picks when the data says so.
              </h2>
              <p className="mx-auto max-w-lg text-sm text-muted-foreground leading-relaxed">
                Our bots are running live, accumulating real settlement data. Elite launches
                the moment we hit 60+ settled bets with verified positive ROI.
              </p>
              <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-amber-400"
                >
                  Get Notified at Launch
                </Link>
              </div>
              <div className="pt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 text-left">
                {[
                  { stat: "6", label: "bots running live" },
                  { stat: "60+", label: "settled bets to launch" },
                  { stat: "+21%", label: "ROI on best signal" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <p className="font-mono text-xl font-bold text-amber-400">{item.stat}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Footer ───────── */}
      <footer className="py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="font-mono text-base font-black uppercase italic tracking-tight text-white">
            ODDS<span className="text-green-500">INTEL</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} OddsIntel</span>
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
