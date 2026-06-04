/**
 * WC-D4 — "Next 10 minutes goal probability" widget.
 *
 * Server-rendered. Reads the latest `live_xg_snapshots` row for the match
 * and projects the per-minute xG rate forward via Poisson:
 *
 *     P(≥1 goal in next 10) = 1 - exp(-λ_10)
 *
 * (See `@/lib/next-ten-goal` for the helper.) The widget surfaces during
 * live WC matches; pre-KO it shows the "Waits for kickoff" placeholder, and
 * for finished matches the parent should simply skip rendering us.
 *
 * Visual: a 0-100% horizontal bar with the percentage + a one-line
 * interpretation (Likely / Even / Unlikely).
 */

import { createSupabasePublic } from "@/lib/supabase-public";
import { nextTenGoalProb, nextTenGoalVerdict } from "@/lib/next-ten-goal";

interface Props {
  matchId: string;
  /** "scheduled" | "live" | "finished" — drives placeholder vs widget vs hide. */
  status: string;
}

export async function WcNextTenMinGoal({ matchId, status }: Props) {
  // Post-match: hide. The parent should not render us, but defend in depth
  // so an accidental render doesn't surface a stale probability.
  if (status === "finished") return null;

  // Pre-KO placeholder. Render the card with copy so the layout slot doesn't
  // jump when the match goes live and the widget swaps in.
  if (status !== "live") {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400/70" />
          Next 10 min · Goal probability
        </h3>
        <p className="text-xs text-muted-foreground/80">
          Goal probability tracking starts at kickoff.
        </p>
      </div>
    );
  }

  // Live — pull the most recent xG snapshot. Single row, freshest first.
  const supabase = createSupabasePublic();
  const { data } = await supabase
    .from("live_xg_snapshots")
    .select("minute, home_xg, away_xg, captured_at")
    .eq("match_id", matchId)
    .order("captured_at", { ascending: false })
    .limit(1);

  const snap = (data ?? [])[0] as
    | {
        minute: number;
        home_xg: number | string | null;
        away_xg: number | string | null;
      }
    | undefined;

  const prob = snap
    ? nextTenGoalProb({
        minute: snap.minute,
        homeXg: snap.home_xg == null ? null : Number(snap.home_xg),
        awayXg: snap.away_xg == null ? null : Number(snap.away_xg),
      })
    : null;

  // No usable snapshot yet (just kicked off, or poller hasn't fired) — show
  // the same kickoff copy. A live match with no xG yet is functionally
  // pre-KO from this widget's point of view.
  if (prob == null) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400/70" />
          Next 10 min · Goal probability
        </h3>
        <p className="text-xs text-muted-foreground/80">
          Goal probability tracking starts at kickoff.
        </p>
      </div>
    );
  }

  const pct = Math.round(prob * 100);
  const verdict = nextTenGoalVerdict(prob);
  // Bar fill color tracks the verdict so the user reads it at a glance even
  // before they parse the number.
  const barColor =
    verdict === "Likely"
      ? "bg-emerald-500"
      : verdict === "Even"
        ? "bg-amber-400"
        : "bg-muted-foreground/40";

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          Next 10 min · Goal probability
        </h3>
        <span className="text-sm font-mono text-foreground/90">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Probability of at least one goal in the next 10 minutes"
        className="h-2 w-full rounded-full bg-muted/40 overflow-hidden"
      >
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground/80">
        {verdict} — based on live xG rate through minute {snap!.minute}.
      </p>
    </div>
  );
}
