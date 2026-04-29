import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Free Account — OddsIntel",
  description:
    "Join OddsIntel free. Get AI-powered betting intelligence, live odds from 13 bookmakers, injuries, H2H, and a personal picks tracker.",
  openGraph: {
    title: "Create Free Account — OddsIntel",
    description:
      "Join OddsIntel free. Get AI-powered betting intelligence, live odds from 13 bookmakers, injuries, H2H, and a personal picks tracker.",
    url: "https://oddsintel.app/signup",
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
