import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SITE_URL = process.env.SITE_URL ?? "https://oddsintel.app";

async function sendWelcomeEmail(to: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL ?? "OddsIntel <digest@oddsintel.app>";
  if (!apiKey) return;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;">
    <tr><td align="center" style="padding:32px 16px 24px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#0d1117;border-radius:10px 10px 0 0;padding:24px 32px;text-align:center;">
            <a href="${SITE_URL}" style="text-decoration:none;display:inline-block;">
              <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:0.04em;">ODDS</span><span style="font-size:28px;font-weight:800;color:#22c55e;letter-spacing:0.04em;">INTEL</span>
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:28px 32px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;">Welcome to OddsIntel</h2>
            <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">Your account is active. Here's what to do first:</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:14px;color:#0f172a;font-weight:600;">1. Check today's matches</span><br>
                  <span style="font-size:13px;color:#64748b;">Fixtures, odds comparison, and live scores in one place.</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:14px;color:#0f172a;font-weight:600;">2. See today's value bet</span><br>
                  <span style="font-size:13px;color:#64748b;">We surface one AI-flagged pick per day on the free plan — see if it matches your read.</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <span style="font-size:14px;color:#0f172a;font-weight:600;">3. Star your leagues</span><br>
                  <span style="font-size:13px;color:#64748b;">Personalise your feed so you only see leagues you follow.</span>
                </td>
              </tr>
            </table>
            <div style="margin-top:24px;text-align:center;">
              <a href="${SITE_URL}/matches" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;border-radius:6px;">Go to matches →</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;padding:18px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">Not financial or gambling advice. Please gamble responsibly.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: "Welcome to OddsIntel", html }),
  });
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/matches";

  // Supabase redirects here with error params if verification failed
  const error = searchParams.get("error");
  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Send welcome email to brand-new users (created_at within the last 10 minutes)
      const user = data.user;
      if (user?.email && user.created_at) {
        const isNewUser = new Date(user.created_at) > new Date(Date.now() - 10 * 60 * 1000);
        if (isNewUser) {
          sendWelcomeEmail(user.email).catch(() => {});
        }
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
