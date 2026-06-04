import Link from "next/link";
import Image from "next/image";
import { ChevronRight, MapPin, Sparkles, ChevronDown } from "lucide-react";

import { flagForTeam } from "@/lib/wc-flags";
import type { WCFixture, WCPredictionSlot, WCMatchPreview } from "@/lib/world-cup";
import { modelPickFromTriple, type WCPick } from "@/lib/wc-vs-you";
import { WCVsYouPicker } from "@/components/wc-vs-you-picker";

interface WCScheduleProps {
  fixtures: WCFixture[];
  predictions: Record<string, WCPredictionSlot>;
  nowMs: number;
  /** WC-AI-PREVIEW (2026-06-02) — Gemini previews keyed by fixture id. */
  previews?: Record<string, WCMatchPreview>;
  /** WC-SCHEDULE-VITALITY-V2 — group letter ("A"..."L") per fixture id, knockouts omitted. */
  groupByFixtureId?: Record<string, string>;
  /** WC-SCHEDULE-VITALITY-V2 — signed-in user's 1X2 picks keyed by fixture id. */
  userPicks?: Record<string, WCPick>;
  /** WC-SCHEDULE-VITALITY-V2 — needed by the inline picker to render sign-in CTA for anon viewers. */
  isAuthed?: boolean;
}

function dateKey(iso: string): string {
  // Group by calendar day (UTC; matches engine convention).
  return iso.slice(0, 10);
}

function formatDayHeader(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TeamFlag({ logo, name, size = 16 }: { logo: string | null; name: string; size?: number }) {
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

// WC-SCHEDULE-VITALITY-V2: group letter shown on every group-stage row so the
// tournament narrative carries through the Schedule tab (was previously only
// visible inside the Groups tab). Knockouts have no letter — render a same-
// width spacer to keep alignment consistent down the column.
function GroupChip({ letter }: { letter: string | null }) {
  if (!letter) {
    return <span aria-hidden className="block size-5" />;
  }
  return (
    <span
      aria-label={`Group ${letter}`}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-[color:var(--color-tournament-gold)]/15 text-[10px] font-bold text-[color:var(--color-tournament-gold)]"
    >
      {letter}
    </span>
  );
}

// WC-SCHEDULE-VITALITY-V2: 3-band 1X2 probability bar. Replaces the three
// small grey percentage numbers — same data, but visible at a glance from
// across the room. Tournament-green = home, muted = draw, tournament-gold =
// away. Width of each band is exactly proportional to its probability so the
// favourite reads at a glance.
function ProbBar({ home, draw, away }: { home: number; draw: number; away: number }) {
  const total = home + draw + away;
  if (total <= 0) return null;
  const hPct = (home / total) * 100;
  const dPct = (draw / total) * 100;
  const aPct = (away / total) * 100;
  const fmt = (p: number) => `${Math.round(p * 100)}%`;
  return (
    <div
      title={`Home ${fmt(home)} · Draw ${fmt(draw)} · Away ${fmt(away)}`}
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]"
      role="img"
      aria-label={`Win probability: home ${fmt(home)}, draw ${fmt(draw)}, away ${fmt(away)}`}
    >
      <div className="bg-[color:var(--color-tournament-green)]/70" style={{ width: `${hPct}%` }} />
      <div className="bg-white/15" style={{ width: `${dPct}%` }} />
      <div className="bg-[color:var(--color-tournament-gold)]/70" style={{ width: `${aPct}%` }} />
    </div>
  );
}

export function WCSchedule({
  fixtures,
  predictions,
  nowMs,
  previews,
  groupByFixtureId,
  userPicks,
  isAuthed,
}: WCScheduleProps) {
  if (fixtures.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-card/40 p-6 text-center text-sm text-muted-foreground">
        Schedule not loaded yet — fixtures arrive daily.
      </div>
    );
  }

  // Group by date (chronological)
  const byDate = new Map<string, WCFixture[]>();
  for (const f of fixtures) {
    const k = dateKey(f.date);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(f);
  }
  const days = Array.from(byDate.keys()).sort();

  // Find the first day at or after "now" so mobile can scroll to it. Server-
  // rendered: we emit an `id` anchor; the client deep-link `#today` works.
  const todayKey = (() => {
    const today = new Date(nowMs).toISOString().slice(0, 10);
    return days.find((d) => d >= today) ?? days[0];
  })();

  return (
    <div className="space-y-6">
      {days.map((d) => {
        const dayFixtures = byDate.get(d) ?? [];
        const headerIso = dayFixtures[0]?.date ?? `${d}T00:00:00Z`;
        const isToday = d === todayKey;
        return (
          <section
            key={d}
            id={isToday ? "today" : undefined}
            className="space-y-2"
          >
            <header className="sticky top-[58px] z-10 -mx-4 border-y border-white/[0.06] bg-background/90 px-4 py-1.5 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base">
                  {formatDayHeader(headerIso)}
                </h3>
                <span className="text-[10px] text-muted-foreground sm:text-xs">
                  {dayFixtures.length} {dayFixtures.length === 1 ? "match" : "matches"}
                </span>
              </div>
            </header>

            <ul className="space-y-1.5">
              {dayFixtures.map((f) => {
                const p = predictions[f.id];
                const hasScore =
                  f.status === "finished" && f.scoreHome != null && f.scoreAway != null;
                const isLocked =
                  hasScore || new Date(f.date).getTime() <= nowMs;
                const preview = previews?.[f.id];
                const groupLetter = groupByFixtureId?.[f.id] ?? null;
                const hasProbs =
                  p?.homeProb != null && p.drawProb != null && p.awayProb != null;
                const modelPick = hasProbs ? modelPickFromTriple(p) : null;
                const userPick = userPicks?.[f.id] ?? null;
                return (
                  <li
                    key={f.id}
                    className="overflow-hidden rounded-lg border border-white/[0.06] bg-card/40 hover:border-white/[0.12]"
                  >
                    {/* Scan row — click anywhere here to open match detail.
                        Grid (not flex) so home and away cells always share
                        the same width centred on the "v" axis regardless of
                        team-name length. The 1fr-auto-1fr split is the trick
                        that kills the indentation drift the old layout had. */}
                    <Link
                      href={`/matches/${f.id}`}
                      className="wc-row-hover group grid min-h-[44px] grid-cols-[20px_44px_1fr_auto_1fr_auto] items-center gap-2 px-2.5 py-1.5 sm:grid-cols-[20px_56px_1fr_auto_1fr_auto] sm:gap-3 sm:px-3 sm:py-2"
                    >
                      <GroupChip letter={groupLetter} />

                      <div className="text-center font-mono text-[10px] text-muted-foreground sm:text-[11px]">
                        {hasScore ? (
                          <span className="font-semibold text-foreground">
                            {f.scoreHome}–{f.scoreAway}
                          </span>
                        ) : (
                          formatTime(f.date)
                        )}
                      </div>

                      <div className="flex min-w-0 items-center justify-end gap-1.5 text-right">
                        <span className="truncate text-xs text-foreground sm:text-sm">{f.home.name}</span>
                        <TeamFlag logo={f.home.logo} name={f.home.name} size={16} />
                      </div>

                      <span className="text-[9px] text-muted-foreground/60">v</span>

                      <div className="flex min-w-0 items-center gap-1.5">
                        <TeamFlag logo={f.away.logo} name={f.away.name} size={16} />
                        <span className="truncate text-xs text-foreground sm:text-sm">{f.away.name}</span>
                      </div>

                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                    </Link>

                    {/* Engagement strip — only renders when we have model probs.
                        Lives OUTSIDE the Link wrapper so the inline picker's
                        button clicks don't double-fire navigation. */}
                    {hasProbs && (
                      <div className="flex items-center gap-2.5 border-t border-white/[0.04] px-2.5 py-1.5 sm:gap-3 sm:px-3">
                        <ProbBar
                          home={p.homeProb!}
                          draw={p.drawProb!}
                          away={p.awayProb!}
                        />
                        {modelPick && (
                          <span
                            aria-label={`AI pick: ${modelPick === "1" ? f.home.name : modelPick === "2" ? f.away.name : "Draw"}`}
                            className="inline-flex shrink-0 items-center gap-1 rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
                          >
                            <span className="text-muted-foreground/70">AI</span>
                            <span className="text-foreground">
                              {modelPick === "1" ? "H" : modelPick === "2" ? "A" : "D"}
                            </span>
                          </span>
                        )}
                        <WCVsYouPicker
                          matchId={f.id}
                          homeName={f.home.name}
                          awayName={f.away.name}
                          initialPick={userPick}
                          isAuthed={!!isAuthed}
                          isLocked={isLocked}
                          modelPick={modelPick}
                          variant="compact"
                        />
                      </div>
                    )}

                    {/* Venue chip — desktop only, kept on its own thin row to
                        stop it pushing home/away widths around in the scan
                        row (the old layout's main alignment culprit). */}
                    {f.venueName && (
                      <div className="hidden items-center gap-1 border-t border-white/[0.04] px-3 py-1 text-[10px] text-muted-foreground/60 lg:flex">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">{f.venueName}</span>
                      </div>
                    )}

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
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
