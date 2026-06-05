import type { MetadataRoute } from "next";
import { ALL_SLUGS } from "@/lib/glossary";
import { PREDICTION_LEAGUES, getMatchIdsForSitemap } from "@/lib/engine-data";
import { getWorldCupFixtures } from "@/lib/world-cup";

// Revalidate hourly so new fixtures appear in the sitemap without redeploys.
export const revalidate = 3600;

// WC insight article slugs — mirrors scripts/generate_wc_insights.py ALL_SLUGS
// and the VALID_SLUGS list in src/app/(app)/world-cup/insights/[slug]/page.tsx.
const WC_INSIGHT_SLUGS = [
  "group-of-death",
  "cinderella-story",
  "squad-value-vs-model",
  "champions-favourites",
] as const;

/**
 * Slugify a WC team name for /world-cup/teams/[name] URLs.
 * Must stay in sync with the slugifyTeam() helper in
 * src/app/(app)/world-cup/teams/[name]/page.tsx.
 */
function slugifyWcTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://oddsintel.app";
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/matches`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/value-bets`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${base}/live`, lastModified: now, changeFrequency: "hourly", priority: 0.85 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/learn`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/methodology`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/performance`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
  ];

  // WC hub + sub-hubs. Hub + teams index get priority 0.8 (top-level destinations
  // we want indexed first); sub-pages get 0.6.
  const wcStaticPages: MetadataRoute.Sitemap = [
    { url: `${base}/world-cup`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/world-cup/teams`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/world-cup/who-can-win`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/world-cup/groups-predictor`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/world-cup/bracket`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/world-cup/bracket/leaderboard`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/world-cup/insights`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/world-cup/predictions-record`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/world-cup/predictions-record/clv`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/world-cup/predictions-record/leaderboard`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
  ];

  // WC insight articles — 4 hardcoded slugs that mirror generate_wc_insights.py.
  const wcInsightPages: MetadataRoute.Sitemap = WC_INSIGHT_SLUGS.map((slug) => ({
    url: `${base}/world-cup/insights/${slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // WC team detail pages — 48 nations, derived from the WC fixture team set.
  // Falls back to an empty list if fixtures fail to load (build-safe).
  let wcTeamPages: MetadataRoute.Sitemap = [];
  try {
    const fixtures = await getWorldCupFixtures();
    const seen = new Set<string>();
    for (const f of fixtures) {
      for (const t of [f.home, f.away]) {
        const slug = slugifyWcTeam(t.name);
        if (slug && !seen.has(slug)) {
          seen.add(slug);
          wcTeamPages.push({
            url: `${base}/world-cup/teams/${slug}`,
            lastModified: now,
            changeFrequency: "daily" as const,
            priority: 0.8,
          });
        }
      }
    }
  } catch {
    wcTeamPages = [];
  }

  const glossaryPages: MetadataRoute.Sitemap = ALL_SLUGS.map((slug) => ({
    url: `${base}/learn/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const predictionPages: MetadataRoute.Sitemap = [
    { url: `${base}/predictions`, lastModified: now, changeFrequency: "daily" as const, priority: 0.85 },
    ...PREDICTION_LEAGUES.map((l) => ({
      url: `${base}/predictions/${l.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];

  // GROWTH-VS-PAGES (2026-06-05) — competitor comparison landing pages.
  // High-intent SEO target for "[competitor] alternative" and
  // "[competitor] vs" searches. Lazy-import VS_SLUGS to avoid pulling
  // the full competitor data into the sitemap module budget.
  const { VS_SLUGS } = await import("@/lib/vs-competitors");
  const vsPages: MetadataRoute.Sitemap = [
    { url: `${base}/vs`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 },
    ...VS_SLUGS.map((slug) => ({
      url: `${base}/vs/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ];

  // Match detail pages — the highest-volume indexable surface.
  // Real lastModified comes from matches.updated_at (signals stale-vs-fresh accurately).
  const matchRows = await getMatchIdsForSitemap();
  const matchPages: MetadataRoute.Sitemap = matchRows.map((m) => ({
    url: `${base}/matches/${m.id}`,
    lastModified: new Date(m.updatedAt),
    changeFrequency: "hourly" as const,
    priority: 0.7,
  }));

  return [
    ...staticPages,
    ...wcStaticPages,
    ...wcTeamPages,
    ...wcInsightPages,
    ...predictionPages,
    ...vsPages,
    ...glossaryPages,
    ...matchPages,
  ];
}
