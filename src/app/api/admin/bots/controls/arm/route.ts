/**
 * POST /api/admin/bots/controls/arm — ARM real money (#139 phase A, owner decisions 1 and 2).
 *
 * The one "start money" switch. Owner-only (requireOwner: superadmin AND listed in the server env
 * OWNER_USER_IDS), two steps on the page — type ARM REAL MONEY, then a written reason — no
 * Telegram code (decision 1) and no expiry (decision 2). The write is the Postgres function
 * `admin_arm_real_money` (migration 413), which re-checks the phrase, the reason length and the
 * expected state, sets `real_money_armed`, and appends the audit row in one transaction. The
 * operator chat is notified afterwards (a courtesy — a failed notice does not undo the arm).
 *
 * Arming alone stakes nothing: the placement pause, the per-bot eligibility switches and a live
 * executor on the Mac are separate layers.
 *
 *   body: { reason, confirm_text, expected: false, request_id }
 */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin-auth";
import { isBotBoardDevPreview } from "@/lib/bot-board";
import { notifyOperator, type NotifyOutcome } from "@/lib/telegram-operator";
import { MAX_REASON, MIN_ARM_REASON, PHRASE_ARM, PREVIEW_REFUSAL } from "@/lib/bot-controls/types";

export const dynamic = "force-dynamic";

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  if (isBotBoardDevPreview()) return bad(PREVIEW_REFUSAL, 403);
  const gate = await requireOwner();
  if ("error" in gate) {
    return bad(gate.status === 403 ? "arming real money is owner-only (OWNER_USER_IDS)" : gate.error, gate.status);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("invalid json");
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, MAX_REASON) : "";
  const confirm = typeof body.confirm_text === "string" ? body.confirm_text.trim() : "";
  if (body.expected !== false) return bad("arming needs the current state read as NOT armed");
  if (confirm !== PHRASE_ARM) return bad(`type ${PHRASE_ARM} to confirm`);
  if (reason.length < MIN_ARM_REASON) return bad(`arming needs a written reason of at least ${MIN_ARM_REASON} characters`);
  const requestId = typeof body.request_id === "string" && /^[0-9a-f-]{36}$/i.test(body.request_id) ? body.request_id : null;

  const actor = gate.email ?? `user:${gate.userId}`;
  const { data, error } = await gate.db.rpc("admin_arm_real_money", {
    p_reason: reason,
    p_confirm: confirm,
    p_actor: actor,
    p_actor_user_id: gate.userId,
    p_expected: false,
    p_request_id: requestId,
  });
  if (error) return bad(`admin_arm_real_money: ${error.message}`, 500);
  const res = (data ?? {}) as { outcome?: string };

  let notify: NotifyOutcome = "skipped";
  if (res.outcome === "applied") {
    notify = await notifyOperator(`🔴 REAL MONEY ARMED by ${actor} — "${reason}"\nhttps://oddsintel.app/admin/bots`);
  }
  return NextResponse.json({ ...res, notify });
}
