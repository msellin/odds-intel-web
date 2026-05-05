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
        router.replace(error ? "/login" : next);
      });
      return;
    }

    // Implicit flow — access_token arrives in URL hash fragment.
    // Supabase client auto-processes the hash and fires onAuthStateChange.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        subscription.unsubscribe();
        router.replace(next);
      }
    });

    // Also check immediately in case session was already set
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe();
        router.replace(next);
      }
    });

    return () => subscription.unsubscribe();
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
