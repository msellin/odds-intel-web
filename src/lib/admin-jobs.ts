/**
 * /admin/ops ("Jobs") loader (#139 admin redesign, 2026-09-24). "Are the scheduled jobs, settlement
 * and data enrichment healthy?"
 *
 * Reads (service role, server only):
 *   - view pipeline_job_latest (engine migration 417) — latest run per job over 35 days with its
 *     failure streak. Replaces the old engine-data latest-status helper, which saw only the newest 300 runs (~2 h) and
 *     so never showed a nightly job failing (IA §1.6);
 *   - failed pipeline_runs of the last 14 days → the failures-per-day chart (pipeline_runs keeps ~14 d),
 *     each split into "fixed since" (the job succeeded later) vs "still failing" (part of the job's
 *     current failure run, per pipeline_job_latest.failing_since) — answer-first fix round 2026-09-25:
 *     red bars every day beside "1 job failing" read as fourteen days of outage;
 *   - retired_jobs (migration 426) → unregistered jobs are left out of the chart too (the view
 *     already drops them from the job list);
 *   - pending simulated_bets with their kickoff → stale pending bets (settlement stuck);
 *   - today's ops_snapshots row → settlement + enrichment coverage;
 *   - profiles.created_at → signups in 7 days (the one user number kept, IA §2.3).
 *   - pipeline_runs start/finish times of the last CADENCE_DAYS (and up to 14 d for jobs quiet longer)
 *     → each job's usual gap and run time (jobCadence), which turns on the Late state and the
 *     run-time Stuck rule (round 6, 2026-09-25: "Feed status check · OK · ran 83 min ago" beside
 *     Feeds saying that check had stopped). loadJobCadence is exported so the Overview reads the same;
 *   - feed_status (feed_id, controls, paused, …) → the Jobs drawer's Run-now for jobs that are a feed's
 *     scheduler job (JOB_FEED in admin-jobs-model.ts). The drawer's run list comes from
 *     /api/admin/job-runs on demand.
 * Every read keeps its error so an unreadable source renders "unreadable", never 0 / all clear.
 */
import { unstable_cache } from "next/cache";
import { createServerServiceClient } from "@/lib/supabase-server";
import { readAdminFixture } from "@/lib/admin-fixture";
import type { OpsSnapshot } from "@/lib/engine-data";
import { jobCadence, type CadenceRun, type JobCadence, type JobLatestRow } from "@/lib/admin-jobs-model";
import type { R } from "@/lib/admin-feeds";

export interface StaleBet {
  id: string;
  market: string;
  pick_time: string;
  bot_id: string;
  match_kickoff: string | null;
  /** matches.status — 'postponed' / 'cancelled' bets are voided by settlement (settlement.py SETTLE-VOID-POSTPONED). */
  match_status?: string | null;
}

/**
 * Pending picks on a postponed or cancelled match. Since engine #165 (2026-09-25) settlement voids these in
 * every bet table every 15 min (settlement.void_bets_on_dead_matches; 219 shadow picks pending since 23 Aug
 * were voided that day), so any still pending past the grace means the sweep did not run.
 */
export function postponedNeedingVoid(pending: Pick<StaleBet, "match_status">[]): number {
  return pending.filter((b) => b.match_status === "postponed" || b.match_status === "cancelled").length;
}

/** Grace after the (original) kick-off before a postponed pick counts as left open. */
export const POSTPONED_GRACE_H = 6;

/**
 * THE postponed-leftovers count, shared by /admin/ops and the Overview inbox: pending simulated_bets AND
 * shadow_bets on postponed/cancelled matches whose kick-off is POSTPONED_GRACE_H+ ago.
 */
export async function loadPostponedOpen(db: Db, now: number): Promise<R<number>> {
  type Row = { match: { date: string; status: string | null } | null };
  const q = (t: "simulated_bets" | "shadow_bets") =>
    read<Row[]>(t, () => db.from(t).select("match:match_id(date, status)").eq("result", "pending").limit(5000), []);
  const [sim, sh] = await Promise.all([q("simulated_bets"), q("shadow_bets")]);
  const err = sim.error ?? sh.error;
  if (err) return { v: 0, error: err };
  const rows = [...sim.v, ...sh.v].filter((b) => b.match?.date && now - new Date(b.match.date).getTime() > POSTPONED_GRACE_H * 3_600_000);
  return { v: postponedNeedingVoid(rows.map((b) => ({ match_status: b.match?.status ?? null }))), error: null };
}

export interface FailDay {
  day: string;
  /** all failed runs that day */
  failed: number;
  /** of which the job succeeded on a later run */
  fixed: number;
  /** of which still part of the job's current failure run */
  still: number;
  jobs: number;
}

/** What the Jobs drawer needs about a feed to offer Run now. */
export interface JobFeed {
  feed_id: string;
  label: string;
  book: string | null;
  schedule: string | null;
  controls: string[] | null;
  paused: boolean;
  run_now_pending: boolean;
}

export interface JobsPageData {
  now: number;
  jobs: R<JobLatestRow[]>;
  failDays: R<FailDay[]>;
  /** true when the failed-runs read hit its row limit (the chart undercounts). */
  failTruncated: boolean;
  stale: R<StaleBet[]>;
  pendingTotal: number;
  snapshot: R<OpsSnapshot | null>;
  signups7d: R<number | null>;
  feeds: R<JobFeed[]>;
  /** each job's usual gap / run time; error → Late cannot be judged (the page says so). */
  cadence: R<Record<string, JobCadence>>;
  /** pending bets on postponed/cancelled matches that settlement has not voided (postponedNeedingVoid). */
  postponedPending: R<number>;
}

/** Same 150-min rule as getStalePendingBets: fix_stale_live_matches uses 130 min, so alarm after it. */
export const STALE_AFTER_MIN = 150;
export const FAIL_DAYS = 14;
/** Days of run history read for the usual gap (jobs quiet longer get up to FAIL_DAYS, see loadJobCadence). */
export const CADENCE_DAYS = 4;
const PAGE = 5000;
const CADENCE_MAX_ROWS = 40_000;
const FAILED_LIMIT = 5000;

interface JobsFixture {
  jobs?: JobLatestRow[];
  failed_runs?: { job_name: string; started_at: string }[];
  pending?: StaleBet[];
  snapshot?: OpsSnapshot | null;
  signups_7d?: number;
  feeds?: JobFeed[];
  retired?: string[];
  cadence_runs?: CadenceRun[];
}

async function read<T>(label: string, q: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, fallback: T): Promise<R<T>> {
  try {
    const { data, error } = await q();
    if (error) return { v: fallback, error: `${label}: ${error.message}` };
    return { v: (data ?? fallback) as T, error: null };
  } catch (e) {
    return { v: fallback, error: `${label}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function perDay(rows: { job_name: string; started_at: string }[], now: number, latest: JobLatestRow[], retired: Set<string>): FailDay[] {
  const days: FailDay[] = [];
  for (let i = FAIL_DAYS - 1; i >= 0; i--) days.push({ day: new Date(now - i * 86_400_000).toISOString().slice(0, 10), failed: 0, fixed: 0, still: 0, jobs: 0 });
  const idx = new Map(days.map((d, i) => [d.day, i]));
  const jobsPer = days.map(() => new Set<string>());
  // A failed run is "still failing" when its job's latest run failed and it is inside that job's current
  // failure run (at or after failing_since). Everything else was followed by a success.
  const openSince = new Map(
    latest.filter((j) => (j.status === "failed" || j.status === "error") && j.failing_since).map((j) => [j.job_name, j.failing_since as string]),
  );
  for (const r of rows) {
    if (retired.has(r.job_name)) continue;
    const i = idx.get(r.started_at.slice(0, 10));
    if (i == null) continue;
    days[i].failed += 1;
    const since = openSince.get(r.job_name);
    if (since && new Date(r.started_at).getTime() >= new Date(since).getTime()) days[i].still += 1;
    else days[i].fixed += 1;
    jobsPer[i].add(/^shadow_\d{4}$/.test(r.job_name) ? "shadow" : r.job_name);
  }
  days.forEach((d, i) => (d.jobs = jobsPer[i].size));
  return days;
}

function staleOf(pending: StaleBet[], now: number): StaleBet[] {
  const cutoff = now - STALE_AFTER_MIN * 60_000;
  return pending.filter((b) => b.match_kickoff && new Date(b.match_kickoff).getTime() < cutoff);
}

type Db = ReturnType<typeof createServerServiceClient>;

/**
 * Each job's usual gap and run time. Two reads, both small: (1) every run of the last CADENCE_DAYS
 * (about 12k rows, paged under PostgREST's 10k db-max-rows); (2) for jobs whose latest run is older
 * than that, their runs of the last FAIL_DAYS (pipeline_runs keeps about two weeks) — so a 5-minute
 * job that died 5 days ago still has a usual gap and reads Late, not OK. The 48 half-hourly shadow
 * slots are left out: each slot runs once a day, so they are never judged late.
 */
export async function loadJobCadence(db: Db, latest: JobLatestRow[], now: number): Promise<R<Record<string, JobCadence>>> {
  const cols = "job_name, started_at, completed_at, status";
  const since = new Date(now - CADENCE_DAYS * 86_400_000).toISOString();
  try {
    const runs: CadenceRun[] = [];
    for (let from = 0; from < CADENCE_MAX_ROWS; from += PAGE) {
      const { data, error } = await db
        .from("pipeline_runs")
        .select(cols)
        .gte("started_at", since)
        .not("job_name", "like", "shadow_%")
        .order("started_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) return { v: {}, error: `pipeline_runs (usual gaps): ${error.message}` };
      runs.push(...((data ?? []) as CadenceRun[]));
      if (!data || data.length < PAGE) break;
      // never silently drop the NEWEST runs at the cap (pages run oldest-first)
      if (from + PAGE >= CADENCE_MAX_ROWS) return { v: {}, error: `pipeline_runs (usual gaps): over ${CADENCE_MAX_ROWS} runs in ${CADENCE_DAYS} days — lateness not checked` };
    }
    const older = latest.filter((j) => !/^shadow_\d{4}$/.test(j.job_name) && j.started_at < since).map((j) => j.job_name);
    if (older.length) {
      const { data, error } = await db
        .from("pipeline_runs")
        .select(cols)
        .in("job_name", older)
        .gte("started_at", new Date(now - FAIL_DAYS * 86_400_000).toISOString())
        .order("started_at", { ascending: false })
        .limit(PAGE);
      if (error) return { v: {}, error: `pipeline_runs (usual gaps): ${error.message}` };
      runs.push(...((data ?? []) as CadenceRun[]));
    }
    return { v: jobCadence(runs), error: null };
  } catch (e) {
    return { v: {}, error: `pipeline_runs (usual gaps): ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * loadJobCadence cached for 10 min (review 2026-09-25: ~12k pipeline_runs rows in sequential pages on
 * every Overview AND Jobs render, and the shell refreshes every 60 s). A job's usual gap and run time
 * change over days, not minutes; lateness itself is still judged against the live last-run time.
 * The job list is read inside so the cache key needs no arguments.
 */
const cadenceCached = unstable_cache(
  async () => {
    const db = createServerServiceClient();
    const { data, error } = await db.from("pipeline_job_latest").select("*");
    if (error) return { v: {} as Record<string, JobCadence>, error: `pipeline_job_latest: ${error.message}` };
    return loadJobCadence(db, (data ?? []) as JobLatestRow[], Date.now());
  },
  ["admin-job-cadence-v1"],
  { revalidate: 600 },
);
export async function loadJobCadenceCached(): Promise<R<Record<string, JobCadence>>> {
  return cadenceCached();
}

export async function loadJobsPage(): Promise<JobsPageData> {
  const now = Date.now();
  const fx = await readAdminFixture<JobsFixture>("jobs");
  if (fx) {
    const pending = fx.pending ?? [];
    const failed = fx.failed_runs ?? [];
    return {
      now,
      jobs: fx.jobs ? { v: fx.jobs, error: null } : { v: [], error: "pipeline_job_latest: not in fixture" },
      failDays: fx.failed_runs ? { v: perDay(failed, now, fx.jobs ?? [], new Set(fx.retired ?? [])), error: null } : { v: [], error: "pipeline_runs: not in fixture" },
      failTruncated: failed.length >= FAILED_LIMIT,
      stale: fx.pending ? { v: staleOf(pending, now), error: null } : { v: [], error: "simulated_bets: not in fixture" },
      pendingTotal: pending.length,
      snapshot: fx.snapshot === undefined ? { v: null, error: "ops_snapshots: not in fixture" } : { v: fx.snapshot, error: null },
      signups7d: fx.signups_7d === undefined ? { v: null, error: "profiles: not in fixture" } : { v: fx.signups_7d, error: null },
      feeds: fx.feeds ? { v: fx.feeds, error: null } : { v: [], error: "feed_status: not in fixture" },
      cadence: fx.cadence_runs ? { v: jobCadence(fx.cadence_runs), error: null } : { v: {}, error: "pipeline_runs (usual gaps): not in fixture" },
      postponedPending: fx.pending ? { v: postponedNeedingVoid(pending), error: null } : { v: 0, error: "simulated_bets: not in fixture" },
    };
  }

  const db = createServerServiceClient();
  const today = new Date(now).toISOString().slice(0, 10);
  const since14 = new Date(now - FAIL_DAYS * 86_400_000).toISOString();
  const since7 = new Date(now - 7 * 86_400_000).toISOString();
  const [jobs, failed, pending, snap, signups, feeds, retired] = await Promise.all([
    read<JobLatestRow[]>("pipeline_job_latest", () => db.from("pipeline_job_latest").select("*"), []),
    read<{ job_name: string; started_at: string }[]>(
      "pipeline_runs",
      () =>
        db
          .from("pipeline_runs")
          .select("job_name, started_at")
          .eq("status", "failed")
          .gte("started_at", since14)
          .not("job_name", "in", '("hist_backfill","backfill_coaches","backfill_transfers")')
          .order("started_at", { ascending: false })
          .limit(FAILED_LIMIT),
      [],
    ),
    read<{ id: string; market: string; pick_time: string; bot_id: string; match: { date: string; status: string | null } | null }[]>(
      "simulated_bets",
      () => db.from("simulated_bets").select("id, market, pick_time, bot_id, match:match_id(date, status)").eq("result", "pending").order("pick_time", { ascending: true }).limit(5000),
      [],
    ),
    read<OpsSnapshot[]>(
      "ops_snapshots",
      () => db.from("ops_snapshots").select("*").eq("snapshot_date", today).order("created_at", { ascending: false }).limit(1),
      [],
    ),
    (async (): Promise<R<number | null>> => {
      try {
        const { count, error } = await db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since7);
        return error ? { v: null, error: `profiles: ${error.message}` } : { v: count ?? 0, error: null };
      } catch (e) {
        return { v: null, error: `profiles: ${e instanceof Error ? e.message : String(e)}` };
      }
    })(),
    read<JobFeed[]>("feed_status", () => db.from("feed_status").select("feed_id, label, book, schedule, controls, paused, run_now_pending"), []),
    // unreadable → treat as none retired (the job list itself already excludes them via the view)
    read<{ job_name: string }[]>("retired_jobs", () => db.from("retired_jobs").select("job_name"), []),
  ]);
  const pend: StaleBet[] = pending.v.map((b) => ({
    id: b.id, market: b.market, pick_time: b.pick_time, bot_id: b.bot_id, match_kickoff: b.match?.date ?? null, match_status: b.match?.status ?? null,
  }));
  const cadence = jobs.error ? { v: {}, error: "pipeline_job_latest unreadable" } : await loadJobCadenceCached();
  return {
    now,
    jobs,
    failDays: { v: failed.error ? [] : perDay(failed.v, now, jobs.v, new Set(retired.v.map((r) => r.job_name))), error: failed.error },
    failTruncated: failed.v.length >= FAILED_LIMIT,
    stale: { v: staleOf(pend, now), error: pending.error },
    pendingTotal: pend.length,
    snapshot: { v: snap.v[0] ?? null, error: snap.error },
    signups7d: signups,
    feeds,
    cadence,
    postponedPending: await loadPostponedOpen(db, now),
  };
}
