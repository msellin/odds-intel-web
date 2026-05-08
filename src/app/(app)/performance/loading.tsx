export default function PerformanceLoading() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="h-7 w-36 rounded-md bg-muted/30 animate-pulse" />
          <div className="h-4 w-72 rounded bg-muted/20 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-2">
              <div className="h-3 w-20 rounded bg-muted/30 animate-pulse" />
              <div className="h-7 w-16 rounded bg-muted/25 animate-pulse" />
              <div className="h-2.5 w-24 rounded bg-muted/20 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="rounded-xl border border-border/50 bg-card/60">
        <div className="px-5 py-4 border-b border-border/30 space-y-1">
          <div className="h-4 w-32 rounded bg-muted/30 animate-pulse" />
          <div className="h-3 w-48 rounded bg-muted/20 animate-pulse" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-border/10">
            <div className="h-3 w-28 rounded bg-muted/25 animate-pulse" />
            <div className="ml-auto h-3 w-10 rounded bg-muted/20 animate-pulse" />
            <div className="h-3 w-12 rounded bg-muted/20 animate-pulse" />
            <div className="h-3 w-10 rounded bg-muted/20 animate-pulse" />
            <div className="h-3.5 w-3.5 rounded-full bg-muted/20 animate-pulse" />
          </div>
        ))}
      </div>

      {/* History */}
      <div className="rounded-xl border border-border/50 bg-card/60 px-5 py-4">
        <div className="h-4 w-28 rounded bg-muted/30 animate-pulse" />
        <div className="h-3 w-44 rounded bg-muted/20 animate-pulse mt-1" />
      </div>

      {/* CLV education */}
      <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-3">
        <div className="h-4 w-48 rounded bg-muted/30 animate-pulse" />
        <div className="h-3 w-full rounded bg-muted/20 animate-pulse" />
        <div className="h-3 w-4/5 rounded bg-muted/20 animate-pulse" />
      </div>
    </div>
  );
}
