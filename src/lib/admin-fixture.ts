/**
 * Per-page JSON snapshots for the LOCAL admin design preview (#139, 2026-09-24).
 *
 * A laptop has no service-role key, so admin pages cannot read the DB locally. The /admin/bots
 * preview solved this with one fixture (BOT_BOARD_FIXTURE, written by the engine's
 * scripts/dump_bot_board_fixture.py). Other admin pages keep their snapshot in a SIBLING file,
 * `admin-<name>.json` next to it, written by the engine's scripts/dump_admin_fixture.py --page <name>,
 * so pages can be worked on independently.
 *
 * Development builds only: returns null unless isBotBoardDevPreview() (NODE_ENV=development AND
 * BOT_BOARD_FIXTURE set — `next build` is always production, so never in the deployed app).
 */
import { isBotBoardDevPreview } from "@/lib/bot-board";

export async function readAdminFixture<T>(name: string): Promise<T | null> {
  if (!isBotBoardDevPreview()) return null;
  const { readFile } = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");
  const file = join(dirname(process.env.BOT_BOARD_FIXTURE as string), `admin-${name}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}
