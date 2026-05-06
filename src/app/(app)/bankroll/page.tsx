import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import { getUserBankrollData } from "@/lib/engine-data";
import { BankrollChart } from "@/components/bankroll-chart";
import { TrendingUp, TrendingDown, BarChart3, Bot, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Bankroll Analytics — OddsIntel" };

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "red" | "muted";
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/40 p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-mono text-2xl font-bold mt-1",
          color === "green" && "text-emerald-400",
          color === "red" && "text-red-400",
          color === "muted" && "text-muted-foreground",
          !color && "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default async function BankrollPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { isElite } = await getUserTier(user.id, supabase);

  if (!isElite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <h1 className="font-mono text-lg font-bold mb-2">Bankroll Analytics</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Deep bankroll tracking — ROI over time, per-league breakdown, drawdown, and model
          benchmark — is an Elite feature.
        </p>
        <a
          href="/pricing"
          className="mt-5 inline-flex items-center justify-center rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
        >
          Upgrade to Elite
        </a>
      </div>
    );
  }

  const data = await getUserBankrollData(user.id);
  const { stats, cumulativeSeries, leagueBreakdown, modelComparison, picks } = data;
  const hasSettled = stats.won + stats.lost > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-xl font-bold tracking-tight">Bankroll Analytics</h1>
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Elite
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          ROI over time, per-league breakdown, drawdown, and model benchmark
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Net Units"
          value={`${stats.netUnits >= 0 ? "+" : ""}${stats.netUnits}u`}
          sub={`${stats.won}W / ${stats.lost}L`}
          color={hasSettled ? (stats.netUnits >= 0 ? "green" : "red") : "muted"}
        />
        <StatCard
          label="ROI"
          value={hasSettled ? `${stats.roi >= 0 ? "+" : ""}${stats.roi}%` : "—"}
          sub={hasSettled ? `${stats.total} total picks` : undefined}
          color={hasSettled ? (stats.roi >= 0 ? "green" : "red") : "muted"}
        />
        <StatCard
          label="Hit Rate"
          value={hasSettled ? `${stats.hitRate}%` : "—"}
          sub={hasSettled ? `${stats.won} of ${stats.won + stats.lost} settled` : undefined}
          color={hasSettled ? (stats.hitRate >= 50 ? "green" : "red") : "muted"}
        />
        <StatCard
          label="Avg CLV"
          value={stats.avgClv !== null ? `${stats.avgClv >= 0 ? "+" : ""}${stats.avgClv}%` : "—"}
          sub="closing line value"
          color={stats.avgClv !== null ? (stats.avgClv >= 0 ? "green" : "red") : "muted"}
        />
      </div>

      {/* Drawdown stat */}
      {hasSettled && (
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl border border-white/[0.06] bg-card/40 p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Drawdown</p>
            <p className="font-mono text-xl font-bold text-red-400 mt-1">
              -{stats.maxDrawdown.toFixed(2)}u
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">peak-to-trough units</p>
          </div>
          <div className="flex-1 rounded-xl border border-white/[0.06] bg-card/40 p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</p>
            <p className="font-mono text-xl font-bold text-amber-400 mt-1">{stats.pending}</p>
            <p className="text-[11px] text-muted-foreground mt-1">unsettled picks</p>
          </div>
        </div>
      )}

      {/* Cumulative units chart */}
      {cumulativeSeries.length > 1 && (
        <div className="rounded-xl border border-white/[0.06] bg-card/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Cumulative Units Over Time
          </p>
          <BankrollChart data={cumulativeSeries} />
        </div>
      )}

      {!hasSettled && (
        <div className="rounded-xl border border-dashed border-white/[0.08] px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No settled picks yet.</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Stats and charts appear once picks are settled.{" "}
            <Link href="/matches" className="text-primary hover:underline">Browse today&apos;s matches →</Link>
          </p>
        </div>
      )}

      {/* Model comparison */}
      {modelComparison && hasSettled && (
        <div className="rounded-xl border border-white/[0.06] bg-card/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="size-4 text-violet-400" />
            <h2 className="text-sm font-semibold">Model Benchmark</h2>
            <span className="ml-auto text-xs text-muted-foreground/60">
              {modelComparison.total} model bets
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your Hit Rate</p>
              <p className={cn("font-mono text-xl font-bold mt-1", stats.hitRate >= 50 ? "text-emerald-400" : "text-red-400")}>
                {hasSettled ? `${stats.hitRate}%` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Model Hit Rate</p>
              <p className={cn("font-mono text-xl font-bold mt-1", modelComparison.hitRate >= 50 ? "text-violet-400" : "text-muted-foreground")}>
                {modelComparison.hitRate}%
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your ROI</p>
              <p className={cn("font-mono text-xl font-bold mt-1", stats.roi >= 0 ? "text-emerald-400" : "text-red-400")}>
                {hasSettled ? `${stats.roi >= 0 ? "+" : ""}${stats.roi}%` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Model Avg CLV</p>
              <p className={cn("font-mono text-xl font-bold mt-1", modelComparison.avgClv != null && modelComparison.avgClv >= 0 ? "text-violet-400" : "text-muted-foreground")}>
                {modelComparison.avgClv != null ? `${modelComparison.avgClv >= 0 ? "+" : ""}${modelComparison.avgClv}%` : "—"}
              </p>
            </div>
          </div>
          {hasSettled && (
            <p className="mt-3 text-xs text-muted-foreground">
              {stats.hitRate > modelComparison.hitRate
                ? `You're beating the model by ${stats.hitRate - modelComparison.hitRate}pp on hit rate.`
                : stats.hitRate < modelComparison.hitRate
                  ? `Model outperforms you by ${modelComparison.hitRate - stats.hitRate}pp on hit rate.`
                  : "You and the model have identical hit rates."}
            </p>
          )}
        </div>
      )}

      {/* Per-league breakdown */}
      {leagueBreakdown.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-muted/20">
            <h2 className="text-sm font-semibold">Performance by League</h2>
          </div>
          <div className="grid grid-cols-12 items-center border-b border-white/[0.06] bg-muted/10 px-4 py-2 gap-2">
            <div className="col-span-5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">League</div>
            <div className="col-span-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">W / L</div>
            <div className="col-span-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Units</div>
            <div className="col-span-3 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">ROI</div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {leagueBreakdown.map((l) => (
              <div key={l.league} className="grid grid-cols-12 items-center px-4 py-2.5 gap-2 hover:bg-white/[0.02] transition-colors">
                <div className="col-span-5 text-sm text-foreground truncate">{l.league}</div>
                <div className="col-span-2 text-center font-mono text-xs">
                  <span className="text-emerald-400">{l.won}</span>
                  <span className="text-muted-foreground/50"> / </span>
                  <span className="text-red-400">{l.lost}</span>
                </div>
                <div className={cn("col-span-2 text-center font-mono text-sm", l.netUnits >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {l.netUnits >= 0 ? "+" : ""}{l.netUnits}u
                </div>
                <div className="col-span-3 flex items-center justify-center gap-1">
                  {l.roi > 0 ? (
                    <TrendingUp className="size-3 text-emerald-400" />
                  ) : l.roi < 0 ? (
                    <TrendingDown className="size-3 text-red-400" />
                  ) : (
                    <Minus className="size-3 text-muted-foreground" />
                  )}
                  <span className={cn("font-mono text-sm", l.roi > 0 ? "text-emerald-400" : l.roi < 0 ? "text-red-400" : "text-muted-foreground")}>
                    {l.roi >= 0 ? "+" : ""}{l.roi}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent picks table */}
      {picks.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-muted/20">
            <h2 className="text-sm font-semibold">Recent Picks</h2>
          </div>
          <div className="grid grid-cols-12 items-center border-b border-white/[0.06] bg-muted/10 px-4 py-2 gap-2">
            <div className="col-span-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Date</div>
            <div className="col-span-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Match</div>
            <div className="col-span-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Odds</div>
            <div className="col-span-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">CLV</div>
            <div className="col-span-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Result</div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {picks.slice(0, 20).map((p) => (
              <div key={p.id} className="grid grid-cols-12 items-center px-4 py-2.5 gap-2">
                <div className="col-span-2 font-mono text-xs text-muted-foreground">
                  {new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
                <div className="col-span-4 text-sm truncate">
                  <span className="text-foreground">{p.homeTeam} vs {p.awayTeam}</span>
                  <span className="block text-[11px] text-muted-foreground truncate capitalize">{p.selection}</span>
                </div>
                <div className="col-span-2 text-center font-mono text-sm text-muted-foreground">
                  {p.odds.toFixed(2)}
                </div>
                <div className={cn("col-span-2 text-center font-mono text-sm", p.clv != null ? (p.clv >= 0 ? "text-emerald-400" : "text-red-400") : "text-muted-foreground/40")}>
                  {p.clv != null ? `${p.clv >= 0 ? "+" : ""}${p.clv}%` : "—"}
                </div>
                <div className="col-span-2 text-center">
                  <span className={cn(
                    "inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    p.result === "won"     ? "bg-emerald-500/20 text-emerald-400"
                    : p.result === "lost"  ? "bg-red-500/20 text-red-400"
                    : "bg-amber-500/20 text-amber-400"
                  )}>
                    {p.result === "pending" ? "—" : p.result}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {picks.length > 20 && (
            <div className="px-4 py-3 border-t border-white/[0.06] text-center">
              <a href="/my-picks" className="text-xs text-primary hover:underline">
                View all {picks.length} picks →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
