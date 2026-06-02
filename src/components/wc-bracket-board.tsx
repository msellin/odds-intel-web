"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, Loader2, Trophy, Check } from "lucide-react";

import { flagForTeam } from "@/lib/wc-flags";
import {
  ROUNDS_ORDER,
  ROUND_LABELS,
  ROUND_POINTS,
  ROUND_SLOTS,
  type BracketRound,
  type BracketPick,
} from "@/lib/wc-bracket-types";
import { saveBracketPick, lockBracket } from "@/app/(app)/world-cup/actions";

interface Team {
  id: string;
  name: string;
  logo: string | null;
}

interface WCBracketBoardProps {
  isAuthed: boolean;
  isLocked: boolean;
  teams: Team[];                 // candidate pool — all 48 WC teams
  initialPicks: BracketPick[];
  goldenBoot: string | null;
  /** Optional model prefill — if model has a published bracket, slot it as default. */
  modelPrefill?: Record<string, string>; // key `${round}:${position}` -> teamId
}

type PicksMap = Record<string, string>; // key `${round}:${position}` -> teamId

function pickKey(round: BracketRound, position: number) {
  return `${round}:${position}`;
}

function teamLabel(t: Team) {
  return t.name;
}

function TeamSlot({
  team,
  empty,
  highlight,
  onClick,
}: {
  team?: Team;
  empty?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const flag = team ? flagForTeam(team.name) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group flex w-full items-center gap-1.5 rounded-md border px-2 py-2 text-left text-xs transition-all disabled:cursor-default ${
        empty
          ? "border-dashed border-white/[0.08] bg-background/40 text-muted-foreground/50 hover:border-white/[0.16] hover:bg-card/40"
          : highlight
            ? "border-[color:var(--color-tournament-gold)]/40 bg-[color:var(--color-tournament-gold)]/10 text-foreground"
            : "border-white/[0.08] bg-card/60 text-foreground hover:border-primary/40"
      }`}
    >
      {flag ? (
        <span aria-hidden className="shrink-0 text-base leading-none">
          {flag}
        </span>
      ) : (
        <span className="size-4 shrink-0 rounded-full bg-white/[0.08]" />
      )}
      <span className="truncate">{team ? teamLabel(team) : "Tap to pick"}</span>
      {highlight && <Trophy className="ml-auto size-3 text-[color:var(--color-tournament-gold)]" />}
    </button>
  );
}

export function WCBracketBoard(props: WCBracketBoardProps) {
  const { isAuthed, isLocked, teams, initialPicks, modelPrefill } = props;

  // initial state: user picks > model prefill > nothing
  const initial: PicksMap = useMemo(() => {
    const m: PicksMap = { ...(modelPrefill ?? {}) };
    for (const p of initialPicks) {
      m[pickKey(p.round, p.position)] = p.pickedTeamId;
    }
    return m;
  }, [initialPicks, modelPrefill]);

  const [picks, setPicks] = useState<PicksMap>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalSlot, setModalSlot] = useState<{ round: BracketRound; position: number } | null>(null);
  const [mobileRoundIdx, setMobileRoundIdx] = useState(0);
  const [goldenBoot, setGoldenBoot] = useState<string>(props.goldenBoot ?? "");
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const teamsById = useMemo(() => {
    const m: Record<string, Team> = {};
    for (const t of teams) m[t.id] = t;
    return m;
  }, [teams]);

  const handlePick = (round: BracketRound, position: number, teamId: string) => {
    if (isLocked || !isAuthed) return;
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
    setModalSlot(null);
  };

  const handleSaveGoldenBoot = () => {
    if (isLocked || !isAuthed) return;
    startTransition(async () => {
      const res = await lockBracket(goldenBoot.trim() || undefined);
      if (!res.ok) setError(res.error ?? "Could not save golden boot.");
      else {
        setSavedToast("Saved.");
        setTimeout(() => setSavedToast(null), 1200);
      }
    });
  };

  // ── unauthenticated CTA
  if (!isAuthed) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.12] bg-card/40 p-6 text-center">
        <Trophy className="mx-auto mb-2 size-8 text-[color:var(--color-tournament-gold)]" />
        <h3 className="text-base font-bold text-foreground">Pick your bracket.</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Sign in to lock in your bracket before kick-off and compete on the leaderboard.
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

  // ── round view (mobile) — one round at a time, swipe-forward
  const mobileRound = ROUNDS_ORDER[mobileRoundIdx];

  return (
    <div className="space-y-4">
      {isLocked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <Lock className="size-3.5" />
          <span>Bracket is locked. Your picks are sealed for scoring.</span>
        </div>
      )}

      {/* Desktop layout — horizontal bracket */}
      <div className="hidden overflow-x-auto md:block">
        <div className="flex min-w-max items-stretch gap-3 p-2">
          {ROUNDS_ORDER.map((round) => (
            <div key={round} className="flex w-44 flex-col gap-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {ROUND_LABELS[round]}
                </h4>
                <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                  +{ROUND_POINTS[round]}
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-around gap-1.5">
                {Array.from({ length: ROUND_SLOTS[round] }).map((_, position) => {
                  const teamId = picks[pickKey(round, position)];
                  const team = teamId ? teamsById[teamId] : undefined;
                  return (
                    <TeamSlot
                      key={position}
                      team={team}
                      empty={!team}
                      highlight={round === "champion"}
                      onClick={isLocked ? undefined : () => setModalSlot({ round, position })}
                    />
                  );
                })}
              </div>
            </div>
          ))}
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
              Round {mobileRoundIdx + 1} of {ROUNDS_ORDER.length}
            </span>
            <h4 className="text-sm font-bold text-foreground">{ROUND_LABELS[mobileRound]}</h4>
          </div>
          <button
            type="button"
            onClick={() => setMobileRoundIdx((i) => Math.min(ROUNDS_ORDER.length - 1, i + 1))}
            disabled={mobileRoundIdx === ROUNDS_ORDER.length - 1}
            aria-label="Next round"
            className="rounded-md border border-white/[0.06] bg-card/40 p-1.5 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="space-y-1.5 wc-fade-in">
          {Array.from({ length: ROUND_SLOTS[mobileRound] }).map((_, position) => {
            const teamId = picks[pickKey(mobileRound, position)];
            const team = teamId ? teamsById[teamId] : undefined;
            return (
              <TeamSlot
                key={position}
                team={team}
                empty={!team}
                highlight={mobileRound === "champion"}
                onClick={isLocked ? undefined : () => setModalSlot({ round: mobileRound, position })}
              />
            );
          })}
        </div>
      </div>

      {/* Golden boot input */}
      <div className="rounded-xl border border-white/[0.06] bg-card/40 p-3">
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">
            Golden Boot (top scorer) · +{10} pts
          </span>
          <input
            type="text"
            value={goldenBoot}
            onChange={(e) => setGoldenBoot(e.target.value)}
            disabled={isLocked}
            placeholder="e.g. Kylian Mbappé"
            className="rounded-md border border-white/[0.08] bg-background/60 px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          onClick={handleSaveGoldenBoot}
          disabled={isLocked || pending}
          className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary/80 px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          Save golden boot
        </button>
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

      {/* Modal team picker */}
      {modalSlot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose a team"
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          onClick={() => setModalSlot(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-t-2xl border border-white/[0.08] bg-card shadow-2xl sm:rounded-2xl wc-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {ROUND_LABELS[modalSlot.round]} · Slot {modalSlot.position + 1}
                </p>
                <h3 className="text-sm font-bold text-foreground">Choose a team</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalSlot(null)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                ✕
              </button>
            </header>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              <div className="grid grid-cols-2 gap-1.5">
                {teams.map((t) => {
                  const flag = flagForTeam(t.name);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handlePick(modalSlot.round, modalSlot.position, t.id)}
                      className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-card/40 px-2 py-2 text-left text-xs hover:border-primary/40 hover:bg-card/80"
                    >
                      {flag ? (
                        <span aria-hidden className="text-base leading-none">
                          {flag}
                        </span>
                      ) : (
                        <span className="size-4 rounded-full bg-white/[0.08]" />
                      )}
                      <span className="truncate text-foreground">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
