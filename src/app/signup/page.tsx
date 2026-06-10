"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, Check, Loader2, Eye, EyeOff } from "lucide-react";
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

const MIN_PASSWORD = 6; // Supabase project setting

const emailDomain = (e: string) =>
  e.includes("@") ? e.split("@")[1]?.toLowerCase() ?? null : null;

const FREE_FEATURES = [
  "All today's fixtures + live scores",
  "Best odds (H/D/A) across all bookmakers",
  "H2H record, standings & team form",
  "Favorite teams & personalized \"My Matches\" feed",
  "Prediction tracker — log picks & track your hit rate",
  "Daily free AI value bet pick",
  "Match notes & community voting",
];

type Mode = "password" | "magic";
type Step = "form" | "confirm_required" | "magic_sent";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") as "pro" | "elite" | null;
  const prefilledEmail = searchParams.get("email") ?? "";

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailFocusedRef = useRef(false);
  const emailTypedRef = useRef(false);
  const passwordFocusedRef = useRef(false);
  const passwordTypedRef = useRef(false);

  useEffect(() => {
    captureEvent("signup_page_viewed", {
      has_plan: Boolean(plan),
      plan: plan ?? null,
      has_prefilled_email: Boolean(prefilledEmail),
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    });
  }, [plan, prefilledEmail]);

  useEffect(() => {
    if (step === "magic_sent") {
      captureEvent("signup_sent_screen_viewed", { email_domain: emailDomain(email) });
    } else if (step === "confirm_required") {
      captureEvent("signup_confirm_email_required", { email_domain: emailDomain(email) });
    }
  }, [step, email]);

  const handleEmailFocus = () => {
    if (emailFocusedRef.current) return;
    emailFocusedRef.current = true;
    captureEvent("signup_email_focused");
  };
  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (!emailTypedRef.current && v.length > 0) {
      emailTypedRef.current = true;
      captureEvent("signup_email_typed");
    }
  };
  const handlePasswordFocus = () => {
    if (passwordFocusedRef.current) return;
    passwordFocusedRef.current = true;
    captureEvent("signup_password_focused");
  };
  const handlePasswordChange = (v: string) => {
    setPassword(v);
    if (!passwordTypedRef.current && v.length > 0) {
      passwordTypedRef.current = true;
      captureEvent("signup_password_typed");
    }
  };

  const handlePasswordSignup = async () => {
    if (!email || password.length < MIN_PASSWORD) return;
    captureEvent("signup_password_submit_clicked", {
      email_domain: emailDomain(email),
      has_plan: Boolean(plan),
      plan: plan ?? null,
    });
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback${plan ? `?plan=${plan}` : ""}`,
      },
    });
    setLoading(false);

    if (error) {
      captureEvent("signup_password_error", {
        error_message: error.message,
        email_domain: emailDomain(email),
      });
      // Email already has an account — gently shepherd them to /login instead
      // of showing the cryptic Supabase error.
      if (/already (registered|exists|in use)|user already/i.test(error.message)) {
        captureEvent("signup_already_registered_redirect", {
          email_domain: emailDomain(email),
        });
        const q = new URLSearchParams({
          email,
          from: "signup_exists",
        });
        if (plan) q.set("plan", plan);
        router.push(`/login?${q.toString()}`);
        return;
      }
      setError(error.message);
      return;
    }

    if (data.session) {
      // Confirm-email is OFF in Supabase — they're fully signed in already.
      captureEvent("signup_password_success_immediate", { email_domain: emailDomain(email) });
      router.push(plan ? `/pricing?plan=${plan}` : "/matches");
    } else {
      // Confirm-email is ON — they need to click the link in their email first.
      captureEvent("signup_password_success_confirm_required", {
        email_domain: emailDomain(email),
      });
      setStep("confirm_required");
    }
  };

  const handleMagicLink = async () => {
    if (!email) return;
    captureEvent("signup_magic_link_submit_clicked", {
      email_domain: emailDomain(email),
      has_plan: Boolean(plan),
      plan: plan ?? null,
    });
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback${plan ? `?plan=${plan}` : ""}`,
      },
    });
    setLoading(false);
    if (error) {
      captureEvent("signup_magic_link_error", {
        error_message: error.message,
        email_domain: emailDomain(email),
      });
      setError(error.message);
    } else {
      captureEvent("signup_magic_link_sent", { email_domain: emailDomain(email) });
      setStep("magic_sent");
    }
  };

  const submit = () => (mode === "password" ? handlePasswordSignup() : handleMagicLink());

  const submitDisabled =
    loading ||
    !email ||
    (mode === "password" && password.length < MIN_PASSWORD);

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
            {plan ? `Create your account to get ${plan.charAt(0).toUpperCase() + plan.slice(1)}` : "Create your free account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {plan ? "You'll be taken to checkout right after." : "Free forever — upgrade to Pro when you're ready"}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
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
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>

            {mode === "password" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={`At least ${MIN_PASSWORD} characters`}
                    value={password}
                    onFocus={handlePasswordFocus}
                    onChange={(e) => handlePasswordChange(e.target.value)}
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
              </div>
            )}

            {!plan && (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Free account includes
                </p>
                <ul className="space-y-1.5">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground/80">
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
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
                "Create Free Account"
              ) : (
                "Send sign-in link"
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                const next: Mode = mode === "password" ? "magic" : "password";
                captureEvent("signup_mode_toggled", { to: next });
                setMode(next);
                setError(null);
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {mode === "password"
                ? "No password? Email me a sign-in link instead"
                : "Use a password instead"}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              By signing up you agree to our{" "}
              <Link
                href="/terms"
                className="text-primary hover:underline"
                onClick={() => captureEvent("signup_terms_clicked")}
              >
                Terms
              </Link>
              {" "}and{" "}
              <Link
                href="/privacy"
                className="text-primary hover:underline"
                onClick={() => captureEvent("signup_privacy_clicked")}
              >
                Privacy Policy
              </Link>.
            </p>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href={plan ? `/login?plan=${plan}` : "/login"}
                className="text-primary hover:underline"
                onClick={() => captureEvent("signup_signin_link_clicked", { plan: plan ?? null })}
              >
                Sign in
              </Link>
            </p>
          </>
        )}

        {step === "magic_sent" && (
          <>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link to{" "}
              <span className="text-foreground font-medium">{email}</span>.
              Click the link in your email to confirm your account.
            </p>
            <p className="text-xs text-muted-foreground">
              The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
            </p>
            <button
              className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              onClick={() => {
                captureEvent("signup_use_different_email_clicked");
                setStep("form");
                setError(null);
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
              Click it to activate your account — then you can sign in with the
              password you just picked.
            </p>
            <p className="text-xs text-muted-foreground">
              Check your spam folder if you don&apos;t see it within a minute.
            </p>
            <button
              className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              onClick={() => {
                captureEvent("signup_use_different_email_clicked");
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

export default function SignUpPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <Suspense fallback={<div className="w-full max-w-md h-96 rounded-xl border border-white/[0.06] animate-pulse bg-card/20" />}>
        <SignUpForm />
      </Suspense>
    </div>
  );
}
