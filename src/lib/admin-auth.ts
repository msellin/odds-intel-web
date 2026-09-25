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
 *
 * #162 W7.4 (2026-09-26): ONE superadmin check per request. The admin layout and each admin page
 * both call requireSuperadmin() (the page keeps its own check — defence in depth), which cost two
 * remote Supabase auth.getUser round-trips + two profile reads per /admin/bots render. The lookup is
 * wrapped in React.cache, so within one server render the second call reuses the first result.
 * React.cache is scoped to a single request (never shared across users), and outside a React
 * render — route handlers, where every write re-checks — it simply runs the lookup every time.
 */
import { cache } from "react";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";

export interface AdminUser {
  userId: string;
  email: string | null;
  db: ReturnType<typeof createServerServiceClient>;
}

export type AdminGate = AdminUser | { error: "unauthorized" | "forbidden"; status: 401 | 403 };

export function requireSuperadmin(): Promise<AdminGate> {
  return superadminOnce();
}

const superadminOnce = cache(async (): Promise<AdminGate> => {
  const auth = await createSupabaseServer();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return { error: "unauthorized", status: 401 };
  const db = createServerServiceClient();
  const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
  if (!profile?.is_superadmin) return { error: "forbidden", status: 403 };
  return { userId: user.id, email: user.email ?? null, db };
});

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
