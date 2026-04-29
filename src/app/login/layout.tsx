import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — OddsIntel",
  description:
    "Sign in to OddsIntel to access your picks tracker, AI value bets, and personalized match intelligence.",
  robots: { index: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
