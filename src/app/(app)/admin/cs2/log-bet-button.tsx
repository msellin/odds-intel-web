"use client";

import { useState } from "react";

interface Props {
  matchId: number;
  teamName: string;
  market: "match_winner" | "atleast1map";
  fairOdds: number | null;
  thresholdOdds: number | null;
}

export function LogBetButton({ matchId, teamName, market, fairOdds, thresholdOdds }: Props) {
  const [open, setOpen] = useState(false);
  const [odds, setOdds] = useState("");
  const [stake, setStake] = useState("1");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  // Live edge calculation as user types
  const oddsNum = parseFloat(odds);
  const validOdds = !isNaN(oddsNum) && oddsNum > 1;
  const fair = fairOdds ?? null;
  const thr = thresholdOdds ?? null;
  // model_prob = 1/fair_odds. Expected value per 1u stake = (odds * prob) - 1
  // = (odds/fair) - 1  → positive means edge (you get paid more than fair).
  const evPct = validOdds && fair ? (oddsNum / fair - 1) * 100 : null;
  // Edge over threshold = (odds - threshold) / threshold
  const thrEdgePct = validOdds && thr ? ((oddsNum - thr) / thr) * 100 : null;
  // Verdict: green if odds ≥ threshold, blue if positive EV but below threshold, red if EV negative
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
          step="0.5"
          min="0.5"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          className="w-14 text-xs bg-muted border border-border rounded px-2 py-0.5 font-mono focus:outline-none focus:border-amber-500/50"
        />
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
