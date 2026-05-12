"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlaceableBet } from "@/lib/engine-data";

const ACCESSIBLE_BOOKS = ["Coolbet", "Bet365", "Pinnacle", "Betano", "Unibet", "Marathonbet"] as const;

function fmtAHSelection(selection: string): string {
  const m = selection.match(/^(home|away)\s+([+-]?\d+(?:\.\d+)?)$/i);
  if (!m) return selection;
  const team = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  const hl = parseFloat(m[2]);
  const homeStart = hl > 0 ? hl : 0;
  const awayStart = hl < 0 ? -hl : 0;
  const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : String(n);
  return `${team} · ${fmt(homeStart)}-${fmt(awayStart)}`;
}

function fmtOdds(o: number | null | undefined) {
  return o == null ? "—" : o.toFixed(2);
}
function fmtPct(o: number | null | undefined) {
  return o == null ? "—" : `${(o * 100).toFixed(1)}%`;
}
function fmtKickoff(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export function PlaceBetTable({ candidates }: { candidates: PlaceableBet[] }) {
  const [filter, setFilter] = useState<"all" | "edge" | "available" | "placed">("all");
  const [openModal, setOpenModal] = useState<PlaceableBet | null>(null);

  const placedCount = candidates.filter((c) => c.alreadyPlaced).length;

  const filtered = candidates.filter((c) => {
    if (filter === "edge" && (c.edge ?? 0) < 0.05) return false;
    if (filter === "available" && c.unibetOdds == null && c.bet365Odds == null) return false;
    if (filter === "placed" && !c.alreadyPlaced) return false;
    return true;
  });

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
        No pending bets on upcoming matches. Wait for the morning betting run, then refresh.
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2 mb-3 text-xs flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-2 py-1 rounded ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          All ({candidates.length})
        </button>
        <button
          onClick={() => setFilter("edge")}
          className={`px-2 py-1 rounded ${filter === "edge" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          Edge ≥5%
        </button>
        <button
          onClick={() => setFilter("available")}
          className={`px-2 py-1 rounded ${filter === "available" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          Has Coolbet/Bet365 odds
        </button>
        {placedCount > 0 && (
          <button
            onClick={() => setFilter("placed")}
            className={`px-2 py-1 rounded ${filter === "placed" ? "bg-emerald-700 text-white" : "bg-emerald-900/40 text-emerald-400"}`}
          >
            ✓ Already placed ({placedCount})
          </button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-2">Kickoff</th>
              <th className="text-left p-2">Match</th>
              <th className="text-left p-2">Bot</th>
              <th className="text-left p-2">Sel</th>
              <th className="text-right p-2">Bot</th>
              <th className="text-right p-2 text-emerald-400">Coolbet*</th>
              <th className="text-right p-2 text-blue-300">Bet365</th>
              <th className="text-right p-2">Pin</th>
              <th className="text-right p-2">Edge</th>
              <th className="text-right p-2" title="Bot's Kelly-based recommended stake (assuming €1000 bankroll)">Stake</th>
              <th className="text-right p-2">Place</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const hasBookOdds = c.unibetOdds != null || c.bet365Odds != null;
              return (
                <tr key={c.betId} className={`border-t border-border ${hasBookOdds ? "" : "opacity-70"} ${c.alreadyPlaced ? "bg-emerald-950/30" : ""}`}>
                  <td className="p-2 whitespace-nowrap">{fmtKickoff(c.kickoff)}</td>
                  <td className="p-2">
                    <div className="font-medium flex items-center gap-1.5">
                      {c.match}
                      {c.alreadyPlaced && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 font-normal">✓ Placed</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.league}</div>
                  </td>
                  <td className="p-2 text-xs">{c.bot}</td>
                  <td className="p-2 text-xs">
                    <div>{c.market}</div>
                    <div className="text-muted-foreground">{fmtAHSelection(c.selection)}</div>
                  </td>
                  <td className="p-2 text-right font-mono">{fmtOdds(c.botOdds)}</td>
                  <td className="p-2 text-right font-mono text-emerald-400">{fmtOdds(c.unibetOdds)}</td>
                  <td className="p-2 text-right font-mono text-blue-300">{fmtOdds(c.bet365Odds)}</td>
                  <td className="p-2 text-right font-mono text-muted-foreground">{fmtOdds(c.pinnacleOdds)}</td>
                  <td className="p-2 text-right font-mono">{fmtPct(c.edge)}</td>
                  <td className="p-2 text-right font-mono text-amber-300">{c.stake != null ? `€${c.stake.toFixed(2)}` : "—"}</td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => setOpenModal(c)}
                      className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500"
                    >
                      Place
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        *Coolbet column shows Unibet odds (proxy — both run on Kambi). Replaced with direct Coolbet
        feed in Phase 1 if proxy quality is insufficient.
      </p>

      {openModal && <PlaceBetModal candidate={openModal} onClose={() => setOpenModal(null)} />}
    </>
  );
}

function PlaceBetModal({ candidate, onClose }: { candidate: PlaceableBet; onClose: () => void }) {
  const router = useRouter();
  const defaultBook = candidate.unibetOdds != null ? "Coolbet"
    : candidate.bet365Odds != null ? "Bet365"
    : candidate.pinnacleOdds != null ? "Pinnacle"
    : "Bet365";
  const defaultOdds = candidate.unibetOdds ?? candidate.bet365Odds ?? candidate.pinnacleOdds ?? candidate.botOdds;
  const [bookmaker, setBookmaker] = useState<string>(defaultBook);
  const [actualOdds, setActualOdds] = useState<string>(defaultOdds.toFixed(2));
  // Default to the bot's Kelly-recommended stake. Fall back to €2 if missing.
  const defaultStake = candidate.stake != null && candidate.stake > 0
    ? candidate.stake.toFixed(2)
    : "2.00";
  const [stake, setStake] = useState<string>(defaultStake);
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capturedOdds =
    bookmaker === "Coolbet" ? candidate.unibetOdds
    : bookmaker === "Bet365" ? candidate.bet365Odds
    : bookmaker === "Pinnacle" ? candidate.pinnacleOdds
    : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/real-bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulatedBetId: candidate.betId,
          botId: candidate.botId,
          matchId: candidate.matchId,
          market: candidate.market,
          selection: candidate.selection,
          bookmaker,
          capturedOdds,
          actualOdds: parseFloat(actualOdds),
          stake: parseFloat(stake),
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `${res.status} ${res.statusText}`);
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="bg-card border border-border rounded-lg p-6 max-w-md w-full space-y-3"
      >
        <h2 className="text-lg font-bold">Log real bet</h2>
        <div className="text-xs text-muted-foreground">
          {candidate.match} · {candidate.market} {fmtAHSelection(candidate.selection)} · bot {candidate.bot}
        </div>

        <label className="block text-sm">
          Bookmaker
          <select
            value={bookmaker}
            onChange={(e) => setBookmaker(e.target.value)}
            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5"
          >
            {ACCESSIBLE_BOOKS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Actual odds taken
          <input
            type="number"
            step="0.01"
            min="1.01"
            required
            value={actualOdds}
            onChange={(e) => setActualOdds(e.target.value)}
            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 font-mono"
          />
          {capturedOdds != null && (
            <span className="text-xs text-muted-foreground">
              We showed {capturedOdds.toFixed(2)} — slippage logged automatically.
            </span>
          )}
        </label>

        <label className="block text-sm">
          Stake (€)
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 font-mono"
          />
          {candidate.stake != null && candidate.stake > 0 && (
            <span className="text-xs text-muted-foreground">
              Bot recommends €{candidate.stake.toFixed(2)} (Kelly × tier × €1000 bankroll).
              Override freely — paper-validation, no real money.
            </span>
          )}
        </label>

        <label className="block text-sm">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. 'price moved before click', 'max bet capped at €0.50'…"
            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5"
            rows={2}
          />
        </label>

        {error && <div className="text-xs text-red-400">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-muted hover:bg-muted/70"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? "Logging…" : "Log bet"}
          </button>
        </div>
      </form>
    </div>
  );
}
