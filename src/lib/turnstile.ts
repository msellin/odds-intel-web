// ANON-AUTH PHASE 4 — Cloudflare Turnstile captcha for anonymous sign-ins.
//
// Supabase rejects signInAnonymously() with no captchaToken once captcha
// is enabled in Auth → Attack Protection. This module loads the
// Cloudflare Turnstile JS lazily, renders an invisible widget on demand,
// and resolves with a fresh token (or null on failure).
//
// Design: invisible Turnstile in "execute"-style mode. We render a tiny
// off-screen container per call, wait for the callback, then clean up
// the DOM node + widget. No global state, no React Context.

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TIMEOUT_MS = 10_000;

interface TurnstileRenderOptions {
  sitekey: string;
  size?: "invisible" | "compact" | "normal";
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile script load failed"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Get a fresh Turnstile captcha token. Returns `null` if:
 *   - Site key isn't configured (graceful pass-through for dev / pre-deploy)
 *   - Script fails to load (network)
 *   - Turnstile callback errors / expires / times out (10s budget)
 *
 * Caller decides what to do with null:
 *   - For signInAnonymously: pass through; Supabase will reject if captcha
 *     is required, succeed if it isn't.
 *
 * Token is single-use — Supabase verifies it server-side and burns it.
 * Don't cache or reuse.
 */
export async function getTurnstileToken(): Promise<string | null> {
  if (!SITE_KEY) return null;
  if (typeof window === "undefined") return null;

  try {
    await loadScript();
  } catch {
    return null;
  }
  if (!window.turnstile) return null;

  return new Promise<string | null>((resolve) => {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.bottom = "0";
    container.style.right = "0";
    container.style.opacity = "0";
    container.style.pointerEvents = "none";
    container.style.zIndex = "-1";
    document.body.appendChild(container);

    let widgetId: string | undefined;
    let settled = false;

    const cleanup = () => {
      if (widgetId && window.turnstile) {
        try { window.turnstile.remove(widgetId); } catch {}
      }
      if (container.parentNode) container.parentNode.removeChild(container);
    };

    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(token);
    };

    try {
      widgetId = window.turnstile!.render(container, {
        sitekey: SITE_KEY,
        size: "invisible",
        callback: (token) => finish(token),
        "error-callback": () => finish(null),
        "expired-callback": () => finish(null),
        "timeout-callback": () => finish(null),
      });
    } catch {
      finish(null);
      return;
    }

    setTimeout(() => finish(null), TIMEOUT_MS);
  });
}
