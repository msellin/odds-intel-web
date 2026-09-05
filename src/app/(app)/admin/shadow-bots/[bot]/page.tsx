/**
 * /admin/shadow-bots/[bot] — per-bot ledger for a single shadow bot.
 *
 * Restricted to the four known shadow bot names to prevent arbitrary bot
 * inspection via URL path.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";

const STAKE = 10;
const MIN_SETTLED_FOR_DECISION = 50;
const MIN_DAYS_FOR_DECISION = 14;

// Per-bot edge threshold (mirrors the bot's config in daily_pipeline_v2.py).
// Used to compute "min odds to bet at" per pick: min_odds = (1 + threshold)
// / model_probability. If Coolbet (or any accessible book) offers ≥ min_odds
// at placement time, the pick still passes the bot's threshold.
// PER-BOT-SWEEP-2026-08-24: the three line-shop bots gate on DE-VIGGED edge
// (daily_pipeline_v2.py `_LINESHOP_TRUE_EDGE_MIN`). Picks written before
// 2026-08-24 carry vig-inclusive edge and are not comparable.
const BOT_EDGE_THRESHOLDS: Record<string, number> = {
  bot_no_pin_shadow_v1: 0.08,
  bot_no_pin_home_v1: 0.08,
  bot_sweep_1x2_home_v1: 0.10,
  bot_sweep_1x2_draw_v1: 0.05,
  bot_sweep_btts_yes_v1: 0.05,
  bot_coolbet_value_v1: 0.03,
  bot_sweep_ou25_v1: 0.03,
  bot_sweep_ou35_v1: 0.03,
  bot_pin_1x2_home_v1: 0.03,
  bot_pin_1x2_draw_tier4_v1: 0.05,
};

const ALLOWED: Record<string, { title: string; subtitle: string; detail: string }> = {
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
function execOdds(b: { odds_at_pick: number | null; odds_at_pick_live: number | null }): number {
  const live = b.odds_at_pick_live != null ? Number(b.odds_at_pick_live) : null;
  if (live != null && live > 1) return live;
  return Number(b.odds_at_pick ?? 0);
}

interface ShadowBetRow {
  id: string;
  market: string;
  selection: string;
  odds_at_pick: number | null;
  odds_at_pick_live: number | null;
  model_probability: number | null;
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
       edge_percent, recommended_bookmaker, pick_time, result, clv,
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
            <div className="hidden border-b border-white/[0.04] px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500 sm:grid sm:grid-cols-[95px_1fr_45px_95px_55px_55px_70px_85px_60px]">
              <div>Kickoff</div>
              <div>Match</div>
              <div className="text-center" title="League tier at time of pick. T1 = Big-5 + top leagues, T4 = amateur / lower tiers.">
                Tier
              </div>
              <div>Pick</div>
              <div className="text-right" title="Executable price at pick time (odds_at_pick_live), falling back to odds_at_pick where no live price was captured — those rows are marked *.">Odds (exec)</div>
              <div className="text-right">Prob</div>
              <div>Book</div>
              <div className="text-right" title="Target minimum odds. Check manually at your book of choice — if the current price is ≥ this number, the pick still meets the bot's edge threshold. If lower, the edge has eroded past the threshold — skip.">
                Min odds ⓘ
              </div>
              <div className="text-right">Result</div>
            </div>
            <ul>
              {bets.map((b, i) => (
                <BetRow key={b.id} bet={b} isFirst={i === 0} threshold={BOT_EDGE_THRESHOLDS[botName] ?? 0.08} />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function BetRow({ bet: b, isFirst, threshold }: { bet: ShadowBetRow; isFirst: boolean; threshold: number }) {
  const ko = b.matches?.date ? new Date(b.matches.date) : null;
  const kickoffDate = ko
    ? ko.toLocaleString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })
    : "—";
  const kickoffTime = ko
    ? ko.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
    : "";

  // Min odds to bet: minimum price at which this pick would still fire the bot's
  // edge threshold. Formula: min_odds = (1 + threshold) / model_probability.
  // Example: threshold 8%, model_probability 40% → min_odds = 1.08 / 0.40 = 2.70.
  // If Coolbet (or any book) shows ≥ 2.70 at placement time, the bet is worth
  // taking. If lower, edge has eroded past the threshold — skip.
  const modelProb = b.model_probability != null ? Number(b.model_probability) : null;
  const minBetOdds = modelProb && modelProb > 0
    ? (1 + threshold) / modelProb
    : null;

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
      className={`px-4 py-3 text-sm sm:grid sm:grid-cols-[95px_1fr_45px_95px_55px_55px_70px_85px_60px] sm:items-center sm:gap-3 sm:py-2 ${
        isFirst ? "" : "border-t border-white/[0.04]"
      }`}
    >
      <div className="font-mono text-xs text-neutral-400">
        <span className="text-neutral-200">{kickoffDate}</span>
        <span className="ml-1 text-neutral-500">{kickoffTime}</span>
      </div>
      <div className="mt-0.5 min-w-0 sm:mt-0">
        <div className="truncate text-sm text-neutral-100">
          {b.matches?.home_team?.name ?? "Home"}{" "}
          <span className="text-neutral-500">vs</span>{" "}
          {b.matches?.away_team?.name ?? "Away"}
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
      <div className="mt-0.5 text-xs text-neutral-300 sm:mt-0">
        {b.recommended_bookmaker ?? "—"}
      </div>
      <div className="mt-0.5 text-right font-mono text-sm tabular-nums sm:mt-0" title="Manually check this at your book of choice (Coolbet, Bet365, whatever). If the current price meets or beats this number, the pick still has real edge. If not, skip.">
        {minBetOdds != null
          ? <span className="text-amber-300">≥{minBetOdds.toFixed(2)}</span>
          : <span className="text-neutral-600">—</span>}
      </div>
      <div className="mt-1 text-right sm:mt-0">
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
