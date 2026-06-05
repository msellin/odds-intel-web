/**
 * GROWTH-ONE-SCREEN-PROOF (2026-06-05) — Path B: pure-CSS animated demo of
 * "8 tabs vs 1 screen" for the landing page.
 *
 * The bundle thesis (you get odds + stats + injuries + value bets in one
 * place rather than across 8 tabs) was *asserted* on the landing but never
 * *shown*. This component shows it.
 *
 * Behaviour:
 *   - Left card animates 8 typical "match-day routine" tabs fading in one
 *     at a time over ~6s (each tab is wearing a red X — they aren't
 *     solutions, they're chores)
 *   - Right card waits, then in a single beat shows the OddsIntel match-card
 *     equivalent with all the same info consolidated
 *   - 14s loop, restarts forever (so a visitor who scrolls slowly catches it)
 *
 * Accessibility:
 *   - Honours `prefers-reduced-motion: reduce` — all elements visible
 *     immediately, no animation
 *   - Decorative animation; semantic content (text labels) is readable even
 *     in the first frame for screen readers
 *
 * Path A (real screen recording) is the future upgrade — once we have one,
 * this component swaps to a <video> element without touching the page.tsx
 * call site.
 */
import { Check, X } from "lucide-react";

// GROWTH-MOBILE-LANDING-V2 (2026-06-05): names trimmed so mobile truncation
// doesn't leave the column rendered as a string of "WhoScor..." / "Premierl..."
// / "Transfer..." stubs. Same point, no truncation jitter.
const ROUTINE_TABS: { name: string; what: string }[] = [
  { name: "Stats",       what: "form" },
  { name: "Transfers",   what: "lineups" },
  { name: "WhoScored",   what: "ratings" },
  { name: "OddsPortal",  what: "odds" },
  { name: "Injuries",    what: "injuries" },
  { name: "X",           what: "rumours" },
  { name: "Weather",     what: "weather" },
  { name: "FBref",       what: "xG" },
];

export function OneScreenProof() {
  return (
    <section className="bg-card/20 py-14" aria-label="One screen versus eight tabs demo">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            One screen. Two seconds.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Same workflow. Different speed.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* LEFT — your current match-day routine */}
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-6">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-red-300/70">
              Your current routine — 8 tabs
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ROUTINE_TABS.map((tab, i) => (
                <div
                  key={tab.name}
                  className="osp-tab flex items-center justify-between gap-2 rounded-md border border-white/[0.04] bg-muted/20 px-3 py-2 text-xs"
                  style={{ ["--osp-delay" as string]: `${i * 0.45}s` }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <X className="size-3.5 shrink-0 text-red-500/70" aria-hidden />
                    <span className="truncate text-foreground/85">{tab.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/70">{tab.what}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-muted-foreground">
              <span className="font-mono text-red-300/90">~90s</span> — and the
              odds may have already moved.
            </p>
          </div>

          {/* RIGHT — OddsIntel: one screen */}
          <div className="osp-result rounded-2xl border border-green-500/30 bg-green-500/[0.05] p-6">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-green-300/80">
              OddsIntel — one screen
            </p>
            <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-card/60">
              <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-muted/30 px-3 py-2">
                <div className="size-2 rounded-full bg-red-500/40" />
                <div className="size-2 rounded-full bg-yellow-500/40" />
                <div className="size-2 rounded-full bg-green-500/40" />
                <span className="ml-2 font-mono text-[10px] text-muted-foreground/60">
                  oddsintel.app/matches/...
                </span>
              </div>
              <div className="space-y-2.5 p-4">
                {[
                  { label: "Best odds across 13 books", value: "2.15 / 3.45 / 1.80" },
                  { label: "Confirmed lineup",           value: "Out 30 min ago ✓" },
                  { label: "Key injury",                 value: "Saka 50/50" },
                  { label: "Live xG (last 5)",           value: "1.84 / 0.72" },
                  { label: "Odds drift since open",      value: "Home −0.10 ↓" },
                  { label: "Model edge",                 value: "+8.1% Over 2.5" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Check className="size-3.5 shrink-0 text-green-400/80" aria-hidden />
                      <span className="truncate text-muted-foreground">{row.label}</span>
                    </div>
                    <span className="font-mono text-foreground/90">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-5 text-center text-xs text-foreground/80">
              <span className="font-mono text-green-300">2s</span> — everything,
              before the odds move.
            </p>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground/80">
          Same workflow side-by-side. The OddsIntel side reflects the actual
          product surface — see /matches.
        </p>
      </div>
    </section>
  );
}
