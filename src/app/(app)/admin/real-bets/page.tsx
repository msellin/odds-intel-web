export const dynamic = "force-dynamic";

import { createSupabaseServer } from "@/lib/supabase-server";
import { getRealBets } from "@/lib/engine-data";

function fmtMoney(v: number) {
  const sign = v >= 0 ? "+" : "−";
  return `${sign}€${Math.abs(v).toFixed(2)}`;
}
function fmtPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
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

  // Aggregate stats
  const settled = bets.filter((b) => b.result !== "pending");
  const won = settled.filter((b) => b.result === "won").length;
  const lost = settled.filter((b) => b.result === "lost").length;
  const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
  const totalPnl = settled.reduce((s, b) => s + (b.pnl ?? 0), 0);
  const roi = totalStaked > 0 ? (totalPnl / totalStaked) * 100 : 0;

  // Slippage stats — only on rows where capturedOdds exists
  const withSlip = settled.filter((b) => b.slippagePct != null);
  const meanSlip =
    withSlip.length > 0
      ? withSlip.reduce((s, b) => s + (b.slippagePct ?? 0), 0) / withSlip.length
      : 0;

  // Per-book breakdown
  const byBook: Record<string, { n: number; staked: number; pnl: number }> = {};
  for (const b of settled) {
    if (!byBook[b.bookmaker]) byBook[b.bookmaker] = { n: 0, staked: 0, pnl: 0 };
    byBook[b.bookmaker].n += 1;
    byBook[b.bookmaker].staked += b.stake;
    byBook[b.bookmaker].pnl += b.pnl ?? 0;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Real bets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          SELF-USE-VALIDATION cohort. Real-money bets logged from /admin/place. Settles on the
          same 21:00/23:30/01:00 + 15-min cadence as paper bets.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total bets" value={bets.length.toString()} sub={`${settled.length} settled · ${bets.length - settled.length} pending`} />
        <Stat label="Won / lost" value={`${won} / ${lost}`} sub={settled.length > 0 ? `${((won / settled.length) * 100).toFixed(1)}% hit rate` : "—"} />
        <Stat label="P&L" value={fmtMoney(totalPnl)} sub={`Staked €${totalStaked.toFixed(2)}`} good={totalPnl > 0} bad={totalPnl < 0} />
        <Stat label="ROI" value={fmtPct(roi)} sub={`Mean slippage ${withSlip.length > 0 ? fmtPct(meanSlip) : "—"}`} good={roi > 0} bad={roi < 0} />
      </div>

      {Object.keys(byBook).length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Per-book</h2>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left p-2">Book</th><th className="text-right p-2">Bets</th><th className="text-right p-2">Staked</th><th className="text-right p-2">P&amp;L</th><th className="text-right p-2">ROI</th></tr>
              </thead>
              <tbody>
                {Object.entries(byBook).map(([book, s]) => (
                  <tr key={book} className="border-t border-border">
                    <td className="p-2 font-medium">{book}</td>
                    <td className="p-2 text-right">{s.n}</td>
                    <td className="p-2 text-right">€{s.staked.toFixed(2)}</td>
                    <td className={`p-2 text-right ${s.pnl > 0 ? "text-emerald-400" : s.pnl < 0 ? "text-red-400" : ""}`}>{fmtMoney(s.pnl)}</td>
                    <td className="p-2 text-right">{s.staked > 0 ? fmtPct((s.pnl / s.staked) * 100) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <h2 className="text-sm font-semibold p-3 border-b border-border">Bet log (newest first)</h2>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-2">Placed</th>
              <th className="text-left p-2">Match</th>
              <th className="text-left p-2">Bot</th>
              <th className="text-left p-2">Sel</th>
              <th className="text-left p-2">Book</th>
              <th className="text-right p-2">Captured</th>
              <th className="text-right p-2">Actual</th>
              <th className="text-right p-2">Slip</th>
              <th className="text-right p-2">Stake</th>
              <th className="text-left p-2">Result</th>
              <th className="text-right p-2">PnL</th>
            </tr>
          </thead>
          <tbody>
            {bets.length === 0 && (
              <tr><td colSpan={11} className="p-4 text-center text-muted-foreground">No real bets logged yet.</td></tr>
            )}
            {bets.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="p-2 whitespace-nowrap text-xs">{new Date(b.placedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="p-2"><div>{b.match}</div><div className="text-xs text-muted-foreground">{b.league}</div></td>
                <td className="p-2 text-xs">{b.bot ?? "—"}</td>
                <td className="p-2 text-xs"><div>{b.market}</div><div className="text-muted-foreground">{b.selection}</div></td>
                <td className="p-2">{b.bookmaker}</td>
                <td className="p-2 text-right font-mono">{b.capturedOdds?.toFixed(2) ?? "—"}</td>
                <td className="p-2 text-right font-mono">{b.actualOdds.toFixed(2)}</td>
                <td className={`p-2 text-right font-mono ${b.slippagePct != null && b.slippagePct < -1 ? "text-red-400" : b.slippagePct != null && b.slippagePct > 1 ? "text-emerald-400" : ""}`}>{b.slippagePct != null ? `${b.slippagePct.toFixed(2)}%` : "—"}</td>
                <td className="p-2 text-right">€{b.stake.toFixed(2)}</td>
                <td className="p-2">
                  <span className={
                    b.result === "won" ? "text-emerald-400" :
                    b.result === "lost" ? "text-red-400" :
                    b.result === "void" ? "text-muted-foreground" :
                    "text-amber-400"
                  }>{b.result}</span>
                </td>
                <td className={`p-2 text-right font-mono ${(b.pnl ?? 0) > 0 ? "text-emerald-400" : (b.pnl ?? 0) < 0 ? "text-red-400" : ""}`}>{b.pnl != null ? fmtMoney(b.pnl) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
