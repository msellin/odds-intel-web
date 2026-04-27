"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Search } from "lucide-react";

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
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const updateLeagues = useCallback(
    (filtered: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (filtered.length === leagues.length || filtered.length === 0) {
        params.delete("leagues");
      } else {
        params.set("leagues", filtered.join(","));
      }
      const qs = params.toString();
      startTransition(() => {
        router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
      });
    },
    [searchParams, leagues, router, pathname]
  );

  const handleChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      // Clear filter — show all leagues
      const params = new URLSearchParams(searchParams.toString());
      params.delete("leagues");
      const qs = params.toString();
      startTransition(() => {
        router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
      });
      return;
    }
    const lower = value.toLowerCase();
    const matched = leagues
      .map((l) => l.name)
      .filter((name) => name.toLowerCase().includes(lower));
    updateLeagues(matched);
  };

  return (
    <div className="relative w-full sm:w-64">
      <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Filter by league..."
        className="w-full rounded-lg border border-white/[0.06] bg-muted/30 py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-green-500/40 focus:outline-none transition-colors"
      />
    </div>
  );
}
