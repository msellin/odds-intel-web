import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { PostHogProvider } from "@/components/posthog-provider";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CookieBanner } from "@/components/cookie-banner";
import { MetaPixel } from "@/components/meta-pixel";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "optional",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "optional",
});

export const metadata: Metadata = {
  title: "OddsIntel — AI Football Predictions & Value Bets Today",
  description:
    "Get AI-powered value bets and football predictions today. Compare bookmaker odds, track injuries, and check H2H records — free, across 280+ leagues.",
  keywords: [
    "AI football predictions",
    "value bets today",
    "football predictions today",
    "odds comparison",
    "football betting tips",
    "betting tips today",
    "best odds today",
    "football injury news",
    "football odds comparison tool",
    "expected value betting calculator",
    "football injury news before kickoff",
    "machine learning football predictions",
    "football value bets today free",
  ],
  verification: {
    google: "ix-rQvuyTbEjWYRefDYn7o-yi2S_8oUB7ahHhI56W38",
  },
  openGraph: {
    title: "OddsIntel — AI Football Predictions & Value Bets Today",
    description:
      "Get AI-powered value bets and football predictions today. Compare bookmaker odds, track injuries, and check H2H records — free, across 280+ leagues.",
    url: "https://oddsintel.app",
    siteName: "OddsIntel",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OddsIntel — AI Football Predictions & Value Bets Today",
    description:
      "Get AI-powered value bets and football predictions today. Compare bookmaker odds, track injuries, and check H2H records — free, across 280+ leagues.",
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
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "OddsIntel",
              url: "https://oddsintel.app",
              description:
                "OddsIntel uses an AI ensemble model combining Poisson regression and XGBoost to generate football predictions and value bets across 280+ leagues. Provides odds comparison, injury tracking, H2H records and standings in one platform.",
            }),
          }}
        />
        <AuthProvider>
          <PostHogProvider>{children}</PostHogProvider>
        </AuthProvider>
        <CookieBanner />
        {process.env.NEXT_PUBLIC_META_PIXEL_ID && (
          <MetaPixel pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID} />
        )}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
