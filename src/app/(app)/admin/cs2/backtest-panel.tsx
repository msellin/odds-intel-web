interface BacktestRow {
  id: number;
  run_id: string;
  run_at: string;
  feature_set: string;
  n_matches: number | null;
  n_train: number | null;
  n_test: number | null;
  auc: number | null;
  logloss: number | null;
  brier: number | null;
  accuracy: number | null;
  since_date: string | null;
  feature_keys: string[] | null;
}

function fmt(n: number | null, d = 3): string {
  if (n == null) return "—";
  return n.toFixed(d);
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function timeSince(iso: string | null): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function BacktestPanel({ rows }: { rows: BacktestRow[] }) {
  if (!rows?.length) {
    return (
      <section className="p-6 rounded-lg border border-border bg-card/40">
        <h3 className="text-base font-semibold mb-2">Sneak-peek backtest history</h3>
        <p className="text-xs text-muted-foreground">
          No backtest runs yet. Run <code className="bg-muted px-1 py-0.5 rounded">python3 scripts/esports/cs2_sneak_peek_v2.py</code> to populate.
        </p>
      </section>
    );
  }

  // Group rows by run_id, sort runs by run_at desc, take last 5.
  const byRun = new Map<string, BacktestRow[]>();
  for (const r of rows) {
    if (!byRun.has(r.run_id)) byRun.set(r.run_id, []);
    byRun.get(r.run_id)!.push(r);
  }
  const runs = Array.from(byRun.entries())
    .sort((a, b) => new Date(b[1][0].run_at).getTime() - new Date(a[1][0].run_at).getTime())
    .slice(0, 5);

  // Get all unique feature sets across recent runs (preserve insertion order from latest run).
  const fsOrder: string[] = [];
  const seen = new Set<string>();
  for (const [, runRows] of runs) {
    for (const r of runRows) {
      if (!seen.has(r.feature_set)) {
        seen.add(r.feature_set);
        fsOrder.push(r.feature_set);
      }
    }
  }

  // Compare latest vs previous run.
  const latestRun = runs[0]?.[1] ?? [];
  const prevRun = runs[1]?.[1] ?? [];
  const prevByFs = new Map(prevRun.map((r) => [r.feature_set, r]));

  return (
    <section className="p-6 rounded-lg border border-border bg-card/40">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-semibold">Sneak-peek backtest history</h3>
        <p className="text-[10px] text-muted-foreground">
          Latest run: {timeSince(latestRun[0]?.run_at ?? null)} · {runs.length} runs tracked
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left py-2 pr-3 font-medium">feature_set</th>
              <th className="text-right py-2 px-3 font-medium">n</th>
              <th className="text-right py-2 px-3 font-medium">AUC</th>
              <th className="text-right py-2 px-3 font-medium">Δ AUC</th>
              <th className="text-right py-2 px-3 font-medium">accuracy</th>
              <th className="text-right py-2 px-3 font-medium">Δ acc</th>
              <th className="text-right py-2 px-3 font-medium">log-loss</th>
              <th className="text-right py-2 px-3 font-medium">Brier</th>
            </tr>
          </thead>
          <tbody>
            {fsOrder.map((fs) => {
              const cur = latestRun.find((r) => r.feature_set === fs);
              const prev = prevByFs.get(fs);
              if (!cur) return null;
              const dAuc = cur.auc != null && prev?.auc != null ? cur.auc - prev.auc : null;
              const dAcc = cur.accuracy != null && prev?.accuracy != null ? cur.accuracy - prev.accuracy : null;
              return (
                <tr key={fs} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="py-2 pr-3 font-mono">{fs}</td>
                  <td className="py-2 px-3 text-right font-mono text-muted-foreground">{cur.n_matches?.toLocaleString() ?? "—"}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmt(cur.auc)}</td>
                  <td className={`py-2 px-3 text-right font-mono ${dAuc == null ? "text-muted-foreground" : dAuc >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {dAuc == null ? "—" : `${dAuc >= 0 ? "+" : ""}${fmt(dAuc)}`}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{fmtPct(cur.accuracy)}</td>
                  <td className={`py-2 px-3 text-right font-mono ${dAcc == null ? "text-muted-foreground" : dAcc >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {dAcc == null ? "—" : `${dAcc >= 0 ? "+" : ""}${(dAcc * 100).toFixed(1)}pp`}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-muted-foreground">{fmt(cur.logloss, 4)}</td>
                  <td className="py-2 px-3 text-right font-mono text-muted-foreground">{fmt(cur.brier, 4)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Δ columns compare latest run vs the previous one. Re-run regularly to watch the model curve.
      </p>
    </section>
  );
}
