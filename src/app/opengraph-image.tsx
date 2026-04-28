import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "OddsIntel — Sports Betting Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
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
          fontFamily: "monospace",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(34,197,94,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Green glow top */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "700px",
            height: "400px",
            background:
              "radial-gradient(ellipse, rgba(34,197,94,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Sample match rows — decorative */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "60px",
            right: "60px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            opacity: 0.18,
          }}
        >
          {[
            { home: "Liverpool", away: "Real Madrid", h: "2.10", d: "3.45", a: "3.10" },
            { home: "AC Milan", away: "Dortmund", h: "2.45", d: "3.20", a: "2.85" },
            { home: "PSG", away: "Newcastle", h: "1.65", d: "4.10", a: "5.50" },
          ].map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.03)",
                borderRadius: "6px",
                padding: "10px 16px",
                fontSize: "13px",
                color: "#9ca3af",
              }}
            >
              <span style={{ flex: 1, color: "#e5e7eb" }}>
                {m.home} vs {m.away}
              </span>
              <span style={{ marginRight: "24px", color: "#22c55e", fontWeight: 700 }}>{m.h}</span>
              <span style={{ marginRight: "24px" }}>{m.d}</span>
              <span>{m.a}</span>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            position: "relative",
            zIndex: 10,
          }}
        >
          {/* Logo */}
          <div
            style={{
              fontSize: "52px",
              fontWeight: 900,
              letterSpacing: "-1px",
              fontStyle: "italic",
              color: "#ffffff",
            }}
          >
            ODDS<span style={{ color: "#22c55e" }}>INTEL</span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "22px",
              color: "#9ca3af",
              textAlign: "center",
              maxWidth: "600px",
              lineHeight: 1.4,
              fontFamily: "sans-serif",
            }}
          >
            All your pre-match intelligence.{" "}
            <span style={{ color: "#e5e7eb" }}>One screen.</span>
          </div>

          {/* Pills */}
          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            {["467 daily fixtures", "13 bookmakers", "AI alerts"].map((label) => (
              <div
                key={label}
                style={{
                  border: "1px solid rgba(34,197,94,0.3)",
                  backgroundColor: "rgba(34,197,94,0.08)",
                  borderRadius: "100px",
                  padding: "6px 16px",
                  fontSize: "14px",
                  color: "#86efac",
                  fontFamily: "sans-serif",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            right: "48px",
            fontSize: "15px",
            color: "rgba(255,255,255,0.25)",
            fontFamily: "monospace",
          }}
        >
          oddsintel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
