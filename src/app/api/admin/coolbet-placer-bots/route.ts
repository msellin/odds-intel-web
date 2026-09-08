/**
 * /api/admin/coolbet-placer-bots — superadmin control for real-money Coolbet UI
 * placement (COOLBET-PLACER-CONTROL-2026-09-08).
 *
 * Backs the "Coolbet UI Placer — Control" panel on /admin/shadow-bots. Toggles
 * `coolbet_placer_bots.ui_place_enabled` per bot at runtime — WITHOUT touching
 * pick generation. The engine placer (scripts/place_coolbet_ui.py) reads this
 * table each run and intersects it with a code-level hard whitelist
 * (PLACEABLE_BOTS), so this endpoint can only ever REDUCE what places or
 * re-enable a bot the code already trusts — it can never make an arbitrary bot
 * stake real money.
 *
 *   GET  → { bots: [{ bot_name, ui_place_enabled, note, updated_at }] }
 *   POST → { bot_name: string, ui_place_enabled: boolean }
 *
 * SAFETY:
 *   - Superadmin only (mirrors the shadow-bots page gate).
 *   - POST is an UPDATE of an EXISTING row only — it never inserts. A bot name
 *     with no seeded row is rejected (404). New placeable bots are added by a
 *     reviewed migration, not by this API, so the surface cannot enable a bot
 *     the operator never registered.
 *   - Writes go through the service client (bypasses RLS) which is never
 *     exposed to the browser.
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

  // UPDATE only — never insert. The engine's PLACEABLE_BOTS whitelist is the
  // real guard, but restricting this surface to seeded rows means it cannot even
  // create an enabled row for an unknown bot.
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
