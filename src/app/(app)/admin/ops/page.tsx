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

  // Pull context from recent pipeline runs
  const lastFixturesFetch = runs.find(r => r.job_name === "fetch_fixtures");
  const lastOddsFetch = runs.find(r => r.job_name === "fetch_odds");
  const totalBots = (snapshot?.active_bots ?? 0) + (snapshot?.silent_bots ?? 0);

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
      <Section
        title="Fixtures & Coverage"
        icon="📋"
        subtitle={
          lastFixturesFetch
            ? `Last fixtures fetch pulled ${lastFixturesFetch.records_count ?? "?"} upcoming matches from API-Football (all monitored leagues, next ~14 days). Of those, ${snapshot?.matches_today ?? "?"} are scheduled for today.`
            : `Fixtures pipeline fetches all upcoming matches across monitored leagues. Matches without odds are still tracked for signals and modelling.`
        }
      >
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold">{snapshot?.matches_today ?? "—"}</span>
          <span className="text-sm text-muted-foreground">matches scheduled today</span>
        </div>
        <Grid>
          <Stat
            label="Have odds"
            value={snapshot?.matches_with_odds}
            total={snapshot?.matches_today}
            note="At least one bookmaker is pricing this match"
          />
          <Stat
            label="Have Pinnacle odds"
            value={snapshot?.matches_with_pinnacle}
            total={snapshot?.matches_today}
            note="Pinnacle = sharpest line, used for edge calculation. Missing means no value bet possible."
          />
          <Stat
            label="Have AF predictions"
            value={snapshot?.matches_with_predictions}
            total={snapshot?.matches_today}
            note="API-Football's own win/draw/loss probability — one of our model inputs"
          />
          <Stat
            label="Have signals"
            value={snapshot?.matches_with_signals}
            total={snapshot?.matches_today}
            note="Our enrichment signals: ELO, form, standings, H2H, injuries — used for modelling regardless of odds"
          />
          <Stat
            label="Have ML vectors"
            value={snapshot?.matches_with_fvectors}
            total={snapshot?.matches_today}
            note="Wide ML training rows (57 features per match). Built at settlement for finished matches only — 0 here is normal for today's upcoming games."
          />
          <Stat label="Postponed" value={snapshot?.matches_postponed_today} warn={v => v > 0} note="These won't settle — check if we need to void any bets" />
          <Stat
            label="Missing Pinnacle"
            value={snapshot?.matches_without_pinnacle}
            warn={v => v > 5}
            note="Have some odds but not Pinnacle — lower confidence for value bets"
          />
        </Grid>
      </Section>

      {/* ② Odds Pipeline */}
      <Section
        title="Odds Pipeline"
        icon="📊"
        subtitle={`Polls all tracked matches every 30min from 7am–10pm UTC, capturing all ${lastOddsFetch?.records_count ? `~${lastOddsFetch.records_count} rows per run (` : "("}each match × each bookmaker). Total rows grows throughout the day.`}
      >
        <Grid>
          <Stat
            label="Odds rows today"
            value={snapshot?.odds_snapshots_today}
            note={`${snapshot?.matches_with_odds ?? "?"} matches × ${snapshot?.distinct_bookmakers ?? "?"} bookmakers × ~${snapshot?.odds_snapshots_today && snapshot?.matches_with_odds && snapshot?.distinct_bookmakers ? Math.round(snapshot.odds_snapshots_today / (snapshot.matches_with_odds * snapshot.distinct_bookmakers)) : "?"} polls so far`}
          />
          <Stat
            label="Bookmakers active"
            value={snapshot?.distinct_bookmakers}
            warn={v => v < 3}
            note="We track up to 13 bookmakers via API-Football. <3 means data is incomplete."
          />
        </Grid>
      </Section>

      {/* ③ Betting & Bots */}
      <Section
        title="Betting & Bots"
        icon="🤖"
        subtitle={`${totalBots} bots total (paper trading since Apr 27). Each bot runs its own strategy. "Betting today" = placed ≥1 bet. "Idle" = ran but found no qualifying bets by its own rules.`}
      >
        <Grid>
          <Stat label="Bets placed today" value={snapshot?.bets_placed_today} note="Across all bots, all strategies" />
          <Stat
            label="Pending (all time)"
            value={snapshot?.bets_pending}
            warn={v => v > 30}
            note="All bets not yet settled — includes today's and older. >30 may mean settlement is lagging."
          />
          <Stat label="Settled today" value={snapshot?.bets_settled_today} note="Won or lost, match finished today" />
          <Stat label="P&L today" value={snapshot?.pnl_today} prefix="$" decimals={2} warn={v => v < -50} good={v => v > 0} note="Settled bets only — pending don't count until resolved" />
          <Stat label="In-play bets today" value={snapshot?.bets_inplay_today} note="Bets placed after kick-off (live betting strategy)" />
          <Stat
            label="Bots betting today"
            value={snapshot?.active_bots}
            total={totalBots}
            warn={v => v < 10}
            note={`Out of ${totalBots} total bots. Low count = most bots found no value today (can be normal on quiet days).`}
          />
          <Stat label="Idle today" value={snapshot?.silent_bots} note="Ran, no qualifying bets found" />
          <Stat label="Duplicate bets" value={snapshot?.duplicate_bets} warn={v => v > 0} note="Same bot × match × market × selection placed twice — should be 0" />
        </Grid>
        {staleBets.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm font-medium text-red-400 mb-2">
              ⚠ {staleBets.length} pending bet{staleBets.length > 1 ? "s" : ""} on matches that kicked off &gt;2h ago — settlement may have missed these
            </p>
            <div className="space-y-1">
              {staleBets.slice(0, 5).map(b => (
                <p key={b.id} className="text-xs text-muted-foreground font-mono">
                  {b.market} — bet {new Date(b.pick_time).toLocaleTimeString()}
                  {b.match_kickoff && ` · match KO ${new Date(b.match_kickoff).toLocaleTimeString()}`}
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
      <Section
        title="Live Tracker"
        icon="⚡"
        subtitle="Polls live games every 30s (score), 60s (events), 5min (odds). Each poll = one snapshot row. High row count is expected — ~300 rows/game/hour."
      >
        <Grid>
          <Stat
            label="Live snapshot rows today"
            value={snapshot?.live_snapshots_today}
            note="Total rows across all live games today — not unique games"
          />
          <Stat
            label="Rows with xG data"
            value={snapshot?.snapshots_with_xg}
            total={snapshot?.live_snapshots_today}
            pctDecimals={1}
            note="xG only populated for leagues that provide it via API-Football. Low % is normal."
          />
          <Stat
            label="Rows with live odds"
            value={snapshot?.snapshots_with_live_odds}
            total={snapshot?.live_snapshots_today}
            note="~5% expected: odds are polled less frequently than score/events"
          />
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">Last snapshot</p>
            <p className={`text-lg font-bold tabular-nums ${liveAge !== null && liveAge > 60 ? "text-amber-500" : "text-foreground"}`}>
              {liveAge !== null ? `${liveAge}m ago` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{">"} 60m outside live window (10am–11pm UTC) is normal</p>
          </div>
        </Grid>
      </Section>

      {/* ⑤ Post-Match */}
      <Section
        title="Post-Match / Settlement"
        icon="✅"
        subtitle="Runs at 9pm UTC. Settles bets, updates ELO ratings, and builds ML feature vectors for each finished match."
      >
        <Grid>
          <Stat label="Finished today" value={snapshot?.matches_finished_today} note="Matches with status = finished in our DB" />
          <Stat
            label="ML vectors built"
            value={snapshot?.feature_vectors_today}
            total={snapshot?.matches_finished_today}
            note="One wide row per finished match (57 features: ELO, form, odds drift, signals…). Used to train and evaluate the model. Only exists after a match finishes."
          />
          <Stat
            label="ELO updates today"
            value={snapshot?.elo_updates_today}
            note="Team ELO recalculated for all teams that played today. Large number = many leagues ran."
          />
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">Post-mortem ran</p>
            <p className={`text-lg font-bold ${snapshot?.post_mortem_ran_today ? "text-emerald-500" : "text-muted-foreground"}`}>
              {snapshot?.post_mortem_ran_today === true ? "Yes" : snapshot?.post_mortem_ran_today === false ? "No" : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Gemini analysis of today&apos;s settled bets</p>
          </div>
        </Grid>
      </Section>

      {/* ⑥ Enrichment Quality */}
      <Section
        title="Enrichment Quality"
        icon="📈"
        subtitle="Extra data fetched per match before betting runs. H2H and injuries improve model confidence; lineups confirm team selection."
      >
        <Grid>
          <Stat
            label="Have H2H data"
            value={snapshot?.matches_with_h2h}
            total={snapshot?.matches_today}
            note="Head-to-head history between the two teams"
          />
          <Stat
            label="Have injury reports"
            value={snapshot?.matches_with_injuries}
            total={snapshot?.matches_today}
            note="At least one team has an injury record fetched today"
          />
          <Stat
            label="Have confirmed lineups"
            value={snapshot?.matches_with_lineups}
            total={snapshot?.matches_today}
            note="Only available ~1h before kick-off — 0% in the morning is normal"
          />
        </Grid>
      </Section>

      {/* ⑦ Email & Alerts */}
      <Section title="Email & Alerts" icon="✉️" subtitle="Sent to users today.">
        <Grid>
          <Stat label="Digests sent" value={snapshot?.digests_sent_today} note="Daily email digest" />
          <Stat label="Value bet alerts" value={snapshot?.value_bet_alerts_today} note="Push/email when a high-edge bet is found" />
          <Stat label="Previews generated" value={snapshot?.previews_generated_today} note="AI match previews (top 10 matches)" />
          <Stat label="Watchlist alerts" value={snapshot?.watchlist_alerts_today} />
          <Stat label="News checker errors" value={snapshot?.news_checker_errors_today} warn={v => v > 0} />
        </Grid>
      </Section>

      {/* ⑧ AF API Budget */}
      <Section
        title="AF API Budget"
        icon="💳"
        subtitle="API-Football Ultra plan: 75,000 calls/day. Resets at midnight UTC."
      >
        <Grid>
          <Stat label="Calls today" value={snapshot?.af_calls_today} note="Across all pipeline jobs" />
          <Stat
            label="Remaining today"
            value={snapshot?.af_budget_remaining}
            warn={v => v < 5000}
            good={v => v > 50000}
            note="<5,000 = amber. Budget resets at midnight UTC."
          />
          {(() => {
            const calls = snapshot?.af_calls_today;
            if (calls == null) return null;
            const pct = (calls / 75000) * 100;
            return (
              <div className="rounded-lg border border-border bg-card p-3 col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Usage (75k/day limit)</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })()}
        </Grid>
      </Section>

      {/* ⑨ Users */}
      <Section title="Users" icon="👤" subtitle="All-time totals except new signups.">
        <Grid>
          <Stat label="Total users (all time)" value={snapshot?.total_users} />
          <Stat label="Pro tier (all time)" value={snapshot?.pro_users} />
          <Stat label="Elite tier (all time)" value={snapshot?.elite_users} />
          <Stat label="New signups today" value={snapshot?.new_signups_today} good={v => v > 0} />
        </Grid>
      </Section>

      {/* ⑩ Pipeline Runs */}
      <Section title="Pipeline Runs" icon="🔁" subtitle="Last 20 runs. Records = rows inserted/updated. Stale 'running' rows mean the job crashed without marking itself done.">
        <PipelineGrid runs={runs} />
      </Section>

      {/* ⑪ Backfill */}
      <Section
        title="Backfill"
        icon="🗄️"
        subtitle="Fetches historical match stats from API-Football for past seasons. Runs every 2h in a background slot. Used to build ML training data."
      >
        <Grid>
          <Stat label="Total matches with stats (all time)" value={snapshot?.backfill_total_done} note="Cumulative — grows with each backfill run" />
          <div className="rounded-lg border border-border bg-card p-3 col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Last backfill run started</p>
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

function Section({
  title,
  icon,
  subtitle,
  children,
}: {
  title: string;
  icon: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {icon} {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">{subtitle}</p>
        )}
      </div>
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
  pctDecimals = 0,
  note,
  warn,
  good,
}: {
  label: string;
  value: number | null | undefined;
  total?: number | null;
  prefix?: string;
  decimals?: number;
  pctDecimals?: number;
  note?: string;
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

  const pctVal = hasValue && total && total > 0 ? (value! / total) * 100 : null;
  const pct = pctVal !== null
    ? ` (${pctDecimals > 0 ? pctVal.toFixed(pctDecimals) : Math.round(pctVal)}%)`
    : "";

  return (
    <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${colorClass}`}>
        {display}
        {pct && <span className="text-xs font-normal text-muted-foreground ml-1">{pct}</span>}
      </p>
      {note && <p className="text-[10px] text-muted-foreground/60 leading-tight">{note}</p>}
    </div>
  );
}

function PipelineGrid({ runs }: { runs: PipelineRun[] }) {
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No pipeline runs recorded yet.</p>;
  }

  return (
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
            const isStaleRunning = isRunning && (Date.now() - started.getTime()) > 30 * 60 * 1000;
            return (
              <tr key={run.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="py-2 pr-4 font-mono text-foreground">{run.job_name}</td>
                <td className="py-2 pr-4">
                  <span className={`inline-flex items-center gap-1 ${
                    isError ? "text-red-500" : isStaleRunning ? "text-amber-500" : isRunning ? "text-blue-400" : "text-emerald-500"
                  }`}>
                    {isError ? "✗" : isRunning ? "…" : "✓"} {run.status}
                    {isStaleRunning && <span className="text-[10px]">(stuck?)</span>}
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
  );
}
