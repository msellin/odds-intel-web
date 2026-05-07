"use client";

import { useState, type ReactNode } from "react";

type TabId = "intel" | "match" | "odds" | "context";

interface Tab {
  id: TabId;
  label: string;
  badge?: ReactNode;
}

interface MatchDetailTabsProps {
  intelContent: ReactNode;
  matchContent: ReactNode;
  oddsContent: ReactNode;
  contextContent: ReactNode;
  /** Show a dot badge on the Intel tab when high-value signals exist */
  hasSignals?: boolean;
  /** Default to "match" tab when match is live */
  defaultTab?: TabId;
}

export function MatchDetailTabs({
  intelContent,
  matchContent,
  oddsContent,
  contextContent,
  hasSignals,
  defaultTab = "intel",
}: MatchDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const tabs: Tab[] = [
    {
      id: "intel",
      label: "Intel",
      badge: hasSignals ? (
        <span className="size-1.5 rounded-full bg-green-400" />
      ) : null,
    },
    { id: "match", label: "Match" },
    { id: "odds", label: "Odds" },
    { id: "context", label: "Context" },
  ];

  const content: Record<TabId, ReactNode> = {
    intel: intelContent,
    match: matchContent,
    odds: oddsContent,
    context: contextContent,
  };

  return (
    <div>
      {/* Sticky tab bar */}
      <div className="sticky top-0 z-30 -mx-2 sm:-mx-4 px-2 sm:px-4 bg-background/95 backdrop-blur-sm border-b border-white/[0.06]">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative ${
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/70"
              }`}
            >
              {tab.label}
              {tab.badge}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-4 space-y-4">
        {content[activeTab]}
      </div>
    </div>
  );
}
