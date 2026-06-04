import { Star } from "lucide-react";

interface Props {
  teamName: string;
  /** Headline player's market value in EUR (raw — we render millions). */
  topPlayerValueEur: number | null;
  /** Optional — only present once we wire up the squad-name fetch. */
  playerName?: string | null;
  playerClub?: string | null;
}

/**
 * Compact chip surfacing the highest-value squad asset for one nation. Lives
 * above the match-detail tabs alongside `<WCScorePredictions />` on WC2026
 * fixtures.
 *
 * Degrades gracefully when only the value is known — we still surface the
 * "Top asset: €X M player" framing because the value itself is meaningful
 * signal (a €100m star vs a €5m squad tells you something about the team's
 * ceiling regardless of whether we can name the player).
 *
 * Renders nothing when both the player name AND the value are missing — there's
 * nothing useful to show.
 */
export function WCKeyPlayerChip({
  teamName,
  topPlayerValueEur,
  playerName,
  playerClub,
}: Props) {
  const hasValue =
    topPlayerValueEur != null &&
    Number.isFinite(topPlayerValueEur) &&
    topPlayerValueEur > 0;
  const hasName = playerName != null && playerName.trim().length > 0;

  if (!hasValue && !hasName) return null;

  // Round to nearest million for chip display — single-decimal under €10m,
  // whole number above.
  const valueMillions = hasValue ? topPlayerValueEur / 1_000_000 : null;
  const valueLabel =
    valueMillions == null
      ? null
      : valueMillions >= 10
      ? `€${valueMillions.toFixed(0)}M`
      : `€${valueMillions.toFixed(1)}M`;

  return (
    <div className="rounded-xl border border-border/50 bg-card px-3 py-2.5 flex items-center gap-2.5">
      <div className="h-7 w-7 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center shrink-0">
        <Star className="h-3.5 w-3.5 text-amber-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 truncate">
          {teamName} — key player
        </div>
        {hasName ? (
          <div className="text-xs text-foreground truncate">
            <span className="font-semibold">{playerName}</span>
            {playerClub && (
              <span className="text-muted-foreground/70"> · {playerClub}</span>
            )}
            {valueLabel && (
              <span className="text-amber-400/90 font-mono ml-1.5">
                {valueLabel}
              </span>
            )}
          </div>
        ) : (
          <div className="text-xs text-foreground truncate">
            Top asset:{" "}
            <span className="font-mono font-semibold text-amber-400/90">
              {valueLabel}
            </span>{" "}
            <span className="text-muted-foreground/70">player</span>
          </div>
        )}
      </div>
    </div>
  );
}
