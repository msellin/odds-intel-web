/**
 * /api/admin/coolbet-placer-bots — the pre-#139 per-bot real-money toggle behind
 * /admin/shadow-bots (COOLBET-PLACER-CONTROL-2026-09-08). OFF-ONLY since #139 phase A.
 *
 *   GET  → { bots: [{ bot_name, ui_place_enabled, note, updated_at }] }
 *   POST → { bot_name: string, ui_place_enabled: false }   (true → 403 with a pointer)
 *
 * Switching a bot ON for real money is done ONLY on /admin/bots, through the audited DB
 * function `admin_set_control` (typed bot name + reason, engine migration 413). This route can
 * still switch a bot OFF (the safe direction). A request to switch ON is refused here with a
 * clean 403; a table trigger would refuse it in the DB anyway. The old claim that a code-level
 * PLACEABLE_BOTS set protected this route is obsolete: that hand-listed set was replaced by the
 * placement-path rule (owner decision 4), and the protection is the trigger + the audited function.
 *
 * SAFETY: superadmin only; UPDATE of an existing row only (never inserts); service client
 * server-side only.
 */
import { NextResponse } from "next/server";
import {
  createSupabaseServer,
  createServerServiceClient,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function requireSuperadmin() {
  const auth = await createSupabaseServer();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return { error: "unauthorized" as const, status: 401 };

  const db = createServerServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) return { error: "forbidden" as const, status: 403 };
  return { db };
}

export async function GET() {
  const gate = await requireSuperadmin();
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { data, error } = await gate.db
    .from("coolbet_placer_bots")
    .select("bot_name, ui_place_enabled, note, updated_at")
    .order("bot_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bots: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireSuperadmin();
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: { bot_name?: unknown; ui_place_enabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const botName = typeof body.bot_name === "string" ? body.bot_name : null;
  const enabled =
    typeof body.ui_place_enabled === "boolean" ? body.ui_place_enabled : null;
  if (!botName || enabled === null) {
    return NextResponse.json(
      { error: "bot_name (string) and ui_place_enabled (boolean) required" },
      { status: 400 },
    );
  }

  if (enabled) {
    return NextResponse.json(
      {
        error:
          "Switching a bot ON for real money is done on /admin/bots (typed bot name + reason, audited). This legacy toggle can only switch OFF.",
        pointer: "/admin/bots",
      },
      { status: 403 },
    );
  }

  // UPDATE only — never insert, and only ever to OFF (above).
  const { data, error } = await gate.db
    .from("coolbet_placer_bots")
    .update({ ui_place_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("bot_name", botName)
    .select("bot_name, ui_place_enabled, note, updated_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: `no coolbet_placer_bots row for '${botName}' — add it via migration first` },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, bot: data[0] });
}
