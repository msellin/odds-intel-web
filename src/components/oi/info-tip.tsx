"use client";

// ⓘ explanation tip (#139 answer-first pass, 2026-09-25). Owner, on the screenshots: the admin read
// like a report — every card carried a paragraph. Explanations now sit behind this icon: hover or
// tap to read, Esc / click outside to close. Keyboard reachable (a real button).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

export function InfoTip({ children, label = "What is this?" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground/70 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info size={13} aria-hidden="true" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-6 z-40 w-72 max-w-[80vw] -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs font-normal leading-relaxed text-muted-foreground shadow-xl"
        >
          {children}
        </span>
      )}
    </span>
  );
}
