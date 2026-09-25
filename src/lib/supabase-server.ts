import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicPostgrestUrl, serverPostgrestOptions } from "@/lib/postgrest-server-url";

/**
 * Server-side service-role client for the data layer.
 *
 * Points at NEXT_PUBLIC_POSTGREST_URL / POSTGREST_SERVICE_KEY. Falls back to
 * Supabase project envs during Phase 4 of the Supabase→VPS migration so this
 * deploys without cutover; Phase 6 flips POSTGREST_URL to api.oddsintel.app.
 *
 * Bypasses RLS — callers must apply explicit `.eq('user_id', ...)` /
 * `.eq('id', session.user.id)` filters for per-user queries.
 *
 * Server-only. Never send this client or its key to the browser.
 *
 * #162 W7.4: when the optional server-only POSTGREST_INTERNAL_URL is set (e.g.
 * http://127.0.0.1:3012), requests go straight to PostgREST on the same box instead of out
 * through Cloudflare and back — see src/lib/postgrest-server-url.ts. Unset = the public URL.
 */
export function createServerServiceClient() {
  const url = publicPostgrestUrl();
  const key =
    process.env.POSTGREST_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, serverPostgrestOptions(url));
}

export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component where
            // cookies cannot be set. This can be safely ignored if middleware
            // is refreshing user sessions.
          }
        },
      },
    }
  );
}
