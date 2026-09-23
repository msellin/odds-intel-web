/**
 * /api/admin/feed-control — pause / resume / run now for one feed on /admin/feeds
 * (#107 FEEDS-DASHBOARD phase B, 2026-09-23).
 *
 *   POST { feed_id, action: "pause" | "resume" | "run_now", reason? }
 *
 * This route only WRITES A REQUEST to feed_controls (+ an audit row in
 * feed_actions). The engine enforces it: `_run_job` skips a paused feed's job
 * (cached 30 s), and a 30-second drain turns run-now into a one-off run of that
 * feed's own scheduler wrapper. Nothing on the VPS is executed from here.
 *
 * SAFETY: superadmin only; service client never exposed to the browser; the
 * action must be one the engine's registry grants that feed (feed_status.controls)
 * — so a feed without controls cannot be paused by crafting a request.
 */
import { NextResponse } from "next/server";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const ACTIONS = ["pause", "resume", "run_now"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(req: Request) {
  const auth = await createSupabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = createServerServiceClient();
  const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
  if (!profile?.is_superadmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { feed_id?: unknown; action?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const feedId = typeof body.feed_id === "string" ? body.feed_id : "";
  const action = (ACTIONS as readonly string[]).includes(String(body.action)) ? (body.action as Action) : null;
  if (!feedId || !action) {
    return NextResponse.json({ error: "feed_id and action (pause|resume|run_now) required" }, { status: 400 });
  }
  const reason =
    typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 200) : null;

  // The engine's registry decides what each feed allows.
  const { data: feed } = await db.from("feed_status").select("feed_id, controls").eq("feed_id", feedId).single();
  const controls: string[] = (feed?.controls as string[] | null) ?? [];
  const needed = action === "run_now" ? "run_now" : "pause";
  if (!feed || !controls.includes(needed)) {
    return NextResponse.json({ error: `feed ${feedId} has no ${needed} control` }, { status: 400 });
  }

  const actor = user.email ?? user.id;
  const now = new Date().toISOString();
  const patch =
    action === "pause"
      ? { paused: true, paused_reason: reason, paused_by: actor, paused_at: now }
      : action === "resume"
        ? { paused: false, paused_reason: null, paused_by: null, paused_at: null }
        : { run_now_requested_at: now, run_now_requested_by: actor };

  const { error } = await db
    .from("feed_controls")
    .upsert({ feed_id: feedId, ...patch, updated_at: now }, { onConflict: "feed_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("feed_actions").insert({
    feed_id: feedId,
    action,
    reason,
    actor,
    // pause / resume take effect in the engine within 30 s; run_now is marked
    // handled by the engine's drain when it starts (or refuses) the run.
    ...(action === "run_now" ? {} : { handled_at: now, result: `${action}d` }),
  });

  return NextResponse.json({ ok: true, feed_id: feedId, action });
}
