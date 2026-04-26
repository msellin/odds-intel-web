"use client";

import { useState } from "react";
import Link from "next/link";
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

const PLANS = [
  {
    id: "scout",
    name: "Scout",
    price: "Free",
    description: "Basic match data",
  },
  {
    id: "analyst",
    name: "Analyst",
    price: "\u20ac4.99/mo",
    description: "Odds comparison & alerts",
  },
  {
    id: "sharp",
    name: "Sharp",
    price: "\u20ac14.99/mo",
    description: "Value bets & AI insights",
  },
  {
    id: "syndicate",
    name: "Syndicate",
    price: "\u20ac49.99/mo",
    description: "Full access & API",
  },
] as const;

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("sharp");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          selected_plan: selectedPlan,
        },
      },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
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
          <h1 className="text-center text-lg font-semibold">
            Create your account
          </h1>
        </CardHeader>
        <CardContent className="space-y-5">
          {success ? (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-center text-sm text-emerald-400">
              Check your email to confirm your account. You can close this page.
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {/* Plan Selection */}
              <div className="space-y-3">
                <Label>Choose your plan</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PLANS.map((plan) => {
                    const active = selectedPlan === plan.id;
                    return (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan.id)}
                        className={`relative rounded-lg border p-3 text-left transition-colors ${
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        {active && (
                          <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          </div>
                        )}
                        <p
                          className={`text-sm font-medium ${
                            active ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {plan.name}
                        </p>
                        <p className="font-mono text-xs font-semibold text-muted-foreground">
                          {plan.price}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {plan.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleSignUp}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Account"
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
