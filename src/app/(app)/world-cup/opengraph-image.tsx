import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FIFA World Cup 2026 — Predictions, Bracket & AI on OddsIntel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0a14";
const GOLD = "#facc15";

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
            top: "-120px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "900px",
            height: "500px",
            background:
              "radial-gradient(ellipse, rgba(250,204,21,0.18) 0%, transparent 65%)",
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
              fontSize: 34,
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
              fontSize: 18,
              color: GOLD,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            FIFA World Cup 2026
          </div>
        </div>

        {/* Hero */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            zIndex: 10,
            padding: "0 80px",
          }}
        >
          <div
            style={{
              fontSize: 92,
              fontWeight: 900,
              letterSpacing: "-3px",
              color: "#ffffff",
              textAlign: "center",
              lineHeight: 1,
              display: "flex",
            }}
          >
            48 teams. 104 matches.
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: "-1.5px",
              color: GOLD,
              textAlign: "center",
              lineHeight: 1,
              display: "flex",
            }}
          >
            One AI model.
          </div>
          <div
            style={{
              marginTop: 36,
              fontSize: 24,
              color: "#9ca3af",
              textAlign: "center",
              maxWidth: 880,
              lineHeight: 1.35,
              display: "flex",
            }}
          >
            AI predictions, advancement probabilities, bracket challenge, group standings game.
          </div>

          {/* Pills */}
          <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
            {[
              "Group predictor",
              "Bracket challenge",
              "AI vs you leaderboard",
            ].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  border: "1px solid rgba(34,197,94,0.35)",
                  backgroundColor: "rgba(34,197,94,0.08)",
                  borderRadius: 100,
                  padding: "8px 20px",
                  fontSize: 18,
                  color: "#86efac",
                  fontWeight: 600,
                }}
              >
                {label}
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
            Jun 11 – Jul 19 · USA · Canada · Mexico
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
