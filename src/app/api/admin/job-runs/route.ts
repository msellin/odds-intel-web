/**
 * GET /api/admin/job-runs?job=<job_name> — the last runs of one scheduled job, for the Jobs drawer
 * on /admin/ops (#139 UX fix round, 2026-09-24). Read-only: superadmin only, service role server-side,
 * newest JOB_RUNS_LIMIT rows of pipeline_runs (which keeps ~14 days). "shadow_HHMM" means all 48
 * half-hourly shadow_XXXX slots together. Design preview: answered from the jobs fixture.
 */
import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { isBotBoardDevPreview } from "@/lib/bot-board";
import { readAdminFixture } from "@/lib/admin-fixture";
import type { JobRun } from "@/lib/admin-jobs-model";

export const dynamic = "force-dynamic";

const JOB_RUNS_LIMIT = 20;

export async function GET(req: Request) {
  const job = new URL(req.url).searchParams.get("job") ?? "";
  if (!/^[a-z0-9_]{1,80}$/i.test(job)) return NextResponse.json({ error: "job required" }, { status: 400 });

  if (isBotBoardDevPreview()) {
    const fx = await readAdminFixture<{ recent_runs?: Record<string, JobRun[]> }>("jobs");
    if (!fx?.recent_runs) return NextResponse.json({ error: "pipeline_runs: not in fixture" }, { status: 500 });
    return NextResponse.json({ runs: (fx.recent_runs[job] ?? []).slice(0, JOB_RUNS_LIMIT) });
  }

  const gate = await requireSuperadmin();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  let q = gate.db.from("pipeline_runs").select("job_name, status, started_at, completed_at, records_count, error_message");
  q = job === "shadow_HHMM" ? q.like("job_name", "shadow\\_%") : q.eq("job_name", job);
  const { data, error } = await q.order("started_at", { ascending: false }).limit(JOB_RUNS_LIMIT);
  if (error) return NextResponse.json({ error: `pipeline_runs: ${error.message}` }, { status: 500 });
  return NextResponse.json({ runs: data ?? [] });
}
