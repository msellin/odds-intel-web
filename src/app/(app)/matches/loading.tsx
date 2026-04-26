export default function MatchesLoading() {
  return (
    <div className="space-y-8">
      {/* Page header skeleton */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
      </div>

      {/* 3 league groups */}
      {[3, 2, 3].map((matchCount, gi) => (
        <section key={gi} className="space-y-3">
          {/* League header */}
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <div className="h-5 w-5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          </div>

          {/* Match cards grid */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: matchCount }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4"
              >
                {/* Teams row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                </div>
                {/* Full names */}
                <div className="flex items-center justify-between gap-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
                {/* Kickoff */}
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
