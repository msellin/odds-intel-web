import Link from "next/link";
import {
  TrendingUp,
  BarChart3,
  Brain,
  Target,
  Zap,
  Eye,
  Globe,
  Check,
  CheckCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const stats = [
  { label: "Bets Tracked", value: "247" },
  { label: "Hit Rate", value: "56.3%" },
  { label: "ROI", value: "+4.2%" },
  { label: "Bankroll", value: "\u20AC1,247" },
];

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

const features = [
  {
    icon: BarChart3,
    title: "Live Odds Comparison",
    description:
      "Compare 40+ bookmakers, spot the best price instantly.",
  },
  {
    icon: Brain,
    title: "AI Match Analysis",
    description:
      "Full reasoning, not just picks. Understand WHY.",
  },
  {
    icon: Target,
    title: "Value Detection",
    description:
      "Model probability vs implied odds. See the edge.",
  },
  {
    icon: Zap,
    title: "News Impact Alerts",
    description:
      "Injury breaks \u2192 model updates \u2192 push notification before odds move.",
  },
  {
    icon: Eye,
    title: "Transparent Track Record",
    description:
      "Every bet shown. Wins AND losses. No cherry-picking.",
  },
  {
    icon: Globe,
    title: "30+ Leagues Covered",
    description:
      "From Premier League to Championship, Serie B to 2. Bundesliga.",
  },
];

const tiers = [
  {
    name: "Scout",
    price: "Free",
    priceNote: null,
    badge: null,
    highlight: false,
    features: [
      "Today\u2019s matches (top 5 leagues)",
      "Basic stats (form, last 5, league position)",
      "Head-to-head records",
      "Match results",
    ],
  },
  {
    name: "Analyst",
    price: "\u20AC4.99",
    priceNote: "/mo",
    badge: "POPULAR",
    highlight: false,
    features: [
      "Everything in Scout, plus:",
      "ALL leagues (30+ competitions)",
      "Full injury/suspension tracker",
      "Confirmed lineups",
      "Odds comparison (40+ bookmakers)",
      "Odds movement history",
      "Weather + referee data",
      "xG and advanced stats",
    ],
  },
  {
    name: "Sharp",
    price: "\u20AC14.99",
    priceNote: "/mo",
    badge: null,
    highlight: true,
    features: [
      "Everything in Analyst, plus:",
      "AI match analysis with reasoning",
      "Value bet detection",
      "News impact alerts",
      "Confidence scores",
      "Track record dashboard",
      "Personal bankroll tracker",
      "Kelly stake suggestions",
    ],
  },
  {
    name: "Syndicate",
    price: "\u20AC49.99",
    priceNote: "/mo",
    badge: null,
    highlight: false,
    features: [
      "Everything in Sharp, plus:",
      "API access",
      "Webhook alerts",
      "CSV/Excel export",
      "Steam move detection",
      "CLV tracking",
      "Custom league focus",
      "Early access to features",
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ───────── Sticky Nav ───────── */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-1.5 font-mono text-lg font-bold tracking-tight">
            <TrendingUp className="size-5 text-green-500" />
            <span>
              ODDS<span className="text-green-500">INTEL</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link href="/login" />}>
              Log In
            </Button>
            <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" render={<Link href="/signup" />}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden">
        {/* Subtle radial glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(34,197,94,0.08),transparent)]" />

        <div className="mx-auto max-w-4xl px-4 pb-20 pt-24 text-center sm:px-6 sm:pt-32">
          <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            All your pre-match intelligence.{" "}
            <span className="text-green-500">One screen.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            AI-powered value detection, real-time odds, injuries, lineups, and a
            transparent track record. Stop opening 8 tabs.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="h-11 bg-green-600 px-6 text-base text-white hover:bg-green-700"
              render={<Link href="/signup" />}
            >
              Start Free
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-11 px-6 text-base"
              render={<Link href="/track-record" />}
            >
              See Track Record
            </Button>
          </div>

          {/* Mock stat row */}
          <div className="mx-auto mt-14 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-border/60 bg-card/60 px-4 py-3 backdrop-blur"
              >
                <div className="font-mono text-xl font-semibold text-green-500">
                  {s.value}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Problem Section ───────── */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          The serious bettor&apos;s workflow is{" "}
          <span className="text-red-500">broken</span>
        </h2>

        <div className="mx-auto mt-12 max-w-lg">
          <div className="rounded-xl border border-border/60 bg-card/40 p-6">
            <p className="mb-4 text-center text-sm font-medium text-muted-foreground">
              A typical match-day routine
            </p>
            <div className="grid grid-cols-2 gap-2">
              {brokenTabs.map((tab) => (
                <div
                  key={tab}
                  className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm"
                >
                  <X className="size-3.5 shrink-0 text-red-500/70" />
                  <span className="text-muted-foreground">{tab}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center font-mono text-sm text-red-400">
              20-30 min per match
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="size-5 text-green-500" />
              <span className="text-lg font-semibold">
                OddsIntel: One screen.{" "}
                <span className="font-mono text-green-500">2 seconds.</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Features ───────── */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need.{" "}
          <span className="text-green-500">Nothing you don&apos;t.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
          Built for bettors who take edge seriously.
        </p>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="border-border/50 bg-card/60">
              <CardHeader>
                <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-green-500/10">
                  <f.icon className="size-5 text-green-500" />
                </div>
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {f.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* ───────── Pricing ───────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Simple pricing. Cancel anytime.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-center text-muted-foreground">
          Start free, upgrade when you&apos;re ready.
        </p>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={
                tier.highlight
                  ? "relative border-green-500/60 bg-card/80 ring-1 ring-green-500/30"
                  : "border-border/50 bg-card/60"
              }
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  {tier.badge && (
                    <Badge className="bg-green-600 text-white text-[10px] uppercase">
                      {tier.badge}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-bold tracking-tight">
                    {tier.price}
                  </span>
                  {tier.priceNote && (
                    <span className="text-sm text-muted-foreground">
                      {tier.priceNote}
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col">
                <ul className="flex-1 space-y-2">
                  {tier.features.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  <Button
                    className={
                      tier.highlight
                        ? "w-full bg-green-600 text-white hover:bg-green-700"
                        : "w-full"
                    }
                    variant={tier.highlight ? "default" : "outline"}
                    render={<Link href="/signup" />}
                  >
                    {tier.price === "Free" ? "Get Started" : "Start Free Trial"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* ───────── Trust ───────── */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          We don&apos;t sell tips.{" "}
          <span className="text-green-500">
            We show you what the data says.
          </span>
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-sm text-muted-foreground">
          For informational purposes only. Past performance does not guarantee
          future results. Bet responsibly.
        </p>
      </section>

      <Separator />

      {/* ───────── Footer ───────── */}
      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex items-center gap-1.5 font-mono text-sm font-bold tracking-tight">
          <TrendingUp className="size-4 text-green-500" />
          <span>
            ODDS<span className="text-green-500">INTEL</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} OddsIntel</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
