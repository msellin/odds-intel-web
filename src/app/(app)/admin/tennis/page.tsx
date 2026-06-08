export const dynamic = 'force-dynamic';

import { createSupabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

interface Fixture {
  fixture_id: string;
  tournament_name: string | null;
  player_home: string;
  player_away: string;
  kickoff_time: string;
  pin_raw_home: number | null;
  pin_raw_away: number | null;
  threshold_home: number;
  threshold_away: number;
  pin_margin_pct: number | null;
  scanned_at: string;
}

interface ValueBet {
  fixture_id: string;
  selection: string;
  bookmaker: string;
  book_odds: number;
  edge_pct: number;
  stake: number;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Tallinn",
  });
}

function formatOdds(n: number) {
  return n.toFixed(2);
}

function EdgeBadge({ edge }: { edge: number }) {
  const color =
    edge >= 5 ? "bg-green-500" : edge >= 3 ? "bg-green-400" : "bg-yellow-400";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold text-black ${color}`}>
      +{edge.toFixed(1)}%
    </span>
  );
}

export default async function TennisAdminPage() {
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
  const cutoff = new Date(now.getTime() + 36 * 3600 * 1000).toISOString();

  const [{ data: fixtures }, { data: valueBets }] = await Promise.all([
    db
      .from("tennis_fixtures_today")
      .select("*")
      .gte("kickoff_time", now.toISOString())
      .lte("kickoff_time", cutoff)
      .order("kickoff_time", { ascending: true }),
    db
      .from("tennis_value_bets")
      .select("fixture_id, selection, bookmaker, book_odds, edge_pct, stake")
      .gte("kickoff_time", now.toISOString())
      .lte("kickoff_time", cutoff)
      .is("result", null)
      .order("edge_pct", { ascending: false }),
  ]);

  const fixtures_ = (fixtures ?? []) as Fixture[];
  const valueBets_ = (valueBets ?? []) as ValueBet[];

  // Index value bets by fixture_id + selection
  const vbIndex: Record<string, ValueBet[]> = {};
  for (const vb of valueBets_) {
    const key = `${vb.fixture_id}`;
    if (!vbIndex[key]) vbIndex[key] = [];
    vbIndex[key].push(vb);
  }

  const scannedAt = fixtures_[0]?.scanned_at
    ? new Date(fixtures_[0].scanned_at).toLocaleString("en-GB", {
        timeZone: "Europe/Tallinn",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tennis — Value Threshold Sheet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bet if book odds exceed the threshold. Threshold = Pinnacle de-vigged fair price.
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {scannedAt ? (
            <>
              Last scan: <span className="font-mono">{scannedAt}</span>
            </>
          ) : (
            <span className="text-yellow-400">No data — run the scanner first</span>
          )}
        </div>
      </div>

      {/* How to use */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-sm space-y-1">
        <p className="font-semibold text-blue-400">How to use</p>
        <p className="text-muted-foreground">
          Open Coolbet tennis odds. For each match below, check if either player&apos;s
          odds exceed the threshold shown. If yes → place the bet manually.
          Green rows = value already found by scanner at time of last scan.
        </p>
        <p className="text-muted-foreground text-xs mt-1">
          Run scanner: <code className="bg-muted px-1 rounded">python3 scripts/tennis/value_scanner.py</code>
        </p>
      </div>

      {fixtures_.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No fixtures loaded. Run the scanner:
          <br />
          <code className="text-sm mt-2 block">
            export OP_KEY=your_key && python3 scripts/tennis/value_scanner.py
          </code>
        </div>
      ) : (
        <div className="space-y-3">
          {fixtures_.map((fix) => {
            const vbs = vbIndex[fix.fixture_id] ?? [];
            const homeVbs = vbs.filter((v) => v.selection === "home");
            const awayVbs = vbs.filter((v) => v.selection === "away");
            const hasValue = vbs.length > 0;

            return (
              <div
                key={fix.fixture_id}
                className={`rounded-lg border p-4 ${
                  hasValue ? "border-green-500/40 bg-green-500/5" : "border-border"
                }`}
              >
                {/* Match header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {fix.tournament_name ?? "Unknown tournament"} · {formatTime(fix.kickoff_time)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    {fix.pin_margin_pct != null && (
                      <span>Pin margin: {fix.pin_margin_pct.toFixed(1)}%</span>
                    )}
                    {hasValue && (
                      <span className="text-green-400 font-semibold">VALUE FOUND</span>
                    )}
                  </div>
                </div>

                {/* Two player rows */}
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      {
                        label: fix.player_home,
                        rawOdds: fix.pin_raw_home,
                        threshold: fix.threshold_home,
                        side: "home" as const,
                        sideVbs: homeVbs,
                      },
                      {
                        label: fix.player_away,
                        rawOdds: fix.pin_raw_away,
                        threshold: fix.threshold_away,
                        side: "away" as const,
                        sideVbs: awayVbs,
                      },
                    ] as const
                  ).map(({ label, rawOdds, threshold, sideVbs }) => (
                    <div
                      key={label}
                      className={`rounded-md p-3 border ${
                        sideVbs.length > 0
                          ? "border-green-500/50 bg-green-500/10"
                          : "border-border bg-muted/20"
                      }`}
                    >
                      <div className="text-xs font-mono text-muted-foreground mb-1">
                        {label}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold tabular-nums">
                          {formatOdds(threshold)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          min to bet
                        </span>
                      </div>
                      {rawOdds != null && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Pinnacle (raw): {formatOdds(rawOdds)}
                        </div>
                      )}

                      {/* Value bets found */}
                      {sideVbs.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {sideVbs.map((vb, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-green-300 capitalize">
                                {vb.bookmaker}
                              </span>
                              <span className="font-mono font-bold">
                                {formatOdds(vb.book_odds)}
                              </span>
                              <EdgeBadge edge={vb.edge_pct} />
                              <span className="text-muted-foreground">
                                {vb.stake.toFixed(2)}u
                              </span>
                            </div>
                          ))}
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
      {fixtures_.length > 0 && (
        <div className="text-xs text-muted-foreground border-t pt-4 flex gap-6">
          <span>{fixtures_.length} fixtures loaded</span>
          <span>{valueBets_.length} value bets found</span>
          <span>
            {valueBets_.filter((v) => v.edge_pct >= 5).length} at ≥5% edge
          </span>
        </div>
      )}
    </div>
  );
}
