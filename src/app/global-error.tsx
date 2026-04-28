"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-dvh items-center justify-center bg-[#0a0a14] text-white">
        <div className="text-center">
          <h2 className="mb-4 text-xl font-semibold">Something went wrong</h2>
          <button
            onClick={() => reset()}
            className="rounded bg-green-600 px-4 py-2 text-sm hover:bg-green-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
