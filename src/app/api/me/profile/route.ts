import { NextResponse } from "next/server";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";

export async function GET() {
  const auth = await createSupabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json(null, { status: 401 });

  const db = createServerServiceClient();
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
