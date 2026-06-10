"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useAuth } from "@/components/auth-provider";
import { captureEvent } from "@/components/posthog-provider";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Don't prompt on routes where the user is already in an explicit auth flow.
const SUPPRESSED_PATHS = ["/signup", "/login", "/auth"];

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    nonce: string;
    use_fedcm_for_prompt: boolean;
    auto_select: boolean;
    cancel_on_tap_outside: boolean;
    context: "signin" | "signup" | "use";
  }) => void;
  prompt: (
    callback?: (notification: {
      isNotDisplayed: () => boolean;
      isSkippedMoment: () => boolean;
      isDismissedMoment: () => boolean;
      getNotDisplayedReason: () => string;
      getSkippedReason: () => string;
      getDismissedReason: () => string;
    }) => void
  ) => void;
  cancel: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts: { id: GoogleAccountsId };
    };
  }
}

// Supabase + Google One Tap require a SHA-256 hashed nonce passed to Google,
// and the unhashed value passed to Supabase. Google signs the hashed nonce
// into the JWT; Supabase re-hashes the unhashed value and compares.
async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = crypto.randomUUID();
  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hashed = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

export function GoogleOneTap() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [scriptReady, setScriptReady] = useState(false);
  const promptedRef = useRef(false);

  const suppressed =
    !CLIENT_ID ||
    loading ||
    Boolean(user) ||
    (pathname ? SUPPRESSED_PATHS.some((p) => pathname.startsWith(p)) : false);

  useEffect(() => {
    if (suppressed) return;
    if (!scriptReady) return;
    if (promptedRef.current) return;
    if (!window.google?.accounts?.id) return;

    promptedRef.current = true;

    const run = async () => {
      const { raw, hashed } = await generateNonce();
      const supabase = createSupabaseBrowser();

      window.google!.accounts.id.initialize({
        client_id: CLIENT_ID!,
        callback: async ({ credential }) => {
          captureEvent("one_tap_credential_received");
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: credential,
            nonce: raw,
          });
          if (error) {
            captureEvent("one_tap_signin_error", { error_message: error.message });
          } else {
            captureEvent("one_tap_signin_success");
          }
        },
        nonce: hashed,
        use_fedcm_for_prompt: true,
        auto_select: false,
        cancel_on_tap_outside: true,
        context: "signin",
      });

      window.google!.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          captureEvent("one_tap_not_displayed", {
            reason: notification.getNotDisplayedReason(),
          });
        } else if (notification.isSkippedMoment()) {
          captureEvent("one_tap_skipped", { reason: notification.getSkippedReason() });
        } else if (notification.isDismissedMoment()) {
          captureEvent("one_tap_dismissed", { reason: notification.getDismissedReason() });
        } else {
          captureEvent("one_tap_displayed");
        }
      });
    };

    run().catch((err) => {
      captureEvent("one_tap_init_error", { error_message: String(err) });
    });
  }, [suppressed, scriptReady]);

  // Cancel the prompt if the user signs in via another path while it's showing.
  useEffect(() => {
    if (user && window.google?.accounts?.id) {
      window.google.accounts.id.cancel();
    }
  }, [user]);

  if (suppressed) return null;

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onReady={() => setScriptReady(true)}
    />
  );
}
