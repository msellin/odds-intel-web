// Pure, client-safe helpers for /admin/real-bets (UX fix round, 2026-09-24). No server imports:
// money-client.tsx ("use client") imports from here; admin-money.ts re-exports.
import { prettyDisplayName } from "@/app/(app)/admin/bots/bot-board-format";

/** The ONE bot name for a real bet (bots.display_name via prettyDisplayName), or "(no bot)". */
export function moneyBotLabel(b: { bot: string | null; botDisplayName: string | null }): string {
  return b.bot ? prettyDisplayName(b.botDisplayName, b.bot) : "(no bot)";
}

