// "Why not picked (last 7 days)" — the first reader of candidate_funnel (#162 W7.5, audit B-R11).
// Rows come from engine view candidate_funnel_7d (migration 456), read server-side with the
// service client in loadBotBoard — the anon role never gets this table (#072).
//
// One small table per SOURCE: the live pipeline run and the shadow run evaluate the same bot on
// different inputs, and a publisher / O/U-sharp row measures a different edge, so their counts
// are never added together (engine ANALYSIS_GOTCHAS #72).

import { Panel, PanelHeader } from "@/components/oi/panel";
import type { BotFunnelRow } from "@/lib/bot-board";
import { count } from "./bot-board-format";

const SOURCE_LABEL: Record<string, string> = {
  pipeline: "Live pipeline run",
  pipeline_shadow: "Shadow run",
  publisher_live: "Publisher (sharp arm)",
  publisher_consensus: "Publisher (consensus arm)",
  ou_sharp: "O/U sharp job",
};

// Steps that mean the candidate WAS taken. Everything else is a drop reason, shown as written
// by the engine (drop_edge, drop_no_pinnacle, below_floor, …) so it can be grepped.
const TAKEN = new Set(["accepted", "selected", "selected_unsent"]);

export function FunnelPanel({ rows }: { rows: BotFunnelRow[] | null }) {
  const bySource = new Map<string, BotFunnelRow[]>();
  for (const r of rows ?? []) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);
  return (
    <Panel>
      <PanelHeader
        title="Why not picked · last 7 days"
        description={
          <>
            Candidates this bot looked at and what decided them, from candidate_funnel. Only candidates close to the floor (within 5
            points) or rejected by a later gate are recorded, so this is not every candidate. One row per candidate per day — the
            latest decision that day wins. Sources are kept apart: they price different edges.
          </>
        }
      />
      <div className="space-y-3 px-4 pb-4 pt-2">
        {rows === null ? (
          <p className="text-xs text-muted-foreground">Not available — the candidate_funnel_7d view is not readable yet.</p>
        ) : bySource.size === 0 ? (
          <p className="text-xs text-muted-foreground">No recorded candidates in the last 7 days.</p>
        ) : (
          [...bySource.entries()].map(([source, rs]) => {
            const sorted = [...rs].sort((a, b) => Number(TAKEN.has(b.step)) - Number(TAKEN.has(a.step)) || b.n - a.n);
            return (
              <table key={source} className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-2 font-normal">{SOURCE_LABEL[source] ?? source}</th>
                    <th className="py-1 pr-2 text-right font-normal">Candidates</th>
                    <th className="py-1 text-right font-normal">Matches</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.step} className="border-t border-border">
                      <td className={`py-1 pr-2 font-mono ${TAKEN.has(r.step) ? "text-success" : ""}`}>{r.step}</td>
                      <td className="py-1 pr-2 text-right">{count(r.n)}</td>
                      <td className="py-1 text-right">{count(r.n_matches)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })
        )}
      </div>
    </Panel>
  );
}
