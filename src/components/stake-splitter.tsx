/**
 * GROWTH-STAKE-SPLITTER (2026-06-05, Tier A #11) — Elite-tier helper that
 * shows how to spread a single stake across our top N bookmakers.
 *
 * The math is deliberately simple — equal-weight split across the top
 * N best-priced books. The real value of "Totalize"-style tools is NOT
 * pure odds-maximisation (single best book wins on that metric — just
 * bet at Pinnacle). The value is **account survival**: serious value
 * bettors get limited if any one book sees too much volume, so
 * spreading €100 = €33 at each of the top 3 books keeps you under the
 * radar at each one and extends your useful betting life.
 *
 * Honest framing in the UI says exactly this — we don't pretend
 * splitting magically increases EV; we explain why people do it
 * (account survival, liability spread, hedging book-specific drift).
 *
 * Free / Pro users see a tier-gated upgrade prompt. Elite users see
 * the full split.
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import type { BookOddsEntry } from "@/lib/engine-data";

interface StakeSplitterProps {
  bookOdds: BookOddsEntry;
  /** Suggested total stake in units (from Kelly sizing); used as the default
   *  for the splitter's stake field. */
  suggestedStakeUnits: number;
  isElite: boolean;
}

interface BookRow {
  name: string;
  odds: number;
}

function getRankedBooks(bookOdds: BookOddsEntry): BookRow[] {
  const candidates: BookRow[] = [
    { name: "Pinnacle", odds: bookOdds.pinnacle ?? NaN },
    { name: "Unibet", odds: bookOdds.unibet ?? NaN },
    { name: "Bet365", odds: bookOdds.bet365 ?? NaN },
  ];
  return candidates
    .filter((b) => Number.isFinite(b.odds) && b.odds > 1)
    .sort((a, b) => b.odds - a.odds);
}

export function StakeSplitter({
  bookOdds,
  suggestedStakeUnits,
  isElite,
}: StakeSplitterProps) {
  const ranked = useMemo(() => getRankedBooks(bookOdds), [bookOdds]);
  const [totalStake, setTotalStake] = useState<number>(
    Number.isFinite(suggestedStakeUnits) && suggestedStakeUnits > 0
      ? Math.round(suggestedStakeUnits * 10) / 10
      : 10
  );

  // No usable book odds at all → don't render
  if (ranked.length === 0) return null;

  // Only one book has odds → show a single-book recommendation (no split)
  if (ranked.length === 1) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-card/30 px-3 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <Wallet className="h-3.5 w-3.5 text-amber-400" aria-hidden />
          <span className="font-semibold text-foreground">Stake at one book</span>
          <span className="ml-auto font-mono text-foreground/90">
            {ranked[0].name} @ {ranked[0].odds.toFixed(2)}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Only one of our tracked books currently quotes this market. No split available.
        </p>
      </div>
    );
  }

  // 2 or 3 books available — present a split for the top 2-3
  if (!isElite) {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <Wallet className="h-3.5 w-3.5 text-amber-400" aria-hidden />
          <span className="font-semibold text-foreground">Multi-book stake split</span>
          <Link
            href="/pricing"
            className="ml-auto text-[11px] font-medium text-amber-400 hover:text-amber-300"
          >
            Elite →
          </Link>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          See how to spread this stake across the top {ranked.length} bookmakers
          to spread liability and survive account limits.
        </p>
      </div>
    );
  }

  const splitCount = Math.min(ranked.length, 3);
  const topN = ranked.slice(0, splitCount);
  const perBookStake = totalStake / splitCount;
  const realizedPayout = topN.reduce((sum, b) => sum + perBookStake * b.odds, 0);
  const realizedAvgOdds = realizedPayout / totalStake;
  const singleBookPayout = totalStake * topN[0].odds;
  const payoutDelta = realizedPayout - singleBookPayout;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.05] px-3 py-3 text-xs">
      <div className="flex items-center gap-2">
        <Wallet className="h-3.5 w-3.5 text-amber-300" aria-hidden />
        <span className="font-semibold text-foreground">Multi-book stake split</span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-amber-400/80">
          Elite
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Spread the stake across the top {splitCount} books. Slightly lower
        realised avg odds than betting it all at the highest book, but
        each book sees a smaller bet — extends your account life and
        reduces limit risk.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <label className="text-[11px] text-muted-foreground" htmlFor="splitter-stake">
          Total stake
        </label>
        <input
          id="splitter-stake"
          type="number"
          min={0}
          step={0.5}
          inputMode="decimal"
          value={totalStake}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setTotalStake(Number.isFinite(v) && v >= 0 ? v : 0);
          }}
          className="w-20 rounded border border-white/[0.10] bg-background/60 px-2 py-1 font-mono text-xs text-foreground focus:border-amber-500/40 focus:outline-none"
        />
        <span className="text-[11px] text-muted-foreground">units</span>
      </div>

      <div className="mt-3 space-y-1.5">
        {topN.map((b, i) => (
          <div key={b.name} className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground/60">
                {i + 1}.
              </span>
              <span className="text-foreground/90">{b.name}</span>
              <span className="font-mono text-muted-foreground">@ {b.odds.toFixed(2)}</span>
            </span>
            <span className="font-mono text-foreground">
              {perBookStake.toFixed(2)}u
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-amber-500/15 pt-2.5 text-[11px]">
        <div>
          <p className="text-muted-foreground">Realised avg odds</p>
          <p className="font-mono font-bold text-foreground">{realizedAvgOdds.toFixed(3)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Vs single best book</p>
          <p className={`font-mono font-bold ${payoutDelta < 0 ? "text-amber-300" : "text-green-400"}`}>
            {payoutDelta >= 0 ? "+" : ""}
            {payoutDelta.toFixed(2)}u
          </p>
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-snug text-muted-foreground/70">
        Splitting trades a small payout per bet for longer account life.
        Account survival beats €0.50 of marginal odds on any single pick.
      </p>
    </div>
  );
}
