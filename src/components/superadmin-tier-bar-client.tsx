"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TIERS = ["free", "pro", "elite"] as const;

export function SuperadminTierBarClient({
  previewTier,
}: {
  previewTier: "free" | "pro" | "elite" | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setTier(tier: string) {
    setLoading(true);
    await fetch("/api/set-preview-tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    router.refresh();
    // Keep loading=true — the component remounts with fresh props after refresh,
    // resetting state to false. Avoids double-click races during the RSC re-render.
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border bg-background/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur">
      <span className="mr-1 text-muted-foreground">Preview:</span>
      {TIERS.map((t) => (
        <button
          key={t}
          disabled={loading}
          onClick={() => setTier(t)}
          className={`rounded-full px-2 py-0.5 capitalize transition-colors disabled:opacity-50 ${
            previewTier === t
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          }`}
        >
          {t}
        </button>
      ))}
      <button
        disabled={loading}
        onClick={() => setTier("")}
        className={`rounded-full px-2 py-0.5 transition-colors disabled:opacity-50 ${
          !previewTier ? "bg-primary text-primary-foreground" : "hover:bg-muted"
        }`}
      >
        My Tier
      </button>
    </div>
  );
}
