interface ScraperState {
  scraper_name: string;
  description: string | null;
  status: string;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  items_total: number;
  items_done: number;
  items_failed: number;
  items_pending: number;
  items_stale: number;
  last_run_duration_s: number | null;
  notes: string | null;
  updated_at: string;
}

function timeSince(iso: string | null): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function statusBadge(s: string): string {
  if (s === "running") return "bg-blue-500/20 text-blue-400 border-blue-500/40";
  if (s === "error") return "bg-red-500/20 text-red-400 border-red-500/40";
  return "bg-zinc-700/30 text-zinc-400 border-zinc-700/40";
}

export function ScrapersPanel({ rows }: { rows: ScraperState[] }) {
  if (!rows?.length) {
    return (
      <section className="p-6 rounded-lg border border-border bg-card/40">
        <h3 className="text-base font-semibold mb-2">Scrapers</h3>
        <p className="text-xs text-muted-foreground">No scraper state recorded yet. Migration 215 may still be applying.</p>
      </section>
    );
  }

  return (
    <section className="p-6 rounded-lg border border-border bg-card/40">
      <h3 className="text-base font-semibold mb-3">Scrapers</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left py-2 pr-3 font-medium">scraper</th>
              <th className="text-left py-2 pr-3 font-medium">status</th>
              <th className="text-right py-2 px-3 font-medium">done</th>
              <th className="text-right py-2 px-3 font-medium">pending</th>
              <th className="text-right py-2 px-3 font-medium">failed</th>
              <th className="text-left py-2 px-3 font-medium">progress</th>
              <th className="text-left py-2 px-3 font-medium">last run</th>
              <th className="text-left py-2 px-3 font-medium">last success</th>
              <th className="text-left py-2 px-3 font-medium">duration</th>
              <th className="text-left py-2 pl-3 font-medium">notes / error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.items_total > 0
                ? Math.min(100, Math.round((r.items_done / r.items_total) * 100))
                : 0;
              return (
                <tr key={r.scraper_name} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="py-2 pr-3 font-mono font-medium" title={r.description ?? ""}>
                    {r.scraper_name}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`px-1.5 py-0.5 rounded border font-bold tracking-wider uppercase ${statusBadge(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-green-400">{r.items_done.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right font-mono text-amber-400">{r.items_pending.toLocaleString()}</td>
                  <td className={`py-2 px-3 text-right font-mono ${r.items_failed > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                    {r.items_failed.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-amber-500/60" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-muted-foreground tabular-nums text-[10px] w-9 text-right">{pct}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{timeSince(r.last_run_at)}</td>
                  <td className="py-2 px-3 text-muted-foreground">{timeSince(r.last_success_at)}</td>
                  <td className="py-2 px-3 text-muted-foreground tabular-nums">
                    {r.last_run_duration_s != null ? `${r.last_run_duration_s.toFixed(1)}s` : "—"}
                  </td>
                  <td className="py-2 pl-3 text-muted-foreground max-w-md truncate" title={r.last_error ?? r.notes ?? ""}>
                    {r.last_error ? (
                      <span className="text-red-400">{r.last_error.slice(0, 60)}</span>
                    ) : (
                      r.notes?.slice(0, 80) ?? "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Scrapers run on Railway scheduler. Self-healing: stuck rows auto-reset after 6h, parse errors logged per row, ON CONFLICT keeps inserts idempotent. Page refreshes show latest state.
      </p>
    </section>
  );
}
