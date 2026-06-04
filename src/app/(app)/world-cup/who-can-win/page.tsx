/**
 * WC-E1 — /world-cup/who-can-win
 *
 * Server-rendered page that surfaces the latest Monte Carlo tournament
 * simulation snapshot from `wc_monte_carlo_results`. The engine
 * (`scripts/wc_monte_carlo.py`) runs nightly at 06:30 UTC and writes one row
 * per team. We read the most recent snapshot and join in team meta + ELO +
 * group letter.
 *
 * Layout:
 *   - Hero: "How does WC2026 play out — 10,000 simulations later" + meta
 *   - Title contenders strip: top-5 by p_winner with gold border
 *   - Main table: all 48 teams, sortable client-side
 */
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Sparkles } from "lucide-react";

import { createSupabaseServer } from "@/lib/supabase-server";
import { getWorldCupFixtures, deriveGroups } from "@/lib/world-cup";
import { displayProb } from "@/lib/probability-display";
import { flagForTeam } from "@/lib/wc-flags";
import { WhoCanWinTable } from "@/components/wc-who-can-win-table";

export const metadata: Metadata = {
  title: "FIFA World Cup 2026 — Who Can Win? Monte Carlo Predictions | OddsIntel",
  description:
    "10,000 simulations of FIFA World Cup 2026. Per-team probability of advancing from the group, reaching the R16, QF, SF, Final, and lifting the trophy.",
  alternates: { canonical: "https://oddsintel.app/world-cup/who-can-win" },
  openGraph: {
    title: "Who Can Win the World Cup? 10,000 Monte Carlo simulations",
    description:
      "Per-team probabilities of advancing, reaching each knockout round, and winning WC 2026 — based on our model + ELO.",
    url: "https://oddsintel.app/world-cup/who-can-win",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Who Can Win the World Cup 2026?",
    description: "10,000 Monte Carlo simulations · advance % · winner % per team.",
  },
};

// Slug helper mirrors src/app/(app)/world-cup/teams/[name]/page.tsx so the
// row links go to the right team detail.
function slugifyTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface SnapshotRow {
  team_id: string;
  snapshot_at: string;
  n_sims: number;
  p_advance: number;
  p_r16: number;
  p_qf: number;
  p_sf: number;
  p_final: number;
  p_winner: number;
}

export interface WhoCanWinRow {
  teamId: string;
  teamName: string;
  flag: string | null;
  slug: string;
  group: string;
  elo: number | null;
  pAdvance: number;
  pR16: number;
  pQF: number;
  pSF: number;
  pFinal: number;
  pWinner: number;
}

async function loadLatestSnapshot(): Promise<{
  rows: WhoCanWinRow[];
  snapshotAt: string | null;
  nSims: number;
}> {
  const supabase = await createSupabaseServer();

  // Most recent snapshot timestamp.
  const { data: latest, error: latestErr } = await supabase
    .from("wc_monte_carlo_results")
    .select("snapshot_at, n_sims")
    .order("snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr || !latest) {
    return { rows: [], snapshotAt: null, nSims: 0 };
  }

  const snapshotAt = (latest as { snapshot_at: string }).snapshot_at;
  const nSims = (latest as { n_sims: number }).n_sims;

  // All team rows for that snapshot.
  const { data: snapshotRows, error: rowsErr } = await supabase
    .from("wc_monte_carlo_results")
    .select("team_id, snapshot_at, n_sims, p_advance, p_r16, p_qf, p_sf, p_final, p_winner")
    .eq("snapshot_at", snapshotAt);

  if (rowsErr || !snapshotRows || snapshotRows.length === 0) {
    return { rows: [], snapshotAt, nSims };
  }

  const teamIds = (snapshotRows as SnapshotRow[]).map((r) => r.team_id);

  // Pull team names alongside their latest international ELO. We do this in
  // two cheap queries (teams + latest elos per team) rather than a complex
  // RPC since the team set is bounded to 48.
  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", teamIds);

  const nameById = new Map<string, string>();
  for (const t of (teamRows ?? []) as { id: string; name: string }[]) {
    nameById.set(t.id, t.name);
  }

  // Latest ELO per team — single query, sorted desc, take first per team in JS.
  const { data: eloRows } = await supabase
    .from("team_elo_international")
    .select("team_id, elo_rating, match_date")
    .in("team_id", teamIds)
    .order("match_date", { ascending: false });

  const eloByTeam = new Map<string, number>();
  for (const e of (eloRows ?? []) as {
    team_id: string;
    elo_rating: number | string;
  }[]) {
    if (eloByTeam.has(e.team_id)) continue; // sorted desc → first wins
    const v = typeof e.elo_rating === "string" ? parseFloat(e.elo_rating) : e.elo_rating;
    if (Number.isFinite(v)) eloByTeam.set(e.team_id, v);
  }

  // Group letter via fixture-based derivation (mirrors the engine + every
  // other WC surface so labels match).
  const fixtures = await getWorldCupFixtures();
  const groups = deriveGroups(fixtures);
  const groupByTeam = new Map<string, string>();
  for (const g of groups) {
    for (const t of g.teams) {
      groupByTeam.set(t.id, g.label);
    }
  }

  const rows: WhoCanWinRow[] = (snapshotRows as SnapshotRow[]).map((r) => {
    const name = nameById.get(r.team_id) ?? "Unknown";
    return {
      teamId: r.team_id,
      teamName: name,
      flag: flagForTeam(name),
      slug: slugifyTeamName(name),
      group: groupByTeam.get(r.team_id) ?? "?",
      elo: eloByTeam.get(r.team_id) ?? null,
      pAdvance: Number(r.p_advance),
      pR16: Number(r.p_r16),
      pQF: Number(r.p_qf),
      pSF: Number(r.p_sf),
      pFinal: Number(r.p_final),
      pWinner: Number(r.p_winner),
    };
  });

  rows.sort((a, b) => b.pWinner - a.pWinner);
  return { rows, snapshotAt, nSims };
}

function snapshotAge(snapshotIso: string | null): string {
  if (!snapshotIso) return "";
  const t = new Date(snapshotIso).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.floor((now - t) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const hr = Math.floor(diffMin / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export default async function WhoCanWinPage() {
  const { rows, snapshotAt, nSims } = await loadLatestSnapshot();

  const hasData = rows.length > 0;
  const top5 = rows.slice(0, 5);
  const age = snapshotAge(snapshotAt);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="size-3.5 text-[color:var(--color-tournament-gold)] sm:size-4" />
          <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
            Monte Carlo simulation
          </span>
        </div>
        <h1 className="mt-1 text-xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">
          How does WC2026 play out — {hasData ? nSims.toLocaleString() : "10,000"} simulations later
        </h1>
        <p className="mt-1 max-w-xl text-xs text-muted-foreground sm:text-sm">
          For each team: how often they advance from the group, reach the R16, QF, SF, Final, and
          lift the trophy. Group stage outcomes drawn from our 1X2 model; knockouts simulated from
          current international ELO.
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground/70 sm:text-xs">
          {hasData ? (
            <>
              Snapshot {age}
              {snapshotAt
                ? ` · ${new Date(snapshotAt).toUTCString().replace(":00 GMT", " UTC")}`
                : ""}{" "}
              · re-runs nightly at 06:30 UTC
            </>
          ) : (
            <>Simulation runs nightly at 06:30 UTC.</>
          )}
        </p>
        <Link
          href="/world-cup"
          className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:text-sm"
        >
          ← Back to World Cup hub
        </Link>
      </section>

      {!hasData && (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-6 text-center text-sm text-muted-foreground">
          <Trophy className="mx-auto mb-2 size-5 text-[color:var(--color-tournament-gold)]/70" />
          Simulation runs nightly; first results land within 24h.
        </div>
      )}

      {/* ── Title contenders ─────────────────────────────────────────── */}
      {hasData && top5.length > 0 && (
        <section
          aria-label="Top 5 title contenders"
          className="rounded-xl border border-white/[0.08] bg-card/40 p-4 sm:p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="size-4 text-[color:var(--color-tournament-gold)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground sm:text-base">
              Title contenders
            </h2>
            <span className="text-[10px] text-muted-foreground sm:text-[11px]">
              top 5 by winner %
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {top5.map((t) => (
              <Link
                key={t.teamId}
                href={`/world-cup/teams/${t.slug}`}
                className="group flex items-center gap-2.5 rounded-lg border border-[color:var(--color-tournament-gold)]/40 bg-gradient-to-br from-[color:var(--color-tournament-gold)]/[0.06] to-transparent px-3 py-2.5 transition-colors hover:border-[color:var(--color-tournament-gold)]/70 hover:bg-[color:var(--color-tournament-gold)]/[0.08]"
              >
                {t.flag ? (
                  <span aria-hidden className="text-2xl leading-none">
                    {t.flag}
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className="inline-flex size-7 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-muted-foreground"
                  >
                    {t.teamName.charAt(0)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground group-hover:text-[color:var(--color-tournament-gold)] sm:text-sm">
                    {t.teamName}
                  </p>
                  <p className="font-mono text-[11px] tabular-nums text-[color:var(--color-tournament-gold)] sm:text-xs">
                    {displayProb(t.pWinner)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Main table ───────────────────────────────────────────────── */}
      {hasData && <WhoCanWinTable rows={rows} />}
    </div>
  );
}
