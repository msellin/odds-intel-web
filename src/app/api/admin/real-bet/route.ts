import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";

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

  const { matchId, market, selection, bookmaker, capturedOdds, actualOdds, stake, notes, botId, simulatedBetId } = body;

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

  // DUPE-FIX-1: dedup guard. The /admin/place UI filters out already-placed
  // bets via getPlaceableBets, but stale UI state + the auto coolbet_placer
  // can race and double-record the same selection. Belt-and-braces server-side
  // check against today's real_bets — if one exists for the same
  // (match, market, selection), return 409 so the UI can surface it instead
  // of silently inserting a duplicate.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data: existing } = await sa
    .from("real_bets")
    .select("id")
    .eq("match_id", matchId)
    .eq("market", market)
    .eq("selection", selection.toLowerCase())
    .gte("placed_at", todayStart.toISOString())
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    return NextResponse.json(
      { error: "already_placed", existingId: existing.id },
      { status: 409 },
    );
  }

  const { data, error } = await sa
    .from("real_bets")
    .insert({
      simulated_bet_id: simulatedBetId ?? null,
      bot_id: botId || null,
      match_id: matchId,
      market,
      selection: selection.toLowerCase(),
      bookmaker,
      captured_odds: capturedOdds ?? null,
      actual_odds: actualOdds,
      stake,
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
