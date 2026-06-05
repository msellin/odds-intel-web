"use client";

// FEEDBACK-BUTTON-GLOBAL (2026-06-02): we used to rely on Sentry's
// `autoInject: true` to float the widget on every page, but the user
// reported that logged-in routes never showed it — most likely because
// SPA navigation in App Router doesn't always preserve the auto-injected
// document.body child. Rendering the trigger as an actual React component
// inside the root layout makes presence guaranteed, and we control the
// exact label, position, and styling (no Sentry default "Report a Bug").
//
// We still use Sentry's feedback form for capture — `attachTo(el)` wires
// our button to the same modal `autoInject` would have opened.
//
// GROWTH-MOBILE-LANDING-V2 (2026-06-05): hidden on the landing page (`/`)
// because the mobile audit found the floater obscured content in 11 of 13
// landing screenshots and occupied the thumb-zone slot where the primary
// conversion CTA should live. Landing is a conversion page, not a
// feedback-collection page. Button still renders everywhere else.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { MessageSquare } from "lucide-react";

export function FeedbackButton() {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    // `getFeedback()` returns the feedbackIntegration instance registered
    // in instrumentation-client.ts. If Sentry never initialised (no DSN
    // in dev) the call no-ops — button still renders, just inert.
    const feedback = Sentry.getFeedback();
    if (!feedback) return;
    const unsubscribe = feedback.attachTo(el);
    return () => {
      // Sentry returns a cleanup function from `attachTo`.
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // Hide on landing — conversion surface, not feedback-collection surface.
  if (pathname === "/") return null;

  return (
    <button
      ref={btnRef}
      type="button"
      aria-label="Give feedback"
      className="fixed bottom-4 right-4 z-[60] inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg ring-1 ring-primary/40 transition hover:brightness-110 sm:bottom-6 sm:right-6 sm:px-4 sm:py-2.5 sm:text-sm"
    >
      <MessageSquare className="size-3.5 sm:size-4" />
      <span className="hidden sm:inline">Give feedback</span>
      <span className="sm:hidden">Feedback</span>
    </button>
  );
}
