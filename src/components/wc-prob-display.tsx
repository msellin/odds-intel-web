/**
 * Shared 1X2 prediction-display primitives used by the WC Schedule and the
 * WC Group cards. The bar + numbers + AI-pick pill always render together so
 * a user can decode the bar without hovering for a tooltip:
 *
 *   • ProbBar         — 3-band coloured horizontal bar (visual scan signal)
 *   • ProbNumbersRow  — three colour-coded percentages under the bar
 *                       (text colour matches the bar band — green/muted/gold)
 *   • AiPickPill      — labelled chip showing the team name the model favours
 *
 * Bar band → meaning:
 *   green  = home win prob (left in our row order, left in the bar)
 *   muted  = draw prob (middle)
 *   gold   = away win prob (right in row + bar)
 *
 * The percentages-row colour-codes the same way, so the user binds band→side
 * visually without us needing a separate legend.
 */
import { displayProb } from "@/lib/probability-display";
import type { WCPick } from "@/lib/wc-vs-you";

interface ProbTriple {
  home: number;
  draw: number;
  away: number;
}

export function ProbBar({ home, draw, away, className = "" }: ProbTriple & { className?: string }) {
  const total = home + draw + away;
  if (total <= 0) return null;
  const hPct = (home / total) * 100;
  const dPct = (draw / total) * 100;
  const aPct = (away / total) * 100;
  return (
    <div
      title={`Home ${displayProb(home)} · Draw ${displayProb(draw)} · Away ${displayProb(away)}`}
      className={`flex h-1.5 overflow-hidden rounded-full bg-white/[0.04] ${className}`}
      role="img"
      aria-label={`Win probability: home ${displayProb(home)}, draw ${displayProb(draw)}, away ${displayProb(away)}`}
    >
      <div className="bg-[color:var(--color-tournament-green)]/70" style={{ width: `${hPct}%` }} />
      <div className="bg-white/15" style={{ width: `${dPct}%` }} />
      <div className="bg-[color:var(--color-tournament-gold)]/70" style={{ width: `${aPct}%` }} />
    </div>
  );
}

export function ProbNumbersRow({ home, draw, away }: ProbTriple) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums sm:text-[11px]">
      <span className="text-[color:var(--color-tournament-green)]">{displayProb(home)}</span>
      <span className="text-muted-foreground/30">·</span>
      <span className="text-muted-foreground">{displayProb(draw)}</span>
      <span className="text-muted-foreground/30">·</span>
      <span className="text-[color:var(--color-tournament-gold)]">{displayProb(away)}</span>
    </div>
  );
}

export function AiPickPill({
  pick,
  homeName,
  awayName,
}: {
  pick: WCPick;
  homeName: string;
  awayName: string;
}) {
  const label = pick === "1" ? homeName : pick === "2" ? awayName : "Draw";
  return (
    <span
      aria-label={`AI pick: ${label}`}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9px] sm:text-[10px]"
    >
      <span className="font-mono uppercase tracking-wider text-muted-foreground/70">AI</span>
      <span className="max-w-[100px] truncate font-semibold text-foreground">{label}</span>
    </span>
  );
}

/**
 * Tailwind utility set for the "favourite team" emphasis vs the underdog —
 * lets the scan row read at a glance even before the engagement strip below.
 * Matches both the green/gold band colours and the bold weight that pulls the
 * favourite forward in the visual hierarchy.
 */
export function favouriteClass(modelPick: WCPick | null, side: "home" | "away"): string {
  if (!modelPick) return "text-foreground";
  if (modelPick === "X") return "text-foreground"; // toss-up — no emphasis
  const favoured =
    (side === "home" && modelPick === "1") || (side === "away" && modelPick === "2");
  return favoured ? "font-semibold text-foreground" : "text-foreground/75";
}
