/**
 * Reads for /admin/real-bets — the Real bets money ledger (#139 IA move P5, 2026-09-24).
 *
 * The page used `getRealBets()` from engine-data.ts. This is a page-local copy with two
 * differences, both needed by the IA's jobs for this page:
 *   1. `placed_real` is selected, so unconfirmed hand-logged bets (placed_real IS NULL) can be
 *      shown as a reconciliation to-do, and today's total can split "automatic" from "by hand";
 *   2. it pages past PostgREST's 1,000-row cap (real_bets held 992 rows on 2026-09-24 — the old
 *      single read was about to start silently dropping the oldest bets from every total).
 * Paper rows (placed_real = FALSE, the retired paper daemon) are excluded exactly as before.
 *
 * Promotions moved here from /admin/shadow-bots (IA §2.1: EV vs realised is a money concern).
 */
import { createServerServiceClient } from "@/lib/supabase-server";
import { readAdminFixture } from "@/lib/admin-fixture";
import type { RealBet } from "@/lib/engine-data";
import { MANUAL_RECONCILE_SINCE } from "@/lib/admin-attention";
// Pure helpers live in admin-money-format.ts so the client half of /admin/real-bets can use them
// without importing this module's server-only reads; re-exported here as the one import point.
export { moneyBotLabel } from "@/lib/admin-money-format";

/**
 * Daily blast-radius caps for the AUTOMATED placer. DEFAULTS ONLY — the engine reads
 * COOLBET_MAX_BETS_PER_DAY / COOLBET_MAX_STAKE_PER_DAY from its env
 * (scripts/place_coolbet_ui.py), so these are a reference, labelled as such on the page.
 * Moved from components/shadow-bots/safety-strip.tsx (deleted, #139 P6).
 */
export const DAILY_MAX_BETS = 80;
export const DAILY_MAX_STAKE_EUR = 800;

/**
 * Hand-logged bets before this date predate the account reconciler, so an unconfirmed row
 * from then is history, not a to-do (IA §3: "placed on/after 2026-09-10, older than 24 h").
 * The SAME constant the Overview's attention item counts with, so the bell and this page agree.
 */
export const RECONCILE_FROM = `${MANUAL_RECONCILE_SINCE}T00:00:00Z`;
export const RECONCILE_AFTER_H = 24;

export interface MoneyBet extends RealBet {
  /** TRUE = confirmed against the book account · NULL = hand-logged, not yet confirmed. */
  placedReal: boolean | null;
  /** bots.display_name, raw. Render with `moneyBotLabel()` — `bot` (the id) is secondary text. */
  botDisplayName: string | null;
}


/** One active `promo_terms` row plus its `promo_ledger` aggregates. */
export interface PromoRow {
  id: string;
  book: string;
  promo_type: string;
  title: string;
  boost_pct: number | null;
  boost_applies_to: string | null;
  face_value_eur: number | null;
  stake_returned: boolean | null;
  min_odds: number | null;
  max_stake_eur: number | null;
  min_legs: number | null;
  refund_eur: number | null;
  refund_cash: boolean | null;
  rollover_x: number | null;
  deposit_eur: number | null;
  single_use: boolean | null;
  valid_to: string | null;
  source_url: string | null;
  /** promo_ledger rows pointing at this terms row. */
  taken: number;
  evSum: number;
  /** Σ realised P&L over SETTLED rows only, and how many those were. */
  realisedSum: number;
  settled: number;
  /** Σ EV over the SAME settled rows — the only honest comparand for realised. */
  evSumSettled: number;
}

export interface MoneyData {
  bets: MoneyBet[];
  /** Set when the real_bets read failed — the page says "unreadable", never shows zeros. */
  betsError: string | null;
  promos: PromoRow[];
  /** Set when the promo read failed — "no promos" and "read failed" must not look the same. */
  promoError: string | null;
  loadedAt: string;
}

const PAGE = 1000;
const MAX_PAGES = 5;

const BET_SELECT = `id, match_id, market, selection, bookmaker, captured_odds, actual_odds,
   slippage_pct, edge_pct_taken, clv, clv_pinnacle, closing_bookmaker, closing_minutes_before_ko,
   stake, placed_at, result, pnl, resolved_at, notes, placed_real,
   bot:bot_id(name, display_name),
   paper:simulated_bet_id(stake, pnl, result),
   match:match_id(date,
     home_team:home_team_id(name),
     away_team:away_team_id(name),
     league:league_id(name, country))`;

type One<T> = T | T[] | null | undefined;
const one = <T,>(v: One<T>): T | null => (v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v);
const n = (v: unknown) => (v == null ? null : Number(v));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBet(r: any): MoneyBet {
  const bot = one<{ name: string; display_name: string | null }>(r.bot);
  const m = one<{ home_team: One<{ name: string }>; away_team: One<{ name: string }>; league: One<{ name: string; country: string }> }>(r.match);
  const ht = one(m?.home_team);
  const at = one(m?.away_team);
  const lg = one(m?.league);
  const paper = one<{ stake: number; pnl: number | null; result: string }>(r.paper);
  return {
    id: r.id,
    matchId: r.match_id,
    match: ht && at ? `${ht.name} vs ${at.name}` : "Unknown",
    league: lg ? `${lg.country} / ${lg.name}` : "Unknown",
    bot: bot?.name ?? null,
    market: r.market,
    selection: r.selection,
    bookmaker: r.bookmaker,
    capturedOdds: n(r.captured_odds),
    actualOdds: Number(r.actual_odds),
    slippagePct: n(r.slippage_pct),
    edgePctTaken: n(r.edge_pct_taken),
    clv: n(r.clv),
    clvPinnacle: n(r.clv_pinnacle),
    closingBookmaker: r.closing_bookmaker ?? null,
    closingMinutesBeforeKo: n(r.closing_minutes_before_ko),
    stake: Number(r.stake),
    placedAt: r.placed_at,
    result: r.result,
    pnl: n(r.pnl),
    resolvedAt: r.resolved_at,
    notes: r.notes,
    placedReal: r.placed_real ?? null,
    botDisplayName: bot?.display_name ?? null,
    paper: paper ? { stake: Number(paper.stake), pnl: n(paper.pnl), result: paper.result } : null,
  };
}

async function loadPromos(): Promise<{ promos: PromoRow[]; promoError: string | null }> {
  const db = createServerServiceClient();
  // ONE read — active terms with their ledger rows embedded on promo_ledger.promo_terms_id.
  const { data, error } = await db
    .from("promo_terms")
    .select(
      `id, book, promo_type, title, boost_pct, boost_applies_to, face_value_eur,
       stake_returned, min_odds, max_stake_eur, min_legs, refund_eur, refund_cash,
       rollover_x, deposit_eur, single_use, valid_to, source_url,
       promo_ledger ( ev_eur, realised_pnl_eur, settled_at )`,
    )
    .eq("active", true)
    .order("valid_to", { ascending: true, nullsFirst: false })
    .limit(200);
  type Raw = Record<string, unknown> & {
    promo_ledger: { ev_eur: unknown; realised_pnl_eur: unknown; settled_at: string | null }[] | null;
  };
  const promos = ((data ?? []) as unknown as Raw[]).map((t) => {
    const legs = t.promo_ledger ?? [];
    let evSum = 0;
    let realisedSum = 0;
    let evSumSettled = 0;
    let settled = 0;
    for (const l of legs) {
      const ev = Number(l.ev_eur ?? 0);
      if (Number.isFinite(ev)) evSum += ev;
      if (l.settled_at != null) {
        settled++;
        if (Number.isFinite(ev)) evSumSettled += ev;
        const r = Number(l.realised_pnl_eur ?? 0);
        if (Number.isFinite(r)) realisedSum += r;
      }
    }
    const { promo_ledger: _drop, ...rest } = t;
    void _drop;
    return {
      ...(rest as unknown as PromoRow),
      boost_pct: n(t.boost_pct),
      face_value_eur: n(t.face_value_eur),
      min_odds: n(t.min_odds),
      max_stake_eur: n(t.max_stake_eur),
      refund_eur: n(t.refund_eur),
      rollover_x: n(t.rollover_x),
      deposit_eur: n(t.deposit_eur),
      taken: legs.length,
      evSum,
      realisedSum,
      evSumSettled,
      settled,
    };
  });
  return { promos, promoError: error?.message ?? null };
}

export async function loadMoney(): Promise<MoneyData> {
  const fx = await readAdminFixture<MoneyData>("money");
  if (fx) return fx;

  const db = createServerServiceClient();
  const bets: MoneyBet[] = [];
  let betsError: string | null = null;
  const promosP = loadPromos();
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await db
      .from("real_bets")
      .select(BET_SELECT)
      .not("placed_real", "is", false)
      .order("placed_at", { ascending: false })
      .range(p * PAGE, p * PAGE + PAGE - 1);
    if (error) {
      betsError = error.message;
      break;
    }
    const rows = data ?? [];
    bets.push(...rows.map(mapBet));
    if (rows.length < PAGE) break;
  }
  const { promos, promoError } = await promosP;
  return { bets, betsError, promos, promoError, loadedAt: new Date().toISOString() };
}

/**
 * The recent real-money window — ONE definition shared by /admin/real-bets and the Overview card
 * (UX fix round, 2026-09-24: the two pages showed "last 30 days" and "4 weeks" for the same idea).
 *
 *   • window  = placed_at >= now − days × 24 h (a rolling window, not calendar weeks);
 *   • paper rows (placedReal === false) are excluded — they are not money;
 *   • bets    = every real bet placed in the window, open or settled;
 *   • staked  = the stake of every one of those bets (money put at risk, open included);
 *   • settled / pnl = settled bets only (result present and not "pending") — an open bet has no P/L.
 * Pure: pass `now` in so the page and the Overview compute against the same instant.
 */
export interface RealMoneyWindowRow {
  placedAt: string;
  stake: number | string | null;
  pnl: number | string | null;
  result: string | null;
  placedReal?: boolean | null;
}
export interface RealMoneyWindow {
  days: number;
  /** ISO start of the window. */
  from: string;
  bets: number;
  staked: number;
  settled: number;
  pnl: number;
}
export function realMoneyWindow(rows: RealMoneyWindowRow[], now: number | Date, days: number): RealMoneyWindow {
  const end = typeof now === "number" ? now : now.getTime();
  const from = end - days * 86_400_000;
  let bets = 0;
  let staked = 0;
  let settled = 0;
  let pnl = 0;
  for (const r of rows) {
    if (r.placedReal === false) continue;
    const t = Date.parse(r.placedAt);
    if (!(t >= from)) continue;
    bets++;
    staked += Number(r.stake ?? 0) || 0;
    if (r.result != null && r.result !== "pending") {
      settled++;
      pnl += Number(r.pnl ?? 0) || 0;
    }
  }
  return { days, from: new Date(from).toISOString(), bets, staked, settled, pnl };
}

/** Unconfirmed hand-logged bets the account reconciler has not matched (the to-do list). */
export function unconfirmedToDo(bets: MoneyBet[], now = Date.now()): MoneyBet[] {
  const from = Date.parse(RECONCILE_FROM);
  const cutoff = now - RECONCILE_AFTER_H * 3600_000;
  return bets.filter((b) => {
    const t = Date.parse(b.placedAt);
    return b.placedReal == null && t >= from && t < cutoff;
  });
}
