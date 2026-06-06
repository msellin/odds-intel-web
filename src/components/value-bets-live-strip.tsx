/**
 * VALUE-BETS-DENSITY-PASS Tier 2 (2026-06-06) — compact live strip.
 *
 * Replaces the previous full <ValueBetsLiveSection /> on /value-bets with a
 * single-row preview. The full grid still lives on /live (no functional
 * loss, just removes the data duplication where /live and /value-bets
 * rendered identical content).
 *
 * Layout: pulse + count + "→ /live" link, with the top 3 live picks shown
 * inline (match name + edge%). Above 3 live picks, suffix shows "+N more".
 */
import Link from "next/link";

interface LiveBet {
  id: string;
  matchId: string;
  match: string;
  market: string;
  selection: string;
  edge: number;  // decimal — 0.08 = +8%
}

interface Props {
  initialBets: LiveBet[];
}

export function ValueBetsLiveStrip({ initialBets }: Props) {
  if (initialBets.length === 0) return null;

  // Sort by edge descending so the top picks render first
  const sorted = [...initialBets].sort((a, b) => b.edge - a.edge);
  const preview = sorted.slice(0, 3);
  const overflow = sorted.length - preview.length;

  return (
    <Link
      href="/live"
      className="group flex items-center gap-2.5 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-2 text-xs transition-colors hover:border-red-500/45 hover:bg-red-500/[0.10]"
      title="See the full live grid on /live"
    >
      <span className="inline-flex items-center gap-1.5 shrink-0 font-semibold text-red-300">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-red-500" />
        <span>{initialBets.length} live</span>
      </span>
      <span aria-hidden className="text-muted-foreground/30">·</span>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-muted-foreground">
        {preview.map((b, i) => (
          <span
            key={b.id}
            className={`flex shrink-0 items-center gap-1 ${i > 0 ? "border-l border-white/[0.06] pl-2" : ""}`}
          >
            <span className="truncate max-w-[140px] text-foreground/80">
              {b.match.replace(" vs ", " — ")}
            </span>
            <span className="font-mono text-emerald-400 font-semibold">
              {b.edge >= 0 ? "+" : ""}{(b.edge * 100).toFixed(1)}%
            </span>
          </span>
        ))}
        {overflow > 0 && (
          <span className="shrink-0 text-muted-foreground/60">
            +{overflow} more
          </span>
        )}
      </div>
      <span className="shrink-0 text-red-300 transition-transform group-hover:translate-x-0.5">→</span>
    </Link>
  );
}
