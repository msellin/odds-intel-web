import { createSupabaseServer } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { SuperadminTierBarClient } from "./superadmin-tier-bar-client";

export async function SuperadminTierBar() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_superadmin) return null;

    const cookieStore = await cookies();
    const previewTier = cookieStore.get("preview_tier")?.value as
      | "free"
      | "pro"
      | "elite"
      | undefined;

    return <SuperadminTierBarClient previewTier={previewTier ?? null} />;
  } catch {
    return null;
  }
}
