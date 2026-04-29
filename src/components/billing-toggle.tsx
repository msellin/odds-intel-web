"use client";

import { cn } from "@/lib/utils";

interface BillingToggleProps {
  annual: boolean;
  onChange: (annual: boolean) => void;
}

export function BillingToggle({ annual, onChange }: BillingToggleProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
      <button
        onClick={() => onChange(false)}
        className={cn(
          "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
          !annual
            ? "bg-white/[0.1] text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Monthly
      </button>
      <button
        onClick={() => onChange(true)}
        className={cn(
          "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
          annual
            ? "bg-green-500/20 text-green-400"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Annual
        <span className="ml-1.5 text-[10px] font-bold text-green-400">Save 33%</span>
      </button>
    </div>
  );
}
