"use client";

/**
 * BET-EXPLAIN: Natural language bet explanation button
 * Calls /api/bet-explain to generate a Gemini-powered explanation.
 * Elite tier only.
 */

import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface BetExplainButtonProps {
  betId: string;
}

export function BetExplainButton({ betId }: BetExplainButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [explanation, setExplanation] = useState<string>("");
  const [expanded, setExpanded] = useState(true);

  const handleClick = async () => {
    if (state === "done") {
      setExpanded((v) => !v);
      return;
    }
    setState("loading");
    try {
      const res = await fetch(`/api/bet-explain?betId=${encodeURIComponent(betId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setExplanation(json.explanation);
      setState("done");
      setExpanded(true);
    } catch (err) {
      setExplanation(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  };

  return (
    <div className="mt-2">
      <button
        onClick={handleClick}
        disabled={state === "loading"}
        className="flex items-center gap-1.5 text-[11px] font-medium text-primary/70 hover:text-primary transition-colors disabled:opacity-50"
      >
        {state === "loading" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        {state === "idle" && "Why this pick?"}
        {state === "loading" && "Analysing..."}
        {state === "done" && (
          <>
            Why this pick?
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </>
        )}
        {state === "error" && "Retry"}
      </button>

      {state === "done" && expanded && (
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-md border-l-2 border-primary/20 pl-2">
          {explanation}
        </p>
      )}
      {state === "error" && (
        <p className="mt-1 text-xs text-red-400">{explanation}</p>
      )}
    </div>
  );
}
