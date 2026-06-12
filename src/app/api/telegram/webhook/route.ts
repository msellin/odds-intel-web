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
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
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
    ? `\n🛑 PAUSED — reason: ${state.placement_paused_reason || "(none)"}\n   paused at: ${fmtTimeAgo(state.placement_paused_at)}`
    : "";

  const lines = [
    `${healthGlyph} Coolbet session — ${state.session_healthy ? "healthy" : "UNHEALTHY"}`,
    pausedLine,
    ``,
    `🔐 last login:  ${fmtTimeAgo(state.last_login_at)} (${state.last_login_method || "?"})`,
    `🔑 JWT user:   ${state.jwt_user_id || "(none)"}`,
    `⏱  JWT TTL:    ${fmtJwtTtl(state.jwt_exp_at)}`,
    `💓 heartbeat:  ${state.last_heartbeat_ok ? "OK" : "FAIL"} ${fmtTimeAgo(state.last_heartbeat_at)}`,
    `🍪 cookies:    ${state.cookies_count_last ?? 0} refreshed ${fmtTimeAgo(state.cookies_last_refresh_at)}`,
    `🖥  FS session: ${state.fs_session_name || "?"}`,
    `📱 device ID:  ${state.device_id ? state.device_id.slice(0, 8) + "…" : "(none — will auto-gen)"}`,
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

async function handlePauseCommand(
  chatId: number,
  admin: ReturnType<typeof createAdmin>,
  reason: string,
): Promise<void> {
  const { error } = await admin
    .from("coolbet_session_state")
    .update({
      placement_paused: true,
      placement_paused_at: new Date().toISOString(),
      placement_paused_reason: reason || "operator /pause",
    })
    .eq("id", 1);
  if (error) {
    await sendReply(chatId, `❌ Could not set placement_paused: ${error.message}`);
    return;
  }
  await sendReply(
    chatId,
    `🛑 Auto-placer PAUSED. Next pipeline tick will skip placements until /resume.\n` +
    `Reason logged: ${reason || "(none)"}`,
  );
}

async function handleResumeCommand(
  chatId: number,
  admin: ReturnType<typeof createAdmin>,
): Promise<void> {
  const { error } = await admin
    .from("coolbet_session_state")
    .update({
      placement_paused: false,
      placement_paused_at: null,
      placement_paused_reason: null,
    })
    .eq("id", 1);
  if (error) {
    await sendReply(chatId, `❌ Could not clear placement_paused: ${error.message}`);
    return;
  }
  await sendReply(chatId, "▶️  Auto-placer RESUMED. Next pipeline tick will place qualifying bets again.");
}

async function handleHelpCommand(chatId: number): Promise<void> {
  await sendReply(
    chatId,
    [
      "🤖 OddsIntel Coolbet bot — operator commands:",
      "",
      "/status        — session health, JWT TTL, last heartbeat, errors",
      "/today         — real_bets placed in last 24h + stake + PnL",
      "/pause <reason>— halt auto-placement until /resume (instant; no restart)",
      "/resume        — re-enable auto-placement",
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

  if (!data.startsWith("place:")) {
    await answerCallbackQuery(cqId, "Unknown action");
    return;
  }

  const simulatedBetId = data.slice("place:".length).trim();
  if (!UUID_RE.test(simulatedBetId)) {
    await answerCallbackQuery(cqId, "❌ Invalid bet id", true);
    return;
  }

  // Short-circuit: already in real_bets → ack without queueing
  const { data: existing } = await admin
    .from("real_bets")
    .select("id")
    .eq("simulated_bet_id", simulatedBetId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await answerCallbackQuery(cqId, "✓ Already recorded", false);
    return;
  }

  // Dedup: don't queue twice if a previous tap is still pending/processing
  const { data: inflight } = await admin
    .from("manual_placement_queue")
    .select("id, status")
    .eq("simulated_bet_id", simulatedBetId)
    .in("status", ["pending", "processing"])
    .limit(1)
    .maybeSingle();

  if (inflight) {
    await answerCallbackQuery(cqId, "⏳ Already queued, working on it…");
    return;
  }

  const { error: insertErr } = await admin
    .from("manual_placement_queue")
    .insert({
      simulated_bet_id: simulatedBetId,
      requested_by_chat_id: fromId,
      telegram_chat_id: chatId ?? null,
      telegram_message_id: messageId ?? null,
    });

  if (insertErr) {
    console.error("manual_placement_queue insert failed", insertErr);
    await answerCallbackQuery(cqId, "❌ Queue insert failed — check logs", true);
    return;
  }

  await answerCallbackQuery(cqId, "📝 Queued — recording at Coolbet…");
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

  // COOLBET-SIGNALER-A (2026-06-12): operator commands /status, /pause,
  // /resume, /today, /help were tied to the now-defunct Railway-side
  // auto-placer (which spammed SMS overnight when its JWT chain broke).
  // The new signal-only flow has nothing to "pause" — bets either signal
  // to your Telegram or they don't; there's no Railway session to
  // monitor. Commands removed in this commit. If we add a Mac-side
  // daemon (option B), it'll get its own minimal command surface.

  if (text.startsWith("/start")) {
    // /start <user_uuid>  — links this Telegram chat to the OddsIntel profile
    const parts = text.split(" ");
    const uuid = parts[1]?.trim();

    if (!uuid || !UUID_RE.test(uuid)) {
      await sendReply(chatId, "❌ Invalid link. Go to your OddsIntel profile page and click 'Connect Telegram' to get a fresh link.");
      return new NextResponse("OK", { status: 200 });
    }

    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, tier")
      .eq("id", uuid)
      .maybeSingle();

    if (error || !profile) {
      await sendReply(chatId, "❌ Account not found. Make sure you're using the link from your own OddsIntel profile page.");
      return new NextResponse("OK", { status: 200 });
    }

    if (!["pro", "elite"].includes(profile.tier)) {
      await sendReply(chatId, "ℹ️ Telegram alerts are available on Pro and Elite plans. Upgrade at oddsintel.app/profile.");
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
