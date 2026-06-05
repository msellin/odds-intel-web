import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Proxy PostHog through our own domain so ad blockers don't block /e/ events.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
  async redirects() {
    return [
      // GROWTH-CLV-FIRST-MESSAGING (2026-06-05): the natural short URL for the
      // CLV pillar page is /learn/clv; the canonical slug is /learn/closing-
      // line-value. Permanent redirect so the short URL works for inbound
      // marketing links + the landing honest-numbers card.
      { source: "/learn/clv", destination: "/learn/closing-line-value", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
    minimumCacheTTL: 31536000, // 1 year — team logos never change
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://us-assets.i.posthog.com",
              "style-src 'self' 'unsafe-inline'",
              // GROWTH-DIRECTORY-STACK (2026-06-05): allow directory-badge
              // sources so the reciprocal-backlink badges in the landing
              // footer render. Add new domains here as new badges land.
              "img-src 'self' data: blob: https://*.supabase.co https://media.api-sports.io https://twelve.tools https://wired.business https://aiboom.tools",
              "font-src 'self'",
              // POSTHOG-CSP-FIX (2026-06-06): PostHog ingestion was blocked
               // by CSP for weeks — script-src allowed us-assets.i.posthog.com
               // but connect-src did not allow us.i.posthog.com (events) or
               // us-assets.i.posthog.com (sourcemaps/web-vitals). Adding both.
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.stripe.com https://us.i.posthog.com https://us-assets.i.posthog.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

// SENTRY-FEEDBACK-ONLY (2026-06-02): keep withSentryConfig because it
// wires the client-side bundle to load sentry.client.config.ts (which
// is now feedback-widget-only). tracesSampleRate is 0 in the client
// config, so transactions no longer cost free-tier quota. tunnelRoute
// stays — feedback POSTs go through `/monitoring` so ad blockers don't
// swallow them.
//
// If you ever re-add server-side error tracking, restore
// sentry.server.config.ts + sentry.edge.config.ts + src/instrumentation.ts
// (see git history for the previous shape).
export default withSentryConfig(nextConfig, {
  org: "margus-sellin",
  project: "odds-intel",
  silent: !process.env.CI,
  // No source-map uploads — we removed captureException everywhere; the
  // only Sentry events we ship are user-submitted feedback (which doesn't
  // benefit from source maps).
  widenClientFileUpload: false,
  disableLogger: true,
  tunnelRoute: "/monitoring",
});
