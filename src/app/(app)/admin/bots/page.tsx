export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { isBotBoardDevPreview, loadBotBoard } from "@/lib/bot-board";
import { BotsBoard } from "./bots-board";

// /admin/bots — rebuilt for #139 UNIFIED-BOT-MODEL phase 1 (2026-09-24).
//
// One row per active bot, whatever ledger it writes, grouped by family and judged
// on the family's admissible metric only. Data: views bot_scoreboard /
// bot_capabilities / bot_ledger and table bot_config (engine migration 410,
// contract in odds-intel-engine docs/UNIFIED_BOT_MODEL_DESIGN_2026_09_24.md),
// read with the service-role client (admin-only; no anon reads, #072).
//
// Replaces the old simulated_bets-only dashboard, which showed 2 of 20 active
// bots, headline cards dominated by retired bots, raw (non-de-vigged) CLV, a
// Bankroll column on a different basis from P&L, and May-dated cohort splits —
// see docs/BOTS_AUDIT_2026_09_24.md sections A and D4.

export default async function BotsPage() {
  if (!isBotBoardDevPreview()) {
    const denied = await superadminDenial();
    if (denied) return denied;
  }
  const data = await loadBotBoard();
  return renderBoard(data);
}

async function superadminDenial() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">Access denied.</div>;
  }
  const db = createServerServiceClient();
  const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
  if (!profile?.is_superadmin) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">Superadmin only.</div>;
  }
  return null;
}

function renderBoard(data: Awaited<ReturnType<typeof loadBotBoard>>) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div>
        <Link href="/admin" className="text-xs text-muted-foreground hover:underline">← Admin</Link>
        <h1 className="text-2xl font-bold mt-1">Bots</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every active bot — model, shadow, sharp, in-play, forward test and control — on one ledger. ROI is a flat
          1-unit stake per pick; the verdict reads only the metric that is admissible for the bot&apos;s family.
          Click a row for its full configuration and recent picks.
        </p>
      </div>
      <BotsBoard data={data} />
    </div>
  );
}
