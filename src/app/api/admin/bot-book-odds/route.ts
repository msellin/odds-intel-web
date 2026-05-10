import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase-server";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!
  );
}

/** Map a paper-bet (market, selection) to the odds_snapshots key. Mirror
 *  of the same helper in engine-data.ts. */
function mapKey(market: string, selection: string): { market: string; selection: string } | null {
  const m = (market || "").toLowerCase();
  const s = (selection || "").toLowerCase().trim();
  if (m === "1x2" && ["home", "draw", "away"].includes(s)) return { market: "1x2", selection: s };
  if (m === "btts" && (s === "yes" || s === "no")) return { market: "btts", selection: s };
  if (m === "o/u") {
    for (const line of ["0.5", "1.5", "2.5", "3.5", "4.5"]) {
      if (s.startsWith(`over ${line}`)) return { market: `over_under_${line.replace(".", "")}`, selection: "over" };
      if (s.startsWith(`under ${line}`)) return { market: `over_under_${line.replace(".", "")}`, selection: "under" };
    }
  }
  return null;
}

/** POST { betIds: string[] }
 *  -> { [betId]: { unibet: number | null, bet365: number | null } }
 *
 *  Looks up the most-recent Unibet (Coolbet proxy) + Bet365 row per
 *  (match, market, selection) for each requested bet. Used by the bot
 *  dashboard expansion table to show real-bookmaker prices alongside the
 *  bot's recorded odds. Superadmin only.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { betIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const ids = Array.isArray(body.betIds) ? body.betIds.slice(0, 500) : [];
  if (ids.length === 0) return NextResponse.json({});

  const sa = admin();

  // 1. Fetch the bets — only the keys we need
  const { data: bets } = await sa
    .from("simulated_bets")
    .select("id, match_id, market, selection")
    .in("id", ids);
  if (!bets || bets.length === 0) return NextResponse.json({});

  // 2. Build the unique (match_id, market, selection) set we need to look up
  type Bet = { id: string; match_id: string; market: string; selection: string };
  const betRows = bets as Bet[];
  const matchIds = Array.from(new Set(betRows.map((b) => b.match_id)));

  // 3. One query for all needed odds_snapshots, filtered by bookmaker
  const { data: snaps } = await sa
    .from("odds_snapshots")
    .select("match_id, market, selection, bookmaker, odds, timestamp")
    .in("match_id", matchIds)
    .in("bookmaker", ["Unibet", "Bet365"])
    .order("timestamp", { ascending: false })
    .range(0, 19999);

  // 4. Index — most recent per (match, market, selection, bookmaker)
  const snapKey = (m: string, mk: string, sel: string, bm: string) => `${m}|${mk}|${sel}|${bm}`;
  const snapMap = new Map<string, number>();
  for (const s of (snaps ?? []) as Array<{ match_id: string; market: string; selection: string; bookmaker: string; odds: number }>) {
    const k = snapKey(s.match_id, s.market, s.selection, s.bookmaker);
    if (!snapMap.has(k)) snapMap.set(k, Number(s.odds));
  }

  // 5. Build the response
  const out: Record<string, { unibet: number | null; bet365: number | null }> = {};
  for (const b of betRows) {
    const k = mapKey(b.market, b.selection);
    if (!k) {
      out[b.id] = { unibet: null, bet365: null };
      continue;
    }
    out[b.id] = {
      unibet: snapMap.get(snapKey(b.match_id, k.market, k.selection, "Unibet")) ?? null,
      bet365: snapMap.get(snapKey(b.match_id, k.market, k.selection, "Bet365")) ?? null,
    };
  }
  return NextResponse.json(out);
}
