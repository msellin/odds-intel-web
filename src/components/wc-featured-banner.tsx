"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";

import { flagForTeam } from "@/lib/wc-flags";
import { WCCountdown } from "./wc-countdown";

interface WCFeaturedBannerProps {
  matchId: string;
  homeName: string;
  homeLogo: string | null;
  awayName: string;
  awayLogo: string | null;
  kickoffIso: string;
  venueName: string | null;
  predictionTriple: { home: number; draw: number; away: number } | null;
  /** Optional supplemental copy shown when expanded (e.g. group standings). */
  expandedDetail?: React.ReactNode;
}

function TeamCrest({ logo, name, size = 24 }: { logo: string | null; name: string; size?: number }) {
  const flag = flagForTeam(name);
  if (flag) {
    return (
      <span aria-hidden className="inline-block leading-none" style={{ fontSize: size }}>
        {flag}
      </span>
    );
  }
  if (logo) {
    return (
      <span className="relative inline-block overflow-hidden rounded-full bg-white/[0.06]" style={{ width: size, height: size }}>
        <Image src={logo} alt={name} fill sizes="24px" className="object-contain p-0.5" unoptimized />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-bold"
      style={{ width: size, height: size }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Sticky banner pinning the next WC match (within 48h). On mobile collapses
 * to a single line; tap-to-expand for venue, prediction triple, group context.
 * Layout works at 375px width — flex gap-2, text-xs on mobile, scales up on sm+.
 */
export function WCFeaturedBanner(props: WCFeaturedBannerProps) {
  const [expanded, setExpanded] = useState(false);
  // Allow the banner to fade in on mount rather than flash.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pct = (v: number) => Math.round(v * 100);

  return (
    <div
      className={`sticky top-0 z-30 -mx-4 sm:mx-0 ${mounted ? "wc-fade-in" : "opacity-0"}`}
      role="region"
      aria-label="Featured upcoming World Cup match"
    >
      <div className="relative overflow-hidden border-b border-[color:var(--color-tournament-gold)]/30 bg-gradient-to-r from-card/95 via-card/90 to-card/95 px-4 py-2 backdrop-blur-md sm:rounded-b-xl sm:border-x sm:border-x-white/[0.06]">
        {/* gold accent stripe */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-tournament-gold)] to-transparent" />

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="wc-featured-detail"
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="hidden shrink-0 rounded bg-[color:var(--color-tournament-gold)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[color:var(--color-tournament-gold)] sm:inline">
              Next up
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs sm:text-sm">
              <TeamCrest logo={props.homeLogo} name={props.homeName} size={18} />
              <span className="truncate font-semibold text-foreground">{props.homeName}</span>
              <span className="text-muted-foreground/60">v</span>
              <span className="truncate font-semibold text-foreground">{props.awayName}</span>
              <TeamCrest logo={props.awayLogo} name={props.awayName} size={18} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <WCCountdown targetIso={props.kickoffIso} variant="inline" liveLabel="Live" />
            {expanded ? (
              <ChevronUp className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div
            id="wc-featured-detail"
            className="mt-2 grid grid-cols-1 gap-3 border-t border-white/[0.06] pt-2 text-xs sm:grid-cols-3 wc-fade-in"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Venue</span>
              <span className="inline-flex items-center gap-1 text-foreground">
                <MapPin className="size-3 text-muted-foreground" />
                {props.venueName ?? "TBD"}
              </span>
            </div>
            {props.predictionTriple && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Our model
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-foreground">
                  <span>{props.homeName.slice(0, 3).toUpperCase()} {pct(props.predictionTriple.home)}%</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>X {pct(props.predictionTriple.draw)}%</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{props.awayName.slice(0, 3).toUpperCase()} {pct(props.predictionTriple.away)}%</span>
                </span>
              </div>
            )}
            {props.expandedDetail && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Standings
                </span>
                <div className="text-foreground">{props.expandedDetail}</div>
              </div>
            )}
            <div className="sm:col-span-3">
              <Link
                href={`/matches/${props.matchId}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--color-tournament-green)] hover:underline"
              >
                Full match intel →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
