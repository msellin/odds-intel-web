/**
 * GET /api/admin/bots/controls/audit?bot_name=&limit= — the control_changes log (#139 phase A).
 *
 * Feeds the Activity sheet and each bot's Activity tab. Read-only, superadmin only (the table is
 * not anon/authenticated-readable, migration 413). In the dev fixture preview it serves the
 * preview's fake log and reads nothing.
 */
import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { isBotBoardDevPreview, loadControlState } from "@/lib/bot-board";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bot = url.searchParams.get("bot_name")?.trim() || null;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  if (bot && !/^[a-z0-9_]{1,200}$/i.test(bot)) return NextResponse.json({ error: "invalid bot" }, { status: 400 });

  if (isBotBoardDevPreview()) {
    const s = await loadControlState(null);
    const rows = s.changes.rows.filter((r) => !bot || r.bot_name === bot).slice(0, limit);
    return NextResponse.json({ rows, error: null });
  }
  const gate = await requireSuperadmin();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let q = gate.db
    .from("control_changes")
    .select("id, created_at, actor, source, control, bot_name, old_value, new_value, reason, outcome, refusal")
    .order("id", { ascending: false })
    .limit(limit);
  if (bot) q = q.eq("bot_name", bot);
  const { data, error } = await q;
  if (error) return NextResponse.json({ rows: [], error: `control_changes: ${error.message}` });
  return NextResponse.json({ rows: data ?? [], error: null });
}
