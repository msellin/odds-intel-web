export const dynamic = 'force-dynamic';

import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_POSTGREST_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.POSTGREST_SERVICE_KEY ??
      process.env.SUPABASE_SECRET_KEY!,
  );

interface Fixture {
  fixture_id: string;
  tournament_name: string | null;
  player_home: string;
  player_away: string;
  kickoff_time: string;
  pin_raw_home: number | null;
  pin_raw_away: number | null;
  threshold_home: number;
  threshold_away: number;
  pin_margin_pct: number | null;
  scanned_at: string;
}

interface ValueBet {
  fixture_id: string;
  selection: string;
  bookmaker: string;
  book_odds: number;
  edge_pct: number;
  stake: number;
}

interface SettledBet {
  id: string;
  fixture_id: string;
  tournament_name: string | null;
  player_home: string;
  player_away: string;
  selection: string;
  bookmaker: string;
  book_odds: number;
  edge_pct: number | null;
  stake: number;
  result: string;
  pnl: number | null;
  kickoff_time: string;
  closing_odds: number | null;
  clv: number | null;
  bot_id: string | null;
  fair_source: string | null;
}

interface SourceCount {
  fair_source: string;
  total: number;
  settled: number;
  unsettled: number;
  wins: number;
  losses: number;
  voids: number;
}

interface BotBreakdown {
  bot_id: string;
  n: number;
  wins: number;
  hit_rate: number;
  total_stake: number;
  total_pnl: number;
  roi: number;
  avg_clv: number | null;
}

interface PendingBet {
  fixture_id: string;
  tournament_name: string | null;
  player_home: string;
  player_away: string;
  kickoff_time: string;
  n: number;
}

interface PipelineRun {
  job_name: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  error_message: string | null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Tallinn",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/Tallinn",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOdds(n: number) {
  return n.toFixed(2);
}

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function fmtAgo(iso: string): string {
  const m = minutesAgo(iso);
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 48) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function EdgeBadge({ edge }: { edge: number }) {
  const color =
    edge >= 5 ? "bg-green-500" : edge >= 3 ? "bg-green-400" : "bg-yellow-400";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold text-black ${color}`}>
      +{edge.toFixed(1)}%
    </span>
  );
}

function ResultBadge({ result }: { result: string }) {
  const color =
    result === "win" ? "bg-green-500" :
    result === "loss" ? "bg-red-500" :
    "bg-gray-500";
  const label = result === "win" ? "W" : result === "loss" ? "L" : "V";
  return (
    <span className={`inline-block w-5 h-5 rounded text-xs font-bold text-white text-center leading-5 ${color}`}>
      {label}
    </span>
  );
}

function HealthDot({ status }: { status: "healthy" | "warning" | "error" | "unknown" }) {
  const color =
    status === "healthy" ? "bg-green-500" :
    status === "warning" ? "bg-yellow-500" :
    status === "error" ? "bg-red-500" :
    "bg-gray-500";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
}

interface BookBreakdown {
  bookmaker: string;
  n: number;
  wins: number;
  hit_rate: number;
  total_stake: number;
  total_pnl: number;
  roi: number;
}

interface EdgeBucket {
  label: string;
  n: number;
  wins: number;
  hit_rate: number;
  total_stake: number;
  total_pnl: number;
  roi: number;
}

interface SportBreakdown {
  tournament: string;
  n: number;
  wins: number;
  hit_rate: number;
  total_stake: number;
  total_pnl: number;
  roi: number;
}

function aggBy<T extends { stake: number; pnl: number | null; result: string }>(
  rows: T[],
  keyFn: (r: T) => string,
): Array<{ key: string; n: number; wins: number; total_stake: number; total_pnl: number }> {
  const acc: Record<string, { n: number; wins: number; total_stake: number; total_pnl: number }> = {};
  for (const r of rows) {
    const k = keyFn(r);
    if (!acc[k]) acc[k] = { n: 0, wins: 0, total_stake: 0, total_pnl: 0 };
    acc[k].n += 1;
    if (r.result === "win") acc[k].wins += 1;
    const stake = r.stake || 1.0;
    acc[k].total_stake += stake;
    acc[k].total_pnl += r.pnl ?? 0;
  }
  return Object.entries(acc).map(([key, v]) => ({ key, ...v }));
}

function bucketEdge(edge_pct: number): string {
  if (edge_pct >= 10) return "≥10%";
  if (edge_pct >= 5) return "5-10%";
  if (edge_pct >= 3) return "3-5%";
  return "0-3%";
}

export default async function TennisAdminPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Access denied.
      </div>
    );
  }

  const profilesDb = createServerServiceClient();
  const { data: profile } = await profilesDb
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_superadmin) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Superadmin only.
      </div>
    );
  }

  const db = serviceClient();
  const now = new Date();
  const startFloor = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const cutoff = new Date(now.getTime() + 36 * 3600 * 1000).toISOString();
  const settledFrom = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
  const pendingCutoff = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();

  const [
    { data: fixtures },
    { data: valueBets },
    { data: settled },
    { data: pendingRows },
    { data: pipelineRuns },
    { data: sourceRows },
  ] = await Promise.all([
    db
      .from("tennis_fixtures_today")
      .select("*")
      .gte("kickoff_time", startFloor)
      .lte("kickoff_time", cutoff)
      .order("kickoff_time", { ascending: true }),
    db
      .from("tennis_value_bets")
      .select("fixture_id, selection, bookmaker, book_odds, edge_pct, stake")
      .gte("kickoff_time", startFloor)
      .lte("kickoff_time", cutoff)
      .is("result", null)
      .order("edge_pct", { ascending: false }),
    db
      .from("tennis_value_bets")
      .select(
        "id, fixture_id, tournament_name, player_home, player_away, selection, bookmaker, book_odds, edge_pct, stake, result, pnl, kickoff_time, closing_odds, clv, bot_id, fair_source"
      )
      .not("result", "is", null)
      .gte("kickoff_time", settledFrom)
      .order("kickoff_time", { ascending: false })
      .limit(500),
    db
      .from("tennis_value_bets")
      .select("fixture_id, tournament_name, player_home, player_away, kickoff_time")
      .is("result", null)
      .lte("kickoff_time", pendingCutoff)
      .order("kickoff_time", { ascending: false })
      .limit(50),
    db
      .from("pipeline_runs")
      .select("job_name, status, started_at, ended_at, error_message")
      .in("job_name", ["tennis_scanner", "tennis_settlement"])
      .order("started_at", { ascending: false })
      .limit(20),
    // Phase 4 — every row from last 30d grouped by fair_source. Includes
    // unsettled coolbet_only observations, which are the main thing we
    // want to see growing once the new scanner deploys.
    db
      .from("tennis_value_bets")
      .select("fair_source, result")
      .gte("kickoff_time", settledFrom)
      .limit(20_000),
  ]);

  // Dedupe + filter numeric-ID legacy fixtures (same as before)
  const isNumericId = (s: string) => /^\d+$/.test(s.trim());
  const named = (fixtures ?? []).filter(
    (f) => !isNumericId(f.player_home) && !isNumericId(f.player_away)
  );
  const seen = new Set<string>();
  const deduped = named.filter((f) => {
    const players = [f.player_home, f.player_away].sort().join("|");
    const minute = new Date(f.kickoff_time).toISOString().slice(0, 16);
    const key = `${players}|${minute}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const fixtures_ = deduped as Fixture[];
  const valueBets_ = (valueBets ?? []) as ValueBet[];
  const settled_ = (settled ?? []) as SettledBet[];
  const runs_ = (pipelineRuns ?? []) as PipelineRun[];

  // Phase 4 — aggregate by fair_source (30d window). Distinguishes
  // Pinnacle-anchored actionable picks from Coolbet-only training
  // observations awaiting backfill.
  const sourceMap: Record<string, SourceCount> = {};
  for (const row of (sourceRows ?? []) as Array<{ fair_source: string | null; result: string | null }>) {
    const k = row.fair_source ?? "unknown";
    if (!sourceMap[k]) {
      sourceMap[k] = {
        fair_source: k,
        total: 0, settled: 0, unsettled: 0,
        wins: 0, losses: 0, voids: 0,
      };
    }
    const s = sourceMap[k];
    s.total += 1;
    if (row.result == null) {
      s.unsettled += 1;
    } else {
      s.settled += 1;
      if (row.result === "win") s.wins += 1;
      else if (row.result === "loss") s.losses += 1;
      else if (row.result === "void") s.voids += 1;
    }
  }
  const sources: SourceCount[] = Object.values(sourceMap).sort((a, b) => b.total - a.total);

  // Group pending by fixture
  const pendingByFixture: Record<string, PendingBet> = {};
  for (const p of pendingRows ?? []) {
    const k = p.fixture_id;
    if (!pendingByFixture[k]) pendingByFixture[k] = { ...(p as PendingBet), n: 0 };
    pendingByFixture[k].n += 1;
  }
  const pending = Object.values(pendingByFixture);

  // Index value bets by fixture_id
  const vbIndex: Record<string, ValueBet[]> = {};
  for (const vb of valueBets_) {
    const key = `${vb.fixture_id}`;
    if (!vbIndex[key]) vbIndex[key] = [];
    vbIndex[key].push(vb);
  }

  // System health from pipeline_runs
  const lastScannerRun = runs_.find((r) => r.job_name === "tennis_scanner");
  const lastSettlementRun = runs_.find((r) => r.job_name === "tennis_settlement");

  const scannerStatus: "healthy" | "warning" | "error" | "unknown" =
    !lastScannerRun ? "unknown" :
    lastScannerRun.status !== "completed" ? "error" :
    minutesAgo(lastScannerRun.started_at) > 12 * 60 ? "warning" :
    "healthy";

  const settlementStatus: "healthy" | "warning" | "error" | "unknown" =
    !lastSettlementRun ? "unknown" :
    lastSettlementRun.status !== "completed" ? "error" :
    minutesAgo(lastSettlementRun.started_at) > 24 * 60 ? "warning" :
    "healthy";

  // 30d settled aggregates
  const totSettled = settled_.length;
  const totWins = settled_.filter((s) => s.result === "win").length;
  const totLosses = settled_.filter((s) => s.result === "loss").length;
  const totVoids = settled_.filter((s) => s.result === "void").length;
  const settledNonVoid = settled_.filter((s) => s.result !== "void");
  const totStake = settledNonVoid.reduce((s, r) => s + (r.stake || 1), 0);
  const totPnl = settledNonVoid.reduce((s, r) => s + (r.pnl ?? 0), 0);
  const totRoi = totStake > 0 ? (totPnl / totStake) * 100 : 0;
  const hitRate = settledNonVoid.length > 0 ? (totWins / settledNonVoid.length) * 100 : 0;

  // Per-book breakdown
  const byBook: BookBreakdown[] = aggBy(settledNonVoid, (r) => r.bookmaker)
    .map((g) => ({
      bookmaker: g.key,
      n: g.n,
      wins: g.wins,
      hit_rate: g.n > 0 ? (g.wins / g.n) * 100 : 0,
      total_stake: g.total_stake,
      total_pnl: g.total_pnl,
      roi: g.total_stake > 0 ? (g.total_pnl / g.total_stake) * 100 : 0,
    }))
    .sort((a, b) => b.n - a.n);

  // Per-edge-band breakdown — exclude rows where edge_pct is null (Phase 4
  // coolbet_only observations have no Pinnacle reference and therefore no edge).
  const byEdge: EdgeBucket[] = aggBy(
    settledNonVoid.filter((r) => r.edge_pct != null),
    (r) => bucketEdge(r.edge_pct as number),
  )
    .map((g) => ({
      label: g.key,
      n: g.n,
      wins: g.wins,
      hit_rate: g.n > 0 ? (g.wins / g.n) * 100 : 0,
      total_stake: g.total_stake,
      total_pnl: g.total_pnl,
      roi: g.total_stake > 0 ? (g.total_pnl / g.total_stake) * 100 : 0,
    }))
    .sort((a, b) => {
      const order = ["≥10%", "5-10%", "3-5%", "0-3%"];
      return order.indexOf(a.label) - order.indexOf(b.label);
    });

  // Per-sport breakdown
  const bySport: SportBreakdown[] = aggBy(
    settledNonVoid,
    (r) => r.tournament_name ?? "Unknown"
  )
    .map((g) => ({
      tournament: g.key,
      n: g.n,
      wins: g.wins,
      hit_rate: g.n > 0 ? (g.wins / g.n) * 100 : 0,
      total_stake: g.total_stake,
      total_pnl: g.total_pnl,
      roi: g.total_stake > 0 ? (g.total_pnl / g.total_stake) * 100 : 0,
    }))
    .sort((a, b) => b.n - a.n);

  // Per-bot breakdown — uses bot_id from Phase 2. Includes CLV average
  // (the per-bot CLV signal is what tells us a strategy is genuinely +EV
  // vs lucky variance). null bot_id (very old rows before Phase 2 migration)
  // bucketed as 'legacy_unsegmented' for visibility.
  const byBotAgg: Record<string, { n: number; wins: number; total_stake: number; total_pnl: number; clv_sum: number; clv_n: number }> = {};
  for (const r of settledNonVoid) {
    const k = r.bot_id ?? "legacy_unsegmented";
    if (!byBotAgg[k]) byBotAgg[k] = { n: 0, wins: 0, total_stake: 0, total_pnl: 0, clv_sum: 0, clv_n: 0 };
    byBotAgg[k].n += 1;
    if (r.result === "win") byBotAgg[k].wins += 1;
    byBotAgg[k].total_stake += r.stake || 1;
    byBotAgg[k].total_pnl += r.pnl ?? 0;
    if (r.clv != null) { byBotAgg[k].clv_sum += r.clv; byBotAgg[k].clv_n += 1; }
  }
  const byBot: BotBreakdown[] = Object.entries(byBotAgg)
    .map(([bot_id, v]) => ({
      bot_id,
      n: v.n,
      wins: v.wins,
      hit_rate: v.n > 0 ? (v.wins / v.n) * 100 : 0,
      total_stake: v.total_stake,
      total_pnl: v.total_pnl,
      roi: v.total_stake > 0 ? (v.total_pnl / v.total_stake) * 100 : 0,
      avg_clv: v.clv_n > 0 ? (v.clv_sum / v.clv_n) * 100 : null,
    }))
    .sort((a, b) => b.n - a.n);

  const recentSettled = settled_.slice(0, 30);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Tennis — System Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Picks, settlement, and 30-day performance. Provider: The Odds API (Pinnacle + 5 soft books).
        </p>
      </div>

      {/* System health */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          System health
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Scanner</span>
              <HealthDot status={scannerStatus} />
            </div>
            <div className="font-mono text-sm">
              {lastScannerRun ? fmtAgo(lastScannerRun.started_at) : "never"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {lastScannerRun ? `status: ${lastScannerRun.status}` : "no runs yet"}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Settlement</span>
              <HealthDot status={settlementStatus} />
            </div>
            <div className="font-mono text-sm">
              {lastSettlementRun ? fmtAgo(lastSettlementRun.started_at) : "never"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {lastSettlementRun ? `status: ${lastSettlementRun.status}` : "no runs yet"}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Pending settlement</span>
              <HealthDot status={pending.length === 0 ? "healthy" : pending.length < 10 ? "warning" : "error"} />
            </div>
            <div className="font-mono text-sm">{pending.length} fixtures</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              past KO+2h, result NULL
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Today's pool</span>
              <HealthDot status={fixtures_.length > 0 ? "healthy" : "warning"} />
            </div>
            <div className="font-mono text-sm">{fixtures_.length} fixtures</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              next 36h
            </div>
          </div>
        </div>

        {/* Recent pipeline runs */}
        {runs_.length > 0 && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Recent pipeline runs ({runs_.length})
            </summary>
            <div className="mt-2 rounded-lg border overflow-hidden">
              <table className="w-full font-mono">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-2">job</th>
                    <th className="text-left p-2">started</th>
                    <th className="text-left p-2">status</th>
                    <th className="text-left p-2">error</th>
                  </tr>
                </thead>
                <tbody>
                  {runs_.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.job_name}</td>
                      <td className="p-2">{formatDateTime(r.started_at)}</td>
                      <td className={`p-2 ${r.status === "completed" ? "text-green-400" : "text-red-400"}`}>
                        {r.status}
                      </td>
                      <td className="p-2 text-muted-foreground truncate max-w-md">
                        {r.error_message ? r.error_message.slice(0, 80) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      {/* Data sources — Phase 4: shows volume per fair_source */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Data sources — last 30 days
        </h2>
        {sources.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No rows in the last 30 days. Scanner may not be running.
          </div>
        ) : (
          <>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">fair_source</th>
                    <th className="text-right p-2">total</th>
                    <th className="text-right p-2">settled</th>
                    <th className="text-right p-2">unsettled</th>
                    <th className="text-right p-2">W/L/V</th>
                    <th className="text-left p-2 pl-4">what this means</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => {
                    const label =
                      s.fair_source === "odds_api_pinnacle" ? "Actionable picks (edge vs Pinnacle de-vigged fair odds)" :
                      s.fair_source === "coolbet_only" ? "Training observations — no Pinnacle anchor, awaiting CSV backfill" :
                      s.fair_source === "legacy_unsegmented" ? "Pre-Phase-2 rows (before bot routing landed)" :
                      "—";
                    return (
                      <tr key={s.fair_source} className="border-t">
                        <td className="p-2">{s.fair_source}</td>
                        <td className="text-right p-2">{s.total}</td>
                        <td className="text-right p-2">{s.settled}</td>
                        <td className="text-right p-2 text-muted-foreground">{s.unsettled}</td>
                        <td className="text-right p-2 text-muted-foreground">{s.wins}/{s.losses}/{s.voids}</td>
                        <td className="p-2 pl-4 text-muted-foreground">{label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sources.some((s) => s.fair_source === "coolbet_only" && s.settled === 0 && s.unsettled > 0) && (
              <p className="text-xs text-muted-foreground mt-2">
                Coolbet-only observations need a results-backfill source — Sackmann is license-blocked, tennis-data.co.uk is dead. Open task: probe api-tennis.com free tier or Apify Flashscore scraper.
              </p>
            )}
          </>
        )}
      </section>

      {/* 30-day performance */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Settled — last 30 days
        </h2>
        {totSettled === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No settled bets yet. Settlement job populates this once matches finish.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Settled</div>
                <div className="font-mono text-xl">{totSettled}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {totWins}W / {totLosses}L / {totVoids}V
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Hit rate</div>
                <div className="font-mono text-xl">{hitRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  excluding voids
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Total stake</div>
                <div className="font-mono text-xl">{totStake.toFixed(1)}u</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Total PnL</div>
                <div className={`font-mono text-xl ${totPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {totPnl >= 0 ? "+" : ""}{totPnl.toFixed(2)}u
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">ROI</div>
                <div className={`font-mono text-xl ${totRoi >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {totRoi >= 0 ? "+" : ""}{totRoi.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* By bot — most important breakdown; shows CLV per persona */}
            <div className="mb-4 rounded-lg border overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 text-xs font-semibold uppercase">
                By bot persona (Phase 2)
              </div>
              <table className="w-full text-xs font-mono">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">bot_id</th>
                    <th className="text-right p-2">n</th>
                    <th className="text-right p-2">W/L/V</th>
                    <th className="text-right p-2">hit</th>
                    <th className="text-right p-2">stake</th>
                    <th className="text-right p-2">PnL</th>
                    <th className="text-right p-2">ROI</th>
                    <th className="text-right p-2">avg CLV</th>
                  </tr>
                </thead>
                <tbody>
                  {byBot.length === 0 ? (
                    <tr><td colSpan={8} className="p-3 text-center text-muted-foreground">No bot-segmented settled rows yet — first bot-routed picks land after migration 261 + scanner deploy</td></tr>
                  ) : (
                    byBot.map((b) => {
                      const wins = b.wins;
                      const losses = b.n - b.wins;
                      return (
                        <tr key={b.bot_id} className="border-t">
                          <td className="p-2">{b.bot_id}</td>
                          <td className="text-right p-2">{b.n}</td>
                          <td className="text-right p-2 text-muted-foreground">{wins}/{losses}/0</td>
                          <td className="text-right p-2">{b.hit_rate.toFixed(1)}%</td>
                          <td className="text-right p-2">{b.total_stake.toFixed(1)}u</td>
                          <td className={`text-right p-2 ${b.total_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {b.total_pnl >= 0 ? "+" : ""}{b.total_pnl.toFixed(2)}u
                          </td>
                          <td className={`text-right p-2 ${b.roi >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {b.roi >= 0 ? "+" : ""}{b.roi.toFixed(1)}%
                          </td>
                          <td className={`text-right p-2 ${b.avg_clv == null ? "text-muted-foreground" : b.avg_clv >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {b.avg_clv == null ? "—" : `${b.avg_clv >= 0 ? "+" : ""}${b.avg_clv.toFixed(2)}%`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Breakdowns */}
            <div className="grid lg:grid-cols-3 gap-4">
              {/* By edge band */}
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 text-xs font-semibold uppercase">
                  By edge band
                </div>
                <table className="w-full text-xs font-mono">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-left p-2">band</th><th className="text-right p-2">n</th><th className="text-right p-2">hit</th><th className="text-right p-2">ROI</th></tr>
                  </thead>
                  <tbody>
                    {byEdge.map((b) => (
                      <tr key={b.label} className="border-t">
                        <td className="p-2">{b.label}</td>
                        <td className="text-right p-2">{b.n}</td>
                        <td className="text-right p-2">{b.hit_rate.toFixed(0)}%</td>
                        <td className={`text-right p-2 ${b.roi >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {b.roi >= 0 ? "+" : ""}{b.roi.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* By bookmaker */}
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 text-xs font-semibold uppercase">
                  By bookmaker
                </div>
                <table className="w-full text-xs font-mono">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-left p-2">book</th><th className="text-right p-2">n</th><th className="text-right p-2">hit</th><th className="text-right p-2">ROI</th></tr>
                  </thead>
                  <tbody>
                    {byBook.map((b) => (
                      <tr key={b.bookmaker} className="border-t">
                        <td className="p-2">{b.bookmaker}</td>
                        <td className="text-right p-2">{b.n}</td>
                        <td className="text-right p-2">{b.hit_rate.toFixed(0)}%</td>
                        <td className={`text-right p-2 ${b.roi >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {b.roi >= 0 ? "+" : ""}{b.roi.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* By tournament/sport */}
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 text-xs font-semibold uppercase">
                  By tournament
                </div>
                <table className="w-full text-xs font-mono">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-left p-2">tour</th><th className="text-right p-2">n</th><th className="text-right p-2">hit</th><th className="text-right p-2">ROI</th></tr>
                  </thead>
                  <tbody>
                    {bySport.slice(0, 10).map((b) => (
                      <tr key={b.tournament} className="border-t">
                        <td className="p-2 truncate max-w-[12rem]">{b.tournament}</td>
                        <td className="text-right p-2">{b.n}</td>
                        <td className="text-right p-2">{b.hit_rate.toFixed(0)}%</td>
                        <td className={`text-right p-2 ${b.roi >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {b.roi >= 0 ? "+" : ""}{b.roi.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent settled bets list */}
            <div className="mt-4 rounded-lg border overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 text-xs font-semibold uppercase">
                Recent settled picks (last {recentSettled.length})
              </div>
              <table className="w-full text-xs font-mono">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">date</th>
                    <th className="text-left p-2">tour</th>
                    <th className="text-left p-2">pick</th>
                    <th className="text-left p-2">book</th>
                    <th className="text-right p-2">odds</th>
                    <th className="text-right p-2">edge</th>
                    <th className="text-center p-2">res</th>
                    <th className="text-right p-2">pnl</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSettled.map((b) => {
                    const player = b.selection === "home" ? b.player_home : b.player_away;
                    return (
                      <tr key={b.id} className="border-t">
                        <td className="p-2">{formatDateTime(b.kickoff_time)}</td>
                        <td className="p-2 truncate max-w-[10rem]">{b.tournament_name ?? "—"}</td>
                        <td className="p-2 truncate max-w-[12rem]">{player}</td>
                        <td className="p-2">{b.bookmaker}</td>
                        <td className="text-right p-2">{formatOdds(b.book_odds)}</td>
                        <td className="text-right p-2">{b.edge_pct == null ? "—" : `+${b.edge_pct.toFixed(1)}%`}</td>
                        <td className="text-center p-2"><ResultBadge result={b.result} /></td>
                        <td className={`text-right p-2 ${(b.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {(b.pnl ?? 0) >= 0 ? "+" : ""}{(b.pnl ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Pending settlement */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Pending settlement ({pending.length})
          </h2>
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left p-2">kickoff</th>
                  <th className="text-left p-2">tournament</th>
                  <th className="text-left p-2">match</th>
                  <th className="text-right p-2">rows</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.fixture_id} className="border-t border-yellow-500/20">
                    <td className="p-2">{formatDateTime(p.kickoff_time)}</td>
                    <td className="p-2">{p.tournament_name ?? "—"}</td>
                    <td className="p-2">{p.player_home} vs {p.player_away}</td>
                    <td className="text-right p-2">{p.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Settlement runs 02:00 + 14:15 UTC. Rows here past 24h suggest /scores didn't return the event — match may have been postponed or the sport key already deactivated.
          </p>
        </section>
      )}

      {/* Today's value sheet */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Today's value sheet
          </h2>
          <div className="text-xs text-muted-foreground">
            Bet if book odds exceed the threshold (Pinnacle de-vigged fair price).
          </div>
        </div>

        {fixtures_.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            No fixtures loaded. Scanner runs 06:00 + 14:00 UTC. Manual run:
            <br />
            <code className="text-sm mt-2 block">
              python3 scripts/tennis/odds_api_scanner.py
            </code>
          </div>
        ) : (
          <div className="space-y-3">
            {fixtures_.map((fix) => {
              const vbs = vbIndex[fix.fixture_id] ?? [];
              const homeVbs = vbs.filter((v) => v.selection === "home");
              const awayVbs = vbs.filter((v) => v.selection === "away");
              const hasValue = vbs.length > 0;

              return (
                <div
                  key={fix.fixture_id}
                  className={`rounded-lg border p-4 ${
                    hasValue ? "border-green-500/40 bg-green-500/5" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="text-xs text-muted-foreground">
                      {fix.tournament_name ?? "Unknown tournament"} · {formatTime(fix.kickoff_time)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      {fix.pin_margin_pct != null && (
                        <span>Pin margin: {fix.pin_margin_pct.toFixed(1)}%</span>
                      )}
                      {hasValue && (
                        <span className="text-green-400 font-semibold">VALUE FOUND</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        {
                          label: fix.player_home,
                          rawOdds: fix.pin_raw_home,
                          threshold: fix.threshold_home,
                          sideVbs: homeVbs,
                        },
                        {
                          label: fix.player_away,
                          rawOdds: fix.pin_raw_away,
                          threshold: fix.threshold_away,
                          sideVbs: awayVbs,
                        },
                      ] as const
                    ).map(({ label, rawOdds, threshold, sideVbs }) => (
                      <div
                        key={label}
                        className={`rounded-md p-3 border ${
                          sideVbs.length > 0
                            ? "border-green-500/50 bg-green-500/10"
                            : "border-border bg-muted/20"
                        }`}
                      >
                        <div className="text-xs font-mono text-muted-foreground mb-1">
                          {label}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold tabular-nums">
                            {formatOdds(threshold)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            min to bet
                          </span>
                        </div>
                        {rawOdds != null && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Pinnacle (raw): {formatOdds(rawOdds)}
                          </div>
                        )}

                        {sideVbs.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {sideVbs.map((vb, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="font-semibold text-green-300">
                                  {vb.bookmaker}
                                </span>
                                <span className="font-mono font-bold">
                                  {formatOdds(vb.book_odds)}
                                </span>
                                <EdgeBadge edge={vb.edge_pct} />
                                <span className="text-muted-foreground">
                                  {vb.stake.toFixed(2)}u
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {fixtures_.length > 0 && (
          <div className="text-xs text-muted-foreground border-t pt-4 mt-4 flex gap-6">
            <span>{fixtures_.length} fixtures loaded</span>
            <span>{valueBets_.length} active value picks (unsettled, next 36h)</span>
            <span>
              {valueBets_.filter((v) => v.edge_pct >= 5).length} at ≥5% edge
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
