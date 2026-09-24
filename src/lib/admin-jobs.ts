/**
 * /admin/ops ("Jobs") loader (#139 admin redesign, 2026-09-24). "Are the scheduled jobs, settlement
 * and data enrichment healthy?"
 *
 * Reads (service role, server only):
 *   - view pipeline_job_latest (engine migration 417) — latest run per job over 35 days with its
 *     failure streak. Replaces the old engine-data latest-status helper, which saw only the newest 300 runs (~2 h) and
 *     so never showed a nightly job failing (IA §1.6);
 *   - failed pipeline_runs of the last 14 days → the failures-per-day chart (pipeline_runs keeps ~14 d);
 *   - pending simulated_bets with their kickoff → stale pending bets (settlement stuck);
 *   - today's ops_snapshots row → settlement + enrichment coverage;
 *   - profiles.created_at → signups in 7 days (the one user number kept, IA §2.3).
 *   - feed_status (feed_id, controls, paused, …) → the Jobs drawer's Run-now for jobs that are a feed's
 *     scheduler job (JOB_FEED in admin-jobs-model.ts). The drawer's run list comes from
 *     /api/admin/job-runs on demand.
 * Every read keeps its error so an unreadable source renders "unreadable", never 0 / all clear.
 */
import { createServerServiceClient } from "@/lib/supabase-server";
import { readAdminFixture } from "@/lib/admin-fixture";
import type { OpsSnapshot } from "@/lib/engine-data";
import type { JobLatestRow } from "@/lib/admin-jobs-model";
import type { R } from "@/lib/admin-feeds";

export interface StaleBet {
  id: string;
  market: string;
  pick_time: string;
  bot_id: string;
  match_kickoff: string | null;
}

export interface FailDay {
  day: string;
  failed: number;
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
}

/** Same 150-min rule as getStalePendingBets: fix_stale_live_matches uses 130 min, so alarm after it. */
export const STALE_AFTER_MIN = 150;
export const FAIL_DAYS = 14;
const FAILED_LIMIT = 5000;

interface JobsFixture {
  jobs?: JobLatestRow[];
  failed_runs?: { job_name: string; started_at: string }[];
  pending?: StaleBet[];
  snapshot?: OpsSnapshot | null;
  signups_7d?: number;
  feeds?: JobFeed[];
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

function perDay(rows: { job_name: string; started_at: string }[], now: number): FailDay[] {
  const days: FailDay[] = [];
  for (let i = FAIL_DAYS - 1; i >= 0; i--) days.push({ day: new Date(now - i * 86_400_000).toISOString().slice(0, 10), failed: 0, jobs: 0 });
  const idx = new Map(days.map((d, i) => [d.day, i]));
  const jobsPer = days.map(() => new Set<string>());
  for (const r of rows) {
    const i = idx.get(r.started_at.slice(0, 10));
    if (i == null) continue;
    days[i].failed += 1;
    jobsPer[i].add(/^shadow_\d{4}$/.test(r.job_name) ? "shadow" : r.job_name);
  }
  days.forEach((d, i) => (d.jobs = jobsPer[i].size));
  return days;
}

function staleOf(pending: StaleBet[], now: number): StaleBet[] {
  const cutoff = now - STALE_AFTER_MIN * 60_000;
  return pending.filter((b) => b.match_kickoff && new Date(b.match_kickoff).getTime() < cutoff);
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
      failDays: fx.failed_runs ? { v: perDay(failed, now), error: null } : { v: [], error: "pipeline_runs: not in fixture" },
      failTruncated: failed.length >= FAILED_LIMIT,
      stale: fx.pending ? { v: staleOf(pending, now), error: null } : { v: [], error: "simulated_bets: not in fixture" },
      pendingTotal: pending.length,
      snapshot: fx.snapshot === undefined ? { v: null, error: "ops_snapshots: not in fixture" } : { v: fx.snapshot, error: null },
      signups7d: fx.signups_7d === undefined ? { v: null, error: "profiles: not in fixture" } : { v: fx.signups_7d, error: null },
      feeds: fx.feeds ? { v: fx.feeds, error: null } : { v: [], error: "feed_status: not in fixture" },
    };
  }

  const db = createServerServiceClient();
  const today = new Date(now).toISOString().slice(0, 10);
  const since14 = new Date(now - FAIL_DAYS * 86_400_000).toISOString();
  const since7 = new Date(now - 7 * 86_400_000).toISOString();
  const [jobs, failed, pending, snap, signups, feeds] = await Promise.all([
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
    read<{ id: string; market: string; pick_time: string; bot_id: string; match: { date: string } | null }[]>(
      "simulated_bets",
      () => db.from("simulated_bets").select("id, market, pick_time, bot_id, match:match_id(date)").eq("result", "pending").order("pick_time", { ascending: true }).limit(5000),
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
  ]);
  const pend: StaleBet[] = pending.v.map((b) => ({ id: b.id, market: b.market, pick_time: b.pick_time, bot_id: b.bot_id, match_kickoff: b.match?.date ?? null }));
  return {
    now,
    jobs,
    failDays: { v: failed.error ? [] : perDay(failed.v, now), error: failed.error },
    failTruncated: failed.v.length >= FAILED_LIMIT,
    stale: { v: staleOf(pend, now), error: pending.error },
    pendingTotal: pend.length,
    snapshot: { v: snap.v[0] ?? null, error: snap.error },
    signups7d: signups,
    feeds,
  };
}
