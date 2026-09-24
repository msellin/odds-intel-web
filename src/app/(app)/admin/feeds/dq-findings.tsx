import type { DataQualityFinding } from "@/lib/engine-data";

// #120/#121 — what the data-quality checks found. Server component; no interaction.
const LABEL: Record<string, string> = {
  wrong_fixture_board: "Wrong-match board",
  mirrored_1x2: "Home/away swapped (1X2)",
  swapped_two_way: "Over/under or yes/no swapped",
  results_disagree: "Results disagree",
};

function short(f: DataQualityFinding): string {
  const d = (f.detail ?? {}) as Record<string, unknown>;
  if (f.check_name === "results_disagree") {
    return `${d.match ?? ""}: API-Football ${d.api_football ?? "?"} vs Tonybet ${d.tonybet ?? "?"}`;
  }
  const off = d.offenses as unknown;
  if (Array.isArray(off)) {
    return off.map((o) => (Array.isArray(o) ? `${o[0]}: ${o[1]}` : String(o))).join(" · ");
  }
  return d.where ? `found at ${d.where}` : "";
}

export function DqFindings({ findings, now }: { findings: DataQualityFinding[]; now: number }) {
  const day = findings.filter((f) => now - new Date(f.found_at).getTime() < 86_400_000);
  const counts = new Map<string, number>();
  for (const f of day) {
    const k = `${LABEL[f.check_name] ?? f.check_name} · ${f.bookmaker ?? "?"}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return (
    <section className="rounded-lg border border-border bg-card/60 px-4 py-3 space-y-3">
      <div>
        <h2 className="font-semibold">Data quality</h2>
        <p className="text-xs text-muted-foreground">
          Prices and results the checks caught: another match&apos;s board under our fixture, swapped
          sides, scores that disagree between sources. Refused or moved rows are kept in quarantine
          (reversible). Checked on write and every 30 min.
        </p>
      </div>
      {findings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing found in the last 7 days.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            {day.length === 0 && <span className="text-muted-foreground">None in the last 24 h.</span>}
            {[...counts.entries()].map(([k, n]) => (
              <span key={k} className="rounded border border-amber-500/40 px-2 py-0.5 text-amber-500">{k}: {n}</span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground text-left">
                <tr><th className="py-1 pr-3">When (UTC)</th><th className="pr-3">Check</th><th className="pr-3">Book</th>
                  <th className="pr-3">Rows</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {findings.slice(0, 20).map((f) => (
                  <tr key={f.id} className="border-t border-border/50 align-top">
                    <td className="py-1 pr-3 whitespace-nowrap tabular-nums">{f.found_at.slice(5, 16).replace("T", " ")}</td>
                    <td className="pr-3 whitespace-nowrap">{LABEL[f.check_name] ?? f.check_name}</td>
                    <td className="pr-3">{f.bookmaker ?? "–"}</td>
                    <td className="pr-3 tabular-nums">{f.rows_moved || "–"}</td>
                    <td className="text-muted-foreground">{short(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
