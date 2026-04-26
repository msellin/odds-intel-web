export default function ValueBetsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-pulse rounded bg-muted" />
          <div className="h-6 w-28 animate-pulse rounded bg-muted" />
          <div className="h-5 w-8 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>

      {/* Summary stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/50 bg-card px-4 py-3 space-y-2"
          >
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-7 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 border-b border-border/40 px-4 py-3">
          {[16, 24, 20, 12, 12, 16].map((w, i) => (
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
            {[16, 24, 20, 12, 12, 16].map((w, j) => (
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
