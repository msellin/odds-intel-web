import type { MetadataRoute } from "next";
import { ALL_SLUGS } from "@/lib/glossary";
import { getAllPredictionLeagues, getMatchIdsForSitemap } from "@/lib/engine-data";
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
    { url: `${base}/accuracy`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
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

  // GROWTH-SEO-EXPAND-LEAGUES (2026-06-05): include all qualifying leagues, not
  // just the curated 8. Featured leagues get priority 0.8; the rest 0.65 so the
  // curated set still surfaces first in Google's crawl. Fail-safe to keep
  // sitemap generation robust if the RPC errors during a deploy/migrate gap.
  let predictionLeaguePages: MetadataRoute.Sitemap = [];
  try {
    const allLeagues = await getAllPredictionLeagues();
    predictionLeaguePages = allLeagues.map((l) => ({
      url: `${base}/predictions/${l.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: l.featured ? 0.8 : 0.65,
    }));
  } catch {
    predictionLeaguePages = [];
  }
  const predictionPages: MetadataRoute.Sitemap = [
    { url: `${base}/predictions`, lastModified: now, changeFrequency: "daily" as const, priority: 0.85 },
    ...predictionLeaguePages,
  ];

  // GROWTH-SEO-CONTENT-ENGINE Phase 1 (2026-06-05): per-fixture prediction
  // pages — every fixture in covered leagues for next 21d + past 30d gets a
  // dedicated indexable URL. Lazy-import the helper to keep the static
  // imports tight, and fail-safe if the DB query errors out (sitemap should
  // never crash on per-fixture issues).
  let predictionFixturePages: MetadataRoute.Sitemap = [];
  try {
    const { getPredictionFixturesForSitemap } = await import("@/lib/engine-data");
    const fixtures = await getPredictionFixturesForSitemap();
    predictionFixturePages = fixtures.map((f) => ({
      url: `${base}/predictions/${f.leagueSlug}/${f.fixtureSlug}`,
      lastModified: new Date(f.kickoff),
      changeFrequency: "hourly" as const,
      priority: 0.7,
    }));
  } catch {
    predictionFixturePages = [];
  }

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

  // Match recap pages — settled A-tier matches with model coverage.
  // Long-tail SEO: "Team A vs Team B result analysis", "betting recap", etc.
  let recapPages: MetadataRoute.Sitemap = [];
  try {
    const { getRecapIndex } = await import("@/lib/engine-data");
    const recaps = await getRecapIndex(500, 0);
    recapPages = [
      { url: `${base}/recaps`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 },
      ...recaps.map((r) => ({
        url: `${base}/recaps/${r.slug}`,
        lastModified: new Date(r.kickoff),
        changeFrequency: "monthly" as const,
        priority: 0.65,
      })),
    ];
  } catch {
    recapPages = [{ url: `${base}/recaps`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 }];
  }

  return [
    ...staticPages,
    ...wcStaticPages,
    ...wcTeamPages,
    ...wcInsightPages,
    ...predictionPages,
    ...predictionFixturePages,
    ...vsPages,
    ...glossaryPages,
    ...matchPages,
    ...recapPages,
  ];
}
