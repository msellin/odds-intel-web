export const dynamic = "force-dynamic";

import { createSupabaseServer } from "@/lib/supabase-server";
import { getRealBets, type RealBet } from "@/lib/engine-data";
import { RealBetsLog } from "@/components/real-bets-log";

function fmtMoney(v: number) {
  const sign = v >= 0 ? "+" : "−";
  return `${sign}€${Math.abs(v).toFixed(2)}`;
}
function fmtPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

interface AggStats {
  total: number;
  settled: number;
  pending: number;
  won: number;
  lost: number;
  staked: number;
  pnl: number;
  roi: number;
  meanSlip: number | null;
}

function aggregate(bets: RealBet[]): AggStats {
  const settled = bets.filter((b) => b.result !== "pending");
  const won = settled.filter((b) => b.result === "won").length;
  const lost = settled.filter((b) => b.result === "lost").length;
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
    staked,
    pnl,
    roi,
    meanSlip,
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
          label="Won / lost"
          value={`${stats.won} / ${stats.lost}`}
          sub={stats.settled > 0 ? `${((stats.won / stats.settled) * 100).toFixed(1)}% hit rate` : "—"}
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
