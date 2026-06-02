"use client";

import { useEffect } from "react";

// SENTRY-FEEDBACK-ONLY (2026-06-02): error capture removed. The previous
// implementation called Sentry.captureException here; we now log to
// console only. The user-facing UX (the "Try again" button) is unchanged.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global error boundary", error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-dvh items-center justify-center bg-[#0a0a14] text-white">
        <div className="text-center">
          <h2 className="mb-4 text-xl font-semibold">Something went wrong</h2>
          <button
            onClick={() => reset()}
            className="rounded bg-green-700 px-4 py-2 text-sm hover:bg-green-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
