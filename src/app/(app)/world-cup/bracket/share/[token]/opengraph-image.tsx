import { ImageResponse } from "next/og";

import { flagForTeam } from "@/lib/wc-flags";
import { loadBracketByShareToken, loadTeamsByIds, isBracketLocked } from "@/lib/wc-bracket";

// Node runtime — we use service-role Supabase reads inside loadBracketByShareToken,
// and SUPABASE_SECRET_KEY isn't surfaced to the edge runtime by default.
export const runtime = "nodejs";
export const alt = "World Cup 2026 bracket — OddsIntel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function ownerLabel(displayName: string | null): string {
  return displayName?.trim() || "Anonymous bracket";
}

function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

export default async function OGImage({
  params,
}: {
  params: { token: string };
}) {
  const shared = await loadBracketByShareToken(params.token);

  // Fallback image — keep platform unfurl pleasant even if the token is bad.
  if (!shared) {
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
            backgroundColor: "#0a0a14",
            color: "#e5e7eb",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-1px" }}>
            ODDS<span style={{ color: "#22c55e" }}>INTEL</span>
          </div>
          <div style={{ marginTop: 24, fontSize: 28, color: "#9ca3af" }}>
            Bracket link expired
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const championPick = shared.picks.find((p) => p.round === "champion");
  const teamMap = championPick
    ? await loadTeamsByIds([championPick.pickedTeamId])
    : {};
  const champion = championPick ? teamMap[championPick.pickedTeamId] : undefined;
  const championFlag = champion ? flagForTeam(champion.name) : null;
  const championName = champion?.name ?? "Pick locked";

  const owner = ownerLabel(shared.displayName);
  const ownerHeadline = `${possessive(owner)} World Cup 2026 bracket`;

  const locked = isBracketLocked();
  const scoreLine = locked
    ? `Score ${shared.meta.currentScore}` +
      (shared.meta.currentRank != null
        ? ` · #${shared.meta.currentRank}${shared.totalBrackets > 0 ? ` of ${shared.totalBrackets}` : ""}`
        : "")
    : "Locked in";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a14",
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
          }}
        />
        {/* Gold halo behind the champion */}
        <div
          style={{
            position: "absolute",
            top: "120px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "800px",
            height: "500px",
            background:
              "radial-gradient(ellipse, rgba(234,179,8,0.18) 0%, transparent 65%)",
          }}
        />

        {/* Top bar: brand + score pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "32px 48px 0",
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: "-1px",
              fontStyle: "italic",
              color: "#ffffff",
            }}
          >
            ODDS<span style={{ color: "#22c55e" }}>INTEL</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid rgba(234,179,8,0.4)",
              backgroundColor: "rgba(234,179,8,0.12)",
              borderRadius: 100,
              padding: "8px 18px",
              fontSize: 20,
              color: "#fde047",
              fontWeight: 700,
            }}
          >
            {scoreLine}
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            padding: "16px 48px 0",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: 2,
              fontWeight: 700,
            }}
          >
            FIFA World Cup 2026 Bracket
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: "-1px",
              color: "#ffffff",
              lineHeight: 1.1,
            }}
          >
            {ownerHeadline}
          </div>
        </div>

        {/* Champion block — centred big */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            marginTop: -20,
          }}
        >
          <div
            style={{
              fontSize: 16,
              color: "#fde047",
              letterSpacing: 3,
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Champion pick
          </div>
          {championFlag && (
            <div style={{ fontSize: 200, lineHeight: 1, marginTop: 8 }}>
              {championFlag}
            </div>
          )}
          <div
            style={{
              marginTop: 8,
              fontSize: 72,
              fontWeight: 900,
              letterSpacing: "-2px",
              color: "#ffffff",
            }}
          >
            {championName}
          </div>
          {shared.meta.goldenBootPlayer && (
            <div
              style={{
                marginTop: 16,
                fontSize: 22,
                color: "#9ca3af",
              }}
            >
              Golden Boot:{" "}
              <span style={{ color: "#e5e7eb", fontWeight: 700 }}>
                {shared.meta.goldenBootPlayer}
              </span>
            </div>
          )}
        </div>

        {/* Footer — CTA + domain */}
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
              border: "1px solid rgba(34,197,94,0.4)",
              backgroundColor: "rgba(34,197,94,0.12)",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 20,
              color: "#86efac",
              fontWeight: 700,
            }}
          >
            Make your own — top 3 win 1 month Elite
          </div>
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "monospace",
            }}
          >
            oddsintel.app/world-cup/bracket
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
