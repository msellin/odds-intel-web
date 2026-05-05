"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, Loader2 } from "lucide-react";
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

function LoginForm() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "sent">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
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
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("signups not allowed")) {
        router.push(plan ? `/signup?plan=${plan}&email=${encodeURIComponent(email)}` : `/signup?email=${encodeURIComponent(email)}`);
      } else {
        setError(error.message);
      }
    } else {
      setStep("sent");
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

            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleSendLink}
              disabled={loading || !email}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send sign-in link"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link href={plan ? `/signup?plan=${plan}` : "/signup"} className="text-primary hover:underline">
                Sign up free
              </Link>
            </p>
          </>
        ) : (
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

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Suspense fallback={<div className="w-full max-w-sm h-72 rounded-xl border border-white/[0.06] animate-pulse bg-card/20" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
