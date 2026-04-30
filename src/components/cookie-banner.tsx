"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "oddsintel_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if user hasn't responded yet
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
          We use a session cookie for authentication and privacy-friendly analytics
          (no ad tracking, no fingerprinting). See our{" "}
          <Link href="/privacy" className="text-green-400 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={decline}
            className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="rounded-lg bg-green-700 px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-green-700"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
