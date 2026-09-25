// Pure, client-safe helpers for /admin/real-bets (UX fix round, 2026-09-24). No server imports:
// money-client.tsx ("use client") imports from here; admin-money.ts re-exports.
import { prettyDisplayName } from "@/app/(app)/admin/bots/bot-board-format";
import { MANUAL_RECONCILE_SINCE } from "@/lib/admin-attention";

/** The ONE bot name for a real bet (bots.display_name via prettyDisplayName), or "(no bot)". */
export function moneyBotLabel(b: { bot: string | null; botDisplayName: string | null }): string {
  return b.bot ? prettyDisplayName(b.botDisplayName, b.bot) : "(no bot)";
}

/**
 * Hand-logged bets before this date predate the account reconciler, so an unconfirmed row
 * from then is history, not a to-do (IA §3: "placed on/after 2026-09-10, older than 24 h").
 * The SAME constant the Overview's attention item counts with, so the bell and this page agree.
 */
export const RECONCILE_FROM = `${MANUAL_RECONCILE_SINCE}T00:00:00Z`;
export const RECONCILE_AFTER_H = 24;

/**
 * Where a real bet stands against the book account — ONE rule for the to-do list, the to-do count
 * and the ledger's "Confirmed" column (answer-first round, 2026-09-25). The tester found the to-do
 * saying 2 while the table showed a 3rd "Not confirmed" row from 9 Sep: placed_real NULL BEFORE
 * RECONCILE_FROM means "old row, written before the check existed", not "unconfirmed".
 *   confirmed   placed_real TRUE — matched to a ticket on the account
 *   legacy      placed_real NULL, placed before RECONCILE_FROM
 *   waiting     placed_real NULL, under RECONCILE_AFTER_H old (the check has not had its chance)
 *   unconfirmed placed_real NULL, older than that — the to-do
 */
export type ConfirmState = "confirmed" | "legacy" | "waiting" | "unconfirmed";
export function confirmState(b: { placedReal: boolean | null; placedAt: string }, now: number): ConfirmState {
  if (b.placedReal === true) return "confirmed";
  const t = Date.parse(b.placedAt);
  if (b.placedReal == null && t < Date.parse(RECONCILE_FROM)) return "legacy";
  if (t >= now - RECONCILE_AFTER_H * 3600_000) return "waiting";
  return "unconfirmed";
}
export const CONFIRM_LABEL: Record<ConfirmState, string> = {
  confirmed: "Confirmed",
  legacy: "Old entry (before confirmation checks)",
  waiting: "Waiting for account check",
  unconfirmed: "Not confirmed (by hand)",
};

/** Plain market names — no 1×2 / AH / DC / BTTS codes on screen (raw codes stay in CSV + tooltip). */
export function marketGroup(market: string): string {
  const m = (market ?? "").toLowerCase();
  if (m === "1x2") return "Match result";
  if (m === "1x2_1h") return "First-half result";
  if (m.startsWith("over_under_") || m === "o/u") return "Over/under goals";
  if (m === "btts") return "Both teams score";
  if (m === "asian_handicap" || m === "ah") return "Handicap";
  if (m === "double_chance" || m === "dc") return "Double chance";
  if (m === "combo") return "Combo";
  return market;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DC: Record<string, string> = { "1x": "Home or draw", x2: "Draw or away", "12": "Home or away" };

/** The bet in plain words: "Match result: Away", "Under 2.5 goals", "Handicap: Away −1". */
export function marketLabel(market: string, selection: string): string {
  const m = (market ?? "").toLowerCase();
  const s = (selection ?? "").toLowerCase();
  if (m.startsWith("over_under_")) {
    const line = m.replace("over_under_", "").replace(/^(\d)(\d)$/, "$1.$2");
    return `${cap(s)} ${line} goals`;
  }
  if (m === "btts") return `Both teams score: ${s === "yes" ? "Yes" : "No"}`;
  if (m === "double_chance") return `Double chance: ${DC[s] ?? selection}`;
  if (m === "asian_handicap") return `Handicap: ${cap(s).replace(/ -/, " −")}`;
  if (m === "combo") return "Combo bet";
  return `${marketGroup(market)}: ${cap(selection ?? "")}`;
}
