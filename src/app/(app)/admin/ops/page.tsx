export const dynamic = 'force-dynamic';

import React from "react";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  getOpsSnapshot,
  getRecentPipelineRuns,
  getStalePendingBets,
  getLastLiveSnapshotAge,
} from "@/lib/engine-data";
import type { OpsSnapshot, PipelineRun } from "@/lib/engine-data";

export default async function OpsDashboardPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">Access denied.</div>;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_superadmin) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">Superadmin only.</div>;
  }

  const [snapshot, runs, staleBets, lastLiveAt] = await Promise.all([
    getOpsSnapshot(),
    getRecentPipelineRuns(),
    getStalePendingBets(),
    getLastLiveSnapshotAge(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const snapshotAge = snapshot
    ? Math.round((Date.now() - new Date(snapshot.created_at).getTime()) / 60000)
    : null;
  const liveAge = lastLiveAt
    ? Math.round((Date.now() - new Date(lastLiveAt).getTime()) / 60000)
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ops Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{today}</p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          {snapshotAge !== null ? (
            <span className={snapshotAge > 90 ? "text-amber-500" : "text-emerald-500"}>
              snapshot {snapshotAge}m ago
            </span>
          ) : (
            <span className="text-red-500">no snapshot today</span>
          )}
        </div>
      </div>

      {!snapshot && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          No ops snapshot for today yet — pipeline hasn&apos;t run or migration is pending.
        </div>
      )}

      {/* ① Fixtures & Coverage */}
      <Section title="Fixtures & Coverage" icon="📋">
        <Grid>
          <Stat label="Matches today" value={snapshot?.matches_today} />
          <Stat label="With odds" value={snapshot?.matches_with_odds} total={snapshot?.matches_today} />
          <Stat label="With Pinnacle" value={snapshot?.matches_with_pinnacle} total={snapshot?.matches_today} />
          <Stat label="With predictions" value={snapshot?.matches_with_predictions} total={snapshot?.matches_today} />
          <Stat label="With signals" value={snapshot?.matches_with_signals} total={snapshot?.matches_today} />
          <Stat label="With feature vectors" value={snapshot?.matches_with_fvectors} total={snapshot?.matches_today} />
          <Stat label="Postponed" value={snapshot?.matches_postponed_today} warn={v => v > 0} />
          <Stat label="Without Pinnacle" value={snapshot?.matches_without_pinnacle} warn={v => v > 5} />
        </Grid>
      </Section>

      {/* ② Odds Pipeline */}
      <Section title="Odds Pipeline" icon="📊">
        <Grid>
          <Stat label="Odds snapshots today" value={snapshot?.odds_snapshots_today} />
          <Stat label="Distinct bookmakers" value={snapshot?.distinct_bookmakers} warn={v => v < 3} />
        </Grid>
      </Section>

      {/* ③ Betting & Bots */}
      <Section title="Betting & Bots" icon="🤖">
        <Grid>
          <Stat label="Bets placed today" value={snapshot?.bets_placed_today} />
          <Stat label="Pending bets" value={snapshot?.bets_pending} warn={v => v > 30} />
          <Stat label="Settled today" value={snapshot?.bets_settled_today} />
          <Stat label="P&L today" value={snapshot?.pnl_today} prefix="$" decimals={2} warn={v => v < -50} good={v => v > 0} />
          <Stat label="Inplay bets today" value={snapshot?.bets_inplay_today} />
          <Stat label="Active bots" value={snapshot?.active_bots} total={17} warn={v => v < 10} />
          <Stat label="Silent bots" value={snapshot?.silent_bots} warn={v => v > 7} />
          <Stat label="Duplicate bets" value={snapshot?.duplicate_bets} warn={v => v > 0} />
        </Grid>
        {staleBets.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-sm font-medium text-amber-400 mb-2">
              ⚠ {staleBets.length} stale pending bet{staleBets.length > 1 ? "s" : ""} (&gt;4h old)
            </p>
            <div className="space-y-1">
              {staleBets.slice(0, 5).map(b => (
                <p key={b.id} className="text-xs text-muted-foreground font-mono">
                  {b.market} — {new Date(b.pick_time).toLocaleTimeString()}
                </p>
              ))}
              {staleBets.length > 5 && (
                <p className="text-xs text-muted-foreground">…and {staleBets.length - 5} more</p>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* ④ Live Tracker */}
      <Section title="Live Tracker" icon="⚡">
        <Grid>
          <Stat label="Live snapshots today" value={snapshot?.live_snapshots_today} />
          <Stat label="With xG data" value={snapshot?.snapshots_with_xg} total={snapshot?.live_snapshots_today} />
          <Stat label="With live odds" value={snapshot?.snapshots_with_live_odds} total={snapshot?.live_snapshots_today} />
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">Last snapshot</p>
            <p className={`text-lg font-bold tabular-nums ${liveAge !== null && liveAge > 60 ? "text-amber-500" : "text-foreground"}`}>
              {liveAge !== null ? `${liveAge}m ago` : "—"}
            </p>
          </div>
        </Grid>
      </Section>

      {/* ⑤ Post-Match */}
      <Section title="Post-Match / Settlement" icon="✅">
        <Grid>
          <Stat label="Finished today" value={snapshot?.matches_finished_today} />
          <Stat label="Feature vectors built" value={snapshot?.feature_vectors_today} />
          <Stat label="ELO updates" value={snapshot?.elo_updates_today} />
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">Post-mortem ran</p>
            <p className={`text-lg font-bold ${snapshot?.post_mortem_ran_today ? "text-emerald-500" : "text-muted-foreground"}`}>
              {snapshot?.post_mortem_ran_today === true ? "Yes" : snapshot?.post_mortem_ran_today === false ? "No" : "—"}
            </p>
          </div>
        </Grid>
      </Section>

      {/* ⑥ Enrichment Quality */}
      <Section title="Enrichment Quality" icon="📈">
        <Grid>
          <Stat label="With H2H" value={snapshot?.matches_with_h2h} total={snapshot?.matches_today} />
          <Stat label="With injuries" value={snapshot?.matches_with_injuries} total={snapshot?.matches_today} />
          <Stat label="With lineups" value={snapshot?.matches_with_lineups} total={snapshot?.matches_today} />
        </Grid>
      </Section>

      {/* ⑦ Email & Alerts */}
      <Section title="Email & Alerts" icon="✉️">
        <Grid>
          <Stat label="Digests sent" value={snapshot?.digests_sent_today} />
          <Stat label="Value bet alerts" value={snapshot?.value_bet_alerts_today} />
          <Stat label="Previews generated" value={snapshot?.previews_generated_today} />
          <Stat label="Watchlist alerts" value={snapshot?.watchlist_alerts_today} />
          <Stat label="News checker errors" value={snapshot?.news_checker_errors_today} warn={v => v > 0} />
        </Grid>
      </Section>

      {/* ⑧ Users */}
      <Section title="Users" icon="👤">
        <Grid>
          <Stat label="Total users" value={snapshot?.total_users} />
          <Stat label="Pro users" value={snapshot?.pro_users} />
          <Stat label="Elite users" value={snapshot?.elite_users} />
          <Stat label="New signups today" value={snapshot?.new_signups_today} good={v => v > 0} />
        </Grid>
      </Section>

      {/* ⑨ Pipeline Run Grid */}
      <Section title="Pipeline Runs" icon="🔁">
        <PipelineGrid runs={runs} />
      </Section>

      {/* ⑩ Backfill */}
      <Section title="Backfill" icon="🗄️">
        <Grid>
          <Stat label="Total matches with stats" value={snapshot?.backfill_total_done} />
          <div className="rounded-lg border border-border bg-card p-3 col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Last backfill run</p>
            <p className="text-sm font-mono text-foreground">
              {snapshot?.backfill_last_run
                ? new Date(snapshot.backfill_last_run).toLocaleString()
                : "—"}
            </p>
          </div>
        </Grid>
      </Section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-5">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  total,
  prefix = "",
  decimals = 0,
  warn,
  good,
}: {
  label: string;
  value: number | null | undefined;
  total?: number | null;
  prefix?: string;
  decimals?: number;
  warn?: (v: number) => boolean;
  good?: (v: number) => boolean;
}) {
  const hasValue = value !== null && value !== undefined;
  const isWarn = hasValue && warn ? warn(value!) : false;
  const isGood = hasValue && good ? good(value!) : false;

  const colorClass = isWarn
    ? "text-amber-500"
    : isGood
    ? "text-emerald-500"
    : "text-foreground";

  const display = hasValue
    ? `${prefix}${value!.toFixed(decimals)}`
    : "—";

  const pct = hasValue && total && total > 0
    ? ` (${Math.round((value! / total) * 100)}%)`
    : "";

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${colorClass}`}>
        {display}
        {pct && <span className="text-xs font-normal text-muted-foreground ml-1">{pct}</span>}
      </p>
    </div>
  );
}

function PipelineGrid({ runs }: { runs: PipelineRun[] }) {
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No pipeline runs recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Recent run log */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-2 pr-4 font-medium">Job</th>
              <th className="text-left py-2 pr-4 font-medium">Status</th>
              <th className="text-left py-2 pr-4 font-medium">Started</th>
              <th className="text-right py-2 pr-4 font-medium">Duration</th>
              <th className="text-right py-2 font-medium">Records</th>
            </tr>
          </thead>
          <tbody>
            {runs.slice(0, 20).map(run => {
              const started = new Date(run.started_at);
              const duration = run.completed_at
                ? Math.round((new Date(run.completed_at).getTime() - started.getTime()) / 1000)
                : null;
              const isError = run.status === "error" || run.status === "failed";
              const isRunning = run.status === "running";
              return (
                <tr key={run.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2 pr-4 font-mono text-foreground">{run.job_name}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-flex items-center gap-1 ${
                      isError ? "text-red-500" : isRunning ? "text-blue-400" : "text-emerald-500"
                    }`}>
                      {isError ? "✗" : isRunning ? "…" : "✓"} {run.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-2 pr-4 text-right text-muted-foreground">
                    {duration !== null ? `${duration}s` : "—"}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    {run.records_count ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
