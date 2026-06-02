// SENTRY-FEEDBACK-CLIENT-WIRE (2026-06-02): migrated from
// `sentry.client.config.ts` to `src/instrumentation-client.ts` because that's
// the Next 13+ App Router convention that the Sentry v10 SDK now expects.
// The legacy `sentry.client.config.ts` location is still parsed by
// `withSentryConfig` but the auto-init wire became unreliable — the widget
// wasn't appearing on the deployed site even though the config was present.
//
// This file is auto-imported by Next.js on the client at startup (see
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
// No explicit import needed anywhere.
//
// Sentry usage today is feedback-widget ONLY (no errors, no traces — see
// SENTRY-FEEDBACK-ONLY commit for why). If we want production error
// tracking back later, enable here + restore src/instrumentation.ts
// (server/edge hooks) + the captureException call-sites in git history.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // No transactions, no errors — feedback widget only. The SDK still
    // needs init() to register the integration; capture/trace just sample
    // at 0.
    tracesSampleRate: 0,
    sampleRate: 0,
    integrations: [
      Sentry.feedbackIntegration({
        colorScheme: "dark",                  // matches our shell
        showBranding: false,                  // we're a self-serve product
        autoInject: true,                     // floats the right-edge tab
        buttonLabel: "Give feedback",
        submitButtonLabel: "Send",
        cancelButtonLabel: "Cancel",
        formTitle: "Tell us what to change",
        messageLabel: "What would you change, add, or fix?",
        messagePlaceholder:
          "What's missing? What's confusing? What would make this 10× better for you? We read every message — and your input directly shapes what ships next.",
        successMessageText: "Thank you — your feedback shapes what ships next.",
        emailLabel: "Email (optional)",
        isEmailRequired: false,
        showName: false,
      }),
    ],
  });
} else if (typeof window !== "undefined") {
  // Surface the missing-DSN case in dev so it's not silently broken.
  // (Will appear in the browser console only — not user-visible.)
  console.warn(
    "[Sentry] NEXT_PUBLIC_SENTRY_DSN is not set; feedback widget will not render. " +
      "Set it on Vercel + redeploy to enable user feedback collection."
  );
}
