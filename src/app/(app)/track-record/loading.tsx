export default function TrackRecordLoading() {
  return (
    <div className="space-y-8">
      {/* Hero header + 3 stat cards */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card/80 px-4 py-4 space-y-2">
              <div className="h-3 w-28 animate-pulse rounded bg-muted" />
              <div className="h-7 w-16 animate-pulse rounded bg-muted" />
              <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* CLV education block */}
      <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-3">
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border/30 bg-card/40 p-3 space-y-2">
              <div className="h-2 w-16 mx-auto animate-pulse rounded bg-muted" />
              <div className="h-5 w-10 mx-auto animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* System status */}
      <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border/30 bg-card/40 px-3 py-2.5 space-y-2">
              <div className="h-2 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-10 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-3">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-2 w-full rounded-full bg-border/30" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
      </div>

      {/* Early results (collapsed) */}
      <div className="rounded-xl border border-border/50 bg-card/60 px-5 py-3.5">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="h-3 w-64 mt-1 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
