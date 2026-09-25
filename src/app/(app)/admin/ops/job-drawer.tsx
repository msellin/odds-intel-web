"use client";

// Jobs detail drawer (#139 UX fix round, 2026-09-24). Clicking a row on /admin/ops opens the last
// runs of that job (pipeline_runs via /api/admin/job-runs, read-only), the latest error in full, and
// — only when the job is a feed's scheduler job with a run-now control (JOB_FEED) — a Run now that
// posts to the same audited /api/admin/feed-control as /admin/feeds, with the same dialog words.
// Every other job says plainly how it gets re-run instead of showing a button that cannot work.
//
// Answer-first fix round (2026-09-25): no developer instructions (file paths, job ids) — a job
// without a button says when it runs again or "ask the developer to re-run it"; the Python error text
// sits behind a "Technical detail" toggle; run statuses read OK / Failed / Running / Skipped.

import { useEffect, useState } from "react";
import { Hourglass, RotateCw } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge, type Tone } from "@/components/oi/status-badge";
import { everyGap, failingText, isRecentFailure, JOB_FEED, lastRunText, STATE_WORD, type JobRun, type JobState, type JobView } from "@/lib/admin-jobs-model";
import type { JobFeed } from "@/lib/admin-jobs";
import { ConfirmControlDialog } from "../bots/confirm-control-dialog";
import { utcStamp } from "../bots/bot-board-format";
import { timeAgo } from "@/lib/rel-time";
import { feedActionSpec, useFeedAction } from "../feeds/feed-controls";

const STATE_TONE: Record<JobState, Tone> = { failing: "danger", stuck: "warning", late: "warning", running: "success", quiet: "neutral", ok: "success" };
const RUN_TONE: Record<string, Tone> = { completed: "success", failed: "danger", error: "danger", running: "info", skipped: "neutral" };
const RUN_WORD: Record<string, string> = { completed: "OK", failed: "Failed", error: "Failed", running: "Running", skipped: "Skipped" };

function ago(iso: string | null, now: number): string {
  return iso ? timeAgo(iso, now) : "—";
}

function duration(a: string, b: string | null): string {
  if (!b) return "—";
  const s = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000));
  return s < 90 ? `${s} s` : `${Math.round(s / 60)} min`;
}

/** How a job without a Run-now button gets run again, in plain words. */
function rerunText(job: string): string {
  if (/^settlement_|^settle/.test(job)) return "It is part of settlement: the 15-minute settlement check and the nightly run (21:00 UTC) run it again on their own.";
  if (/^fetch_|^betting_pipeline$|^morning_pipeline$/.test(job))
    return "It is a step of the morning data load (04:00 UTC), which runs it again tomorrow; the hourly picks refresh covers the day.";
  if (job === "shadow_HHMM") return "The pick scan runs every 30 minutes, so the next one re-runs it within half an hour.";
  return "It runs again at its next scheduled time. To run it sooner, ask the developer to re-run it.";
}

export function JobDrawer({ view, feeds, now, preview, onClose }: { view: JobView | null; feeds: JobFeed[]; now: number; preview: boolean; onClose: () => void }) {
  return (
    <Sheet open={!!view} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {view && <Body key={view.job} v={view} feeds={feeds} now={now} preview={preview} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ v, feeds, now, preview }: { v: JobView; feeds: JobFeed[]; now: number; preview: boolean }) {
  const [runs, setRuns] = useState<JobRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/job-runs?job=${encodeURIComponent(v.job)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) setError(j.error ?? `HTTP ${r.status}`);
        else setRuns(j.runs ?? []);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [v.job]);

  const feedId = JOB_FEED[v.job];
  const feed = feedId ? feeds.find((f) => f.feed_id === feedId) : undefined;
  const canRun = !!feed && (feed.controls ?? []).includes("run_now");
  const lastError = runs?.find((r) => r.error_message)?.error_message ?? v.error;

  return (
    <>
      <SheetHeader className="border-b border-border">
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {v.label}
          <StatusBadge tone={v.state === "failing" && !isRecentFailure(v, now) ? "warning" : STATE_TONE[v.state]}>{STATE_WORD[v.state]}</StatusBadge>
        </SheetTitle>
        <SheetDescription render={<div />} className="space-y-0.5 text-xs text-muted-foreground">
          <span className="block">
            {v.group} · {lastRunText(v, (iso) => ago(iso, now))} · last success {v.lastOk ? ago(v.lastOk, now) : "none in the last 35 days"}
          </span>
          {failingText(v) && <span className="block text-foreground">{failingText(v)}</span>}
          {v.usualGapMs != null && (
            <span className="block">
              Usually runs {everyGap(v.usualGapMs)}
              {v.state === "late" ? " — now well overdue" : ""} (from its last few days of runs)
            </span>
          )}
          {/* the job's code name lives here only (round 6: none on the page's face) — for telling the developer */}
          <span className="block font-mono text-[10px] text-muted-foreground/70">Job id: {v.job}</span>
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-6">
        <section className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <h3 className="text-sm font-medium">Run it again</h3>
          {canRun && feed ? (
            <RunNow feed={feed} preview={preview} />
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No Run-now button for this job. {rerunText(v.job)}</p>
          )}
        </section>

        {lastError && (
          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Technical detail (the error the job reported)</summary>
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-danger/5 px-2 py-1.5 font-mono text-[11px] text-danger/90">
              {lastError}
            </pre>
          </details>
        )}

        <section>
          <h3 className="mb-1 text-sm font-medium">Last runs</h3>
          {error ? (
            <p className="text-sm text-warning">Could not read the runs ({error}) — this is not an all-clear.</p>
          ) : runs === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs in the history we keep (about two weeks).</p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-lg border border-border">
              {runs.map((r, i) => (
                <li key={`${r.started_at}-${i}`} className="px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="tabular-nums" title={utcStamp(r.started_at)}>
                      {ago(r.started_at, now)} <span className="text-muted-foreground">· {utcStamp(r.started_at)}</span>
                    </span>
                    <StatusBadge tone={RUN_TONE[r.status] ?? "neutral"}>{RUN_WORD[r.status] ?? r.status}</StatusBadge>
                  </div>
                  <div className="mt-0.5 text-muted-foreground">
                    took {duration(r.started_at, r.completed_at)}
                    {r.records_count != null ? ` · ${r.records_count.toLocaleString("en-US")} records` : ""}
                    {v.job === "shadow_HHMM" ? ` · slot ${r.job_name.slice(-4, -2)}:${r.job_name.slice(-2)}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function RunNow({ feed, preview }: { feed: JobFeed; preview: boolean }) {
  const { run, busy, error, setError } = useFeedAction(feed.feed_id, feed.label);
  const [open, setOpen] = useState(false);
  const disabledWhy = feed.paused ? "The feed is paused — resume it on the Feeds page first." : feed.run_now_pending ? "A run is already queued — the engine starts it within 30 s." : null;
  return (
    <div className="mt-1 space-y-1.5">
      <p className="text-xs text-muted-foreground">
        This is the scheduler job of the feed <span className="text-foreground">{feed.label}</span>, so it can be started from here (same as Run now on the
        Feeds page).
      </p>
      <button
        type="button"
        disabled={busy || !!disabledWhy}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {feed.run_now_pending ? <Hourglass size={12} aria-hidden="true" /> : <RotateCw size={12} aria-hidden="true" />}
        {feed.run_now_pending ? "Run queued" : "Run now"}
      </button>
      {disabledWhy && <p className="text-xs text-muted-foreground">{disabledWhy}</p>}
      <ConfirmControlDialog
        spec={open ? feedActionSpec("run_now", feed, null) : null}
        open={open}
        busy={busy}
        error={error}
        readOnlyReason={preview ? "Design preview — nothing is sent. On the live admin this records the request and the engine carries it out." : null}
        onCancel={() => setOpen(false)}
        onConfirm={async (reason) => {
          if (await run("run_now", reason)) setOpen(false);
        }}
      />
    </div>
  );
}
