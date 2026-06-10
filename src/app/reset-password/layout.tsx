import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set New Password — OddsIntel",
  description: "Choose a new password for your OddsIntel account.",
  robots: { index: false },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
