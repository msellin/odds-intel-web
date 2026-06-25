export const dynamic = 'force-dynamic';

import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase-server";

const SECTIONS: { href: string; title: string; blurb: string }[] = [
  {
    href: "/admin/cs2",
    title: "CS2",
    blurb: "Value sheet, multi-book odds, bot picks, settlement.",
  },
  {
    href: "/admin/tennis",
    title: "Tennis",
    blurb: "System overview — scanner, predictions, paper bets.",
  },
  {
    href: "/admin/lol",
    title: "LoL",
    blurb: "ELO value sheet.",
  },
  {
    href: "/admin/bots",
    title: "Bot dashboard",
    blurb: "All bots — fires, ROI, CLV, maturity, market mix.",
  },
  {
    href: "/admin/ops",
    title: "Ops",
    blurb: "Pipeline health, scrapers, scheduler state.",
  },
  {
    href: "/admin/place",
    title: "Place real bets",
    blurb: "Operator placement console (Coolbet daemon).",
  },
  {
    href: "/admin/real-bets",
    title: "Real bets",
    blurb: "Placed-real-bet history, PnL, CLV, divergence vs sim.",
  },
];

export default async function AdminIndexPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Access denied.
      </div>
    );
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Superadmin only.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Admin</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Operator-only consoles. Each section opens a focused dashboard.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-border bg-card hover:bg-accent transition-colors px-4 py-3 block"
          >
            <div className="font-semibold">{s.title}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{s.blurb}</div>
            <div className="text-xs text-muted-foreground/70 mt-1 font-mono">{s.href}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
