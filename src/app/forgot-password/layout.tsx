import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password — OddsIntel",
  description: "Reset your OddsIntel password.",
  robots: { index: false },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
