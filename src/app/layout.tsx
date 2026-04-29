import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { Analytics } from "@vercel/analytics/next";
import { CookieBanner } from "@/components/cookie-banner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OddsIntel — AI Football Predictions & Value Bets",
  description:
    "Free AI football predictions, value bets and odds comparison. Track injuries, H2H records and standings across 400+ daily fixtures. Spot your betting edge before kickoff.",
  keywords: [
    "AI football predictions",
    "value bets today",
    "odds comparison",
    "football betting tips",
    "betting tips today",
    "football predictions today",
    "best odds today",
    "football injury news",
    "match predictions with odds",
    "free betting tips",
  ],
  verification: {
    google: "ix-rQvuyTbEjWYRefDYn7o-yi2S_8oUB7ahHhI56W38",
  },
  openGraph: {
    title: "OddsIntel — AI Football Predictions & Value Bets",
    description:
      "Free AI football predictions, value bets and odds comparison. Track injuries, H2H records and standings across 400+ daily fixtures. Spot your betting edge before kickoff.",
    url: "https://oddsintel.app",
    siteName: "OddsIntel",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OddsIntel — AI Football Predictions & Value Bets",
    description:
      "Free AI football predictions, value bets and odds comparison. Track injuries, H2H records and standings across 400+ daily fixtures. Spot your betting edge before kickoff.",
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
                "AI-powered sports betting intelligence. Live odds from 13 bookmakers, injuries, H2H, standings, and transparent model track record.",
              sameAs: [],
            }),
          }}
        />
        <AuthProvider>{children}</AuthProvider>
        <CookieBanner />
        <Analytics />
        <Script id="hotjar" strategy="afterInteractive">
          {`
            (function(h,o,t,j,a,r){
              h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
              h._hjSettings={hjid:${process.env.NEXT_PUBLIC_HOTJAR_ID},hjsv:6};
              a=o.getElementsByTagName('head')[0];
              r=o.createElement('script');r.async=1;
              r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
              a.appendChild(r);
            })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
          `}
        </Script>
      </body>
    </html>
  );
}
