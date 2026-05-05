"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { Suspense } from "react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const next = searchParams.get("next") ?? "/matches";

    // OAuth providers (Google, Discord) — PKCE code flow
    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          router.replace(next);
        } else {
          router.replace("/login");
        }
      });
      return;
    }

    // Magic link — implicit flow, token arrives in URL hash
    // Supabase client auto-detects and sets the session from the hash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace(next);
      } else {
        // Wait briefly for Supabase to process the hash fragment
        const timeout = setTimeout(async () => {
          const { data } = await supabase.auth.getSession();
          router.replace(data.session ? next : "/login");
        }, 500);
        return () => clearTimeout(timeout);
      }
    });
  }, [router, searchParams]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
