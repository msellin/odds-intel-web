"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center space-y-4 pb-2">
          <Link href="/" className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="font-mono text-lg font-bold tracking-tight">
              ODDS<span className="text-primary">INTEL</span>
            </span>
          </Link>
          <h1 className="text-center text-lg font-semibold">
            Sign in to OddsIntel
          </h1>
        </CardHeader>
        <CardContent className="space-y-4">
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
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => {}}
          >
            Sign In
          </Button>

          <div className="flex items-center justify-between text-sm">
            <Link
              href="/signup"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Don&apos;t have an account?{" "}
              <span className="text-primary">Sign up</span>
            </Link>
            <button className="text-muted-foreground hover:text-primary transition-colors">
              Forgot password?
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground pt-2">
            Demo mode — authentication coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
