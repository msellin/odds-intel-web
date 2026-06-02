export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, Lock, ChevronLeft, Sparkles } from "lucide-react";

import { flagForTeam } from "@/lib/wc-flags";
import {
  loadBracketByShareToken,
  loadTeamsByIds,
} from "@/lib/wc-bracket";
import {
  ROUNDS_ORDER,
  ROUND_LABELS,
  ROUND_POINTS,
  ROUND_SLOTS,
  type BracketRound,
} from "@/lib/wc-bracket-types";
import { isBracketLocked } from "@/lib/wc-bracket";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oddsintel.app";

function ownerLabel(displayName: string | null): string {
  return displayName?.trim() || "Anonymous bracket";
}

function possessive(name: string): string {
  // "Joe" -> "Joe's", "Chris" -> "Chris'" — common-case heuristic, fine for OG copy.
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const shared = await loadBracketByShareToken(token);

  if (!shared) {
    return {
      title: "Bracket not found — OddsIntel",
      description: "This World Cup 2026 bracket link is no longer valid.",
    };
  }

  const owner = ownerLabel(shared.displayName);
  const championPick = shared.picks.find((p) => p.round === "champion");
  const teamMap = championPick
    ? await loadTeamsByIds([championPick.pickedTeamId])
    : {};
  const champion = championPick ? teamMap[championPick.pickedTeamId] : undefined;
  const championName = champion?.name ?? "their pick";

  const title = `${possessive(owner)} World Cup 2026 bracket — OddsIntel`;
  const description = `${owner} picks ${championName} to win World Cup 2026. Make your own bracket and compete for free Elite access.`;
  const url = `${SITE}/world-cup/bracket/share/${token}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "OddsIntel",
      // Note: opengraph-image.tsx co-located in this folder is auto-attached
      // by Next 15 — we don't need to repeat it here.
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SharedBracketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await loadBracketByShareToken(token);
  if (!shared) notFound();

  const ids = shared.picks.map((p) => p.pickedTeamId);
  const teamMap = await loadTeamsByIds(ids);

  const owner = ownerLabel(shared.displayName);
  const championPick = shared.picks.find((p) => p.round === "champion");
  const champion = championPick ? teamMap[championPick.pickedTeamId] : undefined;
  const championName = champion?.name ?? null;
  const championFlag = champion ? flagForTeam(champion.name) : null;
  const locked = isBracketLocked();

  // Pre-tournament: show "Locked in". Mid/post-tournament: show score + rank.
  const showScore = locked;

  return (
    <div className="space-y-4 pb-12 sm:space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          href="/world-cup/bracket"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ChevronLeft className="size-3" />
          Bracket Challenge
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground">Shared</span>
      </div>

      <header className="overflow-hidden rounded-2xl border border-[color:var(--color-tournament-gold)]/20 bg-gradient-to-br from-card via-card to-[color:var(--color-tournament-gold)]/5 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trophy className="size-4 text-[color:var(--color-tournament-gold)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
            Shared Bracket
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          {possessive(owner)} World Cup 2026 bracket
        </h1>

        {champion && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-[color:var(--color-tournament-gold)]/30 bg-[color:var(--color-tournament-gold)]/10 px-4 py-3">
            {championFlag && (
              <span aria-hidden className="text-3xl leading-none">
                {championFlag}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-tournament-gold)]">
                Champion pick
              </p>
              <p className="truncate text-lg font-bold text-foreground">
                {championName}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {showScore ? (
            <>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-semibold text-primary">
                Score: {shared.meta.currentScore}
              </span>
              {shared.meta.currentRank != null && (
                <span className="text-muted-foreground">
                  Rank #{shared.meta.currentRank}
                  {shared.totalBrackets > 0 && ` of ${shared.totalBrackets}`}
                </span>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 font-semibold text-amber-300">
              <Lock className="size-3" />
              Locked in
            </span>
          )}
          {shared.meta.goldenBootPlayer && (
            <span className="text-muted-foreground">
              Golden Boot:{" "}
              <span className="text-foreground">{shared.meta.goldenBootPlayer}</span>
            </span>
          )}
        </div>
      </header>

      {/* CTA — make your own */}
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 sm:p-5">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" />
              Your turn
            </p>
            <p className="text-sm text-foreground">
              Make your own bracket. Top 3 win 1 month Elite — free.
            </p>
          </div>
          <Link
            href="/world-cup/bracket"
            className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            <Trophy className="size-4" />
            Make your bracket
          </Link>
        </div>
      </div>

      {/* Read-only bracket — same shape per round as the editor, no inputs */}
      <div className="space-y-4">
        {ROUNDS_ORDER.map((round) => (
          <RoundBlock
            key={round}
            round={round}
            picks={shared.picks}
            teamMap={teamMap}
          />
        ))}
      </div>
    </div>
  );
}

function RoundBlock({
  round,
  picks,
  teamMap,
}: {
  round: BracketRound;
  picks: { round: BracketRound; position: number; pickedTeamId: string }[];
  teamMap: Record<string, { id: string; name: string }>;
}) {
  const slots = ROUND_SLOTS[round];
  const isChampion = round === "champion";

  return (
    <section className="rounded-xl border border-white/[0.06] bg-card/40 p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {ROUND_LABELS[round]}
        </h4>
        <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
          +{ROUND_POINTS[round]}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {Array.from({ length: slots }).map((_, position) => {
          const pick = picks.find(
            (p) => p.round === round && p.position === position
          );
          const team = pick ? teamMap[pick.pickedTeamId] : undefined;
          const flag = team ? flagForTeam(team.name) : null;
          return (
            <div
              key={position}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-2 text-xs ${
                team
                  ? isChampion
                    ? "border-[color:var(--color-tournament-gold)]/40 bg-[color:var(--color-tournament-gold)]/10 text-foreground"
                    : "border-white/[0.08] bg-card/60 text-foreground"
                  : "border-dashed border-white/[0.06] bg-background/40 text-muted-foreground/40"
              }`}
            >
              {flag ? (
                <span aria-hidden className="shrink-0 text-base leading-none">
                  {flag}
                </span>
              ) : (
                <span className="size-4 shrink-0 rounded-full bg-white/[0.08]" />
              )}
              <span className="truncate">
                {team?.name ?? "—"}
              </span>
              {isChampion && team && (
                <Trophy className="ml-auto size-3 text-[color:var(--color-tournament-gold)]" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
