/**
 * /admin/ops ("Jobs") view model — pure, client-safe (#139 admin redesign, 2026-09-24).
 *
 * Input: rows of view pipeline_job_latest (engine migration 417: the latest run of every job in the
 * last 35 days, with its failure streak since the last success). Output: one row per job the
 * operator can read — a plain status, a plain group, and the group's one-line purpose.
 *
 * Grouping is by job-name pattern, first match wins. A job no pattern knows lands in "Other", so a
 * new job is never hidden — it just asks for a pattern here.
 */

export interface JobLatestRow {
  job_name: string;
  status: string;
  started_at: string;
  error_message: string | null;
  last_ok_at: string | null;
  fail_streak: number | null;
  failing_since: string | null;
}

export type JobState = "failing" | "stuck" | "running" | "quiet" | "ok";

export interface JobView {
  job: string;
  label: string;
  group: string;
  state: JobState;
  lastRun: string;
  lastOk: string | null;
  failingSince: string | null;
  /** No success inside the 35-day window, so failingSince is only the earliest failure we still hold — "at least since". */
  sinceFloor: boolean;
  streak: number;
  error: string | null;
  /** How many schedule slots this row stands for (shadow_HHMM collapses 48 into one). */
  slots: number;
}

/** A job still "running" after this long almost certainly died without recording it (same as the Overview's rule). */
export const JOB_STUCK_H = 3;
/** Nothing recorded for this long, last run fine: weekly jobs sit at ≤ 7 d, so this means "no longer scheduled?". */
export const JOB_QUIET_D = 8;

export const JOB_GROUPS: { key: string; label: string; what: string; test: RegExp }[] = [
  {
    key: "settle",
    label: "Settlement",
    what: "Marks finished bets won or lost and scores each price against the final price. Every 15 min, plus a nightly run.",
    test: /settle|^clv_/,
  },
  {
    key: "odds",
    label: "Odds collection",
    what: "Reads prices from API-Football and each bookmaker, plus prices at kick-off and the price checks.",
    test: /board_audit|results_check|odds|closing|betfair|tonybet|epicbet|unibet|flaresolverr|feed_health|budget|price_sanity|price_fidelity|backfill_live_prices|drift_refresh/,
  },
  {
    key: "picks",
    label: "Picks & bots",
    what: "Turns fresh prices into picks, runs the paper bots and publishes to /picks and Telegram.",
    test: /^betting_|^pick_|^shadow_|publish|paper_pick|_shadow$|combined_1x2|coolbet_model|sharp_outlier|export_bot_config/,
  },
  {
    key: "enrich",
    label: "Fixtures & match data",
    what: "Loads fixtures, tables, injuries and the team numbers the models read. Mostly overnight and early morning.",
    test: /fixture|enrich|injur|standings|team_|league_|line_velocity|xg_|feature_|mfv_|backfill|predictions|rating_|morning_pipeline/,
  },
  {
    key: "models",
    label: "Model upkeep",
    what: "Weekly retraining and checks that the models still behave; monthly tuning.",
    test: /retrain|weekly_|aln_|calibrator|threshold/,
  },
  {
    key: "alerts",
    label: "Alerts & reports",
    what: "Telegram alerts, daily summaries, e-mails, the news checker and the summaries this admin reads.",
    test: /alert|digest|summary|email|news|ops_snapshot|dashboard_cache|healthcheck|health_ping|coolbet_prekickoff|observatory/,
  },
  {
    key: "house",
    label: "Housekeeping",
    what: "Clearing out old data and small cross-checks.",
    test: /prune|stripe|cleanup/,
  },
];
export const OTHER_GROUP = { key: "other", label: "Other", what: "Jobs no group above recognises yet." };

export function jobGroup(name: string): string {
  return (JOB_GROUPS.find((g) => g.test.test(name)) ?? OTHER_GROUP).label;
}

/**
 * Plain names for every job that logs to pipeline_runs (answer-first fix round, 2026-09-25: the
 * tester found snake_case ids as the primary text). The raw id stays as small secondary text only.
 * A job missing here falls back to title-cased words (humanJob) — add it here when you see one.
 */
export const JOB_LABELS: Record<string, string> = {
  aln_auto_tune: "Monthly tuning of the confidence model",
  backfill_half_scores: "Half-time scores fill-in",
  backfill_live_prices: "Live prices at pick time fill-in",
  betfair_exchange_snapshot: "Betfair exchange prices",
  betting_pipeline: "Morning picks run",
  betting_refresh: "Hourly picks refresh",
  board_audit: "Price check-back (wrong or swapped prices)",
  book_price_fidelity: "Bookmaker price accuracy check",
  budget_attribution_flush: "API call counting",
  budget_sync: "API-Football allowance sync",
  closing_snap: "Prices at kick-off",
  clv_sharp: "Price vs the final price, scoring",
  combined_1x2_refresh: "Combined match-result model refresh",
  coolbet_daemon_healthcheck: "Coolbet collector health check",
  coolbet_daily_summary: "Coolbet daily summary",
  coolbet_health_ping: "Coolbet health ping",
  coolbet_model_1x2_shadow: "Coolbet match-result model (paper)",
  coolbet_model_ou_shadow: "Coolbet over/under model (paper)",
  coolbet_odds_freshness: "Coolbet odds freshness check",
  coolbet_odds_snapshot: "Coolbet odds",
  coolbet_prekickoff_alert: "Coolbet pre-kick-off alert",
  coolbet_price_sanity: "Coolbet price sanity check",
  corners_paper_pick: "Corners picks (paper)",
  corners_paper_settle: "Corners picks settlement (paper)",
  daily_real_perf_email: "Daily real-money e-mail",
  dashboard_cache_refresh: "Public site numbers refresh",
  enrichment_full: "Full match-data refresh",
  epicbet_odds_freshness: "Epicbet odds freshness check",
  epicbet_odds_snapshot: "Epicbet odds",
  exchange_quotes_prune: "Old exchange prices clean-up",
  export_bot_config: "Bot settings export",
  feature_densify: "Model inputs fill-in",
  feed_health: "Feed status check",
  fetch_enrichment: "Morning match data",
  fetch_fixtures: "Morning fixtures",
  fetch_odds: "Morning odds",
  fetch_predictions: "Morning predictions",
  fh_1x2_paper_pick: "First-half result picks (paper)",
  fh_1x2_paper_settle: "First-half result settlement (paper)",
  fixture_refresh: "Fixtures refresh",
  flaresolverr_sweep: "Browser helper clean-up",
  health_alerts_feeds: "Feed alerts",
  health_alerts_morning: "Morning health alerts",
  health_alerts_settlement: "Settlement alerts",
  injuries_morning: "Morning injuries",
  injury_severity: "Injury impact scores",
  league_clv_efficiency: "League price-accuracy scores",
  league_draw_rate: "League draw rates",
  league_season_phase: "League season stage",
  line_velocity: "Price movement speed",
  mfv_b_ml3_nightly_refresh: "Nightly model features refresh",
  mfv_form_momentum_nightly_refresh: "Nightly form features refresh",
  mfv_v3_signals_propagate: "Nightly extra signals refresh",
  morning_pipeline: "Morning data load",
  news_checker: "News checker",
  observatory_metrics: "Daily data-quality metrics",
  odds_api_fallback: "Backup Coolbet prices (The Odds API)",
  odds_pre_kickoff: "Odds before kick-off",
  odds_refresh: "API-Football odds",
  odds_tomorrow: "Tomorrow's odds",
  ops_snapshot_fallback: "Admin summary (backup)",
  ou35_model_shadow: "Over/under 3.5 model (paper)",
  ou_sharp_outlier: "Over/under price outliers (paper)",
  pick_trigger_matcher: "Pick rule matching",
  pick_triggers: "Pick rules",
  pinnacle_drift_refresh: "Sharpest-book price movement",
  pipeline_failure_alerter: "Job failure alerts",
  pipeline_runs_failure_digest: "Job failure digest",
  prune_live_snapshots: "Old live data clean-up",
  publish_daily_picks: "Publish daily picks",
  publish_picks_forward_test: "Publish /picks",
  rating_1x2_shadow: "Team-rating match-result model (paper)",
  results_check: "Results cross-check",
  retrain_healthcheck: "Model retrain check",
  settlement: "Nightly settlement",
  settlement_blend: "Settlement: model blend refit",
  settlement_dc_rho: "Settlement: low-score adjustment refit",
  settlement_ml_etl: "Settlement: model training rows",
  settlement_platt: "Settlement: probability recalibration",
  settlement_prune: "Settlement: clean-up",
  settle_ready: "15-minute settlement sweep",
  settle_reconcile: "Settlement cross-check",
  shadow_HHMM: "Half-hourly pick scan",
  standings_nightly: "Nightly league tables",
  stripe_reconcile: "Payments cross-check",
  team_avg_player_rating: "Team player ratings",
  team_scoring_rates: "Team scoring rates",
  team_total_paper_pick: "Team goals picks (paper)",
  team_total_paper_settle: "Team goals settlement (paper)",
  tonybet_live: "Tonybet live data",
  tonybet_odds_snapshot: "Tonybet odds",
  tonybet_results: "Tonybet results",
  trigger_calibrator_watch: "Pick-rule calibration watch",
  unibet_kambi_odds: "Old Unibet feed (retired)",
  unibet_site_odds: "Unibet odds",
  weekly_bot_review: "Weekly bot review",
  weekly_meta_retrain: "Weekly pick-filter retrain",
  weekly_meta_validate: "Weekly pick-filter check",
  weekly_retrain: "Weekly model retrain",
  weekly_threshold_check: "Weekly threshold check",
  write_ops_snapshot: "Admin summary",
  xg_late_fill: "Expected goals fill-in",
  xg_overperformance: "Expected goals over/under-performance",
};

/** A job's plain name: JOB_LABELS, else title-cased words ("league_draw_rate" → "League Draw Rate"). */
export function humanJob(name: string): string {
  if (JOB_LABELS[name]) return JOB_LABELS[name];
  return name
    .replace(/^job_/, "")
    .split("_")
    .filter(Boolean)
    .map((w) => (/^(af|clv|ou|ml|xg|elo)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export const STATE_RANK: Record<JobState, number> = { failing: 0, stuck: 1, running: 2, quiet: 3, ok: 4 };

function stateOf(j: { status: string; started_at: string }, now: number): JobState {
  if (j.status === "failed" || j.status === "error") return "failing";
  const age = now - new Date(j.started_at).getTime();
  if (j.status === "running") return age > JOB_STUCK_H * 3600_000 ? "stuck" : "running";
  if (age > JOB_QUIET_D * 86_400_000) return "quiet";
  return "ok";
}

/**
 * The 48 half-hourly shadow scans (shadow_0010 … shadow_2340) are one job to the operator — collapse
 * them into one row that is failing if ANY slot is, with the newest run and the longest streak.
 */
export function buildJobViews(rows: JobLatestRow[], now: number): JobView[] {
  const byKey = new Map<string, JobLatestRow[]>();
  for (const r of rows) {
    const key = /^shadow_\d{4}$/.test(r.job_name) ? "shadow_HHMM" : r.job_name;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  const out: JobView[] = [];
  for (const [key, rs] of byKey) {
    const states = rs.map((r) => stateOf(r, now));
    const worstI = states.reduce((a, s, i) => (STATE_RANK[s] < STATE_RANK[states[a]] ? i : a), 0);
    const worst = rs[worstI];
    const newest = rs.reduce((a, r) => (r.started_at > a.started_at ? r : a), rs[0]);
    const failing = rs.filter((r) => r.status === "failed" || r.status === "error");
    const since = failing.map((r) => r.failing_since).filter((x): x is string => !!x).sort()[0] ?? null;
    const lastOk = rs.map((r) => r.last_ok_at).filter((x): x is string => !!x).sort().pop() ?? null;
    out.push({
      job: key,
      label: key === "shadow_HHMM" ? `${JOB_LABELS.shadow_HHMM} (${rs.length} slots)` : humanJob(key),
      group: jobGroup(key === "shadow_HHMM" ? "shadow_0000" : key),
      state: states[worstI],
      lastRun: newest.started_at,
      lastOk,
      failingSince: since,
      sinceFloor: !!since && failing.some((r) => r.last_ok_at == null),
      streak: Math.max(0, ...failing.map((r) => Number(r.fail_streak ?? 0))),
      // the raw error usually repeats the job name ("line_velocity failed: exit 1") — keep the useful tail
      error: states[worstI] === "failing" ? (worst.error_message ?? "").replace(new RegExp(`^${worst.job_name}\\s*failed:?\\s*`, "i"), "").trim() || null : null,
      slots: rs.length,
    });
  }
  return out.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || b.streak - a.streak || a.label.localeCompare(b.label));
}

/**
 * Four status words only (answer-first fix round, 2026-09-25). "Running · 8 min ago" read as
 * "executing now" — a job in progress is OK until it has run 3 h (then Stuck), and says "running now"
 * in its last-run text instead. "Retired" = its last run was fine but nothing for 8+ days; those sit
 * under the collapsed "Old jobs". Jobs unregistered on purpose (engine table retired_jobs, migration
 * 426) never reach this page at all.
 */
export const STATE_WORD: Record<JobState, string> = {
  failing: "Failing",
  stuck: "Stuck",
  running: "OK",
  quiet: "Retired",
  ok: "OK",
};

/** The ⓘ text that defines the four words. */
export const STATE_WORDS_HELP =
  "OK: its last run finished (or is running now, for under 3 h). Failing: its last run failed. Stuck: still marked running after 3 h — it probably died without saying so. Retired: its last run was fine but it has not run for over 8 days — probably no longer scheduled; listed under Old jobs.";

/** A failure whose last run is within this many days is "failing now" (red); older = amber. Same rule as the Overview. */
export const RECENT_FAILURE_D = 7;

export const isRecentFailure = (v: Pick<JobView, "lastRun">, now: number) => now - new Date(v.lastRun).getTime() <= RECENT_FAILURE_D * 86_400_000;

const DM = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dm = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${DM[d.getUTCMonth()]}`;
};

/**
 * "Failed on 1 Sep — it has not run since" (one failed run since the last success) or
 * "Failing since 3 Sep · 5 failed runs in a row". The old "Failing since: before 1 Sep" + "1 failed
 * run in a row" said the same thing twice and read as a long outage.
 */
export function failingText(v: Pick<JobView, "state" | "failingSince" | "lastRun" | "streak" | "sinceFloor">): string | null {
  if (v.state !== "failing") return null;
  if (v.streak <= 1) return `Failed on ${dm(v.lastRun)} — it has not run since`;
  const since = v.failingSince ? `${v.sinceFloor ? "Failing since before" : "Failing since"} ${dm(v.failingSince)}` : "Failing";
  return `${since} · ${v.streak} failed runs in a row`;
}

/** "ran 8 min ago" / "running now · started 8 min ago" (`ago` = a timeAgo-style formatter). */
export function lastRunText(v: Pick<JobView, "state" | "lastRun">, ago: (iso: string) => string): string {
  return v.state === "running" ? `running now · started ${ago(v.lastRun)}` : `ran ${ago(v.lastRun)}`;
}

/**
 * The Jobs answer, shared with the Overview (Rule 1: never "All running" while a failure is listed):
 *   any job failing → "1 job failing — <plain name>", sub "since 1 Sep"; RED if any failing job's last
 *   run is within RECENT_FAILURE_D days, else AMBER (a rarely-run job's old failure);
 *   else stuck → amber; else green "All running".
 */
export function jobsAnswer(views: JobView[], now: number): { tone: "danger" | "warning" | "success"; text: string; sub: string; failing: JobView[] } {
  const failing = views.filter((v) => v.state === "failing");
  const stuck = views.filter((v) => v.state === "stuck");
  const active = views.filter((v) => v.state !== "quiet").length;
  if (failing.length) {
    const first = [...failing].sort((a, b) => Number(isRecentFailure(b, now)) - Number(isRecentFailure(a, now)) || b.streak - a.streak)[0];
    const more = failing.length > 1 ? ` and ${failing.length - 1} more` : "";
    const since = first.streak <= 1 ? `failed on ${dm(first.lastRun)}, no run since` : `since ${dm(first.failingSince ?? first.lastRun)} · ${first.streak} failed runs in a row`;
    return {
      tone: failing.some((v) => isRecentFailure(v, now)) ? "danger" : "warning",
      text: `${failing.length} job${failing.length === 1 ? "" : "s"} failing — ${first.label}${more}`,
      sub: since,
      failing,
    };
  }
  if (stuck.length) return { tone: "warning", text: `${stuck.length} job${stuck.length === 1 ? "" : "s"} stuck — ${stuck[0].label}`, sub: "still marked running after 3 h", failing };
  return { tone: "success", text: "All running", sub: `${active} jobs, last runs fine`, failing };
}

// ── #139 UX fix round (2026-09-24) ──────────────────────────────────────────────────────────────

/**
 * Jobs that have a Run-now path: the scheduler job of every feed whose registry entry grants
 * "run_now" (engine workers/registry/feed_registry.py → feed_status.controls). The Jobs drawer
 * posts to the same audited /api/admin/feed-control as /admin/feeds. Every other job has no
 * run-now path from the web. Smoke ADMIN-JOBS-DRAWER pins this map against the registry.
 */
export const JOB_FEED: Record<string, string> = {
  coolbet_odds_snapshot: "coolbet_prematch",
  epicbet_odds_snapshot: "epicbet_prematch",
  unibet_site_odds: "unibet_prematch",
  tonybet_odds_snapshot: "tonybet_prematch",
  tonybet_live: "tonybet_live",
  tonybet_results: "tonybet_results",
  odds_refresh: "af_odds",
  closing_snap: "af_closing",
  betfair_exchange_snapshot: "betfair_exchange",
};

/** Anchor for one job row: id="job-<job_name>". The 48 shadow_HHMM slots share job-shadow_HHMM. */
export function jobAnchor(jobName: string): string {
  return `job-${/^shadow_\d{4}$/.test(jobName) ? "shadow_HHMM" : jobName}`;
}

/** One pipeline_runs row, as the Jobs drawer shows it. */
export interface JobRun {
  job_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_count: number | null;
  error_message: string | null;
}
