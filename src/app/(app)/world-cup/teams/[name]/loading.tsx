/**
 * Loading skeleton for /world-cup/teams/[name] — mirrors hero + group
 * table + fixtures list + recent form blocks so layout doesn't shift
 * when the team detail hydrates.
 */
export default function WorldCupTeamDetailLoading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-8">
        <div className="h-3 w-28 animate-pulse rounded bg-white/[0.04]" />
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="size-12 shrink-0 animate-pulse rounded-full bg-white/[0.06] sm:size-14" />
            <div className="space-y-2">
              <div className="h-7 w-44 animate-pulse rounded bg-white/[0.06] sm:h-9 sm:w-60" />
              <div className="flex flex-wrap gap-1.5">
                <div className="h-5 w-20 animate-pulse rounded-full bg-white/[0.04]" />
                <div className="h-5 w-24 animate-pulse rounded-full bg-white/[0.04]" />
              </div>
            </div>
          </div>
          <div className="h-14 w-20 animate-pulse rounded-lg bg-white/[0.04]" />
        </div>
      </section>

      {/* Group standings mini-table */}
      <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
        <header className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
          <div className="h-4 w-20 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-24 animate-pulse rounded bg-white/[0.04]" />
        </header>
        <div className="divide-y divide-white/[0.04]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 sm:px-4">
              <div className="size-4 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
              <div className="h-3 flex-1 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 w-8 animate-pulse rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </section>

      {/* Fixtures */}
      <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
        <header className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
          <div className="h-4 w-20 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-16 animate-pulse rounded bg-white/[0.04]" />
        </header>
        <div className="space-y-1.5 px-2.5 py-2.5 sm:px-3 sm:py-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-white/[0.06] bg-card/40 px-3 py-3"
            >
              <div className="grid grid-cols-[56px_1fr_auto_1fr_auto] items-center gap-2">
                <div className="h-6 w-12 animate-pulse rounded bg-white/[0.04]" />
                <div className="h-3 animate-pulse rounded bg-white/[0.04]" />
                <div className="h-3 w-3 animate-pulse rounded bg-white/[0.04]" />
                <div className="h-3 animate-pulse rounded bg-white/[0.04]" />
                <div className="h-3 w-3 animate-pulse rounded bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent form */}
      <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
        <header className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
          <div className="h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
        </header>
        <ul className="grid grid-cols-1 gap-1.5 p-3 sm:grid-cols-2 sm:p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-card/40 px-2.5 py-1.5"
            >
              <div className="size-5 shrink-0 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-3 flex-1 animate-pulse rounded bg-white/[0.04]" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
