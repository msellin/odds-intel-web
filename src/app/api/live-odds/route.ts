import { NextResponse } from "next/server";
import { getLiveMatchOdds } from "@/lib/engine-data";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * GET /api/live-odds?matchId=<uuid>
 * Returns live in-play odds snapshots for a match.
 * Requires Pro or Elite tier.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");

  if (!matchId) {
    return NextResponse.json({ error: "matchId required" }, { status: 400 });
  }

  // Auth + tier check — Pro required
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("tier, is_superadmin")
      .eq("id", user.id)
      .single();
    const isPro =
      profile?.is_superadmin === true ||
      profile?.tier === "pro" ||
      profile?.tier === "elite";
    if (!isPro) {
      return NextResponse.json({ error: "Pro required" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Auth error" }, { status: 500 });
  }

  const snapshots = await getLiveMatchOdds(matchId);
  return NextResponse.json(snapshots);
}
