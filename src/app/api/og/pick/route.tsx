import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

function selectionColor(selection: string, result: string) {
  if (result === "won") return "#22c55e";
  if (result === "lost") return "#ef4444";
  return "#8b5cf6"; // pending = violet
}

function selectionBg(selection: string, result: string) {
  if (result === "won") return "rgba(34,197,94,0.12)";
  if (result === "lost") return "rgba(239,68,68,0.12)";
  return "rgba(139,92,246,0.12)";
}

function resultLabel(result: string) {
  if (result === "won") return "✓ WON";
  if (result === "lost") return "✗ LOST";
  return "PENDING";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const home       = searchParams.get("home") ?? "Home Team";
  const away       = searchParams.get("away") ?? "Away Team";
  const league     = searchParams.get("league") ?? "";
  const selection  = searchParams.get("selection") ?? "home";
  const odds       = searchParams.get("odds") ?? "";
  const modelProb  = searchParams.get("model_prob") ?? "";
  const result     = searchParams.get("result") ?? "pending";

  const selLabel = selection === "home" ? home : selection === "away" ? away : "Draw";
  const accentColor = selectionColor(selection, result);
  const bgColor = selectionBg(selection, result);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a14",
          fontFamily: "monospace",
          position: "relative",
          overflow: "hidden",
          padding: "52px 64px",
        }}
      >
        {/* Background grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Accent glow behind result */}
        <div
          style={{
            position: "absolute",
            top: "-80px",
            right: "-80px",
            width: "480px",
            height: "480px",
            background: `radial-gradient(ellipse, ${accentColor}18 0%, transparent 65%)`,
          }}
        />

        {/* Header: Logo + league */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
          <div style={{ fontSize: "28px", fontWeight: 900, fontStyle: "italic", color: "#ffffff" }}>
            ODDS<span style={{ color: "#22c55e" }}>INTEL</span>
          </div>
          {league && (
            <div style={{ fontSize: "15px", color: "rgba(255,255,255,0.35)", fontFamily: "sans-serif" }}>
              {league}
            </div>
          )}
        </div>

        {/* Match title */}
        <div
          style={{
            marginTop: "52px",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            position: "relative",
          }}
        >
          <span style={{ fontSize: "48px", fontWeight: 900, color: "#ffffff", fontFamily: "sans-serif" }}>
            {home}
          </span>
          <span style={{ fontSize: "30px", color: "rgba(255,255,255,0.25)", fontFamily: "sans-serif" }}>vs</span>
          <span style={{ fontSize: "48px", fontWeight: 900, color: "#ffffff", fontFamily: "sans-serif" }}>
            {away}
          </span>
        </div>

        {/* Pick card */}
        <div
          style={{
            marginTop: "40px",
            display: "flex",
            alignItems: "center",
            gap: "24px",
            backgroundColor: bgColor,
            border: `1.5px solid ${accentColor}50`,
            borderRadius: "16px",
            padding: "28px 36px",
            position: "relative",
          }}
        >
          {/* My Pick label */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "2px", color: "rgba(255,255,255,0.35)", fontFamily: "sans-serif" }}>
              MY PICK
            </div>
            <div style={{ fontSize: "40px", fontWeight: 900, color: accentColor, fontFamily: "sans-serif" }}>
              {selLabel}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", height: "64px", backgroundColor: "rgba(255,255,255,0.08)" }} />

          {/* Odds */}
          {odds && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "2px", color: "rgba(255,255,255,0.35)", fontFamily: "sans-serif" }}>
                ODDS
              </div>
              <div style={{ fontSize: "40px", fontWeight: 700, color: "#e5e7eb", fontFamily: "monospace" }}>
                {parseFloat(odds).toFixed(2)}
              </div>
            </div>
          )}

          {/* Model prob */}
          {modelProb && (
            <>
              <div style={{ width: "1px", height: "64px", backgroundColor: "rgba(255,255,255,0.08)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "2px", color: "rgba(255,255,255,0.35)", fontFamily: "sans-serif" }}>
                  AI MODEL
                </div>
                <div style={{ fontSize: "40px", fontWeight: 700, color: "#8b5cf6", fontFamily: "monospace" }}>
                  {modelProb}%
                </div>
              </div>
            </>
          )}

          {/* Result badge */}
          {result !== "pending" && (
            <div
              style={{
                marginLeft: "auto",
                backgroundColor: accentColor,
                borderRadius: "100px",
                padding: "10px 24px",
                fontSize: "20px",
                fontWeight: 900,
                color: "#0a0a14",
                letterSpacing: "1px",
                fontFamily: "sans-serif",
              }}
            >
              {resultLabel(result)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "36px",
            left: "64px",
            right: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.25)", fontFamily: "sans-serif" }}>
            Track your bets at oddsintel.app
          </div>
          <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
            oddsintel.app
          </div>
        </div>
      </div>
    ),
    { ...SIZE }
  );
}
