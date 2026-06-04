/**
 * Loading skeleton for /world-cup/who-can-win — Monte Carlo page.
 * Mirrors hero + title contender strip + main 48-row table so the page
 * footprint doesn't reflow when the snapshot lands.
 */
export default function WhoCanWinLoading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero */}
      <section className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-6">
        <div className="h-3 w-32 animate-pulse rounded bg-white/[0.04]" />
        <div className="mt-2 h-7 w-72 animate-pulse rounded bg-white/[0.06] sm:h-9 sm:w-[28rem]" />
        <div className="mt-2 space-y-1.5">
          <div className="h-3 w-full max-w-xl animate-pulse rounded bg-white/[0.04]" />
          <div className="h-3 w-3/4 max-w-md animate-pulse rounded bg-white/[0.04]" />
        </div>
        <div className="mt-3 h-3 w-40 animate-pulse rounded bg-white/[0.04]" />
      </section>

      {/* Title contenders strip — 5 cards */}
      <section className="rounded-xl border border-white/[0.08] bg-card/40 p-4 sm:p-5">
        <div className="mb-3 h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-lg border border-[color:var(--color-tournament-gold)]/20 bg-card/40 px-3 py-2.5"
            >
              <div className="size-7 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-2 w-10 animate-pulse rounded bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main 48-row table */}
      <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
        <header className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
          <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
        </header>
        <div className="divide-y divide-white/[0.04]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
            >
              <div className="size-5 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
              <div className="h-3 flex-1 animate-pulse rounded bg-white/[0.04]" />
              <div className="hidden sm:flex sm:items-center sm:gap-3">
                <div className="h-3 w-10 animate-pulse rounded bg-white/[0.04]" />
                <div className="h-3 w-10 animate-pulse rounded bg-white/[0.04]" />
                <div className="h-3 w-10 animate-pulse rounded bg-white/[0.04]" />
              </div>
              <div className="h-3 w-12 animate-pulse rounded bg-white/[0.06]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
