import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { PostHogProvider } from "@/components/posthog-provider";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CookieBanner } from "@/components/cookie-banner";
import { MetaPixel } from "@/components/meta-pixel";
import { FeedbackButton } from "@/components/feedback-button";
import { GoogleOneTap } from "@/components/google-one-tap";
import { UpgradeModalMount } from "@/components/upgrade-modal-mount";
import { AnonUpgradeBanner } from "@/components/anon-upgrade-banner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OddsIntel — Verified Football Picks · Public Track Record",
  description:
    "Football picks logged before kickoff and tracked on a public, time-stamped ledger. Every bet, every closing line, every result — verifiable via GitHub and the Bitcoin blockchain.",
  keywords: [
    "verified football picks",
    "football tipster track record",
    "transparent betting model",
    "closing line value",
    "CLV tracking",
    "open source betting model",
    "auditable football predictions",
    "pre-match value bets",
    "football model ROI",
    "Bitcoin-anchored tipster",
    "Pinnacle CLV",
  ],
  verification: {
    google: "ix-rQvuyTbEjWYRefDYn7o-yi2S_8oUB7ahHhI56W38",
  },
  openGraph: {
    title: "OddsIntel — Verified Football Picks · Public Track Record",
    description:
      "Football picks logged before kickoff. Public ledger on GitHub, anchored to the Bitcoin blockchain via OpenTimestamps. Nothing hidden.",
    url: "https://oddsintel.app",
    siteName: "OddsIntel",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://oddsintel.app/opengraph-image",
        width: 1200,
        height: 630,
        alt: "OddsIntel — Verified Football Picks",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OddsIntel — Verified Football Picks · Public Track Record",
    description:
      "Football picks logged before kickoff. Public ledger on GitHub, anchored to the Bitcoin blockchain via OpenTimestamps. Nothing hidden.",
    images: ["https://oddsintel.app/opengraph-image"],
  },
  alternates: {
    canonical: "https://oddsintel.app",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OddsIntel",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
    >
      <head>
        {supabaseUrl && (
          <>
            <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseUrl} />
          </>
        )}
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "OddsIntel",
              url: "https://oddsintel.app",
              logo: "https://oddsintel.app/icon-512.png",
              description:
                "OddsIntel is an open-source football prediction model (Poisson + XGBoost ensemble) that publishes every pick before kickoff to a public ledger. Track record at /performance, live picks at /picks, JSON API at /api/v1/track-record. Each daily snapshot is committed to GitHub and anchored to the Bitcoin blockchain via OpenTimestamps for independent verification.",
            }),
          }}
        />
        <AuthProvider>
          <AnonUpgradeBanner />
          <PostHogProvider>{children}</PostHogProvider>
          <GoogleOneTap />
          <UpgradeModalMount />
        </AuthProvider>
        <CookieBanner />
        <FeedbackButton />
        {process.env.NEXT_PUBLIC_META_PIXEL_ID && (
          <MetaPixel pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID} />
        )}
        <Script
          id="clarity-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","x3h7ztuy8w");`,
          }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
