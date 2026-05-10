export const dynamic = "force-dynamic";

import { createSupabaseServer } from "@/lib/supabase-server";
import { getPlaceableBets } from "@/lib/engine-data";
import { PlaceBetTable } from "@/components/place-bet-table";

export default async function PlaceBetPage() {
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
        Access denied.
      </div>
    );
  }

  const candidates = await getPlaceableBets();

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Place real bets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          SELF-USE-VALIDATION superadmin view. Pending paper bets on matches that haven&apos;t kicked off,
          with Unibet (Coolbet proxy, both run on Kambi) + Bet365 odds at pick time.
          Place €1–3 manually at coolbet.ee or bet365.com, then log via &quot;Place&quot; button.
          Manual placement only — friction is a feature.
        </p>
      </div>
      <PlaceBetTable candidates={candidates} />
    </div>
  );
}
