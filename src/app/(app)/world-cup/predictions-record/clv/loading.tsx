/**
 * Loading skeleton for /world-cup/predictions-record/clv (CLV tab).
 * Mirrors hero + sub-nav + 4 summary cards + chart + per-match table.
 */
export default function WCPredictionsCLVLoading() {
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

      {/* Sub-nav placeholder */}
      <div className="flex gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-8 flex-1 animate-pulse rounded-md bg-white/[0.04] sm:flex-initial sm:w-24"
          />
        ))}
      </div>

      {/* 4 summary cards */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/[0.08] bg-card/40 p-3 sm:p-4"
          >
            <div className="h-2.5 w-20 animate-pulse rounded bg-white/[0.04]" />
            <div className="mt-2 h-6 w-16 animate-pulse rounded bg-white/[0.06] sm:h-8" />
            <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-white/[0.04]" />
          </div>
        ))}
      </section>

      {/* CLV chart */}
      <section className="rounded-xl border border-white/[0.08] bg-card/40 p-4 sm:p-5">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div className="space-y-1.5">
            <div className="h-4 w-44 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-56 animate-pulse rounded bg-white/[0.04]" />
          </div>
          <div className="h-3 w-16 animate-pulse rounded bg-white/[0.04]" />
        </div>
        <div className="aspect-[5/3] w-full animate-pulse rounded-lg bg-white/[0.04]" />
        {/* Inline per-match table block */}
        <div className="mt-4 rounded-lg border border-white/[0.04]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[60px_1fr_70px_70px] items-center gap-2 border-b border-white/[0.04] px-2 py-2 last:border-0"
            >
              <div className="h-3 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 animate-pulse rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </section>

      {/* Per-market breakdown */}
      <section className="rounded-xl border border-white/[0.08] bg-card/40 p-4 sm:p-5">
        <div className="mb-3 space-y-1.5">
          <div className="h-4 w-40 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-56 animate-pulse rounded bg-white/[0.04]" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 w-full animate-pulse rounded bg-white/[0.04]" />
          ))}
        </div>
      </section>
    </div>
  );
}
