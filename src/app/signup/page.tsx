"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TrendingUp, Check, Loader2 } from "lucide-react";
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

const FREE_FEATURES = [
  "All today's fixtures + live scores",
  "Best odds (H/D/A) across all bookmakers",
  "H2H record, standings & team form",
  "Favorite teams & personalized \"My Matches\" feed",
  "Prediction tracker — log picks & track your hit rate",
  "Daily free AI value bet pick",
  "Match notes & community voting",
];

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "sent">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") as "pro" | "elite" | null;

  const handleSendLink = async () => {
    if (!email) return;
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setStep("sent");
    }
  };

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

        {step === "email" ? (
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
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendLink()}
              />
            </div>

            {/* What you get */}
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
              onClick={handleSendLink}
              disabled={loading || !email}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Free Account"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By signing up you agree to our{" "}
              <Link href="/terms" className="text-primary hover:underline">Terms</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href={plan ? `/login?plan=${plan}` : "/login"} className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </>
        ) : (
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
              onClick={() => { setStep("email"); setError(null); }}
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
