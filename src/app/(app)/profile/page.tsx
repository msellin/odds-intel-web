"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, Settings, X, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const POPULAR_LEAGUES = [
  "Premier League",
  "La Liga",
  "Bundesliga",
  "Serie A",
  "Ligue 1",
  "Championship",
  "2. Bundesliga",
  "Serie B",
  "Eredivisie",
  "Primeira Liga",
  "Scottish Premiership",
  "Champions League",
];

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro — €4.99/mo",
  elite: "Elite — €14.99/mo",
};

export default function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [saving, setSaving] = useState<string | null>(null); // league name being saved

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const starredLeagues: string[] = profile?.preferred_leagues ?? [];

  const toggleLeague = useCallback(async (league: string) => {
    if (!user || saving) return;
    setSaving(league);

    const current = profile?.preferred_leagues ?? [];
    const isStarred = current.includes(league);
    const updated = isStarred
      ? current.filter((l) => l !== league)
      : [...current, league];

    await supabase
      .from("profiles")
      .update({ preferred_leagues: updated })
      .eq("id", user.id);

    await refreshProfile();
    setSaving(null);
  }, [user, profile, saving, supabase, refreshProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!user) return null;

  const tierKey = profile?.tier ?? "free";

  // Popular leagues not yet starred
  const suggestedLeagues = POPULAR_LEAGUES.filter(
    (l) => !starredLeagues.includes(l)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-xl font-bold tracking-tight">Profile</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground">Email</Label>
            <p className="font-mono text-sm">{user.email}</p>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label className="text-muted-foreground">Current Plan</Label>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 w-fit">
                {TIER_LABELS[tierKey] ?? "Free"}
              </Badge>
            </div>
            {tierKey === "free" ? (
              <span className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
                Pro &amp; Elite — launching soon
              </span>
            ) : (
              <div className="flex flex-col items-end gap-0.5">
                <button className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground opacity-50 cursor-not-allowed">
                  Manage Subscription
                </button>
                <p className="text-xs text-muted-foreground">Billing portal coming soon</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Favourite Leagues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Favourite Leagues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Starred leagues appear in your <strong className="text-foreground/70">My Matches</strong> tab.
            You can also star leagues directly from the matches page.
          </p>

          {/* Currently starred */}
          {starredLeagues.length > 0 ? (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Your leagues
              </p>
              <div className="flex flex-wrap gap-2">
                {starredLeagues.map((league) => (
                  <button
                    key={league}
                    onClick={() => toggleLeague(league)}
                    disabled={saving === league}
                    className="flex items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  >
                    {saving === league ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    {league}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/[0.08] px-4 py-5 text-center">
              <p className="text-sm text-muted-foreground">No leagues starred yet.</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Star a league from the matches page or add one below.
              </p>
            </div>
          )}

          {/* Quick-add popular leagues */}
          {suggestedLeagues.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Quick add
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedLeagues.map((league) => (
                  <button
                    key={league}
                    onClick={() => toggleLeague(league)}
                    disabled={saving === league}
                    className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-green-500/40 hover:bg-green-500/10 hover:text-green-400 disabled:opacity-50"
                  >
                    {saving === league ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {league}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
