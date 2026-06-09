import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "World Cup 2026 Bracket Challenge — Beat 5 AIs on OddsIntel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0a14";
const GOLD = "#facc15";

// Five named AI competitors that already sit on the WC bracket leaderboard.
// Static — must match scripts/generate_ai_brackets.py AI_STRATEGIES.
const AIS: { label: string; tone: string }[] = [
  { label: "Elite AI", tone: "#a78bfa" },
  { label: "Pro AI", tone: "#60a5fa" },
  { label: "Free AI", tone: "#34d399" },
  { label: "Market", tone: "#fbbf24" },
  { label: "Chalk", tone: "#94a3b8" },
];

export default function OGImage() {
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
          color: "#e5e7eb",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Pitch grid */}
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
            top: "-100px",
            right: "-180px",
            width: "700px",
            height: "500px",
            background:
              "radial-gradient(ellipse, rgba(250,204,21,0.20) 0%, transparent 65%)",
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
          <div
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: "-1px",
              fontStyle: "italic",
              color: "#ffffff",
              display: "flex",
            }}
          >
            ODDS<span style={{ color: "#22c55e" }}>INTEL</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid rgba(250,204,21,0.4)",
              backgroundColor: "rgba(250,204,21,0.12)",
              borderRadius: 100,
              padding: "8px 18px",
              fontSize: 16,
              color: GOLD,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            World Cup 2026 · Bracket
          </div>
        </div>

        {/* Hero */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            flex: 1,
            zIndex: 10,
            padding: "0 64px",
          }}
        >
          <div
            style={{
              fontSize: 26,
              color: "#9ca3af",
              letterSpacing: 4,
              textTransform: "uppercase",
              fontWeight: 700,
              display: "flex",
            }}
          >
            The Bracket Challenge
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: "-3px",
              color: "#ffffff",
              lineHeight: 0.95,
              display: "flex",
            }}
          >
            Beat 5 AIs.
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: "-1px",
              color: GOLD,
              lineHeight: 1,
              display: "flex",
            }}
          >
            Stage by stage. Free to play.
          </div>

          {/* AI ghost row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 36,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 18,
                color: "#6b7280",
                marginRight: 4,
                display: "flex",
              }}
            >
              Already on the leaderboard:
            </div>
            {AIS.map((ai) => (
              <div
                key={ai.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: `1px solid ${ai.tone}40`,
                  backgroundColor: `${ai.tone}14`,
                  borderRadius: 100,
                  padding: "8px 16px",
                  fontSize: 18,
                  color: ai.tone,
                  fontWeight: 600,
                }}
              >
                🤖 {ai.label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "28px 48px",
            zIndex: 10,
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "#9ca3af",
              display: "flex",
            }}
          >
            Locks at first kickoff · 11 June 19:00 UTC
          </div>
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "monospace",
              display: "flex",
            }}
          >
            oddsintel.app/world-cup/bracket
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
