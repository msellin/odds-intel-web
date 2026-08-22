/**
 * /api/me/pick-marks — per-user pick checkbox state.
 *
 * Backs the "I placed this bet" checkbox on /picks. Operator ships ~9
 * picks/day and can't remember which ones already went in; the checkbox
 * survives page refresh via `user_pick_marks` (see migration 278).
 *
 * GET  → { marked: string[] } — pick ids the current user has ticked
 * POST → { pickId: string, marked: boolean } → upserts or deletes one row
 *
 * Auth via cookie-backed Supabase session (same pattern as /api/me/profile).
 * DB writes via service client with an EXPLICIT user_id filter — the client
 * bypasses RLS, so filter discipline is the only guard against cross-user
 * writes.
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
    .select("pick_id")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    marked: (data ?? []).map((r: { pick_id: string }) => r.pick_id),
  });
}

export async function POST(req: Request) {
  const auth = await createSupabaseServer();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { pickId?: unknown; marked?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const pickId = typeof body.pickId === "string" ? body.pickId : null;
  const marked = typeof body.marked === "boolean" ? body.marked : null;
  if (!pickId || marked === null) {
    return NextResponse.json(
      { error: "pickId (string) and marked (boolean) required" },
      { status: 400 },
    );
  }

  const db = createServerServiceClient();

  if (marked) {
    const { error } = await db
      .from("user_pick_marks")
      .upsert(
        { user_id: user.id, pick_id: pickId },
        { onConflict: "user_id,pick_id" },
      );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await db
      .from("user_pick_marks")
      .delete()
      .eq("user_id", user.id)
      .eq("pick_id", pickId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, marked });
}
