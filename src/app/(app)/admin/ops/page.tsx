export const dynamic = 'force-dynamic';

import React from "react";
import { AutoRefresh } from "./auto-refresh";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  getOpsSnapshot,
  getRecentPipelineRuns,
  getLatestJobStatuses,
  getStalePendingBets,
  getLastLiveSnapshotAge,
  getBackfillCounts,
} from "@/lib/engine-data";
import type { OpsSnapshot, PipelineRun, BackfillCounts } from "@/lib/engine-data";

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

  const [snapshot, runs, jobStatuses, staleBets, lastLiveAt, backfillCounts] = await Promise.all([
    getOpsSnapshot(),
    getRecentPipelineRuns(),
    getLatestJobStatuses(),
    getStalePendingBets(),
    getLastLiveSnapshotAge(),
    getBackfillCounts(),
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
      <AutoRefresh intervalMs={60_000} />
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
            ? `Latest fetch_fixtures stored ${lastFixturesFetch.records_count ?? "?"} fixtures (today's date only). matches_today below counts every match in DB whose kickoff falls today UTC — equal to fetch count once dedup catches up.`
            : `Fixtures pipeline fetches all upcoming matches across monitored leagues. Matches without odds are still tracked for signals and modelling.`
        }
      >
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold">{snapshot?.matches_today ?? "—"}</span>
          <span className="text-sm text-muted-foreground">matches today</span>
        </div>
        <Grid>
          <Stat label="Have odds" value={snapshot?.matches_with_odds} total={snapshot?.matches_today}
            note="≥1 bookmaker is pricing this — required for value bet calculation" />
          <Stat label="Have Pinnacle" value={snapshot?.matches_with_pinnacle} total={snapshot?.matches_today}
            note="Pinnacle = sharpest line for edge calc. No Pinnacle = no value bet." />
          <Stat label="Have AF predictions" value={snapshot?.matches_with_predictions} total={snapshot?.matches_today}
            note="API-Football's 1X2 probability — one of the model inputs" />
          <Stat label="Have any signals" value={snapshot?.matches_with_signals} total={snapshot?.matches_today}
            note="At least one signal (ELO, form, H2H…) written for this match" />
        </Grid>

        {/* Signal breakdown */}
        <p className="text-xs font-medium text-muted-foreground mt-4 mb-2 uppercase tracking-wider">Signal breakdown (of today&apos;s matches)</p>
        <Grid>
          <Stat label="ELO ratings" value={snapshot?.signals_with_elo} total={snapshot?.matches_today}
            note="Team strength estimate based on past results. Key model input." />
          <Stat label="Form (PPG)" value={snapshot?.signals_with_form} total={snapshot?.matches_today}
            note="Points-per-game over last 5 games for each team" />
          <Stat label="H2H history" value={snapshot?.signals_with_h2h} total={snapshot?.matches_today}
            note="Head-to-head win rate from past meetings" />
          <Stat label="Injury data" value={snapshot?.signals_with_injuries}
            note="AF only covers injuries for a handful of top leagues — low count is normal" />
          <Stat label="Standings" value={snapshot?.signals_with_standings} total={snapshot?.matches_today}
            note="League position, points-to-title, points-to-relegation" />
          <Stat label="Postponed" value={snapshot?.matches_postponed_today} warn={v => v > 0}
            note="Won't settle — void any pending bets on these" />
          <Stat label="Missing Pinnacle" value={snapshot?.matches_without_pinnacle} warn={v => v > 5}
            note="Have odds but not from Pinnacle — lower confidence" />
          <Stat label="ML vectors (finished)" value={snapshot?.matches_with_fvectors} total={snapshot?.matches_today}
            note="Post-settlement only — 0 is normal for today's upcoming games" />
        </Grid>
      </Section>

      {/* ② Odds Pipeline */}
      <Section
        title="Odds Pipeline"
        icon="📊"
        subtitle="Pre-match odds only (not live). Polls all today's matches every 30min from 7am–10pm UTC. Each poll row = one bookmaker × one market × one selection. Multiple markets per match are stored."
      >
        <Grid>
          <Stat label="Total rows today" value={snapshot?.odds_snapshots_today}
            note={`${snapshot?.matches_with_odds ?? "?"} matches × ${snapshot?.distinct_bookmakers ?? "?"} bookmakers × ~${snapshot?.odds_snapshots_today && snapshot?.matches_with_odds && snapshot?.distinct_bookmakers ? Math.round(snapshot.odds_snapshots_today / (snapshot.matches_with_odds * snapshot.distinct_bookmakers)) : "?"} polls × N markets`} />
          <Stat label="Bookmakers active" value={snapshot?.distinct_bookmakers} warn={v => v < 3}
            note="Up to 13 via API-Football. <3 = data gap." />
          <Stat label="Markets: Match Winner (1X2)" value={snapshot?.odds_market_match_winner} total={snapshot?.matches_today}
            note="Home/draw/away — primary betting market" />
          <Stat label="Markets: Goals O/U" value={snapshot?.odds_market_goals_ou} total={snapshot?.matches_today}
            note="Over/Under 2.5 goals — secondary market" />
          <Stat label="Markets: BTTS" value={snapshot?.odds_market_btts} total={snapshot?.matches_today}
            note="Both Teams to Score — tertiary market" />
        </Grid>
      </Section>

      {/* ③ Betting & Bots */}
      <Section
        title="Betting & Bots"
        icon="🤖"
        subtitle={`${totalBots} bots total: 16 pre-match (run at 06:00 UTC on upcoming games) + 8 live/inplay (run every 30s during live matches). Paper trading since Apr 27.`}
      >
        <Grid>
          <Stat label="Pre-match bets today" value={snapshot?.bets_placed_today != null && snapshot?.bets_inplay_today != null ? snapshot.bets_placed_today - snapshot.bets_inplay_today : snapshot?.bets_placed_today}
            note="Placed at 06:00 UTC on upcoming fixtures. Bets cover next few days, not just today." />
          <Stat label="Inplay bets today" value={snapshot?.bets_inplay_today}
            good={v => v > 0}
            note="Placed during live matches by the 8 inplay strategies. 0 = no strategy triggered OR live O/U odds unavailable." />
          <Stat label="Inplay bots active" value={snapshot?.inplay_active_bots} total={8}
            note="How many of the 8 inplay bots placed ≥1 bet today" />
          <Stat
            label="Pending (all time)"
            value={snapshot?.bets_pending}
            warn={v => v > 30}
            note="All bets not yet settled — includes today's and older. >30 may mean settlement is lagging."
          />
          <Stat label="Settled today" value={snapshot?.bets_settled_today} note="Won or lost, match finished today" />
          <Stat label="P&L today" value={snapshot?.pnl_today} prefix="$" decimals={2} warn={v => v < -50} good={v => v > 0} note="Settled bets only — pending don't count until resolved" />
          <Stat
            label="Pre-match bots active"
            value={snapshot?.active_bots != null && snapshot?.inplay_active_bots != null ? snapshot.active_bots - snapshot.inplay_active_bots : snapshot?.active_bots}
            total={16}
            warn={v => v < 8}
            note="How many of the 16 pre-match bots placed ≥1 bet today. Low = most found no value (can be normal)."
          />
          <Stat label="Idle today" value={snapshot?.silent_bots} note="Ran, no qualifying bets found" />
          <Stat label="Duplicate bets" value={snapshot?.duplicate_bets} warn={v => v > 0} note="Same bot × match × market × selection placed twice — should be 0" />
        </Grid>
        {staleBets.length > 0 && (() => {
          const utcHour = new Date().getUTCHours();
          // Before 22:00 UTC: amber — expected, 21:00 settlement is the catch-all
          // After 22:00 UTC: red — main settlement has run and should have caught these
          const isAlarm = utcHour >= 22;
          return (
            <div className={`mt-4 rounded-lg border px-4 py-3 ${isAlarm ? "border-red-500/30 bg-red-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
              <p className={`text-sm font-medium mb-1 ${isAlarm ? "text-red-400" : "text-amber-400"}`}>
                ⚠ {staleBets.length} pending bet{staleBets.length > 1 ? "s" : ""} on matches that kicked off &gt;2h ago
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                {isAlarm
                  ? "Main settlement (21:00 UTC) has already run — these should have been caught. Check Railway logs."
                  : "settle_ready sweeps every 15min; 21:00 UTC settlement is the guaranteed catch-all. Normal before 22:00 UTC."}
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
          );
        })()}
      </Section>

      {/* ④ Live Tracker */}
      <Section
        title="Live Tracker"
        icon="⚡"
        subtitle="Polls live games every 30s (score), 60s (events), 5min (odds). ~300 snapshot rows per game per hour — use game counts below, not raw rows."
      >
        <Grid>
          <Stat
            label="Games tracked today"
            value={snapshot?.live_games_tracked}
            note="Distinct matches with at least one live snapshot today"
          />
          <Stat
            label="Games with xG"
            value={snapshot?.live_games_with_xg}
            total={snapshot?.live_games_tracked}
            note="xG only from top leagues (AF stats endpoint). Others use shot proxy for inplay bot."
          />
          <Stat
            label="Games with live O/U odds"
            value={snapshot?.live_games_with_odds}
            total={snapshot?.live_games_tracked}
            note="live_ou_25_over populated — required for 6 of 8 inplay strategies. Low count = most strategies can't fire."
          />
          <Stat
            label="Snapshot rows today"
            value={snapshot?.live_snapshots_today}
            note={`~${snapshot?.live_games_tracked ? Math.round((snapshot.live_snapshots_today ?? 0) / snapshot.live_games_tracked) : "?"} rows/game avg. High is normal — one row every 30s.`}
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
          <Stat label="Finished today" value={snapshot?.matches_finished_today} note="Live tracker marks matches finished in real-time. Settlement (bet resolution + ML) runs separately at 21:00 UTC." />
          <Stat
            label="ML vectors built"
            value={snapshot?.feature_vectors_today}
            total={snapshot?.matches_finished_today}
            note="Only meaningful after 23:00 UTC — settlement builds these at 21:00. Low count during the day is normal."
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
        subtitle="Pre-match data fetched per match. H2H history is pulled weekly. Injuries are checked 4×/day. Lineups only available ~1h before kick-off."
      >
        <Grid>
          <Stat label="Have H2H data" value={snapshot?.matches_with_h2h} total={snapshot?.matches_today}
            note="Stored in h2h_raw column on matches. Fetched by enrichment job." />
          <Stat label="Have injury reports" value={snapshot?.matches_with_injuries}
            note="Coverage-limited — AF only provides injury data for top leagues, not all 149 matches" />
          <Stat label="Have confirmed lineups" value={snapshot?.matches_with_lineups} total={snapshot?.matches_today}
            note="0% until ~1h before kick-off — completely normal before evening games" />
        </Grid>
      </Section>

      {/* ⑦ Email & Alerts */}
      <Section title="Email & Alerts" icon="✉️"
        subtitle="Value bet alerts run at 4pm and 7pm UTC. Only sent to Pro/Elite users with notifications enabled. 0 alerts = either no qualifying bets found, or no subscribed Pro/Elite users yet."
      >
        <Grid>
          <Stat label="Digests sent today" value={snapshot?.digests_sent_today} note="Morning digest to all subscribed users" />
          <Stat label="Value bet alerts" value={snapshot?.value_bet_alerts_today}
            note="Emails to Pro/Elite with notification opt-in. 0 = no subscribed users yet, or no qualifying bets." />
          <Stat label="Previews generated" value={snapshot?.previews_generated_today} note="AI match previews (top 10 matches)" />
          <Stat label="Watchlist alerts" value={snapshot?.watchlist_alerts_today} />
          <Stat label="News checker errors" value={snapshot?.news_checker_errors_today} warn={v => v > 0} />
        </Grid>
      </Section>

      {/* ⑧ AF API Budget */}
      <Section
        title="AF API Budget"
        icon="💳"
        subtitle="API-Football Mega plan: 150,000 calls/day. Resets at midnight UTC."
      >
        <Grid>
          <Stat label="Calls today" value={snapshot?.af_calls_today} note="Across all pipeline jobs" />
          <Stat
            label="Remaining today"
            value={snapshot?.af_budget_remaining}
            warn={v => v < 10000}
            good={v => v > 100000}
            note="<10,000 = amber. Budget resets at midnight UTC."
          />
          {(() => {
            const calls = snapshot?.af_calls_today;
            if (calls == null) return null;
            const pct = (calls / 150000) * 100;
            return (
              <div className="rounded-lg border border-border bg-card p-3 col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Usage (150k/day limit)</p>
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
      <Section
        title="Pipeline Runs"
        icon="🔁"
        subtitle="Per-job status. Green = ran on schedule and passed. Amber = passed but older than expected. Red = last run failed. Timestamps are UTC."
      >
        <PipelineJobGrid jobs={jobStatuses} recentRuns={runs} />
      </Section>

      {/* ⑪ Backfill */}
      <Section
        title="Backfill"
        icon="🗄️"
        subtitle="Three micro-batch jobs run every 5 min, picking up small chunks of work. Each is idempotent — safe to re-run, resumes where it left off."
      >
        <div className="space-y-4">
          <BackfillBar
            label="Match stats & events"
            note="Historical fixtures/statistics/events for past seasons. Used for ML training data."
            done={backfillCounts.histDone}
            total={backfillCounts.histTotal}
            lastRun={backfillCounts.histLastRun}
            lastStatus={backfillCounts.histLastStatus}
          />
          <BackfillBar
            label="Coach history"
            note="Manager career history per team. Powers manager_change signal."
            done={backfillCounts.coachesDone}
            total={backfillCounts.coachesTotal}
            lastRun={backfillCounts.coachesLastRun}
            lastStatus={backfillCounts.coachesLastStatus}
          />
          <BackfillBar
            label="Transfer history"
            note="Squad arrivals per team. Powers squad_disruption signal."
            done={backfillCounts.transfersDone}
            total={backfillCounts.transfersTotal}
            lastRun={backfillCounts.transfersLastRun}
            lastStatus={backfillCounts.transfersLastStatus}
          />
        </div>
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

function BackfillBar({
  label,
  note,
  done,
  total,
  lastRun,
  lastStatus,
}: {
  label: string;
  note: string;
  done: number | null;
  total: number | null;
  lastRun: string | null;
  lastStatus: string | null;
}) {
  const pct = done != null && total && total > 0 ? (done / total) * 100 : null;
  const isFailed = lastStatus === "failed" || lastStatus === "error";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-xs font-mono text-muted-foreground tabular-nums">
          {done != null ? done.toLocaleString() : "—"}
          {total ? ` / ${total.toLocaleString()}` : ""}
          {pct !== null ? ` (${pct.toFixed(1)}%)` : ""}
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
        {pct !== null && (
          <div
            className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-blue-500"}`}
            style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
          />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground/60 leading-tight">{note}</p>
      {lastRun && (
        <p className={`text-[10px] mt-0.5 ${isFailed ? "text-red-400/80" : "text-muted-foreground/50"}`}>
          Last run: {new Date(lastRun).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          {lastStatus && <span className={`ml-1 ${isFailed ? "text-red-400" : "text-emerald-500/70"}`}>· {lastStatus}</span>}
        </p>
      )}
    </div>
  );
}

// Per-job schedule: max expected gap in hours before flagging as stale (amber)
// These are generous — account for time-of-day windows (e.g. settlement only runs at 9pm)
const JOB_CONFIG: Record<string, { label: string; schedule: string; maxGapHours: number }> = {
  fetch_fixtures:    { label: "Fixtures Fetch",      schedule: "04:00 UTC daily",           maxGapHours: 30 },
  fetch_enrichment:  { label: "Enrichment",           schedule: "04:15 / 12:00 / 16:00 UTC", maxGapHours: 8  },
  fetch_odds:        { label: "Odds Fetch",           schedule: "Every 30min, 07–22 UTC",    maxGapHours: 4  },
  fetch_predictions: { label: "AF Predictions",       schedule: "05:30 UTC daily",           maxGapHours: 30 },
  betting_pipeline:  { label: "Betting Pipeline",     schedule: "06:00 UTC daily",           maxGapHours: 30 },
  betting_refresh:   { label: "Betting Refresh",      schedule: "11:00 / 15:00 / 19:00 UTC", maxGapHours: 10 },
  settlement:        { label: "Settlement",           schedule: "21:00 UTC daily",           maxGapHours: 30 },
  live_poller:       { label: "Live Poller",          schedule: "Continuous 10–23 UTC",      maxGapHours: 4  },
  live_tracker:      { label: "Live Tracker",         schedule: "Continuous 10–23 UTC",      maxGapHours: 4  },
  news_checker:      { label: "News Checker",         schedule: "09:00 / 12:30 / 16:30 / 19:30 UTC", maxGapHours: 10 },
  write_ops_snapshot:{ label: "Ops Snapshot",         schedule: "Hourly",                    maxGapHours: 2  },
};

function PipelineJobGrid({ jobs, recentRuns }: { jobs: PipelineRun[]; recentRuns: PipelineRun[] }) {
  const now = Date.now();

  // Build a map of job_name → latest run from jobStatuses
  const jobMap = new Map<string, PipelineRun>();
  for (const j of jobs) {
    if (!jobMap.has(j.job_name)) jobMap.set(j.job_name, j);
  }

  const BACKFILL_JOBS = new Set(["hist_backfill", "backfill_coaches", "backfill_transfers"]);

  // Show known jobs first in defined order, then any unknowns at the bottom (backfill jobs excluded — shown in Backfill section)
  const knownOrder = Object.keys(JOB_CONFIG);
  const unknownJobs = jobs.filter(j => !JOB_CONFIG[j.job_name] && !BACKFILL_JOBS.has(j.job_name));

  const renderCard = (run: PipelineRun) => {
    const config = JOB_CONFIG[run.job_name];
    const label = config?.label ?? run.job_name;
    const schedule = config?.schedule ?? "—";
    const maxGapMs = (config?.maxGapHours ?? 48) * 60 * 60 * 1000;

    const startedAt = new Date(run.started_at);
    const ageMs = now - startedAt.getTime();
    const ageMin = Math.round(ageMs / 60000);
    const ageText = ageMin < 60
      ? `${ageMin}m ago`
      : ageMin < 1440
        ? `${Math.round(ageMin / 60)}h ago`
        : `${Math.round(ageMin / 1440)}d ago`;

    const isFailed = run.status === "failed" || run.status === "error";
    const isRunning = run.status === "running";
    const isStaleRunning = isRunning && ageMs > 30 * 60 * 1000;
    const isStaleOld = !isFailed && !isRunning && ageMs > maxGapMs;

    const duration = run.completed_at
      ? Math.round((new Date(run.completed_at).getTime() - startedAt.getTime()) / 1000)
      : null;

    const borderColor = isFailed
      ? "border-red-500/40"
      : isRunning || isStaleOld
      ? "border-amber-500/30"
      : "border-emerald-500/30";

    const dotColor = isFailed
      ? "bg-red-500"
      : isRunning || isStaleOld
      ? "bg-amber-500"
      : "bg-emerald-500";

    const statusText = isFailed
      ? "failed"
      : isStaleRunning
      ? "stuck?"
      : isRunning
      ? "running"
      : "ok";

    return (
      <div key={run.id} className={`rounded-lg border ${borderColor} bg-card p-3 flex flex-col gap-1.5`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className="text-xs font-medium text-foreground truncate">{label}</span>
          <span className={`ml-auto text-[10px] font-mono ${isFailed ? "text-red-400" : isRunning || isStaleOld ? "text-amber-400" : "text-emerald-500"}`}>
            {statusText}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{ageText}</p>
        <p className="text-[10px] text-muted-foreground/60 leading-tight">{schedule}</p>
        {(run.records_count != null || duration != null) && (
          <p className="text-[10px] text-muted-foreground/60 font-mono">
            {run.records_count != null ? `${run.records_count} rows` : ""}
            {run.records_count != null && duration != null ? " · " : ""}
            {duration != null ? `${duration}s` : ""}
          </p>
        )}
        {isFailed && run.error_message && (
          <p className="text-[10px] text-red-400/80 leading-tight break-words">{run.error_message.slice(0, 100)}</p>
        )}
      </div>
    );
  };

  const knownCards = knownOrder
    .map(name => jobMap.get(name))
    .filter((r): r is PipelineRun => r !== undefined)
    .map(renderCard);

  const unknownCards = unknownJobs.map(renderCard);

  if (knownCards.length === 0 && unknownCards.length === 0) {
    return <p className="text-sm text-muted-foreground">No pipeline runs recorded yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {knownCards}
        {unknownCards}
      </div>
      {recentRuns.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground/60 hover:text-muted-foreground select-none">
            Recent run log ({recentRuns.length} entries)
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5 pr-4 font-medium">Job</th>
                  <th className="text-left py-1.5 pr-4 font-medium">Status</th>
                  <th className="text-left py-1.5 pr-4 font-medium">Started</th>
                  <th className="text-right py-1.5 font-medium">Records</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.filter(r => !r.job_name.startsWith("backfill") && r.job_name !== "hist_backfill").slice(0, 30).map(run => {
                  const isError = run.status === "failed" || run.status === "error";
                  return (
                    <tr key={run.id} className={`border-b border-border/40 ${isError ? "bg-red-500/5" : ""}`}>
                      <td className="py-1.5 pr-4 font-mono text-foreground">{run.job_name}</td>
                      <td className={`py-1.5 pr-4 ${isError ? "text-red-400" : "text-emerald-500"}`}>{run.status}</td>
                      <td className="py-1.5 pr-4 text-muted-foreground">{new Date(run.started_at).toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{run.records_count ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
