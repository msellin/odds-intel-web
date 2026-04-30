import { Activity, Clock, Zap, Bot, Radio, Brain, BarChart2, Globe } from "lucide-react";
import type { SystemStatus } from "@/lib/engine-data";

interface Props {
  status: SystemStatus;
}

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return "—";
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function SystemStatusCard({ status }: Props) {
  const topRow = [
    {
      icon: Clock,
      label: "Last odds scan",
      value: timeAgo(status.lastOddsScan),
      color: "text-muted-foreground",
    },
    {
      icon: Brain,
      label: "Last prediction run",
      value: timeAgo(status.lastPredictionRun),
      color: "text-muted-foreground",
    },
    {
      icon: Activity,
      label: "Matches tracked today",
      value: String(status.matchesToday),
      color: "text-foreground",
    },
    {
      icon: Radio,
      label: "Live matches now",
      value: String(status.liveMatchesNow),
      color: status.liveMatchesNow > 0 ? "text-emerald-400" : "text-muted-foreground",
      pulse: status.liveMatchesNow > 0,
    },
  ];

  const bottomRow = [
    {
      icon: Zap,
      label: "Value opportunities today",
      value: String(status.valueOpportunitiesToday),
      color: status.valueOpportunitiesToday > 0 ? "text-amber-400" : "text-foreground",
    },
    {
      icon: BarChart2,
      label: "Odds updates today",
      value: formatNumber(status.oddsUpdatesToday),
      color: "text-foreground",
    },
    {
      icon: Globe,
      label: "Leagues tracked",
      value: String(status.leaguesTracked),
      color: "text-foreground",
    },
    {
      icon: Bot,
      label: "Paper trading bots",
      value: String(status.activeBots),
      color: "text-foreground",
    },
  ];

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-foreground">Live System Status</h2>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {topRow.map((item) => (
          <StatusItem key={item.label} {...item} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {bottomRow.map((item) => (
          <StatusItem key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}

function StatusItem({ icon: Icon, label, value, color, pulse }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-card/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          {label}
        </span>
        {pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
        )}
      </div>
      <p className={`font-mono text-sm font-bold ${color}`}>
        {value}
      </p>
    </div>
  );
}
