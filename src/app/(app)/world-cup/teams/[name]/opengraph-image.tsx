/**
 * WC-F5 — dynamic OG image for /world-cup/teams/[name].
 *
 * 1200x630 PNG rendered server-side via next/og. Surfaces the team's flag,
 * name, group label, model ELO, and the group-stage advancement probability
 * from the same Monte Carlo helper the team page renders.
 *
 * Tolerates missing data — if the slug isn't a WC nation we fall back to a
 * branded placeholder rather than failing the unfurl.
 */

import { ImageResponse } from "next/og";

import { flagForTeam } from "@/lib/wc-flags";
import {
  getWorldCupFixtures,
  getWorldCupPredictions,
  getInternationalElos,
  deriveGroups,
  computeAdvancement,
} from "@/lib/world-cup";
import type { WCGroup, WCTeam } from "@/lib/world-cup";

export const runtime = "nodejs";
export const alt = "FIFA World Cup 2026 team — OddsIntel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TOURNAMENT_GOLD = "#facc15";
const BG = "#0a0a14";

// Same slug helper as the team detail page — kept inline to avoid coupling
// the OG file to the page module (which has heavy server imports).
function slugifyTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[''']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface TeamOgContext {
  team: WCTeam;
  group: WCGroup | null;
  elo: number | null;
  pAdvance: number | null;
}

async function loadTeamOgContext(slug: string): Promise<TeamOgContext | null> {
  try {
    const fixtures = await getWorldCupFixtures();
    if (fixtures.length === 0) return null;

    const teamsBySlug = new Map<string, WCTeam>();
    for (const f of fixtures) {
      for (const t of [f.home, f.away]) {
        const s = slugifyTeam(t.name);
        if (!teamsBySlug.has(s)) teamsBySlug.set(s, t);
      }
    }
    const team = teamsBySlug.get(slug);
    if (!team) return null;

    const groups = deriveGroups(fixtures);
    const group = groups.find((g) =>
      g.teams.some((t) => t.id === team.id),
    ) ?? null;

    const elos = await getInternationalElos([team.id]);
    const elo = elos[team.id] ?? null;

    // Advancement: only meaningful when we have a group + at least some elos
    // across the whole tournament. We pull elos for every team in the group
    // so the simulation has fallback priors.
    let pAdvance: number | null = null;
    if (group) {
      const allGroupTeamIds = groups.flatMap((g) => g.teams.map((t) => t.id));
      const elosForSim = await getInternationalElos(allGroupTeamIds);
      const fixtureIds = groups.flatMap((g) => g.fixtures.map((f) => f.id));
      const predictions = await getWorldCupPredictions(fixtureIds);
      // Use a smaller iteration count than the page (3k vs 10k) since OG
      // generation needs to stay under a couple seconds on cold cache.
      const advancement = computeAdvancement(groups, predictions, elosForSim, 3000);
      pAdvance = advancement[team.id]?.pAdvance ?? null;
    }

    return { team, group, elo, pAdvance };
  } catch {
    return null;
  }
}

function brandWordmark(fontSize: number) {
  return (
    <div
      style={{
        fontSize,
        fontWeight: 900,
        letterSpacing: "-1px",
        fontStyle: "italic",
        color: "#ffffff",
        display: "flex",
      }}
    >
      ODDS<span style={{ color: "#22c55e" }}>INTEL</span>
      <span
        style={{
          marginLeft: 12,
          color: TOURNAMENT_GOLD,
          fontStyle: "normal",
          fontSize: fontSize * 0.55,
          letterSpacing: 3,
          alignSelf: "center",
          display: "flex",
        }}
      >
        WC2026
      </span>
    </div>
  );
}

function FlagOrInitial({ name }: { name: string }) {
  const flag = flagForTeam(name);
  if (flag) {
    return (
      <div style={{ fontSize: 280, lineHeight: 1, display: "flex" }}>
        {flag}
      </div>
    );
  }
  return (
    <div
      style={{
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: "rgba(255,255,255,0.08)",
        color: "#ffffff",
        fontSize: 132,
        fontWeight: 900,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function GenericTeamOG(message: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BG,
          color: "#e5e7eb",
          fontFamily: "sans-serif",
        }}
      >
        {brandWordmark(48)}
        <div
          style={{
            marginTop: 24,
            fontSize: 26,
            color: "#9ca3af",
            display: "flex",
          }}
        >
          {message}
        </div>
      </div>
    ),
    { ...size },
  );
}

export default async function OGImage({
  params,
}: {
  params: { name: string };
}) {
  const ctx = await loadTeamOgContext(params.name);
  if (!ctx) {
    return GenericTeamOG("World Cup 2026 — team preview");
  }

  const { team, group, elo, pAdvance } = ctx;
  const groupLabel = group ? `Group ${group.label}` : "Group TBD";
  const eloLabel = elo != null ? `${Math.round(elo)}` : "—";
  const advanceLabel =
    pAdvance != null ? `${Math.round(pAdvance * 100)}%` : "—";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG,
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
          color: "#e5e7eb",
        }}
      >
        {/* Pitch-line grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(34,197,94,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            display: "flex",
          }}
        />
        {/* Gold halo */}
        <div
          style={{
            position: "absolute",
            top: "100px",
            left: "20%",
            width: "700px",
            height: "500px",
            background:
              "radial-gradient(ellipse, rgba(234,179,8,0.18) 0%, transparent 65%)",
            display: "flex",
          }}
        />

        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "32px 48px 0",
            zIndex: 10,
          }}
        >
          {brandWordmark(34)}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid rgba(250,204,21,0.4)",
              backgroundColor: "rgba(250,204,21,0.12)",
              borderRadius: 100,
              padding: "8px 18px",
              fontSize: 20,
              color: TOURNAMENT_GOLD,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            {groupLabel}
          </div>
        </div>

        {/* Main row: flag left, identity right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "20px 64px 0",
            zIndex: 10,
            gap: 48,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FlagOrInitial name={team.name} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 18,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: 3,
                fontWeight: 700,
                display: "flex",
              }}
            >
              FIFA World Cup 2026
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 84,
                fontWeight: 900,
                letterSpacing: "-2px",
                color: "#ffffff",
                lineHeight: 1,
                display: "flex",
              }}
            >
              {team.name}
            </div>

            {/* Stat tiles */}
            <div
              style={{
                marginTop: 28,
                display: "flex",
                gap: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid rgba(255,255,255,0.10)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderRadius: 14,
                  padding: "14px 22px",
                  minWidth: 180,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    fontWeight: 700,
                    display: "flex",
                  }}
                >
                  Model ELO
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 44,
                    fontWeight: 900,
                    color: "#ffffff",
                    fontFamily: "monospace",
                    display: "flex",
                  }}
                >
                  {eloLabel}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid rgba(34,197,94,0.35)",
                  backgroundColor: "rgba(34,197,94,0.10)",
                  borderRadius: 14,
                  padding: "14px 22px",
                  minWidth: 220,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: "#86efac",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    fontWeight: 700,
                    display: "flex",
                  }}
                >
                  Advance from group
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 44,
                    fontWeight: 900,
                    color: "#ffffff",
                    fontFamily: "monospace",
                    display: "flex",
                  }}
                >
                  {advanceLabel}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 48px 32px",
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "#9ca3af",
              display: "flex",
            }}
          >
            Schedule · group standings · advancement %
          </div>
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "monospace",
              display: "flex",
            }}
          >
            oddsintel.app/world-cup
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
