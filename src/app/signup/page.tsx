"use client";

// Unified auth lives at /login now. /signup redirects there preserving
// query params (plan, email) so existing landing CTAs and pricing links
// still work without breaking.

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignupRedirect() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const qs = sp.toString();
    router.replace(`/login${qs ? `?${qs}` : ""}`);
  }, [router, sp]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="h-96 w-full max-w-md rounded-xl border border-white/[0.06] animate-pulse bg-card/20" />
    </div>
  );
}
