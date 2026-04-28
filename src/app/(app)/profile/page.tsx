"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Settings, Bell, Monitor, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const LEAGUES = [
  "Premier League",
  "La Liga",
  "Bundesliga",
  "Serie A",
  "Championship",
  "Ligue 1",
  "Serie B",
  "2. Bundesliga",
] as const;

const MARKETS = ["1X2", "Over/Under", "BTTS", "Asian Handicap"] as const;

const TIER_LABELS: Record<string, string> = {
  scout: "Free",
  analyst: "Pro — €19/mo",
  sharp: "Elite — €49/mo",
  syndicate: "Elite — €49/mo",
};

interface NotificationSettings {
  value_bet_alerts: boolean;
  lineup_alerts: boolean;
  injury_alerts: boolean;
  weekly_report: boolean;
  edge_threshold: number;
}

export default function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Profile fields
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [stake, setStake] = useState("10");
  const [bankroll, setBankroll] = useState("1000");
  const [oddsFormat, setOddsFormat] = useState("decimal");

  // Notification fields
  const [valueBetAlerts, setValueBetAlerts] = useState(true);
  const [lineupAlerts, setLineupAlerts] = useState(true);
  const [injuryAlerts, setInjuryAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [edgeThreshold, setEdgeThreshold] = useState("3");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);

    // Fetch profile
    if (profile) {
      setSelectedLeagues(profile.preferred_leagues ?? []);
      setSelectedMarkets(profile.preferred_markets ?? []);
      setStake(String(profile.default_stake ?? 10));
      setBankroll(String(profile.bankroll ?? 1000));
      setOddsFormat(profile.odds_format ?? "decimal");
    }

    // Fetch notification settings
    const { data: notif } = await supabase
      .from("user_notification_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (notif) {
      const n = notif as NotificationSettings;
      setValueBetAlerts(n.value_bet_alerts);
      setLineupAlerts(n.lineup_alerts);
      setInjuryAlerts(n.injury_alerts);
      setWeeklyReport(n.weekly_report);
      setEdgeThreshold(String(n.edge_threshold ?? 3));
    }

    setProfileLoading(false);
  }, [user, profile, supabase]);

  useEffect(() => {
    if (!loading && user) {
      fetchData();
    }
  }, [loading, user, fetchData]);

  const toggleLeague = (league: string) => {
    setSelectedLeagues((prev) =>
      prev.includes(league)
        ? prev.filter((l) => l !== league)
        : [...prev, league]
    );
  };

  const toggleMarket = (market: string) => {
    setSelectedMarkets((prev) =>
      prev.includes(market)
        ? prev.filter((m) => m !== market)
        : [...prev, market]
    );
  };

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);

    // Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        preferred_leagues: selectedLeagues,
        preferred_markets: selectedMarkets,
        default_stake: parseFloat(stake) || 10,
        bankroll: parseFloat(bankroll) || 1000,
        odds_format: oddsFormat,
        timezone,
      })
      .eq("id", user.id);

    if (profileError) {
      setMessage({ type: "error", text: `Failed to save profile: ${profileError.message}` });
      setSaving(false);
      return;
    }

    // Upsert notification settings
    const { error: notifError } = await supabase
      .from("user_notification_settings")
      .upsert({
        user_id: user.id,
        value_bet_alerts: valueBetAlerts,
        lineup_alerts: lineupAlerts,
        injury_alerts: injuryAlerts,
        weekly_report: weeklyReport,
        edge_threshold: parseFloat(edgeThreshold) || 3,
      });

    if (notifError) {
      setMessage({ type: "error", text: `Failed to save notifications: ${notifError.message}` });
      setSaving(false);
      return;
    }

    // Refresh profile in auth context
    await refreshProfile();

    setMessage({ type: "success", text: "Settings saved successfully." });
    setSaving(false);

    // Clear message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!user) return null;

  const tierKey = profile?.tier ?? "scout";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-xl font-bold tracking-tight">
            Profile
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your account, preferences, and notifications
        </p>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Account Section */}
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
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {TIER_LABELS[tierKey] ?? "Scout — Free"}
                </Badge>
              </div>
            </div>
            {tierKey === "scout" ? (
              <Button variant="outline" size="sm" render={<Link href="/signup" />}>
                Upgrade — coming soon
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Manage Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Betting Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Betting Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Preferred Leagues */}
          <div className="space-y-3">
            <Label>Preferred Leagues</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LEAGUES.map((league) => {
                const active = selectedLeagues.includes(league);
                return (
                  <button
                    key={league}
                    onClick={() => toggleLeague(league)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {league}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Preferred Markets */}
          <div className="space-y-3">
            <Label>Preferred Markets</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MARKETS.map((market) => {
                const active = selectedMarkets.includes(market);
                return (
                  <button
                    key={market}
                    onClick={() => toggleMarket(market)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {market}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Stake & Bankroll */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stake">Default Stake (EUR)</Label>
              <Input
                id="stake"
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                min={1}
                placeholder="25"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankroll">Bankroll (EUR)</Label>
              <Input
                id="bankroll"
                type="number"
                value={bankroll}
                onChange={(e) => setBankroll(e.target.value)}
                min={0}
                placeholder="1000"
              />
              <p className="text-xs text-muted-foreground">
                Current: &euro;{Number(bankroll).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Value bet alerts</Label>
              <p className="text-xs text-muted-foreground">
                When edge exceeds your threshold
              </p>
            </div>
            <Switch
              checked={valueBetAlerts}
              onCheckedChange={setValueBetAlerts}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Lineup confirmed alerts</Label>
              <p className="text-xs text-muted-foreground">
                Get notified when lineups are announced
              </p>
            </div>
            <Switch
              checked={lineupAlerts}
              onCheckedChange={setLineupAlerts}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Injury news alerts</Label>
              <p className="text-xs text-muted-foreground">
                Breaking injury updates for tracked leagues
              </p>
            </div>
            <Switch
              checked={injuryAlerts}
              onCheckedChange={setInjuryAlerts}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly performance report</Label>
              <p className="text-xs text-muted-foreground">
                Summary of your betting performance
              </p>
            </div>
            <Switch
              checked={weeklyReport}
              onCheckedChange={setWeeklyReport}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="edge-threshold">Edge Threshold (%)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="edge-threshold"
                type="number"
                value={edgeThreshold}
                onChange={(e) => setEdgeThreshold(e.target.value)}
                min={1}
                max={20}
                step={0.5}
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">
                Alert when edge &gt; {edgeThreshold}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4" />
            Display Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Odds Format</Label>
              <Select value={oddsFormat} onValueChange={(v) => v && setOddsFormat(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="decimal">Decimal (2.10)</SelectItem>
                  <SelectItem value="fractional">Fractional (11/10)</SelectItem>
                  <SelectItem value="american">American (+110)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                {timezone}
              </p>
              <p className="text-xs text-muted-foreground">Auto-detected</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
      </div>
    </div>
  );
}
