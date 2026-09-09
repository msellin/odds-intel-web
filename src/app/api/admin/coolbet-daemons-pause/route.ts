/**
 * /api/admin/coolbet-daemons-pause — superadmin control for the GLOBAL Coolbet
 * footprint pause (COOLBET-DAEMONS-PAUSE-2026-09-09).
 *
 * When Coolbet's Imperva bot-detection escalates (the "STAY COOL" wall), the fix
 * is to REDUCE our request footprint from the flagged IP and let the flag decay.
 * This endpoint flips `coolbet_session_state.daemons_paused`; the Mac footprint
 * daemons (odds-snapshot = coolbet_explorer --board, feed-watchdog, and the
 * mac-daemon tick) poll it at the start of each run and skip their Coolbet HTTP
 * work while paused. One click from /admin/shadow-bots instead of an SSH.
 *
 * This is DISTINCT from placement_paused (the real-money kill switch) — pausing
 * daemons stops the footprint that provokes Imperva; it does not, by itself,
 * change what would place once collection resumes.
 *
 *   GET  → { paused: boolean, paused_at: string|null, reason: string|null }
 *   POST → { paused: boolean, reason?: string }
 *
 * SAFETY: superadmin only; writes via the service client (never exposed to the
 * browser). The single-row coolbet_session_state (id=1) is updated in place.
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
    .from("coolbet_session_state")
    .select(
      "daemons_paused, daemons_paused_at, daemons_paused_reason, mac_daemon_last_tick_at, last_heartbeat_at",
    )
    .eq("id", 1)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    paused: !!data?.daemons_paused,
    paused_at: data?.daemons_paused_at ?? null,
    reason: data?.daemons_paused_reason ?? null,
    // liveness — so the panel can tell "flag will be honored" from "no daemon
    // is running to honor it" (the web page cannot start/stop the Mac daemons).
    last_tick_at: data?.mac_daemon_last_tick_at ?? null,
    last_heartbeat_at: data?.last_heartbeat_at ?? null,
  });
}

export async function POST(req: Request) {
  const gate = await requireSuperadmin();
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: { paused?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const paused = typeof body.paused === "boolean" ? body.paused : null;
  if (paused === null) {
    return NextResponse.json({ error: "paused (boolean) required" }, { status: 400 });
  }
  const reason =
    paused && typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 200)
      : paused
        ? "paused from /admin/shadow-bots"
        : null;

  const { error } = await gate.db
    .from("coolbet_session_state")
    .update({
      daemons_paused: paused,
      daemons_paused_at: paused ? new Date().toISOString() : null,
      daemons_paused_reason: reason,
    })
    .eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, paused, reason });
}
