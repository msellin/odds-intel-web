import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * POST /api/set-preview-tier
 * Sets or clears the preview_tier cookie for superadmin tier switching.
 * Body: { tier: "free" | "pro" | "elite" | "" }
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_superadmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const tier = body.tier as string;

  const response = NextResponse.json({ ok: true });

  if (!tier) {
    response.cookies.set("preview_tier", "", { maxAge: 0, path: "/" });
  } else if (["free", "pro", "elite"].includes(tier)) {
    response.cookies.set("preview_tier", tier, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  } else {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  return response;
}
