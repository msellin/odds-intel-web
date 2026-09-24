/**
 * /admin/shadow-bots/[bot] — RETIRED 2026-09-24 (#139 IA move P7). Redirects to the bot's sheet on
 * /admin/bots (`?bot=<name>&tab=picks`).
 *
 * Why: this 1,004-line page computed its OWN per-bot record — ROI and "avg CLV" over
 * shadow_bets_unique, a 50-settled / 14-day readiness bar, and a model-edge "Min odds" column,
 * 1 / (p − floor) — for every bot it was given. That was a third scoring of the same bot beside
 * bot_scoreboard (/admin/bots) and the shadow scoreboard, and it was wrong for the families it did
 * not fit (#139 finding b): in-play bots were shown a pre-match CLV and a min-odds price, sharp bots
 * (multiplicative floor) the model formula. The /admin/bots sheet judges each family on its ONE
 * admissible metric and shows its own gate, and since this move its Picks tab carries what this
 * page had that the sheet lacked: "Bet made" (real_bets, placed_real IS NOT FALSE, price + venue),
 * the current Coolbet / Unibet-Site / Epicbet price for pending pre-match picks, and paging through
 * the full ledger (src/lib/bot-board.ts loadBotPicks, src/app/(app)/admin/bots/picks-table.tsx).
 *
 * No auth check is needed here: the redirect target re-checks superadmin itself, and a redirect
 * leaks nothing but the bot name the caller already typed.
 */
import { redirect } from "next/navigation";

export default async function RetiredShadowBotDetail({ params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params;
  // Same shape rule the old page and the ledger route enforce — anything else just lands on the board.
  if (!/^[a-z0-9_]+$/i.test(bot)) redirect("/admin/bots");
  redirect(`/admin/bots?bot=${encodeURIComponent(bot)}&tab=picks`);
}
