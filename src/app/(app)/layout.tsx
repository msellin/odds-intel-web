import { Nav } from "@/components/nav";
import { LoginModal } from "@/components/login-modal";
import { PublicChrome } from "@/components/public-chrome";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let previewTier: "free" | "pro" | "elite" | null = null;

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const db = createServerServiceClient();
      const { data: profile } = await db
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .single();
      if (profile?.is_superadmin) {
        const cookieStore = await cookies();
        previewTier = (cookieStore.get("preview_tier")?.value as "free" | "pro" | "elite") ?? null;
      }
    }
  } catch {
    // non-fatal
  }

  return (
    <>
      {/* Nav + centred main for public pages; /admin/** renders bare into its own shell (public-chrome.tsx). */}
      <PublicChrome nav={<Nav previewTier={previewTier} />}>{children}</PublicChrome>
      <LoginModal />
    </>
  );
}
