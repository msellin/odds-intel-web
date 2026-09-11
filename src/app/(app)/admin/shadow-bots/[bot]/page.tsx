/**
 * /admin/shadow-bots/[bot] — per-bot ledger for a single shadow bot.
 *
 * Restricted to the four known shadow bot names to prevent arbitrary bot
 * inspection via URL path.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { execOdds as sharedExecOdds, FLAT_STAKE_EUR } from "@/lib/engine-data";
import { botEdgeThreshold } from "@/lib/coolbet-edge";
import { notFound } from "next/navigation";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";

const STAKE = FLAT_STAKE_EUR;
const MIN_SETTLED_FOR_DECISION = 50;
const MIN_DAYS_FOR_DECISION = 14;

// DUPLICATED-BUSINESS-RULES-AUDIT-2026-09-05: the per-bot edge map lived here
// AND inside the render loop of the index page. Both copies are now
// `botEdgeThreshold()` in @/lib/coolbet-edge — same values, one definition.

const ALLOWED: Record<string, { title: string; subtitle: string; detail: string }> = {
  bot_corners_paper_shadow_v1: {
    title: "Corners O/U · line-shop (Betano/Unibet)",
    subtitle: "Best Betano/Unibet corners price vs de-vigged Pinnacle · edge ≥ 0%",
    detail:
      "CORNERS-PAPER-FORWARD. Fires on corners_ou_<line> markets for upcoming fixtures: fair value is de-vigged two-way Pinnacle, and it records the best price among the books we can actually place corners at (Betano, Unibet) when price × devig_p − 1 ≥ 0. EUR 10 nominal, settled from match_stats corners (over/under, .5 lines never push). It is a SHADOW-only forward paper test with no backtest number on purpose — the historical +20.99% did NOT reproduce at executable prices (audit z=+0.33..+3.62, edge Betano/Unibet-only, Epicbet negative, no dose-response, one 9-day pre-collapse window), and a replay is exactly the figure we distrust. Judge it on forward CLV and ROI. Never touches simulated_bets or the public pages.",
  },
  bot_coolbet_ou_model_v1: {
    title: "Coolbet O/U · model-edge (calibrated)",
    subtitle: "Calibrated model O/U picks · edge ≥ 8% · odds ≥ 1.80 · lines 2.5/3.5",
    detail:
      "COOLBET-MODEL-OU-SHADOW-BOT. Mirrors the calibrated model's Over/Under picks (simulated_bets market='o/u', edge ≥ 8% on calibrated_prob, calibrated_prob NOT NULL, lines 2.5/3.5 only) into shadow_bets in the line-shop vocabulary (over_under_25/over_under_35, over/under) so they place through the PROVEN Coolbet UI placer with the validated per-market gates (edge ≥ 8%, odds ≥ 1.80). EUR 10 nominal. Settled by the generic goals O/U resolver — no custom settler. Why it exists (unified-flow epic): the strategy backtest found model-edge O/U is +15% (fold-robust) at executable prices where the line-shop bot's O/U is −17% (negative every month, n~1100 — a live money leak). Real-money placement is OFF BY DEFAULT and gated behind env COOLBET_UI_MODEL_EDGE_OU=1 (owner-authorized, fold-robust out-of-sample only). Judge it forward on CLV and ROI. Never touches the public pages.",
  },
  bot_coolbet_1x2_model_v1: {
    title: "Coolbet · 1x2 · model-edge",
    subtitle: "Calibrated model 1x2 HOME-UNDERDOG picks · edge ≥ 10% · odds ≥ 2.80",
    detail:
      "COOLBET-MODEL-1X2-SHADOW-BOT. Mirrors the calibrated model's 1x2 HOME-UNDERDOG picks (simulated_bets market='1x2', selection='home', edge ≥ 10% on calibrated_prob, odds ≥ 2.80, calibrated_prob NOT NULL) into shadow_bets WITHOUT vocabulary conversion (market stays '1x2', selection stays home) so they place through the PROVEN Coolbet UI placer with the validated gate (home-underdogs, edge ≥ 10%, odds ≥ 2.80). EUR 10 nominal. Settled by the generic 1x2 match-result resolver — no custom settler. Why it exists: it REPLACES the paused line-shop 1x2, whose raw signal loses out-of-sample. FAVLONG-CUTS-2026-09-09: the pooled '13% is the only robust 1x2 floor' hid that home-FAVOURITES are a fold-robust loser; split by type, home-underdogs are the one fold-robust engine (cohort +21% at 10%, ~50% more volume than 13%) — favs/aways/draws are excluded. Real-money placement is OFF BY DEFAULT and gated by the coolbet_placer_bots per-bot toggle (seeded false; superadmin flips it after a dry-run, PLACEABLE_BOTS ∩ enabled). Judge it forward on CLV and ROI. Never touches the public pages.",
  },
  bot_ou35_model_v1: {
    title: "Coolbet · O/U 3.5 · model-edge (paper)",
    subtitle: "Calibrated O/U 3.5 vs Coolbet's own price · edge ≥ 8% · PAPER",
    detail:
      "OU35-MODEL-SHADOW-BOT (2026-09-08). The one line OU-LINES-EDGE-TEST flagged: O/U 3.5 mirrors the live 2.5 (+7.8% Coolbet-executable calibrated model-edge, NOT yet fold-robust). Fits its own isotonic 3.5 calibration and evaluates edge at Coolbet's OWN 3.5 price (single-book, §55 — never best-of-books). PAPER ONLY — not in PLACEABLE_BOTS, no placer toggle, can never stake money. A PICKS/OWN promotion candidate once fold-robust (owner-gated). Judge it forward on ROI.",
  },
  bot_coolbet_trigger_1x2_v1: {
    title: "Coolbet · 1x2 · trigger engine (paper)",
    subtitle: "Fires when Coolbet's 1x2 price lands in the model's window · edge ≥ 13% at Coolbet's OWN odds · PAPER",
    detail:
      "BOOK-AGNOSTIC-EDGE-ENGINE Stage B (2026-09-09). The book-agnostic selection: the model publishes a per-fixture trigger window (pick_triggers), and this bot emits a pick whenever Coolbet's live 1x2 price lands in [min_odds, max_odds] — edge evaluated at Coolbet's OWN odds, not the /picks reference odds. PAPER ONLY (never in PLACEABLE_BOTS). ⚠️ Held-out OOS backtest: −21.2% (n=1470). The 2.80 odds floor at Coolbet's higher odds can only fire on LONGSHOTS (avg 5.87), where the model is over-confident (says 35%, wins 14%) — adverse selection, since our model's AUC is below the market's. DO NOT PROMOTE. It's a research instrument to search for a gate that validates, not a bet. Contrast bot_v10_all (moderate picks, +11-13%, honestly calibrated).",
  },
  bot_coolbet_trigger_ou_v1: {
    title: "Coolbet · O/U 2.5 · trigger engine (paper)",
    subtitle: "Fires when Coolbet's O/U 2.5 price lands in the model's window · edge ≥ 8% at Coolbet's OWN odds · PAPER",
    detail:
      "BOOK-AGNOSTIC-EDGE-ENGINE Stage B (2026-09-09). Same mechanism as the 1x2 trigger bot but for O/U 2.5 (edge ≥ 8%, odds ≥ 1.80). Emits a pick when Coolbet's live over_under_25 price lands in the model's trigger window, edge evaluated at Coolbet's OWN price. PAPER ONLY (never in PLACEABLE_BOTS). Held-out OOS backtest: +4.3% (n=228), NOT fold-robust (+15/+2/−5). Milder than the 1x2 trigger but not yet trustworthy — accruing forward. Settled by the generic goals-O/U resolver.",
  },
  bot_coolbet_trigger_sharp_1x2_v1: {
    title: "Coolbet · 1x2 · trigger engine · SHARP anchor (paper)",
    subtitle: "RULES: sharp edge ≥ 3% vs de-vigged Pinnacle · NO odds floor (experimental) · PAPER",
    detail:
      "BOOK-AGNOSTIC-EDGE-ENGINE · SHARP anchor. Head-to-head twin of bot_coolbet_trigger_1x2_v1: same window math, but fair value = Shin-de-vigged Pinnacle price (P_sharp), NOT our model — edge = P_sharp − 1/coolbet_odds. RULES: sharp edge ≥ 3% (a small edge vs a near-true line is real; the model's 13% floor would never fire — max observed +6.6%); NO odds floor — this is an EXPERIMENTAL paper bot observing the full sharp-edge distribution across ALL odds bands (favourites and longshots alike), so a data-driven odds floor can be set later once picks settle. Stage A writes strategy=sharp_1x2, cal_prob=P_sharp. PAPER ONLY (never in PLACEABLE_BOTS). Fires rarely (Coolbet ≈ Pinnacle). The point is the head-to-head vs the model-anchored twin. docs/SYSTEM_MAP.md · docs/BETTING_GATE_DECISIONS.md.",
  },
  bot_coolbet_trigger_sharp_ou_v1: {
    title: "Coolbet · O/U 2.5 · trigger engine · SHARP anchor (paper)",
    subtitle: "RULES: sharp edge ≥ 3% vs de-vigged Pinnacle · NO odds floor (experimental) · PAPER",
    detail:
      "BOOK-AGNOSTIC-EDGE-ENGINE · SHARP anchor. Head-to-head twin of bot_coolbet_trigger_ou_v1: same window math, but fair value = Shin-de-vigged Pinnacle O/U 2.5 price (P_sharp), edge = P_sharp − 1/coolbet_odds. RULES: sharp edge ≥ 3% (small edge vs a near-true line is real; the model's 8% would rarely fire — max observed +4.8%); NO odds floor — EXPERIMENTAL, observing all odds bands to set a data-driven floor later once picks settle. Stage A writes strategy=sharp_ou25, cal_prob=P_sharp. PAPER ONLY (never in PLACEABLE_BOTS). Fires rarely (Coolbet ≈ Pinnacle). The comparison against the model-anchored twin is the point. Settled by the generic goals-O/U resolver.",
  },
  bot_no_pin_shadow_v1: {
    title: "Matches without Pinnacle (retired 2026-08-21)",
    subtitle: "1X2 any selection · edge \u2265 8%",
    detail: "RETIRED \u2014 home slice was winning (+33%) but draw/away were losing. Refined home-only version at bot_no_pin_home_v1. Historical data kept for reference.",
  },
  bot_no_pin_home_v1: {
    title: "1X2 home \u00b7 no Pinnacle (retired 2026-08-24)",
    subtitle: "1X2 home \u00b7 edge \u2265 8% \u00b7 matches without Pinnacle",
    detail: "RETIRED \u2014 PER-BOT-SWEEP-2026-08-24. Negative at EVERY edge threshold tested (\u22125.3% to \u22127.4% across 0.02\u20130.20) and in 2 of 3 backtest windows; live \u221210.6% on n=66. No Pinnacle means no sharp anchor, so an unchecked model ran on the most obscure fixtures on the board \u2014 it measured 17.3pp overconfident, the worst of the eight.",
  },
  bot_sweep_1x2_home_v1: {
    title: "Home wins \u00b7 tier 2-3",
    subtitle: "1X2 home \u00b7 model edge \u2265 10%",
    detail: "Sweep-derived. Fires on tier 2-3 leagues, home odds 2.0-5.0, Pinnacle required. Replay 2026-05-01\u219208-21: n=411, +2.1% ROI, CLV +5.0%, positive in 2 of 3 windows. Tier 3 is this bot's better half (+7.2% vs tier 2 \u22121.2%), so the general tier-3 exclusion does not apply here.",
  },
  bot_sweep_1x2_draw_v1: {
    title: "Draws \u00b7 tier 2-3",
    subtitle: "1X2 draw \u00b7 model edge \u2265 5%",
    detail: "Sweep-derived. Fires on tier 2-3 leagues, draw odds 1.3-3.5, Pinnacle required. Replay: n=614, +1.1% ROI. WATCH \u2014 the most recent window is \u221223% to \u221259% at every edge threshold tested, which no other bot shows. That is a regime signal a re-gate cannot fix; kill at n=100 live if it persists.",
  },
  bot_sweep_btts_yes_v1: {
    title: "Both teams to score \u00b7 tier 2-3",
    subtitle: "BTTS yes \u00b7 model edge \u2265 5%",
    detail: "Sweep-derived. Fires on tier 2-3 leagues, BTTS-yes odds 2.0-2.5. Replay: n=240, \u22121.7% ROI. Lowest volume of the set (~10 picks/day) \u2014 too little data to conclude either way.",
  },
  bot_coolbet_value_v1: {
    title: "Coolbet value \u00b7 price you can actually take",
    subtitle: "Coolbet's own quote vs de-vigged Pinnacle \u00b7 edge \u2265 3% \u00b7 tiers 1-2",
    detail: "The only bot here whose quoted price is obtainable. Every other line-shop bot gates on the best of six accessible books; the operator places at Coolbet. Measured 2026-08-26 on the live list: bot_sweep_ou25_v1 showed +7.0% edge and \u22127.0% at Coolbet, bot_sweep_ou35_v1 +7.5% \u2192 \u22125.2% \u2014 57 of 58 picks negative-EV at the only venue reachable. Not because Coolbet is uncompetitive: it is the best price 38.1% of the time, more often than any book in the set, and beats Pinnacle's raw 1X2 quote 61.8% of the time. Taking the max across books also selects for whichever book is most WRONG, and those are the worst calibrated. Fair value still comes from de-vigged Pinnacle, never from Coolbet \u2014 a book cannot look mispriced against itself. No backtest: this config has never been replayed, so judge it on CLV. Expect single-digit picks/day, and roughly three weeks before the CLV gate can decide.",
  },
  bot_sweep_ou25_v1: {
    title: "OU 2.5 \u00b7 line-shopping vs Pinnacle",
    subtitle: "Over/Under 2.5 \u00b7 de-vigged edge \u2265 3% \u00b7 tiers 1-2",
    detail: "Pure Pinnacle-vs-soft-book edge, no model dependency. Re-gated 2026-08-24: edge is now measured against the DE-VIGGED Pinnacle probability, a tier filter was added (it previously had NONE and fired on untiered leagues), and only the higher-edge side of a total is written. Replay at the old config: n=1005, +1.7% ROI; tier 3 was \u221216.3%, tier 1 +4.7%.",
  },
  bot_sweep_ou35_v1: {
    title: "OU 3.5 \u00b7 line-shopping vs Pinnacle",
    subtitle: "Over/Under 3.5 \u00b7 de-vigged edge \u2265 3% \u00b7 tiers 1-2",
    detail: "Same re-gate as OU 2.5. The side lock also fixes a real bug \u2014 across refresh cohorts this bot flipped over\u2192under on the same total in 2 matches, ending up holding both sides. Replay at the old config: n=992, \u22120.2% ROI, positive in only 1 of 3 windows.",
  },
  bot_pin_1x2_home_v1: {
    title: "1X2 home wins \u00b7 tier 1-2",
    subtitle: "1X2 home \u00b7 de-vigged edge \u2265 3% \u00b7 tiers 1-2",
    detail: "The one genuine winner of the eight. Replay: n=692, +7.3% ROI, CLV +15.6%, positive in ALL THREE windows (+10.4 / +10.0 / +3.9) and positive across every tier variation tested rather than one lucky cell. Zero negative-true-edge picks live \u2014 its gate always cleared the ~9% overround. Live +16.2% on n=62.",
  },
  bot_pin_1x2_draw_tier4_v1: {
    title: "1X2 draws \u00b7 tier 4 only (retired 2026-08-24)",
    subtitle: "1X2 draw \u00b7 edge \u2265 5% \u00b7 tier 4",
    detail: "RETIRED \u2014 PER-BOT-SWEEP-2026-08-24. A 5% edge gate cannot beat the 12.2% Pinnacle overround on tier-4 draws, so 85% of its live picks were negative-EV by construction. Live \u221240.8% (n=27); the operator went 0W/11L for \u2212\u20ac110. Its +7.8% backtest was the single positive cell of 8 tier sets on a strategy that is \u22123.6% overall, and turns to \u221210.0% once de-vigged.",
  },
};

// SHADOW-PAGE-ROI-INFLATED-2026-09-04: price every return at the odds that were
// actually on offer when the pick was raised — same helper and same reasoning as
// the shadow-bots index page.
//
// `odds_at_pick` is a high-water mark, not an offer. STALE-BEST-ODDS found the
// pipeline taking MAX() across a fixture's whole snapshot history, so it records
// the best price ANY book showed at ANY time. `odds_at_pick_live` (migration 291)
// is the same pick priced at the best quote from an accessible book at or before
// pick_time.
//
// The index page was fixed on 2026-09-04 but this detail page was not, so drilling
// into a bot showed a different (inflated) ROI than the row you clicked. Coverage
// is 85.5% of settled shadow rows; the fallback keeps older picks visible rather
// than silently dropping them from the ledger.
/**
 * Executable price for a settled/raised pick. Re-exported wrapper over the
 * single definition in engine-data so this page cannot drift from the public
 * surfaces — SHADOW-PAGE-ROI-INFLATED / LANDING-PERF-ROI-BASIS both began as
 * one copy of this logic being fixed while others were left behind.
 */
function execOdds(b: { odds_at_pick: number | null; odds_at_pick_live: number | null }): number {
  return sharedExecOdds(b.odds_at_pick, b.odds_at_pick_live);
}

interface ShadowBetRow {
  id: string;
  match_id: string;
  market: string;
  selection: string;
  odds_at_pick: number | null;
  odds_at_pick_live: number | null;
  model_probability: number | null;
  calibrated_prob: number | null;
  edge_percent: number | null;
  recommended_bookmaker: string | null;
  pick_time: string;
  result: string | null;
  clv: number | null;
  matches: {
    date: string;
    leagues: { name: string | null; country: string | null; tier: number | null } | null;
    home_team: { name: string | null } | null;
    away_team: { name: string | null } | null;
  } | null;
}

export default async function ShadowBotDetailPage({
  params,
}: {
  params: Promise<{ bot: string }>;
}) {
  const { bot: botName } = await params;
  const cfg = ALLOWED[botName];
  if (!cfg) notFound();

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <Denied />;
  const db = createServerServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) return <Denied text="Superadmin only." />;

  const { data: botRow } = await db
    .from("bots")
    .select("id, name, maturity_label")
    .eq("name", botName)
    .single();
  if (!botRow?.id) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <BackLink />
        <h1 className="mt-4 text-xl font-semibold">{cfg.title}</h1>
        <p className="mt-2 text-sm text-amber-400">
          Bot not yet registered — migration hasn&apos;t been applied.
        </p>
      </div>
    );
  }

  const { data: rows } = await db
    // SHADOW-BOTS-DETAIL-TRUNCATION-2026-09-02: reads the deduped VIEW, not
    // the raw table. See the dedup note below for why the old shape was
    // wrong.
    .from("shadow_bets_unique")
    .select(
      `id, match_id, market, selection, odds_at_pick, odds_at_pick_live, model_probability,
       calibrated_prob, edge_percent, recommended_bookmaker, pick_time, result, clv,
       matches!inner (
         date,
         leagues ( name, country, tier ),
         home_team:teams!matches_home_team_id_fkey ( name ),
         away_team:teams!matches_away_team_id_fkey ( name )
       )`
    )
    .eq("bot_id", botRow.id)
    .order("pick_time", { ascending: false })
    // One row per pick now, so this is a real pick count rather than a
    // fraction of one. Largest bot is bot_dc_value at 3,081 unique picks.
    .limit(5000);

  const rawRows = (rows ?? []) as unknown as (ShadowBetRow & { match_id: string })[];

  // SHADOW-BOTS-DETAIL-TRUNCATION-2026-09-02. The dedup that used to live
  // here now lives in the `shadow_bets_unique` view, and that move is the
  // whole fix — not a tidy-up.
  //
  // Shadow bots persist one row per (cohort × match × market × selection) and
  // the cohorts fire every 30 minutes, so a single pick accumulates ~10 rows.
  // Deduplicating in JS AFTER `.limit(500)` meant the limit cut raw rows, and
  // what survived was whatever fraction of the bot's picks happened to fall in
  // the newest 500 recordings. Every number on this page — picks, settled, hit
  // rate, CLV, ROI — was computed from that recency-biased sliver.
  //
  // 24 of 41 bots were affected. bot_dc_value showed 48 of its 3,081 picks
  // (1.6%). bot_pin_1x2_home_v1 showed 61 of 304, which is why this page read
  // -11.8% ROI while the dashboard card read +12.7% for the same bot: the two
  // were reading different fractions of the same ledger.
  //
  // The view keeps the same rule the JS had — EARLIEST pick_time per
  // (bot, match, market, selection), the first sighting being the real record
  // of when the edge was spotted. Sorting stays here because we display
  // newest-first.
  const bets = [...rawRows].sort((a, b) =>
    (b.pick_time ?? "").localeCompare(a.pick_time ?? "")
  ) as unknown as ShadowBetRow[];

  const wins = bets.filter((b) => b.result === "won");
  const losses = bets.filter((b) => b.result === "lost");
  const voided = bets.filter((b) => b.result === "void");
  const pending = bets.filter((b) => !b.result || b.result === "pending");
  const settled = wins.length + losses.length;

  const totalStake = settled * STAKE;
  const wonPnl = wins.reduce((s, b) => s + (execOdds(b) - 1) * STAKE, 0);
  const pnl = wonPnl - losses.length * STAKE;
  const roi = totalStake > 0 ? (pnl / totalStake) * 100 : 0;
  const hitRate = settled > 0 ? (wins.length / settled) * 100 : 0;
  const hasROI = settled > 0;
  // CLV populated at settlement (settled shadow bets have closing_odds).
  // Positive = market moved toward our price after we recorded it — evidence
  // the shown odds were reachable and the edge was real signal.
  const clvVals = bets
    .map((b) => (b.clv != null ? Number(b.clv) : null))
    .filter((v): v is number => v != null);
  const avgClvPct = clvVals.length > 0
    ? (clvVals.reduce((s, v) => s + v, 0) / clvVals.length) * 100
    : null;
  const firstPick = bets.reduce<string | null>(
    (acc, b) => (!acc || b.pick_time < acc ? b.pick_time : acc),
    null
  );
  const observationDays = firstPick
    ? Math.max(
        1,
        Math.floor((Date.now() - new Date(firstPick).getTime()) / (1000 * 60 * 60 * 24))
      )
    : 0;
  const readyForDecision =
    settled >= MIN_SETTLED_FOR_DECISION && observationDays >= MIN_DAYS_FOR_DECISION;
  const roiTone: "good" | "bad" | "neutral" = !readyForDecision
    ? "neutral"
    : roi >= 3
    ? "good"
    : roi <= -8
    ? "bad"
    : "neutral";

  const settledProgress = Math.min(100, (settled / MIN_SETTLED_FOR_DECISION) * 100);
  const daysProgress = Math.min(100, (observationDays / MIN_DAYS_FOR_DECISION) * 100);

  // PER-BOT-UNIBET-ODDS-2026-09-09: current Coolbet + Unibet price per PENDING pick,
  // so each bot's own detail page shows the two books side by side — matching the
  // shared Upcoming table (same fetch, same key builder, same recency window). Only
  // pending picks: a settled game has no meaningful "current" price. Newest row wins
  // per key (rows arrive newest-first), so the direct Kambi feed beats the stale AF
  // Unibet where both exist. Key is lowercased both sides (shadow_bets stores 1x2 AND
  // 1X2, odds_snapshots only 1x2 — see PICKS-ODDS-KEY-CASE).
  const oddsKey = (m: string, market: string, selection: string) =>
    `${m}|${market.toLowerCase()}|${selection.toLowerCase()}`;
  const pendingMatchIds = Array.from(new Set(pending.map((b) => b.match_id)));
  const coolbetNow = new Map<string, { odds: number; ts: string; src?: string }>();
  const unibetNow = new Map<string, { odds: number; ts: string; src?: string }>();
  // PER-BOT-EPICBET-ODDS-2026-09-11: third book column. Epicbet is an accessible
  // Estonian book we already ingest every 30 min (job_epicbet_odds_snapshot, :02/:32)
  // into odds_snapshots with the same market/selection vocabulary as Coolbet, so the
  // operator can price-shop a pending pick across all three venues on one screen
  // instead of opening the site. Read-only display — it gates nothing.
  const epicbetNow = new Map<string, { odds: number; ts: string; src?: string }>();
  if (pendingMatchIds.length > 0) {
    const { data: snaps } = await db
      .from("odds_snapshots")
      .select("match_id, market, selection, odds, timestamp, bookmaker")
      .in("match_id", pendingMatchIds)
      .in("bookmaker", ["Coolbet", "Unibet", "Unibet-Kambi", "Epicbet"])
      .eq("is_live", false)
      .gte("timestamp", new Date(Date.now() - 12 * 3600 * 1000).toISOString())
      .order("timestamp", { ascending: false })
      .limit(10000);
    for (const row of (snaps ?? []) as Array<{
      match_id: string; market: string; selection: string; odds: number | string;
      timestamp: string; bookmaker: string;
    }>) {
      const key = oddsKey(row.match_id, row.market, row.selection);
      const target =
        row.bookmaker === "Coolbet"
          ? coolbetNow
          : row.bookmaker === "Epicbet"
            ? epicbetNow
            : unibetNow;
      if (!target.has(key)) {
        target.set(key, { odds: Number(row.odds), ts: row.timestamp, src: row.bookmaker });
      }
    }
  }

  // REAL-MONEY-PLACED badge: which of this bot's picks were actually STAKED via the UI
  // placer. real_bets.placed_real IS NOT FALSE (TRUE = money moved; NULL = legacy reconciled
  // real bet) — excludes the paper daemon's execute=False rows (placed_real=FALSE). Keyed
  // by (match, market, selection) so the badge shows on the exact pick that was placed.
  const placedKeys = new Set<string>();
  const placedOdds = new Map<string, number>();
  // BET-MADE-COLUMN-2026-09-11: the venue is part of the placement, not decoration —
  // real_bets.bookmaker is what the "Bet made" column renders under the price.
  const placedBook = new Map<string, string>();
  {
    const { data: rb } = await db
      .from("real_bets")
      .select("match_id, market, selection, actual_odds, bookmaker, placed_real")
      .eq("bot_id", botRow.id)
      .not("placed_real", "is", false);
    for (const r of (rb ?? []) as Array<{
      match_id: string; market: string; selection: string; actual_odds: number | string | null;
      bookmaker: string | null;
    }>) {
      const key = oddsKey(r.match_id, r.market, r.selection);
      placedKeys.add(key);
      if (r.actual_odds != null) placedOdds.set(key, Number(r.actual_odds));
      if (r.bookmaker) placedBook.set(key, r.bookmaker);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <BackLink />

      <header className="mt-4 mb-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-xl font-semibold text-neutral-100">{cfg.title}</h1>
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-400">
            {botRow.maturity_label ?? "—"}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-400">{cfg.subtitle}</p>
        <p className="mt-1 text-xs text-neutral-500">{cfg.detail}</p>
        <p className="mt-1 font-mono text-[11px] text-neutral-600">{botRow.name}</p>
      </header>

      {/* Stats + progress panel */}
      <section className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          <Stat label="Picks" value={bets.length.toString()} />
          <Stat label="Awaiting" value={pending.length.toString()} />
          <Stat label="Settled" value={settled.toString()} />
          <Stat
            label="Hit rate"
            value={hasROI ? `${hitRate.toFixed(0)}%` : "—"}
            faded={!hasROI}
          />
          <Stat
            label="Avg CLV"
            value={avgClvPct != null
              ? `${avgClvPct >= 0 ? "+" : ""}${avgClvPct.toFixed(1)}%`
              : "—"}
            faded={avgClvPct == null}
            tone={avgClvPct != null
              ? (avgClvPct >= 3 ? "good" : avgClvPct <= -3 ? "bad" : "neutral")
              : "neutral"}
          />
          <Stat
            label="ROI (exec price)"
            value={hasROI ? `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` : "—"}
            faded={!hasROI}
            tone={roiTone}
            emphasize
            hint="Priced at odds_at_pick_live — the best quote actually available from an accessible book at or before pick_time. Rows marked * had no live price captured and fall back to odds_at_pick, which is a high-water mark and can overstate the return."
          />
        </div>

        {/* Two-bar progress: settlements + observation days */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ProgressBar
            label="Settled"
            current={settled}
            target={MIN_SETTLED_FOR_DECISION}
            pct={settledProgress}
            tone={roiTone}
          />
          <ProgressBar
            label="Days observed"
            current={observationDays}
            target={MIN_DAYS_FOR_DECISION}
            pct={daysProgress}
            tone={roiTone}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
          <Chip dot="bg-emerald-400" n={wins.length} label="won" />
          <Chip dot="bg-rose-400" n={losses.length} label="lost" />
          <Chip dot="bg-neutral-500" n={voided.length} label="void" />
          <Chip dot="bg-sky-400" n={pending.length} label="pending" />
          <span className="ml-auto text-neutral-500">
            {readyForDecision
              ? "Ready for decision"
              : `Needs ${Math.max(0, MIN_SETTLED_FOR_DECISION - settled)} more settled, ${Math.max(
                  0,
                  MIN_DAYS_FOR_DECISION - observationDays
                )} more days`}
          </span>
        </div>
      </section>

      {/* Ledger */}
      <section>
        {bets.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-neutral-400">
            No picks yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
            {/* HEADER-ALIGN-2026-09-11: this header grid was missing the row's `sm:gap-3`,
                so its 1fr Match column absorbed the 11 missing gaps (~132px) and every
                label after it sat right of the data it named. Same template, same gap,
                as the <li> below — keep them in lockstep. */}
            <div className="hidden border-b border-white/[0.04] px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500 sm:grid sm:grid-cols-[95px_minmax(0,1fr)_42px_92px_55px_46px_78px_52px_52px_52px_74px_58px] sm:gap-3">
              <div>Kickoff</div>
              <div>Match</div>
              <div className="text-center" title="League tier at time of pick. T1 = Big-5 + top leagues, T4 = amateur / lower tiers.">
                Tier
              </div>
              <div>Pick</div>
              <div className="text-right" title="Executable price at pick time (odds_at_pick_live), falling back to odds_at_pick where no live price was captured — those rows are marked *.">Odds (exec)</div>
              <div className="text-right" title="The model probability the edge was computed from (calibrated_prob where available, else model_probability).">Prob</div>
              <div title="Real money actually staked: the price we got and the venue we got it at (real_bets). Where no real bet was placed, the dimmed name is the book the bot QUOTED (recommended_bookmaker) — a reference price, not a placement.">
                Bet made
              </div>
              <div className="text-right" title="Coolbet's CURRENT price for this selection (latest snapshot in the last 12h). Compare to Min odds — pending picks only.">
                Now CB
              </div>
              <div className="text-right" title="Unibet's CURRENT price (direct Kambi feed preferred, else the stale API-Football Unibet). Pending picks only.">
                Now UB
              </div>
              <div className="text-right" title="Epicbet's CURRENT price (30-min ingest at :02/:32 UTC). Pending picks only.">
                Now EB
              </div>
              <div className="text-right" title="Target minimum odds. Check manually at your book of choice — if the current price is ≥ this number, the pick still meets the bot's edge threshold. If lower, the edge has eroded past the threshold — skip.">
                Min odds ⓘ
              </div>
              <div className="text-right">Result</div>
            </div>
            <ul>
              {bets.map((b, i) => {
                const k = oddsKey(b.match_id, b.market, b.selection);
                return (
                  <BetRow
                    key={b.id}
                    bet={b}
                    isFirst={i === 0}
                    threshold={botEdgeThreshold(botName)}
                    cb={coolbetNow.get(k)}
                    ub={unibetNow.get(k)}
                    eb={epicbetNow.get(k)}
                    placedReal={placedKeys.has(k)}
                    placedOdds={placedOdds.get(k)}
                    placedBook={placedBook.get(k)}
                  />
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function BetRow({
  bet: b,
  isFirst,
  threshold,
  cb,
  ub,
  eb,
  placedReal,
  placedOdds,
  placedBook,
}: {
  bet: ShadowBetRow;
  isFirst: boolean;
  threshold: number;
  cb?: { odds: number; ts: string; src?: string };
  ub?: { odds: number; ts: string; src?: string };
  eb?: { odds: number; ts: string; src?: string };
  placedReal?: boolean;
  placedOdds?: number;
  placedBook?: string;
}) {
  const ko = b.matches?.date ? new Date(b.matches.date) : null;
  const kickoffDate = ko
    ? ko.toLocaleString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })
    : "—";
  const kickoffTime = ko
    ? ko.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
    : "";

  // Min odds to bet: the lowest price at which this pick would still fire the
  // bot's edge threshold.
  //
  // MIN-ODDS-DETAIL-PAGE-2026-09-06 — this page kept the pre-fix formula
  // `(1 + threshold) / model_probability` after the index page was corrected
  // on 2026-09-05, so the two admin views of the SAME pick disagreed.
  // Measured over 9,583 shadow picks in the last 45 days: this page's floor
  // was BELOW the index page's on 9,296 of them (97%), median −3.93%, p10
  // −9.78%. Against the true break-even it ran +8.00% high. The operator
  // places real money manually off this screen, so a floor that is too low
  // green-lights prices the bot's own gate would reject.
  //
  // The engine's edge is in probability POINTS — `edge = cal_prob - 1/odds`
  // (daily_pipeline_v2.py:3474) — not multiplicative EV. Solving the gate
  // `cal_prob - 1/odds >= threshold` for odds gives `1 / (cal_prob - threshold)`.
  // Same expression as the index page (page.tsx:901), deliberately.
  //
  // Prefers calibrated_prob — the probability the edge was actually computed
  // from — and falls back to model_probability, which is measured
  // overconfident and therefore yields a floor that is too low.
  const modelProb =
    b.calibrated_prob != null
      ? Number(b.calibrated_prob)
      : b.model_probability != null
        ? Number(b.model_probability)
        : null;
  const minBetOdds =
    modelProb && modelProb > threshold ? 1 / (modelProb - threshold) : null;

  const tier = b.matches?.leagues?.tier ?? null;
  const tierTone =
    tier === 1
      ? "bg-emerald-500/15 text-emerald-300"
      : tier === 2
      ? "bg-sky-500/15 text-sky-300"
      : tier === 3
      ? "bg-amber-500/15 text-amber-300"
      : tier === 4
      ? "bg-fuchsia-500/15 text-fuchsia-300"
      : "bg-neutral-500/15 text-neutral-400";

  return (
    <li
      className={`px-4 py-3 text-sm sm:grid sm:grid-cols-[95px_minmax(0,1fr)_42px_92px_55px_46px_78px_52px_52px_52px_74px_58px] sm:items-center sm:gap-3 sm:py-2 ${
        isFirst ? "" : "border-t border-white/[0.04]"
      }`}
    >
      <div className="font-mono text-xs text-neutral-400">
        <span className="text-neutral-200">{kickoffDate}</span>
        <span className="ml-1 text-neutral-500">{kickoffTime}</span>
      </div>
      <div className="mt-0.5 min-w-0 sm:mt-0">
        {/* BET-MADE-COLUMN-2026-09-11: the "€ real 3.25" badge used to sit here, eating
            the width the team names need on a 12-column grid. It now lives in the
            "Bet made" column together with the venue — one place that answers "did we
            stake this, at what price, where?" instead of two halves of that answer in
            two different columns. */}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm text-neutral-100">
            {b.matches?.home_team?.name ?? "Home"}{" "}
            <span className="text-neutral-500">vs</span>{" "}
            {b.matches?.away_team?.name ?? "Away"}
          </span>
        </div>
        <div className="truncate text-[11px] text-neutral-500">
          {b.matches?.leagues?.country ? `${b.matches.leagues.country} · ` : ""}
          {b.matches?.leagues?.name ?? ""}
        </div>
      </div>
      <div className="mt-0.5 text-center sm:mt-0">
        <span
          className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${tierTone}`}
          title={tier ? `Tier ${tier}` : "Tier unknown"}
        >
          {tier ? `T${tier}` : "—"}
        </span>
      </div>
      <div className="mt-0.5 text-sm text-emerald-300 sm:mt-0">
        {formatPickLabel(b.market, b.selection)}
      </div>
      <div className="mt-0.5 text-right font-mono text-sm tabular-nums text-neutral-100 sm:mt-0">
        {execOdds(b) > 0 ? execOdds(b).toFixed(2) : "—"}
        {b.odds_at_pick_live == null && b.odds_at_pick != null && (
          <span
            className="ml-1 text-[10px] text-amber-400/70"
            title="No live price captured for this pick — showing odds_at_pick, which is a high-water mark and may overstate the return."
          >
            *
          </span>
        )}
      </div>
      <div className="mt-0.5 text-right font-mono text-xs tabular-nums text-neutral-400 sm:mt-0">
        {modelProb != null ? `${(modelProb * 100).toFixed(0)}%` : "—"}
      </div>
      {placedReal ? (
        <div
          className="mt-0.5 leading-tight sm:mt-0"
          title={`Real money staked via the Coolbet UI placer${
            placedOdds ? ` @ ${placedOdds.toFixed(2)}` : ""
          }${placedBook ? ` at ${placedBook}` : ""}`}
        >
          <div className="font-mono text-xs font-semibold tabular-nums text-emerald-300">
            € {placedOdds ? placedOdds.toFixed(2) : "real"}
          </div>
          <div className="truncate text-[10px] text-emerald-400/70">
            {placedBook ?? b.recommended_bookmaker ?? "—"}
          </div>
        </div>
      ) : (
        <div
          className="mt-0.5 truncate text-xs text-neutral-500 sm:mt-0"
          title="No real bet placed on this pick — this is the book the bot quoted (recommended_bookmaker), a reference price only."
        >
          {b.recommended_bookmaker ?? "—"}
        </div>
      )}
      <div
        className="mt-0.5 text-right font-mono text-sm tabular-nums sm:mt-0"
        title={
          cb == null
            ? "No recent Coolbet price (pending picks only, last 12h)."
            : `Coolbet ${cb.odds.toFixed(2)} · snapshot ${new Date(cb.ts).toUTCString()}`
        }
      >
        {cb == null ? (
          <span className="text-neutral-600">—</span>
        ) : (
          <span className="text-sky-300">{cb.odds.toFixed(2)}</span>
        )}
      </div>
      <div
        className="mt-0.5 text-right font-mono text-sm tabular-nums sm:mt-0"
        title={
          ub == null
            ? "No recent Unibet price for this selection."
            : `Unibet ${ub.odds.toFixed(2)} · ${ub.src === "Unibet-Kambi" ? "direct Kambi feed" : "API-Football feed (STALE)"} · ${new Date(ub.ts).toUTCString()}`
        }
      >
        {ub == null ? (
          <span className="text-neutral-600">—</span>
        ) : (
          <span className={ub.src === "Unibet-Kambi" ? "text-emerald-300" : "text-amber-300/80"}>
            {ub.odds.toFixed(2)}
          </span>
        )}
      </div>
      <div
        className="mt-0.5 text-right font-mono text-sm tabular-nums sm:mt-0"
        title={
          eb == null
            ? "No recent Epicbet price for this selection (pending picks only, last 12h)."
            : `Epicbet ${eb.odds.toFixed(2)} · snapshot ${new Date(eb.ts).toUTCString()}`
        }
      >
        {eb == null ? (
          <span className="text-neutral-600">—</span>
        ) : (
          <span className="text-violet-300">{eb.odds.toFixed(2)}</span>
        )}
      </div>
      <div className="mt-0.5 text-right font-mono text-sm tabular-nums sm:mt-0" title="Manually check this at your book of choice (Coolbet, Bet365, whatever). If the current price meets or beats this number, the pick still has real edge. If not, skip.">
        {minBetOdds != null
          ? <span className="text-amber-300">≥{minBetOdds.toFixed(2)}</span>
          : <span className="text-neutral-600">—</span>}
      </div>
      <div className="mt-1 flex items-center justify-end sm:mt-0">
        <ResultBadge result={b.result} />
      </div>
    </li>
  );
}

function formatPickLabel(market: string, selection: string): string {
  const sel = (selection ?? "").toLowerCase();
  if (market === "1x2") {
    if (sel === "home") return "Home";
    if (sel === "draw") return "Draw";
    if (sel === "away") return "Away";
  }
  if (market === "btts") return sel === "yes" ? "BTTS yes" : "BTTS no";
  if (market.startsWith("over_under_")) {
    const line = market.replace("over_under_", "").replace("_", ".");
    return sel === "over" ? `Over ${line}` : `Under ${line}`;
  }
  return `${market} · ${sel}`;
}

function ResultBadge({ result }: { result: string | null }) {
  const base = "rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider";
  if (!result || result === "pending")
    return <span className={`${base} bg-sky-500/10 text-sky-400`}>Pending</span>;
  if (result === "won")
    return <span className={`${base} bg-emerald-500/15 text-emerald-400`}>Won</span>;
  if (result === "lost")
    return <span className={`${base} bg-rose-500/15 text-rose-400`}>Lost</span>;
  if (result === "void")
    return <span className={`${base} bg-neutral-500/15 text-neutral-400`}>Void</span>;
  return null;
}

function ProgressBar({
  label,
  current,
  target,
  pct,
  tone,
}: {
  label: string;
  current: number;
  target: number;
  pct: number;
  tone: "good" | "bad" | "neutral";
}) {
  const barTone =
    pct >= 100 && tone === "good"
      ? "bg-emerald-400"
      : pct >= 100 && tone === "bad"
      ? "bg-rose-400"
      : "bg-neutral-400";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="text-neutral-500">{label}</span>
        <span className="tabular-nums text-neutral-400">
          <span className="text-neutral-200">{current}</span>/{target}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
  faded = false,
  emphasize = false,
  // SHADOW-PAGE-ROI-INFLATED: lets the ROI card say which price basis it used.
  // A return figure without its basis is what made the old number misleading.
  hint,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
  faded?: boolean;
  emphasize?: boolean;
  hint?: string;
}) {
  const toneClass =
    tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-neutral-100";
  const size = emphasize ? "text-xl sm:text-2xl" : "text-lg";
  return (
    <div title={hint}>
      <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div
        className={`mt-1 font-mono font-semibold tabular-nums ${size} ${
          faded ? "text-neutral-600" : toneClass
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Chip({ dot, n, label }: { dot: string; n: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5 tabular-nums">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="text-neutral-200">{n}</span>
      <span className="text-neutral-500">{label}</span>
    </span>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/shadow-bots"
      className="text-xs text-neutral-500 underline underline-offset-4 hover:text-neutral-300"
    >
      ← All shadow bots
    </Link>
  );
}

function Denied({ text = "Access denied." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">{text}</div>
  );
}
