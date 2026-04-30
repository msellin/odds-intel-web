"use client";

import { useAuth } from "@/components/auth-provider";

export function SignupBanner() {
  const { openLoginModal } = useAuth();

  return (
    <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/[0.08] px-3 py-2">
      <p className="text-xs text-foreground/70">
        <button
          onClick={openLoginModal}
          className="font-medium text-green-400 hover:text-green-300 transition-colors"
        >
          Create a free account
        </button>
        {" "}to unlock favourite leagues, picks tracker, match notes &amp; daily value bets
      </p>
    </div>
  );
}
