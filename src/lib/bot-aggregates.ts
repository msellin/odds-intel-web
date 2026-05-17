/**
 * BOT-QUAL-FILTER-DUAL — shared aggregation helpers for /admin/bots and /performance.
 *
 * Why this file exists: both pages were aggregating bets server-side before
 * passing pre-computed stats to client components. That blocked the
 * "Quality bets only" toggle from updating ROI/CLV/totals on toggle. By
 * lifting aggregation into pure functions reused by both client components,
 * a single useState + useMemo wires up every metric on the page at once.
 *
 * Quality cutoff = 2026-05-06: when several major pipeline upgrades landed
 * (Pinnacle anchor, CAL-ALPHA-ODDS, PIN-VETO). Bets placed before this date
 * use older calibration; mixing them with current-pipeline bets drags ROI
 * down by ~15% on the typical dashboard load.
 */

import type { LiveBet } from "./engine-data";

// ── Constants ────────────────────────────────────────────────────────────────

export const QUALITY_CUTOFF = "2026-05-06";

// ── Shared types ─────────────────────────────────────────────────────────────

export interface BotStat {
  name: string;
  description: string;
  total: number;
  pending: number;
  settled: number;
  won: number;
  lost: number;
  hitRate: number | null;
  totalPnl: number;
  totalStaked: number;
  roi: number | null;
  currentBankroll: number;
  isRetired?: boolean;
}

export interface MarketStat {
  market: string;
  total: number;
  settled: number;
  won: number;
  pnl: number;
  hitRate: number | null;
}

export interface Summary {
  totalBots: number;
  totalBets: number;
  settledCount: number;
  wonCount: number;
  allPnl: number;
  allStaked: number;
  hitRate: number | null;
  roi: number | null;
}

export interface PerformanceStats {
  totalBets: number;
  settledCount: number;
  wonCount: number;
  totalPnl: number;
  totalStaked: number;
  hitRate: number | null;
  roi: number | null;
  avgClv: number | null;
}

interface BotDbRow {
  name: string;
  strategy?: string | null;
  currentBankroll: number;
  startingBankroll: number;
  retiredAt?: string | null;
}

// ── Filtering ────────────────────────────────────────────────────────────────

/**
 * Filter to bets placed on or after QUALITY_CUTOFF. When `on` is false this
 * is the identity function — pass the toggle state through to keep the
 * call-site uniform.
 */
export function filterQuality(bets: LiveBet[], on: boolean): LiveBet[] {
  if (!on) return bets;
  return bets.filter((b) => b.placedAt >= QUALITY_CUTOFF);
}

// ── Aggregations ─────────────────────────────────────────────────────────────

export function buildBotStats(bets: LiveBet[], botsDB: BotDbRow[]): BotStat[] {
  const betsByBot: Record<string, LiveBet[]> = {};
  for (const bet of bets) {
    if (!betsByBot[bet.bot]) betsByBot[bet.bot] = [];
    betsByBot[bet.bot].push(bet);
  }

  return botsDB
    .map((dbBot): BotStat => {
      const botBets = betsByBot[dbBot.name] || [];
      // Voids never count toward the bot's bet count — they're cancelled bets, not history.
      const counted = botBets.filter((b) => b.result !== "void");
      const settled = botBets.filter((b) => b.result !== "pending" && b.result !== "void");
      const won = settled.filter((b) => b.result === "won").length;
      const totalPnl = settled.reduce((s, b) => s + b.pnl, 0);
      const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
      return {
        name: dbBot.name,
        description: dbBot.strategy || "",
        total: counted.length,
        pending: botBets.filter((b) => b.result === "pending").length,
        settled: settled.length,
        won,
        lost: settled.length - won,
        hitRate: settled.length > 0 ? (won / settled.length) * 100 : null,
        totalPnl,
        totalStaked,
        roi:
          totalStaked > 0 && settled.length > 0
            ? (totalPnl / totalStaked) * 100
            : null,
        currentBankroll: dbBot.currentBankroll,
        isRetired: Boolean(dbBot.retiredAt),
      };
    })
    .sort((a, b) => {
      // Retired bots last regardless of ROI — they're hidden by default in the UI
      if (a.isRetired !== b.isRetired) return a.isRetired ? 1 : -1;
      // Bots with settled bets first (by ROI — stake-normalised, fair across inplay/pre-match), then pending-only, then zero-bet bots last
      if (a.settled > 0 && b.settled === 0) return -1;
      if (a.settled === 0 && b.settled > 0) return 1;
      if (a.settled > 0 && b.settled > 0) return (b.roi ?? -999) - (a.roi ?? -999);
      if (a.total > 0 && b.total === 0) return -1;
      if (a.total === 0 && b.total > 0) return 1;
      return a.name.localeCompare(b.name);
    });
}

export function buildSummary(bets: LiveBet[], totalBots: number): Summary {
  const totalBets = bets.filter((b) => b.result !== "void").length;
  const allSettled = bets.filter((b) => b.result !== "pending" && b.result !== "void");
  const allWon = allSettled.filter((b) => b.result === "won").length;
  const allPnl = allSettled.reduce((s, b) => s + b.pnl, 0);
  const allStaked = allSettled.reduce((s, b) => s + b.stake, 0);
  return {
    totalBots,
    totalBets,
    settledCount: allSettled.length,
    wonCount: allWon,
    allPnl,
    allStaked,
    hitRate: allSettled.length > 0 ? (allWon / allSettled.length) * 100 : null,
    roi: allStaked > 0 ? (allPnl / allStaked) * 100 : null,
  };
}

export function buildMarketStats(
  bets: LiveBet[],
  predicate?: (b: LiveBet) => boolean,
): MarketStat[] {
  const subset = predicate ? bets.filter(predicate) : bets;
  const map: Record<string, { total: number; settled: number; won: number; pnl: number }> = {};
  for (const bet of subset) {
    const key = bet.market || "unknown";
    if (!map[key]) map[key] = { total: 0, settled: 0, won: 0, pnl: 0 };
    map[key].total++;
    if (bet.result !== "pending" && bet.result !== "void") {
      map[key].settled++;
      map[key].pnl += bet.pnl;
      if (bet.result === "won") map[key].won++;
    }
  }
  return Object.entries(map)
    .map(([market, s]) => ({
      market,
      ...s,
      hitRate: s.settled > 0 ? (s.won / s.settled) * 100 : null,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Top-level stats for the /performance hero. Derived purely from bets so
 * the toggle can update the headline numbers alongside the leaderboard.
 */
export function buildPerformanceStats(bets: LiveBet[]): PerformanceStats {
  const counted = bets.filter((b) => b.result !== "void");
  const settled = bets.filter((b) => b.result !== "pending" && b.result !== "void");
  const won = settled.filter((b) => b.result === "won").length;
  const totalPnl = settled.reduce((s, b) => s + b.pnl, 0);
  const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
  const clvValues = settled
    .map((b) => b.clv)
    .filter((c): c is number => c !== null && Number.isFinite(c));
  const avgClv = clvValues.length > 0
    ? clvValues.reduce((s, c) => s + c, 0) / clvValues.length
    : null;
  return {
    totalBets: counted.length,
    settledCount: settled.length,
    wonCount: won,
    totalPnl,
    totalStaked,
    hitRate: settled.length > 0 ? (won / settled.length) * 100 : null,
    roi: totalStaked > 0 ? (totalPnl / totalStaked) * 100 : null,
    avgClv,
  };
}

export const isLiveBot = (botName: string): boolean => botName.startsWith("inplay_");

// ── Public leaderboard aggregator ─────────────────────────────────────────────

export interface PublicBotStatShape {
  name: string;
  settled: number;
  won: number;
  lost: number;
  pnl: number | null;
  roi: number | null;
  clvDirection: "positive" | "negative" | "neutral" | null;
  avgClv: number | null;
  currentBankroll: number | null;
  startingBankroll: number | null;
  hasEnoughData: boolean;
}

/**
 * Build the leaderboard row set shown on /performance. Mirrors
 * `buildBotStats` but emits `clvDirection` + tier-conditional fields the
 * way the cache version did. Used for the toggle's quality-only path.
 */
export function buildPublicBotStats(
  bets: LiveBet[],
  botsDB: BotDbRow[],
  opts: { isPro: boolean; isElite: boolean },
): PublicBotStatShape[] {
  const betsByBot: Record<string, LiveBet[]> = {};
  for (const bet of bets) {
    if (!betsByBot[bet.bot]) betsByBot[bet.bot] = [];
    betsByBot[bet.bot].push(bet);
  }

  const bankrollMap = new Map<string, number>();
  for (const b of botsDB) bankrollMap.set(b.name, b.currentBankroll);

  // BOTS-RETIRE-1X2 (2026-05-17): public leaderboard must not surface retired bots.
  // Cache path already filters via dashboard_cache.bot_breakdown (settlement.py
  // joins `WHERE is_active AND retired_at IS NULL`), but the client-side
  // aggregateBets toggle would otherwise resurrect them from raw bets data.
  const activeBots = botsDB.filter((b) => !b.retiredAt);
  const rows: PublicBotStatShape[] = activeBots.map((dbBot): PublicBotStatShape => {
    const botBets = betsByBot[dbBot.name] || [];
    const settled = botBets.filter((b) => b.result !== "pending" && b.result !== "void");
    const won = settled.filter((b) => b.result === "won").length;
    const lost = settled.length - won;
    const totalPnl = settled.reduce((s, b) => s + b.pnl, 0);
    const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
    const clvValues = settled
      .map((b) => b.clv)
      .filter((c): c is number => c !== null && Number.isFinite(c));
    const avgClv = clvValues.length > 0
      ? clvValues.reduce((s, c) => s + c, 0) / clvValues.length
      : null;
    const clvDirection: PublicBotStatShape["clvDirection"] = avgClv == null
      ? "neutral"
      : avgClv > 0 ? "positive" : "negative";
    return {
      name: dbBot.name,
      settled: settled.length,
      won: opts.isPro ? won : 0,
      lost: opts.isPro ? lost : 0,
      pnl: opts.isPro ? totalPnl : null,
      roi: totalStaked > 0 ? (totalPnl / totalStaked) * 100 : null,
      clvDirection,
      avgClv: opts.isElite ? avgClv : null,
      currentBankroll: opts.isElite ? (bankrollMap.get(dbBot.name) ?? null) : null,
      startingBankroll: dbBot.startingBankroll,
      hasEnoughData: settled.length >= 5,
    };
  });

  return rows.sort((a, b) => {
    if (a.hasEnoughData !== b.hasEnoughData) return a.hasEnoughData ? -1 : 1;
    if (a.hasEnoughData) return (b.roi ?? -999) - (a.roi ?? -999);
    if (a.settled !== b.settled) return b.settled - a.settled;
    return a.name.localeCompare(b.name);
  });
}
