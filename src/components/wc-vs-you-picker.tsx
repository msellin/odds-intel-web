"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, Lock } from "lucide-react";

import { saveWcPick, type WCPick } from "@/app/(app)/world-cup/actions";

interface WCVsYouPickerProps {
  matchId: string;
  homeName: string;
  awayName: string;
  /** Existing pick — server-fetched if user is signed in. */
  initialPick: WCPick | null;
  /** True when user is signed in. */
  isAuthed: boolean;
  /** True when match has already kicked off (or finished). */
  isLocked: boolean;
  /** Optional Phase-3 prediction for inline comparison. */
  modelPick?: WCPick | null;
  /** Optional actual result label once settled. */
  actualPick?: WCPick | null;
  /** Compact: render inline as 3 tiny buttons (used in fixture rows). */
  variant?: "compact" | "full";
}

const LABELS: Record<WCPick, string> = { "1": "H", X: "D", "2": "A" };

function compactButtonClasses(isPicked: boolean, isCorrect: boolean, isWrong: boolean): string {
  if (!isPicked) {
    return "border border-white/[0.06] bg-card/40 text-muted-foreground hover:border-white/[0.16] hover:text-foreground";
  }
  if (isCorrect) return "bg-[color:var(--color-tournament-green)] text-background";
  if (isWrong) return "bg-red-500/80 text-foreground";
  return "bg-primary/80 text-primary-foreground";
}

function CompactPickButton({
  opt,
  isPicked,
  actualPick,
  disabled,
  label,
  onPick,
}: {
  opt: WCPick;
  isPicked: boolean;
  actualPick?: WCPick | null;
  disabled: boolean;
  label: string;
  onPick: (next: WCPick) => void;
}) {
  const isCorrect = actualPick != null && isPicked && actualPick === opt;
  const isWrong = actualPick != null && isPicked && actualPick !== opt;
  return (
    <button
      type="button"
      onClick={() => onPick(opt)}
      disabled={disabled}
      aria-pressed={isPicked}
      aria-label={`Pick ${label}`}
      className={`flex size-6 items-center justify-center rounded text-[10px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${compactButtonClasses(isPicked, isCorrect, isWrong)}`}
    >
      {LABELS[opt]}
    </button>
  );
}

export function WCVsYouPicker(props: WCVsYouPickerProps) {
  const {
    matchId,
    homeName,
    awayName,
    initialPick,
    isAuthed,
    isLocked,
    modelPick,
    actualPick,
    variant = "compact",
  } = props;
  const [pick, setPick] = useState<WCPick | null>(initialPick);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handlePick = (next: WCPick) => {
    if (!isAuthed) return;
    if (isLocked) return;
    setError(null);
    startTransition(async () => {
      const res = await saveWcPick(matchId, next);
      if (res.ok) {
        setPick(next);
      } else {
        setError(res.error ?? "Could not save pick.");
      }
    });
  };

  // Anonymous: prompt sign-in but still show the buttons disabled
  if (!isAuthed) {
    if (variant === "compact") {
      return (
        <Link
          href="/login?from=/world-cup"
          aria-label="Sign in to lock a pick"
          className="inline-flex items-center gap-1 rounded border border-dashed border-white/[0.08] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground hover:border-white/[0.16] hover:text-foreground"
        >
          Sign in to pick
        </Link>
      );
    }
    return (
      <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] p-3 text-center text-xs text-muted-foreground">
        <Link href="/login?from=/world-cup" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>{" "}
        to lock your prediction and beat OddsIntel.
      </div>
    );
  }

  // Compact mode — render three tiny pills, ideal for fixture-row tail
  if (variant === "compact") {
    const options: WCPick[] = ["1", "X", "2"];
    return (
      <div role="group" aria-label={`Your pick for ${homeName} vs ${awayName}`} className="flex items-center gap-0.5">
        {options.map((opt) => (
          <CompactPickButton
            key={opt}
            opt={opt}
            isPicked={pick === opt}
            actualPick={actualPick}
            disabled={isLocked || pending}
            label={opt === "1" ? homeName : opt === "X" ? "Draw" : awayName}
            onPick={handlePick}
          />
        ))}
        {isLocked && <Lock className="ml-0.5 size-3 text-muted-foreground/60" />}
        {pending && <Loader2 className="ml-0.5 size-3 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  // Full mode — bigger three-button block for match cards
  const options: Array<{ pick: WCPick; label: string }> = [
    { pick: "1", label: homeName },
    { pick: "X", label: "Draw" },
    { pick: "2", label: awayName },
  ];

  return (
    <div className="rounded-lg border border-white/[0.06] bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          OddsIntel vs You
        </p>
        {modelPick && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary">
            Model: {LABELS[modelPick]}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((opt) => {
          const isPicked = pick === opt.pick;
          return (
            <button
              key={opt.pick}
              type="button"
              onClick={() => handlePick(opt.pick)}
              disabled={isLocked || pending}
              aria-pressed={isPicked}
              className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-xs transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                isPicked
                  ? "border-primary/40 bg-primary/15 text-foreground"
                  : "border-white/[0.06] bg-card/40 text-muted-foreground hover:border-white/[0.16] hover:text-foreground"
              }`}
            >
              <span className="truncate">{opt.label}</span>
              {isPicked && <Check className="size-3 text-primary" />}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-[10px] text-red-400">{error}</p>}
      {isLocked && (
        <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Lock className="size-3" />
          Pick locked at kickoff.
        </p>
      )}
    </div>
  );
}
