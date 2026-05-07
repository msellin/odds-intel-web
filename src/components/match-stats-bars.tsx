import type { MatchStatsData } from "@/lib/engine-data";

function StatBar({ label, home, away, unit = "", isPercentage = false }: {
  label: string;
  home: number | null;
  away: number | null;
  unit?: string;
  isPercentage?: boolean;
}) {
  if (home == null && away == null) return null;

  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a || 1;
  const homePct = isPercentage ? h : (h / total) * 100;
  const awayPct = isPercentage ? a : (a / total) * 100;
  const homeWins = h > a;
  const awayWins = a > h;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-mono tabular-nums ${homeWins ? "text-foreground font-bold" : "text-muted-foreground"}`}>
          {isPercentage ? `${h}%` : `${h}${unit}`}
        </span>
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">{label}</span>
        <span className={`font-mono tabular-nums ${awayWins ? "text-foreground font-bold" : "text-muted-foreground"}`}>
          {isPercentage ? `${a}%` : `${a}${unit}`}
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.04]">
        <div
          className={`rounded-l-full transition-all ${homeWins ? "bg-primary/70" : "bg-muted-foreground/30"}`}
          style={{ width: `${isPercentage ? homePct : (h / total) * 100}%` }}
        />
        <div
          className={`rounded-r-full transition-all ${awayWins ? "bg-primary/70" : "bg-muted-foreground/30"}`}
          style={{ width: `${isPercentage ? awayPct : (a / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

interface MatchStatsBarsProps {
  stats: MatchStatsData;
  homeTeam: string;
  awayTeam: string;
}

export function MatchStatsBars({ stats, homeTeam, awayTeam }: MatchStatsBarsProps) {
  const possessionAway = stats.possession_home != null ? 100 - stats.possession_home : null;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1">Match Stats</h3>
      <div className="flex items-center justify-between mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
        <span className="truncate max-w-[120px]">{homeTeam}</span>
        <span className="truncate max-w-[120px] text-right">{awayTeam}</span>
      </div>
      <div className="space-y-3">
        {stats.possession_home != null && (
          <StatBar label="Possession" home={stats.possession_home} away={possessionAway} isPercentage />
        )}
        {stats.xg_home != null && (
          <StatBar label="Expected Goals (xG)" home={Number(stats.xg_home.toFixed(2))} away={Number(stats.xg_away?.toFixed(2) ?? 0)} />
        )}
        <StatBar label="Total Shots" home={stats.shots_home} away={stats.shots_away} />
        <StatBar label="Shots on Target" home={stats.shots_on_target_home} away={stats.shots_on_target_away} />
        {(stats.blocked_shots_home != null || stats.blocked_shots_away != null) && (
          <StatBar label="Blocked Shots" home={stats.blocked_shots_home} away={stats.blocked_shots_away} />
        )}
        <StatBar label="Corners" home={stats.corners_home} away={stats.corners_away} />
        {(stats.fouls_home != null || stats.fouls_away != null) && (
          <StatBar label="Fouls" home={stats.fouls_home} away={stats.fouls_away} />
        )}
        {(stats.offsides_home != null || stats.offsides_away != null) && (
          <StatBar label="Offsides" home={stats.offsides_home} away={stats.offsides_away} />
        )}
        {(stats.saves_home != null || stats.saves_away != null) && (
          <StatBar label="Goalkeeper Saves" home={stats.saves_home} away={stats.saves_away} />
        )}
        {(stats.pass_accuracy_home != null || stats.pass_accuracy_away != null) && (
          <StatBar label="Pass Accuracy" home={stats.pass_accuracy_home} away={stats.pass_accuracy_away} isPercentage />
        )}
        {(stats.yellow_cards_home != null || stats.yellow_cards_away != null) && (
          <StatBar label="Yellow Cards" home={stats.yellow_cards_home} away={stats.yellow_cards_away} />
        )}
        {(stats.red_cards_home != null || stats.red_cards_away != null) && (
          <StatBar label="Red Cards" home={stats.red_cards_home} away={stats.red_cards_away} />
        )}
      </div>
    </div>
  );
}
