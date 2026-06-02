import Link from "next/link";
import Image from "next/image";
import { ChevronRight, MapPin } from "lucide-react";

import { flagForTeam } from "@/lib/wc-flags";
import type {
  WCFixture,
  WCGroup,
  WCPredictionSlot,
  GroupAdvancementProb,
} from "@/lib/world-cup";

interface WCGroupCardProps {
  group: WCGroup;
  predictions: Record<string, WCPredictionSlot>;
  /** Advancement % per team — empty object renders the "computing" placeholder. */
  advancement: Record<string, GroupAdvancementProb>;
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
}: {
  fixture: WCFixture;
  prediction: WCPredictionSlot | undefined;
}) {
  const hasScore =
    fixture.status === "finished" && fixture.scoreHome != null && fixture.scoreAway != null;
  const pct = (v: number | null) => Math.round((v ?? 0) * 100);

  return (
    <Link
      href={`/matches/${fixture.id}`}
      className="wc-row-hover group flex items-center gap-2 rounded-lg border border-white/[0.06] bg-card/40 px-2.5 py-2 hover:border-white/[0.12] hover:bg-card/60 sm:px-3 sm:py-2.5"
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
  );
}

export function WCGroupCard({ group, predictions, advancement }: WCGroupCardProps) {
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

      {/* Group fixtures */}
      <div className="space-y-1.5 px-2.5 py-2.5 sm:px-3 sm:py-3">
        {group.fixtures.map((f) => (
          <FixtureRow key={f.id} fixture={f} prediction={predictions[f.id]} />
        ))}
      </div>
    </section>
  );
}
