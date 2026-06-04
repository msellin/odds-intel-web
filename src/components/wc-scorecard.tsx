import { Trophy, Bot, User as UserIcon } from "lucide-react";

import type { WCScorecard } from "@/lib/wc-vs-you-helpers";

interface WCScorecardProps {
  card: WCScorecard;
  isAuthed: boolean;
}

/**
 * Running scorecard for OddsIntel-vs-You. Compact horizontal pill that lives
 * at the top of /world-cup once any matches have settled.
 *
 * Mobile-first: stacks under 380px viewports via wrap; otherwise inline.
 */
export function WCScorecard({ card, isAuthed }: WCScorecardProps) {
  if (card.totalSettled === 0) {
    // Don't bother rendering anything before the tournament starts.
    return null;
  }
  const lead =
    card.userCorrect > card.modelCorrect
      ? `You lead by ${card.userCorrect - card.modelCorrect}`
      : card.modelCorrect > card.userCorrect
        ? `Model leads by ${card.modelCorrect - card.userCorrect}`
        : "Tied";

  return (
    <div
      role="status"
      aria-label="OddsIntel vs You scorecard"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-card/40 px-3 py-2.5 text-xs sm:text-sm"
    >
      <div className="flex items-center gap-1.5">
        <UserIcon className="size-3.5 text-[color:var(--color-tournament-green)]" />
        <span className="font-semibold text-foreground">
          You: <span className="font-mono tabular-nums">{card.userCorrect}/{card.totalSettled}</span>
        </span>
      </div>
      <span className="text-muted-foreground/40">·</span>
      <div className="flex items-center gap-1.5">
        <Bot className="size-3.5 text-primary" />
        <span className="font-semibold text-foreground">
          OddsIntel: <span className="font-mono tabular-nums">{card.modelCorrect}/{card.totalSettled}</span>
        </span>
      </div>
      <span className="text-muted-foreground/40">—</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-tournament-gold)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-tournament-gold)]">
        <Trophy className="size-3" /> {lead}
      </span>
      {!isAuthed && (
        <span className="text-[10px] text-muted-foreground">Sign in to save your picks.</span>
      )}
      {isAuthed && card.userLockedCount < card.totalSettled && (
        <span className="text-[10px] text-muted-foreground">
          {card.totalSettled - card.userLockedCount} match{card.totalSettled - card.userLockedCount === 1 ? "" : "es"} you didn&apos;t pick.
        </span>
      )}
    </div>
  );
}
