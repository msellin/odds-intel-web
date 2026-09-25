/**
 * ONE ROI + CLV DEFINITION ([[#159]], 2026-09-25, owner-approved) — the ONLY web reader of
 * per-bot figures for /performance. Server-only (service client): the views are PRIVATE
 * (migration 433, no anon grant — #072).
 *
 * Every number comes from the engine view `bot_performance` (per bot) or `bot_ledger_display`
 * (per leg). No page computes its own ROI or CLV — that is how the same bot read +5.2% on
 * /performance and +13.4% on /admin/bots. /admin/bots reads `bot_scoreboard`, which is a
 * projection of the SAME view (smoke ONE-ROI-CLV-PARITY).
 *
 * PUBLIC basis (what this page shows): FLAT EUR 10 per pick at the best price AVAILABLE when
 * the pick was made on ALL publishable books (`odds_at_pick_available`). CLV = the pick's price
 * against the sharp-anchor close (fresh de-vigged Pinnacle, else a 5+-book consensus). The OWN
 * basis ("at our books", `odds_at_pick_live`) is /admin/bots' — never shown here.
 *
 * Units: ROI / CLV are FRACTIONS (0.081 = +8.1%). P&L is EUR at the flat stake.
 */
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

// Service client built here rather than imported from supabase-server: engine-data.ts (which a
// client component imports for constants) reaches this module, and supabase-server pulls in
// next/headers, which a client bundle cannot contain. Same env as createServerServiceClient.
function createServerServiceClient() {
  const url = process.env.NEXT_PUBLIC_POSTGREST_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.POSTGREST_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/** Flat stake every /performance figure is stated at (the header says so). */
export const PERF_FLAT_STAKE_EUR = 10;
/** Chart origin for every bot — flat stakes, so every bot starts from the same bankroll. */
export const PERF_START_BANKROLL = 1000;

export interface BotPerformance {
  bot: string;
  picksTotal: number;
  pending: number;
  settled: number;
  won: number;
  lost: number;
  /** Flat-unit P&L at the public price. */
  pnlUnits: number;
  /** Mean flat return at the public price (fraction). */
  roi: number | null;
  /** Settled legs priced at the recorded odds for want of any quote at pick time. */
  nRecordedPrice: number;
  /** SECONDARY: the bot's own stakes at the same price (fraction). */
  roiStaked: number | null;
  /** Sharp-anchor CLV (fraction) + its n and source mix. */
  clv: number | null;
  clvN: number;
  clvNPinnacle: number;
  clvNConsensus: number;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

async function _getBotPerformance(): Promise<Record<string, BotPerformance>> {
  const db = createServerServiceClient();
  const { data, error } = await db
    .from("bot_performance")
    .select(
      "bot_name, picks_total, pending, settled, won, lost, pnl_units_public, roi_public, n_public_recorded, roi_staked, clv_public, clv_n, clv_n_pinnacle, clv_n_consensus",
    )
    .limit(5000);
  if (error || !data) {
    console.error("[getBotPerformance] bot_performance read failed:", error?.message ?? "no data");
    return {};
  }
  const out: Record<string, BotPerformance> = {};
  for (const r of data as Record<string, unknown>[]) {
    const bot = String(r.bot_name);
    out[bot] = {
      bot,
      picksTotal: num(r.picks_total),
      pending: num(r.pending),
      settled: num(r.settled),
      won: num(r.won),
      lost: num(r.lost),
      pnlUnits: num(r.pnl_units_public),
      roi: numOrNull(r.roi_public),
      nRecordedPrice: num(r.n_public_recorded),
      roiStaked: numOrNull(r.roi_staked),
      clv: numOrNull(r.clv_public),
      clvN: num(r.clv_n),
      clvNPinnacle: num(r.clv_n_pinnacle),
      clvNConsensus: num(r.clv_n_consensus),
    };
  }
  return out;
}

/** Per-bot figures, keyed by bot name. 2-minute cache (the view is ~0.2 s). */
export const getBotPerformance = unstable_cache(_getBotPerformance, ["getBotPerformance_v1"], {
  revalidate: 120,
});

/** One leg as the /performance detail view and the history table render it. */
export interface BotLeg {
  id: string;
  bot: string;
  match: string;
  league: string;
  placedAt: string;
  market: string;
  selection: string;
  /** The PUBLIC price (best available at pick time, all books). */
  odds: number;
  result: string;
  /** EUR at the flat stake, 0 while pending. */
  pnl: number;
  /** Sharp-anchor CLV of this leg at the public price (fraction), null if no fresh close. */
  clv: number | null;
  clvSource: "pinnacle" | "consensus" | null;
  modelProb: number | null;
  /** The bot's own stake — Elite only. */
  stake: number | null;
  /** Model / sharp edge at pick time — Elite only. */
  edge: number | null;
  strategyProfile: string | null;
}

const LEG_COLUMNS =
  "pick_id, bot_name, home_team, away_team, league, country, pick_time, market, selection, odds_public, result, pnl_unit_public, clv_anchor_public, clv_anchor_source, model_prob, stake, edge, strategy_profile";

function toLeg(r: Record<string, unknown>, isElite: boolean): BotLeg {
  const clv = numOrNull(r.clv_anchor_public);
  return {
    id: String(r.pick_id),
    bot: String(r.bot_name),
    match: `${r.home_team ?? "?"} vs ${r.away_team ?? "?"}`,
    league: r.league ? `${r.country ?? ""}${r.country ? " / " : ""}${r.league}` : "—",
    placedAt: String(r.pick_time ?? ""),
    market: String(r.market ?? ""),
    selection: String(r.selection ?? ""),
    odds: num(r.odds_public),
    result: String(r.result ?? "pending"),
    pnl: num(r.pnl_unit_public) * PERF_FLAT_STAKE_EUR,
    // |clv| > 1 is a data fault (the view's own guard) — never shown as a number
    clv: clv != null && Math.abs(clv) <= 1 ? clv : null,
    clvSource: (r.clv_anchor_source as BotLeg["clvSource"]) ?? null,
    modelProb: numOrNull(r.model_prob),
    stake: isElite ? numOrNull(r.stake) : null,
    edge: isElite ? numOrNull(r.edge) : null,
    strategyProfile: (r.strategy_profile as string | null) ?? null,
  };
}

const SETTLED = ["won", "lost", "void", "push"];

/**
 * One bot's record legs (the SAME legs its row is computed from), newest first.
 * `settledOnly` — VIP / hide_pending bots: their pending picks are the paid product and must
 * never reach a browser before kickoff (RLS on simulated_bets hides them from anon too; this
 * reads with service_role, so the filter here is what keeps them private).
 */
export async function getBotLegs(
  bot: string,
  opts: { settledOnly: boolean; isElite: boolean; limit?: number },
): Promise<BotLeg[]> {
  const db = createServerServiceClient();
  let q = db
    .from("bot_ledger_display")
    .select(LEG_COLUMNS)
    .eq("bot_name", bot)
    .eq("in_record", true);
  if (opts.settledOnly) q = q.in("result", SETTLED);
  const { data, error } = await q
    .order("pick_time", { ascending: false })
    .order("pick_id", { ascending: false })
    .limit(opts.limit ?? 5000);
  if (error || !data) {
    console.error("[getBotLegs] read failed:", error?.message ?? "no data");
    return [];
  }
  return (data as Record<string, unknown>[]).map((r) => toLeg(r, opts.isElite));
}

/**
 * The /performance history table (logged-in): the public cohort's legs, same per-leg
 * definition as the rows. `hidePendingBots` get settled legs only.
 */
export async function getCohortLegs(opts: {
  bots: string[];
  markets: readonly string[];
  since: string;
  hidePendingBots: ReadonlySet<string>;
  isElite: boolean;
}): Promise<BotLeg[]> {
  if (opts.bots.length === 0) return [];
  const db = createServerServiceClient();
  const rows: Record<string, unknown>[] = [];
  const PAGE = 5000;
  for (let from = 0; from < 100000; from += PAGE) {
    const { data, error } = await db
      .from("bot_ledger_display")
      .select(LEG_COLUMNS)
      .in("bot_name", opts.bots)
      .in("market", opts.markets as string[])
      .eq("in_record", true)
      .gte("pick_time", opts.since)
      .order("pick_time", { ascending: false })
      .order("pick_id", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data) {
      console.error("[getCohortLegs] read failed:", error?.message ?? "no data");
      break;
    }
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE) break;
  }
  return rows
    .filter((r) => !opts.hidePendingBots.has(String(r.bot_name)) || SETTLED.includes(String(r.result)))
    .map((r) => toLeg(r, opts.isElite));
}

/** The /performance hero ("Model ROI · all-time", "last 30d") — the same per-leg public basis. */
export interface HeadlineFlat {
  n: number;
  pnlUnits: number;
  roi: number | null;
  /** Standard error of the mean flat return (fraction) — publish with `roi`. */
  roiSe: number | null;
  nRecordedPrice: number;
  n30: number;
  roi30: number | null;
}

export async function getHeadlineFlat(opts: {
  bots: string[];
  markets: readonly string[];
  since: string;
}): Promise<HeadlineFlat> {
  const empty: HeadlineFlat = { n: 0, pnlUnits: 0, roi: null, roiSe: null, nRecordedPrice: 0, n30: 0, roi30: null };
  if (opts.bots.length === 0) return empty;
  const db = createServerServiceClient();
  const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString();
  let n = 0, pnl = 0, sq = 0, rec = 0, n30 = 0, pnl30 = 0;
  const PAGE = 5000;
  for (let from = 0; from < 200000; from += PAGE) {
    const { data, error } = await db
      .from("bot_ledger")
      .select("pick_id, pick_time, pnl_unit_public, public_basis")
      .eq("source", "sim")
      .eq("in_record", true)
      .in("bot_name", opts.bots)
      .in("market", opts.markets as string[])
      .in("result", ["won", "lost"])
      .gte("pick_time", opts.since)
      .order("pick_time", { ascending: true })
      .order("pick_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data) {
      console.error("[getHeadlineFlat] read failed:", error?.message ?? "no data");
      return empty;
    }
    for (const r of data as Array<{ pick_time: string; pnl_unit_public: number | string; public_basis: string }>) {
      const u = Number(r.pnl_unit_public);
      n += 1; pnl += u; sq += u * u;
      if (r.public_basis === "recorded") rec += 1;
      if (r.pick_time >= cutoff30) { n30 += 1; pnl30 += u; }
    }
    if (data.length < PAGE) break;
  }
  const mean = n > 0 ? pnl / n : null;
  const roiSe = n > 1 && mean != null ? Math.sqrt(Math.max(0, (sq - n * mean * mean) / (n - 1)) / n) : null;
  return {
    n, pnlUnits: pnl, roi: mean, roiSe, nRecordedPrice: rec,
    n30, roi30: n30 > 0 ? pnl30 / n30 : null,
  };
}

/** Per-leg public price for a set of sim legs (the public track-record API's rows), from the
 *  same view column the rows and hero are summed from. Chunked: an IN list of UUIDs in a
 *  PostgREST GET must stay under the proxy's header limit. */
export async function getPublicPrices(
  ids: string[],
): Promise<Map<string, { odds: number; pnlUnit: number; basis: string }>> {
  const out = new Map<string, { odds: number; pnlUnit: number; basis: string }>();
  const db = createServerServiceClient();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db
      .from("bot_ledger")
      .select("pick_id, odds_public, pnl_unit_public, public_basis")
      .eq("source", "sim")
      .in("pick_id", ids.slice(i, i + 100));
    if (error || !data) {
      console.error("[getPublicPrices] read failed:", error?.message ?? "no data");
      continue;
    }
    for (const r of data as Array<Record<string, unknown>>) {
      out.set(String(r.pick_id), {
        odds: num(r.odds_public), pnlUnit: num(r.pnl_unit_public), basis: String(r.public_basis),
      });
    }
  }
  return out;
}
