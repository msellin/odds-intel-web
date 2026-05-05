import type { MetadataRoute } from "next";
import { ALL_SLUGS } from "@/lib/glossary";
import { PREDICTION_LEAGUES } from "@/lib/engine-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://oddsintel.app";

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/matches`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/learn`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const glossaryPages: MetadataRoute.Sitemap = ALL_SLUGS.map((slug) => ({
    url: `${base}/learn/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const predictionPages: MetadataRoute.Sitemap = [
    { url: `${base}/predictions`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.85 },
    ...PREDICTION_LEAGUES.map((l) => ({
      url: `${base}/predictions/${l.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];

  return [...staticPages, ...predictionPages, ...glossaryPages];
}
