export default function TrackRecordLoading() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 animate-pulse rounded bg-muted" />
          <div className="h-4 w-56 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Stats cards row (6 cards) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-card/80 px-4 py-3 space-y-2"
          >
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-6 w-14 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Streak indicators */}
      <div className="flex flex-wrap gap-4">
        <div className="h-9 w-44 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 w-44 animate-pulse rounded-lg bg-muted" />
      </div>

      {/* Chart area */}
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <div className="h-4 w-20 animate-pulse rounded bg-muted mb-4" />
        <div className="h-48 w-full animate-pulse rounded bg-muted" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 border-b border-border/40 px-4 py-3">
          {[14, 20, 14, 10, 10, 10, 10, 12].map((w, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded bg-muted"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/20 px-4 py-3.5"
          >
            {[14, 20, 14, 10, 10, 10, 10, 12].map((w, j) => (
              <div
                key={j}
                className="h-3 animate-pulse rounded bg-muted"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
