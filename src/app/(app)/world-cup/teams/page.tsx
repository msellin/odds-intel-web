export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Trophy } from "lucide-react";

import { flagForTeam } from "@/lib/wc-flags";
import { getWorldCupFixtures, deriveGroups } from "@/lib/world-cup";

export const metadata: Metadata = {
  title: "FIFA World Cup 2026 — All 48 Teams | OddsIntel",
  description:
    "Browse every nation playing at FIFA World Cup 2026 — squad ratings, group, fixtures, and model predictions per team.",
  alternates: { canonical: "https://oddsintel.app/world-cup/teams" },
  openGraph: {
    title: "FIFA World Cup 2026 — All 48 Teams",
    description: "Every nation at WC 2026 with AI predictions, ratings, and fixtures.",
    url: "https://oddsintel.app/world-cup/teams",
    type: "website",
  },
};

function slugifyTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function TeamFlag({ logo, name, size = 28 }: { logo: string | null; name: string; size?: number }) {
  const flag = flagForTeam(name);
  if (flag) {
    return (
      <span aria-hidden className="leading-none" style={{ fontSize: size, lineHeight: 1 }}>
        {flag}
      </span>
    );
  }
  if (logo) {
    return (
      <span className="relative shrink-0 overflow-hidden rounded-full bg-white/[0.06]" style={{ width: size, height: size }}>
        <Image src={logo} alt="" fill sizes="32px" className="object-contain p-0.5" unoptimized />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-bold text-muted-foreground"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default async function WorldCupTeamsIndexPage() {
  const fixtures = await getWorldCupFixtures();
  const groups = deriveGroups(fixtures);

  // Map team_id → group letter so each card can show the team's group.
  const groupByTeamId = new Map<string, string>();
  for (const g of groups) {
    for (const t of g.teams) {
      groupByTeamId.set(t.id, g.label);
    }
  }

  // Unique team set from fixtures.
  const teams = (() => {
    const seen = new Map<string, { id: string; name: string; logo: string | null }>();
    for (const f of fixtures) {
      if (!seen.has(f.home.id)) seen.set(f.home.id, { id: f.home.id, name: f.home.name, logo: f.home.logo });
      if (!seen.has(f.away.id)) seen.set(f.away.id, { id: f.away.id, name: f.away.name, logo: f.away.logo });
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero */}
      <section className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trophy className="size-3.5 text-[color:var(--color-tournament-gold)] sm:size-4" />
          <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
            All 48 teams
          </span>
        </div>
        <h1 className="mt-1 text-xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">
          FIFA World Cup 2026 — Teams
        </h1>
        <p className="mt-1 max-w-md text-xs text-muted-foreground sm:text-sm">
          {teams.length} nations · click any team to see their group, fixtures, model rating, and recent form.
        </p>
        <Link
          href="/world-cup"
          className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:text-sm"
        >
          ← Back to World Cup hub
        </Link>
      </section>

      {/* Grid — 2 cols mobile, 3 cols sm, 4 cols md, 6 cols lg. Card per team. */}
      <section
        aria-label="All World Cup 2026 nations"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6"
      >
        {teams.map((t) => {
          const slug = slugifyTeamName(t.name);
          const letter = groupByTeamId.get(t.id) ?? null;
          return (
            <Link
              key={t.id}
              href={`/world-cup/teams/${slug}`}
              className="group flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-card/40 px-3 py-2.5 transition-colors hover:border-[color:var(--color-tournament-gold)]/40 hover:bg-card/60 sm:px-3.5 sm:py-3"
            >
              <TeamFlag logo={t.logo} name={t.name} size={26} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground group-hover:text-[color:var(--color-tournament-gold)] sm:text-sm">
                  {t.name}
                </p>
                {letter ? (
                  <p className="text-[10px] text-muted-foreground/70 sm:text-[11px]">
                    Group {letter}
                  </p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </section>

      {teams.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-6 text-center text-sm text-muted-foreground">
          Team list not loaded yet — fixtures arrive daily.
        </div>
      )}
    </div>
  );
}
