import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase-server";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!
  );
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: {
    simulatedBetId: string;
    botId: string;
    firstLegMatchId: string;
    systemType: string | null;
    comboLegs: Array<{
      match_id: string;
      market: string;
      selection: string;
      odds: number;
      prob: number;
      bot_source: string;
    }>;
    bookmaker: string;
    actualOdds: number;
    stake: number;
    notes?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { simulatedBetId, botId, firstLegMatchId, systemType, comboLegs,
          bookmaker, actualOdds, stake, notes } = body;

  if (!firstLegMatchId || !comboLegs?.length || !bookmaker) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }
  if (!actualOdds || actualOdds <= 1.0) {
    return NextResponse.json({ error: "actualOdds must be > 1.0" }, { status: 400 });
  }
  if (!stake || stake <= 0) {
    return NextResponse.json({ error: "stake must be > 0" }, { status: 400 });
  }

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
    return NextResponse.json({ error: `bookmaker '${bookmaker}' is ${book.status}` }, { status: 400 });
  }

  const { data, error } = await sa
    .from("real_bets")
    .insert({
      simulated_bet_id: simulatedBetId ?? null,
      bot_id: botId ?? null,
      match_id: firstLegMatchId,
      market: "combo",
      selection: systemType ?? "straight",
      bookmaker,
      captured_odds: null,
      actual_odds: actualOdds,
      stake,
      notes: notes ?? null,
      combo_legs: comboLegs,
      system_type: systemType ?? "straight",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
