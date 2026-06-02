"use client";

/**
 * PRO-TIER-V2 (2026-06-02) — "Live now" section on /value-bets.
 *
 * Renders inplay picks separately from prematch with:
 *   - Red 🔴 indicator + match minute
 *   - Relative timestamp ("2m 14s ago") — server pick_time + server `now`
 *     anchor; ticker updates display every second on the client. The stale
 *     gate (>120s) uses the server-anchored `now`, NOT Date.now(), so a
 *     drifted client clock can't lie about whether the edge is still fresh.
 *   - Auto-refresh every 60s via /api/value-bets/live
 *   - Stale amber warning at >120s
 *
 * Server passes:
 *   serverNow:    ISO at SSR-render time. Drives initial age calculation.
 *   initialBets:  current inplay picks for the caller's tier.
 * Both come from the page, so the first paint is correct without waiting on
 * a client fetch. The 60s poll then takes over.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type LiveBetPayload = {
  id: string;
  matchId: string;
  match: string;
  league: string;
  market: string;
  selection: string;
  odds: number;
  modelProb: number;
  edge: number;
  kickoff: string;
  placedAt: string;
  recommendedBookmaker: string | null;
  bot: string;
  stake: number;
};

interface Props {
  initialBets: LiveBetPayload[];
  serverNow: string;        // ISO — anchor for age math (prevents client-clock spoof)
  isElite: boolean;
}

const POLL_MS = 60_000;
const STALE_MS = 120_000;

// Asian handicap: flip away sign to match standard notation. Mirrors
// value-bets-scan.tsx so the two cards label markets consistently.
function fmtSelection(market: string, selection: string): string {
  if (!selection) return "";
  if (market === "asian_handicap") {
    const m = selection.match(/^(away)\s+([+-]?\d+\.?\d*)$/i);
    if (m) {
      const num = parseFloat(m[2]);
      if (num !== 0) return `Away ${num > 0 ? `-${num}` : `+${Math.abs(num)}`}`;
    }
    return selection.replace(/_/g, " ");
  }
  const labels: Record<string, string> = {
    home: "Home win", draw: "Draw", away: "Away win",
    over: "Over 2.5", under: "Under 2.5",
    home_or_draw: "Home/Draw", home_or_away: "Home/Away", draw_or_away: "Draw/Away",
    yes: "Yes", no: "No",
  };
  return labels[selection] ?? selection.replace(/_/g, " ");
}

function fmtMarket(market: string): string {
  const labels: Record<string, string> = {
    "1x2": "1×2", "o/u": "O/U", double_chance: "DC",
    asian_handicap: "AH", btts: "BTTS", dnb: "DNB",
  };
  return labels[market] ?? market;
}

// "1m 14s ago" / "32s ago" — pure helper, no clock access.
function fmtAge(ageMs: number): string {
  const s = Math.max(0, Math.floor(ageMs / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s ago` : `${m}m ago`;
}

function edgeColorClass(edge: number): string {
  const pct = edge * 100;
  if (pct >= 10) return "text-emerald-500";
  if (pct >= 5)  return "text-amber-500";
  return "text-muted-foreground";
}

export function ValueBetsLiveSection({ initialBets, serverNow, isElite }: Props) {
  const [bets, setBets] = useState<LiveBetPayload[]>(initialBets);
  // Time-base offset: how far the *client* clock is from the *server* clock.
  // initial: serverNow received - Date.now() at first paint. After the poll
  // returns, we re-anchor using the response's `now`. All age math is
  // (Date.now() + offset) - placedAt, so the stale gate stays server-anchored.
  const [serverOffset, setServerOffset] = useState<number>(() => {
    return new Date(serverNow).getTime() - Date.now();
  });
  // Tick at 1Hz so the "Xs ago" labels update live. We just bump a counter
  // since the actual time source is Date.now() + serverOffset.
  const [, setTick] = useState(0);

  // Re-anchor when SSR boundary delivers fresh props
  useEffect(() => {
    setBets(initialBets);
    setServerOffset(new Date(serverNow).getTime() - Date.now());
  }, [initialBets, serverNow]);

  // 1Hz ticker
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // 60s background refresh
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/value-bets/live", { cache: "no-store" });
      if (!res.ok) return;
      const json: { now: string; bets: LiveBetPayload[] } = await res.json();
      setBets(json.bets);
      setServerOffset(new Date(json.now).getTime() - Date.now());
    } catch {
      // network blip — leave existing state, ticker keeps running
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  if (bets.length === 0) return null;

  const serverNowMs = Date.now() + serverOffset;

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/[0.03] overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-red-500/20 bg-red-500/[0.06]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <h2 className="text-sm font-bold tracking-tight text-red-400">Live now</h2>
          <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
            {bets.length}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground hidden sm:block">
          Auto-refreshes every 60s · markets move fast
        </p>
      </header>

      <ul className="divide-y divide-red-500/10">
        {bets.map((b) => {
          const placedMs = new Date(b.placedAt).getTime();
          const ageMs = Math.max(0, serverNowMs - placedMs);
          const stale = ageMs > STALE_MS;
          const sel = isElite && b.selection ? fmtSelection(b.market, b.selection) : "";
          const pick = isElite && sel
            ? `${sel} · ${fmtMarket(b.market)}`
            : fmtMarket(b.market);
          const oddsLine = isElite && b.odds > 0
            ? `${b.odds.toFixed(2)}${b.recommendedBookmaker ? ` · ${b.recommendedBookmaker}` : ""}`
            : null;

          return (
            <li key={b.id} className="px-4 py-2.5 hover:bg-red-500/[0.04] transition-colors">
              <Link href={`/matches/${b.matchId}`} className="block space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground/95 truncate leading-tight">
                      {b.match.replace(" vs ", " — ")}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {pick}
                      {oddsLine && <span className="text-foreground/70"> · {oddsLine}</span>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={cn(
                        "block font-mono font-bold text-[14px] leading-none",
                        edgeColorClass(b.edge),
                      )}
                    >
                      +{(b.edge * 100).toFixed(1)}%
                    </span>
                    <span
                      suppressHydrationWarning
                      className={cn(
                        "block text-[10px] tabular-nums mt-1",
                        stale ? "text-amber-400 font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {fmtAge(ageMs)}
                    </span>
                  </div>
                </div>
                {stale && (
                  <div className="flex items-start gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-1.5 text-[10px] text-amber-300">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>Edge may have moved — check current odds before placing.</span>
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <footer className="px-4 py-1.5 border-t border-red-500/10 bg-red-500/[0.02]">
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Zap className="h-3 w-3 text-amber-500" />
          Inplay picks expire fast — every second the price drifts, edge shrinks.
        </p>
      </footer>
    </div>
  );
}
