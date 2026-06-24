/**
 * POST /api/v1/waitlist
 *
 * Email-capture endpoint for the "Notify me when premium drops" CTA on
 * the landing page. No paid product exists today; this is pure demand
 * signal so the operator knows when interest justifies building a tier.
 *
 * Request body:
 *   { "email": "user@example.com" }
 *
 * Response:
 *   200 — { ok: true, alreadyOnList: bool }
 *   400 — invalid email
 *   429 — rate-limited (max 5 attempts / IP / 10min)
 *   500 — DB error
 *
 * Storage: `premium_waitlist` (migration 259). Server inserts via the
 * service-role client because RLS blocks anon writes. We capture a SHA-256
 * of the IP (not the raw IP) as a light spam-control signal — enough to
 * detect a single IP submitting hundreds of addresses without exposing
 * the operator to GDPR-relevant raw-IP storage.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anon";
  const rl = checkRateLimit(`waitlist:${ip}`, 5, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetInMs / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = (body as { email?: unknown })?.email;
  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }
  const normEmail = email.trim().toLowerCase();

  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 200);

  const sb = adminClient();
  // Idempotent insert: ON CONFLICT we report alreadyOnList=true; never
  // surface a DB error to the user for a duplicate email — that's a
  // benign collision.
  const { data, error } = await sb
    .from("premium_waitlist")
    .insert({ email: normEmail, ip_hash: ipHash, user_agent: userAgent })
    .select("id, created_at")
    .maybeSingle();

  if (error) {
    // Postgres unique_violation code 23505 — duplicate email
    if (error.code === "23505" || /duplicate key/i.test(error.message)) {
      return NextResponse.json({ ok: true, alreadyOnList: true });
    }
    return NextResponse.json(
      { error: "Could not record — please retry.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    alreadyOnList: false,
    id: data?.id ?? null,
  });
}
