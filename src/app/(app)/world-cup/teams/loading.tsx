/**
 * Loading skeleton for /world-cup/teams — mirrors the 48-team grid layout
 * so the page footprint doesn't reflow when data lands. Pulsing blocks
 * use the WC palette (bg-white/[0.04], border-white/[0.08]).
 */
export default function WorldCupTeamsLoading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero placeholder */}
      <section className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-6">
        <div className="h-3 w-24 animate-pulse rounded bg-white/[0.04]" />
        <div className="mt-2 h-7 w-64 animate-pulse rounded bg-white/[0.06] sm:h-9 sm:w-80" />
        <div className="mt-2 h-3 w-56 animate-pulse rounded bg-white/[0.04]" />
        <div className="mt-3 h-3 w-32 animate-pulse rounded bg-white/[0.04]" />
      </section>

      {/* 48-team grid — same breakpoints as the live page */}
      <section
        aria-hidden
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6"
      >
        {Array.from({ length: 48 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-card/40 px-3 py-2.5 sm:px-3.5 sm:py-3"
          >
            <div className="size-6 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-2 w-1/2 animate-pulse rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
