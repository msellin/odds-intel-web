/**
 * The books whose CURRENT price the /admin/bots sheet shows next to a pending pick (IA move P7,
 * 2026-09-24). Its own tiny module so the client table (picks-table.tsx) and the server loader
 * (bot-board.ts loadBotPicks) share ONE list without the client importing server code.
 *
 * Unibet is 'Unibet-Site' — the PLACEABLE unibet.ee site feed — never 'Unibet-Kambi' / AF
 * 'Unibet' (UB-COLUMN-NOT-PLACEABLE-2026-09-11: unibet.ee left the Kambi API on 2026-09-06 and it
 * disagrees with the site on 91% of quotes; a phantom price costs a placed bet).
 */
export const SNAPSHOT_BOOKS = ["Coolbet", "Unibet-Site", "Epicbet"] as const;
export type SnapshotBook = (typeof SNAPSHOT_BOOKS)[number];
