"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, Loader2, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { GoogleSignIn, DiscordSignIn, AuthDivider } from "@/components/google-sign-in";
import { captureEvent } from "@/components/posthog-provider";
import { getTurnstileToken } from "@/lib/turnstile";

const MIN_PASSWORD = 6;

const emailDomain = (e: string) =>
  e.includes("@") ? e.split("@")[1]?.toLowerCase() ?? null : null;

// Supabase returns the same generic message for "wrong password", "no
// password set", and "user doesn't exist" — by design (prevents user
// enumeration). We surface a recovery UI in all these cases.
const isCredentialError = (msg: string) =>
  /invalid login credentials|invalid email or password/i.test(msg);

type Step = "form" | "magic_sent" | "confirm_required";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") as "pro" | "elite" | null;

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  const emailFocusedRef = useRef(false);
  const emailTypedRef = useRef(false);
  const passwordTypedRef = useRef(false);

  useEffect(() => {
    captureEvent("auth_page_viewed", {
      has_plan: Boolean(plan),
      plan: plan ?? null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    });
  }, [plan]);

  useEffect(() => {
    if (step === "magic_sent") {
      captureEvent("auth_magic_sent_screen_viewed", { email_domain: emailDomain(email) });
    } else if (step === "confirm_required") {
      captureEvent("auth_confirm_required_screen_viewed", { email_domain: emailDomain(email) });
    }
  }, [step, email]);

  const handleEmailFocus = () => {
    if (emailFocusedRef.current) return;
    emailFocusedRef.current = true;
    captureEvent("auth_email_focused");
  };
  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (!emailTypedRef.current && v.length > 0) {
      emailTypedRef.current = true;
      captureEvent("auth_email_typed");
    }
  };
  const handlePasswordChange = (v: string) => {
    setPassword(v);
    if (!passwordTypedRef.current && v.length > 0) {
      passwordTypedRef.current = true;
      captureEvent("auth_password_typed");
    }
  };

  // Unified continue: try signIn → fall back to signUp on credential error.
  // The user clicked one button — the system figures out which they need.
  const handleContinue = async () => {
    if (!email || password.length < MIN_PASSWORD) return;
    captureEvent("auth_continue_clicked", {
      email_domain: emailDomain(email),
      has_plan: Boolean(plan),
      plan: plan ?? null,
    });
    setError(null);
    setShowRecovery(false);
    setLoading(true);

    const supabase = createSupabaseBrowser();

    // Try sign-in first.
    const signInCaptcha = await getTurnstileToken();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
      ...(signInCaptcha ? { options: { captchaToken: signInCaptcha } } : {}),
    });
    if (!signInErr) {
      setLoading(false);
      captureEvent("auth_signed_in_existing", { email_domain: emailDomain(email) });
      router.push("/picks");
      return;
    }

    // Sign-in failed. If it's a credential error, treat as "new user OR
    // existing user with wrong password" and try sign-up. Supabase's
    // anti-enumeration behavior means we'll silently no-op for existing
    // users — handled on the confirm screen with a prominent recovery link.
    if (!isCredentialError(signInErr.message)) {
      setLoading(false);
      captureEvent("auth_signin_error_non_credential", {
        error_message: signInErr.message,
        email_domain: emailDomain(email),
      });
      setError(signInErr.message);
      return;
    }

    const signUpCaptcha = await getTurnstileToken();
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback${plan ? `?plan=${plan}` : ""}`,
        ...(signUpCaptcha ? { captchaToken: signUpCaptcha } : {}),
      },
    });
    setLoading(false);

    if (signUpErr) {
      // With Confirm Email ON, Supabase rarely errors on "already registered"
      // (it returns a fake-looking success instead). If it DOES error, fall
      // through to the recovery panel.
      captureEvent("auth_signup_error", {
        error_message: signUpErr.message,
        email_domain: emailDomain(email),
      });
      if (/already (registered|exists|in use)|user already/i.test(signUpErr.message)) {
        setShowRecovery(true);
        return;
      }
      setError(signUpErr.message);
      return;
    }

    if (signUpData.session) {
      // Confirm Email OFF: brand-new user is signed in immediately.
      captureEvent("auth_signed_in_new", { email_domain: emailDomain(email) });
      router.push("/picks");
    } else {
      // Confirm Email ON: confirmation email sent (new user) OR silently
      // no-op'd (existing user, wrong password). We show "Check your email"
      // with prominent recovery links to catch the existing-user case.
      captureEvent("auth_confirm_email_sent_or_anti_enum", {
        email_domain: emailDomain(email),
      });
      setStep("confirm_required");
    }
  };

  const handleMagicLink = async () => {
    if (!email) return;
    captureEvent("auth_magic_link_clicked", { email_domain: emailDomain(email) });
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const otpCaptcha = await getTurnstileToken();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback${plan ? `?plan=${plan}` : ""}`,
        ...(otpCaptcha ? { captchaToken: otpCaptcha } : {}),
      },
    });
    setLoading(false);
    if (error) {
      captureEvent("auth_magic_link_error", {
        error_message: error.message,
        email_domain: emailDomain(email),
      });
      setError(error.message);
    } else {
      captureEvent("auth_magic_link_sent", { email_domain: emailDomain(email) });
      setStep("magic_sent");
    }
  };

  const continueDisabled = loading || !email || password.length < MIN_PASSWORD;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center space-y-4 pb-2">
        <Link href="/" className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <span className="font-mono text-lg font-bold tracking-tight">
            ODDS<span className="text-primary">INTEL</span>
          </span>
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-semibold">
            {plan
              ? `Log in to get ${plan.charAt(0).toUpperCase() + plan.slice(1)}`
              : "Log in to OddsIntel"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            New here? Just enter your email and a password — we&apos;ll create your account.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === "form" && (
          <>
            <GoogleSignIn />
            <DiscordSignIn />
            <AuthDivider />

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onFocus={handleEmailFocus}
                onChange={(e) => handleEmailChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleContinue()}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                  className="text-xs text-muted-foreground hover:text-primary"
                  onClick={() => captureEvent("auth_forgot_password_clicked")}
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={`At least ${MIN_PASSWORD} characters`}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleContinue()}
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

            {showRecovery && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-3 space-y-2">
                <p className="text-sm text-amber-200 font-medium">
                  Couldn&apos;t sign you in with that password.
                </p>
                <p className="text-xs text-amber-200/80">
                  If you signed up before with Google or a magic link, you may
                  not have set a password yet. Pick a recovery option:
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={handleMagicLink}
                    disabled={loading || !email}
                    className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/40"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Email a sign-in link to ${email}`
                    )}
                  </Button>
                  <Link
                    href={`/forgot-password?email=${encodeURIComponent(email)}`}
                    onClick={() => captureEvent("auth_recovery_reset_clicked")}
                    className="text-center text-xs text-amber-200/80 hover:text-amber-100"
                  >
                    Reset my password instead
                  </Link>
                </div>
              </div>
            )}

            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleContinue}
              disabled={continueDisabled}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
            </Button>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={loading || !email}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Or email me a sign-in link instead
            </button>

            <p className="text-center text-xs text-muted-foreground">
              By continuing you agree to our{" "}
              <Link
                href="/terms"
                className="text-primary hover:underline"
                onClick={() => captureEvent("auth_terms_clicked")}
              >
                Terms
              </Link>
              {" "}and{" "}
              <Link
                href="/privacy"
                className="text-primary hover:underline"
                onClick={() => captureEvent("auth_privacy_clicked")}
              >
                Privacy Policy
              </Link>.
            </p>
          </>
        )}

        {step === "magic_sent" && (
          <>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link to{" "}
              <span className="text-foreground font-medium">{email}</span>.
              Click the link in your email to continue.
            </p>
            <p className="text-xs text-muted-foreground">
              The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
            </p>
            <button
              className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              onClick={() => {
                captureEvent("auth_use_different_email_clicked");
                setStep("form");
                setError(null);
                setShowRecovery(false);
              }}
            >
              Use a different email
            </button>
          </>
        )}

        {step === "confirm_required" && (
          <>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="text-foreground font-medium">{email}</span>.
              Click it to activate your account, then you&apos;ll be signed in
              with the password you just picked.
            </p>
            <p className="text-xs text-muted-foreground">
              Check your spam folder if you don&apos;t see it within a minute.
            </p>

            <div className="rounded-md bg-muted/30 border border-border/50 px-3 py-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">Already had an account?</span>{" "}
                If you signed up before, the email might not arrive (we don&apos;t
                send duplicates). Use these instead:
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  href={`/forgot-password?email=${encodeURIComponent(email)}`}
                  onClick={() => captureEvent("auth_confirm_reset_clicked")}
                  className="text-center text-xs text-primary hover:underline"
                >
                  Reset my password
                </Link>
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={loading}
                  className="text-center text-xs text-primary hover:underline disabled:opacity-50"
                >
                  Email me a sign-in link
                </button>
              </div>
            </div>

            <button
              className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              onClick={() => {
                captureEvent("auth_use_different_email_clicked");
                setStep("form");
                setError(null);
                setShowRecovery(false);
              }}
            >
              Use a different email
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <Suspense fallback={<div className="w-full max-w-md h-96 rounded-xl border border-white/[0.06] animate-pulse bg-card/20" />}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
