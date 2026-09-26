/**
 * [[#157]] PERFORMANCE-RETIRED-BOTS-AND-TOTALS (2026-09-25, owner-approved) — "the work done" on
 * /performance, kept SEPARATE from the active ROI.
 *
 * Three labelled things, never mixed:
 *   1. WORK DONE — every strategy ever scored, retired included (engine view bot_public_work_done).
 *   2. ACTIVE ROI — the hero headline, unchanged: ACTIVE bots (was BETA + CALIBRATED until #175), retired_at IS NULL
 *      (engine-data getPublicCohortBotNames). Nothing here feeds it.
 *   3. RETIRED — a collapsed section: one row per FAMILY aggregating EVERY retired bot in it
 *      (losers included) + up to 2 representative bots per family chosen by a rule that never
 *      looks at ROI (bot_public_record.is_representative, migration 446).
 *
 * ONE COMPUTATION: every ROI / CLV here is bot_performance's (#159) — a family's ROI is
 * Σ pnl_units_public / Σ settled of its bots' rows. Smoke PERFORMANCE-RETIRED-PARITY pins it.
 * Server-only (service client): the views are PRIVATE (#072).
 *
 * Units: ROI / CLV are FRACTIONS (0.081 = +8.1%).
 */
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { publicPostgrestUrl, serverPostgrestOptions } from "@/lib/postgrest-server-url";

// POSTGREST_INTERNAL_URL (server-only, optional) is honoured the same way (#162 W7.4).
function createServerServiceClient() {
  const url = publicPostgrestUrl();
  const key =
    process.env.POSTGREST_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, serverPostgrestOptions(url));
}

export interface RetiredRecord {
  key: string;
  title: string;
  bots: number;
  picks: number;
  settled: number;
  won: number;
  lost: number;
  roi: number | null;
  clv: number | null;
  clvN: number;
  nSwapWindow: number;
  nOuCalBug: number;
  nPreMidJuly: number;
  lastRetiredAt: string | null;
}

export interface RetiredBot extends Omit<RetiredRecord, "bots" | "title" | "lastRetiredAt"> {
  group: string;
  displayName: string | null;
  retiredAt: string | null;
  firstPickAt: string | null;
}

export interface WorkDone {
  strategies: number;
  retired: number;
  publicActive: number;
  notPublicActive: number;
  picks: number;
  settled: number;
  retiredPicks: number;
  distinctSelections: number;
  since: string | null;
  lesson: { modelClv: number | null; modelN: number; sharpClv: number | null; sharpN: number };
  families: RetiredRecord[];
  representatives: RetiredBot[];
  /** [[#157]] owner answer 1: listed (non-retired) bots with picks priced 2026-05-10..09-14 while
   *  the served 1X2 model was partly home/away-swapped (#065) — the detail view prints the count. */
  swapWindowByBot: Record<string, { n: number; picks: number }>;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

async function _getWorkDone(): Promise<WorkDone | null> {
  const db = createServerServiceClient();
  const [w, g, r, s] = await Promise.all([
    db.from("bot_public_work_done").select("*").limit(1),
    db.from("bot_public_record_group").select("*").eq("is_retired", true).limit(100),
    db
      .from("bot_public_record")
      .select(
        "bot_name, display_name, public_group, retired_at, first_pick_at, picks_total, settled, won, lost, roi_public, clv_public, clv_n, n_swap_window, n_ou_calbug, n_pre_mid_july",
      )
      .eq("is_retired", true)
      .eq("is_representative", true)
      .limit(100),
    db
      .from("bot_public_record")
      .select("bot_name, n_swap_window, picks_total")
      .eq("is_retired", false)
      .gt("n_swap_window", 0)
      .limit(200),
  ]);
  if (w.error || !w.data?.length) {
    console.error("[getWorkDone] bot_public_work_done read failed:", w.error?.message ?? "no data");
    return null;
  }
  const t = w.data[0] as Record<string, unknown>;
  const families: RetiredRecord[] = ((g.data ?? []) as Record<string, unknown>[])
    .map((x) => ({
      key: String(x.public_group),
      title: String(x.public_group_title ?? x.public_group),
      bots: num(x.bots),
      picks: num(x.picks_total),
      settled: num(x.settled),
      won: num(x.won),
      lost: num(x.lost),
      roi: numOrNull(x.roi_public),
      clv: numOrNull(x.clv_public),
      clvN: num(x.clv_n),
      nSwapWindow: num(x.n_swap_window),
      nOuCalBug: num(x.n_ou_calbug),
      nPreMidJuly: num(x.n_pre_mid_july),
      lastRetiredAt: (x.last_retired_at as string | null) ?? null,
    }))
    // largest body of work first — never ordered by result
    .sort((a, b) => b.picks - a.picks);
  const representatives: RetiredBot[] = ((r.data ?? []) as Record<string, unknown>[])
    .map((x) => ({
      key: String(x.bot_name),
      group: String(x.public_group),
      displayName: (x.display_name as string | null) ?? null,
      retiredAt: (x.retired_at as string | null) ?? null,
      firstPickAt: (x.first_pick_at as string | null) ?? null,
      picks: num(x.picks_total),
      settled: num(x.settled),
      won: num(x.won),
      lost: num(x.lost),
      roi: numOrNull(x.roi_public),
      clv: numOrNull(x.clv_public),
      clvN: num(x.clv_n),
      nSwapWindow: num(x.n_swap_window),
      nOuCalBug: num(x.n_ou_calbug),
      nPreMidJuly: num(x.n_pre_mid_july),
    }))
    .sort((a, b) => b.settled - a.settled);
  return {
    strategies: num(t.strategies),
    retired: num(t.retired),
    publicActive: num(t.public_active),
    notPublicActive: num(t.not_public_active),
    picks: num(t.picks_total),
    settled: num(t.settled),
    retiredPicks: num(t.retired_picks),
    distinctSelections: num(t.distinct_selections),
    since: (t.since as string | null) ?? null,
    lesson: {
      modelClv: numOrNull(t.lesson_model_clv),
      modelN: num(t.lesson_model_n),
      sharpClv: numOrNull(t.lesson_sharp_clv),
      sharpN: num(t.lesson_sharp_n),
    },
    families,
    representatives,
    swapWindowByBot: Object.fromEntries(
      ((s.data ?? []) as Record<string, unknown>[]).map((x) => [
        String(x.bot_name),
        { n: num(x.n_swap_window), picks: num(x.picks_total) },
      ]),
    ),
  };
}

/** 30-min cache, like the page's other slow reads. Bump the key when the shape changes. */
export const getWorkDone = unstable_cache(_getWorkDone, ["getWorkDone_v1_157"], { revalidate: 1800 });
