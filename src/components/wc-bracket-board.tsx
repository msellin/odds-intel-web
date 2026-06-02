"use client";

/**
 * WC-BRACKET-STAGE-GATED (2026-06-02) — phased bracket board.
 *
 * Each knockout round (R32 → R16 → QF → SF → Final) renders one of four
 * lifecycle states:
 *
 *   unseeded — AF hasn't published this round's fixtures yet. Card greyed
 *              out, copy: "Opens after {prior round}".
 *   open     — Round is seeded and lock_at is in the future. User taps a
 *              slot to pick the winner of THAT specific matchup.
 *   locked   — lock_at is in the past, not every match has finished.
 *              Read-only. Shows the user's pick + ✓/✗ as results land.
 *   settled  — Every match in the round has finished. Read-only, full
 *              score tally at the top of the column.
 *
 * Layout:
 *   • Mobile (default): vertical column, one round at a time, prev/next
 *     pagination — same muscle memory as the old UI.
 *   • Desktop (md:): horizontal bracket tree, 5 columns side-by-side.
 *
 * Champion is NOT a separate slot here — it's derived from the user's
 * (final, 0) pick (scored at 32pt when that team wins the final). The
 * "Champion" badge is rendered as a sash on the Final slot card.
 */

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Loader2,
  Trophy,
  Check,
  X,
  Hourglass,
  Share2,
} from "lucide-react";

import { flagForTeam } from "@/lib/wc-flags";
import {
  ROUND_LABELS,
  ROUND_POINTS,
  KNOCKOUT_ROUNDS_ORDER,
  PRIOR_ROUND_LABEL,
  type BracketRound,
  type BracketPick,
  type BracketRoundState,
  type BracketRoundLockState,
  type BracketSlotAssignment,
} from "@/lib/wc-bracket-types";
import { saveBracketPick, lockBracket } from "@/app/(app)/world-cup/actions";

interface WCBracketBoardProps {
  isAuthed: boolean;
  /** Per-round state from `loadBracketState()` — slot map + lock state. */
  roundStates: BracketRoundState[];
  /** User's current picks (any round). */
  initialPicks: BracketPick[];
  goldenBoot: string | null;
  /** Whether the Golden Boot input is locked (= global WC kickoff in past). */
  isGoldenBootLocked: boolean;
}

type PicksMap = Record<string, string>;

function pickKey(round: BracketRound, position: number) {
  return `${round}:${position}`;
}

function findTeamForSlot(slot: BracketSlotAssignment, teamId: string | undefined) {
  if (!teamId) return null;
  if (slot.homeTeam?.id === teamId) return slot.homeTeam;
  if (slot.awayTeam?.id === teamId) return slot.awayTeam;
  return null;
}

function actualWinnerId(slot: BracketSlotAssignment): string | null {
  if (slot.status !== "finished") return null;
  if (slot.result === "home") return slot.homeTeam?.id ?? null;
  if (slot.result === "away") return slot.awayTeam?.id ?? null;
  return null;
}

interface MatchupCardProps {
  slot: BracketSlotAssignment;
  pickedTeamId: string | null;
  roundState: BracketRoundLockState;
  isHighlightFinal?: boolean;
  onPick: (teamId: string) => void;
  disabled: boolean;
}

function MatchupCard({
  slot,
  pickedTeamId,
  roundState,
  isHighlightFinal,
  onPick,
  disabled,
}: MatchupCardProps) {
  const winnerId = actualWinnerId(slot);
  const showResult = roundState === "locked" || roundState === "settled";

  // Unseeded slot — render a placeholder card.
  if (!slot.matchId || !slot.homeTeam || !slot.awayTeam) {
    return (
      <div className="rounded-md border border-dashed border-white/[0.08] bg-background/30 px-2 py-3 text-center text-[11px] text-muted-foreground/60">
        Slot {slot.position + 1}
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border ${
        isHighlightFinal
          ? "border-[color:var(--color-tournament-gold)]/40 bg-[color:var(--color-tournament-gold)]/5"
          : "border-white/[0.08] bg-card/40"
      } p-1.5`}
    >
      {[slot.homeTeam, slot.awayTeam].map((team) => {
        const isPicked = pickedTeamId === team.id;
        const isWinner = winnerId === team.id;
        const isLoser = winnerId != null && winnerId !== team.id;
        const flag = flagForTeam(team.name);
        return (
          <button
            key={team.id}
            type="button"
            onClick={() => !disabled && onPick(team.id)}
            disabled={disabled}
            className={`mt-0.5 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-all first:mt-0 disabled:cursor-default ${
              isPicked
                ? showResult && isWinner
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
                  : showResult && isLoser
                    ? "bg-red-500/10 text-red-300 ring-1 ring-red-500/40 line-through opacity-70"
                    : "bg-primary/15 text-foreground ring-1 ring-primary/40"
                : showResult && isWinner
                  ? "bg-white/[0.04] text-foreground"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
            }`}
          >
            {flag ? (
              <span aria-hidden className="shrink-0 text-base leading-none">
                {flag}
              </span>
            ) : (
              <span className="size-4 shrink-0 rounded-full bg-white/[0.08]" />
            )}
            <span className="truncate">{team.name}</span>
            {showResult && isPicked && isWinner && (
              <Check className="ml-auto size-3 shrink-0 text-emerald-300" aria-label="correct" />
            )}
            {showResult && isPicked && isLoser && (
              <X className="ml-auto size-3 shrink-0 text-red-300" aria-label="incorrect" />
            )}
            {isHighlightFinal && isPicked && (
              <Trophy className="ml-auto size-3 shrink-0 text-[color:var(--color-tournament-gold)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface RoundColumnProps {
  rs: BracketRoundState;
  picks: PicksMap;
  onPick: (round: BracketRound, position: number, teamId: string) => void;
}

function RoundColumn({ rs, picks, onPick }: RoundColumnProps) {
  const isFinal = rs.round === "final";
  const lockMs = rs.lockedAt ? new Date(rs.lockedAt).getTime() : null;
  const lockCopy =
    rs.state === "open" && lockMs
      ? `Locks ${new Date(lockMs).toLocaleString(undefined, {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : rs.state === "unseeded"
        ? `Opens after ${PRIOR_ROUND_LABEL[rs.round]}`
        : rs.state === "locked"
          ? "Picks locked — waiting on results"
          : "Settled";

  // Compute per-round score (open/unseeded = 0).
  const earned = rs.slots.reduce((acc, slot) => {
    if (!slot.matchId) return acc;
    const pid = picks[pickKey(rs.round, slot.position)];
    if (!pid) return acc;
    const winner = actualWinnerId(slot);
    if (winner && pid === winner) return acc + ROUND_POINTS[rs.round];
    return acc;
  }, 0);

  return (
    <div className="flex w-full flex-col gap-2 md:w-52">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {ROUND_LABELS[rs.round]}
        </h4>
        <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
          +{ROUND_POINTS[rs.round]}
        </span>
      </div>
      <div
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium ${
          rs.state === "open"
            ? "border-primary/30 bg-primary/10 text-primary"
            : rs.state === "unseeded"
              ? "border-white/[0.06] bg-white/[0.02] text-muted-foreground/60"
              : rs.state === "locked"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        }`}
      >
        {rs.state === "open" && <Hourglass className="size-3" />}
        {rs.state === "locked" && <Lock className="size-3" />}
        {rs.state === "settled" && <Check className="size-3" />}
        <span className="truncate">{lockCopy}</span>
        {(rs.state === "locked" || rs.state === "settled") && earned > 0 && (
          <span className="ml-auto rounded-full bg-emerald-500/20 px-1.5 font-bold text-emerald-300">
            +{earned}
          </span>
        )}
      </div>
      <div className={`flex flex-1 flex-col gap-1.5 ${rs.state === "unseeded" ? "opacity-40" : ""}`}>
        {rs.slots.map((slot) => {
          const pickedTeamId = picks[pickKey(rs.round, slot.position)] ?? null;
          return (
            <MatchupCard
              key={slot.position}
              slot={slot}
              pickedTeamId={pickedTeamId}
              roundState={rs.state}
              isHighlightFinal={isFinal}
              disabled={rs.state !== "open"}
              onPick={(tid) => onPick(rs.round, slot.position, tid)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function WCBracketBoard(props: WCBracketBoardProps) {
  const { isAuthed, roundStates, initialPicks, isGoldenBootLocked } = props;

  const initial: PicksMap = useMemo(() => {
    const m: PicksMap = {};
    for (const p of initialPicks) {
      m[pickKey(p.round, p.position)] = p.pickedTeamId;
    }
    return m;
  }, [initialPicks]);

  const [picks, setPicks] = useState<PicksMap>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [goldenBoot, setGoldenBoot] = useState<string>(props.goldenBoot ?? "");
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  // Mobile: index into KNOCKOUT_ROUNDS_ORDER. Default to the first "open" round.
  const initialMobileIdx = useMemo(() => {
    const i = roundStates.findIndex((r) => r.state === "open");
    if (i >= 0) return i;
    const fallback = roundStates.findIndex((r) => r.state !== "settled");
    return fallback >= 0 ? fallback : 0;
  }, [roundStates]);
  const [mobileRoundIdx, setMobileRoundIdx] = useState(initialMobileIdx);

  // ── Champion derived from (final, 0) pick ──────────────────────────────
  const championTeamId = picks[pickKey("final", 0)] ?? null;
  const finalRound = roundStates.find((r) => r.round === "final");
  const championTeam = championTeamId && finalRound
    ? findTeamForSlot(finalRound.slots[0], championTeamId)
    : null;

  const hasAnyPick = Object.keys(picks).length > 0;

  const handlePick = (round: BracketRound, position: number, teamId: string) => {
    if (!isAuthed) return;
    setError(null);
    const key = pickKey(round, position);
    setPicks((prev) => ({ ...prev, [key]: teamId }));
    startTransition(async () => {
      const res = await saveBracketPick(round, position, teamId);
      if (!res.ok) {
        setError(res.error ?? "Could not save pick.");
        setPicks((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      } else {
        setSavedToast("Saved.");
        setTimeout(() => setSavedToast(null), 1200);
      }
    });
  };

  const handleSaveGoldenBoot = () => {
    if (isGoldenBootLocked || !isAuthed) return;
    startTransition(async () => {
      const res = await lockBracket(goldenBoot.trim() || undefined);
      if (!res.ok) setError(res.error ?? "Could not save golden boot.");
      else {
        setSavedToast("Saved.");
        setTimeout(() => setSavedToast(null), 1200);
      }
    });
  };

  const handleShare = async () => {
    if (!isAuthed || sharing) return;
    setError(null);
    setSharing(true);
    try {
      const res = await fetch("/api/wc-bracket/share", { method: "POST" });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.error ?? "Could not generate share link.");
        return;
      }
      const url = body.url;
      const shareData: ShareData = {
        title: "My World Cup 2026 bracket",
        text: "Check out my World Cup 2026 bracket on OddsIntel",
        url,
      };
      const nav = typeof navigator !== "undefined" ? navigator : undefined;
      if (
        nav &&
        typeof nav.share === "function" &&
        typeof nav.canShare === "function" &&
        nav.canShare(shareData)
      ) {
        try {
          await nav.share(shareData);
          setSavedToast("Shared.");
          setTimeout(() => setSavedToast(null), 1200);
          return;
        } catch {
          // user cancelled — fall through to clipboard
        }
      }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
        setSavedToast("Link copied — paste anywhere");
        setTimeout(() => setSavedToast(null), 1800);
      } else {
        setError(`Copy this link: ${url}`);
      }
    } catch {
      setError("Network error generating share link.");
    } finally {
      setSharing(false);
    }
  };

  // ── unauthenticated CTA
  if (!isAuthed) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.12] bg-card/40 p-6 text-center">
        <Trophy className="mx-auto mb-2 size-8 text-[color:var(--color-tournament-gold)]" />
        <h3 className="text-base font-bold text-foreground">Pick your bracket.</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Sign in. Each round opens as the previous one finishes.
        </p>
        <Link
          href="/login?from=/world-cup/bracket"
          className="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Sign in to play
        </Link>
      </div>
    );
  }

  const mobileRoundState = roundStates[mobileRoundIdx];

  return (
    <div className="space-y-4">
      {/* Desktop layout — horizontal bracket */}
      <div className="hidden overflow-x-auto md:block">
        <div className="flex min-w-max items-stretch gap-3 p-2">
          {roundStates.map((rs) => (
            <RoundColumn key={rs.round} rs={rs} picks={picks} onPick={handlePick} />
          ))}
          {/* Champion sash on the right */}
          <div className="flex w-44 flex-col gap-2 self-center">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-tournament-gold)]">
                Champion
              </h4>
              <span className="rounded bg-[color:var(--color-tournament-gold)]/15 px-1.5 py-0.5 text-[9px] font-bold text-[color:var(--color-tournament-gold)]">
                +{ROUND_POINTS.champion}
              </span>
            </div>
            <div className="rounded-lg border border-[color:var(--color-tournament-gold)]/30 bg-[color:var(--color-tournament-gold)]/10 p-3 text-center text-xs">
              {championTeam ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl">{flagForTeam(championTeam.name) ?? "🏆"}</span>
                  <span className="font-bold text-foreground">{championTeam.name}</span>
                  <span className="text-[10px] text-muted-foreground">your champion</span>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  Derived from your Final pick.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile layout — one round, paginated */}
      <div className="md:hidden">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileRoundIdx((i) => Math.max(0, i - 1))}
            disabled={mobileRoundIdx === 0}
            aria-label="Previous round"
            className="rounded-md border border-white/[0.06] bg-card/40 p-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Round {mobileRoundIdx + 1} of {KNOCKOUT_ROUNDS_ORDER.length}
            </span>
            <h4 className="text-sm font-bold text-foreground">
              {ROUND_LABELS[mobileRoundState.round]}
            </h4>
          </div>
          <button
            type="button"
            onClick={() =>
              setMobileRoundIdx((i) =>
                Math.min(KNOCKOUT_ROUNDS_ORDER.length - 1, i + 1)
              )
            }
            disabled={mobileRoundIdx === KNOCKOUT_ROUNDS_ORDER.length - 1}
            aria-label="Next round"
            className="rounded-md border border-white/[0.06] bg-card/40 p-1.5 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <RoundColumn rs={mobileRoundState} picks={picks} onPick={handlePick} />

        {/* Champion sash (mobile) — shown under the Final column */}
        {mobileRoundState.round === "final" && (
          <div className="mt-3 rounded-lg border border-[color:var(--color-tournament-gold)]/30 bg-[color:var(--color-tournament-gold)]/10 p-3 text-center text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-tournament-gold)]">
              Champion · +{ROUND_POINTS.champion}
            </p>
            {championTeam ? (
              <div className="mt-1 flex flex-col items-center gap-0.5">
                <span className="text-xl">{flagForTeam(championTeam.name) ?? "🏆"}</span>
                <span className="font-bold text-foreground">{championTeam.name}</span>
              </div>
            ) : (
              <p className="mt-1 text-muted-foreground">
                Pick the Final winner above — that&apos;s your champion.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Share button — visible once user has at least one pick */}
      {hasAnyPick && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-3">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-foreground">Share your bracket</p>
            <p className="text-[11px] text-muted-foreground">
              Brag a bit. Pull friends in to compete.
            </p>
          </div>
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {sharing ? <Loader2 className="size-3 animate-spin" /> : <Share2 className="size-3" />}
            Share my bracket
          </button>
        </div>
      )}

      {/* Golden boot input — gated to the global WC kickoff lock */}
      <div className="rounded-xl border border-white/[0.06] bg-card/40 p-3">
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">
            Golden Boot (top scorer) · +10 pts
          </span>
          <input
            type="text"
            value={goldenBoot}
            onChange={(e) => setGoldenBoot(e.target.value)}
            disabled={isGoldenBootLocked}
            placeholder="e.g. Kylian Mbappé"
            className="rounded-md border border-white/[0.08] bg-background/60 px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          onClick={handleSaveGoldenBoot}
          disabled={isGoldenBootLocked || pending}
          className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary/80 px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          Save golden boot
        </button>
        {isGoldenBootLocked && (
          <p className="mt-1 text-[10px] text-muted-foreground/60">
            Golden Boot picks locked at first WC kickoff.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      {savedToast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[color:var(--color-tournament-green)] px-4 py-1.5 text-xs font-semibold text-background shadow-lg wc-fade-in"
        >
          {savedToast}
        </div>
      )}
    </div>
  );
}
