"use client";

import { useAuth } from "@/components/auth-provider";

export function SignupBanner() {
  const { openLoginModal } = useAuth();

  return (
    <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/[0.08] px-4 py-3">
      <div className="space-y-0.5">
        <span className="text-sm font-medium text-foreground/90">
          Create a free account to unlock:
        </span>
        <p className="text-xs text-foreground/60">
          Favourite leagues, personal picks tracker, match notes, daily value bet teaser &amp; more
        </p>
      </div>
      <button
        onClick={openLoginModal}
        className="shrink-0 rounded-md bg-green-600 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-green-700"
      >
        Sign Up Free
      </button>
    </div>
  );
}
