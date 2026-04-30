import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import Link from "next/link";
import {
  TrendingUp,
  Check,
  Lock,
  ArrowRight,
  BarChart2,
  Users,
  Activity,
  Zap,
  Star,
  Crosshair,
  StickyNote,
  Vote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FREE_FEATURES = [
  { icon: TrendingUp, label: "All today's fixtures with best odds" },
  { icon: Activity, label: "Live scores during matches" },
  { icon: Users, label: "H2H records & recent meetings" },
  { icon: BarChart2, label: "League standings + team form" },
  { icon: Star, label: "Favourite leagues to personalise your feed" },
  { icon: Crosshair, label: "Personal picks tracker with hit rate" },
  { icon: StickyNote, label: "Private match notes" },
  { icon: Vote, label: "Community voting on matches" },
  { icon: Zap, label: "1 AI value pick revealed daily" },
];

const PRO_FEATURES = [
  "Full odds comparison (13 bookmakers)",
  "Injury reports per team",
  "Confirmed lineups & formation view",
  "Player ratings & match stats",
  "Odds movement chart",
  "Team season stats",
  "Value bet picks (edge-based)",
];

export default async function WelcomePage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      {/* Welcome header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <TrendingUp className="h-7 w-7 text-primary" />
          <span className="font-mono text-xl font-bold tracking-tight">
            ODDS<span className="text-primary">INTEL</span>
          </span>
        </div>
        <h1 className="text-2xl font-bold">Welcome to OddsIntel</h1>
        <p className="text-muted-foreground">
          Your account is active. Here&apos;s what you have access to.
        </p>
      </div>

      {/* Free tier card */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Free
            </span>
            Your current plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {FREE_FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-sm">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="text-foreground/80">{label}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pro teaser */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-amber-400" />
            Unlock Pro features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PRO_FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              {f}
            </div>
          ))}
          <div className="pt-3">
            <Link href="/profile">
              <Button variant="outline" className="w-full">
                Upgrade to Pro — €3.99/mo
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* CTAs */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/matches" className="flex-1">
          <Button className="w-full">
            View today&apos;s matches
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <Link href="/profile" className="flex-1">
          <Button variant="outline" className="w-full">
            Set preferences
          </Button>
        </Link>
      </div>
    </div>
  );
}
