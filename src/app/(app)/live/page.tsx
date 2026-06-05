/**
 * GROWTH-LIVE-PAGE-BUILD (2026-06-05, Tier B #2) — /live route.
 *
 * Surfaces the existing in-play infrastructure that we've been paying compute
 * for without marketing it. NOT a landing-positioning change — the landing
 * stays CLV-first / pre-match / value-bets. This is a SECOND product surface
 * (Direction B from the in-play positioning spike).
 *
 * Architecture pattern intentionally mirrors /value-bets:
 *   - Server component fetches user tier + the active in-play bets
 *   - Tier-gated: Free sees a teaser, Pro sees the live grid, Elite gets
 *     edge % + Telegram delivery hint
 *   - Reuses ValueBetsLiveSection for the live grid (no duplicate code)
 *
 * Honest caveats baked into the page copy:
 *   - "In-play CLV is structurally noisier than pre-match" — closing-line is
 *     undefined during a continuously re-priced live market
 *   - Same edge framework as pre-match, just faster cycle
 *
 * Background reading: dev/active/inplay-positioning-spike.md (engine repo).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Radio, Zap, MessageCircle } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import { getTodayBets } from "@/lib/engine-data";
import { Button } from "@/components/ui/button";
import { ValueBetsLiveSection } from "@/components/value-bets-live-section";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Football Value Bets — OddsIntel",
  description:
    "AI-detected value bets as the match unfolds. 17 in-play strategies running on a 30-second polling loop across 280+ leagues. Telegram alerts on every detection. Pro and Elite only.",
  alternates: { canonical: "https://oddsintel.app/live" },
};

function LiveSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <p className="text-sm text-muted-foreground px-1">
        Checking live matches…
      </p>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl border border-white/[0.06] bg-card/40" />
      ))}
    </div>
  );
}

async function LiveContent() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Default for anonymous / free users — show teaser only
  let isPro = false;
  let isElite = false;
  if (user) {
    const tierInfo = await getUserTier(user.id, supabase);
    isPro = tierInfo.isPro;
    isElite = tierInfo.isElite;
  }

  // Free / anonymous users see the teaser, not the grid
  if (!isPro) {
    return (
      <section className="rounded-xl border border-white/[0.06] bg-card/40 p-5">
        <p className="font-semibold text-foreground">
          What you&apos;d see as Pro or Elite
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Pro and Elite users see every active in-play value bet in real time
          — refreshed every 60 seconds, with match minute, score, and edge
          markup. Elite adds Telegram delivery so picks land on your phone
          the moment the model spots them, before line movement.
        </p>
        <div className="mt-4">
          <Button
            size="sm"
            className="h-9 bg-green-500 px-5 text-sm font-bold text-black shadow-md shadow-green-500/20 hover:bg-green-400"
            nativeButton={false}
            render={<Link href="/pricing" />}
          >
            See plans →
          </Button>
        </div>
      </section>
    );
  }

  // Pro/Elite: pull active cohort (includes in-play) + filter to live-pending
  const allBets = await getTodayBets(isElite ? "active" : "calibrated");
  const inplayBets = allBets.filter((b) => b.isInplay && b.result === "pending");
  const serverNow = new Date().toISOString();

  if (inplayBets.length === 0) {
    return (
      <section className="rounded-xl border border-white/[0.06] bg-card/40 p-5 text-center">
        <Radio className="mx-auto size-6 text-muted-foreground/40" aria-hidden />
        <p className="mt-3 font-semibold text-foreground">No live picks right now</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          The model hasn&apos;t found in-play value in the matches currently
          running. This page auto-checks every 60 seconds — keep it open
          during peak hours (15-22 UTC). Telegram delivery is on by default
          for Pro+ if you&apos;ve{" "}
          <Link href="/profile" className="text-foreground underline underline-offset-2 hover:text-green-400">
            connected your account
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <ValueBetsLiveSection
      initialBets={inplayBets.map((b) => ({
        id: b.id,
        matchId: b.matchId,
        match: b.match,
        league: b.league,
        market: b.market,
        selection: b.selection,
        odds: b.odds,
        modelProb: b.modelProb,
        edge: b.edge,
        kickoff: b.kickoff,
        placedAt: b.placedAt,
        recommendedBookmaker: b.recommendedBookmaker,
        bot: b.bot,
        stake: b.stake,
      }))}
      serverNow={serverNow}
      isElite={isElite}
    />
  );
}

export default function LivePage() {
  return (
    <div className="space-y-8 px-4 py-8 sm:px-6 sm:py-10 max-w-5xl mx-auto">
      {/* Hero */}
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-widest text-sky-300">
            Live in-play scanner
          </span>
        </div>
        <h1 className="text-balance text-3xl font-black leading-[1.1] tracking-tight text-foreground sm:text-4xl">
          Live value bets, the moment the model spots them.
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Same edge framework as our pre-match picks, faster cycle. 17 in-play
          strategies running on a 30-second polling loop across 280+ leagues.
          When the live odds drift far enough from where the model thinks the
          match is heading, the pick lands on your <Link href="/profile" className="text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline">Telegram</Link> — before line movement.
        </p>
      </header>

      {/* Live grid (tier-gated server-side) */}
      <Suspense fallback={<LiveSkeleton />}>
        <LiveContent />
      </Suspense>

      {/* How it works — 3 cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <Radio className="size-5 text-sky-400" aria-hidden />
          <p className="mt-3 font-semibold text-foreground">Live data ingest</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Tiered polling — 30 seconds for active matches with open positions,
            60 seconds for the rest, 5-minute long-tail. Score, odds, shots,
            cards, possession refreshed on every tick.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <Zap className="size-5 text-amber-400" aria-hidden />
          <p className="mt-3 font-semibold text-foreground">17 strategies in parallel</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Each strategy targets a specific in-play signal — goal contagion,
            dry-spell pressure, BTTS lean, momentum reversal, late-game cards.
            All run on the live snapshot independently.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <MessageCircle className="size-5 text-green-400" aria-hidden />
          <p className="mt-3 font-semibold text-foreground">Telegram delivery</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            When any strategy flags edge over the live line, the pick goes
            straight to your Telegram with match minute, score, model probability,
            and edge %. Pro and Elite tiers only.
          </p>
        </div>
      </section>

      {/* Honest caveat block — in-play CLV is structurally noisier */}
      <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-5 py-4 text-sm leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground/90">
          Honest note on in-play vs pre-match CLV
        </p>
        <p className="mt-2">
          We publish CLV (closing line value) prominently on{" "}
          <Link href="/performance" className="text-foreground underline underline-offset-2 hover:text-foreground/80">
            /performance
          </Link>{" "}
          and call it the &quot;honest scoreboard&quot; — but in-play CLV is
          structurally noisier than pre-match CLV. The closing line is well-
          defined pre-kickoff; during a live game the bookmaker re-prices
          every few seconds, so &quot;the price the market settled at&quot; is
          a fuzzier number than for a pre-match pick. We still track it, but
          treat in-play CLV as directional, not definitive.
        </p>
        <p className="mt-2">
          If the verified-ROI question matters to you, lead with our{" "}
          <Link href="/value-bets" className="text-foreground underline underline-offset-2 hover:text-foreground/80">
            pre-match value bets
          </Link>{" "}
          — CLV is cleanest there. In-play is the faster-cycle complement, not
          the headline product.
        </p>
      </section>

      {/* Footer CTA */}
      <section className="rounded-2xl border border-sky-500/20 bg-gradient-to-b from-sky-950/30 to-background px-6 py-7 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Get live picks in your Telegram
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Pro and Elite users get every live value bet delivered to Telegram
          the moment the model finds it. Free users see a daily on-site pick.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            className="h-12 bg-sky-500 px-8 text-base font-bold text-white shadow-md shadow-sky-500/20 hover:bg-sky-400"
            nativeButton={false}
            render={<Link href="/signup" />}
          >
            Start Free
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="h-12 px-8 text-base border border-white/[0.15] text-foreground hover:bg-white/[0.05]"
            nativeButton={false}
            render={<Link href="/pricing" />}
          >
            Compare plans →
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground/80">
          Live alerts available on Pro €4.99/mo and Elite €14.99/mo. Cancel any time.
        </p>
      </section>
    </div>
  );
}
