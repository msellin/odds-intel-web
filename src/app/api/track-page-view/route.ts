import { NextResponse } from "next/server";
import { createSupabasePublic } from "@/lib/supabase-public";

/**
 * POST /api/track-page-view
 * Body: { matchId: string, sessionId: string }
 *
 * Upserts a page view row (refreshing viewed_at on revisit) and returns
 * the count of distinct sessions in the last 30 minutes. No auth required.
 */
export async function POST(req: Request) {
  let matchId: string, sessionId: string;
  try {
    ({ matchId, sessionId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!matchId || !sessionId) {
    return NextResponse.json({ error: "matchId and sessionId required" }, { status: 400 });
  }

  const supabase = createSupabasePublic();

  // Upsert view — refreshes viewed_at so the 30-min window resets on each page visit
  await supabase.from("match_page_views").upsert(
    { session_id: sessionId, match_id: matchId, viewed_at: new Date().toISOString() },
    { onConflict: "session_id,match_id" }
  );

  // Count distinct sessions in the last 30 minutes
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("match_page_views")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId)
    .gte("viewed_at", thirtyMinAgo);

  return NextResponse.json({ count: count ?? 1 });
}
