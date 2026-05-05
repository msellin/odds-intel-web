import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * GET /api/bet-explain?betId=<uuid>
 * Returns a natural language explanation of why the engine placed a bet.
 * Elite tier only.
 *
 * Explanations are cached on the simulated_bets row (ai_explanation column).
 * The first request generates and stores it; all subsequent requests return
 * the cached text with no Gemini call. This bounds total API usage to the
 * number of unique bets per day (~20-50), not to the number of users.
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
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { isElite } = await getUserTier(user.id, supabase);
    if (!isElite)
      return NextResponse.json({ error: "Elite required" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Auth error" }, { status: 500 });
  }

  // Use service role for all DB operations (RLS on simulated_bets blocks anon)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!
  );

  const { data: bet } = await supabaseAdmin
    .from("simulated_bets")
    .select(
      `id, market, selection, odds_at_pick, model_probability, edge_percent,
       stake, result, pnl, ai_explanation,
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

  // Return cached explanation if available — no Gemini call needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const betAny = bet as any;
  if (betAny.ai_explanation) {
    return NextResponse.json({ explanation: betAny.ai_explanation, cached: true });
  }

  const matchRow = Array.isArray(betAny.match) ? betAny.match[0] : betAny.match;
  const matchId = matchRow?.id;

  // Fetch signals for this match
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oddsAtPick = Number((bet as any).odds_at_pick);
  const impliedProb = oddsAtPick > 0 ? 1 / oddsAtPick : 0;
  const edgePct = (modelProb - impliedProb) * 100;

  const signalContext = Object.entries(signals)
    .filter(([, v]) => v !== 0)
    .slice(0, 12)
    .map(([k, v]) => `${k}: ${Number(v).toFixed(3)}`)
    .join(", ");

  const prompt = `You are an expert sports betting analyst. Explain in 2-3 clear, concise sentences why the model placed this specific bet. Focus on what the data shows — be specific and direct. Do not mention the model name. Do not say "the model" — say "our analysis" or "the signals".

Match: ${homeTeam} vs ${awayTeam} (${league})
Bet: ${selectionLabel} to win at odds ${oddsAtPick.toFixed(2)}
Market: ${bet.market}
Model probability: ${(modelProb * 100).toFixed(1)}% (market implied: ${(impliedProb * 100).toFixed(1)}%)
Edge: +${edgePct.toFixed(1)}%
Strategy: ${bot}
${signalContext ? `Key signals: ${signalContext}` : ""}
${bet.result && bet.result !== "pending" ? `Outcome: ${bet.result} (P&L: ${Number(bet.pnl).toFixed(2)})` : ""}

Write a 2-3 sentence explanation of why this pick was placed. Translate any technical signals into plain English.`;

  const geminiBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
  });

  // Attempt Gemini call with one retry for transient 503s
  async function callGemini() {
    return fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: geminiBody,
    });
  }

  try {
    let resp = await callGemini();

    // Single retry for transient 503 "high demand" errors
    if (resp.status === 503) {
      await new Promise((r) => setTimeout(r, 1500));
      resp = await callGemini();
    }

    if (!resp.ok) {
      const errText = await resp.text();
      if (resp.status === 429 || errText.includes("quota") || errText.includes("RESOURCE_EXHAUSTED")) {
        return NextResponse.json(
          { error: "AI quota exceeded — please enable billing on the Gemini API key in Google Cloud." },
          { status: 503 }
        );
      }
      if (resp.status === 503 || errText.includes("UNAVAILABLE") || errText.includes("high demand")) {
        return NextResponse.json(
          { error: "AI is temporarily unavailable — please try again in a moment." },
          { status: 503 }
        );
      }
      Sentry.captureException(new Error(`Gemini API error ${resp.status}: ${errText.slice(0, 500)}`), {
        extra: { betId, status: resp.status },
      });
      return NextResponse.json(
        { error: "AI service error — please try again." },
        { status: 502 }
      );
    }

    const json = await resp.json();
    const explanation =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Unable to generate explanation.";
    const trimmed = explanation.trim();

    // Cache on the bet row so future requests cost nothing
    await supabaseAdmin
      .from("simulated_bets")
      .update({ ai_explanation: trimmed, ai_explanation_at: new Date().toISOString() })
      .eq("id", betId);

    return NextResponse.json({ explanation: trimmed });
  } catch (err) {
    Sentry.captureException(err, { extra: { betId } });
    return NextResponse.json(
      { error: "AI request failed — please try again." },
      { status: 502 }
    );
  }
}
