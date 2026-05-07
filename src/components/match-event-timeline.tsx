import type { MatchEvent } from "@/lib/engine-data";

function eventIcon(eventType: string): { icon: string; color: string } {
  const t = eventType.toLowerCase();
  if (t.includes("goal") || t === "penalty") return { icon: "\u26BD", color: "text-green-400" };
  if (t === "own goal") return { icon: "\u26BD", color: "text-red-400" };
  if (t === "yellow card") return { icon: "", color: "bg-yellow-400" };
  if (t === "red card" || t === "yellow red card") return { icon: "", color: "bg-red-500" };
  if (t === "subst") return { icon: "\u21C5", color: "text-blue-400" };
  return { icon: "\u2022", color: "text-muted-foreground" };
}

function isCard(eventType: string) {
  const t = eventType.toLowerCase();
  return t === "yellow card" || t === "red card" || t === "yellow red card";
}

function formatMinute(minute: number, addedTime: number): string {
  if (addedTime > 0) return `${minute}+${addedTime}'`;
  return `${minute}'`;
}

interface MatchEventTimelineProps {
  events: MatchEvent[];
  homeTeam: string;
  awayTeam: string;
}

export function MatchEventTimeline({ events, homeTeam, awayTeam }: MatchEventTimelineProps) {
  if (!events.length) return null;

  const sorted = [...events].sort((a, b) => {
    const minA = a.minute + a.addedTime * 0.01;
    const minB = b.minute + b.addedTime * 0.01;
    return minA - minB;
  });

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <span className="text-base">&#9201;</span>
        Match Timeline
      </h3>

      {/* Timeline */}
      <div className="relative">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.08] -translate-x-0.5" />

        <div className="space-y-2">
          {sorted.map((event, i) => {
            const isHome = event.team === "home";
            const { icon, color } = eventIcon(event.eventType);
            const card = isCard(event.eventType);
            const min = formatMinute(event.minute, event.addedTime);

            return (
              <div key={i} className={`flex items-center gap-2 ${isHome ? "flex-row" : "flex-row-reverse"}`}>
                {/* Event content */}
                <div className={`flex-1 flex items-center gap-1.5 ${isHome ? "justify-end text-right" : "justify-start text-left"}`}>
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground truncate block">
                      {event.playerName ?? "Unknown"}
                    </span>
                    {event.assistName && (
                      <span className="text-[10px] text-muted-foreground/60 truncate block">
                        {event.eventType.toLowerCase().includes("goal") ? `ast. ${event.assistName}` : event.assistName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Center: minute + icon */}
                <div className="flex items-center gap-1 shrink-0 w-16 justify-center">
                  {isHome && (
                    card ? (
                      <span className={`inline-block w-2.5 h-3.5 rounded-[1px] ${color}`} />
                    ) : (
                      <span className={`text-xs ${color}`}>{icon}</span>
                    )
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground font-bold tabular-nums">
                    {min}
                  </span>
                  {!isHome && (
                    card ? (
                      <span className={`inline-block w-2.5 h-3.5 rounded-[1px] ${color}`} />
                    ) : (
                      <span className={`text-xs ${color}`}>{icon}</span>
                    )
                  )}
                </div>

                {/* Other side spacer */}
                <div className="flex-1" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Team legend */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.06] text-[10px] text-muted-foreground/50">
        <span>{homeTeam}</span>
        <span>{awayTeam}</span>
      </div>
    </div>
  );
}
