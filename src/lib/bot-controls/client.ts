/**
 * Browser-side calls for the /admin/bots controls (#139 phase A). The routes re-check superadmin
 * (arming: owner) server-side and write only through the audited DB functions.
 */
import type { ArmRequest, ControlChange, ControlRequest, ControlResult } from "./types";

async function post(url: string, body: unknown): Promise<ControlResult> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await r.json().catch(() => ({}))) as Partial<ControlResult> & { error?: string };
    if (!r.ok) {
      const msg =
        r.status === 401 ? "Signed out — sign in again. Nothing was changed." : j.error ?? `HTTP ${r.status}`;
      return { outcome: "refused", refusal: msg, current: null, at: null, error: msg };
    }
    return {
      outcome: j.outcome ?? "refused",
      refusal: j.refusal ?? null,
      current: typeof j.current === "boolean" ? j.current : null,
      at: j.at ?? null,
      changed_by: j.changed_by ?? null,
      changed_at: j.changed_at ?? null,
      notify: j.notify,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { outcome: "refused", refusal: msg, current: null, at: null, error: msg };
  }
}

export function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const postControl = (req: ControlRequest) => post("/api/admin/bots/controls", req);
export const postArm = (req: ArmRequest) => post("/api/admin/bots/controls/arm", req);

export async function fetchAudit(botName?: string, limit = 50): Promise<{ rows: ControlChange[]; error: string | null }> {
  try {
    const q = new URLSearchParams({ limit: String(limit) });
    if (botName) q.set("bot_name", botName);
    const r = await fetch(`/api/admin/bots/controls/audit?${q}`);
    const j = (await r.json()) as { rows?: ControlChange[]; error?: string | null };
    return { rows: j.rows ?? [], error: r.ok ? j.error ?? null : j.error ?? `HTTP ${r.status}` };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}
