export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { isBotBoardDevPreview } from "@/lib/bot-board";
import { loadActivity } from "@/lib/admin-activity";
import { PageHeader } from "@/components/oi/panel";
import { ActivityTable } from "./activity-table";

// /admin/activity (#139 IA gap G4, 2026-09-24): who changed what, in one timeline. Before this page
// control_changes had a viewer only inside /admin/bots (the Activity sheet) and feed_actions had none.
// Read-only: nothing on this page writes. Data: src/lib/admin-activity.ts (service role, server only).

export const metadata: Metadata = { title: "Activity · Admin · OddsIntel", robots: { index: false } };

export default async function ActivityPage() {
  if (!isBotBoardDevPreview()) {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return <div className="flex items-center justify-center py-24 text-muted-foreground">Access denied.</div>;
    const db = createServerServiceClient();
    const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
    if (!profile?.is_superadmin) return <div className="flex items-center justify-center py-24 text-muted-foreground">Superadmin only.</div>;
  }
  const d = await loadActivity();
  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        eyebrow="Data & ops"
        title="Activity"
        meta="Every change to a switch or a feed — from this admin, Telegram, the engine and database changes — newest first. The logs are append-only: nothing here can be edited."
      />
      <ActivityTable d={d} />
    </div>
  );
}
