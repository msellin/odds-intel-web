/**
 * Where SERVER-side PostgREST clients send their requests (#162 W7.4, 2026-09-26).
 *
 * The web app and PostgREST run on the same VPS, but NEXT_PUBLIC_POSTGREST_URL is
 * https://api.oddsintel.app, whose DNS is Cloudflare — so every server-side read left the box and
 * came back in through Cloudflare: 0.12–0.30 s per call against 0.04–0.06 s for
 * http://127.0.0.1:3012 measured on the VPS (bot-refactor audit D §1.3). /admin/bots makes ~20–40
 * of them per render.
 *
 * POSTGREST_INTERNAL_URL (optional, server-only, e.g. `http://127.0.0.1:3012`) points the server
 * clients straight at PostgREST. Unset = the public URL, exactly as before. Three rules:
 *   * never NEXT_PUBLIC_: a browser cannot reach 127.0.0.1 on the VPS. In a client bundle
 *     process.env.POSTGREST_INTERNAL_URL is undefined, and `typeof window` guards it anyway;
 *   * supabase-js always appends `/rest/v1/` to the URL it is given, and PostgREST itself serves
 *     tables at its root — nginx strips `/rest/v1/` for api.oddsintel.app
 *     (/etc/nginx/sites-enabled/oddsintel-api). Going direct skips nginx, so the fetch below does
 *     that same rewrite. The client keeps the public URL as its base (auth headers, storage keys
 *     unchanged); only the wire request is redirected;
 *   * this module imports nothing server-only (no next/headers), so bot-performance.ts and
 *     performance-work-done.ts — reachable from client-imported modules — can use it too.
 */

/** The public PostgREST base (what every client used before W7.4). */
export function publicPostgrestUrl(): string {
  return process.env.NEXT_PUBLIC_POSTGREST_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

/** The internal base, only on the server and only when the owner set it. */
export function internalPostgrestUrl(): string | null {
  if (typeof window !== "undefined") return null;
  const v = process.env.POSTGREST_INTERNAL_URL?.trim();
  return v ? v.replace(/\/+$/, "") : null;
}

/**
 * `createClient(url, key, serverPostgrestOptions(url))` — a `global.fetch` that sends
 * `<public>/rest/v1/<path>` to `<internal>/<path>` when POSTGREST_INTERNAL_URL is set; `{}` otherwise.
 * Anything not under the public REST prefix (auth, storage) is left alone.
 */
export function serverPostgrestOptions(publicUrl: string): { global?: { fetch: typeof fetch } } {
  const internal = internalPostgrestUrl();
  if (!internal) return {};
  const prefix = `${publicUrl.replace(/\/+$/, "")}/rest/v1/`;
  const internalFetch: typeof fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(prefix)) return fetch(input, init);
    const target = `${internal}/${url.slice(prefix.length)}`;
    return input instanceof Request ? fetch(new Request(target, input), init) : fetch(target, init);
  };
  return { global: { fetch: internalFetch } };
}
