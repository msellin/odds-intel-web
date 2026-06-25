import type { MetadataRoute } from "next";

// PRODUCT-COLLAPSE (2026-06-24): public surface narrowed to landing +
// performance track-record + ledger API. WC, matches, value-bets, learn
// glossary, league prediction pages all deleted — sitemap entries gone.
export const revalidate = 3600;

const BASE_URL = "https://oddsintel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/picks`, lastModified: now, changeFrequency: "hourly", priority: 0.95 },
    { url: `${BASE_URL}/performance`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/methodology`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
