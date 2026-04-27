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

  const updateParams = useCallback(
    (newLeagues: Set<string>) => {
      const params = new URLSearchParams(searchParams.toString());

      const allNames = leagues.map((l) => l.name);
      if (newLeagues.size === allNames.length) {
        params.delete("leagues");
      } else {
        params.set("leagues", Array.from(newLeagues).join(","));
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
    updateParams(next);
  };

  const selectAll = () => {
    updateParams(new Set(leagues.map((l) => l.name)));
  };

  const deselectAll = () => {
    updateParams(new Set());
  };

  const allSelected = selectedLeagues.size === leagues.length;

  const sortedLeagues = useMemo(
    () => [...leagues].sort((a, b) => a.name.localeCompare(b.name)),
    [leagues]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Leagues
        </span>
        <button
          onClick={allSelected ? deselectAll : selectAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

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
