"use client";

// #120/#121 — what the data-quality checks found (board_guard at write time, board_audit read-back,
// results_check). #139 admin redesign (2026-09-24): a Panel with the 24 h counts as badges and the
// 7-day list in the shared DataTable (search, check/book facets, CSV). Anchor id="dq" is linked from
// the Overview's attention inbox and must stay.
//
// #139 UX fix round (2026-09-24): the 24 h summary is grouped into the four plain categories of
// dqGroupLabel() (src/lib/admin-feeds.ts, reused by the Overview): price far from the other books /
// wrong match on the board / home-away or over-under swapped / results disagree — one badge per
// category with the books it hit, instead of one badge per raw check × book.

import type { ColumnDef } from "@tanstack/react-table";
import type { DataQualityFinding } from "@/lib/engine-data";
import { dqGroupLabel } from "@/lib/admin-feeds-model";
import { DataTable } from "@/components/oi/data-table";
import { Panel, PanelHeader } from "@/components/oi/panel";
import { StatusBadge } from "@/components/oi/status-badge";

const LABEL: Record<string, string> = {
  wrong_fixture_board: "Wrong-match board",
  mirrored_1x2: "Home/away swapped (1X2)",
  swapped_two_way: "Over/under or yes/no swapped",
  results_disagree: "Results disagree",
  single_market_off: "One price far from the other books",
  results_corrected: "Result corrected",
};
const label = (c: string) => LABEL[c] ?? c.replace(/_/g, " ");

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

interface Row {
  id: number;
  at: string;
  check: string;
  group: string;
  book: string;
  rows: number;
  detail: string;
}

export function DqFindings({ findings, now, error }: { findings: DataQualityFinding[]; now: number; error: string | null }) {
  const day = findings.filter((f) => now - new Date(f.found_at).getTime() < 86_400_000);
  const counts = new Map<string, { n: number; books: Map<string, number> }>();
  for (const f of day) {
    const k = dqGroupLabel(f.check_name);
    const g = counts.get(k) ?? { n: 0, books: new Map<string, number>() };
    g.n += 1;
    const b = f.bookmaker ?? "unknown book";
    g.books.set(b, (g.books.get(b) ?? 0) + 1);
    counts.set(k, g);
  }
  const data: Row[] = findings.map((f) => ({
    id: f.id,
    at: f.found_at,
    check: f.check_name,
    group: dqGroupLabel(f.check_name),
    book: f.bookmaker ?? "—",
    rows: f.rows_moved ?? 0,
    detail: short(f),
  }));
  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "at",
      header: "When (UTC)",
      cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs tabular-nums">{row.original.at.slice(5, 16).replace("T", " ")}</span>,
    },
    { accessorKey: "group", header: "What was wrong", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.group}</span> },
    {
      accessorKey: "check",
      header: "Check",
      meta: { csv: (r) => label(r.check) },
      cell: ({ row }) => <span className="whitespace-nowrap text-xs text-muted-foreground">{label(row.original.check)}</span>,
    },
    { accessorKey: "book", header: "Book" },
    {
      accessorKey: "rows",
      header: "Rows set aside",
      meta: { align: "right" },
      cell: ({ row }) => (row.original.rows ? row.original.rows : "—"),
    },
    {
      accessorKey: "detail",
      header: "Detail",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="line-clamp-2 min-w-[16rem] text-xs text-muted-foreground" title={row.original.detail}>
          {row.original.detail || "—"}
        </span>
      ),
    },
  ];
  return (
    <Panel id="dq">
      <PanelHeader
        title="Data quality"
        description="Prices and results the checks caught: another match's board under our fixture, swapped sides, scores that disagree between sources. Refused or moved rows are kept in quarantine (reversible). Checked on write and every 30 min; the list covers 7 days."
        actions={
          error ? (
            <StatusBadge tone="warning">Unreadable</StatusBadge>
          ) : (
            <StatusBadge tone={day.length ? "warning" : "success"}>{day.length ? `${day.length} in 24 h` : "None in 24 h"}</StatusBadge>
          )
        }
      />
      <div className="space-y-3 p-4 pt-3">
        {error ? (
          <p className="text-sm text-warning">Could not read the data-quality findings ({error}) — this is not an all-clear.</p>
        ) : findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing found in the last 7 days.</p>
        ) : (
          <>
            {counts.size > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {[...counts.entries()]
                  .sort((a, b) => b[1].n - a[1].n)
                  .map(([k, g]) => (
                    <div key={k} className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span>{k}</span>
                        <span className="font-mono tabular-nums text-warning">{g.n}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {[...g.books.entries()].map(([b, n]) => `${b} ${n}`).join(" · ")} · last 24 h
                      </div>
                    </div>
                  ))}
              </div>
            )}
            <DataTable
              data={data}
              columns={columns}
              searchPlaceholder="Search findings…"
              facets={[
                { column: "group", label: "What was wrong" },
                { column: "check", label: "Check", format: label },
                { column: "book", label: "Book" },
              ]}
              exportName="data-quality-findings"
              pageSize={25}
              dense
              maxHeight="28rem"
            />
          </>
        )}
      </div>
    </Panel>
  );
}
