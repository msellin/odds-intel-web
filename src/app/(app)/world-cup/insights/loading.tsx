/**
 * Loading skeleton for /world-cup/insights — article index. Mirrors hero
 * + 4-article grid so the page footprint doesn't reflow when articles load.
 */
export default function WCInsightsIndexLoading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero */}
      <section className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-6">
        <div className="h-3 w-28 animate-pulse rounded bg-white/[0.04]" />
        <div className="mt-2 h-7 w-72 animate-pulse rounded bg-white/[0.06] sm:h-9 sm:w-96" />
        <div className="mt-2 space-y-1.5">
          <div className="h-3 w-full max-w-xl animate-pulse rounded bg-white/[0.04]" />
          <div className="h-3 w-3/4 max-w-md animate-pulse rounded bg-white/[0.04]" />
        </div>
        <div className="mt-3 h-3 w-32 animate-pulse rounded bg-white/[0.04]" />
      </section>

      {/* Article grid — typically 4 entries */}
      <ul className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="flex h-full flex-col gap-2 rounded-xl border border-white/[0.08] bg-card/40 p-4 sm:p-5"
          >
            <div className="h-5 w-3/4 animate-pulse rounded bg-white/[0.06]" />
            <div className="space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.04]" />
            </div>
            <div className="mt-auto flex items-center justify-between pt-2">
              <div className="h-3 w-24 animate-pulse rounded bg-white/[0.04]" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
