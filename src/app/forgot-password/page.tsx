"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { captureEvent } from "@/components/posthog-provider";
import { getTurnstileToken } from "@/lib/turnstile";

const emailDomain = (e: string) =>
  e.includes("@") ? e.split("@")[1]?.toLowerCase() ?? null : null;

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email) return;
    captureEvent("forgot_password_submitted", { email_domain: emailDomain(email) });
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const captchaToken = await getTurnstileToken();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      ...(captchaToken ? { captchaToken } : {}),
    });
    setLoading(false);
    if (error) {
      captureEvent("forgot_password_error", {
        error_message: error.message,
        email_domain: emailDomain(email),
      });
      setError(error.message);
    } else {
      captureEvent("forgot_password_email_sent", { email_domain: emailDomain(email) });
      setSent(true);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center space-y-4 pb-2">
        <Link href="/" className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <span className="font-mono text-lg font-bold tracking-tight">
            ODDS<span className="text-primary">INTEL</span>
          </span>
        </Link>
        <h1 className="text-center text-lg font-semibold">Reset your password</h1>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!sent ? (
          <>
            <p className="text-sm text-muted-foreground">
              Enter your account email and we&apos;ll send you a link to set a new password.
            </p>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                autoFocus
              />
            </div>
            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={submit}
              disabled={loading || !email}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Remembered it?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              We sent a password reset link to{" "}
              <span className="text-foreground font-medium">{email}</span>.
              Click the link in your email to choose a new password.
            </p>
            <p className="text-xs text-muted-foreground">
              The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Suspense fallback={<div className="w-full max-w-sm h-72 rounded-xl border border-white/[0.06] animate-pulse bg-card/20" />}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
