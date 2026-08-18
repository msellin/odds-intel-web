/**
 * /admin/no-pin-shadow — bot_no_pin_shadow_v1 ledger.
 *
 * BOT-NO-PIN-SHADOW-2026-08-18 Phase 1 experiment: is there edge on 1X2
 * markets that Pinnacle doesn't quote? This page shows the running data.
 * Shadow bets only — no real placement, no bankroll effect.
 *
 * Superadmin-only for now (experimental / low signal-to-noise until n≥50).
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";

interface ShadowBetRow {
  id: string;
  match_id: string;
  market: string;
  selection: string;
  odds_at_pick: number | null;
  model_probability: number | null;
  edge_percent: number | null;
  recommended_bookmaker: string | null;
  pick_time: string;
  result: string | null;
  matches: {
    date: string;
    leagues: { name: string | null; country: string | null } | null;
    home_team: { name: string | null } | null;
    away_team: { name: string | null } | null;
  } | null;
}

export default async function NoPinShadowPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Access denied.
      </div>
    );
  }

  const db = createServerServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_superadmin) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Superadmin only.
      </div>
    );
  }

  // Get bot_id first — RLS-safe on VPS Postgres
  const { data: botRow } = await db
    .from("bots")
    .select("id, maturity_label")
    .eq("name", "bot_no_pin_shadow_v1")
    .single();

  if (!botRow?.id) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">No-Pinnacle Shadow Bot</h1>
        <p className="mt-4 text-sm text-amber-400">
          Bot not yet registered — migration 271 hasn&apos;t been applied.
        </p>
      </div>
    );
  }

  const { data: rows } = await db
    .from("shadow_bets")
    .select(
      `id, match_id, market, selection, odds_at_pick, model_probability,
       edge_percent, recommended_bookmaker, pick_time, result,
       matches!inner (
         date,
         leagues ( name, country ),
         home_team:teams!matches_home_team_id_fkey ( name ),
         away_team:teams!matches_away_team_id_fkey ( name )
       )`
    )
    .eq("bot_id", botRow.id)
    .order("pick_time", { ascending: false })
    .limit(300);

  const bets = (rows ?? []) as unknown as ShadowBetRow[];

  const settled = bets.filter((b) => b.result && b.result !== "pending" && b.result !== "void");
  const wins = settled.filter((b) => b.result === "won");
  const losses = settled.filter((b) => b.result === "lost");
  const pending = bets.filter((b) => !b.result || b.result === "pending");

  const stake = 10; // shadow stake is fixed 10u per bulk_store_shadow_bets
  const totalStake = settled.length * stake;
  const totalReturn = wins.reduce(
    (s, b) => s + (Number(b.odds_at_pick ?? 0) * stake),
    0
  );
  const pnl = totalReturn - totalStake;
  const roi = totalStake > 0 ? (pnl / totalStake) * 100 : 0;
  const hitRate = settled.length > 0 ? (wins.length / settled.length) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">No-Pinnacle Shadow Bot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono text-xs uppercase tracking-wider text-amber-400">
            {botRow.maturity_label}
          </span>
          {" · "}
          <span>bot_no_pin_shadow_v1</span>
        </p>
        <p className="mt-3 text-sm text-neutral-400 max-w-3xl">
          Phase 1 data collection. Fires on 1X2 markets where Pinnacle doesn&apos;t quote
          but ≥3 accessible books do. Median of accessible-book prices used as local anchor.
          Edge ≥ 8%. Writes to shadow_bets only — never places a real or paper bet.
          Goal: measure whether the model has edge on the ~15-20% of daily fixtures
          currently skipped by the Pinnacle-required gate. Promote to paper beta at
          n≥50 &amp; ROI ≥ +3%; retire at ROI ≤ -8%.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total picks" value={bets.length.toString()} />
        <StatCard label="Pending" value={pending.length.toString()} />
        <StatCard label="Settled" value={settled.length.toString()} />
        <StatCard
          label="Hit rate"
          value={settled.length > 0 ? `${hitRate.toFixed(1)}%` : "—"}
        />
        <StatCard
          label="ROI"
          value={settled.length > 0 ? `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` : "—"}
          tone={roi >= 3 ? "good" : roi <= -8 ? "bad" : "neutral"}
        />
      </div>

      {bets.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-neutral-400">
          No shadow picks yet. Bot fires from run_morning after the acca pass —
          check back after the next scheduler cycle. On thin days this bot may
          write zero picks (correct behaviour).
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="text-left px-3 py-2 font-mono">KO</th>
                <th className="text-left px-3 py-2 font-mono">Match</th>
                <th className="text-left px-3 py-2 font-mono">Pick</th>
                <th className="text-right px-3 py-2 font-mono">Odds</th>
                <th className="text-right px-3 py-2 font-mono">Prob</th>
                <th className="text-right px-3 py-2 font-mono">Edge</th>
                <th className="text-left px-3 py-2 font-mono">Book</th>
                <th className="text-left px-3 py-2 font-mono">Result</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((b, i) => {
                const ko = b.matches?.date ? new Date(b.matches.date) : null;
                const kickoff = ko
                  ? ko.toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    }) + " UTC"
                  : "—";
                return (
                  <tr
                    key={b.id}
                    className={i > 0 ? "border-t border-white/[0.04]" : ""}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-neutral-400 whitespace-nowrap">
                      {kickoff}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {b.matches?.home_team?.name ?? "Home"}{" "}
                        <span className="text-neutral-500">vs</span>{" "}
                        {b.matches?.away_team?.name ?? "Away"}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {b.matches?.leagues?.country
                          ? `${b.matches.leagues.country} `
                          : ""}
                        {b.matches?.leagues?.name ?? ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-emerald-300">
                      {b.selection}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {b.odds_at_pick != null ? Number(b.odds_at_pick).toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-neutral-400">
                      {b.model_probability != null
                        ? (Number(b.model_probability) * 100).toFixed(0) + "%"
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-400">
                      {b.edge_percent != null
                        ? "+" + (Number(b.edge_percent) * 100).toFixed(1) + "%"
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-300">
                      {b.recommended_bookmaker ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <ResultBadge result={b.result} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-neutral-500">
        <Link href="/admin/ops" className="underline hover:text-neutral-300">
          ← Back to ops
        </Link>
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
      ? "text-rose-400"
      : "text-neutral-100";
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="text-xs uppercase tracking-wider font-mono text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 text-lg font-mono font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function ResultBadge({ result }: { result: string | null }) {
  if (!result || result === "pending")
    return (
      <span className="rounded bg-neutral-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
        Pending
      </span>
    );
  if (result === "won")
    return (
      <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
        Won
      </span>
    );
  if (result === "lost")
    return (
      <span className="rounded bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-rose-400">
        Lost
      </span>
    );
  if (result === "void")
    return (
      <span className="rounded bg-neutral-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
        Void
      </span>
    );
  return null;
}
