"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "oddsintel_cookie_consent";
// Mobile UX audit flagged the banner as blocking the Telegram CTA
// above the fold on iPhone SE (375×667). Delaying appearance by ~1.2s
// lets the hero paint first so the CTAs are visible before the banner
// slides in. Also shrunk to a single-row layout on ≥sm and a two-row
// compact stack on mobile with tighter padding, keeping visual weight
// under ~80px even on the narrowest viewport.
const APPEAR_DELAY_MS = 1200;

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => clearTimeout(t);
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
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-3">
        <p className="text-xs leading-snug text-muted-foreground sm:max-w-xl">
          Session cookie for auth + privacy-friendly analytics. No ad
          tracking.{" "}
          <Link href="/privacy" className="text-green-400 hover:underline">
            Privacy
          </Link>
        </p>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <button
            onClick={decline}
            className="rounded-md border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="rounded-md bg-green-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-green-500"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
