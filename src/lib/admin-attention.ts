/**
 * The /admin attention inbox (#139 IA move P4, dev/active/admin-information-architecture.md §3.3).
 *
 * One list of things that need an ACTION, built from state we already read. Each item says one
 * sentence, how long the condition has lasted, and links to the exact place it is fixed.
 * Information that needs no action (verdict mixes, pick counts, ROI) is deliberately NOT here — it
 * lives in the charts.
 *
 * Honesty: an unreadable source is itself an item ("… unreadable"), never an empty list.
 *
 * Manual real bets awaiting confirmation (IA G9): real_bets.placed_real NULL means LEGACY before
 * 2026-09-09 (migration 325) but "not yet confirmed by the account reconciler" for every manual bet
 * since (record_manual_real_bet, migration 407). So the rule counts NULL rows placed on/after
 * MANUAL_RECONCILE_SINCE and older than 24 h.
 *
 * Not yet covered (need an engine source first, IA gaps): picks-channel send proof (G3), deploy
 * drift (G6), duplicate bets (ops_snapshots).
 *
 * Pure and client-safe: the loader (admin-overview.ts) does the reads, this only decides.
 */
import { humanJob, jobAnchor } from "./admin-jobs-model";
import type { ControlState } from "./bot-controls/types";
import { HEARTBEAT_STALE_MIN } from "./bot-controls/types";
import { feedHealth } from "./admin-feeds-model";

export type Severity = "danger" | "warn" | "info";

export interface AttentionItem {
  id: string;
  severity: Severity;
  area: "money" | "picks" | "feeds" | "bots" | "jobs" | "data";
  title: string;
  detail?: string;
  /** ISO time the condition STARTED, when known (for a failing job: its first failure since the last success). */
  since?: string | null;
  /** `since` is only a lower bound (no success inside the history window) — render "over …". */
  sinceFloor?: boolean;
  href: string;
}

export interface AttentionInputs {
  now: number;
  control: ControlState;
  canStake: "yes" | "no" | "unknown";
  feeds: {
    feed_id: string;
    label: string;
    status: string;
    status_reason: string | null;
    last_data_at: string | null;
    paused?: boolean;
    paused_by?: string | null;
    paused_at?: string | null;
    updated_at?: string | null;
  }[];
  feedsError: string | null;
  jobs: { job_name: string; status: string; started_at: string; error_message: string | null; fail_streak: number | null; failing_since: string | null; last_ok_at: string | null }[];
  jobsError: string | null;
  stalePending: number;
  staleError: string | null;
  /** The Feeds page's own advice (dqAdvice over dqProblems) + its 24 h problems for the one-line summary. */
  dq: { count: number; open: number; needsLook: boolean; text: string; groups: { group: string; n: number }[] };
  dqError: string | null;
  /** Jobs the Jobs page calls Late or Stuck (buildJobViews with each job's usual gap) — one rule, both pages. */
  lateJobs?: { job: string; label: string; state: "late" | "stuck"; lastRun: string }[];
  /** Run history (usual gaps) unreadable — lateness is NOT checked, which must be said, not implied OK. */
  cadenceError?: string | null;
  /** Pending bets on postponed/cancelled matches that settlement has NOT voided (postponedNeedingVoid). */
  postponedOpen?: number;
  postponedError?: string | null;
  /** Manual real bets with placed_real NULL, placed since MANUAL_RECONCILE_SINCE, older than 24 h. */
  unconfirmedManual: number;
  /** placed_at of the oldest of them (ISO) — the owner needs to know WHICH bets, not "over a day". */
  unconfirmedOldest?: string | null;
  unconfirmedError: string | null;
  bots: { bot: string; text: string; severity: "warn" | "danger" }[];
}

const MIN = 60_000;
const H24 = 24 * 60 * MIN;
const SEV_ORDER: Record<Severity, number> = { danger: 0, warn: 1, info: 2 };
/** Within a severity: money first, then the customer channel, feeds, jobs, bots, data (UX test 2026-09-24). */
const AREA_ORDER: Record<AttentionItem["area"], number> = { money: 0, picks: 1, feeds: 2, jobs: 3, bots: 4, data: 5 };
/** feed_status is rewritten every 5 min by the engine; older than this = the status job is stuck. */
const FEED_STATUS_STALE_MIN = 15;
/** A job still 'running' after this long has almost certainly died without recording it. */
/** Distinct data-quality problems in 24 h before the inbox asks for a look (they are set aside automatically). */
/** First day every NULL placed_real row means "unconfirmed manual", not "legacy" (see header). */
export const MANUAL_RECONCILE_SINCE = "2026-09-10";

/** "league_draw_rate" → "League draw rate". */
// Data-quality groups: the SAME plain labels as the /admin/feeds summary (admin-feeds-model.ts).
function dqSummary(rows: { group: string; n: number }[]): string {
  const g = new Map<string, number>();
  for (const r of rows) {
    const label = r.group.toLowerCase();
    g.set(label, (g.get(label) ?? 0) + r.n);
  }
  return [...g.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${n} ${l}`).join(" · ");
}

/** Which /admin/feeds block a feed lives in (ids: book-<key>, feeds-board.tsx). */
function feedAnchor(feedId: string): string {
  const p = feedId.split("_")[0];
  if (["coolbet", "epicbet", "unibet", "tonybet", "betfair"].includes(p)) return `/admin/feeds#book-${p}`;
  if (p === "af") return "/admin/feeds#book-api-football";
  if (feedId === "direct_close") return "/admin/feeds#book-closing";
  return "/admin/feeds#book-infra";
}

function unreadable(id: string, area: AttentionItem["area"], what: string, error: string, href: string): AttentionItem {
  return { id, severity: "warn", area, title: `${what} unreadable — this list may be missing items`, detail: error, href };
}

function moneyItems(i: AttentionInputs): AttentionItem[] {
  const out: AttentionItem[] = [];
  const f = i.control.fleet.row;
  if (i.control.fleet.error || !f) {
    out.push({ id: "fleet-unknown", severity: "warn", area: "money", title: "Fleet switches unreadable — every switch shows Unknown", detail: i.control.fleet.error ?? "row missing", href: "/admin/bots#real-money" });
  }
  if (f?.real_money_armed) {
    const running = f.placement_paused === false;
    // same executor rule as ladder layer 5: alive AND started with --execute (a dry-run placer is not an executor)
    const executing = i.control.heartbeats.rows.some(
      (h) => h.execute_requested && h.last_seen_at && i.now - new Date(h.last_seen_at).getTime() <= HEARTBEAT_STALE_MIN * MIN,
    );
    const stake = i.canStake === "yes" ? "CAN STAKE: YES" : i.canStake === "unknown" ? "CAN STAKE: UNKNOWN" : "CAN STAKE: NO";
    out.push({
      id: "armed",
      severity: "danger",
      area: "money",
      title: running ? `Real money is ARMED and placement is running · ${stake}` : `Real money is ARMED (placement paused) · ${stake}`,
      detail: running && !executing ? "…and no placer on the Mac has checked in with --execute recently" : f.real_money_armed_reason ?? undefined,
      since: f.real_money_armed_at,
      href: "/admin/bots#real-money",
    });
  }
  if (f?.publishing_paused) {
    out.push({ id: "picks-paused", severity: "warn", area: "picks", title: "Picks channel paused — customers get nothing on Telegram", detail: f.publishing_paused_reason ?? undefined, since: f.publishing_paused_at, href: "/admin/bots#controls" });
  }
  return out;
}

function feedItems(i: AttentionInputs): AttentionItem[] {
  const out: AttentionItem[] = [];
  const f = i.control.fleet.row;
  if (i.feedsError) out.push(unreadable("feeds-unreadable", "feeds", "Feed status", i.feedsError, "/admin/feeds"));
  const updated = i.feeds.reduce<string | null>((a, x) => (x.updated_at && (!a || x.updated_at > a) ? x.updated_at : a), null);
  if (updated && i.now - new Date(updated).getTime() > FEED_STATUS_STALE_MIN * MIN) {
    out.push({ id: "feed-status-stale", severity: "danger", area: "feeds", title: "The feed status check itself has stopped — feed colours are out of date", since: updated, href: "/admin/feeds" });
  }
  for (const fd of i.feeds) {
    const h = feedHealth(fd);
    if (h !== "fail" && h !== "warn") continue;
    const auto = fd.status === "paused" && fd.paused_by === "auto";
    out.push({
      id: `feed-${fd.feed_id}`,
      severity: h === "fail" ? "danger" : "warn",
      area: "feeds",
      title: `${fd.label}: ${auto ? "stopped — the engine paused it after repeated failures" : h === "fail" ? "stopped" : "needs a look"}`,
      detail: fd.status_reason ?? undefined,
      since: h === "fail" ? fd.last_data_at : undefined,
      href: feedAnchor(fd.feed_id),
    });
  }
  if (f?.daemons_paused && f.daemons_paused_at && i.now - new Date(f.daemons_paused_at).getTime() > H24) {
    out.push({ id: "footprint-long", severity: "warn", area: "feeds", title: "Coolbet sweeping paused for over a day", detail: f.daemons_paused_reason ?? "no reason given", since: f.daemons_paused_at, href: "/admin/feeds#coolbet-footprint" });
  }
  for (const fd of i.feeds) {
    if (fd.paused && fd.paused_by !== "auto" && fd.paused_at && i.now - new Date(fd.paused_at).getTime() > H24) {
      out.push({ id: `feed-paused-${fd.feed_id}`, severity: "warn", area: "feeds", title: `${fd.label} paused for over a day`, since: fd.paused_at, href: feedAnchor(fd.feed_id) });
    }
  }
  return out;
}

function jobItems(i: AttentionInputs): AttentionItem[] {
  const out: AttentionItem[] = [];
  if (i.jobsError) out.push(unreadable("jobs-unreadable", "jobs", "Job history", i.jobsError, "/admin/ops"));
  for (const j of i.jobs) {
    if (j.status === "failed") {
      // the raw error usually repeats the job name ("line_velocity failed: exit 1") — keep the useful tail
      const err = j.error_message?.replace(new RegExp(`^${j.job_name}\\s*failed:?\\s*`, "i"), "").slice(0, 160);
      const streak = j.fail_streak ?? 1;
      // A failure whose LAST run is over a week old belongs to a job that runs rarely (weekly /
      // monthly) or was fixed since without a rerun — "To check", not "Urgent" (2026-09-25:
      // aln_auto_tune read urgent for 24 days after its fix, until its monthly run).
      const old = i.now - new Date(j.started_at).getTime() > 7 * H24;
      out.push({
        id: `job-${j.job_name}`,
        severity: old ? "warn" : "danger",
        area: "jobs",
        title: old
          ? `${humanJob(j.job_name)}: failed ${Math.round((i.now - new Date(j.started_at).getTime()) / H24)} days ago`
          : streak > 1 ? `${humanJob(j.job_name)}: failed ${streak} runs in a row` : `${humanJob(j.job_name)}: failed on its last run`,
        // the raw error is technical — the Jobs page shows it behind "technical detail"
        // one-line title (it wrapped to 7 lines on a phone); the why goes in the small print
        detail: old ? "It runs rarely — its next run shows whether it is fixed" : err ? "Technical detail on the Jobs page" : undefined,
        since: j.failing_since ?? j.started_at,
        sinceFloor: j.last_ok_at == null,
        href: `/admin/ops#${jobAnchor(j.job_name)}`,
      });
    }
  }
  if (i.cadenceError) out.push(unreadable("job-cadence", "jobs", "Job run history", i.cadenceError, "/admin/ops"));
  // Late / stuck: the Jobs page's own rule (each job's usual gap and run time — admin-jobs-model isLate /
  // stuckAfterMs), so the Overview never calls a check "stopped" while Jobs says OK, or the reverse.
  for (const v of i.lateJobs ?? []) {
    out.push({
      id: `job-${v.state}-${v.job}`,
      severity: "warn",
      area: "jobs",
      title: v.state === "stuck" ? `${v.label}: still marked running — probably died` : `${v.label}: late — has not run on its usual schedule`,
      since: v.lastRun,
      href: `/admin/ops#${jobAnchor(v.job)}`,
    });
  }
  if (i.postponedError) out.push(unreadable("postponed-unreadable", "jobs", "Postponed-match check", i.postponedError, "/admin/ops#settlement"));
  else if (i.postponedOpen) {
    // honest wording (review 2026-09-25): settlement voids postponed REAL bets and forward-test picks, but
    // not paper/shadow picks — so these stay open until the engine fix (#162), not "normally by itself"
    out.push({ id: "postponed-open", severity: "warn", area: "jobs", title: `${i.postponedOpen} pick${i.postponedOpen === 1 ? "" : "s"} on postponed matches never closed`, detail: "Paper picks — no money. Settlement doesn't void these yet (engine fix queued)", href: "/admin/ops#settlement" });
  }
  if (i.staleError) out.push(unreadable("stale-unreadable", "jobs", "Pending-bet check", i.staleError, "/admin/ops"));
  else if (i.stalePending > 0) {
    out.push({ id: "stale-pending", severity: "warn", area: "jobs", title: `${i.stalePending} bet${i.stalePending === 1 ? "" : "s"} still unsettled 2½ h after kick-off`, detail: "Settlement looks stuck", href: "/admin/ops#settlement" });
  }
  return out;
}

export function buildAttention(i: AttentionInputs): AttentionItem[] {
  const out: AttentionItem[] = [...moneyItems(i), ...feedItems(i)];
  for (const b of i.bots) {
    out.push({ id: `bot-${b.bot}-${b.text}`, severity: b.severity, area: "bots", title: b.text, href: `/admin/bots?bot=${encodeURIComponent(b.bot)}` });
  }
  out.push(...jobItems(i));
  if (i.unconfirmedError) out.push(unreadable("manual-unreadable", "money", "Real-bet ledger", i.unconfirmedError, "/admin/real-bets"));
  else if (i.unconfirmedManual > 0) {
    const from = i.unconfirmedOldest ? new Date(i.unconfirmedOldest).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : null;
    out.push({
      id: "manual-unconfirmed",
      severity: "warn",
      area: "money",
      title: `${i.unconfirmedManual} real bet${i.unconfirmedManual === 1 ? "" : "s"} placed by hand${from ? ` (from ${from})` : ""} still not matched to your Coolbet account — check ${i.unconfirmedManual === 1 ? "it" : "them"}`,
      detail: "Logged from the Pick queue; the bookmaker-account check has not found them yet",
      since: i.unconfirmedOldest,
      href: "/admin/real-bets",
    });
  }
  if (i.dqError) out.push(unreadable("dq-unreadable", "data", "Data-quality findings", i.dqError, "/admin/feeds#dq"));
  // ONE rule with /admin/feeds (dqAdvice): only problems NOT set aside automatically ask for a look
  // (strict owner test 2026-09-25: Overview said "14 … worth a look", Feeds "12 … no action needed").
  else if (i.dq.needsLook) {
    out.push({ id: "dq", severity: "warn", area: "data", title: i.dq.text.replace(" 24 h", " 24\u00a0hours"), detail: dqSummary(i.dq.groups), href: "/admin/feeds#dq" });
  }
  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || AREA_ORDER[a.area] - AREA_ORDER[b.area]);
}
