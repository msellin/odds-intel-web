/**
 * /admin/activity loader (#139 IA gap G4, 2026-09-24): ONE timeline of who changed what.
 *
 * Two append-only audit tables, read with the service role (server only):
 *   - control_changes (engine migration 413) — every fleet / per-bot switch, written by the one
 *     audited function admin_set_control whoever calls it (web, Telegram, engine setters, migrations);
 *   - feed_actions (engine migration 389) — every per-feed pause / resume / run-now from /admin/feeds,
 *     plus the engine's own auto-pause / auto-resume, with what the engine did with it.
 * Also feed labels (feed_status) and bot display names (bots) so the page can speak in words.
 * Each read keeps its error: a log that could not be read says so, it never reads as "no activity".
 */
import { createServerServiceClient } from "@/lib/supabase-server";
import { readAdminFixture } from "@/lib/admin-fixture";
import type { ControlChange } from "@/lib/bot-controls/types";
import type { R } from "@/lib/admin-feeds";

export interface FeedAction {
  id: number;
  feed_id: string;
  action: string;
  reason: string | null;
  actor: string | null;
  created_at: string;
  handled_at: string | null;
  result: string | null;
}

export interface ActivityData {
  now: number;
  changes: R<ControlChange[]>;
  feedActions: R<FeedAction[]>;
  feedLabels: Record<string, string>;
  botNames: Record<string, string>;
}

/** Newest N of each log. Both tables are small (tens of rows a week); raise if the page ever fills. */
export const ACTIVITY_LIMIT = 500;

interface ActivityFixture {
  changes?: ControlChange[];
  feed_actions?: FeedAction[];
  feeds?: { feed_id: string; label: string }[];
  bots?: { name: string; display_name: string | null }[];
}

async function read<T>(label: string, q: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, fallback: T): Promise<R<T>> {
  try {
    const { data, error } = await q();
    if (error) return { v: fallback, error: `${label}: ${error.message}` };
    return { v: (data ?? fallback) as T, error: null };
  } catch (e) {
    return { v: fallback, error: `${label}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function maps(feeds: { feed_id: string; label: string }[], bots: { name: string; display_name: string | null }[]) {
  return {
    feedLabels: Object.fromEntries(feeds.map((f) => [f.feed_id, f.label])),
    botNames: Object.fromEntries(bots.filter((b) => b.display_name).map((b) => [b.name, b.display_name as string])),
  };
}

export async function loadActivity(): Promise<ActivityData> {
  const now = Date.now();
  const fx = await readAdminFixture<ActivityFixture>("activity");
  if (fx) {
    return {
      now,
      changes: fx.changes ? { v: fx.changes, error: null } : { v: [], error: "control_changes: not in fixture" },
      feedActions: fx.feed_actions ? { v: fx.feed_actions, error: null } : { v: [], error: "feed_actions: not in fixture" },
      ...maps(fx.feeds ?? [], fx.bots ?? []),
    };
  }
  const db = createServerServiceClient();
  const [changes, feedActions, feeds, bots] = await Promise.all([
    read<ControlChange[]>(
      "control_changes",
      () =>
        db
          .from("control_changes")
          .select("id, created_at, actor, source, control, bot_name, old_value, new_value, reason, outcome, refusal")
          .order("id", { ascending: false })
          .limit(ACTIVITY_LIMIT),
      [],
    ),
    read<FeedAction[]>(
      "feed_actions",
      () => db.from("feed_actions").select("id, feed_id, action, reason, actor, created_at, handled_at, result").order("id", { ascending: false }).limit(ACTIVITY_LIMIT),
      [],
    ),
    read<{ feed_id: string; label: string }[]>("feed_status", () => db.from("feed_status").select("feed_id, label"), []),
    read<{ name: string; display_name: string | null }[]>("bots", () => db.from("bots").select("name, display_name"), []),
  ]);
  return { now, changes, feedActions, ...maps(feeds.v, bots.v) };
}
