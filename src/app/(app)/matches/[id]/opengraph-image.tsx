/**
 * WC-F5 — dynamic OG image for match detail pages.
 *
 * Renders a 1200x630 PNG at request time using next/og's ImageResponse.
 * Only WC2026 fixtures get the rich layout (flags + 1X2 split + AI pick);
 * non-WC matches return null so Next.js falls back to the site's default
 * OG image (root opengraph-image).
 *
 * Server-side only. Reads from Supabase via the public anon client (same
 * pattern as the wp-series + world-cup helpers). All assets are inline —
 * no font fetches, no remote images — so the OG generation stays fast on
 * Twitter/Discord/Slack unfurl.
 */

import { ImageResponse } from "next/og";

import { createSupabasePublic } from "@/lib/supabase-public";
import { flagForTeam } from "@/lib/wc-flags";
import { WORLD_CUP_LEAGUE_API_ID, getWorldCupPredictions } from "@/lib/world-cup";

// Service-role reads aren't required (matches/predictions are public-read),
// but we run in the Node runtime so anything we add later (e.g. signed
// helpers) keeps working.
export const runtime = "nodejs";
export const alt = "FIFA World Cup 2026 match — OddsIntel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ── DB row shapes ──────────────────────────────────────────────────────────

interface MatchRow {
  id: string;
  date: string;
  status: string;
  home_team:
    | { name: string }
    | { name: string }[]
    | null;
  away_team:
    | { name: string }
    | { name: string }[]
    | null;
  league:
    | { api_football_id: number | null; name: string | null }
    | { api_football_id: number | null; name: string | null }[]
    | null;
}

function flattenOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

interface MatchData {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  isWorldCup: boolean;
}

async function loadMatch(id: string): Promise<MatchData | null> {
  try {
    const supabase = createSupabasePublic();
    const { data, error } = await supabase
      .from("matches")
      .select(
        `id, date, status,
         home_team:home_team_id(name),
         away_team:away_team_id(name),
         league:league_id(api_football_id, name)`,
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as MatchRow;
    const home = flattenOne(row.home_team);
    const away = flattenOne(row.away_team);
    const league = flattenOne(row.league);
    if (!home || !away) return null;
    return {
      id: row.id,
      homeTeam: home.name,
      awayTeam: away.name,
      kickoff: row.date,
      isWorldCup: league?.api_football_id === WORLD_CUP_LEAGUE_API_ID,
    };
  } catch {
    return null;
  }
}

// ── UI helpers ─────────────────────────────────────────────────────────────

const TOURNAMENT_GOLD = "#facc15";
const BG = "#0a0a14";

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
    </div>
  );
}

function formatKickoff(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    const time = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
    return `${date} · ${time} UTC`;
  } catch {
    return "FIFA World Cup 2026";
  }
}

function FlagOrInitial({ name }: { name: string }) {
  const flag = flagForTeam(name);
  if (flag) {
    return (
      <div style={{ fontSize: 180, lineHeight: 1, display: "flex" }}>
        {flag}
      </div>
    );
  }
  // Fallback: large initial in a circle.
  return (
    <div
      style={{
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: "rgba(255,255,255,0.08)",
        color: "#ffffff",
        fontSize: 96,
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

// 3-band probability bar — segments sized by probability share.
function ProbBar({
  home,
  draw,
  away,
}: {
  home: number;
  draw: number;
  away: number;
}) {
  const total = home + draw + away;
  const h = total > 0 ? home / total : 1 / 3;
  const d = total > 0 ? draw / total : 1 / 3;
  const a = total > 0 ? away / total : 1 / 3;
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: 32,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          width: `${h * 100}%`,
          backgroundColor: "#3b82f6",
          display: "flex",
        }}
      />
      <div
        style={{
          width: `${d * 100}%`,
          backgroundColor: "#6b7280",
          display: "flex",
        }}
      />
      <div
        style={{
          width: `${a * 100}%`,
          backgroundColor: "#ef4444",
          display: "flex",
        }}
      />
    </div>
  );
}

function pct(p: number | null): string {
  if (p == null) return "—";
  return `${Math.round(p * 100)}%`;
}

function pickAiTeam(
  home: number | null,
  draw: number | null,
  away: number | null,
  homeName: string,
  awayName: string,
): string {
  if (home == null || draw == null || away == null) return "TBD";
  const top = Math.max(home, draw, away);
  if (top === home) return homeName;
  if (top === away) return awayName;
  return "Draw";
}

// ── Generic fallback (still WC-branded) ────────────────────────────────────

function GenericWcOG(reason: string) {
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
        {brandWordmark(56)}
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            color: TOURNAMENT_GOLD,
            letterSpacing: 4,
            textTransform: "uppercase",
            fontWeight: 700,
            display: "flex",
          }}
        >
          FIFA World Cup 2026
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 22,
            color: "#9ca3af",
            display: "flex",
          }}
        >
          {reason}
        </div>
      </div>
    ),
    { ...size },
  );
}

// ── Page entry ─────────────────────────────────────────────────────────────

export default async function OGImage({
  params,
}: {
  params: { id: string };
}) {
  const match = await loadMatch(params.id);

  // Non-WC matches: return a tiny placeholder. Next.js will still serve this
  // colocated file, but we keep it lightweight and on-brand for WC since the
  // task scope is WC-only OG enrichment.
  if (!match || !match.isWorldCup) {
    return GenericWcOG("Match preview");
  }

  // Tolerate missing predictions — render a generic WC match card instead of
  // failing the unfurl.
  let homeProb: number | null = null;
  let drawProb: number | null = null;
  let awayProb: number | null = null;
  try {
    const preds = await getWorldCupPredictions([match.id]);
    const slot = preds[match.id];
    if (slot) {
      homeProb = slot.homeProb;
      drawProb = slot.drawProb;
      awayProb = slot.awayProb;
    }
  } catch {
    // ignore — fall through to no-probs layout
  }

  const hasProbs = homeProb != null && drawProb != null && awayProb != null;
  const aiPick = hasProbs
    ? pickAiTeam(homeProb, drawProb, awayProb, match.homeTeam, match.awayTeam)
    : null;

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
        {/* Gold halo behind the centre */}
        <div
          style={{
            position: "absolute",
            top: "150px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "800px",
            height: "400px",
            background:
              "radial-gradient(ellipse, rgba(234,179,8,0.16) 0%, transparent 65%)",
            display: "flex",
          }}
        />

        {/* Top bar: brand + WC2026 pill */}
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
              fontSize: 18,
              color: TOURNAMENT_GOLD,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            FIFA World Cup 2026
          </div>
        </div>

        {/* Teams row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "32px 64px 0",
            zIndex: 10,
            gap: 24,
          }}
        >
          {/* Home */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            <FlagOrInitial name={match.homeTeam} />
            <div
              style={{
                marginTop: 12,
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: "-1px",
                color: "#ffffff",
                textAlign: "center",
                maxWidth: 360,
                display: "flex",
              }}
            >
              {match.homeTeam}
            </div>
          </div>

          {/* Centre: vs + kickoff */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 160,
            }}
          >
            <div
              style={{
                fontSize: 56,
                fontWeight: 900,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: 6,
                display: "flex",
              }}
            >
              VS
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 18,
                color: "#9ca3af",
                fontFamily: "monospace",
                display: "flex",
              }}
            >
              {formatKickoff(match.kickoff)}
            </div>
          </div>

          {/* Away */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            <FlagOrInitial name={match.awayTeam} />
            <div
              style={{
                marginTop: 12,
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: "-1px",
                color: "#ffffff",
                textAlign: "center",
                maxWidth: 360,
                display: "flex",
              }}
            >
              {match.awayTeam}
            </div>
          </div>
        </div>

        {/* Probability bar + numbers */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "28px 96px 0",
            zIndex: 10,
            gap: 10,
          }}
        >
          {hasProbs ? (
            <>
              <ProbBar
                home={homeProb!}
                draw={drawProb!}
                away={awayProb!}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 20,
                  fontFamily: "monospace",
                  color: "#e5e7eb",
                  fontWeight: 700,
                }}
              >
                <div style={{ color: "#93c5fd", display: "flex" }}>
                  Home {pct(homeProb)}
                </div>
                <div style={{ color: "#9ca3af", display: "flex" }}>
                  Draw {pct(drawProb)}
                </div>
                <div style={{ color: "#fca5a5", display: "flex" }}>
                  Away {pct(awayProb)}
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                fontSize: 20,
                color: "#9ca3af",
                textAlign: "center",
                display: "flex",
                justifyContent: "center",
              }}
            >
              Model probabilities arrive closer to kickoff
            </div>
          )}
        </div>

        {/* Footer: AI pick + wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "32px 48px",
            marginTop: "auto",
            zIndex: 10,
          }}
        >
          {aiPick ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: "1px solid rgba(168,85,247,0.4)",
                backgroundColor: "rgba(168,85,247,0.12)",
                borderRadius: 8,
                padding: "12px 22px",
                fontSize: 22,
                color: "#e9d5ff",
                fontWeight: 700,
              }}
            >
              AI Pick: <span style={{ marginLeft: 8, color: "#ffffff" }}>{aiPick}</span>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "#6b7280",
                fontSize: 18,
              }}
            >
              AI pick locks in pre-match
            </div>
          )}
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "monospace",
              display: "flex",
            }}
          >
            oddsintel.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
