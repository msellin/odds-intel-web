/**
 * /admin/real-bets — RETIRED 2026-09-26 (#162 W6.8). Redirects to the Real money view of the bots
 * page, /admin/bots?section=money.
 *
 * Why: owner, 2026-09-25 — the real-bets page is not used, and its information (€ P/L, the
 * cross-bot list, the reconcile to-do, today's use of the daily limit) belongs on the bot view. The
 * page moved there whole: src/app/(app)/admin/bots/money-view.tsx (+ money-client.tsx), same loader
 * (src/lib/admin-money.ts). The URL is kept so bookmarks, Telegram links and older messages that
 * say "see /admin/real-bets" still land somewhere useful.
 *
 * No auth check is needed here: the redirect target re-checks superadmin itself, and a redirect
 * leaks nothing.
 */
import { redirect } from "next/navigation";

export default function RetiredRealBetsPage() {
  redirect("/admin/bots?section=money");
}
