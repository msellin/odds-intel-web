import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — OddsIntel",
  description: "How OddsIntel collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="font-mono text-xl font-black uppercase italic tracking-tight text-white"
          >
            ODDS<span className="text-green-500">INTEL</span>
          </Link>
          <Link
            href="/matches"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Matches
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Last updated: April 2026
            </p>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            OddsIntel (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is committed to protecting your
            privacy. This policy explains what data we collect, why we collect it,
            and how it is used.
          </p>

          <section className="space-y-3">
            <h2 className="text-base font-bold">1. Data We Collect</h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Account data:</strong> When you
                sign up, we collect your email address and a hashed password. We do
                not store plain-text passwords.
              </p>
              <p>
                <strong className="text-foreground">Usage analytics:</strong> We use
                Vercel Analytics to measure page views and navigation patterns.
                Vercel Analytics is privacy-focused — it does not use cookies, does
                not fingerprint your device, and does not store personally
                identifiable information.
              </p>
              <p>
                <strong className="text-foreground">Preference data:</strong> Your
                subscription tier and in-app preferences are stored in our database
                (Supabase, hosted on AWS EU-West-1).
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">2. How We Use Your Data</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>To provide and improve the OddsIntel service</li>
              <li>To authenticate you and enforce subscription tiers</li>
              <li>To send transactional emails (password reset, billing receipts)</li>
              <li>To understand aggregate usage patterns (no individual profiling)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">3. Third-Party Services</h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Supabase:</strong> Database and
                authentication provider. Data stored in EU region.
              </p>
              <p>
                <strong className="text-foreground">Vercel:</strong> Hosting and
                analytics. See{" "}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:underline"
                >
                  Vercel&apos;s Privacy Policy
                </a>
                .
              </p>
              <p>
                <strong className="text-foreground">Stripe:</strong> Payment
                processing for Pro and Elite subscriptions. We do not store card
                details — all payment data is handled by Stripe.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">4. Cookies</h2>
            <p className="text-sm text-muted-foreground">
              We use a single session cookie for authentication (Supabase auth
              token). We do not use advertising cookies, tracking pixels, or
              third-party marketing cookies. Our analytics provider (Vercel) is
              cookieless.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">5. Data Retention</h2>
            <p className="text-sm text-muted-foreground">
              Account data is retained while your account is active. If you delete
              your account, your personal data is removed within 30 days. Anonymous
              usage statistics are retained indefinitely in aggregate form.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">6. Your Rights (GDPR)</h2>
            <p className="text-sm text-muted-foreground">
              If you are in the EU/EEA, you have the right to: access your data,
              correct inaccurate data, request deletion, object to processing, and
              data portability. To exercise these rights, email us at{" "}
              <a
                href="mailto:privacy@oddsintel.app"
                className="text-green-400 hover:underline"
              >
                privacy@oddsintel.app
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">7. Responsible Gambling</h2>
            <p className="text-sm text-muted-foreground">
              OddsIntel provides data and analysis tools. We do not operate as a
              bookmaker or accept bets. Users must be 18+ and comply with local
              gambling laws. If you are concerned about problem gambling, visit{" "}
              <a
                href="https://www.begambleaware.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:underline"
              >
                BeGambleAware
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">8. Contact</h2>
            <p className="text-sm text-muted-foreground">
              For privacy questions, email{" "}
              <a
                href="mailto:privacy@oddsintel.app"
                className="text-green-400 hover:underline"
              >
                privacy@oddsintel.app
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-6">
          <span>&copy; {new Date().getFullYear()} OddsIntel</span>
          <Link href="/terms" className="hover:text-green-400 transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-green-400 transition-colors">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
