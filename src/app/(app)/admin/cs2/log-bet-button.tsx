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

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground">odds</span>
      <input
        autoFocus
        type="number"
        step="0.01"
        min="1.01"
        placeholder={thresholdOdds?.toFixed(2) ?? "e.g. 1.75"}
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
  );
}
