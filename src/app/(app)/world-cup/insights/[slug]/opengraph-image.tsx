/**
 * WC-F5 — dynamic OG image for /world-cup/insights/[slug].
 *
 * Reads the article row from `wc_articles` (same path as the page metadata)
 * and renders a 1200x630 PNG with the title + WC2026 wordmark + tournament
 * gold accent. Falls back to the static FALLBACK_META copy if the engine
 * job hasn't published the row yet — so links shared during the deploy gap
 * still unfurl with the right framing.
 */

import { ImageResponse } from "next/og";

import { createSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const alt = "OddsIntel · FIFA World Cup 2026 analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TOURNAMENT_GOLD = "#facc15";
const BG = "#0a0a14";

const VALID_SLUGS = [
  "group-of-death",
  "cinderella-story",
  "squad-value-vs-model",
  "champions-favourites",
] as const;
type Slug = (typeof VALID_SLUGS)[number];

// Mirror of /world-cup/insights/[slug]/page.tsx FALLBACK_META — kept local
// to avoid importing the heavy page module into the OG file.
const FALLBACK_TITLES: Record<Slug, string> = {
  "group-of-death": "Group of Death — Toughest WC2026 Group",
  "cinderella-story": "Cinderella Story — Biggest WC2026 Underdogs",
  "squad-value-vs-model":
    "Most Expensive Squad Doesn't Always Win — WC2026",
  "champions-favourites":
    "Top 5 WC2026 Title Favourites — Why Our Model Likes Them",
};

async function loadArticleTitle(slug: string): Promise<string | null> {
  if (!VALID_SLUGS.includes(slug as Slug)) return null;
  try {
    const supabase = await createSupabaseServer();
    const { data } = await supabase
      .from("wc_articles")
      .select("title")
      .eq("slug", slug)
      .maybeSingle();
    const row = data as { title: string } | null;
    if (row?.title) return row.title;
  } catch {
    // ignore — fall through to fallback
  }
  return FALLBACK_TITLES[slug as Slug] ?? null;
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
    </div>
  );
}

function GenericInsightOG() {
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
            fontSize: 26,
            color: TOURNAMENT_GOLD,
            letterSpacing: 4,
            textTransform: "uppercase",
            fontWeight: 700,
            display: "flex",
          }}
        >
          WC2026 Analysis
        </div>
      </div>
    ),
    { ...size },
  );
}

export default async function OGImage({
  params,
}: {
  params: { slug: string };
}) {
  const title = await loadArticleTitle(params.slug);
  if (!title) {
    return GenericInsightOG();
  }

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
        {/* Gold accent — top stripe */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(250,204,21,0.8) 50%, transparent 100%)",
            display: "flex",
          }}
        />
        {/* Gold halo behind the headline */}
        <div
          style={{
            position: "absolute",
            top: "180px",
            left: "5%",
            width: "900px",
            height: "420px",
            background:
              "radial-gradient(ellipse, rgba(234,179,8,0.16) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "40px 56px 0",
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
            Data insight
          </div>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            padding: "48px 56px 0",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 20,
              color: TOURNAMENT_GOLD,
              textTransform: "uppercase",
              letterSpacing: 4,
              fontWeight: 700,
              display: "flex",
            }}
          >
            FIFA World Cup 2026
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            padding: "12px 56px 0",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: "-2px",
              color: "#ffffff",
              lineHeight: 1.08,
              display: "flex",
            }}
          >
            {title}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 56px 40px",
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontSize: 20,
              color: "#e5e7eb",
              fontWeight: 700,
              display: "flex",
            }}
          >
            OddsIntel · WC2026 analysis
          </div>
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "monospace",
              display: "flex",
            }}
          >
            oddsintel.app/world-cup/insights
          </div>
        </div>

        {/* Gold accent — bottom stripe */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(250,204,21,0.6) 50%, transparent 100%)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
