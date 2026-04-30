"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSendCode = async () => {
    if (!email) return;
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setStep("code");
    }
  };

  const handleVerify = async () => {
    if (!code) return;
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push("/welcome");
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center space-y-4 pb-2">
          <Link href="/" className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="font-mono text-lg font-bold tracking-tight">
              ODDS<span className="text-primary">INTEL</span>
            </span>
          </Link>
          <div className="text-center">
            <h1 className="text-lg font-semibold">Create your free account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Free forever — upgrade to Pro when you&apos;re ready
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
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                />
              </div>

              {/* What you get */}
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

              <Button
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleSendCode}
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
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to{" "}
                <span className="text-foreground">{email}</span>. Enter it below to confirm your account.
              </p>

              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  autoFocus
                />
              </div>

              <Button
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleVerify}
                disabled={loading || code.length < 6}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm account"}
              </Button>

              <button
                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
                onClick={() => { setStep("email"); setCode(""); setError(null); }}
              >
                Use a different email
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
