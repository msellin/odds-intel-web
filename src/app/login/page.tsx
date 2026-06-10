"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, Loader2, Eye, EyeOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { GoogleSignIn, DiscordSignIn, AuthDivider } from "@/components/google-sign-in";
import { captureEvent } from "@/components/posthog-provider";

const emailDomain = (e: string) =>
  e.includes("@") ? e.split("@")[1]?.toLowerCase() ?? null : null;

type Mode = "password" | "magic";
type Step = "form" | "magic_sent";

// Supabase returns the same generic message for "wrong password", "user has
// no password set", and "user doesn't exist" — by design (prevents user
// enumeration). We surface a recovery UI in all three cases.
const isCredentialError = (msg: string) =>
  /invalid login credentials|invalid email or password/i.test(msg);

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") as "pro" | "elite" | null;
  const fromSignupHint = searchParams.get("from") === "signup_exists";

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  const emailFocusedRef = useRef(false);
  const emailTypedRef = useRef(false);

  useEffect(() => {
    captureEvent("login_page_viewed", {
      has_plan: Boolean(plan),
      plan: plan ?? null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    });
  }, [plan]);

  useEffect(() => {
    if (step === "magic_sent") {
      captureEvent("login_magic_sent_screen_viewed", { email_domain: emailDomain(email) });
    }
  }, [step, email]);

  const handleEmailFocus = () => {
    if (emailFocusedRef.current) return;
    emailFocusedRef.current = true;
    captureEvent("login_email_focused");
  };
  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (!emailTypedRef.current && v.length > 0) {
      emailTypedRef.current = true;
      captureEvent("login_email_typed");
    }
  };

  const handlePasswordLogin = async () => {
    if (!email || !password) return;
    captureEvent("login_password_submit_clicked", {
      email_domain: emailDomain(email),
    });
    setError(null);
    setShowRecovery(false);
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      captureEvent("login_password_error", {
        error_message: error.message,
        email_domain: emailDomain(email),
      });
      if (isCredentialError(error.message)) {
        // Most likely: user signed up via Google/magic link and never set a
        // password. Show recovery options instead of the cryptic error.
        captureEvent("login_password_recovery_shown", {
          email_domain: emailDomain(email),
        });
        setShowRecovery(true);
        setError(null);
      } else {
        setError(error.message);
      }
      return;
    }
    captureEvent("login_password_success", { email_domain: emailDomain(email) });
    router.push(plan ? `/pricing?plan=${plan}` : "/matches");
  };

  // One-click recovery: send a magic link to the email already typed in.
  const handleRecoveryMagicLink = async () => {
    if (!email) return;
    captureEvent("login_recovery_magic_link_clicked", { email_domain: emailDomain(email) });
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("signups not allowed")) {
        router.push(
          plan
            ? `/signup?plan=${plan}&email=${encodeURIComponent(email)}`
            : `/signup?email=${encodeURIComponent(email)}`
        );
      } else {
        captureEvent("login_recovery_magic_link_error", {
          error_message: error.message,
          email_domain: emailDomain(email),
        });
        setError(error.message);
      }
    } else {
      captureEvent("login_recovery_magic_link_sent", { email_domain: emailDomain(email) });
      setStep("magic_sent");
    }
  };

  const handleMagicLink = async () => {
    if (!email) return;
    captureEvent("login_magic_link_submit_clicked", {
      email_domain: emailDomain(email),
    });
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("signups not allowed")) {
        // No account exists — push them to signup with email prefilled.
        router.push(
          plan
            ? `/signup?plan=${plan}&email=${encodeURIComponent(email)}`
            : `/signup?email=${encodeURIComponent(email)}`
        );
      } else {
        captureEvent("login_magic_link_error", {
          error_message: error.message,
          email_domain: emailDomain(email),
        });
        setError(error.message);
      }
    } else {
      captureEvent("login_magic_link_sent", { email_domain: emailDomain(email) });
      setStep("magic_sent");
    }
  };

  const submit = () => (mode === "password" ? handlePasswordLogin() : handleMagicLink());
  const submitDisabled =
    loading || !email || (mode === "password" && !password);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center space-y-4 pb-2">
        <Link href="/" className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <span className="font-mono text-lg font-bold tracking-tight">
            ODDS<span className="text-primary">INTEL</span>
          </span>
        </Link>
        <h1 className="text-center text-lg font-semibold">
          {plan ? `Sign in to get ${plan.charAt(0).toUpperCase() + plan.slice(1)}` : "Sign in to OddsIntel"}
        </h1>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {fromSignupHint && step === "form" && (
          <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm text-amber-200">
            You already have an account. Sign in below — if you signed up
            with Google or a magic link, use those options or click{" "}
            <span className="font-medium">Forgot</span> to set a password.
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
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>

            {mode === "password" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                    className="text-xs text-muted-foreground hover:text-primary"
                    onClick={() => captureEvent("login_forgot_password_clicked")}
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
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
                <p className="text-xs text-muted-foreground">
                  First time signing in with a password? Click{" "}
                  <span className="text-foreground">Forgot</span> to set one.
                </p>
              </div>
            )}

            {showRecovery && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-3 space-y-2">
                <p className="text-sm text-amber-200 font-medium">
                  Can&apos;t sign in with that password.
                </p>
                <p className="text-xs text-amber-200/80">
                  Either the password is wrong, or you signed up before with
                  Google / a magic link and never set one. Pick a way to
                  recover:
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={handleRecoveryMagicLink}
                    disabled={loading || !email}
                    className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/40"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Email a sign-in link to ${email}`}
                  </Button>
                  <Link
                    href={`/forgot-password?email=${encodeURIComponent(email)}`}
                    onClick={() => captureEvent("login_recovery_reset_clicked")}
                    className="text-center text-xs text-amber-200/80 hover:text-amber-100"
                  >
                    Reset my password instead
                  </Link>
                </div>
              </div>
            )}

            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={submit}
              disabled={submitDisabled}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "password" ? (
                "Sign in"
              ) : (
                "Send sign-in link"
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                const next: Mode = mode === "password" ? "magic" : "password";
                captureEvent("login_mode_toggled", { to: next });
                setMode(next);
                setError(null);
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {mode === "password"
                ? "No password? Email me a sign-in link instead"
                : "Sign in with password"}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link
                href={plan ? `/signup?plan=${plan}` : "/signup"}
                className="text-primary hover:underline"
                onClick={() => captureEvent("login_signup_link_clicked", { plan: plan ?? null })}
              >
                Sign up free
              </Link>
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
                captureEvent("login_use_different_email_clicked");
                setStep("form");
                setError(null);
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
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Suspense fallback={<div className="w-full max-w-sm h-72 rounded-xl border border-white/[0.06] animate-pulse bg-card/20" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
