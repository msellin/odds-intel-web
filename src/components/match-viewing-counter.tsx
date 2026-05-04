"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

function getOrCreateSessionId(): string {
  let id = localStorage.getItem("oi_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("oi_session_id", id);
  }
  return id;
}

interface MatchViewingCounterProps {
  matchId: string;
}

export function MatchViewingCounter({ matchId }: MatchViewingCounterProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const sessionId = getOrCreateSessionId();

    fetch("/api/track-page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, sessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.count === "number") setCount(data.count);
      })
      .catch(() => {});
  }, [matchId]);

  // Only show when there are 2+ people (suppress self-only display)
  if (count === null || count < 2) return null;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
      <Eye className="h-3 w-3" />
      {count} {count === 1 ? "person" : "people"} analyzing this
    </span>
  );
}
