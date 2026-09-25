export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/admin-auth";
import { isBotBoardDevPreview, loadBotBoard, loadControlState } from "@/lib/bot-board";
import { BotsBoard } from "./bots-board";
import { RealMoneyView } from "./money-view";
import { ToastProvider } from "./toast";

// /admin/bots — rebuilt for #139 UNIFIED-BOT-MODEL phase 1 (2026-09-24), and the operator's
// control panel since phase A (odds-intel-engine dev/active/bots-control-panel-spec.md).
//
// One row per active bot, whatever ledger it writes, grouped by family and judged
// on the family's admissible metric only. Data: views bot_scoreboard /
// bot_capabilities / bot_ledger and table bot_config (engine migration 410,
// contract in odds-intel-engine docs/UNIFIED_BOT_MODEL_DESIGN_2026_09_24.md),
// read with the service-role client (admin-only; no anon reads, #072).
//
// Controls (engine migration 413): the fleet switches, the per-bot real-money eligibility and
// /picks switches, owner-only arming. Every write goes through /api/admin/bots/controls[/arm],
// which re-checks superadmin (arming: owner) server-side and calls the audited DB function —
// this page gate is for rendering only and is never trusted for a write.
//
// Two sections (#162 W6.8, 2026-09-26): the board (default) and `?section=money`, the Real money
// view — the money ledger that was /admin/real-bets (money-view.tsx; /admin/real-bets redirects
// here). Each section loads only its own data.
//
// Speed (#162 W7.4): the superadmin check is requireSuperadmin() — signed in AND
// profiles.is_superadmin — which is React.cache'd, so the layout's check and this one cost ONE
// auth round-trip + ONE profile read per request (it was two of each). loadBotBoard /
// loadControlState are cached the same way and shared with the shell's Overview loader.
//
// Replaces the old simulated_bets-only dashboard, which showed 2 of 20 active
// bots, headline cards dominated by retired bots, raw (non-de-vigged) CLV, a
// Bankroll column on a different basis from P&L, and May-dated cohort splits —
// see docs/BOTS_AUDIT_2026_09_24.md sections A and D4. Visual redesign 2026-09-24 per
// odds-intel-engine dev/active/bots-board-ux-spec.md (fleet strip, forest bars, 12-week
// strip from bot_weekly — migration 411, optional until deployed).

export const metadata: Metadata = { title: "Bots · Admin · OddsIntel", robots: { index: false } };

type Section = "board" | "money";

export default async function BotsPage({ searchParams }: { searchParams: Promise<{ section?: string | string[] }> }) {
  let viewerId: string | null = null;
  if (!isBotBoardDevPreview()) {
    const gate = await requireSuperadmin();
    if ("error" in gate) {
      return (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          {gate.status === 403 ? "Superadmin only." : "Access denied."}
        </div>
      );
    }
    viewerId = gate.userId;
  }
  const section: Section = (await searchParams).section === "money" ? "money" : "board";
  if (section === "money") return <RealMoneyView tabs={<SectionTabs current="money" />} />;
  const [data, controls] = await Promise.all([loadBotBoard(), loadControlState(viewerId)]);
  return (
    <div className="space-y-4">
      <SectionTabs current="board" />
      <ToastProvider>
        <BotsBoard data={data} controls={controls} />
      </ToastProvider>
    </div>
  );
}

/** Bots | Real money. Plain links (a server navigation): each section loads only its own data. */
function SectionTabs({ current }: { current: Section }) {
  const cls = (on: boolean) =>
    `min-h-10 -mb-px border-b-2 px-3 py-2 text-sm ${on ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`;
  return (
    <nav aria-label="Bots page sections" className="flex gap-1 border-b border-border">
      <Link href="/admin/bots" aria-current={current === "board" ? "page" : undefined} className={cls(current === "board")}>
        Bots
      </Link>
      <Link href="/admin/bots?section=money" aria-current={current === "money" ? "page" : undefined} className={cls(current === "money")}>
        Real money
      </Link>
    </nav>
  );
}
