/**
 * Loading skeleton for /world-cup/predictions-record/leaderboard.
 * Mirrors hero + sub-nav + leaderboard table.
 */
export default function WCPredictionsLeaderboardLoading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-7">
        <div className="h-3 w-32 animate-pulse rounded bg-white/[0.04]" />
        <div className="mt-2 h-7 w-72 animate-pulse rounded bg-white/[0.06] sm:h-9 sm:w-[28rem]" />
        <div className="mt-2 h-3 w-full max-w-xl animate-pulse rounded bg-white/[0.04]" />
        <div className="mt-2 h-3 w-3/4 max-w-md animate-pulse rounded bg-white/[0.04]" />
        <div className="mt-4 h-10 w-44 animate-pulse rounded-lg bg-white/[0.04]" />
      </section>

      {/* Sub-nav */}
      <div className="flex gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-8 flex-1 animate-pulse rounded-md bg-white/[0.04] sm:flex-initial sm:w-24"
          />
        ))}
      </div>

      {/* Leaderboard table */}
      <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
        <header className="flex items-end justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
          <div className="space-y-1.5">
            <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-48 animate-pulse rounded bg-white/[0.04]" />
          </div>
          <div className="h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
        </header>
        <div className="divide-y divide-white/[0.04]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[32px_1fr_50px_60px_60px_60px_60px] items-center gap-2 px-3 py-3 sm:px-4"
            >
              <div className="h-4 w-4 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-3 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 animate-pulse rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </section>

      {/* Methodology card */}
      <section className="rounded-xl border border-white/[0.06] bg-card/30 p-4 sm:p-5">
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-white/[0.04]" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.04]" />
        </div>
      </section>
    </div>
  );
}
