import Link from "next/link";
import { TrendingUp, Check, X } from "lucide-react";
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
  {
    time: "19:45",
    home: "Liverpool",
    away: "Real Madrid",
    h: 2.10,
    d: 3.45,
    a: 3.10,
    hot: true,
    bestIdx: 0,
  },
  {
    time: "20:00",
    home: "AC Milan",
    away: "Dortmund",
    h: 2.45,
    d: 3.20,
    a: 2.85,
    hot: false,
    bestIdx: 2,
  },
  {
    time: "20:00",
    home: "PSG",
    away: "Newcastle",
    h: 1.65,
    d: 4.10,
    a: 5.50,
    hot: true,
    bestIdx: 0,
  },
];

const features = [
  {
    icon: "📊",
    title: "Interest Indicators",
    description: "Visual heatmaps for smart money movement.",
  },
  {
    icon: "⚖️",
    title: "Bookie Comparison",
    description: "Best odds across 2–3 tier-1 bookmakers.",
  },
  {
    icon: "⚡",
    title: "Daily Fixtures",
    description: "400+ matches per day across 30+ leagues.",
  },
];

const tiers = [
  {
    name: "Free",
    price: "€0",
    priceNote: "/mo",
    badge: null,
    highlight: false,
    cta: "Get Started",
    features: [
      "All matches, basic odds (best H/D/A)",
      "Interest indicators",
      "Match detail pages",
    ],
  },
  {
    name: "Pro",
    price: "€19",
    priceNote: "/mo",
    badge: "Most Popular",
    highlight: true,
    cta: "Upgrade to Pro",
    features: [
      "Full odds comparison",
      "Form & H2H stats",
      "AI injury alerts",
      "Odds movement history",
    ],
  },
  {
    name: "Elite",
    price: "€49",
    priceNote: "/mo",
    badge: null,
    highlight: false,
    cta: "Contact Sales",
    features: [
      "Model probabilities",
      "Value bet picks",
      "CLV tracking",
      "Tips from validated bots",
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ───────── Sticky Nav ───────── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="font-mono text-xl font-black uppercase italic tracking-tight text-white"
          >
            ODDS<span className="text-green-500">INTEL</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/matches"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Matches
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Log In
            </Link>
            <Button
              size="sm"
              className="bg-green-600 text-white hover:bg-green-700"
              render={<Link href="/signup" />}
            >
              Get Started
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
              Live Match Intelligence Active
            </span>
          </div>
          <h1 className="text-balance text-4xl font-black leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            All your pre-match intelligence.{" "}
            <span className="text-green-500">One screen.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            High-performance football intelligence for serious bettors.
            Consolidate your workflow into a single terminal.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="h-11 bg-green-600 px-8 text-base font-bold text-white hover:bg-green-700"
              render={<Link href="/matches" />}
            >
              Browse Today&apos;s Matches
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-11 px-8 text-base font-bold"
              render={<Link href="/signup" />}
            >
              Sign Up Free
            </Button>
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Problem ───────── */}
      <section className="bg-card/20 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Left: text */}
            <div className="flex flex-col justify-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 backdrop-blur md:col-span-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Stop opening 8 tabs.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Fragmented data leads to slow decisions. OddsIntel unifies
                  lineups, injuries, and odds in one view.
                </p>
              </div>
            </div>
            {/* Right: broken tabs grid */}
            <div className="flex flex-col justify-center rounded-xl border border-white/[0.06] p-8 md:col-span-8">
              <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Your typical match-day routine
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {brokenTabs.map((tab) => (
                  <div
                    key={tab}
                    className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm"
                  >
                    <X className="size-3.5 shrink-0 text-red-500/70" />
                    <span className="text-muted-foreground">{tab}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2.5 text-center">
                <span className="font-mono text-sm text-green-400">
                  OddsIntel: One screen. 2 seconds.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Features / Data Table ───────── */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                High-Velocity Data Stream
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tracking 400+ fixtures daily across 30+ leagues. Instant odds
                comparison.
              </p>
            </div>
            <div className="flex gap-2">
              {["Premier League", "La Liga", "Bundesliga"].map((l) => (
                <span
                  key={l}
                  className="hidden rounded border border-white/[0.06] bg-muted/30 px-3 py-1 font-mono text-xs text-muted-foreground sm:block"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>

          {/* Sample data table */}
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            {/* Header */}
            <div className="grid grid-cols-12 items-center border-b border-white/[0.06] bg-muted/30 px-4 py-2.5">
              <div className="col-span-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Time
              </div>
              <div className="col-span-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Matchup
              </div>
              <div className="col-span-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                1
              </div>
              <div className="col-span-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                X
              </div>
              <div className="col-span-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                2
              </div>
            </div>
            {/* Rows */}
            <div className="divide-y divide-white/[0.04]">
              {sampleMatches.map((m, i) => (
                <div
                  key={i}
                  className="grid h-10 grid-cols-12 items-center px-4 hover:bg-white/[0.02]"
                >
                  <div className="col-span-1 font-mono text-xs text-muted-foreground">
                    {m.time}
                  </div>
                  <div className="col-span-5 flex items-center gap-2 text-sm font-medium text-foreground">
                    {m.hot && (
                      <span className="text-xs text-orange-400">🔥</span>
                    )}
                    {m.home} vs {m.away}
                  </div>
                  <div
                    className={`col-span-2 text-center font-mono text-sm ${m.bestIdx === 0 ? "font-bold text-green-400" : "text-muted-foreground"}`}
                  >
                    {m.h.toFixed(2)}
                  </div>
                  <div
                    className={`col-span-2 text-center font-mono text-sm ${m.bestIdx === 1 ? "font-bold text-green-400" : "text-muted-foreground"}`}
                  >
                    {m.d.toFixed(2)}
                  </div>
                  <div
                    className={`col-span-2 text-center font-mono text-sm ${m.bestIdx === 2 ? "font-bold text-green-400" : "text-muted-foreground"}`}
                  >
                    {m.a.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature cards */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {f.title}
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Pricing ───────── */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Pricing for every level of play
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose the intelligence tier that fits your volume.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-xl p-8 ${
                  tier.highlight
                    ? "border-2 border-green-500 bg-card/60 shadow-2xl shadow-green-500/5"
                    : "border border-white/[0.06] bg-card/20"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-black">
                    {tier.badge}
                  </div>
                )}
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {tier.name}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    {tier.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tier.priceNote}
                  </span>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-2.5 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Button
                    className={`w-full ${
                      tier.highlight
                        ? "bg-green-500 font-bold text-black hover:bg-green-400"
                        : ""
                    }`}
                    variant={tier.highlight ? "default" : "outline"}
                    render={<Link href="/signup" />}
                  >
                    {tier.cta}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Trust ───────── */}
      <section className="py-16 text-center">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            We show you what the data says.
          </h2>
          <div className="mt-6 inline-block rounded-lg border border-white/[0.06] bg-white/[0.03] px-6 py-3 text-xs text-muted-foreground">
            <span className="font-bold text-foreground">
              Responsible Gambling:
            </span>{" "}
            Betting involves risk. Data provides intelligence, not certainty.
            18+ Only.
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
            <Link
              href="/terms"
              className="transition-colors hover:text-green-400"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="transition-colors hover:text-green-400"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
