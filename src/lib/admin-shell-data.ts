/**
 * What the admin shell needs on EVERY page beyond the fleet switches (#139 top bar, 2026-09-24):
 * the attention items for the bell and the bot names for the ⌘K palette.
 *
 * It is the Overview's own loader (one set of rules, so the bell and the inbox never disagree),
 * cached for 60 s across requests so navigating between admin pages does not re-run ~10 reads.
 * The cache holds only the item list + names, no per-viewer data. The Overview page itself always
 * reads fresh; the bell may lag it by up to a minute. A failure gives `attention: null`, which the
 * bell shows as "could not check" — never as "all clear".
 */
import { unstable_cache } from "next/cache";
import type { AttentionItem } from "@/lib/admin-attention";
import { loadOverview } from "@/lib/admin-overview";
import { isBotBoardDevPreview } from "@/lib/bot-board";

export interface ShellExtras {
  attention: AttentionItem[] | null;
  bots: { name: string; label: string }[];
}

async function compute(): Promise<ShellExtras> {
  const d = await loadOverview(null);
  return { attention: d.attention, bots: d.botNames };
}

const cached = unstable_cache(compute, ["admin-shell-extras-v1"], { revalidate: 60 });

export async function loadShellExtras(): Promise<ShellExtras> {
  try {
    return await (isBotBoardDevPreview() ? compute() : cached());
  } catch {
    return { attention: null, bots: [] };
  }
}
