import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "World Cup 2026 Group Standings Predictor — OddsIntel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0a14";
const GOLD = "#facc15";

// 12 groups, A → L. Static — matches FIFA WC 2026 format.
const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

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
        {/* Green halo */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            left: "-150px",
            width: "700px",
            height: "500px",
            background:
              "radial-gradient(ellipse, rgba(34,197,94,0.18) 0%, transparent 65%)",
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
            World Cup 2026 · Groups Game
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
            Group Standings Predictor
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
            Predict 12 groups.
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "-1px",
              color: GOLD,
              lineHeight: 1,
              display: "flex",
            }}
          >
            192 points up for grabs.
          </div>

          {/* 12 group letter tiles */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 36,
              flexWrap: "wrap",
              maxWidth: 900,
            }}
          >
            {GROUPS.map((letter) => (
              <div
                key={letter}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  border: "1px solid rgba(34,197,94,0.3)",
                  backgroundColor: "rgba(34,197,94,0.08)",
                  fontSize: 28,
                  fontWeight: 900,
                  color: "#86efac",
                  fontFamily: "monospace",
                }}
              >
                {letter}
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
            5/3/2/1 by position · 5pt perfect-group bonus · Locks 11 June 19:00 UTC
          </div>
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
