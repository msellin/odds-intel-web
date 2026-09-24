/**
 * One line to the operator Telegram chat (TELEGRAM_CHAT_ID) after a control change applied from
 * /admin/bots (#139 phase A, spec §2.8). Owner decision 3: Telegram is notifications only.
 *
 * A courtesy, never a gate: a failed notice never undoes or blocks the change; the caller shows
 * "Applied, but the Telegram notice failed". Server-only.
 */

export type NotifyOutcome = "sent" | "failed" | "skipped";

export async function notifyOperator(text: string): Promise<NotifyOutcome> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return "skipped";
  const safe = text.length > 4000 ? `${text.slice(0, 3970)}\n…(truncated)` : text;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: safe, disable_web_page_preview: true }),
    });
    if (!r.ok) {
      console.error("notifyOperator: Telegram answered", r.status);
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error("notifyOperator failed", e);
    return "failed";
  }
}
