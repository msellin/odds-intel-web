/**
 * POST /api/admin/bots/controls — every /admin/bots control write except arming (#139 phase A).
 *
 * Spec: odds-intel-engine dev/active/bots-control-panel-spec.md §2 (owner decisions §16 override).
 *
 *   body: { control, bot_name?, value, reason?, confirm_text?, expected, request_id }
 *   → { outcome: applied|noop|refused|conflict, refusal, current, at, changed_by?, changed_at?, notify }
 *
 * SAFETY
 *  - Refused outright in the dev fixture preview (BOT_BOARD_FIXTURE): the preview renders the
 *    controls read-only and must never write.
 *  - Superadmin is checked HERE, before the body is read. The page gate is not trusted.
 *  - The only write is the Postgres function `admin_set_control` (engine migration 413), which
 *    locks the row, checks `expected`, validates, applies the change and appends the
 *    `control_changes` audit row in ONE transaction. No direct update of a control table.
 *  - Arming real money is NOT reachable here (`real_money_disarm` can only send false); it has its
 *    own owner-only route (./arm). No per-bot control can touch the fleet arming switch.
 *  - The start direction of every control (resume placement, real-money eligibility ON, show on
 *    /picks ON, pausing the customer channel) needs a typed confirmation, a written reason and
 *    the expected current value. The route checks them and the DB function checks them again.
 */
import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { isBotBoardDevPreview } from "@/lib/bot-board";
import { notifyOperator, type NotifyOutcome } from "@/lib/telegram-operator";
import {
  CONTROL_LABEL,
  MAX_REASON,
  MIN_REASON,
  PHRASE_PAUSE_PICKS,
  PHRASE_RESUME,
  PHRASE_RESUME_STRATEGIC,
  PREVIEW_REFUSAL,
  isStartDirection,
  type DbControl,
  type PageControl,
} from "@/lib/bot-controls/types";

export const dynamic = "force-dynamic";

const PAGE_CONTROLS: PageControl[] = [
  "placement_paused",
  "publishing_paused",
  "daemons_paused",
  "real_money_disarm",
  "placer_enabled",
  "show_on_picks",
];
const PER_BOT: PageControl[] = ["placer_enabled", "show_on_picks"];
const BOT_RE = /^[a-z0-9_]{1,200}$/i;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  if (isBotBoardDevPreview()) return bad(PREVIEW_REFUSAL, 403);
  const gate = await requireSuperadmin();
  if ("error" in gate) return bad(gate.error, gate.status);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("invalid json");
  }

  const control = body.control as PageControl;
  if (!PAGE_CONTROLS.includes(control)) return bad("unknown control");
  if (typeof body.value !== "boolean") return bad("value must be a boolean");
  const value = body.value;
  const botName = typeof body.bot_name === "string" ? body.bot_name.trim() : null;
  if (PER_BOT.includes(control) && (!botName || !BOT_RE.test(botName))) return bad("bot_name required");
  if (!PER_BOT.includes(control) && botName) return bad("fleet controls take no bot_name");
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, MAX_REASON) : "";
  const confirm = typeof body.confirm_text === "string" ? body.confirm_text.trim() : "";
  const expected = typeof body.expected === "boolean" ? body.expected : null;
  const requestId = typeof body.request_id === "string" && /^[0-9a-f-]{36}$/i.test(body.request_id) ? body.request_id : null;

  // Disarm only. Arming is the owner's two-step action on its own route.
  if (control === "real_money_disarm" && value !== false) return bad("this control can only disarm");

  // The start direction: typed confirmation + reason + a readable current state (the DB re-checks).
  if (isStartDirection(control, value)) {
    // Pausing the customer channel is typed + reasoned but still a stop for the channel: allowed unread.
    if (expected === null && control !== "publishing_paused") return bad("the current state must be readable to start anything");
    if (reason.length < MIN_REASON) return bad(`a written reason of at least ${MIN_REASON} characters is required`);
    if ((control === "placer_enabled" || control === "show_on_picks") && confirm !== botName) {
      return bad("type the bot name to confirm");
    }
    if (control === "placement_paused" && confirm !== PHRASE_RESUME && confirm !== PHRASE_RESUME_STRATEGIC) {
      return bad(`type ${PHRASE_RESUME} to confirm`);
    }
    if (control === "publishing_paused" && confirm !== PHRASE_PAUSE_PICKS) return bad(`type ${PHRASE_PAUSE_PICKS} to confirm`);
  }

  const dbControl: DbControl = control === "real_money_disarm" ? "real_money_armed" : control;
  const actor = gate.email ?? `user:${gate.userId}`;
  const { data, error } = await gate.db.rpc("admin_set_control", {
    p_control: dbControl,
    p_bot: botName,
    p_value: value,
    p_reason: reason || null,
    p_confirm: confirm || null,
    p_actor: actor,
    p_actor_user_id: gate.userId,
    p_source: "web",
    p_expected: expected,
    p_request_id: requestId,
  });
  if (error) return bad(`admin_set_control: ${error.message}`, 500);
  const res = (data ?? {}) as { outcome?: string; old?: unknown; current?: unknown };

  let notify: NotifyOutcome = "skipped";
  if (res.outcome === "applied") {
    notify = await notifyOperator(noticeLine(control, botName, res.old, value, actor, reason));
  }
  return NextResponse.json({ ...res, notify });
}

function word(control: PageControl, v: unknown): string {
  if (typeof v !== "boolean") return "unknown";
  switch (control) {
    case "placement_paused":
      return v ? "paused" : "running";
    case "publishing_paused":
      return v ? "paused" : "sending";
    case "daemons_paused":
      return v ? "paused" : "collecting";
    case "real_money_disarm":
      return v ? "ARMED" : "not armed";
    case "placer_enabled":
    case "show_on_picks":
      return v ? "ON" : "OFF";
  }
}

/** Spec §2.8: 🔴 toward money, 🟢 away from it, 🔧 otherwise. */
function noticeLine(control: PageControl, bot: string | null, old: unknown, value: boolean, actor: string, reason: string) {
  const towardMoney = (control === "placement_paused" && !value) || (control === "placer_enabled" && value);
  const awayFromMoney =
    (control === "placement_paused" && value) || control === "real_money_disarm" || (control === "placer_enabled" && !value);
  const icon = towardMoney ? "🔴" : awayFromMoney ? "🟢" : "🔧";
  const label = CONTROL_LABEL[control === "real_money_disarm" ? "real_money_armed" : control];
  const link = `https://oddsintel.app/admin/bots${bot ? `?bot=${encodeURIComponent(bot)}&tab=activity` : ""}`;
  return (
    `${icon} /admin/bots · ${label}${bot ? ` ${bot}` : ""} · ${word(control, old)} → ${word(control, value)} · ${actor}` +
    (reason ? ` · "${reason}"` : "") +
    `\n${link}`
  );
}
