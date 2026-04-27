"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import { getCountryFlag } from "@/lib/country-flags";

interface LeagueInfo {
  name: string;
  tier: number;
}

interface LeagueFilterProps {
  leagues: LeagueInfo[];
}

export function LeagueFilter({ leagues }: LeagueFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedLeagues = useMemo(() => {
    const param = searchParams.get("leagues");
    if (!param) return new Set(leagues.map((l) => l.name));
    return new Set(param.split(",").filter(Boolean));
  }, [searchParams, leagues]);

  const tierFilter = searchParams.get("tier") ?? "all";

  const updateParams = useCallback(
    (newLeagues: Set<string>, newTier: string) => {
      const params = new URLSearchParams(searchParams.toString());

      // Only set leagues param if not all selected
      const allNames = leagues.map((l) => l.name);
      if (newLeagues.size === allNames.length) {
        params.delete("leagues");
      } else {
        params.set("leagues", Array.from(newLeagues).join(","));
      }

      if (newTier === "all") {
        params.delete("tier");
      } else {
        params.set("tier", newTier);
      }

      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, leagues, router, pathname]
  );

  const toggleLeague = (league: string) => {
    const next = new Set(selectedLeagues);
    if (next.has(league)) {
      next.delete(league);
    } else {
      next.add(league);
    }
    updateParams(next, tierFilter);
  };

  const selectAll = () => {
    updateParams(new Set(leagues.map((l) => l.name)), tierFilter);
  };

  const deselectAll = () => {
    updateParams(new Set(), tierFilter);
  };

  const allSelected = selectedLeagues.size === leagues.length;

  const setTier = (tier: string) => {
    if (tier === "all") {
      updateParams(new Set(leagues.map((l) => l.name)), "all");
    } else {
      const tierNum = parseInt(tier);
      const tierLeagues = leagues
        .filter((l) => l.tier === tierNum)
        .map((l) => l.name);
      updateParams(new Set(tierLeagues), tier);
    }
  };

  // Sort leagues: tier 1 first, then tier 2, then alphabetically
  const sortedLeagues = useMemo(
    () => [...leagues].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)),
    [leagues]
  );

  const hasTier1 = leagues.some((l) => l.tier === 1);
  const hasTier2 = leagues.some((l) => l.tier === 2);
  const hasTier3 = leagues.some((l) => l.tier === 3);

  return (
    <div className="space-y-3">
      {/* Tier quick-filter buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Filter:
        </span>
        <button
          onClick={() => setTier("all")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            tierFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          All Tiers
        </button>
        {hasTier1 && (
          <button
            onClick={() => setTier("1")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tierFilter === "1"
                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Tier 1
          </button>
        )}
        {hasTier2 && (
          <button
            onClick={() => setTier("2")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tierFilter === "2"
                ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Tier 2
          </button>
        )}
        {hasTier3 && (
          <button
            onClick={() => setTier("3")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tierFilter === "3"
                ? "bg-zinc-500/20 text-zinc-400 ring-1 ring-zinc-500/30"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Tier 3
          </button>
        )}

        <div className="ml-auto">
          <button
            onClick={allSelected ? deselectAll : selectAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        </div>
      </div>

      {/* League pills */}
      <div className="flex flex-wrap gap-1.5">
        {sortedLeagues.map((league) => {
          const active = selectedLeagues.has(league.name);
          return (
            <button
              key={league.name}
              onClick={() => toggleLeague(league.name)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted/50 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
              }`}
            >
              <span className="text-sm leading-none">
                {getCountryFlag(league.name)}
              </span>
              {league.name.split(" / ").pop()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
