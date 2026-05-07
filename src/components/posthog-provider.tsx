"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useAuth } from "@/components/auth-provider";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!POSTHOG_KEY || !initialized) return;
    const url =
      pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

function PostHogUserSync() {
  const { user, profile } = useAuth();
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!POSTHOG_KEY || !initialized) return;

    if (user && profile) {
      if (lastIdRef.current !== user.id) {
        posthog.identify(user.id, {
          email: profile.email,
          name: profile.display_name ?? profile.email,
          tier: profile.tier,
          is_superadmin: profile.is_superadmin,
          created_at: profile.created_at,
        });
        lastIdRef.current = user.id;
      }
    } else if (!user && lastIdRef.current) {
      posthog.reset();
      lastIdRef.current = null;
    }
  }, [user, profile]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY || initialized) return;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      persistence: "localStorage",
      disable_session_recording: true,
      enable_surveys: false,
      autocapture: false,
    });
    initialized = true;
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogUserSync />
      {children}
    </>
  );
}
