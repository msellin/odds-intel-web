import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function POST() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  await supabase
    .from("profiles")
    .update({ telegram_chat_id: null })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
