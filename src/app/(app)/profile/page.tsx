export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { ProfileSignOutButton } from "@/components/profile-sign-out-button";

export const metadata: Metadata = {
  title: "Profile — OddsIntel",
  robots: { index: false, follow: false },
};

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  tier: "free" | "pro" | "elite";
  is_superadmin: boolean;
  created_at: string;
}

export default async function ProfilePage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const db = createServerServiceClient();
  const { data } = await db
    .from("profiles")
    .select("id, email, display_name, tier, is_superadmin, created_at")
    .eq("id", user.id)
    .single();

  const profile: ProfileRow | null = data as ProfileRow | null;
  const email = profile?.email ?? user.email ?? null;
  const displayName = profile?.display_name ?? null;
  const tier = profile?.tier ?? "free";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="mx-auto w-full max-w-lg">
      <h1 className="text-lg font-semibold text-neutral-100">Your account</h1>
      <p className="mt-1 text-xs text-neutral-500">
        Minimal for now — sign in state, email, and sign out. More coming as tiers return.
      </p>

      <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-card/60 p-5">
        <ProfileRowItem label="Signed in as" value={displayName || email || user.id.slice(0, 8)} />
        {email && displayName && <ProfileRowItem label="Email" value={email} />}
        <ProfileRowItem
          label="Tier"
          value={
            <span className="inline-flex items-center gap-2">
              <span className="font-medium capitalize">{tier}</span>
              {profile?.is_superadmin && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Superadmin
                </span>
              )}
            </span>
          }
        />
        {memberSince && <ProfileRowItem label="Member since" value={memberSince} />}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/performance"
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/[0.05] hover:text-neutral-100"
        >
          Back to Performance
        </Link>
        <ProfileSignOutButton />
      </div>
    </div>
  );
}

function ProfileRowItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 last:border-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</span>
      <span className="text-sm text-neutral-100">{value}</span>
    </div>
  );
}
