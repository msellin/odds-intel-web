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
import { buildJobViews, isRecentFailure, JOB_GROUPS, jobsAnswer, lastRunText, OTHER_GROUP, STATE_WORDS_HELP, type JobView } from "@/lib/admin-jobs-model";
import { timeAgo } from "@/lib/rel-time";
import { InfoTip } from "@/components/oi/info-tip";
import { PageHeader, Panel, PanelHeader } from "@/components/oi/panel";
import { AnswerStrip, type Answer } from "@/components/oi/answer-strip";
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
  // with each job's usual gap (d.cadence) so a job well past it reads Late, not OK (round 6)
  const views = buildJobViews(d.jobs.v, now, d.cadence.error ? null : d.cadence.v);
  const jobsUnknown = !!d.jobs.error;
  // Retired-looking jobs (last run fine, nothing for 8+ days) sit under a collapsed "Old jobs", not in the counts.
  const current = views.filter((v) => v.state !== "quiet");
  const old = views.filter((v) => v.state === "quiet");
  const failing = current.filter((v) => v.state === "failing");
  // Late (well past its usual gap) and Stuck (running far longer than usual) are one answer: "Late or stuck"
  const stuck = current.filter((v) => v.state === "stuck" || v.state === "late");
  const postponedN = d.postponedPending.v;
  // ONE rule for the headline, the group badges and the list badge (answer-first fix round 2026-09-25):
  // any failing job makes the answer amber and names it; red when its last run was in the last 7 days.
  const ja = jobsAnswer(current, now);
  const failTone = (vs: JobView[]) => (vs.some((v) => isRecentFailure(v, now)) ? "danger" : "warning");
  const settlement = d.jobs.v.find((j) => j.job_name === "settlement");
  const settleOk = settlement?.last_ok_at ?? null;
  const staleN = d.stale.v.length;
  // settlement runs 21:00 / 23:30 / 01:00 UTC: no success in 30 h means at least one full night missed
  const settleLate = settleOk != null && now - new Date(settleOk).getTime() > 30 * 3_600_000;
  // Before 22:00 UTC a stale bet is expected (the 21:00 run is the catch-all); after it, it is an alarm.
  const staleAlarm = staleN > 0 && new Date(now).getUTCHours() >= 22;
  const s = d.snapshot.v;
  const snapAge = s ? Math.round((now - new Date(s.created_at).getTime()) / 60000) : null;
  const snapNote = d.snapshot.error
    ? `Unreadable: ${d.snapshot.error}`
    : !s
      ? "No summary for today yet — the engine writes one every hour."
      : `Figures from ${snapAge} min ago (updated hourly).`;

  const answers: Answer[] = [
    jobsUnknown
      ? { label: "Jobs", text: "Can't tell — job history unreadable", tone: "warning", icon: AlertOctagon }
      : ja.tone === "success" && d.cadence.error
        ? { label: "Jobs", text: "No job failing — lateness can't be checked", sub: "run history unreadable", tone: "warning", icon: AlertOctagon, href: "#runs" }
      : {
          label: "Jobs",
          text: ja.text,
          sub: ja.sub,
          tone: ja.tone,
          alarm: ja.tone === "danger",
          icon: ja.tone === "success" ? CheckCircle2 : AlertOctagon,
          href: "#runs",
        },
    jobsUnknown
      ? { label: "Late or stuck", text: "Can't tell — job history unreadable", tone: "warning", icon: Hourglass }
      : stuck.length
      ? {
          label: "Late or stuck",
          text: `${stuck.length} job${stuck.length === 1 ? "" : "s"} ${stuck.every((x) => x.state === "late") ? "late" : stuck.every((x) => x.state === "stuck") ? "stuck" : "late or stuck"} — ${stuck[0].label}`,
          sub: `${lastRunText(stuck[0], (iso) => timeAgo(iso, now))}${stuck.length > 1 ? ` · also ${stuck.slice(1).map((x) => x.label).join(", ")}` : ""}`,
          tone: "warning",
          icon: Hourglass,
          href: "#runs",
        }
      : d.cadence.error
        // without the usual gaps only "running over 3 h" can be judged — never a green all-clear
        ? { label: "Late or stuck", text: "Can't tell if any job is late", sub: "run history unreadable — only jobs running over 3 h are checked", tone: "warning", icon: Hourglass }
        : { label: "Late or stuck", text: "Nothing late", sub: "every job ran within its usual gap", tone: "success", icon: Hourglass },
    {
      label: "Settlement",
      // review 2026-09-25: an unreadable pending-bet read left staleN at 0 and read "Up to date"; and a
      // nightly run that stopped succeeding days ago stayed green — both must not look calm.
      text: jobsUnknown || d.stale.error
        ? "Can't tell — settlement data unreadable"
        : !settleOk ? "No successful run found" : settleLate ? `Last full run ${ago(settleOk, now)} ago — overdue` : staleN ? `${staleN} bet${staleN === 1 ? "" : "s"} overdue`
        : postponedN ? `${postponedN} pick${postponedN === 1 ? "" : "s"} on postponed matches never closed` : "Up to date",
      sub: settleOk ? `last full run ${ago(settleOk, now)} ago · ${fmtInt(d.pendingTotal)} bets waiting for results` : undefined,
      tone: jobsUnknown || d.stale.error ? "warning" : !settleOk ? "warning" : settleLate ? "danger" : staleN ? (staleAlarm ? "danger" : "warning") : postponedN ? "warning" : "success",
      icon: Scale,
      href: "#settlement",
    },
    { label: "New signups", text: d.signups7d.error ? "Unknown" : `${fmtInt(d.signups7d.v)} this week`, tone: "info", icon: UserPlus },
  ];

  const byGroup = new Map<string, JobView[]>();
  for (const v of current) byGroup.set(v.group, [...(byGroup.get(v.group) ?? []), v]);
  const groups = [...JOB_GROUPS, OTHER_GROUP].filter((g) => byGroup.has(g.label));

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        eyebrow="Data & ops"
        title="Jobs"
        meta="Are the engine's scheduled jobs running?"
        actions={<AutoRefreshBadge intervalMs={60_000} checkedAt={now} dataAt={views.reduce<string | null>((a, v) => (!a || v.lastRun > a ? v.lastRun : a), null)} />}
      />

      {/* ── The answers first (answer-first pass 2026-09-25) ── */}
      <AnswerStrip answers={answers} />

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
          <PanelHeader title="Job groups" description="Every job belongs to one group. A group's badge turns red when one of its jobs failed in the last 7 days, amber for an older failure. Open “What the jobs do” for a line on each group." />
          <ul className="mt-2 divide-y divide-border/60 border-t border-border/60">
            {groups.map((g) => {
              const rows = byGroup.get(g.label) ?? [];
              const bad = rows.filter((r) => r.state === "failing");
              const hung = rows.filter((r) => r.state === "stuck" || r.state === "late");
              return (
                <li key={g.key} className="flex items-center justify-between gap-2 px-4 py-2">
                  <span className="text-sm">{g.label}</span>
                  <StatusBadge tone={bad.length ? failTone(bad) : hung.length ? "warning" : "success"} dot={false}>
                    {bad.length ? `${bad.length} of ${rows.length} failing` : hung.length ? `${hung.length} late` : `${rows.length} OK`}
                  </StatusBadge>
                </li>
              );
            })}
          </ul>
          <details className="group border-t border-border/60 px-4 py-2.5">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">What the jobs do</summary>
            <ul className="mt-2 space-y-1.5">
              {groups.map((g) => (
                <li key={g.key} className="text-xs text-muted-foreground">
                  <span className="text-foreground">{g.label}:</span> {g.what}
                </li>
              ))}
            </ul>
          </details>
        </Panel>
      </div>

      {/* ── Every job ── */}
      <Panel id="runs">
        <PanelHeader
          title="Every scheduled job"
          description={<>The latest run of each job in the last 35 days, failing first. The 48 half-hourly pick scans are one row. {STATE_WORDS_HELP}</>}
          actions={
            jobsUnknown ? (
              <StatusBadge tone="warning">Unreadable</StatusBadge>
            ) : (
              <StatusBadge tone={failing.length ? failTone(failing) : stuck.length ? "warning" : "success"}>
                {failing.length ? `${failing.length} failing` : stuck.length ? `${stuck.length} late or stuck` : "All OK"}
              </StatusBadge>
            )
          }
        />
        <div className="p-4 pt-3">
          <JobsTable rows={current} old={old} now={now} feeds={d.feeds.v} preview={isBotBoardDevPreview()} />
        </div>
      </Panel>

      {/* ── Settlement + enrichment ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel id="settlement">
          <PanelHeader
            title="Settlement"
            description="After a match ends, settlement marks each bet won or lost, updates team ratings and stores the results the models learn from. A check every 15 minutes settles games as they finish; the main run at night catches the rest."
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
              <Meter label="Match results stored for the models" value={s?.feature_vectors_today} note="Today — what the models learn from, stored by settlement." />
              <Meter label="Team rating updates" value={s?.elo_updates_today} note="0 until the nightly run has processed today's games" />
              <Meter
                label="Duplicate bets"
                value={s?.duplicate_bets}
                tone={s?.duplicate_bets ? "danger" : "neutral"}
                note="Same bot, match, market and pick placed twice — should always be 0."
              />
            </div>
            <p className="text-xs text-muted-foreground">{snapNote}</p>
            <div>
              {/* round 6: one line; the why is in the ⓘ */}
              <p className="mb-2 flex items-center gap-1 text-sm">
                Bets still waiting for a result {STALE_AFTER_MIN / 60} h+ after kick-off
                <InfoTip>
                  {staleAlarm
                    ? "The 21:00 UTC settlement run has passed and should have caught these — they need a look."
                    : "The 15-minute settlement check usually catches these; the 21:00 UTC run catches the rest, so before 22:00 UTC a few here can be normal."}
                </InfoTip>
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
            actions={s ? <StatusBadge tone="neutral" dot={false}>{fmtInt(s.matches_today)} matches</StatusBadge> : <StatusBadge tone="warning">No summary yet</StatusBadge>}
          />
          <div className="grid gap-3 p-4 pt-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Meter label="API-Football prediction" value={s?.matches_with_predictions} total={s?.matches_today} tone={shareTone(s?.matches_with_predictions, s?.matches_today)} note="Their win/draw/loss chances — one model input." />
            <Meter label="Team ratings" value={s?.signals_with_elo} total={s?.matches_today} tone={shareTone(s?.signals_with_elo, s?.matches_today)} />
            <Meter label="Recent form" value={s?.signals_with_form} total={s?.matches_today} tone={shareTone(s?.signals_with_form, s?.matches_today)} note="Points per game over the last 5." />
            <Meter label="League table" value={s?.signals_with_standings} total={s?.matches_today} tone={shareTone(s?.signals_with_standings, s?.matches_today, 0.4, 0.2)} note="Cups and friendlies have none." />
            <Meter label="Head-to-head history" value={s?.matches_with_h2h} total={s?.matches_today} tone={shareTone(s?.matches_with_h2h, s?.matches_today, 0.5, 0.25)} note="Refreshed weekly; new pairings have none." />
            <Meter label="Injury reports" value={s?.matches_with_injuries} total={s?.matches_today} tone="neutral" note="API-Football covers injuries for a few top leagues only — a low count is normal." />
            <Meter label="Confirmed line-ups" value={s?.matches_with_lineups} total={s?.matches_today} tone="neutral" note="Published about an hour before kick-off." />
            {/* round 6: settlement voids bets on postponed matches by itself (settlement.py SETTLE-VOID-POSTPONED);
                only a bet it missed is an action, and then it says so */}
            <Meter
              label="Postponed today"
              value={s?.matches_postponed_today}
              tone={postponedN ? "warning" : "neutral"}
              note={
                d.postponedPending.error ? (
                  <span className="text-warning">Can&apos;t tell whether bets on them were voided (bets unreadable)</span>
                ) : postponedN ? (
                  <span className="text-warning">
                    {postponedN} paper pick{postponedN === 1 ? "" : "s"} on postponed matches never closed — settlement doesn&apos;t void these yet
                  </span>
                ) : (
                  "None left open"
                )
              }
            />
          </div>
          <p className="px-4 pb-4 text-xs text-muted-foreground">{snapNote}</p>
        </Panel>
      </div>
    </div>
  );
}
