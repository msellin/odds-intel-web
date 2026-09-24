export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { isBotBoardDevPreview, loadBotBoard, loadControlState } from "@/lib/bot-board";
import { BotsBoard } from "./bots-board";
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
// Replaces the old simulated_bets-only dashboard, which showed 2 of 20 active
// bots, headline cards dominated by retired bots, raw (non-de-vigged) CLV, a
// Bankroll column on a different basis from P&L, and May-dated cohort splits —
// see docs/BOTS_AUDIT_2026_09_24.md sections A and D4. Visual redesign 2026-09-24 per
// odds-intel-engine dev/active/bots-board-ux-spec.md (fleet strip, forest bars, 12-week
// strip from bot_weekly — migration 411, optional until deployed).

export const metadata: Metadata = { title: "Bots · Admin · OddsIntel", robots: { index: false } };

export default async function BotsPage() {
  let viewerId: string | null = null;
  if (!isBotBoardDevPreview()) {
    const gate = await superadminGate();
    if ("denied" in gate) return gate.denied;
    viewerId = gate.userId;
  }
  const [data, controls] = await Promise.all([loadBotBoard(), loadControlState(viewerId)]);
  return (
    <ToastProvider>
      <BotsBoard data={data} controls={controls} />
    </ToastProvider>
  );
}

async function superadminGate(): Promise<{ userId: string } | { denied: React.ReactElement }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { denied: <div className="flex items-center justify-center py-24 text-muted-foreground">Access denied.</div> };
  }
  const db = createServerServiceClient();
  const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
  if (!profile?.is_superadmin) {
    return { denied: <div className="flex items-center justify-center py-24 text-muted-foreground">Superadmin only.</div> };
  }
  return { userId: user.id };
}
