import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — OddsIntel",
  description: "Terms governing use of the OddsIntel platform.",
};

export default function TermsPage() {
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
            <h1 className="text-3xl font-black tracking-tight">Terms of Service</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Last updated: April 2026
            </p>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            By accessing or using OddsIntel (&ldquo;the Service&rdquo;), you agree to be
            bound by these Terms of Service. Please read them carefully before
            using the platform.
          </p>

          <section className="space-y-3">
            <h2 className="text-base font-bold">1. About the Service</h2>
            <p className="text-sm text-muted-foreground">
              OddsIntel provides football match intelligence — odds data, team
              statistics, form, injuries, and analytical tools. We are a data and
              analysis platform. We are not a bookmaker and do not accept bets.
              All information is provided for informational purposes only.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">2. Eligibility</h2>
            <p className="text-sm text-muted-foreground">
              You must be at least 18 years old to use this service. By using
              OddsIntel, you confirm that you are 18+ and that sports betting is
              legal in your jurisdiction. It is your responsibility to comply with
              local laws regarding gambling and online services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">3. No Gambling Advice</h2>
            <p className="text-sm text-muted-foreground">
              Nothing on OddsIntel constitutes gambling advice, a recommendation
              to bet, or a guarantee of outcome. Model probabilities, value
              indicators, and pick signals are analytical tools — they do not
              guarantee profit. Past performance of our models does not guarantee
              future results. Betting carries risk of financial loss.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">4. Subscription & Billing</h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Paid tiers (Pro, Elite) are billed monthly. Subscriptions
                auto-renew unless cancelled before the renewal date.
              </p>
              <p>
                You may cancel at any time. Cancellation takes effect at the end
                of the current billing period — no partial refunds are issued for
                unused time.
              </p>
              <p>
                Payments are processed by Stripe. We do not store your card
                details.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">5. Acceptable Use</h2>
            <p className="text-sm text-muted-foreground">You agree not to:</p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Scrape, crawl, or systematically extract data from the platform</li>
              <li>Share your account credentials with others</li>
              <li>Use the service to build a competing product</li>
              <li>Attempt to reverse-engineer our models or data pipelines</li>
              <li>Circumvent tier restrictions by technical means</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">6. Data Accuracy</h2>
            <p className="text-sm text-muted-foreground">
              We source data from third-party APIs (API-Football, Sofascore, and
              others). While we strive for accuracy, we cannot guarantee that all
              odds, scores, or statistics are error-free or current. Always verify
              critical information with the bookmaker directly before placing a bet.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">7. Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground">
              OddsIntel is provided &ldquo;as is&rdquo;. We are not liable for any financial
              losses, missed opportunities, or damages arising from your use of
              the service. Our total liability to you in any 12-month period is
              limited to the amount you paid for your subscription in that period.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">8. Intellectual Property</h2>
            <p className="text-sm text-muted-foreground">
              All content, models, and interfaces on OddsIntel are our property.
              You are granted a limited, non-transferable licence to access the
              service for personal use. No rights are transferred to you beyond
              what is necessary to use the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">9. Termination</h2>
            <p className="text-sm text-muted-foreground">
              We reserve the right to suspend or terminate accounts that violate
              these terms without prior notice. You may delete your account at any
              time from the Profile page.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">10. Changes to Terms</h2>
            <p className="text-sm text-muted-foreground">
              We may update these terms from time to time. Significant changes
              will be communicated by email. Continued use of the service after
              changes take effect constitutes acceptance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold">11. Contact</h2>
            <p className="text-sm text-muted-foreground">
              Questions about these terms:{" "}
              <a
                href="mailto:legal@oddsintel.app"
                className="text-green-400 hover:underline"
              >
                legal@oddsintel.app
              </a>
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
