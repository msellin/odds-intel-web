import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * GET /api/bet-explain?betId=<uuid>
 * Returns a natural language explanation of why the engine placed a bet.
 * Elite tier only.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const betId = searchParams.get("betId");

  if (!betId) {
    return NextResponse.json({ error: "betId required" }, { status: 400 });
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "LLM not configured" }, { status: 503 });
  }

  // Auth + Elite tier check
  let userId: string;
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("tier, is_superadmin")
      .eq("id", user.id)
      .single();
    const isElite =
      profile?.is_superadmin === true || profile?.tier === "elite";
    if (!isElite)
      return NextResponse.json({ error: "Elite required" }, { status: 403 });

    userId = user.id;
  } catch {
    return NextResponse.json({ error: "Auth error" }, { status: 500 });
  }

  // Fetch bet details using service role (simulated_bets may have RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: bet } = await supabaseAdmin
    .from("simulated_bets")
    .select(
      `id, market, selection, odds, model_probability, edge_percent,
       stake, result, pnl,
       match:match_id(
         id, date,
         home_team:home_team_id(name, country),
         away_team:away_team_id(name, country),
         league:league_id(name, country)
       ),
       bot:bot_id(name)`
    )
    .eq("id", betId)
    .single();

  if (!bet) {
    return NextResponse.json({ error: "Bet not found" }, { status: 404 });
  }

  // Fetch signals for this match
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const betAny = bet as any;
  const matchRow = Array.isArray(betAny.match) ? betAny.match[0] : betAny.match;
  const matchId = matchRow?.id;

  let signals: Record<string, number> = {};
  if (matchId) {
    const { data: sigRows } = await supabaseAdmin
      .from("match_signals")
      .select("signal_name, signal_value, captured_at")
      .eq("match_id", matchId)
      .order("captured_at", { ascending: false })
      .limit(200);

    if (sigRows) {
      const seen = new Set<string>();
      for (const s of sigRows as { signal_name: string; signal_value: number }[]) {
        if (!seen.has(s.signal_name)) {
          signals[s.signal_name] = Number(s.signal_value);
          seen.add(s.signal_name);
        }
      }
    }
  }

  // Build context for LLM
  const homeTeam = Array.isArray(matchRow?.home_team)
    ? matchRow.home_team[0]?.name
    : matchRow?.home_team?.name ?? "Home";
  const awayTeam = Array.isArray(matchRow?.away_team)
    ? matchRow.away_team[0]?.name
    : matchRow?.away_team?.name ?? "Away";
  const league = Array.isArray(matchRow?.league)
    ? matchRow.league[0]?.name
    : matchRow?.league?.name ?? "Unknown";
  const bot = Array.isArray(betAny.bot) ? betAny.bot[0]?.name : betAny.bot?.name ?? "model";

  const selectionLabel =
    bet.selection === "home"
      ? homeTeam
      : bet.selection === "away"
        ? awayTeam
        : "Draw";

  const modelProb = Number(bet.model_probability);
  const impliedProb = 1 / Number(bet.odds);
  const edgePct = (modelProb - impliedProb) * 100;

  const signalContext = Object.entries(signals)
    .filter(([, v]) => v !== 0)
    .slice(0, 12)
    .map(([k, v]) => `${k}: ${Number(v).toFixed(3)}`)
    .join(", ");

  const prompt = `You are an expert sports betting analyst. Explain in 2-3 clear, concise sentences why the model placed this specific bet. Focus on what the data shows — be specific and direct. Do not mention the model name. Do not say "the model" — say "our analysis" or "the signals".

Match: ${homeTeam} vs ${awayTeam} (${league})
Bet: ${selectionLabel} to win at odds ${Number(bet.odds).toFixed(2)}
Market: ${bet.market}
Model probability: ${(modelProb * 100).toFixed(1)}% (market implied: ${(impliedProb * 100).toFixed(1)}%)
Edge: +${edgePct.toFixed(1)}%
Strategy: ${bot}
${signalContext ? `Key signals: ${signalContext}` : ""}
${bet.result && bet.result !== "pending" ? `Outcome: ${bet.result} (P&L: ${Number(bet.pnl).toFixed(2)})` : ""}

Write a 2-3 sentence explanation of why this pick was placed. Translate any technical signals into plain English.`;

  try {
    const resp = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 200,
        },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json(
        { error: `LLM error: ${err.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const json = await resp.json();
    const explanation =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Unable to generate explanation.";

    return NextResponse.json({ explanation: explanation.trim() });
  } catch (err) {
    return NextResponse.json(
      { error: `LLM request failed: ${String(err).slice(0, 100)}` },
      { status: 502 }
    );
  }

  void userId; // used for auth check above
}
