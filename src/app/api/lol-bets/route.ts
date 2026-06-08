import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { matchId, teamName, market, odds, stake, fairOdds, thresholdOdds } = await req.json();
  if (!matchId || !teamName || !odds || !stake) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const db = serviceClient();
  const { error } = await db.from("lol_bets").insert({
    match_id: matchId,
    team_name: teamName,
    market: market ?? "match_winner",
    odds,
    stake,
    fair_odds: fairOdds ?? null,
    threshold_odds: thresholdOdds ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = serviceClient();
  const { data } = await db
    .from("lol_bets")
    .select("*, lol_upcoming_matches(league, team1, team2, kickoff_time)")
    .order("logged_at", { ascending: false })
    .limit(100);

  return NextResponse.json(data ?? []);
}
