"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GoogleSignIn, DiscordSignIn, AuthDivider } from "@/components/google-sign-in";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useAuth } from "@/components/auth-provider";

export function LoginModal() {
  const { loginModalOpen, closeLoginModal, user } = useAuth();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "sent">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Close on successful login
  useEffect(() => {
    if (user && loginModalOpen) {
      closeLoginModal();
      router.refresh();
    }
  }, [user, loginModalOpen, closeLoginModal, router]);

  // Reset form when modal closes
  useEffect(() => {
    if (!loginModalOpen) {
      setEmail("");
      setStep("email");
      setError(null);
    }
  }, [loginModalOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!loginModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLoginModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loginModalOpen, closeLoginModal]);

  if (!loginModalOpen) return null;

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
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) closeLoginModal(); }}
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-border/60 bg-background shadow-2xl">
        {/* Close button */}
        <button
          onClick={closeLoginModal}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-6 pt-6">
          {/* Header */}
          <div className="mb-5 text-center">
            <p className="font-mono text-lg font-black uppercase italic tracking-tight text-white">
              ODDS<span className="text-green-500">INTEL</span>
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              {step === "email" ? "Sign in or create a free account" : "Check your email"}
            </h2>
            {step === "email" && (
              <p className="mt-1 text-sm text-muted-foreground">
                Free forever. Star leagues, track your picks, and more.
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === "email" ? (
            <div className="space-y-3">
              <GoogleSignIn />
              <DiscordSignIn />
              <AuthDivider />

              <div className="space-y-1.5">
                <Label htmlFor="modal-email">Email</Label>
                <Input
                  id="modal-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendLink()}
                  autoFocus
                />
              </div>

              <Button
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleSendLink}
                disabled={loading || !email}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue with email"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                We sent a sign-in link to{" "}
                <span className="font-medium text-foreground">{email}</span>.
                Click the link in your email to continue.
              </p>
              <p className="text-xs text-muted-foreground">
                The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
              </p>
              <button
                className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => { setStep("email"); setError(null); }}
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
