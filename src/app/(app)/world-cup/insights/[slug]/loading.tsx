/**
 * Loading skeleton for /world-cup/insights/[slug] — individual article
 * page. Mirrors hero + prose body + footer nav.
 */
export default function WCInsightArticleLoading() {
  return (
    <article className="space-y-4 sm:space-y-6">
      {/* Hero */}
      <header className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-6">
        <div className="h-3 w-44 animate-pulse rounded bg-white/[0.04]" />
        <div className="mt-2 h-7 w-3/4 max-w-2xl animate-pulse rounded bg-white/[0.06] sm:h-9" />
        <div className="mt-2 space-y-1.5">
          <div className="h-3 w-full max-w-2xl animate-pulse rounded bg-white/[0.04]" />
          <div className="h-3 w-5/6 max-w-xl animate-pulse rounded bg-white/[0.04]" />
        </div>
        <div className="mt-2 h-3 w-48 animate-pulse rounded bg-white/[0.04]" />
        <div className="mt-3 flex gap-3">
          <div className="h-3 w-24 animate-pulse rounded bg-white/[0.04]" />
          <div className="h-3 w-28 animate-pulse rounded bg-white/[0.04]" />
        </div>
      </header>

      {/* Body — paragraph blocks */}
      <section className="rounded-xl border border-white/[0.08] bg-card/40 p-4 sm:p-6">
        <div className="space-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 w-10/12 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </section>

      {/* Footer nav */}
      <nav className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-card/40 p-4">
        <div className="h-3 w-24 animate-pulse rounded bg-white/[0.04]" />
        <div className="h-3 w-28 animate-pulse rounded bg-white/[0.04]" />
      </nav>
    </article>
  );
}
