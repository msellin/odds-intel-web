"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type posthogJs from "posthog-js";
import { useAuth } from "@/components/auth-provider";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest";

// Single shared promise so PageView/UserSync wait on the same import.
let posthogPromise: Promise<typeof posthogJs> | null = null;
let posthogRef: typeof posthogJs | null = null;
let initialized = false;

function loadPosthog(): Promise<typeof posthogJs> {
  if (!posthogPromise) {
    posthogPromise = import("posthog-js").then((m) => {
      const ph = m.default;
      posthogRef = ph;
      if (POSTHOG_KEY && !initialized) {
        ph.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          capture_pageview: false,
          capture_pageleave: true,
          persistence: "localStorage",
          disable_session_recording: false,
          session_recording: { sampleRate: 0.5 },
          disable_surveys: true,
          autocapture: false,
          // We don't use feature flags / /decide / /flags — disabling avoids
          // ERR_SOCKET_NOT_CONNECTED noise + skips a request on every page load.
          advanced_disable_feature_flags: true,
          advanced_disable_decide: true,
        });
        initialized = true;
      }
      return ph;
    });
  }
  return posthogPromise;
}

function PostHogPageView({ ready }: { ready: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!ready || !posthogRef || !initialized) return;
    const url =
      pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    posthogRef.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ready]);

  return null;
}

function PostHogUserSync({ ready }: { ready: boolean }) {
  const { user, profile } = useAuth();
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !posthogRef || !initialized) return;

    if (user && profile) {
      if (lastIdRef.current !== user.id) {
        posthogRef.identify(user.id, {
          email: profile.email,
          name: profile.display_name ?? profile.email,
          tier: profile.tier,
          is_superadmin: profile.is_superadmin,
          created_at: profile.created_at,
        });
        lastIdRef.current = user.id;
      }
    } else if (!user && lastIdRef.current) {
      posthogRef.reset();
      lastIdRef.current = null;
    }
  }, [user, profile, ready]);

  return null;
}

export function captureEvent(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  loadPosthog().then((ph) => {
    if (initialized) ph.capture(event, properties);
  });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!POSTHOG_KEY) return;

    const start = () => {
      loadPosthog().then(() => setReady(true));
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (typeof win.requestIdleCallback === "function") {
      win.requestIdleCallback(start, { timeout: 2500 });
    } else {
      setTimeout(start, 1500);
    }
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView ready={ready} />
      </Suspense>
      <PostHogUserSync ready={ready} />
      {children}
    </>
  );
}
