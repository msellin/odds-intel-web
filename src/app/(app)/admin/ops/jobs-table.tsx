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
import { failingText, isRecentFailure, jobAnchor, lastRunText, STATE_RANK, STATE_WORD, type JobState, type JobView } from "@/lib/admin-jobs-model";
import { marketLabel } from "@/lib/admin-feeds-model";
import type { JobFeed } from "@/lib/admin-jobs";
import { ToastProvider } from "../bots/toast";
import { JobDrawer } from "./job-drawer";
import { utcStamp } from "../bots/bot-board-format";
import { timeAgo } from "@/lib/rel-time";

// answer-first fix round (2026-09-25): four words (OK / Failing / Stuck / Retired, STATE_WORD); a failure
// older than 7 days is amber, not red — the same rule as the page's answer and the Overview.
const STATE_TONE: Record<JobState, Tone> = { failing: "danger", stuck: "warning", running: "success", quiet: "neutral", ok: "success" };
const STATE_TITLE: Record<JobState, string> = {
  failing: "Its last run failed",
  stuck: "Still marked running after 3 hours — it probably died without saying so",
  running: "Running now (for under 3 hours)",
  quiet: "Its last run was fine but it has not run for over 8 days — probably no longer scheduled",
  ok: "Its last run finished",
};
const toneOf = (v: JobView, now: number): Tone => (v.state === "failing" && !isRecentFailure(v, now) ? "warning" : STATE_TONE[v.state]);

function ago(iso: string | null, now: number): string {
  return iso ? timeAgo(iso, now) : "—";
}

export function JobsTable({ rows, old = [], now, feeds, preview }: { rows: JobView[]; old?: JobView[]; now: number; feeds: JobFeed[]; preview: boolean }) {
  const [open, setOpen] = useState<JobView | null>(null);
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (!h.startsWith("job-")) return;
      const v = [...rows, ...old].find((r) => jobAnchor(r.job) === jobAnchor(h.slice(4)));
      if (v) {
        document.getElementById(jobAnchor(v.job))?.scrollIntoView({ block: "center" });
        setOpen(v);
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [rows, old]);
  const columns: ColumnDef<JobView>[] = [
    {
      accessorKey: "label",
      header: "Job",
      meta: { label: "Job", csv: (r) => r.job },
      cell: ({ row }) => (
        <div id={jobAnchor(row.original.job)} className="min-w-[12rem] scroll-mt-24">
          <span className="block text-sm underline-offset-2 group-hover:underline">{row.original.label}</span>
          <span className="block font-mono text-[10px] text-muted-foreground/70">{row.original.job}</span>
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
      // "running" (in progress, < 3 h) and "ok" are both "OK" — one facet chip, not two
      accessorFn: (r) => (r.state === "running" ? "ok" : r.state),
      header: "Status",
      sortingFn: (a, b) => STATE_RANK[a.original.state] - STATE_RANK[b.original.state],
      meta: { label: "Status", csv: (r) => STATE_WORD[r.state] },
      cell: ({ row }) => (
        <StatusBadge tone={toneOf(row.original, now)} title={STATE_TITLE[row.original.state]}>
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
          {lastRunText(row.original, (iso) => ago(iso, now))}
        </span>
      ),
    },
    {
      id: "failingSince",
      // undefined (not null) for non-failing rows, so sortUndefined keeps them last in both directions
      accessorFn: (r) => r.failingSince ?? (r.state === "failing" ? r.lastRun : undefined),
      header: "Failing",
      sortUndefined: "last",
      meta: { label: "Failing (UTC)", csv: (r) => failingText(r) ?? "" },
      cell: ({ row }) => {
        const t = failingText(row.original);
        return t ? (
          <span
            className={`whitespace-nowrap text-sm ${toneOf(row.original, now) === "danger" ? "text-danger" : "text-warning"}`}
            title={row.original.sinceFloor ? "No success in the 35 days of history we keep — it may be longer" : utcStamp(row.original.failingSince)}
          >
            {t}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
  ];
  return (
    <ToastProvider>
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search jobs…"
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
        rowClassName={(r) => `group ${r.state === "failing" ? (toneOf(r, now) === "danger" ? "bg-danger/5" : "bg-warning/5") : ""}`}
      />
      <p className="mt-2 text-xs text-muted-foreground">Click a job for its last runs and how to run it again.</p>
      {old.length > 0 && (
        <details className="mt-3 rounded-lg border border-border">
          <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            Old jobs ({old.length}) — last run fine, but nothing for over 8 days: not running any more?
          </summary>
          <ul className="divide-y divide-border/60 border-t border-border/60">
            {old.map((v) => (
              <li key={v.job} id={jobAnchor(v.job)} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                <button type="button" className="text-left hover:underline" onClick={() => setOpen(v)}>
                  <span className="block text-sm">{v.label}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground/70">{v.job}</span>
                </button>
                <span className="flex items-center gap-2 text-muted-foreground">
                  ran {ago(v.lastRun, now)}
                  <StatusBadge tone="neutral" title={STATE_TITLE.quiet}>
                    {STATE_WORD.quiet}
                  </StatusBadge>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
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
    { accessorKey: "market", header: "Bet type", cell: ({ row }) => marketLabel(row.original.market) },
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
  ];
  return <DataTable data={rows} columns={columns} searchPlaceholder={null} pageSize={10} dense exportName="stale-pending-bets" />;
}
