export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import { AlertOctagon, CheckCircle2, Hourglass, Scale, UserPlus } from "lucide-react";
import { AutoRefreshBadge } from "./auto-refresh";
import { Meter, shareTone } from "./meter";
import { JobsTable, StaleBetsTable } from "./jobs-table";
import { FailuresChart } from "./jobs-charts";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { isBotBoardDevPreview } from "@/lib/bot-board";
import { loadJobsPage, STALE_AFTER_MIN } from "@/lib/admin-jobs";
import { buildJobViews, JOB_GROUPS, OTHER_GROUP, type JobView } from "@/lib/admin-jobs-model";
import { PageHeader, Panel, PanelHeader } from "@/components/oi/panel";
import { StatCard } from "@/components/oi/stat-card";
import { StatusBadge } from "@/components/oi/status-badge";
import { fmtInt } from "@/components/oi/format";

// /admin/ops — labelled "Jobs" in the sidebar (#139 IA move P9, 2026-09-24; URL kept for bookmarks
// and smoke pins). It answers one question: are the scheduled jobs, settlement and data enrichment
// healthy? Per the IA audit (dev/active/admin-information-architecture.md §2.1/§2.3):
//   - odds-pipeline coverage, the live tracker and the API-Football budget MOVED to /admin/feeds;
//   - "Email & alerts", the Pro/Elite user tiles and the stale "Betting & bots" section (fixed bot
//     counts, a dollar sign, a long-past paper-trading start date) were DELETED — paid tiers are gone and /admin/bots owns bots;
//     one "signups in 7 days" number stays;
//   - the per-job list now reads view pipeline_job_latest (35 days + failure streak) instead of the
//     newest 300 runs, which covered ~2 h and never showed a nightly job failing.
// Loader: src/lib/admin-jobs.ts; view model: src/lib/admin-jobs-model.ts.

export const metadata: Metadata = { title: "Jobs · Admin · OddsIntel", robots: { index: false } };

function ago(iso: string | null | undefined, now: number): string {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export default async function OpsDashboardPage() {
  if (!isBotBoardDevPreview()) {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return <div className="flex items-center justify-center py-24 text-muted-foreground">Access denied.</div>;
    }
    const db = createServerServiceClient();
    const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
    if (!profile?.is_superadmin) {
      return <div className="flex items-center justify-center py-24 text-muted-foreground">Superadmin only.</div>;
    }
  }

  const d = await loadJobsPage();
  const { now } = d;
  const views = buildJobViews(d.jobs.v, now);
  const jobsUnknown = !!d.jobs.error;
  const failing = views.filter((v) => v.state === "failing");
  const stuck = views.filter((v) => v.state === "stuck");
  const settlement = d.jobs.v.find((j) => j.job_name === "settlement");
  const sweep = d.jobs.v.find((j) => j.job_name === "settle_ready");
  const settleOk = settlement?.last_ok_at ?? null;
  const settleAgeH = settleOk ? (now - new Date(settleOk).getTime()) / 3600_000 : null;
  const staleN = d.stale.v.length;
  // Before 22:00 UTC a stale bet is expected (the 21:00 run is the catch-all); after it, it is an alarm.
  const staleAlarm = staleN > 0 && new Date(now).getUTCHours() >= 22;
  const s = d.snapshot.v;
  const snapAge = s ? Math.round((now - new Date(s.created_at).getTime()) / 60000) : null;
  const snapNote = d.snapshot.error
    ? `Unreadable: ${d.snapshot.error}`
    : !s
      ? "No ops snapshot for today yet — the engine writes one every hour."
      : `From the ops snapshot written ${snapAge} min ago (hourly).`;

  const byGroup = new Map<string, JobView[]>();
  for (const v of views) byGroup.set(v.group, [...(byGroup.get(v.group) ?? []), v]);
  const groups = [...JOB_GROUPS, OTHER_GROUP].filter((g) => byGroup.has(g.label));

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        eyebrow="Data & ops"
        title="Jobs"
        meta="Are the engine's scheduled jobs, settlement and match-data loading healthy? Job history covers the last 35 days."
        actions={<AutoRefreshBadge intervalMs={60_000} checkedAt={now} />}
      />

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Jobs failing now"
          icon={failing.length ? AlertOctagon : CheckCircle2}
          tone={failing.length ? "danger" : "success"}
          unknown={jobsUnknown}
          value={failing.length}
          foot={failing.length ? `of ${views.length} jobs · worst: ${failing[0].label}` : `all ${views.length} jobs' last runs passed`}
          href="#runs"
          hrefLabel="See jobs"
        />
        <StatCard
          label="Stuck"
          icon={Hourglass}
          tone={stuck.length ? "warning" : "success"}
          unknown={jobsUnknown}
          value={stuck.length}
          foot={stuck.length ? `"running" for over 3 h: ${stuck.map((x) => x.label).join(", ")}` : "nothing hanging"}
          href="#runs"
          hrefLabel="See jobs"
        />
        <StatCard
          label="Stale pending bets"
          icon={Scale}
          tone={staleN === 0 ? "success" : staleAlarm ? "danger" : "warning"}
          unknown={!!d.stale.error}
          value={staleN}
          foot={staleN ? `unsettled ${STALE_AFTER_MIN / 60} h+ after kick-off · ${fmtInt(d.pendingTotal)} pending in all` : `${fmtInt(d.pendingTotal)} pending, none overdue`}
          href="#settlement"
          hrefLabel="Settlement"
        />
        <StatCard
          label="Last settlement"
          icon={CheckCircle2}
          tone={settleAgeH == null ? "warning" : settleAgeH > 30 ? "danger" : "success"}
          unknown={jobsUnknown || !settleOk}
          value={`${ago(settleOk, now)} ago`}
          foot={`main run nightly · 15-min sweep ${sweep ? `${ago(sweep.started_at, now)} ago (${sweep.status})` : "not seen"}`}
          href="#settlement"
          hrefLabel="Settlement"
        />
        <StatCard
          label="Signups · 7 days"
          icon={UserPlus}
          tone="info"
          unknown={!!d.signups7d.error}
          value={fmtInt(d.signups7d.v)}
          foot="new accounts on the public site"
        />
      </div>

      {d.jobs.error && (
        <Panel className="border-warning/40 px-4 py-3">
          <p className="text-sm text-warning">Job history unreadable ({d.jobs.error}) — this page is not an all-clear.</p>
        </Panel>
      )}

      {/* ── Chart + what each group does ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FailuresChart days={d.failDays.v} error={d.failDays.error} truncated={d.failTruncated} />
        </div>
        <Panel>
          <PanelHeader title="What the jobs do" description="Every job belongs to one group. A red count is a group with a job failing now." />
          <ul className="mt-2 divide-y divide-border/60 border-t border-border/60">
            {groups.map((g) => {
              const rows = byGroup.get(g.label) ?? [];
              const bad = rows.filter((r) => r.state === "failing" || r.state === "stuck").length;
              return (
                <li key={g.key} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{g.label}</span>
                    <StatusBadge tone={bad ? "danger" : "success"} dot={false}>
                      {bad ? `${bad} of ${rows.length} failing` : `${rows.length} OK`}
                    </StatusBadge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{g.what}</p>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {/* ── Every job ── */}
      <Panel id="runs">
        <PanelHeader
          title="Every scheduled job"
          description="The latest run of each job in the last 35 days, failing first. “Failing since” counts from the first failure after the last success. The 48 half-hourly shadow scans are one row."
          actions={
            jobsUnknown ? (
              <StatusBadge tone="warning">Unreadable</StatusBadge>
            ) : (
              <StatusBadge tone={failing.length ? "danger" : "success"}>{failing.length ? `${failing.length} failing` : "All passing"}</StatusBadge>
            )
          }
        />
        <div className="p-4 pt-3">
          <JobsTable rows={views} now={now} />
        </div>
      </Panel>

      {/* ── Settlement + enrichment ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel id="settlement">
          <PanelHeader
            title="Settlement"
            description="After a match ends, settlement marks each bet won or lost, updates team ratings and builds the rows the models learn from. A 15-minute sweep settles as games finish; the main run at night catches the rest."
            actions={
              d.stale.error ? (
                <StatusBadge tone="warning">Unreadable</StatusBadge>
              ) : (
                <StatusBadge tone={staleN === 0 ? "success" : staleAlarm ? "danger" : "warning"}>{staleN ? `${staleN} overdue` : "Nothing overdue"}</StatusBadge>
              )
            }
          />
          <div className="space-y-4 p-4 pt-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Meter label="Matches finished today" value={s?.matches_finished_today} note="Marked finished by the live tracker as they end." />
              <Meter label="Model rows built today" value={s?.feature_vectors_today} note="The per-match rows the models learn from, built by settlement." />
              <Meter label="Team rating (ELO) updates" value={s?.elo_updates_today} note="0 until the nightly run has processed today's games." />
              <Meter
                label="Duplicate bets"
                value={s?.duplicate_bets}
                tone={s?.duplicate_bets ? "danger" : "neutral"}
                note="Same bot, match, market and pick placed twice — should always be 0."
              />
            </div>
            <p className="text-xs text-muted-foreground">{snapNote}</p>
            <div>
              <p className="mb-2 text-sm">
                Bets still pending {STALE_AFTER_MIN / 60} h+ after kick-off
                <span className="text-muted-foreground">
                  {" "}
                  —{" "}
                  {staleAlarm
                    ? "the 21:00 UTC run has passed and should have caught these."
                    : "the 15-minute sweep usually catches these; the 21:00 UTC run is the catch-all, so before 22:00 this can be normal."}
                </span>
              </p>
              {d.stale.error ? (
                <p className="text-sm text-warning">Unreadable ({d.stale.error}) — not an all-clear.</p>
              ) : staleN === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <StaleBetsTable rows={d.stale.v} now={now} />
              )}
            </div>
          </div>
        </Panel>

        <Panel id="enrichment">
          <PanelHeader
            title="Match data for today's games"
            description="What the morning load and the day's refreshes attached to today's matches — the inputs the models read. Some sources only cover big leagues, so not every row should reach 100%."
            actions={s ? <StatusBadge tone="neutral" dot={false}>{fmtInt(s.matches_today)} matches</StatusBadge> : <StatusBadge tone="warning">No snapshot</StatusBadge>}
          />
          <div className="grid gap-3 p-4 pt-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Meter label="API-Football prediction" value={s?.matches_with_predictions} total={s?.matches_today} tone={shareTone(s?.matches_with_predictions, s?.matches_today)} note="Their win/draw/loss chances — one model input." />
            <Meter label="Team ratings (ELO)" value={s?.signals_with_elo} total={s?.matches_today} tone={shareTone(s?.signals_with_elo, s?.matches_today)} />
            <Meter label="Recent form" value={s?.signals_with_form} total={s?.matches_today} tone={shareTone(s?.signals_with_form, s?.matches_today)} note="Points per game over the last 5." />
            <Meter label="League table" value={s?.signals_with_standings} total={s?.matches_today} tone={shareTone(s?.signals_with_standings, s?.matches_today, 0.4, 0.2)} note="Cups and friendlies have none." />
            <Meter label="Head-to-head history" value={s?.matches_with_h2h} total={s?.matches_today} tone={shareTone(s?.matches_with_h2h, s?.matches_today, 0.5, 0.25)} note="Refreshed weekly; new pairings have none." />
            <Meter label="Injury reports" value={s?.matches_with_injuries} total={s?.matches_today} tone="neutral" note="API-Football covers injuries for a few top leagues only — a low count is normal." />
            <Meter label="Confirmed line-ups" value={s?.matches_with_lineups} total={s?.matches_today} tone="neutral" note="Published about an hour before kick-off." />
            <Meter
              label="Postponed today"
              value={s?.matches_postponed_today}
              tone={s?.matches_postponed_today ? "warning" : "neutral"}
              note="Will not settle — any pending bets on these need voiding."
            />
          </div>
          <p className="px-4 pb-4 text-xs text-muted-foreground">{snapNote}</p>
        </Panel>
      </div>
    </div>
  );
}
