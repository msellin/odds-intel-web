import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { normalizeMarket } from "@/lib/market-vocab";

function admin() {
  const url =
    process.env.NEXT_PUBLIC_POSTGREST_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.POSTGREST_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export async function POST(req: Request) {
  // Auth: must be a logged-in superadmin.
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const db = createServerServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: {
    simulatedBetId?: string;
    /** OWN Phase 6: the shadow_bets row this hand-placed bet came from (mig 354). */
    shadowBetId?: string;
    /** #162 W4.5: the /picks forward-test pick this bet backed (engine migration 448). */
    forwardTestPickId?: string;
    botId?: string;
    matchId?: string;
    market?: string;
    selection?: string;
    bookmaker?: string;
    capturedOdds?: number | null;
    actualOdds?: number;
    stake?: number;
    notes?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { matchId, bookmaker, capturedOdds, actualOdds, stake, notes, botId, simulatedBetId, shadowBetId, forwardTestPickId } = body;
  // #162 W4.5: store the ONE canonical spelling, as the engine's store_real_bet does
  // (canonicalize_for_storage) — 'o/u' + 'over 2.5' becomes 'over_under_25' + 'over', so the
  // placers' exposure and the same-day dedupe see this bet. Asian handicap / combo keep their
  // selection (the line lives there); unrecognised vocabulary passes through unchanged.
  const canon = normalizeMarket(body.market, body.selection);
  const keepSel = canon && (canon.family === "asian_handicap" || canon.family === "combo");
  const market = canon?.market ? canon.market : body.market;
  const selection = canon?.market && !keepSel ? canon.selection : body.selection;

  if (!matchId || !market || !selection || !bookmaker) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }
  if (!actualOdds || actualOdds <= 1.0) {
    return NextResponse.json({ error: "actualOdds must be > 1.0" }, { status: 400 });
  }
  if (!stake || stake <= 0) {
    return NextResponse.json({ error: "stake must be > 0" }, { status: 400 });
  }

  // Validate bookmaker is in accessible_bookmakers
  const sa = admin();
  const { data: book } = await sa
    .from("accessible_bookmakers")
    .select("bookmaker, status")
    .eq("bookmaker", bookmaker)
    .single();
  if (!book) {
    return NextResponse.json({ error: `unknown bookmaker '${bookmaker}'` }, { status: 400 });
  }
  if (book.status === "banned" || book.status === "inactive") {
    return NextResponse.json({ error: `bookmaker '${bookmaker}' status is ${book.status}` }, { status: 400 });
  }

  // DUPE-FIX-1 → #022 (a), 2026-09-24: dedup AND insert in ONE transaction. The old
  // SELECT-then-INSERT here ran as two PostgREST calls, so a double-click or a race with
  // the placer could insert the same (match, market, selection) twice on a day (5
  // historical duplicate groups). `record_manual_real_bet` (migration 407) takes a
  // per-selection advisory lock, checks today's real_bets and inserts atomically.
  // Still returns 409 so the UI can surface it instead of silently inserting a duplicate.
  const { data: rpc, error } = await sa.rpc("record_manual_real_bet", {
    p_match_id: matchId,
    p_market: market,
    p_selection: selection,
    p_bookmaker: bookmaker,
    p_actual_odds: actualOdds,
    p_stake: stake,
    p_captured_odds: capturedOdds ?? null,
    p_notes: notes ?? null,
    p_bot_id: botId || null,
    p_simulated_bet_id: simulatedBetId ?? null,
    p_shadow_bet_id: shadowBetId ?? null,
    // Only sent when set, so this route keeps working against the pre-448 function signature.
    ...(forwardTestPickId ? { p_forward_test_pick_id: forwardTestPickId } : {}),
  });
  const res = (rpc ?? {}) as { id?: string; error?: string; existing_id?: string };
  if (res.error === "already_placed") {
    return NextResponse.json({ error: "already_placed", existingId: res.existing_id }, { status: 409 });
  }
  if (error || !res.id) {
    return NextResponse.json({ error: error?.message ?? res.error ?? "insert failed" }, { status: 500 });
  }
  const data = { id: res.id };
  // LOGGED-PICKS-INVISIBLE (2026-09-15): the shadow-bots page caches its reads
  // for 60 s, so a refresh straight after logging showed the pick untouched and
  // the day's manual count still at zero — the operator reasonably concluded
  // nothing had saved. Drop that cache on write; a bet the operator just
  // recorded must be visible on the next paint, not up to a minute later.
  revalidatePath("/admin/shadow-bots");
  return NextResponse.json({ id: data.id });
}
