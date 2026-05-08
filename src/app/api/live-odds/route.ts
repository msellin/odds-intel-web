import { NextResponse } from "next/server";
import { getLiveMatchOdds } from "@/lib/engine-data";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import { checkRateLimit } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/live-odds?matchId=<uuid>
 * Returns live in-play odds snapshots for a match.
 * Requires Pro or Elite tier.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");

  if (!matchId || !UUID_RE.test(matchId)) {
    return NextResponse.json({ error: "matchId required" }, { status: 400 });
  }

  // Auth + tier check — Pro required
  let userId: string;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { isPro } = await getUserTier(user.id, supabase);
    if (!isPro) {
      return NextResponse.json({ error: "Pro required" }, { status: 403 });
    }
    userId = user.id;
  } catch {
    return NextResponse.json({ error: "Auth error" }, { status: 500 });
  }

  // Rate limit: 120 requests/hour per user (~1 per 30s, matches chart refresh rate)
  const rl = checkRateLimit(`live-odds:${userId}`, 120, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const snapshots = await getLiveMatchOdds(matchId);
  return NextResponse.json(snapshots);
}
