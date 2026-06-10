"use client";

// ANON-AUTH PHASE 3: in-place upgrade modal for anonymous users.
//
// Preserves user.id by using linkIdentity (OAuth) and updateUser (email
// +password) instead of signInWithOAuth / signUp. All data the anon user
// has already saved (favorites, tracker picks) automatically carries over
// because it's keyed on auth.uid().
//
// Requires "Allow manual linking" enabled in Supabase Auth → Providers
// for the OAuth path to work. If disabled, linkIdentity errors and we
// surface the message in the modal.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Eye, EyeOff, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { captureEvent } from "@/components/posthog-provider";

const MIN_PASSWORD = 6;

const emailDomain = (e: string) =>
  e.includes("@") ? e.split("@")[1]?.toLowerCase() ?? null : null;

export type UpgradeTrigger =
  | "3rd_favorite"
  | "nth_pick"
  | "pro_feature_gate"
  | "banner"
  | "manual"
  | "stripe_checkout_blocked";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: UpgradeTrigger;
}

export function UpgradeModal({ open, onOpenChange, trigger }: UpgradeModalProps) {
  const { user, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConflictHelp, setShowConflictHelp] = useState(false);

  useEffect(() => {
    if (open) {
      captureEvent("anon_upgrade_modal_shown", { trigger });
    }
  }, [open, trigger]);

  const reset = () => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError(null);
    setShowConflictHelp(false);
    setLoading(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleOAuthUpgrade = async (provider: "google" | "discord") => {
    captureEvent("anon_upgrade_method_chosen", { provider, trigger });
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      captureEvent("anon_upgrade_error", {
        provider,
        error_message: error.message,
        trigger,
      });
      // Most likely cause: "Manual linking is disabled" Supabase project setting
      if (error.message.toLowerCase().includes("manual linking")) {
        setError(
          "OAuth linking is currently disabled on the server. Please use email + password below, or contact support."
        );
      } else {
        setError(error.message);
      }
      setLoading(false);
    }
    // On success the browser is mid-redirect — no further client work
  };

  const handleEmailPasswordUpgrade = async () => {
    if (!email || password.length < MIN_PASSWORD) return;
    captureEvent("anon_upgrade_method_chosen", { provider: "password", trigger });
    setError(null);
    setShowConflictHelp(false);
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase.auth.updateUser({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      captureEvent("anon_upgrade_error", {
        provider: "password",
        error_message: error.message,
        email_domain: emailDomain(email),
        trigger,
      });

      // Merge-conflict: that email is already a different account
      if (
        /already (registered|exists|in use|been taken)|email.*registered/i.test(
          error.message
        )
      ) {
        captureEvent("anon_upgrade_conflict", {
          email_domain: emailDomain(email),
          trigger,
        });
        setShowConflictHelp(true);
        setError(
          "That email already belongs to another account. Your current favorites can't be merged automatically."
        );
        return;
      }
      setError(error.message);
      return;
    }

    captureEvent("anon_upgrade_success", {
      provider: "password",
      email_domain: emailDomain(email),
      trigger,
      user_id: data.user?.id,
    });

    // Profile row already exists from the anon trigger; refresh so the
    // updated email/identity is reflected client-side.
    await refreshProfile();
    handleClose(false);
  };

  const submitDisabled = loading || !email || password.length < MIN_PASSWORD;

  // The modal only meaningfully applies to anon users. If a real user
  // somehow opens it (programmer error), render a graceful message.
  const isReallyAnon =
    Boolean(user?.is_anonymous) ||
    (user && user.email == null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
            Save your work across devices
          </DialogTitle>
          <DialogDescription>
            {trigger === "3rd_favorite"
              ? "You're following matches — sign up free so your favorites survive a browser refresh or device switch."
              : trigger === "pro_feature_gate"
                ? "Create a free account to unlock more — you can keep using everything you already saved."
                : trigger === "stripe_checkout_blocked"
                  ? "You need an account before subscribing. Your existing favorites and picks will be preserved."
                  : "Sign up free — your existing favorites and picks carry over."}
          </DialogDescription>
        </DialogHeader>

        {!isReallyAnon && (
          <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm text-emerald-200">
            You&apos;re already signed in.
          </div>
        )}

        {isReallyAnon && (
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => handleOAuthUpgrade("google")}
                disabled={loading}
                className="w-full bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.12] text-foreground"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => handleOAuthUpgrade("discord")}
                disabled={loading}
                className="w-full bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.12] text-foreground"
              >
                Continue with Discord
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.06]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-muted-foreground">or</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upgrade-email">Email</Label>
              <Input
                id="upgrade-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="upgrade-password">Password</Label>
              <div className="relative">
                <Input
                  id="upgrade-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={`At least ${MIN_PASSWORD} characters`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailPasswordUpgrade()}
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleEmailPasswordUpgrade}
              disabled={submitDisabled}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create my account"}
            </Button>

            {showConflictHelp && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-3 space-y-2">
                <p className="text-xs text-amber-200">
                  Your favorites can&apos;t merge into the existing account
                  automatically. You have two options:
                </p>
                <Link
                  href={`/login?email=${encodeURIComponent(email)}`}
                  onClick={() => captureEvent("anon_upgrade_conflict_signin_clicked", { trigger })}
                  className="block text-center text-xs text-amber-100 underline"
                >
                  Sign in to that existing account (current favorites lost)
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowConflictHelp(false);
                    setEmail("");
                    setError(null);
                  }}
                  className="block w-full text-center text-xs text-amber-200/70 hover:text-amber-200"
                >
                  Use a different email
                </button>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link
                href={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                onClick={() => captureEvent("anon_upgrade_signin_link_clicked", { trigger })}
                className="text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
