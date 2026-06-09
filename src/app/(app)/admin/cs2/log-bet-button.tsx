"use client";

import { useEffect, useState } from "react";

interface Props {
  matchId: number;
  teamName: string;
  market: "match_winner" | "atleast1map";
  fairOdds: number | null;
  thresholdOdds: number | null;
  /** Model win probability for the picked side. Used to compute Kelly stake. */
  winProb?: number | null;
  /** Current bankroll € for the relevant bot. Lets us show stake in €. */
  bankrollEur?: number | null;
}

// Mirror cs2_bot.py: half-Kelly stake, capped at 2u, drops to 0 on -EV.
const KELLY_FRACTION = 0.5;
const KELLY_CAP = 2.0;
const BASE_STAKE = 1.0;
// Mirror cs2_bot.py MAX_STAKE_PCT_OF_BANKROLL = 0.02 — never wager more
// than 2% of bankroll on a single bet regardless of what Kelly says.
const MAX_STAKE_PCT_OF_BANKROLL = 0.02;

function kellyStake(prob: number | null | undefined, odds: number): number | null {
  if (prob == null || odds <= 1) return null;
  const b = odds - 1;
  const p = prob;
  const q = 1 - p;
  const full = (b * p - q) / b;
  if (full <= 0) return 0;
  return Math.min(KELLY_CAP, Math.round(BASE_STAKE * KELLY_FRACTION * full * 100) / 100);
}

/** Translate Kelly-units to euros: 1u = 1% of bankroll, capped at 2% bankroll. */
function unitsToEur(stakeUnits: number, bankroll: number): number {
  const raw = (stakeUnits * bankroll) / 100;
  const capped = Math.min(raw, bankroll * MAX_STAKE_PCT_OF_BANKROLL);
  return Math.max(capped, 0);
}

export function LogBetButton({ matchId, teamName, market, fairOdds, thresholdOdds, winProb, bankrollEur }: Props) {
  // ── All hooks must run in the same order on every render. Keep them above
  // any early returns. (Bug fixed 2026-06-09: useState+useEffect after early
  // returns triggered React error #310 when clicking "log bet".)
  const [open, setOpen] = useState(false);
  const [odds, setOdds] = useState("");
  const [stake, setStake] = useState("1");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [touchedStake, setTouchedStake] = useState(false);

  // Derived values for the edit form (always computed; only USED when open)
  const oddsNum = parseFloat(odds);
  const validOdds = !isNaN(oddsNum) && oddsNum > 1;
  const fair = fairOdds ?? null;
  const thr = thresholdOdds ?? null;
  const modelProb = winProb ?? (fair && fair > 1 ? 1 / fair : null);
  const suggestedStake = validOdds ? kellyStake(modelProb, oddsNum) : null;

  // Auto-fill the stake field on first valid odds entry; let user override after.
  useEffect(() => {
    if (!touchedStake && suggestedStake != null && suggestedStake > 0) {
      setStake(suggestedStake.toString());
    }
  }, [suggestedStake, touchedStake]);

  async function submit() {
    const o = parseFloat(odds);
    const s = parseFloat(stake);
    if (!o || o <= 1 || !s || s <= 0) return;
    setSaving(true);
    try {
      await fetch("/api/cs2-bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, teamName, market, odds: o, stake: s, fairOdds, thresholdOdds }),
      });
      setSaved(true);
      setOpen(false);
      setOdds("");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return <span className="text-xs text-green-400 font-semibold">✓ logged</span>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:border-amber-500/50 hover:text-amber-400 transition-colors"
      >
        log bet
      </button>
    );
  }

  // Open-state derived values (EV / verdict)
  const evPct = validOdds && fair ? (oddsNum / fair - 1) * 100 : null;
  const thrEdgePct = validOdds && thr ? ((oddsNum - thr) / thr) * 100 : null;
  const verdict =
    evPct == null ? null :
    thr != null && oddsNum >= thr ? "VALUE" :
    evPct > 0 ? "+EV (below threshold)" :
    "negative EV";
  const verdictColor =
    verdict === "VALUE" ? "text-green-400 bg-green-500/15 border-green-500/40" :
    verdict?.startsWith("+EV") ? "text-blue-400 bg-blue-500/10 border-blue-500/30" :
    verdict === "negative EV" ? "text-red-400 bg-red-500/10 border-red-500/30" :
    "";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground">odds</span>
        <input
          autoFocus
          type="number"
          step="0.01"
          min="1.01"
          placeholder={thr?.toFixed(2) ?? "e.g. 1.75"}
          value={odds}
          onChange={(e) => setOdds(e.target.value)}
          className="w-20 text-xs bg-muted border border-border rounded px-2 py-0.5 font-mono focus:outline-none focus:border-amber-500/50"
        />
        <span className="text-xs text-muted-foreground">units</span>
        <input
          type="number"
          step="0.05"
          min="0.05"
          value={stake}
          onChange={(e) => { setStake(e.target.value); setTouchedStake(true); }}
          className="w-16 text-xs bg-muted border border-border rounded px-2 py-0.5 font-mono focus:outline-none focus:border-amber-500/50"
        />
        {suggestedStake != null && suggestedStake > 0 && (
          <span className="text-[10px] text-muted-foreground">
            Kelly →{" "}
            <button
              type="button"
              onClick={() => { setStake(suggestedStake.toString()); setTouchedStake(false); }}
              className="text-amber-400 hover:underline font-mono"
            >
              {suggestedStake.toFixed(2)}u
              {bankrollEur != null && bankrollEur > 0 && (
                <span className="ml-1 text-emerald-400">
                  (€{unitsToEur(suggestedStake, bankrollEur).toFixed(2)})
                </span>
              )}
            </button>
          </span>
        )}
        <button
          onClick={submit}
          disabled={saving || !odds}
          className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
        >
          {saving ? "…" : "save"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      {validOdds && (fair != null || thr != null) && (
        <div className="flex items-center gap-2 text-[10px] font-mono pl-1">
          {verdict && (
            <span className={`px-1.5 py-0.5 rounded border font-bold tracking-wider uppercase ${verdictColor}`}>
              {verdict}
            </span>
          )}
          {fair != null && evPct != null && (
            <span className={evPct >= 0 ? "text-green-400" : "text-red-400"}>
              EV {evPct >= 0 ? "+" : ""}{evPct.toFixed(1)}%
            </span>
          )}
          {thr != null && thrEdgePct != null && (
            <span className={thrEdgePct >= 0 ? "text-green-400" : "text-muted-foreground"}>
              vs thr {thrEdgePct >= 0 ? "+" : ""}{thrEdgePct.toFixed(1)}%
            </span>
          )}
          {fair != null && (
            <span className="text-muted-foreground">
              fair {fair.toFixed(2)}{thr != null && ` · thr ${thr.toFixed(2)}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
