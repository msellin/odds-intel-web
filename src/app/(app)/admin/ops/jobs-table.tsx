"use client";

// /admin/ops (Jobs) — every scheduled job, latest run, failing first (#139 admin redesign,
// 2026-09-24). Rows come from view pipeline_job_latest (engine migration 417) through
// buildJobViews(); this file only renders them in the shared DataTable.

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/oi/data-table";
import { StatusBadge, type Tone } from "@/components/oi/status-badge";
import { STATE_RANK, STATE_WORD, type JobState, type JobView } from "@/lib/admin-jobs-model";
import { dayMonth, relTime, utcStamp } from "../bots/bot-board-format";

const STATE_TONE: Record<JobState, Tone> = { failing: "danger", stuck: "warning", running: "info", quiet: "neutral", ok: "success" };
const STATE_TITLE: Record<JobState, string> = {
  failing: "Its last run failed",
  stuck: "Still marked running after 3 hours — it probably died without recording it",
  running: "Running now",
  quiet: "Last run was fine but it has not run for over 8 days — no longer scheduled?",
  ok: "Last run completed",
};

/** "25 min ago" · "6 h ago" · "on 7 Sep" (relTime switches to a date after 14 days). */
function ago(iso: string | null, now: number): string {
  if (!iso) return "—";
  const r = relTime(iso, now);
  if (r === "just now") return r;
  return /\d (min|h|d)$/.test(r) ? `${r} ago` : `on ${r}`;
}

export function JobsTable({ rows, now }: { rows: JobView[]; now: number }) {
  const columns: ColumnDef<JobView>[] = [
    {
      accessorKey: "label",
      header: "Job",
      meta: { label: "Job", csv: (r) => r.job },
      cell: ({ row }) => (
        <div className="min-w-[12rem]">
          <span className="block text-sm">{row.original.label}</span>
          <span className="block font-mono text-[11px] text-muted-foreground">{row.original.job}</span>
        </div>
      ),
    },
    {
      accessorKey: "group",
      header: "Group",
      cell: ({ row }) => <span className="whitespace-nowrap text-xs text-muted-foreground">{row.original.group}</span>,
    },
    {
      id: "state",
      accessorFn: (r) => r.state,
      header: "Status",
      sortingFn: (a, b) => STATE_RANK[a.original.state] - STATE_RANK[b.original.state],
      meta: { label: "Status", csv: (r) => STATE_WORD[r.state] },
      cell: ({ row }) => (
        <StatusBadge tone={STATE_TONE[row.original.state]} title={STATE_TITLE[row.original.state]}>
          {STATE_WORD[row.original.state]}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "lastRun",
      header: "Last run",
      meta: { label: "Last run (UTC)", csv: (r) => r.lastRun },
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm tabular-nums" title={utcStamp(row.original.lastRun)}>
          {ago(row.original.lastRun, now)}
        </span>
      ),
    },
    {
      accessorKey: "failingSince",
      header: "Failing since",
      sortUndefined: "last",
      meta: { label: "Failing since (UTC)", csv: (r) => r.failingSince ?? "" },
      cell: ({ row }) =>
        row.original.failingSince ? (
          <span
            className="whitespace-nowrap text-sm tabular-nums text-danger"
            title={row.original.sinceFloor ? "No success in the 35 days of history we keep — it may be longer" : utcStamp(row.original.failingSince)}
          >
            {row.original.sinceFloor ? `before ${dayMonth(new Date(row.original.failingSince))}` : ago(row.original.failingSince, now)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "streak",
      header: "Failed runs in a row",
      meta: { align: "right", label: "Failed runs in a row" },
      cell: ({ row }) => (row.original.streak ? <span className="text-danger">{row.original.streak}</span> : <span className="text-muted-foreground">—</span>),
    },
    {
      accessorKey: "error",
      header: "Last error",
      enableSorting: false,
      meta: { label: "Last error", csv: (r) => r.error ?? "" },
      cell: ({ row }) =>
        row.original.error ? (
          <span className="line-clamp-2 min-w-[14rem] max-w-md break-words font-mono text-[11px] text-danger/90" title={row.original.error}>
            {row.original.error}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Search jobs or errors…"
      facets={[
        { column: "state", label: "Status", format: (v) => STATE_WORD[v as JobState] ?? v },
        { column: "group", label: "Group" },
      ]}
      exportName="admin-jobs"
      pageSize={25}
      dense
      emptyText="No job runs recorded in the last 35 days."
      rowClassName={(r) => (r.state === "failing" ? "bg-danger/5" : "")}
    />
  );
}

interface StaleRow {
  id: string;
  market: string;
  pick_time: string;
  match_kickoff: string | null;
  bot_id: string;
}

/** Pending bets whose match kicked off more than 2½ h ago (settlement should have caught them). */
export function StaleBetsTable({ rows, now }: { rows: StaleRow[]; now: number }) {
  const columns: ColumnDef<StaleRow>[] = [
    { accessorKey: "market", header: "Market" },
    {
      accessorKey: "match_kickoff",
      header: "Kick-off",
      meta: { label: "Kick-off (UTC)" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums" title={utcStamp(row.original.match_kickoff)}>
          {ago(row.original.match_kickoff, now)}
        </span>
      ),
    },
    {
      accessorKey: "pick_time",
      header: "Picked",
      meta: { label: "Picked (UTC)" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums" title={utcStamp(row.original.pick_time)}>
          {ago(row.original.pick_time, now)}
        </span>
      ),
    },
    {
      accessorKey: "bot_id",
      header: "Bot id",
      enableSorting: false,
      cell: ({ row }) => <span className="font-mono text-[11px] text-muted-foreground">{row.original.bot_id.slice(0, 8)}</span>,
    },
  ];
  return <DataTable data={rows} columns={columns} searchPlaceholder={null} pageSize={10} dense exportName="stale-pending-bets" />;
}
