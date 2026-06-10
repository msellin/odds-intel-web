"use client";

// ANON-AUTH PHASE 3 — persistent dismissible banner shown to anonymous
// users on every app page (except the auth pages). Dismissal is stored
// in localStorage with a timestamp; banner re-appears after 7 days so
// users who declined once still see the prompt occasionally.
//
// Hidden on /login, /signup, /auth (don't double up on signup UI there).

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { captureEvent } from "@/components/posthog-provider";

const STORAGE_KEY = "oi_anon_banner_dismissed_at";
const RESHOW_AFTER_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days

const SUPPRESSED_PATHS = ["/login", "/signup", "/auth", "/forgot-password", "/reset-password"];

export function AnonUpgradeBanner() {
  const { isAnonymous, loading, openUpgradeModal } = useAuth();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true); // start hidden, reveal once we've checked localStorage

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setDismissed(false);
      return;
    }
    const at = parseInt(raw, 10);
    if (isNaN(at)) {
      setDismissed(false);
      return;
    }
    setDismissed(Date.now() - at < RESHOW_AFTER_MS);
  }, []);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
    setDismissed(true);
    captureEvent("anon_upgrade_banner_dismissed", { pathname });
  };

  const handleClick = () => {
    captureEvent("anon_upgrade_banner_clicked", { pathname });
    openUpgradeModal("banner");
  };

  const suppressed =
    loading ||
    !isAnonymous ||
    dismissed ||
    (pathname ? SUPPRESSED_PATHS.some((p) => pathname.startsWith(p)) : false);

  if (suppressed) return null;

  return (
    <div className="sticky top-0 z-40 w-full border-b border-amber-500/30 bg-amber-500/10 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <button
          type="button"
          onClick={handleClick}
          className="flex flex-1 items-center gap-2 text-left text-sm text-amber-100 hover:text-amber-50"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
          <span className="truncate">
            <span className="font-medium">You&apos;re browsing as a guest.</span>{" "}
            <span className="text-amber-200/80">Sign up free to save your work across devices.</span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleClick}
            className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-400"
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-md p-1 text-amber-200/70 hover:bg-white/[0.05] hover:text-amber-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
