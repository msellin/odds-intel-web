// /admin/bots — pure formatting helpers (#139, bots-board-ux-spec §7).
//
// Every raw config string the export writes (markets, books, edge floors, gate names,
// rule versions) is turned into something an operator can read at a glance here, so
// the row never shows machine text like "0.03 (multiplicative P x odds - 1)", a bare "*"
// or "over_under_25". No React in this file — easy to reason about and to test.

import type { BotConfigRow, BotGate } from "@/lib/bot-board";
import { relSpan, timeAgo } from "@/lib/rel-time";

export const MINUS = "−";

// ─── numbers ─────────────────────────────────────────────────────────────────

const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/** Fraction → signed percent, 1 dp, true minus sign: 0.025 → "+2.5%". */
export function pct(v: number | null | undefined, dp = 1): string {
  if (!finite(v)) return "—";
  const s = (Math.abs(v) * 100).toFixed(dp);
  if (Number(s) === 0) return `${(0).toFixed(dp)}%`;
  return `${v < 0 ? MINUS : "+"}${s}%`;
}

/** Fraction → unsigned percent for floors: 0.03 → "3%", 0.125 → "12.5%". */
export function pctPlain(v: number): string {
  const x = Math.round(v * 1000) / 10;
  return `${Number.isInteger(x) ? x.toFixed(0) : x.toFixed(1)}%`;
}

/** CI half-width in pp, no % sign: se 0.007 → "±1.4". */
export function ciHalf(se: number | null | undefined): string {
  if (!finite(se)) return "";
  return `±${(1.96 * se * 100).toFixed(1)}`;
}

/** t statistic, 1 dp, true minus: −4.127 → "t −4.1". */
export function tStat(t: number | null | undefined): string {
  if (!finite(t)) return "t —";
  return `t ${t < 0 ? MINUS : ""}${Math.abs(t).toFixed(1)}`;
}

export const count = (v: number | null | undefined) => (finite(v) ? v.toLocaleString("en-GB") : "—");

export const odds2 = (v: number | null | undefined) => (finite(v) ? Number(v).toFixed(2) : "—");

// ─── time ────────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayMonth(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function utcStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function hhmmUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${d.toISOString().slice(11, 16)} UTC`;
}

/** Minutes since `iso` (null when unknown). */
export function minutesAgo(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : (now - t) / 60000;
}

/** "just now" · "25 min" · "6 h" · "2 d" · "12 Sep" — a DURATION. Delegates to the shared
 *  src/lib/rel-time.ts (one format for every admin page). For a moment use `timeAgo`, which adds
 *  " ago" only where it reads right (never "12 Sep ago"). */
export function relTime(iso: string | null | undefined, now: number): string {
  return relSpan(iso, now);
}
export { timeAgo };

export function monthLabel(iso: string | null | undefined): string {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  const full = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${full[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ─── identity ────────────────────────────────────────────────────────────────

const TOKEN: Record<string, string> = {
  "1x2": "1×2", ou: "O/U", o: "O", btts: "BTTS", dc: "DC", dnb: "DNB", ah: "AH", clv: "CLV",
  inplay: "in-play", afctl: "AF control", "1h": "1H", ou35: "O/U 3.5", ou15: "O/U 1.5",
};

/** `bot_trigger_1x2_sharp_tight_v1` → "Trigger 1×2 sharp tight". */
export function humaniseBotName(name: string): string {
  const parts = name.replace(/^bot_/, "").replace(/_v\d+$/, "").split("_").filter(Boolean);
  const words = parts.map((p) => TOKEN[p.toLowerCase()] ?? p);
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Display names from the DB write "1x2"; show the proper "1×2". */
export function prettyDisplayName(display: string | null | undefined, name: string): string {
  if (!display) return humaniseBotName(name);
  return display.replace(/\b1x2\b/gi, "1×2");
}

function marketOne(m: string): string {
  const k = m.toLowerCase();
  const line = /^(?:over_under_|ou)(\d)(\d)$/.exec(k);
  if (line) return `O/U ${line[1]}.${line[2]}`;
  if (k === "1x2") return "1×2";
  if (k === "1x2_1h") return "1H 1×2";
  if (k === "o/u" || k === "ou") return "O/U";
  if (k === "btts") return "BTTS";
  if (k === "dc") return "Double chance";
  if (k === "dnb") return "Draw no bet";
  if (k === "ah") return "Asian handicap";
  if (k.startsWith("corners_ou")) return "Corners O/U";
  if (k.startsWith("team_total_home")) return "Home team total";
  if (k.startsWith("team_total_away")) return "Away team total";
  return m.replace(/_/g, " ");
}

/** ['o/u','over_under_25','over_under_35'] → "O/U 2.5 + 3.5". */
export function fmtMarkets(markets: string[] | null | undefined): string {
  if (!markets || markets.length === 0) return "";
  const labels = markets.map(marketOne);
  const lines = labels.filter((l) => /^O\/U \d\.\d$/.test(l)).map((l) => l.slice(4));
  const rest = labels.filter((l) => !/^O\/U( \d\.\d)?$/.test(l));
  const bareOu = labels.includes("O/U");
  const out = [...new Set(rest)];
  if (lines.length) out.push(`O/U ${[...new Set(lines)].join(" + ")}`);
  else if (bareOu) out.push("O/U");
  // 1×2 first, it reads most naturally
  out.sort((a, b) => (a === "1×2" ? -1 : b === "1×2" ? 1 : 0));
  return out.join(" + ");
}

function bookOne(b: string): string {
  if (b === "api-football-live") return "API-Football live feed";
  return b.replace(/-Site$/, "");
}

function excludedBooks(gates: BotGate[] | null | undefined): string[] | null {
  const g = (gates ?? []).find((x) => x.name.startsWith("books_excluded"));
  if (!g || !Array.isArray(g.value)) return null;
  return (g.value as unknown[]).map(String);
}

export function fmtBooksShort(cfg: BotConfigRow | undefined): string {
  const b = cfg?.books;
  if (!b || b.length === 0) return "";
  if (b.includes("*")) {
    const ex = excludedBooks(cfg?.gates);
    // "any book except 9" read as a riddle; the 9 are non-bookmaker feeds, listed in the detail view.
    return ex ? "all publishable books" : "any book";
  }
  return b.map(bookOne).join(", ");
}

export function fmtBooksLong(cfg: BotConfigRow | undefined): { summary: string; list: string[] | null } {
  const b = cfg?.books;
  if (!b || b.length === 0) return { summary: "Not described by the export", list: null };
  if (b.includes("*")) {
    const ex = excludedBooks(cfg?.gates);
    if (ex) return { summary: `Any book except ${ex.length}`, list: ex.map(bookOne) };
    return { summary: "Any book (see source)", list: null };
  }
  return { summary: b.map(bookOne).join(", "), list: null };
}

// ─── edge floor ──────────────────────────────────────────────────────────────

export type Floor =
  | { kind: "none" }
  | { kind: "flat"; value: number }
  | { kind: "selection"; lines: { label: string; value: number }[] }
  | { kind: "tiered"; tables: { label: string | null; cols: string[]; rows: { tier: string; cells: (number | null)[] }[] }[] }
  | { kind: "raw"; text: string };

const COL_LABEL: Record<string, string> = {
  "1x2_fav": "Favourite", "1x2_long": "Long shot", ou: "O/U", btts: "BTTS", dc: "Double chance", dnb: "DNB", ah: "AH",
};
export const floorColLabel = (k: string) => COL_LABEL[k] ?? k;

export function parseFloor(raw: string | null | undefined): Floor {
  if (raw == null || raw.trim() === "" || raw.trim().toLowerCase() === "none") return { kind: "none" };
  const s = raw.trim();
  const flat = /^(-?\d*\.?\d+)(\s*\(.*\))?$/.exec(s);
  if (flat) return { kind: "flat", value: Number(flat[1]) };
  const sel = /^selection-aware:\s*home at odds\s*>=\s*([\d.]+)\s*->\s*([\d.]+),\s*else\s*([\d.]+)$/i.exec(s);
  if (sel) {
    return {
      kind: "selection",
      lines: [
        { label: `Home at odds ≥ ${Number(sel[1]).toFixed(2)}`, value: Number(sel[2]) },
        { label: "Otherwise", value: Number(sel[3]) },
      ],
    };
  }
  if (/\bT\d\b/.test(s)) {
    const tables: Extract<Floor, { kind: "tiered" }>["tables"] = [];
    for (const seg of s.split("|")) {
      const m = /^\s*(?:([^:]+):)?\s*(.*)$/.exec(seg);
      if (!m) return { kind: "raw", text: s };
      const label = m[1]?.trim() || null;
      const cols: string[] = [];
      const rowMap = new Map<string, Map<string, number>>();
      for (const part of m[2].split(";")) {
        const toks = part.trim().split(/\s+/).filter(Boolean);
        if (toks.length === 0) continue;
        const tier = toks[0];
        if (!/^T\d$/.test(tier) || toks.length % 2 !== 1) return { kind: "raw", text: s };
        const cells = rowMap.get(tier) ?? new Map<string, number>();
        for (let i = 1; i < toks.length; i += 2) {
          const v = Number(toks[i + 1]);
          if (!Number.isFinite(v)) return { kind: "raw", text: s };
          if (!cols.includes(toks[i])) cols.push(toks[i]);
          cells.set(toks[i], v);
        }
        rowMap.set(tier, cells);
      }
      const rows = [...rowMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([tier, cells]) => ({ tier, cells: cols.map((c) => cells.get(c) ?? null) }));
      tables.push({ label, cols, rows });
    }
    return { kind: "tiered", tables };
  }
  return { kind: "raw", text: s };
}

function range(vals: number[]): string {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  return lo === hi ? pctPlain(lo) : `${pctPlain(lo).replace("%", "")}–${pctPlain(hi)}`;
}

/** Row text: "edge ≥ 3%", "edge ≥ 10–13%", "edge ≥ 3–12% by tier"; "" for no floor.
 *  `unit` "ev" (#155, 2026-09-25): the floor is expected value p × odds − 1, so it reads "EV ≥ 5%";
 *  a tiered floor with ONE value across tiers is flat and does not say "by tier". */
export function floorShort(f: Floor, unit: "edge" | "EV" = "edge"): string {
  switch (f.kind) {
    case "none":
      return "";
    case "flat":
      return f.value <= 0 ? `any ${unit}` : `${unit} ≥ ${pctPlain(f.value)}`;
    case "selection":
      return `${unit} ≥ ${range(f.lines.map((l) => l.value))}`;
    case "tiered": {
      const vals = f.tables.flatMap((t) => t.rows.flatMap((r) => r.cells.filter((c): c is number => c != null)));
      if (!vals.length) return "custom floor";
      return Math.min(...vals) === Math.max(...vals)
        ? `${unit} ≥ ${range(vals)}`
        : `${unit} ≥ ${range(vals)} by tier`;
    }
    case "raw":
      return "custom floor";
  }
}

export function fmtOddsBand(min: number | null | undefined, max: number | null | undefined): string {
  const lo = finite(min) && min > 1.01 ? min : null;
  const hi = finite(max) ? max : null;
  if (lo != null && hi != null) return `odds ${lo.toFixed(2)}–${hi.toFixed(2)}`;
  if (hi != null) return `odds ≤ ${hi.toFixed(2)}`;
  if (lo != null) return `odds ≥ ${lo.toFixed(2)}`;
  return "";
}

/** "EV" when the bot's floor is expected value (pipeline `edge_unit: "ev"`, exported as a gate). */
export function edgeUnit(cfg: BotConfigRow | undefined): "edge" | "EV" {
  const g = (cfg?.gates ?? []).find((x) => x.name === "edge_unit");
  return g?.value === "ev" ? "EV" : "edge";
}

/** The row's line 2: "1×2 · any book · edge ≥ 3% · odds ≤ 4.00". */
export function identityLine(cfg: BotConfigRow | undefined): string {
  if (!cfg) return "";
  const parts = [
    fmtMarkets(cfg.markets),
    fmtBooksShort(cfg),
    floorShort(parseFloor(cfg.edge_floor), edgeUnit(cfg)),
    fmtOddsBand(cfg.odds_min, cfg.odds_max),
  ].filter(Boolean);
  return parts.join(" · ");
}

// ─── rule version ────────────────────────────────────────────────────────────

/** `sharp_edge_v4_2026_09_15` → "v4 · 15 Sep". */
export function fmtRuleVersion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = /_v(\d+)/.exec(raw)?.[1];
  const d = /(\d{4})_(\d{2})_(\d{2})/.exec(raw);
  const date = d ? dayMonth(new Date(Date.UTC(+d[1], +d[2] - 1, +d[3]))) : null;
  if (v && date) return `v${v} · ${date}`;
  if (v) return `v${v}`;
  return raw;
}

// ─── gates ───────────────────────────────────────────────────────────────────

const GATE_LABEL: Record<string, string> = {
  min_edge_multiplicative: "Min edge",
  edge_floor: "Edge floor",
  edge_min: "Min edge",
  edge_ceiling: "Max edge",
  consensus_max_edge: "Max consensus edge",
  max_odds: "Max odds",
  odds_max: "Max odds",
  odds_min: "Min odds",
  odds_floor: "Odds floor",
  odds_ceiling: "Odds ceiling",
  odds_range: "Odds range",
  odds_band: "Odds band",
  price_cap: "Price cap",
  anchor_bet_quote_align_min: "Anchor/bet quote alignment",
  max_price_ratio_vs_anchor: "Max price ratio vs anchor",
  max_anchor_overround: "Max anchor overround",
  book_quote_max_age_min: "Max quote age",
  odds_max_age_hours: "Max odds age",
  odds_max_lag_hours: "Max odds lag",
  lookahead_h: "Look-ahead",
  min_lead_min: "Min lead before kickoff",
  min_prob: "Min probability",
  consensus_min_books: "Min books in consensus",
  devig_methods_all_must_clear: "De-vig methods that must all clear",
  require_pinnacle: "Requires Pinnacle",
  requires_no_pinnacle_price: "Requires no Pinnacle price",
  live_price_verify_min_edge: "Live price re-check edge",
  public_telegram_if_maturity_calibrated: "Telegram once active", // legacy key name — CALIBRATED merged into ACTIVE ([[#175]])
  tier_filter: "League tier filter",
  league_tiers: "League tiers",
  league_filter: "League filter",
  retirement_check: "Retirement check",
  outlier_cap_max_odds_mult: "Outlier cap (× odds)",
  own_outlier_mult_vs_anchor: "Own-price outlier cap vs anchor",
  source_maturity: "Source maturity",
  source_bots: "Source bots",
};

export function gateLabel(name: string): string {
  const base = name.replace(/\s*\(.*\)$/, "");
  if (GATE_LABEL[base]) return GATE_LABEL[base];
  const s = base.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const PCT_GATE = /(edge|overround)/i;

export function gateValue(name: string, v: unknown): string {
  if (v == null) return "none";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") {
    if (PCT_GATE.test(name) && Math.abs(v) < 1) return pctPlain(v);
    if (/_min$/.test(name)) return `${v} min`;
    if (/(_h|_hours)$/.test(name)) return `${v} h`;
    if (/odds|price_cap/.test(name)) return v.toFixed(2);
    return String(v);
  }
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    if (/odds_(range|band)/.test(name) && v.length === 2) return `${v[0] ?? "any"} – ${v[1] ?? "any"}`;
    return v.map((x) => (typeof x === "object" && x !== null ? compact(x) : String(x))).join(", ");
  }
  if (typeof v === "object") return compact(v as Record<string, unknown>);
  return String(v);
}

function compact(o: object): string {
  return Object.entries(o)
    .map(([k, x]) => `${k}: ${typeof x === "object" && x !== null ? JSON.stringify(x) : String(x)}`)
    .join(" · ");
}

/** Gates already shown as fact cards — hidden from the gate list. */
export const GATES_SHOWN_ABOVE = new Set([
  "max_odds", "odds_band", "odds_range", "min_edge_multiplicative", "rule_version", "markets",
]);
export const isShownAbove = (name: string) => GATES_SHOWN_ABOVE.has(name) || name.startsWith("books_excluded");
