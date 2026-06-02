import Link from "next/link";
import Image from "next/image";
import { ChevronRight, MapPin, Calendar, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

import { flagForTeam } from "@/lib/wc-flags";
import type {
  WCFixture,
  WCGroup,
  WCPredictionSlot,
  GroupAdvancementProb,
  WCMatchPreview,
} from "@/lib/world-cup";

interface WCGroupCardProps {
  group: WCGroup;
  predictions: Record<string, WCPredictionSlot>;
  /** Advancement % per team — empty object renders the "computing" placeholder. */
  advancement: Record<string, GroupAdvancementProb>;
  /**
   * Server-side "now" snapshot — used to decide which fixtures are next vs. past.
   * Callers must pass a server-snapshot (via getServerNowMs) — the lint rule
   * forbids Date.now() in render code.
   */
  nowMs: number;
  /** Force open/closed state — overrides the auto "has the tournament started" check. */
  defaultOpen?: boolean;
  /** WC-AI-PREVIEW (2026-06-02) — Gemini previews keyed by fixture id. */
  previews?: Record<string, WCMatchPreview>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TeamFlag({ logo, name, size = 18 }: { logo: string | null; name: string; size?: number }) {
  const flag = flagForTeam(name);
  if (flag) {
    return (
      <span aria-hidden className="shrink-0 leading-none" style={{ fontSize: size, width: size, display: "inline-block" }}>
        {flag}
      </span>
    );
  }
  if (logo) {
    return (
      <span className="relative shrink-0 overflow-hidden rounded-full bg-white/[0.06]" style={{ width: size, height: size }}>
        <Image src={logo} alt="" fill sizes="20px" className="object-contain p-0.5" unoptimized />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-bold text-muted-foreground"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function AdvancementBar({ p }: { p: number | undefined }) {
  if (p == null) {
    return <span className="text-muted-foreground/30">—</span>;
  }
  const pct = Math.round(p * 100);
  // Color ramp: green ≥66, amber 33-66, red <33
  const color =
    pct >= 66
      ? "bg-[color:var(--color-tournament-green)]"
      : pct >= 33
        ? "bg-amber-400"
        : "bg-red-400/70";
  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="relative h-1.5 w-12 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full ${color} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

function FixtureRow({
  fixture,
  prediction,
  preview,
}: {
  fixture: WCFixture;
  prediction: WCPredictionSlot | undefined;
  preview?: WCMatchPreview;
}) {
  const hasScore =
    fixture.status === "finished" && fixture.scoreHome != null && fixture.scoreAway != null;
  const pct = (v: number | null) => Math.round((v ?? 0) * 100);

  return (
    <div className="rounded-lg border border-white/[0.06] bg-card/40 hover:border-white/[0.12] hover:bg-card/60">
      <Link
        href={`/matches/${fixture.id}`}
        className="wc-row-hover group flex items-center gap-2 rounded-lg px-2.5 py-2 sm:px-3 sm:py-2.5"
      >
        <div className="w-10 shrink-0 text-center font-mono text-[10px] text-muted-foreground sm:w-12 sm:text-[11px]">
          {hasScore ? (
            <span className="font-semibold text-foreground">
              {fixture.scoreHome}–{fixture.scoreAway}
            </span>
          ) : (
            formatTime(fixture.date)
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">
          <span className="truncate text-xs text-foreground sm:text-sm">{fixture.home.name}</span>
          <TeamFlag logo={fixture.home.logo} name={fixture.home.name} size={16} />
        </div>

        <span className="text-[9px] text-muted-foreground/60">v</span>

        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <TeamFlag logo={fixture.away.logo} name={fixture.away.name} size={16} />
          <span className="truncate text-xs text-foreground sm:text-sm">{fixture.away.name}</span>
        </div>

        {prediction?.homeProb != null && prediction.awayProb != null && (
          <div className="hidden shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground sm:flex">
            <span>{pct(prediction.homeProb)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{pct(prediction.drawProb)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{pct(prediction.awayProb)}</span>
          </div>
        )}

        {fixture.venueName && (
          <div className="hidden max-w-[180px] shrink-0 items-center gap-1 text-[10px] text-muted-foreground/60 lg:flex">
            <MapPin className="size-3" />
            <span className="truncate">{fixture.venueName}</span>
          </div>
        )}

        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
      </Link>

      {preview && (
        <details className="group/preview border-t border-white/[0.04]">
          <summary className="flex min-h-[36px] cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-purple-400/80 hover:text-purple-300 sm:text-[11px]">
            <Sparkles className="size-3 shrink-0" />
            AI preview
            <ChevronDown className="ml-auto size-3 shrink-0 transition-transform group-open/preview:rotate-180" />
          </summary>
          <div className="px-3 pb-3 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            {preview.previewText}
          </div>
        </details>
      )}
    </div>
  );
}

function formatDayShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function WCGroupCard({
  group,
  predictions,
  advancement,
  nowMs,
  defaultOpen,
  previews,
}: WCGroupCardProps) {
  // Default-open once the first group fixture has kicked off, otherwise show
  // only the next 1-2 with a "show all" expand affordance.
  const tournamentStarted =
    defaultOpen ??
    group.fixtures.some((f) => new Date(f.date).getTime() < nowMs);

  // For the collapsed-state summary line: pick the next 1-2 upcoming fixtures
  // (or the very first one if everything is in the past — should rarely happen
  // pre-tournament, but defends against bad clock skew).
  const sorted = group.fixtures
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcomingIdx = sorted.findIndex((f) => new Date(f.date).getTime() >= nowMs);
  const startIdx = upcomingIdx === -1 ? 0 : upcomingIdx;
  const preview = sorted.slice(startIdx, startIdx + 2);

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40 shadow-sm">
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-transparent px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
            Group {group.label}
          </span>
          <span className="text-[10px] text-muted-foreground sm:text-xs">
            {group.teams.length} teams · {group.fixtures.length} fixtures
          </span>
        </div>
      </header>

      {/* Standings — mobile-friendly: hide columns < md */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] sm:text-xs">
          <thead className="border-b border-white/[0.06] text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium sm:px-3 sm:py-2">Team</th>
              <th className="px-1.5 py-1.5 text-center font-medium sm:px-2 sm:py-2">P</th>
              <th className="hidden px-2 py-2 text-center font-medium sm:table-cell">W</th>
              <th className="hidden px-2 py-2 text-center font-medium sm:table-cell">D</th>
              <th className="hidden px-2 py-2 text-center font-medium sm:table-cell">L</th>
              <th className="hidden px-2 py-2 text-center font-medium md:table-cell">GD</th>
              <th className="px-1.5 py-1.5 text-center font-medium sm:px-2 sm:py-2">Pts</th>
              <th
                className="px-2 py-1.5 text-right font-medium text-muted-foreground sm:px-3 sm:py-2"
                title="Advancement probability — Monte Carlo over remaining group fixtures"
              >
                Adv
              </th>
            </tr>
          </thead>
          <tbody>
            {group.standings.map((s, i) => {
              const adv = advancement[s.team.id]?.pAdvance;
              return (
                <tr
                  key={s.team.id}
                  className={`border-b border-white/[0.04] last:border-0 ${
                    i < 2 ? "bg-[color:var(--color-tournament-green)]/[0.04]" : ""
                  }`}
                >
                  <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 text-center text-muted-foreground tabular-nums">{i + 1}</span>
                      <TeamFlag logo={s.team.logo} name={s.team.name} size={16} />
                      <span className="truncate text-foreground">{s.team.name}</span>
                    </div>
                  </td>
                  <td className="px-1.5 py-1.5 text-center text-muted-foreground tabular-nums sm:px-2 sm:py-2">
                    {s.played}
                  </td>
                  <td className="hidden px-2 py-2 text-center text-muted-foreground tabular-nums sm:table-cell">
                    {s.wins}
                  </td>
                  <td className="hidden px-2 py-2 text-center text-muted-foreground tabular-nums sm:table-cell">
                    {s.draws}
                  </td>
                  <td className="hidden px-2 py-2 text-center text-muted-foreground tabular-nums sm:table-cell">
                    {s.losses}
                  </td>
                  <td className="hidden px-2 py-2 text-center text-muted-foreground tabular-nums md:table-cell">
                    {s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}
                  </td>
                  <td className="px-1.5 py-1.5 text-center font-semibold text-foreground tabular-nums sm:px-2 sm:py-2">
                    {s.points}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums sm:px-3 sm:py-2">
                    <AdvancementBar p={adv} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Group fixtures — collapsible.
          Pre-tournament: show next 1-2 fixtures, "show all" expands the rest.
          Post-kickoff: render all fixtures expanded by default (so users see results). */}
      {tournamentStarted ? (
        <div className="space-y-1.5 px-2.5 py-2.5 sm:px-3 sm:py-3">
          {sorted.map((f) => (
            <FixtureRow key={f.id} fixture={f} prediction={predictions[f.id]} />
          ))}
        </div>
      ) : (
        <details className="group/expand">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 border-t border-white/[0.04] bg-white/[0.02] px-3 py-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground sm:px-4">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Calendar className="size-3 shrink-0" />
              <span className="truncate">
                <span className="uppercase tracking-wider text-muted-foreground/80">Up next:</span>{" "}
                {preview[0]
                  ? `${formatDayShort(preview[0].date)} · ${preview[0].home.name} v ${preview[0].away.name}`
                  : "TBD"}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground/80 group-open/expand:hidden">
              Show all {group.fixtures.length}
              <ChevronDown className="size-3 transition-transform" />
            </span>
            <span className="hidden shrink-0 items-center gap-1 text-[10px] text-muted-foreground/80 group-open/expand:inline-flex">
              Hide
              <ChevronUp className="size-3" />
            </span>
          </summary>
          <div className="space-y-1.5 px-2.5 py-2.5 sm:px-3 sm:py-3">
            {sorted.map((f) => (
              <FixtureRow
                key={f.id}
                fixture={f}
                prediction={predictions[f.id]}
                preview={previews?.[f.id]}
              />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
