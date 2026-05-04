"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth-provider";

const TIERS = ["free", "pro", "elite"] as const;
type Tier = (typeof TIERS)[number];

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  elite: "Elite",
};

const TIER_PRICES: Record<Tier, string> = {
  free: "Free",
  pro: "\u20ac4.99/mo",
  elite: "\u20ac14.99/mo",
};

function useCurrentTier(): Tier {
  const { profile } = useAuth();
  if (profile?.is_superadmin) return "elite";
  if (!profile?.tier) return "free";
  return profile.tier;
}

function tierIndex(tier: Tier) {
  return TIERS.indexOf(tier);
}

interface TierGateProps {
  requiredTier: Tier;
  children: React.ReactNode;
  featureName: string;
}

export function TierGate({ requiredTier, children, featureName }: TierGateProps) {
  const currentTier = useCurrentTier();
  const hasAccess = tierIndex(currentTier) >= tierIndex(requiredTier);
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: requiredTier }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setUpgrading(false);
    }
  };

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Blurred content */}
      <div
        style={{
          filter: "blur(8px)",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {children}
      </div>

      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(10, 10, 20, 0.6)",
          zIndex: 10,
        }}
      >
        {/* Card */}
        <div
          style={{
            backgroundColor: "#14141f",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "32px",
            maxWidth: "360px",
            width: "100%",
            textAlign: "center",
          }}
        >
          {/* Lock icon */}
          <div style={{ marginBottom: "16px" }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6b7280"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h3
            style={{
              color: "#ffffff",
              fontSize: "20px",
              fontWeight: 600,
              margin: "0 0 8px",
              textTransform: "capitalize",
            }}
          >
            {TIER_LABELS[requiredTier]}{requiredTier !== "pro" ? " — Coming Soon" : ""}
          </h3>

          <p
            style={{
              color: "#9ca3af",
              fontSize: "14px",
              margin: "0 0 4px",
              lineHeight: 1.5,
            }}
          >
            {featureName} will be available on the{" "}
            <span style={{ color: "#d1d5db" }}>
              {TIER_LABELS[requiredTier]}
            </span>{" "}
            plan.
          </p>

          <p
            style={{
              color: "#22c55e",
              fontSize: "24px",
              fontWeight: 700,
              margin: "16px 0",
            }}
          >
            {TIER_PRICES[requiredTier]}
          </p>

          {requiredTier === "pro" ? (
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              style={{
                display: "block",
                backgroundColor: upgrading ? "rgba(34, 197, 94, 0.3)" : "rgb(34, 197, 94)",
                color: "#000",
                border: "none",
                borderRadius: "8px",
                padding: "12px 32px",
                fontSize: "15px",
                fontWeight: 600,
                width: "100%",
                textAlign: "center",
                boxSizing: "border-box",
                cursor: upgrading ? "not-allowed" : "pointer",
              }}
            >
              {upgrading ? "Loading…" : "Upgrade to Pro — €4.99/mo"}
            </button>
          ) : (
            <span
              style={{
                display: "block",
                backgroundColor: "rgba(34, 197, 94, 0.15)",
                color: "rgba(34, 197, 94, 0.5)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
                borderRadius: "8px",
                padding: "12px 32px",
                fontSize: "15px",
                fontWeight: 600,
                width: "100%",
                textAlign: "center",
                boxSizing: "border-box",
              }}
            >
              Coming Soon
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
