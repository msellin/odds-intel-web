export const dynamic = 'force-dynamic';

import { createSupabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { LogBetButton } from "./log-bet-button";

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [
    { data: rows },
    { data: botRows },
    { count: livePredCount },
    { count: livePredTodayCount },
    { count: backfillPredCount },
    { count: simBetTotal },
    { data: pipelineRuns },
  ] = await Promise.all([
    db.from("cs2_upcoming_matches").select("*")
      .gte("kickoff_time", now.toISOString()).lte("kickoff_time", cutoff)
      .order("kickoff_time", { ascending: true }),
    db.from("cs2_simulated_bets").select("id,bot_name,bo3gg_id,market,pick,bookie,odds_at_pick,edge,result,pnl")
      .order("placed_at", { ascending: false }).limit(200),
    db.from("cs2_predictions").select("*", { count: "exact", head: true })
      .eq("model_version", "elo+pq_v1"),
    db.from("cs2_predictions").select("*", { count: "exact", head: true })
      .eq("model_version", "elo+pq_v1").gte("scan_time", todayStart.toISOString()),
    db.from("cs2_predictions").select("*", { count: "exact", head: true })
      .like("model_version", "%backfill%"),
    db.from("cs2_simulated_bets").select("*", { count: "exact", head: true }),
    db.from("pipeline_runs").select("job_name,started_at,status")
      .like("job_name", "cs2%").order("started_at", { ascending: false }).limit(50),
  ]);

  // Fetch latest hltv_v1 predictions for matches in the upcoming window
  const upcomingBo3IDs = ((rows ?? []) as Cs2Match[])
    .map((m) => m.bo3gg_id).filter((id): id is number => id != null);
  const { data: hltvPredRows } = upcomingBo3IDs.length
    ? await db.from("cs2_predictions")
        .select("bo3gg_id,win_prob1,win_prob2,fair_odds1,fair_odds2,hltv_rank1,hltv_rank2,hltv_points1,hltv_points2,scan_time")
        .eq("model_version", "hltv_v1").in("bo3gg_id", upcomingBo3IDs)
        .order("scan_time", { ascending: false })
    : { data: [] };
  const hltvByMatch = new Map<number, HltvPred>();
  for (const p of (hltvPredRows ?? []) as HltvPred[]) {
    if (!hltvByMatch.has(p.bo3gg_id)) hltvByMatch.set(p.bo3gg_id, p);
  }

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
  const bots = (botRows ?? []) as SimBet[];
  const botByMatch = new Map<number, SimBet[]>();
  for (const b of bots) {
    const arr = botByMatch.get(b.bo3gg_id) ?? [];
    arr.push(b); botByMatch.set(b.bo3gg_id, arr);
  }

  const scannedAt = matches[0]?.scanned_at
    ? new Date(matches[0].scanned_at).toLocaleString("en-GB", {
        timeZone: "Europe/Tallinn", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      }) : null;

  // Effective threshold = ELO threshold if covered, else HLTV-derived
  // (fair × 0.95) when both teams are HLTV-ranked. Value count + coverage
  // counts both pricing sources.
  const effThr = (m: Cs2Match, side: "1" | "2"): number | null => {
    const eloThr = side === "1" ? m.threshold_odds1 : m.threshold_odds2;
    if (eloThr != null) return eloThr;
    const h = m.bo3gg_id != null ? hltvByMatch.get(m.bo3gg_id) : undefined;
    if (!h) return null;
    const f = side === "1" ? h.fair_odds1 : h.fair_odds2;
    return f != null ? +(f * (1 - HLTV_EDGE)).toFixed(2) : null;
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

  const settledBots = bots.filter((b) => b.result === "won" || b.result === "lost");
  const wins = settledBots.filter((b) => b.result === "won").length;
  const losses = settledBots.length - wins;
  const totalPnl = settledBots.reduce((acc, b) => acc + (b.pnl ?? 0), 0);

  // Per-bot breakdown
  type BotStats = { name: string; total: number; settled: number; wins: number; losses: number; pnl: number };
  const botStatsMap = new Map<string, BotStats>();
  for (const b of bots) {
    const name = b.bot_name || "bot_cs2_value_v1";
    const s = botStatsMap.get(name) ?? { name, total: 0, settled: 0, wins: 0, losses: 0, pnl: 0 };
    s.total++;
    if (b.result === "won") { s.settled++; s.wins++; s.pnl += b.pnl ?? 0; }
    else if (b.result === "lost") { s.settled++; s.losses++; s.pnl += b.pnl ?? 0; }
    botStatsMap.set(name, s);
  }
  const botStats = Array.from(botStatsMap.values()).sort((a, b) => b.total - a.total);

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

      {/* Pipeline / Model Stats */}
      <div className="rounded border border-blue-500/20 bg-blue-500/5 p-3 text-xs grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="text-blue-400 text-[10px] uppercase tracking-wide font-semibold">Live predictions</div>
          <div className="text-lg font-bold tabular-nums">{(livePredCount ?? 0).toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">
            +{livePredTodayCount ?? 0} today · scanner every 4h
          </div>
        </div>
        <div>
          <div className="text-blue-400 text-[10px] uppercase tracking-wide font-semibold">Historical (backfill)</div>
          <div className="text-lg font-bold tabular-nums">{(backfillPredCount ?? 0).toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">
            Walk-forward, calibration source
          </div>
        </div>
        <div>
          <div className="text-blue-400 text-[10px] uppercase tracking-wide font-semibold">Bot bets total</div>
          <div className="text-lg font-bold tabular-nums">{(simBetTotal ?? 0).toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">
            bot_cs2_value_v1 · single bot
          </div>
        </div>
        <div>
          <div className="text-blue-400 text-[10px] uppercase tracking-wide font-semibold">Model accuracy</div>
          <div className="text-lg font-bold tabular-nums">58.9%</div>
          <div className="text-[10px] text-muted-foreground">
            ECE 3.0% · 9.2k matches (ELO baseline)
          </div>
        </div>
      </div>

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

      {/* KPI strip (today's slate) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <div className="rounded border border-border p-2">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Matches</div>
          <div className="text-lg font-bold tabular-nums">{matches.length}</div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Model coverage</div>
          <div className="text-lg font-bold tabular-nums">{anyCoverage}</div>
          <div className="text-[9px] text-muted-foreground tabular-nums">
            ELO {matches.filter((m) => m.has_elo_history).length} ·
            <span className="text-purple-400"> HLTV {hltvCoverage}</span>
          </div>
        </div>
        <div className="rounded border border-green-500/30 bg-green-500/5 p-2">
          <div className="text-green-400 text-[10px] uppercase tracking-wide font-semibold">Value picks</div>
          <div className="text-lg font-bold tabular-nums text-green-400">{valueCount}</div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Bot record</div>
          <div className="text-sm font-bold tabular-nums">
            {wins}W-{losses}L
            <span className={`ml-1 ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              ({totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}u)
            </span>
          </div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Pending bets</div>
          <div className="text-lg font-bold tabular-nums text-blue-400">
            {bots.filter((b) => b.result == null).length}
          </div>
          <div className="text-[9px] text-muted-foreground">awaiting settlement</div>
        </div>
      </div>

      {/* Per-bot breakdown */}
      {botStats.length > 0 && (
        <div className="rounded border border-blue-500/20 bg-blue-500/5 p-2 text-xs">
          <div className="text-blue-400 text-[10px] uppercase tracking-wide font-semibold mb-1.5">
            Bots ({botStats.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {botStats.map((s) => {
              const isHltv = s.name === "bot_cs2_hltv_v1";
              const roi = s.settled > 0 ? (s.pnl / s.settled) * 100 : 0;
              return (
                <div key={s.name} className={`flex items-center gap-2 px-2 py-1.5 rounded ${isHltv ? "bg-purple-500/10 border border-purple-500/20" : "bg-card/30 border border-border"}`}>
                  <span className={`text-[11px] font-mono font-semibold ${isHltv ? "text-purple-300" : "text-foreground"}`}>
                    {s.name.replace("bot_cs2_", "")}
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    {s.total} bets · {s.settled} settled
                  </span>
                  <span className="ml-auto font-mono text-[11px]">
                    {s.wins}W-{s.losses}L
                    <span className={`ml-1 ${s.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      ({s.pnl >= 0 ? "+" : ""}{s.pnl.toFixed(2)}u)
                    </span>
                    {s.settled >= 5 && (
                      <span className={`ml-1 text-[10px] ${roi >= 0 ? "text-green-400" : "text-red-400"}`}>
                        ROI {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                rosterChange: m.roster_change1, rosterNote: m.roster_note1,
                playerRating: m.player_rating1,
                dsrc: m.days_since_roster_change1,
              },
              {
                key: "2" as const, name: m.team2, elo: m.elo2, prob: m.win_prob2,
                fair: m.fair_odds2, thr: m.threshold_odds2,
                fairMap: m.fair_odds_map2, thrMap: m.threshold_map2,
                rosterChange: m.roster_change2, rosterNote: m.roster_note2,
                playerRating: m.player_rating2,
                dsrc: m.days_since_roster_change2,
              },
            ];
            const matchBots = botByMatch.get(m.bo3gg_id ?? -1) ?? [];

            return (
              <div key={m.id}
                className={`rounded border ${
                  isLive ? "border-yellow-500/50 bg-yellow-500/5" :
                  hasRosterWarning ? "border-orange-500/30 bg-orange-500/5" :
                  "border-border bg-card/30"
                }`}
              >
                {/* Compact header */}
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 text-[11px] flex-wrap">
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
                    const effThr = t.thr ?? (usingHltv && hltvFair ? +(hltvFair * (1 - HLTV_EDGE)).toFixed(2) : null);
                    const effFair = t.fair ?? hltvFair ?? null;
                    const value = bestValueBookie(effThr, m, t.key);
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
                          {effThr != null ? (
                            <div>
                              <span className="text-muted-foreground">bet ≥</span>{" "}
                              <span className={`font-bold tabular-nums ${usingHltv ? "text-purple-300" : ""}`}>{fmtOdds(effThr)}</span>
                              <div className="text-[10px] text-muted-foreground">
                                fair {fmtOdds(effFair)} {usingHltv && <span className="text-purple-400">(HLTV)</span>}
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
                            const isValue = isValueOdds(odds, effThr);
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
                            fairOdds={t.fair}
                            thresholdOdds={t.thr}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ≥1 map markets — collapsed on its own line when present */}
                {m.best_of >= 3 && m.threshold_map1 != null && (
                  <div className="px-3 py-1.5 border-t border-border/40 text-[11px] flex items-center gap-3 bg-muted/10">
                    <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Wins ≥1 map</span>
                    {sides.map((t) => (
                      <div key={t.name} className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{t.name.split(" ")[0]}:</span>
                        <span className="font-mono">bet ≥ <span className="font-bold">{fmtOdds(t.thrMap)}</span></span>
                        <LogBetButton
                          matchId={m.id} teamName={t.name} market="atleast1map"
                          fairOdds={t.fairMap} thresholdOdds={t.thrMap}
                        />
                      </div>
                    ))}
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

      {/* Footer summary */}
      {matches.length > 0 && (
        <div className="text-xs text-muted-foreground border-t pt-3 flex flex-wrap gap-6 mt-4">
          <span>{matches.length} matches</span>
          <span>{matches.filter((m) => m.best_of >= 3).length} BO3/5</span>
          <span>{matches.filter((m) => m.is_lan).length} LAN</span>
          <span>{matches.filter((m) => m.state === "inProgress").length} live</span>
          <span className="text-green-400">{valueCount} value picks</span>
          <span className="text-orange-400">{matches.filter((m) => m.roster_change1 || m.roster_change2).length} roster changes</span>
        </div>
      )}
    </div>
  );
}
