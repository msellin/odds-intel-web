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

//
// Answer-first fix round (#139, 2026-09-25): the tester read "74 in 24 h" when the checks had found a
// handful of problems re-found every 30 min. The panel now counts DISTINCT problems (dqProblems in
// src/lib/admin-feeds-model.ts: same match + book + kind = one), says "set aside automatically — no
// action needed" when every one was already quarantined or corrected (nothing alarming that needs no
// action), and writes the detail in plain words ("Handicap −0.75: away 1.25, other books 1.54", not
// "ah:-0.75 … 4-book median … 15 pp"). The raw "Check" column is gone — "What was wrong" says it.

import type { ColumnDef } from "@tanstack/react-table";
import type { DataQualityFinding } from "@/lib/engine-data";
import { dqAdvice, dqLast24h, dqProblems, DQ_WINDOW_D, type DqProblem } from "@/lib/admin-feeds-model";
import { DataTable } from "@/components/oi/data-table";
import { Panel, PanelHeader } from "@/components/oi/panel";
import { StatusBadge } from "@/components/oi/status-badge";

const stamp = (iso: string) => iso.slice(5, 16).replace("T", " ").replace(/^(\d\d)-(\d\d)/, "$2/$1");

export function DqFindings({ findings, now, error }: { findings: DataQualityFinding[]; now: number; error: string | null }) {
  // round 6 (2026-09-25): ONE rule with the Overview — dqLast24h (last sighting in 24 h) + dqAdvice
  const problems = dqProblems(findings);
  const day = dqLast24h(problems, now);
  const advice = dqAdvice(problems, now);
  const counts = new Map<string, { n: number; open: number; books: Set<string> }>();
  for (const p of day) {
    const g = counts.get(p.group) ?? { n: 0, open: 0, books: new Set<string>() };
    g.n += 1;
    if (!p.handled) g.open += 1;
    g.books.add(p.book);
    counts.set(p.group, g);
  }
  const columns: ColumnDef<DqProblem>[] = [
    {
      accessorKey: "last",
      header: "Last seen (UTC)",
      cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs tabular-nums">{stamp(row.original.last)}</span>,
    },
    { accessorKey: "group", header: "What was wrong", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.group}</span> },
    { accessorKey: "book", header: "Book" },
    {
      accessorKey: "times",
      header: "Times found",
      meta: { align: "right" },
      cell: ({ row }) => <span title={`First found ${stamp(row.original.first)} UTC; the checks re-run every 30 min`}>{row.original.times}</span>,
    },
    {
      id: "handled",
      accessorFn: (r) => (r.handled ? "Set aside" : "Needs a look"),
      header: "Status",
      cell: ({ row }) =>
        row.original.handled ? (
          <StatusBadge tone="neutral" dot={false}>Set aside</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Needs a look</StatusBadge>
        ),
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
  const badge = error ? (
    <StatusBadge tone="warning">Unreadable</StatusBadge>
  ) : day.length === 0 ? (
    <StatusBadge tone="success">None in 24 h</StatusBadge>
  ) : advice.needsLook ? (
    <StatusBadge tone="warning">{advice.open} need{advice.open === 1 ? "s" : ""} a look · last 24 h</StatusBadge>
  ) : (
    <StatusBadge tone="neutral" dot={false}>{advice.count} in 24 h · set aside automatically</StatusBadge>
  );
  return (
    <Panel id="dq">
      <PanelHeader
        title={`Odds problems found · last ${DQ_WINDOW_D} days`}
        description={`Prices and results the checks caught: another match's prices under ours, home and away swapped, a price far from every other book, scores that disagree between sources. Wrong prices are set aside (and can be restored); wrong results are corrected. Checked when prices are stored and every 30 min. The list covers the last ${DQ_WINDOW_D} days, one row per problem however often it was re-found; the 24 h count takes only problems last seen in the last 24 h — the same count as the Overview.`}
        actions={badge}
      />
      <div className="space-y-3 p-4 pt-3">
        {error ? (
          <p className="text-sm text-warning">Could not read the data-quality findings ({error}) — this is not an all-clear.</p>
        ) : problems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing found in the last {DQ_WINDOW_D} days.</p>
        ) : (
          <>
            <p className={`text-sm ${advice.needsLook ? "text-warning" : "text-muted-foreground"}`}>{advice.text}.</p>
            {counts.size > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {[...counts.entries()]
                  .sort((a, b) => b[1].n - a[1].n)
                  .map(([k, g]) => (
                    <div key={k} className={`rounded-lg border px-3 py-2 ${g.open ? "border-warning/30 bg-warning/5" : "border-border bg-muted/20"}`}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span>{k}</span>
                        <span className={`font-mono tabular-nums ${g.open ? "text-warning" : "text-muted-foreground"}`}>{g.n}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{[...g.books].join(", ")} · last 24 h</div>
                    </div>
                  ))}
              </div>
            )}
            <DataTable
              data={problems}
              columns={columns}
              searchPlaceholder="Search problems…"
              facets={[
                { column: "group", label: "What was wrong" },
                { column: "book", label: "Book" },
                { column: "handled", label: "Status" },
              ]}
              exportName="data-quality-problems"
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
