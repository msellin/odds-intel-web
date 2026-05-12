import type { ModelMarketUsersData } from "@/lib/engine-data";

interface Props {
  data: ModelMarketUsersData;
  homeTeam: string;
  awayTeam: string;
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-muted-foreground text-right">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, Math.max(2, value))}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-xs font-medium tabular-nums">{value}%</span>
    </div>
  );
}

export function ModelMarketUsers({ data, homeTeam }: Props) {
  const showUsers = data.hasVotes;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Home Win Consensus
        </h3>
        <span className="text-xs text-muted-foreground">{homeTeam}</span>
      </div>

      <div className="space-y-2.5">
        <Bar label="Model" value={data.modelHome} color="bg-violet-500" />
        <Bar label="Market" value={data.marketHome} color="bg-sky-500" />
        {showUsers ? (
          <Bar label="Users" value={data.usersHome} color="bg-emerald-500" />
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-muted-foreground/50 text-right">Users</span>
            <span className="text-xs text-muted-foreground/50 italic">no votes yet</span>
          </div>
        )}
      </div>

      {/* Tension indicator */}
      {(() => {
        const diff = Math.abs(data.modelHome - data.marketHome);
        if (diff < 5) return null;
        const modelHigher = data.modelHome > data.marketHome;
        return (
          <p className="mt-3 text-xs text-muted-foreground border-t border-white/[0.04] pt-3">
            Model sees {homeTeam} as{" "}
            <span className={modelHigher ? "text-violet-400" : "text-sky-400"}>
              {diff.toFixed(0)}pp {modelHigher ? "more likely" : "less likely"}
            </span>{" "}
            than the market.
          </p>
        );
      })()}

      {showUsers && (() => {
        const userDiff = Math.abs(data.usersHome - data.marketHome);
        if (userDiff < 8) return null;
        const usersHigher = data.usersHome > data.marketHome;
        return (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Community {usersHigher ? "backs" : "fades"} {homeTeam} vs the market (
            {data.totalVotes} votes).
          </p>
        );
      })()}
    </div>
  );
}
