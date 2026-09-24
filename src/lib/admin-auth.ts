/**
 * Server-side admin checks for route handlers (#139 phase A, bots control panel spec §2.1).
 *
 * The page gate is never trusted for a write: every route handler calls one of these itself,
 * BEFORE it reads the request body.
 *
 *   requireSuperadmin() — signed in AND profiles.is_superadmin.
 *   requireOwner()      — requireSuperadmin() AND the user id is listed in the server env
 *                         OWNER_USER_IDS (comma-separated). This is the "owner only" check for
 *                         arming real money; it is not a UI hide. Unset env = nobody is the owner,
 *                         so arming from the web is impossible (fails closed).
 *
 * Server-only. Uses the service client for the profile read (RLS-bypassing, never sent to the
 * browser).
 */
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";

export interface AdminUser {
  userId: string;
  email: string | null;
  db: ReturnType<typeof createServerServiceClient>;
}

export type AdminGate = AdminUser | { error: "unauthorized" | "forbidden"; status: 401 | 403 };

export async function requireSuperadmin(): Promise<AdminGate> {
  const auth = await createSupabaseServer();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return { error: "unauthorized", status: 401 };
  const db = createServerServiceClient();
  const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
  if (!profile?.is_superadmin) return { error: "forbidden", status: 403 };
  return { userId: user.id, email: user.email ?? null, db };
}

export function ownerIds(): Set<string> {
  return new Set(
    (process.env.OWNER_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export async function requireOwner(): Promise<AdminGate> {
  const gate = await requireSuperadmin();
  if ("error" in gate) return gate;
  if (!ownerIds().has(gate.userId)) return { error: "forbidden", status: 403 };
  return gate;
}
