"use client";

import { useState, useTransition } from "react";

/**
 * `Place €X` — logs a hand-placed OWN pick into `real_bets` so it settles and
 * CLV-scores like every other real bet (OWN Phase 6).
 *
 * POSTs to the existing /api/admin/real-bet route with `shadowBetId` (mig 354
 * `real_bets.shadow_bet_id`) and `notes = 'manual via shadow-bots'`. The row
 * lands with `placed_real = NULL` — manual, unconfirmed — so the account
 * reconciler can later confirm or contradict it; it is NOT counted in the
 * safety strip's confirmed total until then.
 *
 * Two-step on purpose: first click shows book · price · stake, second click
 * commits. 409 = the same (match, market, selection) is already in real_bets
 * today — surfaced, not swallowed.
 *
 * #022 (b), 2026-09-24: the price and stake are EDITABLE in the confirm step. The
 * row used to carry the page's <=60 s cached price and a hardcoded stake — numbers
 * the operator may not have taken — and was then settled and CLV-scored against
 * them. The page's price is still sent as `capturedOdds`, so the difference between
 * what was shown and what was taken stays visible.
 */
export function PlaceAction({
  shadowBetId,
  botId,
  matchId,
  market,
  selection,
  bookmaker,
  bookChip,
  odds,
  capturedOdds,
  stake,
  pickLabel,
  disabled,
  disabledReason,
}: {
  shadowBetId: string;
  botId: string;
  matchId: string;
  market: string;
  selection: string;
  /** real_bets.bookmaker value (must be in accessible_bookmakers). */
  bookmaker: string;
  bookChip: string;
  odds: number;
  capturedOdds: number | null;
  stake: number;
  pickLabel: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [oddsIn, setOddsIn] = useState(odds.toFixed(2));
  const [stakeIn, setStakeIn] = useState(String(stake));
  // accept a comma decimal ("2,10") — an Estonian keyboard types one (review 2026-09-24)
  const takenOdds = Number(oddsIn.replace(",", "."));
  const takenStake = Number(stakeIn.replace(",", "."));
  const inputsOk = Number.isFinite(takenOdds) && takenOdds > 1 && Number.isFinite(takenStake) && takenStake > 0;

  function commit() {
    setError(null);
    start(async () => {
      try {
        const res = await fetch("/api/admin/real-bet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shadowBetId,
            botId,
            matchId,
            market,
            selection,
            bookmaker,
            capturedOdds: capturedOdds ?? odds,
            actualOdds: takenOdds,
            stake: takenStake,
            notes: "manual via shadow-bots",
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string; existingId?: string };
        if (res.status === 409) {
          setError(`already in real_bets today (${j.existingId?.slice(0, 8) ?? "?"})`);
          setStep("idle");
          return;
        }
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        setSavedId(j.id ?? null);
        setStep("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed");
        setStep("idle");
      }
    });
  }

  if (step === "done") {
    return (
      <span
        className="font-mono text-[11px] text-neutral-300"
        title={`real_bets ${savedId ?? ""} · placed_real NULL until the account reconciler confirms it`}
      >
        logged €{takenStake} @ {takenOdds.toFixed(2)} {bookChip}
      </span>
    );
  }

  if (step === "confirm") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
        <span className="text-neutral-200">
          {pickLabel} · {bookChip} @
        </span>
        <input
          aria-label="odds you took"
          inputMode="decimal"
          value={oddsIn}
          onChange={(e) => setOddsIn(e.target.value)}
          className="w-14 rounded border border-white/15 bg-black/30 px-1 text-right text-neutral-100"
        />
        <span className="text-neutral-400">€</span>
        <input
          aria-label="stake"
          inputMode="decimal"
          value={stakeIn}
          onChange={(e) => setStakeIn(e.target.value)}
          className="w-12 rounded border border-white/15 bg-black/30 px-1 text-right text-neutral-100"
        />
        <button
          type="button"
          disabled={pending || !inputsOk}
          onClick={commit}
          className="rounded bg-emerald-500/90 px-2 py-0.5 font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "…" : "Confirm"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setStep("idle")}
          className="text-neutral-500 underline hover:text-neutral-300"
        >
          cancel
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setStep("confirm")}
        title={disabled ? disabledReason : `Log €${stake} at ${bookChip} ${odds.toFixed(2)} into real_bets`}
        className="rounded border border-white/15 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-neutral-200 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Place €{stake}
      </button>
      {error && <span className="font-mono text-[10px] text-neutral-400">{error}</span>}
    </span>
  );
}
