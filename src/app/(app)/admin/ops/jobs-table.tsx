"use client";

// /admin/ops (Jobs) — every scheduled job, latest run, failing first (#139 admin redesign,
// 2026-09-24). Rows come from view pipeline_job_latest (engine migration 417) through
// buildJobViews(); this file only renders them in the shared DataTable.
//
// #139 UX fix round (2026-09-24): every row is clickable and opens JobDrawer (last runs, full error,
// Run now where a feed-control path exists); each row carries id="job-<job_name>" (jobAnchor) so
// /admin/ops#job-<name> — e.g. from the Overview's attention list — scrolls to it AND opens its
// drawer; the table is unpaged so every anchor exists. "Failing since" sorts non-failing rows last
// in BOTH directions (their value is undefined, sortUndefined "last").

import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/oi/data-table";
import { StatusBadge, type Tone } from "@/components/oi/status-badge";
import { jobAnchor, STATE_RANK, STATE_WORD, type JobState, type JobView } from "@/lib/admin-jobs-model";
import type { JobFeed } from "@/lib/admin-jobs";
import { ToastProvider } from "../bots/toast";
import { JobDrawer } from "./job-drawer";
import { dayMonth, utcStamp } from "../bots/bot-board-format";
import { timeAgo } from "@/lib/rel-time";

const STATE_TONE: Record<JobState, Tone> = { failing: "danger", stuck: "warning", running: "info", quiet: "neutral", ok: "success" };
const STATE_TITLE: Record<JobState, string> = {
  failing: "Its last run failed",
  stuck: "Still marked running after 3 hours — it probably died without recording it",
  running: "Running now",
  quiet: "Last run was fine but it has not run for over 8 days — no longer scheduled?",
  ok: "Last run completed",
};

function ago(iso: string | null, now: number): string {
  return iso ? timeAgo(iso, now) : "—";
}

export function JobsTable({ rows, now, feeds, preview }: { rows: JobView[]; now: number; feeds: JobFeed[]; preview: boolean }) {
  const [open, setOpen] = useState<JobView | null>(null);
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (!h.startsWith("job-")) return;
      const v = rows.find((r) => jobAnchor(r.job) === jobAnchor(h.slice(4)));
      if (v) {
        document.getElementById(jobAnchor(v.job))?.scrollIntoView({ block: "center" });
        setOpen(v);
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [rows]);
  const columns: ColumnDef<JobView>[] = [
    {
      accessorKey: "label",
      header: "Job",
      meta: { label: "Job", csv: (r) => r.job },
      cell: ({ row }) => (
        <div id={jobAnchor(row.original.job)} className="min-w-[12rem] scroll-mt-24">
          <span className="block text-sm underline-offset-2 group-hover:underline">{row.original.label}</span>
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
      id: "failingSince",
      // undefined (not null) for non-failing rows, so sortUndefined keeps them last in both directions
      accessorFn: (r) => r.failingSince ?? undefined,
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
    <ToastProvider>
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search jobs or errors…"
        facets={[
          { column: "state", label: "Status", format: (v) => STATE_WORD[v as JobState] ?? v },
          { column: "group", label: "Group" },
        ]}
        exportName="admin-jobs"
        pageSize={0}
        maxHeight="44rem"
        dense
        emptyText="No job runs recorded in the last 35 days."
        onRowClick={(r) => {
          setOpen(r);
          window.history.replaceState(window.history.state, "", `#${jobAnchor(r.job)}`);
        }}
        rowClassName={(r) => `group ${r.state === "failing" ? "bg-danger/5" : ""}`}
      />
      <p className="mt-2 text-xs text-muted-foreground">Click a job for its last runs, the full error and how to run it again.</p>
      <JobDrawer
        view={open}
        feeds={feeds}
        now={now}
        preview={preview}
        onClose={() => {
          setOpen(null);
          window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
        }}
      />
    </ToastProvider>
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
