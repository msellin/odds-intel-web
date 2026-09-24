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
    what: "Marks finished matches as won or lost, works out profit and closing-price value (CLV), and tidies up afterwards. Main run at night, plus a sweep every 15 minutes.",
    test: /settle|clv_/,
  },
  {
    key: "odds",
    label: "Odds collection",
    what: "Reads prices from API-Football and from each bookmaker we sweep ourselves, plus closing prices at kick-off, freshness and data-quality checks, and request budgets.",
    test: /board_audit|results_check|odds|closing|betfair|tonybet|epicbet|unibet|flaresolverr|feed_health|budget|price_sanity|price_fidelity|backfill_live_prices|drift_refresh/,
  },
  {
    key: "picks",
    label: "Picks & bots",
    what: "Turns fresh prices into picks: the betting pipeline, trigger rules, the shadow scans every 30 minutes, paper bots, and publishing to /picks and Telegram.",
    test: /^betting_|^pick_|^shadow_|publish|paper_pick|_shadow$|combined_1x2|coolbet_model/,
  },
  {
    key: "enrich",
    label: "Fixtures & match data",
    what: "Loads fixtures, standings, injuries, predictions and the per-team numbers the models read (ratings, form, scoring rates). Mostly early morning and overnight.",
    test: /fixture|enrich|injur|standings|team_|league_|line_velocity|xg_|feature_|mfv_|backfill|predictions|rating_|morning_pipeline/,
  },
  {
    key: "models",
    label: "Model upkeep",
    what: "Weekly retraining and checks that the models and thresholds still behave; monthly tuning.",
    test: /retrain|weekly_|aln_|calibrator|threshold/,
  },
  {
    key: "alerts",
    label: "Alerts & reports",
    what: "Telegram alerts, daily summaries and e-mails, the news checker, and the snapshots this admin reads.",
    test: /alert|digest|summary|email|news|ops_snapshot|dashboard_cache|healthcheck|health_ping|coolbet_prekickoff/,
  },
  {
    key: "house",
    label: "Housekeeping",
    what: "Pruning old rows and small reconciliations.",
    test: /prune|stripe|cleanup/,
  },
];
export const OTHER_GROUP = { key: "other", label: "Other", what: "Jobs no group above recognises yet." };

export function jobGroup(name: string): string {
  return (JOB_GROUPS.find((g) => g.test.test(name)) ?? OTHER_GROUP).label;
}

/** "league_draw_rate" → "League draw rate". */
export function humanJob(name: string): string {
  const s = name.replace(/^job_/, "").replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
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
      label: key === "shadow_HHMM" ? `Shadow scan (${rs.length} half-hourly slots)` : humanJob(key),
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

export const STATE_WORD: Record<JobState, string> = {
  failing: "Failing",
  stuck: "Stuck",
  running: "Running",
  quiet: "Quiet",
  ok: "OK",
};
