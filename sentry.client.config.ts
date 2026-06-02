// SENTRY-FEEDBACK-ONLY (2026-06-02): Sentry is stripped to feedback only.
// We hit the free-tier transaction cap with tracesSampleRate=0.1, and the
// rest of the SDK (error capture, traces, replay) isn't load-bearing for
// the product right now. If we want production error tracking back later,
// re-enable here + restore instrumentation.ts + the captureException
// call-sites listed in git history (commit removing SENTRY-FEEDBACK-ONLY).
//
// What stays:
//   - The feedbackIntegration widget — a slide-out "Feedback" tab on the
//     right edge of every page. Auto-captures URL + breadcrumbs + viewport.
//     Submissions land in Sentry's "User Feedback" tab.
//   - tunnelRoute: '/monitoring' in next.config.ts so ad blockers don't
//     swallow feedback POSTs (Sentry domain is on most lists).
//
// What's gone:
//   - tracesSampleRate / transactions (the cap-hitter)
//   - Server + edge configs (deleted)
//   - instrumentation.ts (deleted)
//   - Sentry.captureException at call-sites — replaced with console.error
//     (good enough for now; we can wire something else when we need it)

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // No transactions, no errors — feedback widget only. SDK still needs
    // init() to register the integration.
    tracesSampleRate: 0,
    sampleRate: 0,
    integrations: [
      Sentry.feedbackIntegration({
        // Dark theme matches the site shell.
        colorScheme: "dark",
        // We're a self-serve product — no Sentry branding needed.
        showBranding: false,
        // Triggers the slide-out widget on the right edge.
        autoInject: true,
        buttonLabel: "Feedback",
        submitButtonLabel: "Send",
        cancelButtonLabel: "Cancel",
        formTitle: "Send us feedback",
        messageLabel: "What's on your mind?",
        messagePlaceholder:
          "Bug, idea, missing feature, pricing question — whatever. We read every one.",
        successMessageText: "Thanks — we read every one of these.",
        // Email field optional (signed-in users have an account email
        // already; anon visitors can skip).
        emailLabel: "Email (optional)",
        isEmailRequired: false,
        showName: false,
      }),
    ],
  });
}
