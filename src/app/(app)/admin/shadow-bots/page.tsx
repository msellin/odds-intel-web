/**
 * /admin/shadow-bots — the OWN operator page (OWN Phase 6, 2026-09-15).
 *
 * Three sections, in the order the operator reads them:
 *   1. Safety strip   — can anything stake real money right now?
 *   2. Today's picks  — one verdict per pending pick, with a `Place €X` action
 *                       that logs a hand-placed bet into `real_bets`.
 *   3. Which bots work — the pre-registered verdict per non-retired bot on
 *                       margin-corrected own-book CLV.
 *
 * Bot list is `bots WHERE retired_at IS NULL` — nothing hardcoded, so a new bot
 * appears the moment it has a `bots` row and its first `shadow_bets` write
 * (visibility invariant, dev/active/own-implementation-plan.md).
 *
 * Reads: `loadShadowBotsPage()` (cached 60 s, 8 queries) + `loadSessionState()`
 * (fresh, 1 query) + per-user pick marks (1 query) + auth/profile (2).
 * Decision rules live in lib/shadow-bots/verdict.ts.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { fetchUserPickMarkStates } from "@/lib/upcoming-picks";
import { loadSessionState, loadShadowBotsPage } from "@/lib/shadow-bots/queries";
import { SafetyStrip } from "@/components/shadow-bots/safety-strip";
import { buildPickRows, PicksTable } from "@/components/shadow-bots/picks-table";
import { Scoreboard } from "@/components/shadow-bots/scoreboard";

export default async function ShadowBotsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <Denied />;
  const db = createServerServiceClient();
  const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
  if (!profile?.is_superadmin) return <Denied text="Superadmin only." />;

  const [data, state, marks] = await Promise.all([
    loadShadowBotsPage(),
    loadSessionState(),
    fetchUserPickMarkStates(user.id).catch(() => new Map<string, 1 | 2>()),
  ]);
  const markStates: Record<string, 1 | 2> = {};
  for (const [k, v] of marks) markStates[k] = v;

  const rows = buildPickRows(data, state, markStates);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <SafetyStrip state={state} placerBots={data.placerBots} today={data.todayRealBets} />

      <header className="mb-5">
        <h1 className="text-xl font-semibold text-neutral-100">Shadow bots</h1>
        <p className="mt-1 text-xs text-neutral-500">
          {data.bots.length} active bots · {data.upcoming.length} pending picks · data cached 60 s (loaded{" "}
          {new Date(data.loadedAt).toLocaleTimeString("en-GB", { timeZone: "UTC" })} UTC, {data.queryCount} queries) ·
          safety flags live
        </p>
      </header>

      <PicksTable rows={rows} truncatedBooks={data.truncatedBooks} />

      <Scoreboard bots={data.bots} clvRows={data.clvRows} placerBots={data.placerBots} />

      <p className="mt-8 text-xs text-neutral-500">
        <Link href="/admin/ops" className="underline underline-offset-4 hover:text-neutral-300">
          ← Back to ops
        </Link>
        <span className="mx-2 text-neutral-700">·</span>
        <Link href="/admin/real-bets" className="underline underline-offset-4 hover:text-neutral-300">
          real bets ledger
        </Link>
      </p>
    </div>
  );
}

function Denied({ text = "Access denied." }: { text?: string }) {
  return <div className="flex items-center justify-center py-24 text-muted-foreground">{text}</div>;
}
