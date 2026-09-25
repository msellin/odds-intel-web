import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// MANUAL-PLACE: only this chat id can use the "Record at Coolbet" button.
// Mirrors the engine's TELEGRAM_CHAT_ID — env name kept identical so a single
// value drives both sides.
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createAdmin() {
  const url =
    process.env.NEXT_PUBLIC_POSTGREST_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.POSTGREST_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

async function sendReply(chatId: number, text: string, parseMode?: "Markdown" | "HTML") {
  if (!BOT_TOKEN) return;
  // Telegram caps messages at 4096 chars. Our /today report could
  // exceed that with high placement days — defensively truncate so the
  // call doesn't 400 (vs silently dropping all info beyond char 4096).
  const safe = text.length > 4000 ? text.slice(0, 3970) + "\n…(truncated)" : text;
  const body: Record<string, unknown> = { chat_id: chatId, text: safe };
  if (parseMode) body.parse_mode = parseMode;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// COOLBET-FS-SESSION-STABLE Step 1.6 (2026-06-11): operator commands.
// Gated by TELEGRAM_CHAT_ID — same single-operator env the existing
// place-button + admin alerts already use. Non-operator chats get a
// silent no-op so random users messaging the bot don't trigger them.

function isOperator(chatId: number): boolean {
  return !!ADMIN_CHAT_ID && String(chatId) === String(ADMIN_CHAT_ID);
}

function fmtTimeAgo(ts: string | null | undefined): string {
  if (!ts) return "never";
  const ageMs = Date.now() - new Date(ts).getTime();
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s ago`;
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}m ago`;
  if (ageMs < 86_400_000) return `${Math.round(ageMs / 3_600_000)}h ago`;
  return `${Math.round(ageMs / 86_400_000)}d ago`;
}

function fmtJwtTtl(jwtExpAt: string | null | undefined): string {
  if (!jwtExpAt) return "no JWT";
  const ttlMs = new Date(jwtExpAt).getTime() - Date.now();
  if (ttlMs < 0) return `EXPIRED ${fmtTimeAgo(jwtExpAt)}`;
  if (ttlMs < 60_000) return `${Math.round(ttlMs / 1000)}s left`;
  return `${Math.round(ttlMs / 60_000)}m left`;
}

async function handleStatusCommand(
  chatId: number,
  admin: ReturnType<typeof createAdmin>,
): Promise<void> {
  // Read the singleton state row (mig 242 + 243 + 244).
  const { data: state, error } = await admin
    .from("coolbet_session_state")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !state) {
    await sendReply(chatId, "❌ Could not read coolbet_session_state — DB or RLS issue.");
    return;
  }

  const healthGlyph = state.session_healthy ? "✅" : "❌";
  const pausedLine = state.placement_paused
    ? `\n🛑 PLACEMENT PAUSED — reason: ${state.placement_paused_reason || "(none)"}\n   paused at: ${fmtTimeAgo(state.placement_paused_at)}`
    : "";

  // PICKS-PUBLISH-DECOUPLED-FROM-OWN-PAUSE (2026-09-15, engine mig 353).
  // Two independent switches now, and /status must show both — the whole
  // failure being fixed is that one of them was invisible while it silently
  // did the other's job. Publishing OFF is the customer-visible one, so it
  // gets the louder glyph even though placement is the one that risks money.
  const publishingLine = state.publishing_paused
    ? `\n📴 PICK PUBLISHING PAUSED — customers are getting NOTHING\n   reason: ${state.publishing_paused_reason || "(none)"}\n   paused at: ${fmtTimeAgo(state.publishing_paused_at)}`
    : `\n📣 Pick publishing: ON (@oddsintelpicks)`;

  // MAC-DAEMON-HEARTBEAT (mig 251): >35min stale = daemon process
  // likely dead. Below 35min: show last tick result. Never seen:
  // first-deploy / heartbeat write disabled.
  const tickAt = state.mac_daemon_last_tick_at;
  const tickResult = state.mac_daemon_last_tick_result as
    | { qualified?: number; placed?: number; skipped?: number; errors?: number; synced_from_coolbet?: number; elapsed_s?: number }
    | null;
  const tickAgeMs = tickAt ? Date.now() - new Date(tickAt).getTime() : Infinity;
  let daemonLine: string;
  if (!tickAt) {
    daemonLine = `🖥  Mac daemon: ❓ never seen heartbeat (DB column populated by daemon — first tick yet to land)`;
  } else if (tickAgeMs > 35 * 60_000) {
    daemonLine = `🖥  Mac daemon: ❌ DEAD — last tick ${fmtTimeAgo(tickAt)} (process likely down / laptop asleep / launchd unloaded)`;
  } else {
    const r = tickResult || {};
    daemonLine = `🖥  Mac daemon: ✅ alive — last tick ${fmtTimeAgo(tickAt)}\n` +
      `   qualified=${r.qualified ?? "?"} placed=${r.placed ?? "?"} skipped=${r.skipped ?? "?"} errors=${r.errors ?? "?"}` +
      (r.elapsed_s != null ? ` (${Number(r.elapsed_s).toFixed(1)}s)` : "");
  }

  const lines = [
    `${healthGlyph} Coolbet session — ${state.session_healthy ? "healthy" : "UNHEALTHY"}`,
    pausedLine,
    publishingLine,
    ``,
    daemonLine,
    ``,
    `🔐 last login:  ${fmtTimeAgo(state.last_login_at)} (${state.last_login_method || "?"})`,
    `⏱  JWT TTL:    ${fmtJwtTtl(state.jwt_exp_at)}`,
    `💓 heartbeat:  ${state.last_heartbeat_ok ? "OK" : "FAIL"} ${fmtTimeAgo(state.last_heartbeat_at)}`,
    `🍪 cookies:    ${state.cookies_count_last ?? 0} refreshed ${fmtTimeAgo(state.cookies_last_refresh_at)}`,
  ];

  if (state.last_error) {
    lines.push("", `⚠️  last error: ${String(state.last_error).slice(0, 300)}`);
    lines.push(`   at: ${fmtTimeAgo(state.last_error_at)}`);
  }
  await sendReply(chatId, lines.filter((l) => l !== "").join("\n"));
}

async function handleTodayCommand(
  chatId: number,
  admin: ReturnType<typeof createAdmin>,
): Promise<void> {
  // Today's real_bets — what got placed, slippage, results so far.
  const { data: bets, error } = await admin
    .from("real_bets")
    .select("market, selection, captured_odds, actual_odds, stake, result, pnl, placed_at, bookmaker")
    .gte("placed_at", new Date(Date.now() - 24 * 3600_000).toISOString())
    .order("placed_at", { ascending: false })
    .limit(20);

  if (error) {
    await sendReply(chatId, `❌ DB error: ${error.message}`);
    return;
  }
  if (!bets || bets.length === 0) {
    await sendReply(chatId, "📋 No real_bets in the last 24h.");
    return;
  }

  const totalStake = bets.reduce((s: number, b: { stake: number | null }) => s + Number(b.stake ?? 0), 0);
  const settled = bets.filter((b: { result: string | null }) => b.result === "won" || b.result === "lost");
  const won = bets.filter((b: { result: string | null }) => b.result === "won").length;
  const lost = bets.filter((b: { result: string | null }) => b.result === "lost").length;
  const pending = bets.length - settled.length;
  const totalPnL = bets.reduce((s: number, b: { pnl: number | null }) => s + Number(b.pnl ?? 0), 0);

  const lines = [
    `📋 real_bets last 24h: ${bets.length} placements`,
    `   stake: €${totalStake.toFixed(2)} · settled: ${settled.length} (${won}W/${lost}L) · pending: ${pending}`,
    `   PnL: ${totalPnL >= 0 ? "+" : ""}€${totalPnL.toFixed(2)}`,
    ``,
  ];

  // Show up to 10 most-recent entries — beyond that we'd exceed Telegram's
  // 4096-char ceiling. Older ones are visible via the /admin/real-bets page.
  for (const b of bets.slice(0, 10)) {
    const ts = new Date(b.placed_at).toISOString().slice(11, 16); // HH:MM
    const slip = b.actual_odds && b.captured_odds
      ? ` (slip ${(((b.actual_odds - b.captured_odds) / b.captured_odds) * 100).toFixed(1)}%)`
      : "";
    const outcome = b.result === "won" ? "✓"
      : b.result === "lost" ? "✗"
      : "⏳";
    const pnl = (b.result === "won" || b.result === "lost") && b.pnl !== null
      ? ` ${b.pnl >= 0 ? "+" : ""}€${Number(b.pnl).toFixed(2)}`
      : "";
    lines.push(`${outcome} ${ts} ${b.market}/${b.selection} @ ${b.actual_odds ?? "?"}${slip} · €${b.stake}${pnl}`);
  }

  if (bets.length > 10) {
    lines.push("", `…and ${bets.length - 10} more — see /admin/real-bets`);
  }
  await sendReply(chatId, lines.join("\n"));
}

// #139 phase A (owner decision 3, 2026-09-24): /admin/bots is THE control surface for our own
// real money; Telegram is notifications only. /pause stays as a STOP-ONLY emergency command
// (stopping is always safe, from anywhere). /resume and every other real-money START command
// are refused here with a pointer to the page, where resuming needs a typed confirmation and a
// reason. The pause goes through the audited DB function (engine migration 413,
// admin_set_control, source 'telegram'), so it lands in the control_changes log. If that
// function is unavailable (e.g. the migration has not deployed yet) the STOP falls back to the
// plain update — an emergency stop must never depend on the audit table.
const BOTS_PAGE = "https://oddsintel.app/admin/bots";
const START_REFUSAL =
  `⛔ Real-money START commands are not taken from Telegram (owner decision, 2026-09-24).\n` +
  `Resume placement, arm real money, or switch a bot on at ${BOTS_PAGE} — typed confirmation + reason, audited.\n` +
  `Stopping still works here: /pause <reason>.`;

async function pausePlacementAudited(
  admin: ReturnType<typeof createAdmin>,
  actor: string,
  reason: string,
): Promise<string | null> {
  const { data, error } = await admin.rpc("admin_set_control", {
    p_control: "placement_paused",
    p_bot: null,
    p_value: true,
    p_reason: reason || null,
    p_confirm: null,
    p_actor: actor,
    p_actor_user_id: null,
    p_source: "telegram",
    p_expected: null,
    p_request_id: null,
  });
  if (!error) {
    const outcome = (data as { outcome?: string } | null)?.outcome;
    return outcome === "applied" || outcome === "noop" ? null : `admin_set_control: ${outcome ?? "no outcome"}`;
  }
  console.error("admin_set_control (telegram pause) failed — applying the STOP without its audit row", error);
  // STOP-direction fallback only: never used for anything that starts money.
  const { error: e2 } = await admin
    .from("coolbet_session_state")
    .update({
      placement_paused: true,
      placement_paused_at: new Date().toISOString(),
      placement_paused_reason: reason || `${actor} /pause`,
    })
    .eq("id", 1)
    // a re-pause never rewrites a standing (e.g. strategic) reason; the DB trigger enforces it too
    .eq("placement_paused", false);
  return e2 ? e2.message : null;
}

async function handlePauseCommand(
  chatId: number,
  admin: ReturnType<typeof createAdmin>,
  reason: string,
): Promise<void> {
  const err = await pausePlacementAudited(admin, `telegram:${chatId}`, reason || "operator /pause");
  if (err) {
    await sendReply(chatId, `❌ Could not set placement_paused: ${err}`);
    return;
  }
  await sendReply(
    chatId,
    `🛑 Auto-placer PAUSED. Every placer refuses at its next check.\n` +
    `Pick publishing is NOT affected — use /pausepicks for that.\n` +
    `Resuming is done on ${BOTS_PAGE} (typed confirmation + reason) — not from Telegram.\n` +
    `Reason logged: ${reason || "(none)"}`,
  );
}

async function handleResumeCommand(chatId: number): Promise<void> {
  await sendReply(chatId, START_REFUSAL);
}

// PICKS-PUBLISH-DECOUPLED-FROM-OWN-PAUSE (2026-09-15) — the customer feed's
// own kill switch. Until engine migration 353, /pause was the only thing that
// could silence @oddsintelpicks, and it did so as an undocumented side effect
// of halting REAL-MONEY placement. Two different decisions ("stop staking our
// money" vs "stop publishing to readers") must not share one flag: the
// OWN-path verdict of 2026-09-14 flipped the placement flag and armed a
// customer-feed outage nobody asked for. The operator keeps a deliberate
// switch — this one — and it says what it does.
async function handlePausePicksCommand(
  chatId: number,
  admin: ReturnType<typeof createAdmin>,
  reason: string,
): Promise<void> {
  const { error } = await admin
    .from("coolbet_session_state")
    .update({
      publishing_paused: true,
      publishing_paused_at: new Date().toISOString(),
      publishing_paused_reason: reason || "operator /pausepicks",
    })
    .eq("id", 1);
  if (error) {
    await sendReply(chatId, `❌ Could not set publishing_paused: ${error.message}`);
    return;
  }
  await sendReply(
    chatId,
    `📴 Pick publishing PAUSED. Nothing further is SENT to @oddsintelpicks until /resumepicks.\n` +
    `Picks are still RECORDED (the pre-registered test and /picks keep running) — picks made while paused are not sent later.\n` +
    `Real-money placement is unaffected — use /pause for that.\n` +
    `Reason logged: ${reason || "(none)"}`,
  );
}

async function handleResumePicksCommand(
  chatId: number,
  admin: ReturnType<typeof createAdmin>,
): Promise<void> {
  const { error } = await admin
    .from("coolbet_session_state")
    .update({
      publishing_paused: false,
      publishing_paused_at: null,
      publishing_paused_reason: null,
    })
    .eq("id", 1);
  if (error) {
    await sendReply(chatId, `❌ Could not clear publishing_paused: ${error.message}`);
    return;
  }
  await sendReply(chatId, "📣 Pick publishing RESUMED — qualifying picks post to @oddsintelpicks again.");
}

async function handleHelpCommand(chatId: number): Promise<void> {
  await sendReply(
    chatId,
    [
      "🤖 OddsIntel Coolbet bot — operator commands:",
      "",
      "/status        — session health, JWT TTL, last heartbeat, errors",
      "/today         — real_bets placed in last 24h + stake + PnL",
      "/pause <reason>— halt REAL-MONEY placement (stop-only; does not touch picks)",
      "               resume / arm / switch bots on at oddsintel.app/admin/bots",
      "/pausepicks <reason> — stop SENDING picks to @oddsintelpicks (recording continues)",
      "/resumepicks   — resume posting picks to @oddsintelpicks",
      "/help          — this message",
      "",
      "User commands (anyone):",
      "/start <uuid>  — connect this chat to a user account",
      "/stop          — disconnect",
    ].join("\n"),
  );
}

// MANUAL-PLACE: ack the button tap. Telegram requires a callback_query response
// within ~15s or the button shows a spinner forever; we ack immediately, the
// actual placement happens asynchronously on Railway.
async function answerCallbackQuery(callbackQueryId: string, text: string, alert = false) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: alert,
    }),
  });
}

async function handleCallbackQuery(
  cq: Record<string, unknown>,
  admin: ReturnType<typeof createAdmin>,
) {
  const cqId = cq.id as string | undefined;
  const data = (cq.data as string | undefined) ?? "";
  const from = cq.from as Record<string, unknown> | undefined;
  const fromId = from?.id as number | undefined;
  const message = cq.message as Record<string, unknown> | undefined;
  const messageId = message?.message_id as number | undefined;
  const chatId = (message?.chat as Record<string, unknown> | undefined)?.id as
    | number
    | undefined;

  if (!cqId || !fromId) return;

  // Admin-gate: only the configured admin chat can place. Any other user
  // taps a forwarded message → instant "not authorised" alert.
  if (!ADMIN_CHAT_ID || String(fromId) !== String(ADMIN_CHAT_ID)) {
    await answerCallbackQuery(cqId, "🚫 Not authorised", true);
    return;
  }

  // COOLBET-SIGNALER-A-BUTTONS (2026-06-12): inline buttons on bet-signal
  // messages let the operator mark each pick as placed/skipped with one
  // tap. Updates simulated_bets.user_placed_at / user_skipped_at and
  // edits the original message to append a status footer.
  if (data.startsWith("sigplaced:") || data.startsWith("sigskip:")) {
    const isPlaced = data.startsWith("sigplaced:");
    const prefix = isPlaced ? "sigplaced:" : "sigskip:";
    const sigSimId = data.slice(prefix.length).trim();
    if (!UUID_RE.test(sigSimId)) {
      await answerCallbackQuery(cqId, "❌ Invalid bet id", true);
      return;
    }
    const column = isPlaced ? "user_placed_at" : "user_skipped_at";

    // Look up the (match,market,selection) tuple so we mark ALL sibling
    // bot picks at once — same dedup model as _mark_signaled in the
    // signaler. Without this, the *other* bots' picks of the same bet
    // would still appear as "unplaced" in any future tracker.
    const { data: target, error: targetErr } = await admin
      .from("simulated_bets")
      .select("match_id, market, selection")
      .eq("id", sigSimId)
      .maybeSingle();
    if (targetErr || !target) {
      await answerCallbackQuery(cqId, "❌ Bet not found", true);
      return;
    }

    const { error: updErr } = await admin
      .from("simulated_bets")
      .update({ [column]: new Date().toISOString() })
      .eq("match_id", target.match_id)
      .eq("market", target.market)
      .eq("selection", target.selection)
      .is(column, null);
    if (updErr) {
      console.error(`simulated_bets.${column} update failed`, updErr);
      await answerCallbackQuery(cqId, "❌ DB update failed", true);
      return;
    }

    // Edit the original message to show "✓ Marked placed HH:MM UTC" /
    // "⏭ Skipped HH:MM UTC" footer. Keep original body intact above the
    // footer so the operator's audit trail isn't lost.
    const original = (message?.text as string | undefined) ?? "";
    const stamp = new Date().toISOString().slice(11, 16) + " UTC";
    const footer = isPlaced
      ? `\n— ✅ Placed @ ${stamp}`
      : `\n— ⏭ Skipped @ ${stamp}`;
    if (chatId && messageId && BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: original + footer,
          disable_web_page_preview: true,
        }),
      });
    }

    await answerCallbackQuery(cqId, isPlaced ? "✅ Marked placed" : "⏭ Skipped");
    return;
  }

  // INLINE-HEAL-BUTTONS (2026-06-17): operator-initiated daemon control
  // via inline buttons attached to daemon-fail-burst alerts and the daily
  // summary. Three actions:
  //
  //   coolbet-heal:   → INSERT a row into coolbet_daemon_commands. The Mac
  //                     daemon polls that table every ~30s and runs
  //                     auto_self_heal, sends confirmation Telegram.
  //   coolbet-pause:  → placement_paused = true via the audited admin_set_control
  //                     (#139; plain-update fallback for the STOP only).
  //                     placement_paused gates the placer + the daily-summary
  //                     glyph, so the effect is immediate (no daemon round-trip
  //                     needed).
  //   coolbet-resume: → REFUSED since #139 phase A (owner decision 3): resume is
  //                     done on /admin/bots with a typed confirmation + reason.
  //
  // All three edit the original Telegram message to append a status footer
  // (same UX pattern as sigplaced/sigskip) so the operator sees confirmation
  // in the same message they tapped.
  if (
    data === "coolbet-heal:" ||
    data === "coolbet-pause:" ||
    data === "coolbet-resume:"
  ) {
    const stamp = new Date().toISOString().slice(11, 16) + " UTC";
    let footer = "";
    let toastText = "";

    if (data === "coolbet-heal:") {
      const { error: insErr } = await admin
        .from("coolbet_daemon_commands")
        .insert({
          command_type: "heal",
          requested_by: `telegram_user_${fromId}`,
        });
      if (insErr) {
        console.error("coolbet_daemon_commands insert failed", insErr);
        await answerCallbackQuery(cqId, "❌ Heal request failed", true);
        return;
      }
      footer = `\n— 🔄 Heal requested @ ${stamp} (daemon will run on next poll)`;
      toastText = "🔄 Heal requested";
    } else if (data === "coolbet-pause:") {
      const pauseErr = await pausePlacementAudited(admin, `telegram:${fromId}`, `operator via Telegram (user ${fromId})`);
      if (pauseErr) {
        console.error("placement_paused=true failed", pauseErr);
        await answerCallbackQuery(cqId, "❌ Pause failed", true);
        return;
      }
      footer = `\n— ⏸ Paused @ ${stamp}`;
      toastText = "⏸ Placement paused";
    } else {
      // coolbet-resume: REFUSED (owner decision 3, 2026-09-24) — resuming real-money placement is
      // done on /admin/bots with a typed confirmation and a reason. The button stays harmless for
      // old messages that still carry it.
      await answerCallbackQuery(cqId, `Resume is done on ${BOTS_PAGE} (typed confirm + reason). Telegram is stop-only.`, true);
      return;
    }

    // Edit the original message: append the footer so the operator sees
    // confirmation in-place. Strip the inline keyboard so the same buttons
    // can't be tapped twice (tap two pause buttons = harmless but confusing).
    const original = (message?.text as string | undefined) ?? "";
    if (chatId && messageId && BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: original + footer,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
    }

    await answerCallbackQuery(cqId, toastText);
    return;
  }

  // MANUAL-PLACE "Record at Coolbet" (place:<id>) — RETIRED 2026-09-25 (#162 W4.6). It
  // queued manual_placement_queue for a VPS drain into the engine's API placer; the drain,
  // the placer and the button that sent this callback were deleted together (the queue had
  // never held a row). A tap on an old message now gets an explicit answer instead of
  // queueing a row nothing would ever read.
  if (data.startsWith("place:")) {
    await answerCallbackQuery(cqId, "Retired — place from /admin/shadow-bots", true);
    return;
  }

  await answerCallbackQuery(cqId, "Unknown action");
}

export async function POST(req: NextRequest) {
  // Verify the request comes from Telegram via the shared secret
  if (WEBHOOK_SECRET) {
    const incoming = req.headers.get("x-telegram-bot-api-secret-token");
    if (incoming !== WEBHOOK_SECRET) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const admin = createAdmin();

  // MANUAL-PLACE: button-tap path (callback_query updates from Telegram)
  const callbackQuery = body.callback_query as Record<string, unknown> | undefined;
  if (callbackQuery) {
    await handleCallbackQuery(callbackQuery, admin);
    return new NextResponse("OK", { status: 200 });
  }

  const message = body.message as Record<string, unknown> | undefined;
  if (!message) return new NextResponse("OK", { status: 200 });

  const chatId = (message.from as Record<string, unknown>)?.id as number | undefined;
  const text = (message.text as string | undefined)?.trim() ?? "";

  if (!chatId) return new NextResponse("OK", { status: 200 });

  // COOLBET-MAC-DAEMON-COMMANDS (2026-06-12): operator commands re-wired
  // for the Mac-side placement daemon. They're operator-only (gated by
  // TELEGRAM_CHAT_ID via isOperator()). /status shows the DB state +
  // Mac daemon heartbeat freshness so the operator can tell from their
  // phone whether the local daemon is alive. /pause + /resume toggle
  // the placement_paused kill switch — daemon's place_all_bets() reads
  // it at the start of every execute=True call. /today summarises the
  // last 24h of real_bets. /help prints the command list.
  if (text.startsWith("/status") && isOperator(chatId)) {
    await handleStatusCommand(chatId, admin);
    return new NextResponse("OK", { status: 200 });
  }
  if (text.startsWith("/today") && isOperator(chatId)) {
    await handleTodayCommand(chatId, admin);
    return new NextResponse("OK", { status: 200 });
  }
  // ORDER MATTERS, and the anchors are not decorative: `/pausepicks` must be
  // tested before `/pause`, and `/pause` is anchored with (\s|$) so it cannot
  // swallow it. A bare startsWith("/pause") would route /pausepicks into the
  // real-money switch — pausing placement while the operator believed they had
  // silenced the customer feed, which is the exact class of confusion this
  // whole change exists to remove.
  if (/^\/pausepicks(\s|$)/.test(text) && isOperator(chatId)) {
    const reason = text.replace(/^\/pausepicks(\s|$)/, "").trim();
    await handlePausePicksCommand(chatId, admin, reason);
    return new NextResponse("OK", { status: 200 });
  }
  if (text === "/resumepicks" && isOperator(chatId)) {
    await handleResumePicksCommand(chatId, admin);
    return new NextResponse("OK", { status: 200 });
  }
  if (/^\/pause(\s|$)/.test(text) && isOperator(chatId)) {
    // /pause <reason — free text>
    const reason = text.replace(/^\/pause(\s|$)/, "").trim();
    await handlePauseCommand(chatId, admin, reason);
    return new NextResponse("OK", { status: 200 });
  }
  // #139 (owner decision 3): real-money START commands are refused with a pointer to the page.
  if (text === "/resume" && isOperator(chatId)) {
    await handleResumeCommand(chatId);
    return new NextResponse("OK", { status: 200 });
  }
  if (/^\/(resume|arm|unpause)(\s|$)/.test(text) && isOperator(chatId)) {
    await handleResumeCommand(chatId);
    return new NextResponse("OK", { status: 200 });
  }
  if (text === "/help" && isOperator(chatId)) {
    await handleHelpCommand(chatId);
    return new NextResponse("OK", { status: 200 });
  }

  // #055 (2026-09-24): the personal-alert connect flow below is a leftover of the paid tiers
  // (deprecated; no checkout, no "Connect Telegram" button on /profile). Anyone who reaches a
  // dead end here is pointed at where picks actually live instead of at a page that cannot
  // do what the message says. The pro/elite connect path itself is kept for existing links.
  const PICKS_POINTER =
    "Picks are published free on our public channel: https://t.me/oddsintelpicks — and at https://oddsintel.app/picks.";

  if (text.startsWith("/start")) {
    // /start <user_uuid>  — links this Telegram chat to the OddsIntel profile
    const parts = text.split(" ");
    const uuid = parts[1]?.trim();

    if (!uuid || !UUID_RE.test(uuid)) {
      await sendReply(chatId, `👋 This bot no longer sends personal alerts. ${PICKS_POINTER}`);
      return new NextResponse("OK", { status: 200 });
    }

    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, tier")
      .eq("id", uuid)
      .maybeSingle();

    if (error || !profile) {
      await sendReply(chatId, `👋 This link doesn't match an account. ${PICKS_POINTER}`);
      return new NextResponse("OK", { status: 200 });
    }

    if (!["pro", "elite"].includes(profile.tier)) {
      await sendReply(chatId, `👋 Personal alerts are no longer offered. ${PICKS_POINTER}`);
      return new NextResponse("OK", { status: 200 });
    }

    await admin
      .from("profiles")
      .update({ telegram_chat_id: chatId })
      .eq("id", uuid);

    await sendReply(chatId, "✅ Connected! You'll receive value bet alerts here as soon as new picks are found.\n\nSend /stop to unsubscribe.");
  } else if (text === "/stop") {
    // Disconnect by chat_id — no UUID needed, the chat_id IS the identity
    await admin
      .from("profiles")
      .update({ telegram_chat_id: null })
      .eq("telegram_chat_id", chatId);

    await sendReply(chatId, "👋 Disconnected. You won't receive bet alerts any more. Send /start to reconnect.");
  }

  return new NextResponse("OK", { status: 200 });
}
