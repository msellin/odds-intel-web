/**
 * /admin/feeds — pure, client-safe view helpers (#139 UX fix round, 2026-09-24). Re-exported from
 * src/lib/admin-feeds.ts (the server loader). Type-only imports: safe in client components and the Overview.
 */
import type { DataQualityFinding, FeedStatus } from "@/lib/engine-data";

/**
 * The engine's status check (feed_health) runs every 5 min. Older than this, its colours are not a
 * claim we can make: /admin/feeds turns every block and count grey ("unknown"). Lives here, not in
 * the client board, because a server component cannot read a constant out of a "use client" file.
 */
export const STATUS_STALE_MIN = 15;

/**
 * A feed's health as the operator should read it. A feed PAUSED BY THE ENGINE (paused_by = 'auto',
 * the circuit breaker after repeated failures) is an outage, not a pause: it reads "fail" on every
 * surface. 2026-09-25: Unibet-Site was dark 8 h and the Overview showed a calm blue "Paused 1"
 * beside "22/23 fresh". Only an operator's deliberate pause reads "paused".
 */
export function feedHealth(f: { status: string; paused_by?: string | null }): "ok" | "warn" | "fail" | "paused" | "unknown" {
  if (f.status === "paused" && f.paused_by === "auto") return "fail";
  return (["ok", "warn", "fail", "paused", "unknown"].includes(f.status) ? f.status : "unknown") as "ok" | "warn" | "fail" | "paused" | "unknown";
}

/** One row of book_footprint: requests we sent one book in one clock hour, and how many we refused. */
export interface FootprintHour {
  book: string;
  hour: string;
  requests: number;
  refused: number;
  /** Block checks (bot-check / 403 / 429 answers) that hour. Optional: older fixtures lack it. */
  challenges?: number | null;
  errors?: number | null;
}

// ── Request budget, in plain words (#139 UX fix round, 2026-09-24) ─────────────────────────────
//
// feed_health's reason "request budget spent — N requests refused this hour" fired next to
// under-budget numbers (Tonybet 73/150, Coolbet 352/500), because it only looks at THIS hour's
// `refused` counter. Two things put refusals into an hour whose budget was NOT spent:
//   1. footprint.py adds a refusal to the hour in which the counter is FLUSHED, not the hour it
//      happened. Tonybet 2026-09-24: 150/150 at 18:00–19:00, refused at 18:59:57 (VPS log
//      "footprint REFUSED Tonybet: db=150 … cap=150"), recorded under 19:00 (81 requests).
//   2. Coolbet shows 2–22 refusals in most hours at 150–460 of 500, one refusal per error, and no
//      "footprint REFUSED Coolbet" line in the VPS logs — so they come from a process elsewhere
//      counting against a different number. Not a spent shared budget.
// So the page reads book_footprint itself and says which hour actually ran out, when it reset,
// and what this hour stands at. Pure, so it is testable and the Overview can reuse it.

export interface BudgetView {
  book: string;
  cap: number | null;
  /** This clock hour. */
  hourStart: string;
  requests: number;
  refused: number;
  /** true when this hour's requests reached the budget: new requests are refused until resetAt. */
  spentNow: boolean;
  /** Start of the next clock hour (UTC) — when the budget resets. */
  resetAt: string;
  /** The most recent earlier hour (last 24 h) whose requests reached the budget. */
  lastSpent: { hourStart: string; requests: number } | null;
  /** Refusals booked in an hour below budget; `late` = they belong to the spent hour just before. */
  strayRefusals: { n: number; late: boolean } | null;
  /** Block checks and errors this clock hour, from the SAME book_footprint row as `requests`. */
  challenges: number;
  errors: number;
  /** Requests over the last 24 clock hours (book_footprint), for the "in 24 h" line. */
  requests24h: number;
}

const hh = (iso: string) => `${String(new Date(iso).getUTCHours()).padStart(2, "0")}:00`;

export function budgetView(book: string, cap: number | null | undefined, hours: FootprintHour[], now: number): BudgetView {
  const hourStart = new Date(Math.floor(now / 3_600_000) * 3_600_000);
  const key = (iso: string) => Math.floor(new Date(iso).getTime() / 3_600_000);
  const mine = hours.filter((h) => h.book === book);
  const cur = mine.find((h) => key(h.hour) === key(hourStart.toISOString()));
  const c = cap ?? null;
  const requests = cur?.requests ?? 0;
  const refused = cur?.refused ?? 0;
  const spentNow = c != null && requests >= c;
  const earlier = mine
    .filter((h) => key(h.hour) < key(hourStart.toISOString()) && c != null && h.requests >= c && now - new Date(h.hour).getTime() <= 25 * 3_600_000)
    .sort((a, b) => (a.hour < b.hour ? 1 : -1))[0];
  const prevSpent = !!earlier && key(earlier.hour) === key(hourStart.toISOString()) - 1;
  return {
    book,
    cap: c,
    hourStart: hourStart.toISOString(),
    requests,
    refused,
    spentNow,
    resetAt: new Date(hourStart.getTime() + 3_600_000).toISOString(),
    lastSpent: earlier ? { hourStart: new Date(earlier.hour).toISOString(), requests: earlier.requests } : null,
    strayRefusals: !spentNow && refused > 0 ? { n: refused, late: prevSpent } : null,
    challenges: Number(cur?.challenges ?? 0),
    errors: Number(cur?.errors ?? 0),
    requests24h: mine.filter((h) => key(h.hour) > key(hourStart.toISOString()) - 24).reduce((a, h) => a + Number(h.requests ?? 0), 0),
  };
}

/** One or two plain sentences: which window ran out, when it resets, where this hour stands. */
export function budgetSentence(b: BudgetView): string {
  if (b.cap == null) return `${b.requests} requests this hour (no budget set for ${b.book}).`;
  const now = `This hour (${hh(b.hourStart)}–${hh(b.resetAt)} UTC): ${b.requests}/${b.cap}.`;
  if (b.spentNow) {
    return `Hourly limit reached (${b.requests}/${b.cap}) — every further request is refused until it resets at ${hh(b.resetAt)} UTC.`;
  }
  const parts: string[] = [];
  if (b.lastSpent) {
    const end = hh(new Date(new Date(b.lastSpent.hourStart).getTime() + 3_600_000).toISOString());
    parts.push(`The hourly limit was last reached ${hh(b.lastSpent.hourStart)}–${end} UTC (${b.lastSpent.requests}/${b.cap}); it reset at ${end}.`);
  }
  parts.push(now);
  if (b.strayRefusals) {
    parts.push(
      b.strayRefusals.late
        ? `The ${b.strayRefusals.n} refusals booked this hour happened at the end of the hour before and were logged a moment late.`
        : `${b.strayRefusals.n} requests were refused this hour although only ${b.requests} of ${b.cap} are used — the hourly limit is not what refused them (cause not yet known).`,
    );
  }
  return parts.join(" ");
}

/** The engine's reason text for a refusal-only warning ("request budget spent — N requests refused this hour"). */
export const BUDGET_REASON_RE = /^request budget spent/i;

// ── Data-quality groups (#139 UX fix round) ─────────────────────────────────────────────────────
// The four things the checks catch, in the owner's words. The Overview reuses this grouping.
export const DQ_GROUPS = [
  "Price far from the other books",
  "Prices from the wrong match",
  "Home/away or over/under swapped",
  "Results disagree",
] as const;

export function dqGroupLabel(check_name: string): string {
  switch (check_name) {
    case "single_market_off":
      return DQ_GROUPS[0];
    case "wrong_fixture_board":
      return DQ_GROUPS[1];
    case "mirrored_1x2":
    case "swapped_two_way":
      return DQ_GROUPS[2];
    case "results_disagree":
    case "results_corrected":
      return DQ_GROUPS[3];
    default:
      return check_name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  }
}

// ── Answer-first fix round (#139, 2026-09-25) ──────────────────────────────────────────────────
//
// The tester found "348 of 500 this hour" in the top answer and "376/500" in the Coolbet panel:
// the answer read feed_book_stats (written every 5 min), the panel read book_footprint live. Every
// "this hour" figure on /admin/feeds now comes from budgetView() over book_footprint — requests,
// block checks and errors of the same row — and the block-risk answer below is built from it.

/** At or above this many block checks in one hour the risk is High (engine FOOTPRINT_CHALLENGE_MIN). */
export const BLOCK_CHECKS_HIGH = 5;
/** Share of the hourly limit from which the risk is Medium (engine FOOTPRINT_WARN_SHARE). */
export const BLOCK_RISK_SHARE = 0.8;

export interface BlockRisk {
  level: "low" | "medium" | "high" | "unknown";
  tone: "success" | "warning" | "danger" | "neutral";
  /** "Low" · "Medium" · "High" · "Unknown" */
  word: string;
  /** "389 of 500 requests this hour · 0 block checks" */
  sub: string;
}

/**
 * "Coolbet block risk" in one word, for /admin/feeds and the Overview (same rule on both):
 *   Low    — under 80% of the hourly limit and no block check this hour;
 *   Medium — at 80%+ of the limit, or any block check;
 *   High   — at/over the limit, or BLOCK_CHECKS_HIGH+ block checks.
 * Pass budgetView("Coolbet", cap, footprintHours, now) — null when book_footprint is unreadable.
 */
export function coolbetBlockRisk(b: Pick<BudgetView, "requests" | "cap" | "challenges"> | null, stale = false): BlockRisk {
  if (!b || b.cap == null) return { level: "unknown", tone: "neutral", word: "Unknown", sub: "request counts unreadable" };
  const share = b.requests / b.cap;
  const ch = b.challenges ?? 0;
  const sub = `${b.requests.toLocaleString("en-US")} of ${b.cap.toLocaleString("en-US")} requests this hour · ${ch} block check${ch === 1 ? "" : "s"}`;
  // round 6 (2026-09-25): while the feed check is late the page is "unknown" everywhere — a quiet hour
  // may only mean collection stopped, so "Low" is not a claim we can make. High stays High: requests
  // at the limit or block checks are counted facts whatever the check says — and so is Medium (review
  // 2026-09-25: 1–4 block checks read grey "Unknown"); only a would-be "Low" becomes Unknown.
  if (stale && share < BLOCK_RISK_SHARE && ch === 0) return { level: "unknown", tone: "neutral", word: "Unknown", sub: `the feed check is late · ${sub}` };
  if (share >= 1 || ch >= BLOCK_CHECKS_HIGH) return { level: "high", tone: "danger", word: "High", sub };
  if (share >= BLOCK_RISK_SHARE || ch > 0) return { level: "medium", tone: "warning", word: "Medium", sub };
  return { level: "low", tone: "success", word: "Low", sub };
}

/**
 * The engine's reason text in plain words, with this hour's figures taken from `budget` (the same
 * source as the rest of the page) instead of the 5-minute-old copy baked into the text.
 */
export function plainFeedReason(raw: string | null | undefined, budget: BudgetView | null): string | null {
  if (!raw) return null;
  if (BUDGET_REASON_RE.test(raw) && budget) return budgetSentence(budget);
  if (/^\d+\/\d+ requests this hour/.test(raw) && budget && budget.cap != null) {
    // the engine wrote this up to 5 min ago; across the hour turn the live count has already reset
    return budget.requests >= BLOCK_RISK_SHARE * budget.cap
      ? `${budget.requests}/${budget.cap} requests this hour — close to the hourly limit`
      : `Was close to its hourly limit; it has reset (${budget.requests}/${budget.cap} now)`;
  }
  return raw
    .replace(/bot-check answers/gi, "block checks")
    .replace(/\s*\(\d+%\)/g, "")
    .replace(/request budget/gi, "hourly request limit")
    .replace(/\s*—\s*see #\d+/g, "")
    .replace(/\s*\(#\d+[^)]*\)/g, "")
    .trim();
}

// ── Book blocks (moved here from feeds-board.tsx so the page's answer and the blocks agree) ─────

export type FeedTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface BlockDef {
  key: string;
  title: string;
  /** feed whose last-data time is the headline */
  main?: string;
  /** other collectors of this block */
  extra: string[];
  /** infrastructure feeds it depends on */
  deps: string[];
  /** feed_book_stats row */
  statsBook?: string;
  note?: string;
}

export const BOOK_BLOCKS: BlockDef[] = [
  { key: "coolbet", title: "Coolbet", main: "coolbet_prematch", extra: [], deps: ["zone_egress", "flaresolverr"], statsBook: "Coolbet" },
  { key: "epicbet", title: "Epicbet", main: "epicbet_prematch", extra: ["epicbet_inplay"], deps: ["zone_egress"], statsBook: "Epicbet" },
  { key: "unibet", title: "Unibet", main: "unibet_prematch", extra: [], deps: ["unibet_chrome", "zone_egress"], statsBook: "Unibet-Site" },
  { key: "tonybet", title: "Tonybet", main: "tonybet_prematch", extra: ["tonybet_live", "tonybet_results"], deps: ["zone_egress"], statsBook: "Tonybet" },
  {
    key: "betfair", title: "Betfair Exchange", main: "betfair_exchange", extra: [], deps: ["betfair_egress"], statsBook: "Betfair-Exchange",
    note: "Reference only — a second opinion on the fair price, never bet on and never published. Only markets with enough money matched (at least €1,000, prices close together) count as a price.",
  },
];
export const OTHER_BLOCKS: BlockDef[] = [
  {
    key: "api-football", title: "API-Football", main: "af_odds", extra: ["af_closing", "af_live", "af_fixtures"], deps: [], statsBook: "Pinnacle",
    note: "One feed carrying 9 bookmakers' odds, fixtures and live scores. The sharpest bookmaker (Pinnacle) comes from here.",
  },
  {
    key: "closing", title: "Closing prices", main: "direct_close", extra: [], deps: [],
    note: "Only captures when one of our matches kicks off within 15 min, so a gap between kick-offs is normal. Its colour follows the job's health, not the time since the last capture.",
  },
  {
    key: "infra", title: "Infrastructure",
    extra: ["zone_egress", "betfair_egress", "unibet_chrome", "flaresolverr", "scheduler", "database", "data_api", "website", "disk", "memory"],
    deps: [], note: "The server and connections everything above runs on.",
  },
];
/** Blocks that are odds sources ("bookmakers" in the answer) vs support blocks. */
export const isBookBlock = (b: BlockDef) => !!b.statsBook;

/** Minutes past a feed's own schedule before its block turns amber. */
export const FRESH_GRACE_MIN = 10;

/** Minutes a feed's data may age and still be called fresh (green): its schedule + a small grace. */
export function freshLimitMin(f: Pick<FeedStatus, "interval_min">): number {
  return (f.interval_min ?? 30) + FRESH_GRACE_MIN;
}

/** "updates every 30 min" / "every 2 min" / "every 6 h". */
export function everyText(min: number | null | undefined): string | null {
  if (!min) return null;
  return min >= 120 && min % 60 === 0 ? `every ${min / 60} h` : `every ${min} min`;
}

export function statusTone(f: FeedStatus | undefined, stale = false): FeedTone {
  if (!f || stale) return "neutral";
  return ({ ok: "success", warn: "warning", fail: "danger", paused: "info", unknown: "neutral" } as const)[feedHealth(f)];
}

/** The headline colour: age of the last data row against this feed's own schedule. */
export function ageTone(f: FeedStatus | undefined, now: number, stale: boolean): FeedTone {
  if (!f || stale) return "neutral";
  if (f.paused) return f.paused_by === "auto" ? "danger" : "info";
  // Closing capture only writes when a match kicks off within 15 min — colour it by the job's health.
  if (f.kind === "close") return statusTone(f);
  if (!f.last_data_at) return f.health_basis === "data" ? "danger" : statusTone(f);
  const m = (now - new Date(f.last_data_at).getTime()) / 60000;
  const limit = Math.max(f.stale_after_min ?? (f.interval_min ?? 30) * 3, freshLimitMin(f));
  if (m <= freshLimitMin(f)) return "success";
  if (m <= limit) return "warning";
  return "danger";
}

const RANK: Record<FeedTone, number> = { danger: 0, warning: 1, info: 2, neutral: 3, success: 4 };
export const toneRank = (t: FeedTone) => RANK[t];
export function worstTone(tones: FeedTone[]): FeedTone {
  return tones.reduce<FeedTone>((a, t) => (RANK[t] < RANK[a] ? t : a), "success");
}

export interface BlockState {
  def: BlockDef;
  main?: FeedStatus;
  extras: FeedStatus[];
  /** colour of the headline time */
  headTone: FeedTone;
  /** the block's colour: worst of the headline, the main feed's verdict and every extra */
  tone: FeedTone;
  /** plain one-line reason when the block is not green */
  problem: string | null;
}

/**
 * While the feed check is late every colour is grey (unknown) — EXCEPT a book that was ALREADY past
 * its own schedule when the check last looked (round 6, 2026-09-25: "2 h ago · every 60 min" sat grey
 * and calm). Measured from the check's own time (updated_at), not from now: counting the check's delay
 * would turn every book amber the moment the check is late (tried on the 25 Sep fixture: all six books
 * amber at 83 min late), which is alarm without information. "Late when last seen" is a fact.
 */
export function staleLate(f: FeedStatus | undefined): boolean {
  if (!f || f.paused || f.kind === "close" || !f.last_data_at || !f.updated_at) return false;
  return (new Date(f.updated_at).getTime() - new Date(f.last_data_at).getTime()) / 60000 > freshLimitMin(f);
}

export function blockState(def: BlockDef, byId: Map<string, FeedStatus>, now: number, stale: boolean, budget: BudgetView | null): BlockState {
  const main = def.main ? byId.get(def.main) : undefined;
  const extras = def.extra.map((id) => byId.get(id)).filter(Boolean) as FeedStatus[];
  const headTone = def.main
    ? stale && staleLate(main) ? "warning" : ageTone(main, now, stale)
    : worstTone(extras.map((e) => statusTone(e, stale)));
  const tone = stale ? (headTone === "warning" ? "warning" : "neutral") : worstTone([headTone, ...(main ? [statusTone(main)] : []), ...extras.map((e) => statusTone(e))]);
  let problem: string | null = null;
  if (stale && headTone === "warning" && main?.last_data_at) {
    const m = Math.round((now - new Date(main.last_data_at).getTime()) / 60000);
    problem = `Already late when last checked — no new odds for ${m >= 90 ? `${Math.round(m / 60)} h` : `${m} min`}, normally ${everyText(main.interval_min)}`;
  }
  if (!stale && tone !== "success") {
    const raw = main && feedHealth(main) !== "ok" && feedHealth(main) !== "paused"
      ? main.status_reason
      : extras.find((e) => feedHealth(e) === "fail" || feedHealth(e) === "warn")?.status_reason;
    problem = plainFeedReason(raw, budget);
    if (!problem && main && headTone === "warning" && main.last_data_at) {
      const m = Math.round((now - new Date(main.last_data_at).getTime()) / 60000);
      problem = `No new odds for ${m} min — normally ${everyText(main.interval_min)}`;
    }
  }
  return { def, main, extras, headTone, tone, problem };
}

/**
 * THE feeds answer — the Feeds page headline AND the Overview's "Odds feeds" answer (review 2026-09-25:
 * the Overview judged feeds by their reported status only, so a block the board painted red for going
 * quiet read "All 23 running" there). Built from the same block tones the board shows. `hrefBase` is ""
 * on /admin/feeds and "/admin/feeds" elsewhere.
 */
export function feedsAnswer(blocks: BlockState[], unknown: { error: boolean; stale: boolean }, hrefBase = ""): { tone: "danger" | "warning" | "success"; text: string; sub?: string; href: string } {
  if (unknown.error || unknown.stale) {
    // round 6: a book already past its schedule stays amber while the check is late (staleLate) — name it
    const late = unknown.error ? [] : blocks.filter((b) => b.tone === "warning");
    return {
      tone: "warning",
      text: unknown.stale && !unknown.error ? "Can't tell — the feed check itself is late" : "Can't tell — feed status unreadable",
      sub: late.length ? `${late.map((b) => b.def.title).join(", ")} ${late.length === 1 ? "was" : "were"} already late when last checked` : undefined,
      href: late.length ? `${hrefBase}#book-${late[0].def.key}` : hrefBase || "#",
    };
  }
  const red = blocks.filter((b) => b.tone === "danger");
  const amber = blocks.filter((b) => b.tone === "warning");
  const grey = blocks.filter((b) => b.tone === "neutral" && isBookBlock(b.def) && !b.main && b.extras.length === 0);
  const names = (bs: BlockState[]) => bs.map((b) => b.def.title).join(", ");
  if (red.length) return { tone: "danger", text: `${names(red)} ${red.length === 1 ? "has" : "have"} stopped`, sub: red[0].problem ?? undefined, href: `${hrefBase}#book-${red[0].def.key}` };
  if (amber.length) return { tone: "warning", text: `${names(amber)} ${amber.length === 1 ? "needs" : "need"} a look`, sub: amber[0].problem ?? undefined, href: `${hrefBase}#book-${amber[0].def.key}` };
  if (grey.length) return { tone: "warning", text: `Can't tell for ${names(grey)} — no status reported`, href: `${hrefBase}#book-${grey[0].def.key}` };
  const nBooks = blocks.filter((b) => isBookBlock(b.def)).length;
  return { tone: "success", text: "All running", sub: `${nBooks} bookmakers + ${blocks.length - nBooks} data sources`, href: hrefBase || "#" };
}

/** Every block on the board, with the budget view of its book where it has one. */
export function allBlockStates(feeds: FeedStatus[], budgets: Map<string, BudgetView>, now: number, stale: boolean): BlockState[] {
  const byId = new Map(feeds.map((f) => [f.feed_id, f]));
  return [...BOOK_BLOCKS, ...OTHER_BLOCKS].map((b) => blockState(b, byId, now, stale, b.statsBook ? budgets.get(b.statsBook) ?? null : null));
}

// ── Plain market / data-quality wording ─────────────────────────────────────────────────────────

/** "ah:-0.75" → "Handicap −0.75", "over_under_25" → "Over/under 2.5 goals", "1x2" → "Match result". */
export function marketLabel(code: string): string {
  const c = code.trim().toLowerCase();
  let m = /^ah:([+-]?)([\d.]+)$/.exec(c);
  if (m) return Number(m[2]) === 0 ? "Handicap 0" : `Handicap ${m[1] === "-" ? "−" : "+"}${m[2]}`;
  m = /^(?:over_under|ou)_?(\d)(\d)$/.exec(c);
  if (m) return `Over/under ${m[1]}.${m[2]} goals`;
  if (/^(1x2|match_winner|h2h)$/.test(c)) return "Match result";
  if (/^btts/.test(c)) return "Both teams score";
  if (/^(dc|double_chance)/.test(c)) return "Double chance";
  if (/^dnb|draw_no_bet/.test(c)) return "Draw no bet";
  return code.replace(/_/g, " ");
}

/** "away 1.25 vs 4-book median 1.54 (15 pp > 15)" → "away 1.25, other books 1.54". */
function plainOffense(market: string, text: string): string {
  const m = /^(\w+)\s+([\d.]+)\s+vs\s+(\d+)-book median\s+([\d.]+)/.exec(text);
  return m ? `${marketLabel(market)}: ${m[1]} ${m[2]}, other books ${m[4]}` : `${marketLabel(market)}: ${text}`;
}

/** One finding's detail in plain words (no "pp", no "median", no market codes). */
export function dqDetail(f: Pick<DataQualityFinding, "check_name" | "detail">): string {
  const d = (f.detail ?? {}) as Record<string, unknown>;
  if (f.check_name === "results_disagree" || f.check_name === "results_corrected") {
    const fixed = d.verdict === "corrected" || f.check_name === "results_corrected";
    return `${d.match ?? "A match"}: API-Football ${d.api_football ?? "?"}, Tonybet ${d.tonybet ?? "?"}${fixed ? " — corrected" : ""}`;
  }
  if (f.check_name === "mirrored_1x2") return "Home and away prices were the wrong way round";
  const off = d.offenses as unknown;
  if (Array.isArray(off) && off.length) {
    return off.map((o) => (Array.isArray(o) ? plainOffense(String(o[0]), String(o[1])) : marketLabel(String(o)))).join(" · ");
  }
  if (Array.isArray(d.markets)) return (d.markets as unknown[]).map((x) => marketLabel(String(x))).join(" · ");
  return "";
}

/** The check already dealt with it: rows set aside (reversible), or a result corrected. */
export function dqHandled(f: Pick<DataQualityFinding, "check_name" | "detail" | "rows_moved">): boolean {
  const d = (f.detail ?? {}) as Record<string, unknown>;
  return (f.rows_moved ?? 0) > 0 || f.check_name === "results_corrected" || d.verdict === "corrected";
}

/** Internal book ids → the names the owner knows. */
export const BOOK_NAME: Record<string, string> = { "Unibet-Site": "Unibet", "Betfair-Exchange": "Betfair", "Epicbet-inplay": "Epicbet (in-play)" };

export interface DqProblem {
  key: string;
  group: string;
  book: string;
  matchId: string | null;
  first: string;
  last: string;
  /** How many times the checks found it (they re-run every 30 min). */
  times: number;
  rows: number;
  handled: boolean;
  detail: string;
}

/**
 * DISTINCT problems: the same match + book + check found again on every 30-min re-check is ONE
 * problem, not 12 (the tester read "74 in 24 h" when it was a handful). Input newest first or any order.
 */
export function dqProblems(findings: DataQualityFinding[]): DqProblem[] {
  const by = new Map<string, DqProblem>();
  for (const f of findings) {
    const group = dqGroupLabel(f.check_name);
    // a results mismatch is one problem per match, whichever source it is booked under
    const key = group === DQ_GROUPS[3] ? `${group}|${f.match_id ?? f.id}` : `${group}|${f.match_id ?? f.id}|${f.bookmaker ?? ""}`;
    const p = by.get(key);
    if (!p) {
      by.set(key, {
        key, group, book: BOOK_NAME[f.bookmaker ?? ""] ?? f.bookmaker ?? "—", matchId: f.match_id, first: f.found_at, last: f.found_at, times: 1,
        rows: f.rows_moved ?? 0, handled: dqHandled(f), detail: dqDetail(f),
      });
    } else {
      p.times += 1;
      p.rows += f.rows_moved ?? 0;
      p.handled = p.handled || dqHandled(f);
      if (f.found_at < p.first) p.first = f.found_at;
      if (f.found_at > p.last) {
        p.last = f.found_at;
        p.detail = dqDetail(f) || p.detail;
      }
    }
  }
  return [...by.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}

// ── ONE odds-problem count (round 6, 2026-09-25) ─────────────────────────────────────────────────
// Feeds said "12 in 24 h … no action needed" while the Overview said "14 … worth a look": the
// Overview counted per raw check over a 24 h read, the page per problem over a 7-day read. The rule
// is now these two functions, over the SAME read (loadDqFindings in admin-feeds.ts, 7 days):
//   count     = distinct problems (dqProblems) whose LAST sighting is in the last 24 h;
//   needsLook = any of those the checks did not set aside or correct themselves (dqHandled).
// No size threshold: 30 problems all set aside need nothing; one not set aside needs a look.

/** How many days of findings every surface reads — the problems table covers exactly this. */
export const DQ_WINDOW_D = 7;

/** Problems whose last sighting is in the last 24 h (older rows stay in the 7-day table, never in this count). */
export function dqLast24h(problems: DqProblem[], now: number): DqProblem[] {
  return problems.filter((p) => now - new Date(p.last).getTime() < 86_400_000);
}

export function dqAdvice(problems: DqProblem[], now: number): { count: number; open: number; needsLook: boolean; text: string } {
  const day = dqLast24h(problems, now);
  const open = day.filter((p) => !p.handled).length;
  const n = day.length;
  const what = `${n} odds problem${n === 1 ? "" : "s"} in the last 24 h`;
  if (n === 0) return { count: 0, open: 0, needsLook: false, text: "No odds problems in the last 24 h" };
  if (open) return { count: n, open, needsLook: true, text: `${what} — ${open} not set aside automatically, needs a look` };
  return { count: n, open: 0, needsLook: false, text: `${what} — all set aside automatically, no action needed` };
}
