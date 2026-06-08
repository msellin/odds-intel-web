export const dynamic = 'force-dynamic';

import { createSupabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

interface LolMatch {
  id: number;
  league: string;
  kickoff_time: string;
  state: string;
  best_of: number;
  team1: string;
  team2: string;
  elo1: number | null;
  elo2: number | null;
  win_prob1: number | null;
  win_prob2: number | null;
  fair_odds1: number | null;
  fair_odds2: number | null;
  threshold_odds1: number | null;
  threshold_odds2: number | null;
  has_elo_history: boolean;
  scanned_at: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Tallinn",
  });
}

function formatOdds(n: number | null) {
  return n != null ? n.toFixed(2) : "—";
}

function WinProbBar({ prob, side }: { prob: number | null; side: "left" | "right" }) {
  if (prob == null) return null;
  const pct = Math.round(prob * 100);
  const color = pct >= 65 ? "bg-green-500" : pct >= 55 ? "bg-blue-500" : "bg-muted-foreground";
  return (
    <div className="flex items-center gap-1.5">
      {side === "right" && <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>}
      <div className="h-1.5 rounded-full w-16 bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {side === "left" && <span className="text-xs text-muted-foreground w-8">{pct}%</span>}
    </div>
  );
}

export default async function LolAdminPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Access denied.
      </div>
    );
  }

  const { data: profile } = await supabase
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

  const db = serviceClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();

  const { data: rows } = await db
    .from("lol_upcoming_matches")
    .select("*")
    .gte("kickoff_time", now.toISOString())
    .lte("kickoff_time", cutoff)
    .order("kickoff_time", { ascending: true });

  const matches = (rows ?? []) as LolMatch[];

  const scannedAt = matches[0]?.scanned_at
    ? new Date(matches[0].scanned_at).toLocaleString("en-GB", {
        timeZone: "Europe/Tallinn",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Group by league for display, but keep kickoff_time ordering
  const leagueCounts: Record<string, number> = {};
  for (const m of matches) {
    leagueCounts[m.league] = (leagueCounts[m.league] ?? 0) + 1;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">LoL — ELO Value Threshold Sheet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bet if bookmaker odds exceed the threshold. Threshold = ELO fair price × 0.97 (3% edge).
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground shrink-0">
          {scannedAt ? (
            <>Last scan: <span className="font-mono">{scannedAt}</span></>
          ) : (
            <span className="text-yellow-400">No data — run the scanner first</span>
          )}
        </div>
      </div>

      {/* How to use */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-sm space-y-1">
        <p className="font-semibold text-blue-400">How to use</p>
        <p className="text-muted-foreground">
          Open Coolbet (or any bookmaker) LoL odds. For each match, the number shown is the
          <strong className="text-foreground"> minimum odds you need</strong> — bet only if the
          bookmaker offers that or higher. Higher bookmaker odds = more edge.
        </p>
        <p className="text-muted-foreground text-xs mt-1">
          Refresh data:{" "}
          <code className="bg-muted px-1 rounded">
            python3 scripts/esports/lol_elo_scanner.py --record
          </code>
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No upcoming matches loaded. Run the scanner:
          <br />
          <code className="text-sm mt-2 block">
            python3 scripts/esports/lol_elo_scanner.py --record
          </code>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => {
            const isLive = m.state === "inProgress";

            return (
              <div
                key={m.id}
                className={`rounded-lg border p-4 ${
                  isLive
                    ? "border-yellow-500/50 bg-yellow-500/5"
                    : "border-border"
                }`}
              >
                {/* Match header */}
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{m.league}</span>
                    <span>·</span>
                    <span className="font-mono">{formatTime(m.kickoff_time)}</span>
                    <span>· BO{m.best_of}</span>
                    {isLive && (
                      <span className="text-yellow-400 font-bold animate-pulse">⚡ LIVE</span>
                    )}
                    {!m.has_elo_history && (
                      <span className="text-orange-400 text-xs">no ELO history</span>
                    )}
                  </div>
                </div>

                {/* Two team rows */}
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      {
                        name: m.team1,
                        elo: m.elo1,
                        prob: m.win_prob1,
                        fair: m.fair_odds1,
                        threshold: m.threshold_odds1,
                        probBar: "left" as const,
                      },
                      {
                        name: m.team2,
                        elo: m.elo2,
                        prob: m.win_prob2,
                        fair: m.fair_odds2,
                        threshold: m.threshold_odds2,
                        probBar: "right" as const,
                      },
                    ] as const
                  ).map(({ name, elo, prob, fair, threshold, probBar }) => (
                    <div
                      key={name}
                      className="rounded-md p-3 border border-border bg-muted/20"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-semibold leading-tight">{name}</span>
                        {elo != null && (
                          <span className="text-xs text-muted-foreground font-mono shrink-0">
                            ELO {Math.round(elo)}
                          </span>
                        )}
                      </div>

                      <WinProbBar prob={prob} side={probBar} />

                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-xs text-muted-foreground">bet if ≥</span>
                        <span className="text-xl font-bold tabular-nums">
                          {formatOdds(threshold)}
                        </span>
                      </div>

                      {fair != null && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          fair: {formatOdds(fair)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {matches.length > 0 && (
        <div className="text-xs text-muted-foreground border-t pt-4 flex flex-wrap gap-6">
          <span>{matches.length} matches loaded</span>
          <span>{Object.keys(leagueCounts).length} leagues</span>
          <span>{matches.filter((m) => m.state === "inProgress").length} live</span>
          <span>{matches.filter((m) => !m.has_elo_history).length} without ELO history</span>
        </div>
      )}
    </div>
  );
}
