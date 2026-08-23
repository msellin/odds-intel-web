/**
 * /api/me/pick-marks — per-user tri-state pick review workflow.
 *
 * Backs the tri-state icon on /admin/shadow-bots. Operator tracks three stages:
 *   1 = reviewed (looked at, possibly waiting for better odds)
 *   2 = bet placed (manually placed at a bookmaker)
 *   (no row) = not yet looked at
 *
 * GET  → { marks: { [pickId]: 1 | 2 } }
 * POST → { pickId: string, state: 0 | 1 | 2 }
 *          state 0 = delete (cycle back to untouched)
 *          state 1 = reviewed
 *          state 2 = bet placed
 *
 * Auth via cookie-backed Supabase session. DB writes via service client with
 * explicit user_id filter — bypasses RLS, so filter discipline is the guard.
 */
import { NextResponse } from "next/server";
import {
  createSupabaseServer,
  createServerServiceClient,
} from "@/lib/supabase-server";

export async function GET() {
  const auth = await createSupabaseServer();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createServerServiceClient();
  const { data, error } = await db
    .from("user_pick_marks")
    .select("pick_id, state")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const marks: Record<string, 1 | 2> = {};
  for (const r of (data ?? []) as { pick_id: string; state: number }[]) {
    marks[r.pick_id] = r.state === 1 ? 1 : 2;
  }
  return NextResponse.json({ marks });
}

export async function POST(req: Request) {
  const auth = await createSupabaseServer();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { pickId?: unknown; state?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const pickId = typeof body.pickId === "string" ? body.pickId : null;
  const state = typeof body.state === "number" ? body.state : null;
  if (!pickId || state === null || ![0, 1, 2].includes(state)) {
    return NextResponse.json(
      { error: "pickId (string) and state (0|1|2) required" },
      { status: 400 },
    );
  }

  const db = createServerServiceClient();

  if (state === 0) {
    const { error } = await db
      .from("user_pick_marks")
      .delete()
      .eq("user_id", user.id)
      .eq("pick_id", pickId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await db
      .from("user_pick_marks")
      .upsert(
        { user_id: user.id, pick_id: pickId, state },
        { onConflict: "user_id,pick_id" },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, state });
}
