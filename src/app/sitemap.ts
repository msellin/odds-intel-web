import type { MetadataRoute } from "next";
import { ALL_SLUGS } from "@/lib/glossary";
import { PREDICTION_LEAGUES, getMatchIdsForSitemap } from "@/lib/engine-data";

// Revalidate hourly so new fixtures appear in the sitemap without redeploys.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://oddsintel.app";
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/matches`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/learn`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/methodology`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/performance`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
  ];

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

  // Match detail pages — the highest-volume indexable surface.
  // Real lastModified comes from matches.updated_at (signals stale-vs-fresh accurately).
  const matchRows = await getMatchIdsForSitemap();
  const matchPages: MetadataRoute.Sitemap = matchRows.map((m) => ({
    url: `${base}/matches/${m.id}`,
    lastModified: new Date(m.updatedAt),
    changeFrequency: "hourly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...predictionPages, ...glossaryPages, ...matchPages];
}
