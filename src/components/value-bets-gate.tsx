"use client";

import { TrendingUp, Zap, BarChart3, Lock } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

const WHAT_YOU_GET = [
  {
    icon: Zap,
    title: "Edge detection",
    desc: "See every match where our model gives you a statistical advantage over the bookmakers.",
  },
  {
    icon: TrendingUp,
    title: "Exact model probability",
    desc: "Not just who we think wins — exact % and how far the market has mispriced it.",
  },
  {
    icon: BarChart3,
    title: "Closing line value tracking",
    desc: "After each match, see if your bets beat the closing odds — the gold standard for long-term profitability.",
  },
];

export function ValueBetsGate() {
  const { openLoginModal } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <Lock className="h-5 w-5 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Value Bets</h1>
        <p className="text-muted-foreground">
          Where the model beats the bookmakers. Available on Pro and Elite.
        </p>
      </div>

      {/* What you get */}
      <div className="space-y-3">
        {WHAT_YOU_GET.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-4 rounded-xl border border-border/40 bg-card/40 px-4 py-4"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Icon className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Blurred preview rows */}
      <div className="relative overflow-hidden rounded-xl border border-border/40">
        <div className="divide-y divide-border/20 blur-sm select-none pointer-events-none" aria-hidden>
          {[
            { match: "Arsenal vs Chelsea", league: "Premier League", pick: "Home", edge: "+9.2%", odds: "1.85" },
            { match: "Bayern vs Dortmund", league: "Bundesliga", pick: "Away", edge: "+6.7%", odds: "3.40" },
            { match: "PSG vs Lyon", league: "Ligue 1", pick: "Over 2.5", edge: "+5.1%", odds: "1.72" },
          ].map((row) => (
            <div key={row.match} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{row.match}</p>
                <p className="text-xs text-muted-foreground">{row.league}</p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <span>{row.pick}</span>
                <span className="font-mono">{row.odds}</span>
                <span className="font-mono font-semibold text-emerald-400">{row.edge}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Overlay CTA */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Sign in to see today&apos;s value bets</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Free to sign up — no card required</p>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          onClick={openLoginModal}
          className="rounded-md bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Sign In
        </button>
        <Link
          href="/how-it-works"
          className="rounded-md border border-border px-6 py-2.5 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          How does it work?
        </Link>
      </div>

      <p className="text-center text-xs text-muted-foreground/60">
        Model accuracy and full track record are{" "}
        <Link href="/track-record" className="text-primary underline-offset-2 hover:underline">
          publicly visible
        </Link>
        {" "}— judge for yourself before signing up.
      </p>
    </div>
  );
}
