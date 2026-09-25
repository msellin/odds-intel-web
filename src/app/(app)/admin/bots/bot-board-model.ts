// /admin/bots — view model (#139, bots-board-ux-spec §2–§4, §10, §13).
//
// Turns the four unified reads (bot_scoreboard / bot_config / bot_capabilities / bot_weekly)
// into one BotView per bot: its family, the ONE admissible metric for that family, a
// five-state verdict, the forward-test comparison against the junk control, and the
// "needs a look" issues. Pure functions — the components only render what this returns.
//
// Units: CLV means / se / ROI are FRACTIONS (0.025 = +2.5%), as in the source ledgers.

import type {
  BotCapabilitiesRow,
  BotConfigRow,
  BotScoreboardRow,
  BotMarketStatsRow,
  BotWeeklyRow,
  BotReviewFlagRow,
  RetiredInfo,
} from "@/lib/bot-board";
import { fmtRuleVersion, identityLine, prettyDisplayName } from "./bot-board-format";
import { timeAgo } from "@/lib/rel-time";

// [[#159]] (2026-09-25): ONE CLV for every non-in-play bot — clv_anchor, the sharp-anchor close
// (fresh de-vigged Pinnacle, else a 5+-book consensus). "clv_pinnacle" (the legacy
// clv_pinnacle_devig: no close-age limit, recorded price) is gone; clv_mc (the bet book's OWN
// close) stays only as the "other metric".
export type Metric = "clv_anchor" | "clv_mc" | "lift";

export const MIN_N = 30;
export const CONTROL_BOT = "control_junk_anchor";

// Control is NOT a section: it is the reference strip on top of the forward test (§2.1).
export const FAMILY_ORDER = [
  "forward_test",
  "sharp_trigger",
  "sharp_generator",
  "model_shadow",
  "model_sim",
  "inplay",
  "unknown",
] as const;

export type Accent = "teal" | "violet" | "sky" | "amber" | "amberStrong";

export interface FamilyInfo {
  title: string;
  subtitle: string;
  metric: Metric;
  accent: Accent;
  icon: "flask" | "crosshair" | "radar" | "brain" | "timer" | "alert" | "control";
}

export const FAMILY_INFO: Record<string, FamilyInfo> = {
  forward_test: { title: "Forward test", subtitle: "Pre-registered, public on /picks. Never re-scored.", metric: "clv_anchor", accent: "teal", icon: "flask" },
  sharp_trigger: { title: "Sharp triggers", subtitle: "One per book — fire when the book beats Pinnacle.", metric: "clv_anchor", accent: "violet", icon: "crosshair" },
  sharp_generator: { title: "Sharp generators", subtitle: "Any placeable book above the de-vigged Pinnacle line.", metric: "clv_anchor", accent: "violet", icon: "radar" },
  model_shadow: { title: "Model · paper", subtitle: "Our model, priced at books we can bet.", metric: "clv_anchor", accent: "sky", icon: "brain" },
  model_sim: { title: "Model · simulated", subtitle: "Our model, best accessible price (behind /performance).", metric: "clv_anchor", accent: "sky", icon: "brain" },
  inplay: { title: "In-play", subtitle: "Picks during the match. No closing line → no CLV.", metric: "lift", accent: "amber", icon: "timer" },
  control: { title: "Junk control", subtitle: "A deliberately junk-anchored arm — the forward test's noise floor.", metric: "clv_anchor", accent: "amber", icon: "control" },
  unknown: { title: "Settings unknown", subtitle: "The nightly settings list could not describe these (scripts/export_bot_config.py).", metric: "clv_anchor", accent: "amberStrong", icon: "alert" },
};

export const METRIC_LABEL: Record<Metric, string> = {
  clv_mc: "mc-CLV — margin-corrected CLV against the bet book's own close",
  clv_anchor: "CLV — against the sharp close (fresh de-vigged Pinnacle, else a 5+-book consensus), at our books' price",
  lift: "lift — hit rate minus de-vigged implied probability (not computed yet)",
};
export const METRIC_PILL: Record<Metric, string> = { clv_anchor: "SHARP CLV", clv_mc: "MC-CLV", lift: "NO CLV" };
export const METRIC_SHORT: Record<Metric, string> = { clv_anchor: "sharp CLV", clv_mc: "mc-CLV", lift: "lift" };

export function familyOf(sb: BotScoreboardRow | undefined, cfg: BotConfigRow | undefined): string {
  const f = sb?.family && sb.family !== "unknown" ? sb.family : cfg?.family ?? sb?.family ?? "unknown";
  return FAMILY_INFO[f] ? f : "unknown";
}

export function metricOf(family: string, cfg: BotConfigRow | undefined): Metric {
  if (family === "inplay") return "lift";
  const m = cfg?.admissible_metric;
  if (m === "clv_anchor" || m === "clv_mc" || m === "lift") return m;
  return FAMILY_INFO[family]?.metric ?? "clv_anchor";
}

export interface MetricValue {
  metric: Metric;
  n: number | null;
  mean: number | null;
  se: number | null;
  t: number | null;
}

export function metricValue(sb: BotScoreboardRow | undefined, metric: Metric): MetricValue {
  if (!sb || metric === "lift") return { metric, n: null, mean: null, se: null, t: null };
  if (metric === "clv_anchor") return { metric, n: sb.clv_anchor_n, mean: sb.clv_anchor_mean, se: sb.clv_anchor_se, t: sb.clv_anchor_t };
  return { metric, n: sb.clv_mc_n, mean: sb.clv_mc_mean, se: sb.clv_mc_se, t: sb.clv_mc_t };
}

/** The non-admissible CLV, for the drawer's collapsed "Other metrics" block only. */
export function otherMetric(sb: BotScoreboardRow | undefined, metric: Metric): MetricValue | null {
  if (!sb || metric === "lift") return null;
  return metricValue(sb, metric === "clv_mc" ? "clv_anchor" : "clv_mc");
}

export type Verdict = "beats" | "loses" | "inconclusive" | "early" | "noclv";

/** Honesty rule 1: nothing but "early" below n = 30. */
export function verdictOf(m: MetricValue): Verdict {
  if (m.metric === "lift") return "noclv";
  if (m.t == null || m.n == null || m.n < MIN_N) return "early";
  if (m.t >= 2) return "beats";
  if (m.t <= -2) return "loses";
  return "inconclusive";
}

export const VERDICT_ORDER: Verdict[] = ["beats", "loses", "inconclusive", "early", "noclv"];

/** The junk-anchored control (pooled over all its markets) plus its per-market split. */
export interface ControlRef {
  mean: number;
  se: number | null;
  n: number | null;
  ruleVersion: string | null;
  /** From bot_market_stats (411); null while the view is not available. */
  byMarket: Map<string, { n: number; mean: number; se: number | null }> | null;
}

/** The reference a bot is drawn and compared against: the control on the bot's OWN market mix. */
export interface ControlLineRef {
  mean: number;
  se: number | null;
  /** false = pooled control (the bot's markets are not all covered, or no per-market data). */
  sameMarket: boolean;
}

export type ControlCmp = "equal" | "above" | "below";

export interface ControlComparison {
  cmp: ControlCmp;
  t: number;
  /** Anything that makes the comparison weaker than it looks — shown next to it, never dropped. */
  caveats: string[];
}

type MarketRows = BotMarketStatsRow[] | undefined;

/**
 * The control's mean on the bot's market mix: Σ w_m · μ_control,m with w_m = the bot's share
 * of measured picks in market m (se combined the same way). The control is 1x2 + O/U, so
 * comparing an O/U-only arm to the pooled control mean would compare different markets.
 * Falls back to the pooled control (sameMarket=false) when the split is unavailable or the
 * control has fewer than MIN_N measured picks on one of the bot's markets.
 */
export function controlLineFor(botMarkets: MarketRows, c: ControlRef | null): ControlLineRef | null {
  if (!c) return null;
  const pooled: ControlLineRef = { mean: c.mean, se: c.se, sameMarket: false };
  const rows = (botMarkets ?? []).filter((r) => r.market && (r.clv_anchor_n ?? 0) > 0);
  const total = rows.reduce((s, r) => s + Number(r.clv_anchor_n), 0);
  if (!c.byMarket || total === 0) return pooled;
  let mean = 0;
  let var_ = 0;
  for (const r of rows) {
    const cm = c.byMarket.get(r.market as string);
    if (!cm || cm.n < MIN_N || cm.se == null) return pooled;
    const w = Number(r.clv_anchor_n) / total;
    mean += w * cm.mean;
    var_ += w * w * cm.se * cm.se;
  }
  return { mean, se: Math.sqrt(var_), sameMarket: true };
}

/** Forward-test only (§4.2): Δ vs the junk control, t_Δ = Δ / √(se² + se_c²). */
export function controlCompare(
  v: { family: string; metric: MetricValue; sb?: BotScoreboardRow },
  c: ControlRef | null,
  line: ControlLineRef | null,
): ControlComparison | null {
  if (!c || !line || v.family !== "forward_test") return null;
  // No comparison against a control that is itself too thin to read.
  if (c.se == null || line.se == null || (c.n ?? 0) < MIN_N) return null;
  const m = v.metric;
  if (m.metric !== "clv_anchor" || m.mean == null || m.se == null || m.n == null || m.n < MIN_N) return null;
  const se = Math.sqrt(m.se * m.se + line.se * line.se);
  if (!(se > 0)) return null;
  const t = (m.mean - line.mean) / se;
  const caveats: string[] = [];
  const rv = v.sb?.scored_rule_version ?? null;
  if (rv !== c.ruleVersion) {
    caveats.push(`different rule version (control: ${fmtRuleVersion(c.ruleVersion) ?? "none"}, this arm: ${fmtRuleVersion(rv) ?? "none"})`);
  }
  if (!line.sameMarket) caveats.push("control pooled across markets — not the same market mix");
  return { cmp: t >= 2 ? "above" : t <= -2 ? "below" : "equal", t, caveats };
}

// ─── weekly ──────────────────────────────────────────────────────────────────

export interface WeekBucket {
  start: number; // ms, Monday 00:00 UTC
  picks: number;
  clvN: number;
  clvMean: number | null;
}

/** Monday 00:00 UTC of the week containing `t` (Postgres date_trunc('week')). */
export function weekStart(t: number): number {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

/** 12 buckets, oldest first; the family's admissible metric decides the colour. */
export function weekBuckets(rows: BotWeeklyRow[] | undefined, metric: Metric, now: number): WeekBucket[] {
  const cur = weekStart(now);
  const byWeek = new Map<number, BotWeeklyRow>();
  for (const r of rows ?? []) byWeek.set(weekStart(new Date(r.week).getTime()), r);
  const out: WeekBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = cur - i * 7 * 86400000;
    const r = byWeek.get(start);
    const anchor = metric === "clv_anchor";
    out.push({
      start,
      picks: Number(r?.picks ?? 0),
      clvN: metric === "lift" ? 0 : Number((anchor ? r?.clv_anchor_n : r?.clv_mc_n) ?? 0),
      clvMean: metric === "lift" ? null : (anchor ? r?.clv_anchor_mean : r?.clv_mc_mean) ?? null,
    });
  }
  return out;
}

// ─── bot view ────────────────────────────────────────────────────────────────

export interface BotView {
  name: string;
  displayName: string;
  identity: string;
  family: string;
  sb?: BotScoreboardRow;
  cfg?: BotConfigRow;
  caps?: BotCapabilitiesRow;
  metric: MetricValue;
  verdict: Verdict;
  /** Active bot with no pick in 7 days. */
  silent: boolean;
  control: ControlComparison | null;
  /** The junk-control reference drawn on this bot's mc-CLV bar (same market mix when possible). */
  controlLine: ControlLineRef | null;
  weeks: WeekBucket[] | null;
  /** Mean 1/odds over settled picks — the hit rate needed to break even (bot_market_stats). */
  breakEven: number | null;
  /** rule_version gate in bot_config, when it differs from the version being scored. */
  configRuleVersion: string | null;
}

export function isActive(sb: BotScoreboardRow): boolean {
  if (sb.retired_at) return false;
  if (sb.is_active) return true;
  // Forward-test arms and the control have no `bots` row, so is_active is NULL.
  return sb.source === "forward_test" || sb.family === "forward_test" || sb.family === "control";
}

export function buildView(
  name: string,
  sb: BotScoreboardRow | undefined,
  cfg: BotConfigRow | undefined,
  caps: BotCapabilitiesRow | undefined,
  opts: {
    control: ControlRef | null;
    weekly: Map<string, BotWeeklyRow[]> | null;
    markets: Map<string, BotMarketStatsRow[]> | null;
    now: number;
    active: boolean;
  },
): BotView {
  const family = name === CONTROL_BOT ? "control" : familyOf(sb, cfg);
  const metric = metricValue(sb, metricOf(family, cfg));
  const silentByCaps = caps?.writing_7d === false;
  const silentByTime = !caps && sb?.last_pick_at != null && opts.now - new Date(sb.last_pick_at).getTime() > 7 * 86400000;
  const base = {
    name,
    displayName: prettyDisplayName(sb?.display_name, name),
    identity: identityLine(cfg),
    family,
    sb,
    cfg,
    caps,
    metric,
    verdict: verdictOf(metric),
    // a bot that has never picked is "no picks yet" (withUnpickedBots), not a bot that went quiet
    silent: opts.active && (sb?.picks_total ?? 0) > 0 && (silentByCaps || silentByTime),
    weeks: opts.weekly ? weekBuckets(opts.weekly.get(name), metric.metric, opts.now) : null,
  };
  const botMarkets = opts.markets?.get(name);
  const controlLine = metric.metric === "clv_anchor" && name !== CONTROL_BOT ? controlLineFor(botMarkets, opts.control) : null;
  const gateRv = (cfg?.gates ?? []).find((g) => g.name === "rule_version")?.value;
  const configRuleVersion =
    typeof gateRv === "string" && sb?.scored_rule_version && gateRv !== sb.scored_rule_version ? gateRv : null;
  return {
    ...base,
    controlLine,
    control: controlCompare(base, opts.control, controlLine),
    breakEven: breakEvenOf(botMarkets),
    configRuleVersion,
  };
}

function breakEvenOf(rows: MarketRows): number | null {
  let inv = 0;
  let n = 0;
  for (const r of rows ?? []) {
    inv += Number(r.sum_inv_odds ?? 0);
    n += Number(r.odds_n ?? 0);
  }
  return n > 0 ? inv / n : null;
}

export function controlRef(sb: BotScoreboardRow | undefined, markets: BotMarketStatsRow[] | undefined | null): ControlRef | null {
  // [[#159]] / [[#156]]: the forward test is read against the junk control on the SHARP-ANCHOR
  // close (the amended stopping rule), not the own-book mc-CLV.
  if (!sb || sb.clv_anchor_mean == null) return null;
  let byMarket: ControlRef["byMarket"] = null;
  if (markets) {
    byMarket = new Map();
    for (const r of markets) {
      if (!r.market || r.clv_anchor_mean == null || !r.clv_anchor_n) continue;
      const se = r.clv_anchor_sd != null && r.clv_anchor_n >= 2 ? r.clv_anchor_sd / Math.sqrt(r.clv_anchor_n) : null;
      byMarket.set(r.market, { n: r.clv_anchor_n, mean: r.clv_anchor_mean, se });
    }
  }
  return { mean: sb.clv_anchor_mean, se: sb.clv_anchor_se, n: sb.clv_anchor_n, ruleVersion: sb.scored_rule_version, byMarket };
}

/** Within a family: Beats → Loses → Inconclusive → Too early → No CLV, silent last; |t| desc. */
export function sortBots(a: BotView, b: BotView): number {
  if (a.silent !== b.silent) return a.silent ? 1 : -1;
  const va = VERDICT_ORDER.indexOf(a.verdict);
  const vb = VERDICT_ORDER.indexOf(b.verdict);
  if (va !== vb) return va - vb;
  const ta = Math.abs(a.metric.t ?? 0);
  const tb = Math.abs(b.metric.t ?? 0);
  if (ta !== tb) return tb - ta;
  return (b.metric.n ?? b.sb?.picks_total ?? 0) - (a.metric.n ?? a.sb?.picks_total ?? 0);
}

// ─── needs a look (§3) ───────────────────────────────────────────────────────

export interface Issue {
  bot?: string;
  text: string;
  severity: "warn" | "danger";
}

const marketGroup = (m: string) => (/^(o\/?u|over_under)/i.test(m) ? "ou" : m.toLowerCase());

/**
 * A model-paper bot whose probability SOURCE is gone: it prices off the picks of named bots (gate
 * `source_bots`, e.g. ["bot_v10_1x2"] — #162 W4.4; older exports: `source_maturity`, a label list), and no active customer-model bot
 * with that label covers any of its markets any more — so it CANNOT pick. Example (2026-09-24):
 * bot_coolbet_ou_model_v1 reads calibrated O/U picks, and the calibrated O/U bot (bot_v10_ou) was
 * retired. `active` = the active fleet the page shows.
 */
export function sourceRetired(v: BotView, active: BotView[]): boolean {
  const gates = v.cfg?.gates ?? [];
  const byName = gates.find((g) => g.name === "source_bots")?.value;
  const byLabel = gates.find((g) => g.name === "source_maturity")?.value;
  const src = Array.isArray(byName) ? byName : Array.isArray(byLabel) ? byLabel : null;
  if (!src || src.length === 0) return false;
  const want = new Set((v.cfg?.markets ?? []).map(marketGroup));
  if (want.size === 0) return false;
  return !active.some(
    (a) =>
      a.name !== v.name &&
      a.family === "model_sim" &&
      (byName ? src.includes(a.name) : src.includes(a.sb?.maturity_label ?? "")) &&
      (a.cfg?.markets ?? []).some((m) => want.has(marketGroup(m))),
  );
}

/**
 * Silent on purpose — NOT a to-do (#139 UX fix round): its real money is locked off (a
 * coolbet_placer_bots lock) AND its source is retired, so silence is the expected state.
 * Shown as information ("silent (source retired, locked off)"), never counted as an issue.
 */
export function quietByDesign(v: BotView, active: BotView[], lockedBots: ReadonlySet<string> | undefined): boolean {
  return v.silent && !!lockedBots?.has(v.name) && sourceRetired(v, active);
}

/** Information lines for the bots that are silent by design (see quietByDesign). */
export function quietInfo(active: BotView[], lockedBots: ReadonlySet<string> | undefined): { bot: string; text: string }[] {
  return active
    .filter((v) => quietByDesign(v, active, lockedBots))
    .map((v) => ({ bot: v.name, text: `${v.displayName} silent (source retired, locked off)` }));
}

/**
 * `opts.lockedBots` (optional, 2026-09-24): bots whose real-money row is locked
 * (coolbet_placer_bots.locked_reason). With it, a bot that is silent BY DESIGN (locked off and its
 * source retired — quietByDesign) is not reported; without it every silent bot is, as before.
 */
export function needsALook(
  active: BotView[],
  fleet: BotCapabilitiesRow | undefined,
  errors: { view: string; error: string | null }[],
  now: number,
  opts?: { lockedBots?: ReadonlySet<string> },
): Issue[] {
  const out: Issue[] = [];
  for (const e of errors) if (e.error) out.push({ text: `${e.view} unreadable`, severity: "warn" });
  for (const v of active) {
    if (v.caps?.place_enabled && fleet?.fleet_placement_paused === false && v.verdict !== "beats") {
      out.push({ bot: v.name, text: `${v.displayName} stakes real money without a positive verdict`, severity: "danger" });
    }
  }
  for (const v of active) {
    if (!v.silent || quietByDesign(v, active, opts?.lockedBots)) continue;
    out.push({ bot: v.name, text: `${v.displayName} silent · last pick ${timeAgo(v.sb?.last_pick_at, now)}`, severity: "warn" });
  }
  for (const v of active) {
    if (v.family === "unknown") out.push({ bot: v.name, text: `${v.displayName}: its settings are not in the nightly settings list yet`, severity: "warn" });
  }
  return out;
}

// ─── retired ─────────────────────────────────────────────────────────────────

export interface RetiredView {
  view: BotView;
  info?: RetiredInfo;
  retiredAt: string | null;
  hadPicks: boolean;
}

// ─── /picks availability (moved from bot-controls-cell.tsx 2026-09-24, shared with /admin) ───

export function picksUnavailable(v: BotView): { kind: "rule" | "stub"; label: string; text: string; ref?: string } | null {
  if (v.family === "forward_test") {
    return { kind: "rule", label: "By rule", text: "A pre-registered public test: what it publishes was fixed in advance. Changing it means a new rule version, not a click.", ref: "set by the pre-registration (rule version)" };
  }
  if (v.family === "control") return { kind: "rule", label: "Never", text: "The deliberately bad reference bot. It is never published.", ref: "control_junk_anchor" };
  if (v.cfg?.ledger !== "simulated_bets") {
    return { kind: "stub", label: "Private", text: "This bot records its picks in the own-money book, which never reaches customers. Only the customer-model bots can be shown on /picks.", ref: "own-money book (shadow_bets)" };
  }
  return null;
}

export function picksTelegramMismatch(v: BotView, showOnPicks: boolean | null): boolean {
  if (picksUnavailable(v) || showOnPicks == null || v.caps?.telegram == null) return false;
  return showOnPicks !== v.caps.telegram;
}

// ─── registered bots with no picks yet (2026-09-24) ──────────────────────────────────────────
// bot_scoreboard (migration 410) is built FROM bot_ledger, so a bot that is registered, active
// and configured but has not written a pick yet has no row — it was invisible on every admin page.
// That happened to #141's two new 1X2 bots (bot_rating_1x2_v1, bot_combined_1x2_v1) on their first
// day. This adds one zero-count row per such bot so it shows as "no picks yet" instead of missing.
// Only bots with an ACTIVE, NON-RETIRED `bots` row AND a bot_config row qualify.

export function withUnpickedBots(
  rows: BotScoreboardRow[],
  config: BotConfigRow[],
  registry: { name: string; is_active: boolean | null; retired_at: string | null; display_name: string | null; maturity_label: string | null }[],
): BotScoreboardRow[] {
  const have = new Set(rows.map((r) => r.bot_name));
  const cfgBy = new Map(config.map((c) => [c.bot_name, c]));
  const extra: BotScoreboardRow[] = [];
  for (const b of registry) {
    if (have.has(b.name) || !b.is_active || b.retired_at || !cfgBy.has(b.name)) continue;
    extra.push({
      bot_name: b.name, display_name: b.display_name, source: null, is_active: true, retired_at: null,
      maturity_label: b.maturity_label, family: cfgBy.get(b.name)?.family ?? null,
      picks_total: 0, pending: 0, settled: 0, won: 0, lost: 0, void: 0, roi_unit: null,
      clv_mc_n: 0, clv_mc_mean: null, clv_mc_se: null, clv_mc_t: null,
      clv_anchor_n: 0, clv_anchor_mean: null, clv_anchor_se: null, clv_anchor_t: null,
      scored_rule_version: null, earlier_version_picks: 0, clv_outlier_n: 0,
      first_pick_at: null, last_pick_at: null, picks_7d: 0, settled_7d: 0,
    });
  }
  return extra.length ? [...rows, ...extra] : rows;
}

/** [[#155]] owner rule: a bot with >= min_n settled legs whose sharp-anchor CLV 95% interval lies
 *  entirely below 0 gets a "review this bot" item — on /admin/bots and in the Overview inbox. The
 *  owner decides; nothing is retired automatically. ONE helper for both pages. */
export function reviewFlagIssues(
  rows: BotReviewFlagRow[],
  nameOf: (bot: string) => string,
): { bot: string; text: string; severity: "warn" }[] {
  const pct = (x: number | null) => (x == null ? "?" : `${(x * 100).toFixed(1)}%`);
  return rows
    .filter((r) => r.review_flag === true)
    .map((r) => ({
      bot: r.bot_name,
      text: `${nameOf(r.bot_name)}: review this bot — sharp-anchor CLV ${pct(r.clv_public)} (95% upper ${pct(r.clv_public_upper95)}) over ${r.clv_n_public ?? 0} settled`,
      severity: "warn" as const,
    }));
}
