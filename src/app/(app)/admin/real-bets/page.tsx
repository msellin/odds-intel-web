export const dynamic = "force-dynamic";

import { createSupabaseServer } from "@/lib/supabase-server";
import { getRealBets, MARKET_THRESHOLDS_V2_EPOCH, type RealBet } from "@/lib/engine-data";
import { RealBetsLog } from "@/components/real-bets-log";
import { RealBetsChart, type RealBetsChartPoint } from "@/components/real-bets-chart";

function fmtMoney(v: number) {
  const sign = v >= 0 ? "+" : "−";
  return `${sign}€${Math.abs(v).toFixed(2)}`;
}
function fmtPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

interface AggStats {
  total: number;
  settled: number;
  pending: number;
  won: number;
  lost: number;
  void: number;
  staked: number;
  pnl: number;
  roi: number;
  meanSlip: number | null;
}

function aggregate(bets: RealBet[]): AggStats {
  const settled = bets.filter((b) => b.result !== "pending");
  const won = settled.filter((b) => b.result === "won").length;
  const lost = settled.filter((b) => b.result === "lost").length;
  // ADMIN-REAL-BETS-VOID-COUNT (2026-06-06): track voids separately so the
  // "Won / lost" tile doesn't mysteriously leave settled out of count.
  // Operator-flagged 2026-06-06: "13 settled, 5 won + 7 lost = missing 1?" —
  // the missing one was a void (refunded bet, neither outcome).
  const voidN = settled.filter((b) => b.result === "void").length;
  const staked = settled.reduce((s, b) => s + b.stake, 0);
  const pnl = settled.reduce((s, b) => s + (b.pnl ?? 0), 0);
  const roi = staked > 0 ? (pnl / staked) * 100 : 0;
  const withSlip = settled.filter((b) => b.slippagePct != null);
  const meanSlip =
    withSlip.length > 0
      ? withSlip.reduce((s, b) => s + (b.slippagePct ?? 0), 0) / withSlip.length
      : null;
  return {
    total: bets.length,
    settled: settled.length,
    pending: bets.length - settled.length,
    won,
    lost,
    void: voidN,
    staked,
    pnl,
    roi,
    meanSlip,
  };
}

/** Daily breakdown (last N days, newest first). Buckets by UTC day. */
interface DailyRow {
  day: string;
  n: number;
  settled: number;
  staked: number;
  pnl: number;
  roi: number | null;
}
function buildDailyBreakdown(bets: RealBet[], days: number): DailyRow[] {
  const byDay = new Map<string, DailyRow>();
  for (const b of bets) {
    const day = utcDay(b.placedAt);
    let row = byDay.get(day);
    if (!row) {
      row = { day, n: 0, settled: 0, staked: 0, pnl: 0, roi: null };
      byDay.set(day, row);
    }
    row.n += 1;
    if (b.result !== "pending") {
      row.settled += 1;
      row.staked += b.stake;
      row.pnl += b.pnl ?? 0;
    }
  }
  for (const row of byDay.values()) {
    row.roi = row.staked > 0 ? (row.pnl / row.staked) * 100 : null;
  }
  return Array.from(byDay.values())
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .slice(0, days);
}

/** Cumulative P&L series. Bets are bucketed by resolved_at (or placed_at if missing). */
function buildCumulativeSeries(bets: RealBet[]): RealBetsChartPoint[] {
  const settled = bets
    .filter((b) => b.result !== "pending")
    .map((b) => ({
      day: utcDay(b.resolvedAt ?? b.placedAt),
      real: b.pnl ?? 0,
      paper: b.paper && b.paper.result !== "pending" ? b.paper.pnl ?? 0 : null,
    }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  if (!settled.length) return [];

  // Aggregate per day, then accumulate.
  const byDay = new Map<string, { real: number; paper: number | null; hasPaper: boolean }>();
  for (const s of settled) {
    let bucket = byDay.get(s.day);
    if (!bucket) {
      bucket = { real: 0, paper: 0, hasPaper: false };
      byDay.set(s.day, bucket);
    }
    bucket.real += s.real;
    if (s.paper != null) {
      bucket.paper = (bucket.paper ?? 0) + s.paper;
      bucket.hasPaper = true;
    }
  }
  const days = Array.from(byDay.keys()).sort();
  let cumReal = 0;
  let cumPaper = 0;
  let paperEverSeen = false;
  return days.map((day) => {
    const b = byDay.get(day)!;
    cumReal += b.real;
    if (b.hasPaper) {
      cumPaper += b.paper ?? 0;
      paperEverSeen = true;
    }
    return {
      date: day.slice(5), // MM-DD
      real: Number(cumReal.toFixed(2)),
      paper: paperEverSeen ? Number(cumPaper.toFixed(2)) : null,
    };
  });
}

interface Exposure {
  count: number;
  staked: number;
  maxPayout: number;
}
function buildExposure(bets: RealBet[]): Exposure {
  const pending = bets.filter((b) => b.result === "pending");
  const staked = pending.reduce((s, b) => s + b.stake, 0);
  const maxPayout = pending.reduce((s, b) => s + b.stake * b.actualOdds, 0);
  return { count: pending.length, staked, maxPayout };
}

interface PaperVsReal {
  n: number;
  realPnl: number;
  paperPnl: number;
  realStaked: number;
  paperStaked: number;
  realRoi: number | null;
  paperRoi: number | null;
  slippageCost: number;
  stakeParityMatched: number;
  stakeParityDiverged: number;
}
function buildPaperVsReal(bets: RealBet[]): PaperVsReal | null {
  const matched = bets.filter(
    (b) => b.paper != null && b.result !== "pending" && b.paper.result !== "pending"
  );
  if (matched.length === 0) return null;
  const realPnl = matched.reduce((s, b) => s + (b.pnl ?? 0), 0);
  const paperPnl = matched.reduce((s, b) => s + (b.paper?.pnl ?? 0), 0);
  const realStaked = matched.reduce((s, b) => s + b.stake, 0);
  // Stakes are designed to match (auto-placer uses Kelly, /admin/place pre-fills it).
  // Any divergence means a clamp fired or someone hand-edited the stake — surface that.
  const stakeParityDiverged = matched.filter(
    (b) => Math.abs(b.stake - (b.paper?.stake ?? 0)) >= 0.01
  ).length;
  const stakeParityMatched = matched.length - stakeParityDiverged;
  const paperStaked = matched.reduce((s, b) => s + (b.paper?.stake ?? 0), 0);
  return {
    n: matched.length,
    realPnl,
    paperPnl,
    realStaked,
    paperStaked,
    realRoi: realStaked > 0 ? (realPnl / realStaked) * 100 : null,
    paperRoi: paperStaked > 0 ? (paperPnl / paperStaked) * 100 : null,
    slippageCost: paperPnl - realPnl,
    stakeParityMatched,
    stakeParityDiverged,
  };
}

export default async function RealBetsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <div className="py-24 text-center text-muted-foreground">Access denied.</div>;
  }
  const { data: profile } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).single();
  if (!profile?.is_superadmin) {
    return <div className="py-24 text-center text-muted-foreground">Access denied.</div>;
  }

  const bets = await getRealBets();

  // Today boundary in UTC (engine runs on UTC, settlement at 21:00/23:30/01:00 UTC)
  const now = new Date();
  const todayStartUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const todayBets = bets.filter((b) => new Date(b.placedAt) >= todayStartUtc);

  const overall = aggregate(bets);
  const today = aggregate(todayBets);
  const daily = buildDailyBreakdown(bets, 14);
  const series = buildCumulativeSeries(bets);
  const exposure = buildExposure(bets);
  const pvr = buildPaperVsReal(bets);

  // PER-MARKET-EDGE-V2 (2026-06-06): split stats pre/post the per-market
  // threshold change. Without this, the post-change ROI gets diluted by
  // 5+ weeks of pre-change data and the lift (if any) is invisible.
  const epoch = new Date(MARKET_THRESHOLDS_V2_EPOCH);
  const preV2 = aggregate(bets.filter((b) => new Date(b.placedAt) < epoch));
  const postV2 = aggregate(bets.filter((b) => new Date(b.placedAt) >= epoch));
  const epochDay = MARKET_THRESHOLDS_V2_EPOCH.slice(0, 10);

  // Per-bot breakdown — covers all bets (including pending) so coverage is visible
  const byBot: Record<string, { n: number; pending: number; staked: number; pnl: number }> = {};
  for (const b of bets) {
    const key = b.bot ?? "(none)";
    if (!byBot[key]) byBot[key] = { n: 0, pending: 0, staked: 0, pnl: 0 };
    if (b.result === "pending") {
      byBot[key].pending += 1;
    } else {
      byBot[key].n += 1;
      byBot[key].staked += b.stake;
      byBot[key].pnl += b.pnl ?? 0;
    }
  }
  const byBotSorted = Object.entries(byBot).sort((a, b) => (b[1].n + b[1].pending) - (a[1].n + a[1].pending));

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Real bets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          SELF-USE-VALIDATION cohort · Coolbet. Real-money bets logged from /admin/place. Settles
          on the same 21:00/23:30/01:00 + 15-min cadence as paper bets.
        </p>
      </div>

      <StatRow label="Overall" stats={overall} />
      <StatRow label={`Today (UTC · ${todayStartUtc.toISOString().slice(0, 10)})`} stats={today} />

      {/* PER-MARKET-EDGE-V2 (2026-06-06) — era split. Pre-/post-epoch ROI
          tells us whether per-market thresholds are paying off. Hidden
          when there are no post-epoch bets yet (epoch in the future). */}
      {postV2.total > 0 && (
        <div className="mb-6 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4">
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-300">
              Per-market threshold era (v2 launched {epochDay})
            </h2>
            <span className="text-[10px] text-muted-foreground">
              1x2 ≥10% · o/u ≥3% · AH ≥5% · BTTS ≥10% · DC retired
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Era v1 — pre-change ({preV2.total} bets, {preV2.settled} settled)
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="P&L" value={preV2.settled > 0 ? fmtMoney(preV2.pnl) : "—"} good={preV2.pnl > 0} bad={preV2.pnl < 0} />
                <MiniStat label="ROI" value={preV2.settled > 0 ? fmtPct(preV2.roi) : "—"} good={preV2.roi > 0} bad={preV2.roi < 0} />
                <MiniStat label="Hit rate" value={preV2.settled > 0 ? `${((preV2.won / preV2.settled) * 100).toFixed(1)}%` : "—"} />
              </div>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-wider text-emerald-300 mb-2">
                Era v2 — post-change ({postV2.total} bets, {postV2.settled} settled)
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="P&L" value={postV2.settled > 0 ? fmtMoney(postV2.pnl) : "—"} good={postV2.pnl > 0} bad={postV2.pnl < 0} />
                <MiniStat label="ROI" value={postV2.settled > 0 ? fmtPct(postV2.roi) : "—"} good={postV2.roi > 0} bad={postV2.roi < 0} />
                <MiniStat label="Hit rate" value={postV2.settled > 0 ? `${((postV2.won / postV2.settled) * 100).toFixed(1)}%` : "—"} />
              </div>
            </div>
          </div>
        </div>
      )}
      {postV2.total === 0 && (
        <div className="mb-6 rounded-lg border border-emerald-900/40 bg-emerald-950/10 p-3 text-xs text-muted-foreground">
          <span className="text-emerald-300 font-semibold">Per-market threshold era (v2)</span> launches{" "}
          <span className="font-mono">{MARKET_THRESHOLDS_V2_EPOCH}</span> — pre/post comparison appears once the first v2 bet settles. (1x2 ≥10% · o/u ≥3% · AH ≥5% · BTTS ≥10% · DC retired.)
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Cumulative P&amp;L
            </h2>
            <span className="text-xs text-muted-foreground">
              Settled bets, by UTC day
            </span>
          </div>
          <RealBetsChart data={series} />
        </div>

        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Open exposure
          </h2>
          <ExposureRow label="Pending bets" value={exposure.count.toString()} />
          <ExposureRow label="Stake at risk" value={`€${exposure.staked.toFixed(2)}`} />
          <ExposureRow
            label="Max potential payout"
            value={`€${exposure.maxPayout.toFixed(2)}`}
            sub={
              exposure.staked > 0
                ? `+€${(exposure.maxPayout - exposure.staked).toFixed(2)} if all win`
                : undefined
            }
            good={exposure.maxPayout > exposure.staked}
          />
          {pvr && (
            <div className="border-t border-border pt-3 mt-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Paper vs real ({pvr.n} matched)
              </h3>
              <ExposureRow
                label="Real ROI"
                value={pvr.realRoi != null ? fmtPct(pvr.realRoi) : "—"}
                good={(pvr.realRoi ?? 0) > 0}
                bad={(pvr.realRoi ?? 0) < 0}
              />
              <ExposureRow
                label="Paper ROI"
                value={pvr.paperRoi != null ? fmtPct(pvr.paperRoi) : "—"}
                good={(pvr.paperRoi ?? 0) > 0}
                bad={(pvr.paperRoi ?? 0) < 0}
              />
              <ExposureRow
                label="Slippage cost"
                value={fmtMoney(-pvr.slippageCost)}
                sub="paper − real"
                good={pvr.slippageCost < 0}
                bad={pvr.slippageCost > 0}
              />
              <ExposureRow
                label="Stake parity"
                value={`${pvr.stakeParityMatched} / ${pvr.n}`}
                sub={
                  pvr.stakeParityDiverged === 0
                    ? "all match Kelly"
                    : `${pvr.stakeParityDiverged} diverged`
                }
                good={pvr.stakeParityDiverged === 0}
                bad={pvr.stakeParityDiverged > 0}
              />
            </div>
          )}
        </div>
      </div>

      {daily.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Last {daily.length} days (UTC)
          </h2>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Day</th>
                  <th className="text-right p-2">Bets</th>
                  <th className="text-right p-2">Settled</th>
                  <th className="text-right p-2">Staked</th>
                  <th className="text-right p-2">P&amp;L</th>
                  <th className="text-right p-2">ROI</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((d) => {
                  const isV2 = d.day >= epochDay;
                  return (
                    <tr key={d.day} className={`border-t border-border ${isV2 ? "bg-emerald-950/15" : ""}`}>
                      <td className="p-2 font-mono text-xs">
                        {d.day}
                        {d.day === epochDay && (
                          <span className="ml-2 text-[10px] text-emerald-300">← v2</span>
                        )}
                      </td>
                      <td className="p-2 text-right">{d.n}</td>
                      <td className="p-2 text-right">{d.settled}</td>
                      <td className="p-2 text-right">€{d.staked.toFixed(2)}</td>
                      <td className={`p-2 text-right font-mono ${d.pnl > 0 ? "text-emerald-400" : d.pnl < 0 ? "text-red-400" : ""}`}>
                        {d.settled > 0 ? fmtMoney(d.pnl) : "—"}
                      </td>
                      <td className="p-2 text-right">{d.roi != null ? fmtPct(d.roi) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {byBotSorted.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Per-bot</h2>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Bot</th>
                  <th className="text-right p-2">Settled</th>
                  <th className="text-right p-2">Pending</th>
                  <th className="text-right p-2">Staked</th>
                  <th className="text-right p-2">P&amp;L</th>
                  <th className="text-right p-2">ROI</th>
                </tr>
              </thead>
              <tbody>
                {byBotSorted.map(([bot, s]) => (
                  <tr key={bot} className="border-t border-border">
                    <td className="p-2 font-medium">{bot}</td>
                    <td className="p-2 text-right">{s.n}</td>
                    <td className="p-2 text-right text-amber-400">{s.pending > 0 ? s.pending : "—"}</td>
                    <td className="p-2 text-right">€{s.staked.toFixed(2)}</td>
                    <td className={`p-2 text-right ${s.pnl > 0 ? "text-emerald-400" : s.pnl < 0 ? "text-red-400" : ""}`}>
                      {s.n > 0 ? fmtMoney(s.pnl) : "—"}
                    </td>
                    <td className="p-2 text-right">{s.staked > 0 ? fmtPct((s.pnl / s.staked) * 100) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RealBetsLog bets={bets} />
    </div>
  );
}

function StatRow({ label, stats }: { label: string; stats: AggStats }) {
  return (
    <div className="mb-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Total bets"
          value={stats.total.toString()}
          sub={`${stats.settled} settled · ${stats.pending} pending`}
        />
        <Stat
          label="Won / lost / void"
          value={stats.void > 0
            ? `${stats.won} / ${stats.lost} / ${stats.void}`
            : `${stats.won} / ${stats.lost}`}
          sub={(() => {
            // ADMIN-REAL-BETS-VOID-COUNT (2026-06-06): hit-rate denominator
            // excludes voids — they neither won nor lost, so they shouldn't
            // dilute the hit-rate signal. Settled-with-outcome is the right
            // denominator.
            const settledWithOutcome = stats.won + stats.lost;
            if (settledWithOutcome === 0) return "—";
            return `${((stats.won / settledWithOutcome) * 100).toFixed(1)}% hit rate`;
          })()}
        />
        <Stat
          label="P&L"
          value={stats.settled > 0 ? fmtMoney(stats.pnl) : "—"}
          sub={`Staked €${stats.staked.toFixed(2)}`}
          good={stats.pnl > 0}
          bad={stats.pnl < 0}
        />
        <Stat
          label="ROI"
          value={stats.settled > 0 ? fmtPct(stats.roi) : "—"}
          sub={stats.meanSlip != null ? `Mean slippage ${fmtPct(stats.meanSlip)}` : "—"}
          good={stats.roi > 0}
          bad={stats.roi < 0}
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  const color = good ? "text-emerald-400" : bad ? "text-red-400" : "text-foreground";
  return (
    <div className="rounded border border-border bg-card/50 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-base font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

function Stat({ label, value, sub, good, bad }: { label: string; value: string; sub?: string; good?: boolean; bad?: boolean }) {
  const color = good ? "text-emerald-400" : bad ? "text-red-400" : "";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function ExposureRow({
  label,
  value,
  sub,
  good,
  bad,
}: {
  label: string;
  value: string;
  sub?: string;
  good?: boolean;
  bad?: boolean;
}) {
  const color = good ? "text-emerald-400" : bad ? "text-red-400" : "";
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className={`text-base font-semibold font-mono ${color}`}>{value}</span>
        {sub && <span className="text-xs text-muted-foreground ml-2">{sub}</span>}
      </span>
    </div>
  );
}
