export const dynamic = 'force-dynamic';

import { createSupabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { LogBetButton } from "./log-bet-button";
import { ScrapersPanel } from "./scrapers-panel";
// CS2-ADMIN-REFACTOR (2026-06-25): BacktestPanel removed from this page
// — it's a deep-dive view that belongs in /admin/models. The 4-card
// "Pipeline / Model Stats" panel was also removed (hardcoded baseline
// accuracy "58.9% on 9.2k matches" that doesn't refresh + counts
// duplicated by the KPI strip below). Recent-picks table removed too;
// the cs2_bot_activity_report.py CLI is the canonical place to inspect
// the pick log day-to-day.

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_POSTGREST_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.POSTGREST_SERVICE_KEY ??
      process.env.SUPABASE_SECRET_KEY!,
  );

interface Cs2Match {
  id: number;
  bo3gg_id: number | null;
  league: string;
  kickoff_time: string;
  state: string;
  best_of: number;
  team1: string;
  team2: string;
  elo1: number | null;
  elo2: number | null;
  win_prob1: number | null;
  win_prob2: number | null;
  fair_odds1: number | null;
  fair_odds2: number | null;
  threshold_odds1: number | null;
  threshold_odds2: number | null;
  fair_odds_map1: number | null;
  fair_odds_map2: number | null;
  threshold_map1: number | null;
  threshold_map2: number | null;
  bookie_odds1: number | null;
  bookie_odds2: number | null;
  coolbet_odds1: number | null;
  coolbet_odds2: number | null;
  coolbet_odds_map1: number | null;
  coolbet_odds_map2: number | null;
  pinnacle_odds1: number | null;
  pinnacle_odds2: number | null;
  roster_change1: boolean;
  roster_change2: boolean;
  roster_note1: string | null;
  roster_note2: string | null;
  player_rating1: number | null;
  player_rating2: number | null;
  is_lan: boolean | null;
  days_since_roster_change1: number | null;
  days_since_roster_change2: number | null;
  has_elo_history: boolean;
  scanned_at: string;
}

interface SimBet {
  id: number;
  bot_name: string;
  bo3gg_id: number;
  market: string;
  pick: string;
  bookie: string;
  odds_at_pick: number;
  edge: number;
  result: string | null;
  pnl: number | null;
  pnl_eur: number | null;
  stake_eur: number | null;
  n_books_at_pick: number | null;
  placed_at: string;
  team1: string;
  team2: string;
}

interface BotRow {
  name: string;
  current_bankroll: number;
  starting_bankroll: number;
  is_active: boolean;
}

interface PoolRow {
  threshold_odds1: number | null;
  bookie_odds1: number | null;
  coolbet_odds1: number | null;
  pinnacle_odds1: number | null;
}

interface BotActivity {
  name: string;
  fires: number;
  settled: number;
  wins: number;
  losses: number;
  pnl_eur: number;
  staked_eur: number;
  avg_edge: number | null;
  avg_books: number | null;
  single_book_fires: number;
  market_winner: number;
  market_atleast1map: number;
  market_clean_sweep: number;
}

interface HltvPred {
  bo3gg_id: number;
  win_prob1: number;
  win_prob2: number;
  fair_odds1: number;
  fair_odds2: number;
  hltv_rank1: number | null;
  hltv_rank2: number | null;
  hltv_points1: number | null;
  hltv_points2: number | null;
}

const HLTV_EDGE = 0.05; // matches the bot's HLTV_BASE_EDGE

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Tallinn",
  });
}

function fmtOdds(n: number | null) {
  return n != null ? n.toFixed(2) : "—";
}

const BOOKIES: Array<{ key: "bo3gg" | "coolbet" | "pinnacle"; label: string; k1: keyof Cs2Match; k2: keyof Cs2Match }> = [
  { key: "bo3gg",    label: "bo3.gg",   k1: "bookie_odds1",   k2: "bookie_odds2"   },
  { key: "coolbet",  label: "Coolbet",  k1: "coolbet_odds1",  k2: "coolbet_odds2"  },
  { key: "pinnacle", label: "Pinnacle", k1: "pinnacle_odds1", k2: "pinnacle_odds2" },
];

function isValueOdds(odds: number | null, thr: number | null): boolean {
  return odds != null && thr != null && odds >= thr;
}

function bestValueBookie(thr: number | null, m: Cs2Match, sideKey: "1" | "2") {
  if (thr == null) return null;
  let best: { bookie: string; odds: number; edgePct: number } | null = null;
  for (const b of BOOKIES) {
    const key = sideKey === "1" ? b.k1 : b.k2;
    const o = m[key] as number | null;
    if (o != null && o >= thr) {
      const edgePct = ((o - thr) / thr) * 100;
      if (!best || o > best.odds) best = { bookie: b.label, odds: o, edgePct };
    }
  }
  return best;
}

function PlayerRatingBadge({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  const color = rating >= 1.15 ? "text-green-400" : rating >= 1.05 ? "text-blue-400" : "text-muted-foreground";
  return <span className={`text-[10px] font-mono ${color}`}>PQ {rating.toFixed(2)}</span>;
}

export default async function Cs2AdminPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="flex items-center justify-center py-24 text-muted-foreground">Access denied.</div>;
  const { data: profile } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).single();
  if (!profile?.is_superadmin) return <div className="flex items-center justify-center py-24 text-muted-foreground">Superadmin only.</div>;

  const db = serviceClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();

  // CS2-ADMIN-REFACTOR (2026-06-25): the data fetches below are scoped
  // to what the page actually renders. We dropped the "live predictions
  // count", "backfill count", and "sim bet total" queries because they
  // backed the hardcoded-accuracy panel that's now gone. Added per-bot
  // 7d/30d activity + supply funnel + bots-table queries instead.
  const [
    { data: rows },
    { data: botRows30d },
    { data: pipelineRuns },
    { data: scraperRows },
    { data: bot7dRows },
    { data: allCs2BotsRows },
    { data: poolFor30dRows },
  ] = await Promise.all([
    // Match list — what the user is here to inspect
    db.from("cs2_upcoming_matches").select("*")
      .gte("kickoff_time", now.toISOString()).lte("kickoff_time", cutoff)
      .order("kickoff_time", { ascending: true }),
    // 30d sim-bets for the per-bot stats + recent in-match pick badges
    db.from("cs2_simulated_bets")
      .select("id,bot_name,bo3gg_id,market,pick,bookie,odds_at_pick,edge,result,pnl,pnl_eur,stake_eur,n_books_at_pick,placed_at,team1,team2")
      .gte("placed_at", thirtyDaysAgo)
      .order("placed_at", { ascending: false }),
    db.from("pipeline_runs").select("job_name,started_at,status")
      .like("job_name", "cs2%").order("started_at", { ascending: false }).limit(50),
    db.from("cs2_scraper_state").select("*").order("scraper_name", { ascending: true })
      .then((r) => ({ data: r.data ?? [] })),
    // 7d activity subset (used to populate the per-bot 7d columns separately)
    db.from("cs2_simulated_bets")
      .select("bot_name,result,pnl_eur,stake_eur,edge,market,n_books_at_pick")
      .gte("placed_at", sevenDaysAgo),
    // All cs2_* bots (so new bot names appear automatically)
    db.from("bots").select("name,current_bankroll,starting_bankroll,is_active")
      .like("name", "bot_cs2_%").order("name"),
    // Supply funnel: matches in next 7d kickoff window with column-null booleans
    db.from("cs2_upcoming_matches")
      .select("threshold_odds1,bookie_odds1,coolbet_odds1,pinnacle_odds1")
      .gte("kickoff_time", now.toISOString()).lte("kickoff_time", cutoff),
  ]);

  // CS2 bot bankrolls map (drives the LogBetButton € sizing AND the per-bot panel).
  const allCs2Bots: BotRow[] = (allCs2BotsRows ?? []) as BotRow[];
  const bankrollByBot = new Map<string, number>();
  for (const b of allCs2Bots) {
    bankrollByBot.set(b.name, Number(b.current_bankroll));
  }
  // LogBetButton fallback: pick the most-conservative (lowest) bankroll
  // across all enabled cs2 bots so the eur estimate never overshoots.
  const minCs2Bankroll = allCs2Bots.length
    ? Math.min(...allCs2Bots.filter((b) => b.is_active).map((b) => Number(b.current_bankroll)))
    : 1000;

  // Fetch latest fallback predictions — prefer v8 (AUC 0.703) over v7 (0.694)
  // over hltv_v1 (0.673) when multiple exist for a match. Same preference
  // order as cs2_bot.py uses.
  const upcomingBo3IDs = ((rows ?? []) as Cs2Match[])
    .map((m) => m.bo3gg_id).filter((id): id is number => id != null);
  const { data: hltvPredRows } = upcomingBo3IDs.length
    ? await db.from("cs2_predictions")
        .select("bo3gg_id,win_prob1,win_prob2,fair_odds1,fair_odds2,hltv_rank1,hltv_rank2,hltv_points1,hltv_points2,scan_time,model_version")
        .in("model_version", ["v8", "v7", "hltv_v1"])
        .in("bo3gg_id", upcomingBo3IDs)
        .order("scan_time", { ascending: false })
    : { data: [] };
  // Walk rows once with model preference v8 > v7 > hltv_v1.
  const hltvByMatch = new Map<number, HltvPred>();
  const sourceByMatch = new Map<number, string>();
  const v8Seen = new Set<number>();
  const v7Seen = new Set<number>();
  for (const p of (hltvPredRows ?? []) as (HltvPred & { model_version?: string })[]) {
    const mv = p.model_version;
    const id = p.bo3gg_id;
    if (mv === "v8") {
      if (!v8Seen.has(id)) {
        hltvByMatch.set(id, p); sourceByMatch.set(id, "v8"); v8Seen.add(id);
      }
    } else if (mv === "v7") {
      if (!v8Seen.has(id) && !v7Seen.has(id)) {
        hltvByMatch.set(id, p); sourceByMatch.set(id, "v7"); v7Seen.add(id);
      }
    } else {
      if (!v8Seen.has(id) && !v7Seen.has(id) && !hltvByMatch.has(id)) {
        hltvByMatch.set(id, p); sourceByMatch.set(id, "hltv_v1");
      }
    }
  }
  const v8Coverage = v8Seen.size;
  const v7Coverage = v7Seen.size;
  const hltvOnlyCoverage = hltvByMatch.size - v8Coverage - v7Coverage;

  // Aggregate latest run per CS2 job
  const cs2Jobs = ["cs2_scanner", "cs2_settlement", "cs2_coolbet_scanner", "cs2_bot", "cs2_pandascore_rosters"];
  const latestByJob = new Map<string, { started_at: string; status: string }>();
  for (const r of (pipelineRuns ?? [])) {
    if (!latestByJob.has(r.job_name)) {
      latestByJob.set(r.job_name, { started_at: r.started_at, status: r.status });
    }
  }
  const stalenessHours = (iso: string | undefined) =>
    iso ? (now.getTime() - new Date(iso).getTime()) / 3_600_000 : Infinity;
  const expectedStalenessHours: Record<string, number> = {
    cs2_scanner: 6, cs2_settlement: 2, cs2_coolbet_scanner: 1,
    cs2_bot: 6, cs2_pandascore_rosters: 30,
  };

  const matches = (rows ?? []) as Cs2Match[];
  const bots = (botRows30d ?? []) as SimBet[];
  const botByMatch = new Map<number, SimBet[]>();
  for (const b of bots) {
    const arr = botByMatch.get(b.bo3gg_id) ?? [];
    arr.push(b); botByMatch.set(b.bo3gg_id, arr);
  }

  const scannedAt = matches[0]?.scanned_at
    ? new Date(matches[0].scanned_at).toLocaleString("en-GB", {
        timeZone: "Europe/Tallinn", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      }) : null;

  // Market consensus prob (median of 1/odds across quoting books) — same logic
  // as cs2_bot.py market_consensus().
  const marketConsensusProb = (m: Cs2Match, side: "1" | "2"): number | null => {
    const odds = [
      side === "1" ? m.bookie_odds1   : m.bookie_odds2,
      side === "1" ? m.coolbet_odds1  : m.coolbet_odds2,
      side === "1" ? m.pinnacle_odds1 : m.pinnacle_odds2,
    ].filter((o): o is number => o != null && o > 1.0);
    if (odds.length === 0) return null;
    const implied = odds.map((o) => 1 / o).sort((a, b) => a - b);
    const n = implied.length;
    return n % 2 === 0
      ? (implied[n / 2 - 1] + implied[n / 2]) / 2
      : implied[Math.floor(n / 2)];
  };

  // Effective threshold = ELO threshold if covered, else HLTV-derived
  // (fair × 0.95) when both teams are HLTV-ranked.
  //
  // GATE (added 2026-06-09 after Virtus.pro vs Oxuji incident): the HLTV-rank
  // model is a NAIVE prior — it knows only rank diff. When the market
  // consensus disagrees by >15pp with our HLTV-derived prob, the model is
  // almost always wrong. Suppress the threshold rather than publishing a
  // misleading "bet ≥ X" recommendation. The bot uses MAX_MODEL_VS_CONSENSUS_PP
  // = 0.15 for the same check; the UI must follow the same skepticism.
  const HLTV_MODEL_MARKET_PP_GATE = 0.15;
  const effThr = (m: Cs2Match, side: "1" | "2"): number | null => {
    const eloThr = side === "1" ? m.threshold_odds1 : m.threshold_odds2;
    if (eloThr != null) return eloThr;
    const h = m.bo3gg_id != null ? hltvByMatch.get(m.bo3gg_id) : undefined;
    if (!h) return null;
    const f = side === "1" ? h.fair_odds1 : h.fair_odds2;
    if (f == null) return null;

    // Market-disagreement gate
    const ourProb = 1 / f;
    const marketProb = marketConsensusProb(m, side);
    if (marketProb != null && Math.abs(ourProb - marketProb) > HLTV_MODEL_MARKET_PP_GATE) {
      return null;
    }
    return +(f * (1 - HLTV_EDGE)).toFixed(2);
  };

  // Sibling helper: did the gate fire for this side? Used by the UI to show
  // a "model unreliable" badge instead of just a blank field.
  const hltvModelSuppressed = (m: Cs2Match, side: "1" | "2"): boolean => {
    const eloThr = side === "1" ? m.threshold_odds1 : m.threshold_odds2;
    if (eloThr != null) return false;  // ELO covers it; no gate applied
    const h = m.bo3gg_id != null ? hltvByMatch.get(m.bo3gg_id) : undefined;
    if (!h) return false;
    const f = side === "1" ? h.fair_odds1 : h.fair_odds2;
    if (f == null) return false;
    const ourProb = 1 / f;
    const marketProb = marketConsensusProb(m, side);
    return marketProb != null
        && Math.abs(ourProb - marketProb) > HLTV_MODEL_MARKET_PP_GATE;
  };

  const valueCount = matches.reduce((acc, m) => {
    let n = 0;
    const t1 = effThr(m, "1");
    const t2 = effThr(m, "2");
    if (t1 != null && BOOKIES.some((b) => isValueOdds(m[b.k1] as number | null, t1))) n++;
    if (t2 != null && BOOKIES.some((b) => isValueOdds(m[b.k2] as number | null, t2))) n++;
    return acc + n;
  }, 0);

  const hltvCoverage = matches.filter((m) =>
    m.bo3gg_id != null && hltvByMatch.has(m.bo3gg_id)).length;
  const anyCoverage = matches.filter((m) =>
    m.has_elo_history || (m.bo3gg_id != null && hltvByMatch.has(m.bo3gg_id))).length;

  // After migration 210 the storage is one bet per (bot, market, pick), so
  // no JS dedupe needed — every row IS a real-money decision.
  // Headline counters (30d window, all bots pooled) — feeds the KPI strip.
  const settledBots = bots.filter((b) => b.result === "won" || b.result === "lost");
  const wins = settledBots.filter((b) => b.result === "won").length;
  const losses = settledBots.length - wins;
  const totalPnlEur = settledBots.reduce((acc, b) => acc + (b.pnl_eur ?? 0), 0);

  // ── Per-bot 7d activity table (REPLACES the old fixed-2-bot per-bot
  // breakdown). Mirrors cs2_bot_activity_report.py's 7d window. We start
  // from the full bots table so EVERY enabled cs2_* bot appears (catches
  // new bots like aggressive_v1/dog_v1/fav_v1 without code changes), then
  // overlay the 7d aggregates from cs2_simulated_bets.
  const activity7d: Map<string, BotActivity> = new Map();
  for (const b of allCs2Bots) {
    activity7d.set(b.name, {
      name: b.name, fires: 0, settled: 0, wins: 0, losses: 0,
      pnl_eur: 0, staked_eur: 0, avg_edge: null, avg_books: null,
      single_book_fires: 0, market_winner: 0, market_atleast1map: 0,
      market_clean_sweep: 0,
    });
  }
  const edgeAcc: Map<string, { sum: number; n: number }> = new Map();
  const booksAcc: Map<string, { sum: number; n: number }> = new Map();
  for (const r of (bot7dRows ?? []) as Partial<SimBet>[]) {
    const name = r.bot_name || "";
    const a = activity7d.get(name);
    if (!a) continue;
    a.fires++;
    if (r.market === "match_winner") a.market_winner++;
    else if (r.market === "atleast1map") a.market_atleast1map++;
    else if (r.market === "clean_sweep") a.market_clean_sweep++;
    if (r.n_books_at_pick != null) {
      const ba = booksAcc.get(name) ?? { sum: 0, n: 0 };
      ba.sum += Number(r.n_books_at_pick); ba.n++;
      booksAcc.set(name, ba);
      if (Number(r.n_books_at_pick) === 1) a.single_book_fires++;
    }
    if (r.edge != null) {
      const ea = edgeAcc.get(name) ?? { sum: 0, n: 0 };
      ea.sum += Number(r.edge); ea.n++;
      edgeAcc.set(name, ea);
    }
    if (r.result === "won" || r.result === "lost") {
      a.settled++;
      if (r.result === "won") a.wins++; else a.losses++;
      if (r.pnl_eur != null) a.pnl_eur += Number(r.pnl_eur);
      if (r.stake_eur != null) a.staked_eur += Number(r.stake_eur);
    }
  }
  for (const [name, a] of activity7d) {
    const ea = edgeAcc.get(name);
    if (ea && ea.n > 0) a.avg_edge = ea.sum / ea.n;
    const ba = booksAcc.get(name);
    if (ba && ba.n > 0) a.avg_books = ba.sum / ba.n;
  }
  // Sort: fired bots first (descending), then silent bots alphabetically
  const botActivityList = Array.from(activity7d.values()).sort((x, y) => {
    if ((x.fires > 0) !== (y.fires > 0)) return y.fires - x.fires;
    if (x.fires !== y.fires) return y.fires - x.fires;
    return x.name.localeCompare(y.name);
  });
  const silentBots = botActivityList.filter((b) => b.fires === 0).map((b) => b.name);

  // ── Supply funnel (7d kickoff window). Mirrors the activity-report CLI.
  const pool: PoolRow[] = (poolFor30dRows ?? []) as PoolRow[];
  const poolTotal = pool.length;
  const poolWithThreshold = pool.filter((r) => r.threshold_odds1 != null).length;
  const poolEligible1Book = pool.filter((r) =>
    r.threshold_odds1 != null && (
      r.bookie_odds1 != null || r.coolbet_odds1 != null || r.pinnacle_odds1 != null
    )
  ).length;
  const poolEligible2Books = pool.filter((r) => {
    if (r.threshold_odds1 == null) return false;
    const n = (r.bookie_odds1 != null ? 1 : 0)
            + (r.coolbet_odds1 != null ? 1 : 0)
            + (r.pinnacle_odds1 != null ? 1 : 0);
    return n >= 2;
  }).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">CS2 — Value Sheet</h1>
          <p className="text-xs text-muted-foreground mt-1">
            All games · Multi-book odds (bo3.gg, Coolbet, Pinnacle) · Green = bookmaker ≥ model threshold (value).
            Threshold = ELO+PQ fair price × 0.97 (3% baseline edge).
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground shrink-0">
          {scannedAt ? <>Last scan: <span className="font-mono">{scannedAt}</span></>
                     : <span className="text-yellow-400">No data — run scanner</span>}
        </div>
      </div>

      {/* Scrapers self-healing state */}
      <ScrapersPanel rows={scraperRows ?? []} />

      {/* Pipeline Health */}
      <div className="rounded border border-border p-2 text-xs">
        <div className="text-muted-foreground text-[10px] uppercase tracking-wide font-semibold mb-1.5">
          Pipeline health (cron last-run)
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {cs2Jobs.map((job) => {
            const last = latestByJob.get(job);
            const stale = stalenessHours(last?.started_at);
            const limit = expectedStalenessHours[job] ?? 24;
            const ok = stale <= limit;
            const lastStr = last
              ? new Date(last.started_at).toLocaleString("en-GB", { timeZone: "Europe/Tallinn",
                  hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })
              : "never";
            const color = !last ? "text-muted-foreground/60"
                       : !ok ? "text-orange-400"
                       : "text-green-400";
            const dot = !last ? "bg-muted-foreground/40"
                     : !ok ? "bg-orange-400"
                     : "bg-green-400";
            return (
              <div key={job} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                <span className="font-mono text-foreground">{job.replace("cs2_", "")}</span>
                <span className={`${color} ml-auto font-mono`}>{lastStr}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI strip — slate + 30d bot record (footer summary merged in) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
        <div className="rounded border border-border p-2">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Matches (7d)</div>
          <div className="text-lg font-bold tabular-nums">{matches.length}</div>
          <div className="text-[9px] text-muted-foreground tabular-nums">
            {matches.filter((m) => m.best_of >= 3).length} BO3/5 · {matches.filter((m) => m.is_lan).length} LAN · {matches.filter((m) => m.state === "inProgress").length} live
          </div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Model coverage</div>
          <div className="text-lg font-bold tabular-nums">{anyCoverage}</div>
          <div className="text-[9px] text-muted-foreground tabular-nums">
            ELO {matches.filter((m) => m.has_elo_history).length}
            {v8Coverage > 0 && <> · <span className="text-emerald-400">v8 {v8Coverage}</span></>}
            {v7Coverage > 0 && <> · <span className="text-cyan-400">v7 {v7Coverage}</span></>}
            {hltvOnlyCoverage > 0 && <> · <span className="text-purple-400">hltv {hltvOnlyCoverage}</span></>}
          </div>
        </div>
        <div className="rounded border border-green-500/30 bg-green-500/5 p-2">
          <div className="text-green-400 text-[10px] uppercase tracking-wide font-semibold">Value picks</div>
          <div className="text-lg font-bold tabular-nums text-green-400">{valueCount}</div>
          <div className="text-[9px] text-muted-foreground tabular-nums">
            {matches.filter((m) => m.roster_change1 || m.roster_change2).length} roster-change
          </div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Bot record (30d)</div>
          <div className="text-sm font-bold tabular-nums">
            {wins}W-{losses}L
            <span className={`ml-1 ${totalPnlEur >= 0 ? "text-green-400" : "text-red-400"}`}>
              ({totalPnlEur >= 0 ? "+" : ""}€{totalPnlEur.toFixed(2)})
            </span>
          </div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Pending</div>
          <div className="text-lg font-bold tabular-nums text-blue-400">
            {bots.filter((b) => b.result == null).length}
          </div>
          <div className="text-[9px] text-muted-foreground">awaiting settlement</div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Bots (active)</div>
          <div className="text-lg font-bold tabular-nums">
            {allCs2Bots.filter((b) => b.is_active).length}
          </div>
          <div className="text-[9px] text-muted-foreground tabular-nums">
            of {allCs2Bots.length} configured
          </div>
        </div>
      </div>

      {/* Activity & Supply panel — per-bot 7d table + supply funnel + silent-bot flag.
          Direct mirror of cs2_bot_activity_report.py so the operator can confirm
          the CLI's findings here too. */}
      <div className="rounded border border-blue-500/20 bg-blue-500/5 p-3 text-xs space-y-3">
        <div className="text-blue-400 text-[10px] uppercase tracking-wide font-semibold">
          Per-bot activity (last 7d) — {allCs2Bots.length} bots configured
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] tabular-nums">
            <thead className="text-muted-foreground text-[10px] uppercase">
              <tr>
                <th className="text-left font-normal pr-2">Bot</th>
                <th className="text-right font-normal px-2">Fires</th>
                <th className="text-right font-normal px-2">Set</th>
                <th className="text-right font-normal px-2">W-L</th>
                <th className="text-right font-normal px-2">PnL</th>
                <th className="text-right font-normal px-2">ROI</th>
                <th className="text-right font-normal px-2">Avg edge</th>
                <th className="text-right font-normal px-2">Avg #bk</th>
                <th className="text-right font-normal px-2">1bk</th>
                <th className="text-right font-normal px-2">MW</th>
                <th className="text-right font-normal px-2">A1M</th>
                <th className="text-right font-normal px-2">CS</th>
                <th className="text-right font-normal pl-2">Bankroll</th>
              </tr>
            </thead>
            <tbody>
              {botActivityList.map((a) => {
                const isFired = a.fires > 0;
                const roi = a.staked_eur > 0 ? (a.pnl_eur / a.staked_eur) * 100 : null;
                const bankroll = bankrollByBot.get(a.name);
                return (
                  <tr key={a.name} className={`border-t border-border/30 ${isFired ? "" : "opacity-50"}`}>
                    <td className="pr-2 font-mono">{a.name.replace("bot_cs2_", "")}</td>
                    <td className="text-right px-2">{a.fires || "—"}</td>
                    <td className="text-right px-2 text-muted-foreground">{a.settled || "—"}</td>
                    <td className="text-right px-2">{a.settled ? `${a.wins}-${a.losses}` : "—"}</td>
                    <td className={`text-right px-2 ${a.pnl_eur > 0 ? "text-green-400" : a.pnl_eur < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {a.settled ? (a.pnl_eur >= 0 ? "+" : "") + `€${a.pnl_eur.toFixed(2)}` : "—"}
                    </td>
                    <td className={`text-right px-2 ${roi == null ? "text-muted-foreground" : roi >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {roi != null ? (roi >= 0 ? "+" : "") + roi.toFixed(1) + "%" : "—"}
                    </td>
                    <td className="text-right px-2 text-muted-foreground">
                      {a.avg_edge != null ? "+" + (a.avg_edge * 100).toFixed(1) + "%" : "—"}
                    </td>
                    <td className="text-right px-2 text-muted-foreground">
                      {a.avg_books != null ? a.avg_books.toFixed(2) : "—"}
                    </td>
                    <td className="text-right px-2 text-muted-foreground">{a.single_book_fires || "—"}</td>
                    <td className="text-right px-2 text-muted-foreground">{a.market_winner || "—"}</td>
                    <td className="text-right px-2 text-muted-foreground">{a.market_atleast1map || "—"}</td>
                    <td className="text-right px-2 text-muted-foreground">{a.market_clean_sweep || "—"}</td>
                    <td className="text-right pl-2 font-mono">
                      {bankroll != null ? `€${bankroll.toFixed(0)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Silent-bot warning */}
        {silentBots.length > 0 && (
          <div className="text-[10px] text-orange-300/80 border-t border-orange-500/20 pt-2">
            <span className="font-semibold uppercase tracking-wide">⚠ Silent (0 fires in 7d):</span>{" "}
            <span className="font-mono">{silentBots.map((n) => n.replace("bot_cs2_", "")).join(", ")}</span>
            <span className="text-muted-foreground"> — check supply funnel below + per-bot edge floors.</span>
          </div>
        )}
        {/* Supply funnel */}
        <div className="border-t border-blue-500/20 pt-2">
          <div className="text-blue-400 text-[10px] uppercase tracking-wide font-semibold mb-1">
            Supply funnel (next 7d kickoff window)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] tabular-nums">
            <div>
              <div className="text-muted-foreground text-[10px]">Pool</div>
              <div className="font-bold">{poolTotal}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">+ Model coverage (thr)</div>
              <div className="font-bold">{poolWithThreshold}</div>
              <div className="text-[9px] text-muted-foreground">
                {poolTotal ? ((poolWithThreshold / poolTotal) * 100).toFixed(1) : "0"}%
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">+ ≥1 book (relaxed)</div>
              <div className="font-bold text-emerald-400">{poolEligible1Book}</div>
              <div className="text-[9px] text-muted-foreground">
                new bots eligible
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">+ ≥2 books (canonical)</div>
              <div className="font-bold">{poolEligible2Books}</div>
              <div className="text-[9px] text-muted-foreground">
                {poolEligible2Books ? `${(poolEligible1Book / poolEligible2Books).toFixed(2)}× unlock` : "—"}
              </div>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground italic border-t border-blue-500/10 pt-2">
          For deeper inspection (n_books distribution per bot, full recent-picks log,
          per-market ROI breakdown), run{" "}
          <code className="font-mono">python3 scripts/esports/cs2_bot_activity_report.py</code>.
        </div>
      </div>

      {/* Match list */}
      {matches.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No upcoming matches loaded. <br />
          <code className="text-sm mt-2 block">python3 scripts/esports/cs2_elo_scanner.py --record</code>
        </div>
      ) : (
        <div className="space-y-1.5">
          {matches.map((m) => {
            const isLive = m.state === "inProgress";
            const hasRosterWarning = m.roster_change1 || m.roster_change2;
            const sides = [
              {
                key: "1" as const, name: m.team1, elo: m.elo1, prob: m.win_prob1,
                fair: m.fair_odds1, thr: m.threshold_odds1,
                fairMap: m.fair_odds_map1, thrMap: m.threshold_map1,
                coolbetMap: m.coolbet_odds_map1,
                rosterChange: m.roster_change1, rosterNote: m.roster_note1,
                playerRating: m.player_rating1,
                dsrc: m.days_since_roster_change1,
              },
              {
                key: "2" as const, name: m.team2, elo: m.elo2, prob: m.win_prob2,
                fair: m.fair_odds2, thr: m.threshold_odds2,
                fairMap: m.fair_odds_map2, thrMap: m.threshold_map2,
                coolbetMap: m.coolbet_odds_map2,
                rosterChange: m.roster_change2, rosterNote: m.roster_note2,
                playerRating: m.player_rating2,
                dsrc: m.days_since_roster_change2,
              },
            ];
            // Voided bets are kept in the DB for audit but shouldn't surface
            // as "live bot picks" — they failed today's gates and were marked
            // voided manually (or by future automated re-validation).
            const matchBots = (botByMatch.get(m.bo3gg_id ?? -1) ?? [])
              .filter((b) => b.result !== "voided");
            const hasBotPick = matchBots.length > 0;
            const botPickResults = matchBots
              .map((b) => b.result)
              .filter((r): r is string => r === "won" || r === "lost");
            const botWonAll = botPickResults.length > 0 && botPickResults.every((r) => r === "won");
            const botLostAll = botPickResults.length > 0 && botPickResults.every((r) => r === "lost");

            return (
              <div key={m.id}
                className={`rounded border ${
                  isLive ? "border-yellow-500/50 bg-yellow-500/5" :
                  hasBotPick && botWonAll ? "border-green-500/40 bg-green-500/5" :
                  hasBotPick && botLostAll ? "border-red-500/40 bg-red-500/5" :
                  hasBotPick ? "border-blue-500/40 bg-blue-500/5" :
                  hasRosterWarning ? "border-orange-500/30 bg-orange-500/5" :
                  "border-border bg-card/30"
                }`}
              >
                {/* Compact header */}
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 text-[11px] flex-wrap">
                  {hasBotPick && (
                    <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      🤖 BOT {matchBots.length} pick{matchBots.length > 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="font-mono text-foreground">{formatTime(m.kickoff_time)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground truncate max-w-md">{m.league}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-mono text-muted-foreground">BO{m.best_of}</span>
                  {m.is_lan && <span className="text-blue-300 bg-blue-500/10 border border-blue-500/30 px-1 rounded text-[10px]">LAN</span>}
                  {isLive && <span className="text-yellow-400 font-bold animate-pulse">⚡LIVE</span>}
                  {!m.has_elo_history && <span className="text-orange-400">no model coverage</span>}
                </div>

                {/* Roster warnings inline */}
                {hasRosterWarning && (
                  <div className="px-3 py-1 bg-orange-500/10 border-b border-orange-500/20 text-[11px] text-orange-300">
                    {m.roster_change1 && m.roster_note1 && <span>⚠ {m.team1}: {m.roster_note1}</span>}
                    {m.roster_change1 && m.roster_change2 && <span className="mx-2">·</span>}
                    {m.roster_change2 && m.roster_note2 && <span>⚠ {m.team2}: {m.roster_note2}</span>}
                  </div>
                )}

                {/* Team rows */}
                <div className="divide-y divide-border/30">
                  {sides.map((t) => {
                    // HLTV fallback when ELO is gated for this match
                    const hltv = m.bo3gg_id != null ? hltvByMatch.get(m.bo3gg_id) : undefined;
                    const hltvFair = hltv ? (t.key === "1" ? hltv.fair_odds1 : hltv.fair_odds2) : null;
                    const hltvProb = hltv ? (t.key === "1" ? hltv.win_prob1 : hltv.win_prob2) : null;
                    const hltvRank = hltv ? (t.key === "1" ? hltv.hltv_rank1 : hltv.hltv_rank2) : null;
                    const usingHltv = t.thr == null && hltvFair != null;
                    // Use the centralized effThr helper so the market-disagreement
                    // gate applies here too (the gate kills the threshold when
                    // HLTV-model disagrees with market consensus by >15pp).
                    // (Renamed local to avoid shadowing the outer effThr helper.)
                    const effThrVal = effThr(m, t.key);
                    const effFair = t.fair ?? hltvFair ?? null;
                    const modelSuppressed = hltvModelSuppressed(m, t.key);
                    const value = bestValueBookie(effThrVal, m, t.key);
                    return (
                      <div key={t.name} className="grid grid-cols-12 gap-2 px-3 py-2 items-center text-xs">
                        {/* Team meta */}
                        <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold truncate">{t.name}</span>
                          {t.rosterChange && <span className="text-orange-400 text-xs">⚠</span>}
                          {t.elo != null && <span className="font-mono text-[10px] text-muted-foreground">ELO {Math.round(t.elo)}</span>}
                          <PlayerRatingBadge rating={t.playerRating} />
                          {hltvRank != null && <span className="text-purple-300 text-[10px] font-mono bg-purple-500/10 px-1 rounded">HLTV #{hltvRank}</span>}
                          {t.prob != null && <span className="text-muted-foreground text-[10px]">· ELO {Math.round(t.prob * 100)}%</span>}
                          {usingHltv && hltvProb != null && <span className="text-purple-400 text-[10px]">· HLTV {Math.round(hltvProb * 100)}%</span>}
                        </div>

                        {/* Model threshold */}
                        <div className="col-span-2 text-[11px]">
                          {effThrVal != null ? (
                            <div>
                              <span className="text-muted-foreground">bet ≥</span>{" "}
                              <span className={`font-bold tabular-nums ${usingHltv ? "text-purple-300" : ""}`}>{fmtOdds(effThrVal)}</span>
                              <div className="text-[10px] text-muted-foreground">
                                fair {fmtOdds(effFair)} {usingHltv && <span className="text-purple-400">(HLTV)</span>}
                              </div>
                            </div>
                          ) : modelSuppressed ? (
                            <div title="Model disagreed with market consensus by >15pp. Skip — sharp money knows more than our rank-only model.">
                              <span className="text-orange-300 italic font-semibold">model overruled</span>
                              <div className="text-[10px] text-muted-foreground">
                                market &lt;&gt; HLTV
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">no model</span>
                          )}
                        </div>

                        {/* Bookie odds row */}
                        <div className="col-span-4 flex items-center gap-2 text-[11px] font-mono">
                          {BOOKIES.map((b) => {
                            const odds = m[t.key === "1" ? b.k1 : b.k2] as number | null;
                            const isValue = isValueOdds(odds, effThrVal);
                            if (odds == null) {
                              return <div key={b.key} className="text-muted-foreground/40 w-16 text-center">—</div>;
                            }
                            return (
                              <div key={b.key} className={`w-16 text-center px-1 py-0.5 rounded ${isValue ? "bg-green-500/15 text-green-400 font-bold ring-1 ring-green-500/40" : "text-muted-foreground"}`}>
                                <div>{odds.toFixed(2)}</div>
                                <div className="text-[9px] tracking-tight opacity-70">{b.label}</div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Action */}
                        <div className="col-span-2 flex items-center justify-end gap-1">
                          {value && (
                            <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider mr-1">
                              +{value.edgePct.toFixed(0)}%
                            </span>
                          )}
                          <LogBetButton
                            matchId={m.id}
                            teamName={t.name}
                            market="match_winner"
                            fairOdds={effFair}
                            thresholdOdds={effThrVal}
                            winProb={t.prob ?? (hltvProb ?? null)}
                            bankrollEur={minCs2Bankroll}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ≥1 map markets — collapsed on its own line when present.
                    Edge shown when coolbet_odds_map* is populated (mig 250). */}
                {m.best_of >= 3 && m.threshold_map1 != null && (
                  <div className="px-3 py-1.5 border-t border-border/40 text-[11px] flex items-center gap-3 bg-muted/10 flex-wrap">
                    <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Wins ≥1 map</span>
                    {sides.map((t) => {
                      // Compute model fair prob from fair_odds_map (1/fair = prob).
                      // Edge = coolbetOdds * prob - 1. Display only when both
                      // values exist and edge is meaningfully positive (≥ 1%).
                      const fairProb = t.fairMap ? 1 / t.fairMap : null;
                      const edge = (t.coolbetMap && fairProb)
                        ? t.coolbetMap * fairProb - 1
                        : null;
                      const edgeColor = edge == null
                        ? "text-muted-foreground"
                        : edge >= 0.05 ? "text-green-400"
                        : edge >= 0.01 ? "text-yellow-400"
                        : "text-red-400";
                      const meetsThreshold = t.coolbetMap && t.thrMap && t.coolbetMap >= t.thrMap;
                      return (
                        <div key={t.name} className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">{t.name.split(" ")[0]}:</span>
                          <span className="font-mono">bet ≥ <span className="font-bold">{fmtOdds(t.thrMap)}</span></span>
                          {t.coolbetMap != null && (
                            <span className="font-mono text-muted-foreground">
                              · CB <span className={meetsThreshold ? "text-green-400 font-bold" : ""}>{fmtOdds(t.coolbetMap)}</span>
                            </span>
                          )}
                          {edge != null && (
                            <span className={`font-mono font-semibold ${edgeColor}`}>
                              {edge >= 0 ? "+" : ""}{Math.round(edge * 100)}%
                            </span>
                          )}
                          <LogBetButton
                            matchId={m.id} teamName={t.name} market="atleast1map"
                            fairOdds={t.fairMap} thresholdOdds={t.thrMap}
                            bankrollEur={minCs2Bankroll}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Bot picks fired on this match */}
                {matchBots.length > 0 && (
                  <div className="px-3 py-1.5 border-t border-border/40 text-[10px] flex items-center gap-3 flex-wrap bg-blue-500/5">
                    <span className="text-blue-400 uppercase tracking-wider font-semibold">Bot</span>
                    {matchBots.map((b) => {
                      const isHltv = b.bot_name === "bot_cs2_hltv_v1";
                      return (
                        <span key={b.id} className={`font-mono ${isHltv ? "text-purple-300" : ""}`}>
                          {isHltv && <span className="bg-purple-500/15 px-1 rounded mr-1">HLTV</span>}
                          {b.pick} @ {b.bookie} {b.odds_at_pick.toFixed(2)}
                          {b.edge != null && <span className="text-muted-foreground"> · edge +{Math.round(b.edge * 100)}%</span>}
                          {b.result === "won" && <span className="text-green-400"> ✓</span>}
                          {b.result === "lost" && <span className="text-red-400"> ✗</span>}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer summary merged into the KPI strip at the top (BO3/5,
          LAN, live, roster-change counts) — section removed 2026-06-25. */}
    </div>
  );
}
