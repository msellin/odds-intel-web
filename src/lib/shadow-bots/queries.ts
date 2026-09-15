/**
 * All reads for /admin/shadow-bots (OWN Phase 6, 2026-09-15).
 *
 * Two entry points:
 *   • `loadShadowBotsPage()` — everything that is safe to share across
 *     operators for 60 s, wrapped in `unstable_cache`. 8 PostgREST queries.
 *   • `loadSessionState()`   — the safety flags, read FRESH on every request.
 *     A 60 s-stale "placement paused" chip is a lie the operator acts on, and
 *     it is one cheap single-row read.
 *
 * Per-user state (pick marks) is read in page.tsx — it cannot live inside the
 * shared cache.
 *
 * Before this rewrite the page ran ~20 queries per load, pulled the full
 * ~14k-row `shadow_bets_unique` ledger (3 pages of 5,000) plus up to 30k
 * `odds_snapshots` rows into Node, and was force-dynamic with no cache.
 * Now the ledger read is `shadow_bets_own_book_clv` filtered to the active
 * bots (~450 rows today) and snapshots are bounded to the fixtures + markets
 * actually on the table.
 */
import { unstable_cache } from "next/cache";
import { createServerServiceClient } from "@/lib/supabase-server";

// ── row types ───────────────────────────────────────────────────────────────
export interface BotRow {
  id: string;
  name: string;
  maturity_label: string | null;
  is_active: boolean | null;
}

export interface SessionState {
  placement_paused: boolean;
  placement_paused_reason: string | null;
  publishing_paused: boolean;
  publishing_paused_reason: string | null;
  daemons_paused: boolean;
  daemons_paused_reason: string | null;
  real_money_armed: boolean;
  real_money_armed_reason: string | null;
  mac_daemon_last_tick_at: string | null;
}

export interface PlacerBotRow {
  bot_name: string;
  ui_place_enabled: boolean;
  note: string | null;
}

export interface TodayRealBets {
  /** placed_real = TRUE — confirmed against the book account. */
  confirmedCount: number;
  confirmedStake: number;
  /** placed_real IS NULL — manual / unconfirmed (incl. this page's Place action). */
  unconfirmedCount: number;
  unconfirmedStake: number;
}

export interface UpcomingPick {
  id: string;
  bot_id: string;
  bot_name: string;
  match_id: string;
  market: string;
  selection: string;
  odds_at_pick: number | null;
  calibrated_prob: number | null;
  model_probability: number | null;
  recommended_bookmaker: string | null;
  pick_time: string;
  decision_quote_age_min: number | null;
  kickoff: string;
  home: string;
  away: string;
  league: string | null;
  country: string | null;
  tier: number | null;
}

export interface Quote {
  book: string;
  odds: number;
  ts: string;
}

export interface BotClvRow {
  bot_id: string;
  clv_margin_corrected: number | null;
  decision_quote_fresh: boolean | null;
  result: string | null;
  odds_at_pick: number | null;
  odds_at_pick_live: number | null;
}

export interface ShadowBotsPageData {
  bots: BotRow[];
  placerBots: PlacerBotRow[];
  todayRealBets: TodayRealBets;
  upcoming: UpcomingPick[];
  /** `${match_id}|${market}|${selection}` (lowercased) → latest quote per book. */
  quotes: Record<string, Quote[]>;
  /** Books whose snapshot fetch hit the row cap — their column may be incomplete. */
  truncatedBooks: string[];
  clvRows: BotClvRow[];
  loadedAt: string;
  queryCount: number;
}

// The books we quote, each fetched SEPARATELY so one book's volume cannot
// starve another under the PostgREST row cap. `Unibet-Site` only — never
// `Unibet` or `Unibet-Kambi` (UB-COLUMN-NOT-PLACEABLE): unibet.ee left the
// Kambi API on 2026-09-06 and Kambi disagrees with the site on 91% of quotes.
const SNAPSHOT_BOOKS = ["Coolbet", "Unibet-Site", "Epicbet"] as const;
const SNAPSHOT_ROW_CAP = 3000;
const SNAPSHOT_WINDOW_H = 12;
const UPCOMING_LIMIT = 1500;
const CLV_PAGE = 5000;

export const oddsKey = (m: string, market: string, selection: string) =>
  `${m}|${market.toLowerCase()}|${selection.toLowerCase()}`;

async function _loadShadowBotsPage(): Promise<ShadowBotsPageData> {
  const db = createServerServiceClient();
  let queryCount = 0;
  const nowIso = new Date().toISOString();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  // 1 · active bots — the ONLY source of "which bots exist" on this page.
  queryCount++;
  const { data: botsRaw } = await db
    .from("bots")
    .select("id, name, maturity_label, is_active")
    .is("retired_at", null)
    .order("name");
  const bots = (botsRaw ?? []) as BotRow[];
  const botIds = bots.map((b) => b.id);

  // 2 · placer toggles · 3 · today's real bets · 4 · upcoming picks — independent.
  queryCount += 3;
  const [placerRes, realRes, upcomingRes] = await Promise.all([
    db.from("coolbet_placer_bots").select("bot_name, ui_place_enabled, note").order("bot_name"),
    db
      .from("real_bets")
      .select("bookmaker, stake, placed_real")
      .gte("placed_at", dayStart.toISOString())
      .limit(500),
    db
      .from("shadow_bets_unique")
      .select(
        `id, bot_id, bot_name, match_id, market, selection, odds_at_pick, model_probability,
         calibrated_prob, recommended_bookmaker, pick_time, decision_quote_age_min,
         matches!inner (
           date,
           leagues ( name, country, tier ),
           home_team:teams!matches_home_team_id_fkey ( name ),
           away_team:teams!matches_away_team_id_fkey ( name )
         )`,
      )
      .is("bot_retired_at", null)
      .eq("result", "pending")
      .gte("matches.date", nowIso)
      .order("matches(date)", { ascending: true })
      .limit(UPCOMING_LIMIT),
  ]);

  const placerBots = (placerRes.data ?? []) as PlacerBotRow[];

  const todayRealBets: TodayRealBets = {
    confirmedCount: 0,
    confirmedStake: 0,
    unconfirmedCount: 0,
    unconfirmedStake: 0,
  };
  for (const r of (realRes.data ?? []) as { stake: number | string | null; placed_real: boolean | null }[]) {
    const stake = Number(r.stake ?? 0);
    if (r.placed_real === true) {
      todayRealBets.confirmedCount++;
      todayRealBets.confirmedStake += stake;
    } else if (r.placed_real == null) {
      todayRealBets.unconfirmedCount++;
      todayRealBets.unconfirmedStake += stake;
    }
  }

  type UpRaw = {
    id: string;
    bot_id: string;
    bot_name: string | null;
    match_id: string;
    market: string;
    selection: string;
    odds_at_pick: number | string | null;
    model_probability: number | string | null;
    calibrated_prob: number | string | null;
    recommended_bookmaker: string | null;
    pick_time: string;
    decision_quote_age_min: number | string | null;
    matches: {
      date: string;
      leagues: { name: string | null; country: string | null; tier: number | null } | null;
      home_team: { name: string | null } | null;
      away_team: { name: string | null } | null;
    } | null;
  };
  const num = (v: number | string | null | undefined) => (v == null ? null : Number(v));
  // The view is DISTINCT ON (bot, match, market, selection) so no JS dedup is
  // needed; rows without a joined fixture cannot be placed and are dropped.
  const upcoming: UpcomingPick[] = ((upcomingRes.data ?? []) as unknown as UpRaw[])
    .filter((r) => r.matches?.date)
    .map((r) => ({
      id: r.id,
      bot_id: r.bot_id,
      bot_name: r.bot_name ?? "?",
      match_id: r.match_id,
      market: r.market,
      selection: r.selection,
      odds_at_pick: num(r.odds_at_pick),
      calibrated_prob: num(r.calibrated_prob),
      model_probability: num(r.model_probability),
      recommended_bookmaker: r.recommended_bookmaker,
      pick_time: r.pick_time,
      decision_quote_age_min: num(r.decision_quote_age_min),
      kickoff: r.matches!.date,
      home: r.matches!.home_team?.name ?? "Home",
      away: r.matches!.away_team?.name ?? "Away",
      league: r.matches!.leagues?.name ?? null,
      country: r.matches!.leagues?.country ?? null,
      tier: r.matches!.leagues?.tier ?? null,
    }));

  // 5–7 · latest quote per book, bounded to the fixtures + markets on the table.
  const matchIds = Array.from(new Set(upcoming.map((u) => u.match_id)));
  const markets = Array.from(new Set(upcoming.map((u) => u.market.toLowerCase())));
  const since = new Date(Date.now() - SNAPSHOT_WINDOW_H * 3600 * 1000).toISOString();
  const quotes: Record<string, Quote[]> = {};
  const truncatedBooks: string[] = [];
  if (matchIds.length > 0 && markets.length > 0) {
    queryCount += SNAPSHOT_BOOKS.length;
    const fetches = await Promise.all(
      SNAPSHOT_BOOKS.map(async (book) => {
        const { data } = await db
          .from("odds_snapshots")
          .select("match_id, market, selection, odds, timestamp")
          .in("match_id", matchIds)
          .in("market", markets)
          .eq("bookmaker", book)
          .eq("is_live", false)
          .gte("timestamp", since)
          .order("timestamp", { ascending: false })
          .limit(SNAPSHOT_ROW_CAP);
        return { book, rows: (data ?? []) as { match_id: string; market: string; selection: string; odds: number | string; timestamp: string }[] };
      }),
    );
    for (const f of fetches) {
      if (f.rows.length >= SNAPSHOT_ROW_CAP) truncatedBooks.push(f.book);
      const seen = new Set<string>();
      for (const r of f.rows) {
        // newest-first within the book, so the first hit per key is its latest price
        const k = oddsKey(r.match_id, r.market, r.selection);
        if (seen.has(k)) continue;
        seen.add(k);
        (quotes[k] ??= []).push({ book: f.book, odds: Number(r.odds), ts: r.timestamp });
      }
    }
  }

  // 8 · settled own-book rows for the ACTIVE bots only — the scoreboard input.
  const clvRows: BotClvRow[] = [];
  if (botIds.length > 0) {
    for (let from = 0; ; from += CLV_PAGE) {
      queryCount++;
      const { data } = await db
        .from("shadow_bets_own_book_clv")
        .select("bot_id, clv_margin_corrected, decision_quote_fresh, result, odds_at_pick, odds_at_pick_live")
        .in("bot_id", botIds)
        .order("id", { ascending: true })
        .range(from, from + CLV_PAGE - 1);
      const rows = (data ?? []) as BotClvRow[];
      clvRows.push(...rows);
      if (rows.length < CLV_PAGE) break;
    }
  }

  return {
    bots,
    placerBots,
    todayRealBets,
    upcoming,
    quotes,
    truncatedBooks,
    clvRows,
    loadedAt: nowIso,
    queryCount,
  };
}

export const loadShadowBotsPage = unstable_cache(_loadShadowBotsPage, ["admin-shadow-bots-page-v1"], {
  revalidate: 60,
});

/** Safety flags — read fresh on every request (never cached). */
export async function loadSessionState(): Promise<SessionState> {
  const db = createServerServiceClient();
  const { data } = await db
    .from("coolbet_session_state")
    .select(
      "placement_paused, placement_paused_reason, publishing_paused, publishing_paused_reason, daemons_paused, daemons_paused_reason, real_money_armed, real_money_armed_reason, mac_daemon_last_tick_at",
    )
    .eq("id", 1)
    .maybeSingle();
  const d = (data ?? {}) as Partial<SessionState>;
  // Fail CLOSED: a missing row reads as paused + disarmed, never as "go".
  return {
    placement_paused: d.placement_paused ?? true,
    placement_paused_reason: d.placement_paused_reason ?? (data ? null : "no coolbet_session_state row"),
    publishing_paused: d.publishing_paused ?? true,
    publishing_paused_reason: d.publishing_paused_reason ?? null,
    daemons_paused: d.daemons_paused ?? true,
    daemons_paused_reason: d.daemons_paused_reason ?? null,
    real_money_armed: d.real_money_armed ?? false,
    real_money_armed_reason: d.real_money_armed_reason ?? null,
    mac_daemon_last_tick_at: d.mac_daemon_last_tick_at ?? null,
  };
}
