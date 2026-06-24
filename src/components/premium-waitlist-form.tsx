"use client";

/**
 * Premium-waitlist email capture for the landing CTA strip.
 *
 * Posts to /api/v1/waitlist. Three states: idle → submitting → success.
 * No password, no signup, no commitment. Just an email + a quiet
 * confirmation. We don't promise WHEN we'll launch a paid tier; the form
 * copy is intentionally non-committal so we capture demand signal
 * without manufacturing expectations.
 */
import { useState } from "react";
import { Mail } from "lucide-react";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; alreadyOnList: boolean }
  | { kind: "error"; message: string };

export function PremiumWaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "submitting") return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: json.error ?? "Could not record." });
        return;
      }
      setState({ kind: "success", alreadyOnList: !!json.alreadyOnList });
    } catch {
      setState({
        kind: "error",
        message: "Network error — try again.",
      });
    }
  }

  if (state.kind === "success") {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-200">
        {state.alreadyOnList
          ? "You're already on the list — we'll be in touch."
          : "Got it. We'll email you when there's something worth paying for."}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Premium tier — coming later
      </p>
      <p className="mb-4 text-sm text-neutral-400">
        The current product is free for everyone. If we build a paid tier
        with deeper picks, earlier signals, or higher-edge selections, want
        to know?
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={state.kind === "submitting"}
            placeholder="you@example.com"
            className="w-full rounded-md border border-white/15 bg-neutral-950 py-2.5 pl-10 pr-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>
        <button
          type="submit"
          disabled={state.kind === "submitting" || !EMAIL_RE.test(email)}
          className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state.kind === "submitting" ? "Sending…" : "Notify me"}
        </button>
      </div>
      {state.kind === "error" && (
        <p className="mt-2 text-xs text-red-400">{state.message}</p>
      )}
      <p className="mt-3 text-xs text-neutral-600">
        One email when (if) we launch. No spam, no newsletter.
      </p>
    </form>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
