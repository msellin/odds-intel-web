/**
 * All reads for /admin/shadow-bots (OWN Phase 6, 2026-09-15).
 *
 * Two entry points:
 *   • `loadShadowBotsPage()` — everything that is safe to share across
 *     operators for 60 s, wrapped in `unstable_cache`. 10 PostgREST queries.
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
 *
 * 2026-09-15 (OWN-SURFACE-DISPLAY-ADDITIONS): 8 → 10 queries. +1 for in-play
 * picks (a SEPARATE read, not a widened window on the pre-match one: an in-play
 * pick's fixture has already kicked off, and relaxing `matches.date >= now`
 * would let started fixtures crowd future ones out of the 1500-row limit).
 * +1 for the promotions panel, which is ONE read — `promo_terms` with
 * `promo_ledger` embedded on its FK. Nothing is fetched per row.
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
  /** Non-NULL only for the in-play rig's picks — the minute the trigger fired. */
  inplay_minute: number | null;
  inplay_score_home: number | null;
  inplay_score_away: number | null;
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

export interface BotScoreRow {
  bot_id: string;
  bot_name: string;
  /** EVERY settled pick — the honest ROI denominator. */
  settled_n: number;
  settled_won: number;
  settled_pnl_eur: number | string | null;
  settled_roi: number | string | null;
  /** Own-book-closed subset — the pre-registered CLV/verdict population. */
  clv_n: number;
  clv_mc_mean: number | string | null;
  clv_mc_sd: number | string | null;
  decision_fresh_n: number;
  decision_age_known_n: number;
}

export interface BotClvRow {
  bot_id: string;
  clv_margin_corrected: number | null;
  decision_quote_fresh: boolean | null;
  result: string | null;
  odds_at_pick: number | null;
  odds_at_pick_live: number | null;
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

export interface ShadowBotsPageData {
  bots: BotRow[];
  placerBots: PlacerBotRow[];
  todayRealBets: TodayRealBets;
  upcoming: UpcomingPick[];
  /** `${match_id}|${market}|${selection}` (lowercased) → latest quote per book. */
  quotes: Record<string, Quote[]>;
  /** Books whose snapshot fetch hit the row cap — their column may be incomplete. */
  truncatedBooks: string[];
  scoreboard: BotScoreRow[];
  /**
   * shadow_bets ids already recorded in real_bets TODAY — the row shows it.
   *
   * An ARRAY, not a Set, and it must stay one: this object is returned through
   * `unstable_cache`, which serialises to JSON. A Set survives that as `{}`, so
   * the uncached first render worked and every cached render for the next 60 s
   * threw `loggedPickIds.has is not a function` — the page was down for
   * everything but the first request after each revalidate (2026-09-16).
   * Callers build their own Set; nothing non-JSON may cross this boundary.
   */
  loggedPickIds: string[];
  promos: PromoRow[];
  /** Set when the promo read failed (e.g. PostgREST schema cache) — shown, never swallowed. */
  promoError: string | null;
  loadedAt: string;
  queryCount: number;
}

// The books we quote, each fetched SEPARATELY so one book's volume cannot
// starve another under the PostgREST row cap. `Unibet-Site` only — never
// `Unibet` or `Unibet-Kambi` (UB-COLUMN-NOT-PLACEABLE): unibet.ee left the
// Kambi API on 2026-09-06 and Kambi disagrees with the site on 91% of quotes.
// Tonybet ADDED 2026-09-24 (sweeper-odds audit) — our fourth own book since 09-23.
const SNAPSHOT_BOOKS = ["Coolbet", "Unibet-Site", "Epicbet", "Tonybet"] as const;
const SNAPSHOT_ROW_CAP = 3000;
const SNAPSHOT_WINDOW_H = 12;
const UPCOMING_LIMIT = 1500;
/** In-play picks pending at once. The rig fires at most twice per fixture. */
const INPLAY_LIMIT = 300;
const CLV_PAGE = 5000;

/** Shared projection for both pick reads — they map to the same row shape. */
const PICK_SELECT = `id, bot_id, bot_name, match_id, market, selection, odds_at_pick,
   model_probability, calibrated_prob, recommended_bookmaker, pick_time,
   decision_quote_age_min, inplay_minute, inplay_score_home, inplay_score_away,
   matches!inner (
     date,
     leagues ( name, country, tier ),
     home_team:teams!matches_home_team_id_fkey ( name ),
     away_team:teams!matches_away_team_id_fkey ( name )
   )`;

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

  // 2 · placer toggles · 3 · today's real bets · 4 · upcoming picks
  // 5 · in-play picks · 6 · promotions — all independent.
  queryCount += 5;
  const [placerRes, realRes, upcomingRes, inplayRes, promoRes] = await Promise.all([
    db.from("coolbet_placer_bots").select("bot_name, ui_place_enabled, note").order("bot_name"),
    db
      .from("real_bets")
      // LOGGED-PICKS-INVISIBLE (2026-09-15): `shadow_bet_id` is selected so the
      // picks table can show that a pick is ALREADY recorded. Without it the row
      // looked untouched after logging, which both hid the operator's own work
      // and invited a second write (there is no unique index yet — see
      // SHADOW-BOTS-REVIEW-RESIDUE).
      .select("bookmaker, stake, placed_real, shadow_bet_id")
      .gte("placed_at", dayStart.toISOString())
      .limit(500),
    db
      .from("shadow_bets_unique")
      .select(PICK_SELECT)
      .is("bot_retired_at", null)
      .eq("result", "pending")
      .gte("matches.date", nowIso)
      .order("matches(date)", { ascending: true })
      .limit(UPCOMING_LIMIT),
    // In-play picks: NO kickoff filter — by definition their fixture has
    // already started, so the pre-match window above can never contain them.
    db
      .from("shadow_bets_unique")
      .select(PICK_SELECT)
      .is("bot_retired_at", null)
      .eq("result", "pending")
      .not("inplay_minute", "is", null)
      .order("pick_time", { ascending: false })
      .limit(INPLAY_LIMIT),
    // Promotions: ONE read — active terms with their ledger rows embedded on
    // promo_ledger.promo_terms_id. Both tables are empty until the owner enters
    // terms, so this is a few bytes in the normal case.
    db
      .from("promo_terms")
      .select(
        `id, book, promo_type, title, boost_pct, boost_applies_to, face_value_eur,
         stake_returned, min_odds, max_stake_eur, min_legs, refund_eur, refund_cash,
         rollover_x, deposit_eur, single_use, valid_to, source_url,
         promo_ledger ( ev_eur, realised_pnl_eur, settled_at )`,
      )
      .eq("active", true)
      .order("valid_to", { ascending: true, nullsFirst: false })
      .limit(200),
  ]);

  const placerBots = (placerRes.data ?? []) as PlacerBotRow[];

  const todayRealBets: TodayRealBets = {
    confirmedCount: 0,
    confirmedStake: 0,
    unconfirmedCount: 0,
    unconfirmedStake: 0,
  };
  const loggedPickIds = new Set<string>();
  for (const r of (realRes.data ?? []) as {
    stake: number | string | null;
    placed_real: boolean | null;
    shadow_bet_id: string | null;
  }[]) {
    if (r.shadow_bet_id) loggedPickIds.add(r.shadow_bet_id);
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
    inplay_minute: number | string | null;
    inplay_score_home: number | string | null;
    inplay_score_away: number | string | null;
    matches: {
      date: string;
      leagues: { name: string | null; country: string | null; tier: number | null } | null;
      home_team: { name: string | null } | null;
      away_team: { name: string | null } | null;
    } | null;
  };
  const num = (v: number | string | null | undefined) => (v == null ? null : Number(v));
  const int = (v: number | string | null | undefined) => (v == null ? null : Math.trunc(Number(v)));
  // The view is DISTINCT ON (bot, match, market, selection) so no JS dedup is
  // needed; rows without a joined fixture cannot be placed and are dropped.
  const mapPicks = (raw: unknown): UpcomingPick[] =>
    ((raw ?? []) as UpRaw[])
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
        inplay_minute: int(r.inplay_minute),
        inplay_score_home: int(r.inplay_score_home),
        inplay_score_away: int(r.inplay_score_away),
        kickoff: r.matches!.date,
        home: r.matches!.home_team?.name ?? "Home",
        away: r.matches!.away_team?.name ?? "Away",
        league: r.matches!.leagues?.name ?? null,
        country: r.matches!.leagues?.country ?? null,
        tier: r.matches!.leagues?.tier ?? null,
      }));

  const prematch = mapPicks(upcomingRes.data as unknown);
  // The two reads cannot overlap (kickoff past vs future), but dedupe on id
  // anyway — a row appearing twice would double a verdict count.
  const seenPickIds = new Set(prematch.map((p) => p.id));
  const upcoming: UpcomingPick[] = [
    ...prematch,
    ...mapPicks(inplayRes.data as unknown).filter((p) => !seenPickIds.has(p.id)),
  ];

  // 7–9 · latest quote per book, bounded to the fixtures + markets on the table.
  // PRE-MATCH rows only: `odds_snapshots` is filtered `is_live = false`, so for a
  // fixture already in play the newest row is the price the board closed at
  // before kick-off. Rendering that as an in-play row's "best placeable" would
  // show a price that no longer exists — the exact failure KAMBI-FEED-DIVERGENCE
  // is about. In-play rows carry their own on-screen price in `odds_at_pick`.
  const matchIds = Array.from(new Set(prematch.map((u) => u.match_id)));
  const markets = Array.from(new Set(prematch.map((u) => u.market.toLowerCase())));
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
      // COOLBET-DOUBLE-WRITE (2026-09-17). Taking the LATEST row per key was
      // measured at +1.87pp worse than the book's live quote, because a scrape
      // pass can write the same selection twice seconds apart and the second
      // write is worse 98.7% of the time. Against The Odds API's live Coolbet
      // prices on 8 matched fixtures: reading `latest` gave +1.87pp, reading the
      // BEST price within the burst reproduced the live quote EXACTLY (+0.00pp).
      //
      // So take the best price inside a SHORT window of the newest row. The
      // window is deliberately tight: it must cover the double-write (observed
      // 0.5-10s apart) without reaching back far enough to surface a price the
      // market has since moved away from — showing a better price than the book
      // currently offers is the mirage this project has been burned by before
      // (ANALYSIS_GOTCHAS §52/§55).
      const BURST_MS = 15_000;
      const newest = new Map<string, number>();
      for (const r of f.rows) {
        const k = oddsKey(r.match_id, r.market, r.selection);
        const t = Date.parse(r.timestamp);
        if (!newest.has(k)) newest.set(k, t);
      }
      const bestByKey = new Map<string, { odds: number; ts: string }>();
      for (const r of f.rows) {
        const k = oddsKey(r.match_id, r.market, r.selection);
        const t = Date.parse(r.timestamp);
        const n = newest.get(k);
        if (n === undefined || n - t > BURST_MS) continue;
        const o = Number(r.odds);
        const cur = bestByKey.get(k);
        if (!cur || o > cur.odds) bestByKey.set(k, { odds: o, ts: r.timestamp });
      }
      for (const [k, v] of bestByKey) {
        (quotes[k] ??= []).push({ book: f.book, odds: v.odds, ts: v.ts });
      }
    }
  }

  // 10 · the scoreboard, from the ENGINE's view (migration 360). It was a paged
  // fetch of every own-book-closed row, aggregated here — which computed ROI
  // over the subset that HAPPENS to have a closing anchor and flipped the sign
  // on 4 of 11 bots (bot_ou35_model_v1: true −11.3% over n=226 rendered as
  // +30.0% over n=23). The view keeps the two populations separate and labelled,
  // and one row per bot replaces a full-ledger fetch.
  const scoreboard: BotScoreRow[] = [];
  if (botIds.length > 0) {
    queryCount++;
    const { data } = await db
      .from("shadow_bot_scoreboard")
      .select(
        "bot_id, bot_name, settled_n, settled_won, settled_pnl_eur, settled_roi, " +
          "clv_n, clv_mc_mean, clv_mc_sd, decision_fresh_n, decision_age_known_n",
      )
      .in("bot_id", botIds);
    scoreboard.push(...((data ?? []) as unknown as BotScoreRow[]));
  }

  // Promotions — aggregate the embedded ledger in JS (the panel shows at most a
  // handful of terms; a per-row aggregate read would be one query per promo).
  type PromoRaw = Omit<PromoRow, "taken" | "evSum" | "realisedSum" | "settled" | "evSumSettled"> & {
    boost_pct: number | string | null;
    face_value_eur: number | string | null;
    min_odds: number | string | null;
    max_stake_eur: number | string | null;
    refund_eur: number | string | null;
    rollover_x: number | string | null;
    deposit_eur: number | string | null;
    promo_ledger: { ev_eur: number | string | null; realised_pnl_eur: number | string | null; settled_at: string | null }[] | null;
  };
  const promos: PromoRow[] = ((promoRes.data ?? []) as unknown as PromoRaw[]).map((t) => {
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
    return {
      ...t,
      boost_pct: num(t.boost_pct),
      face_value_eur: num(t.face_value_eur),
      min_odds: num(t.min_odds),
      max_stake_eur: num(t.max_stake_eur),
      refund_eur: num(t.refund_eur),
      rollover_x: num(t.rollover_x),
      deposit_eur: num(t.deposit_eur),
      taken: legs.length,
      evSum,
      realisedSum,
      evSumSettled,
      settled,
    };
  });

  return {
    bots,
    placerBots,
    todayRealBets,
    upcoming,
    quotes,
    truncatedBooks,
    scoreboard,
    loggedPickIds: [...loggedPickIds],
    promos,
    // Surfaced, not swallowed: "no promos" and "the read failed" look identical
    // in an empty table, and only one of them is a reason to stop trusting it.
    promoError: promoRes.error?.message ?? null,
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
