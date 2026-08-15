import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle.jsx'
import Logo from './Logo.jsx'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-bg-alt flex flex-col">

      {/* Nav */}
      <nav className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full pt-[calc(env(safe-area-inset-top)+1.25rem)] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo className="h-12 w-auto" />
        </Link>
        <ThemeToggle />
      </nav>

      {/* Content */}
      <main className="px-6 md:px-12 lg:px-20 max-w-3xl mx-auto w-full pt-10 pb-16">

        <div className="mb-10">
          <h1 className="text-primary text-2xl md:text-3xl font-extrabold tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-muted text-sm mt-2">Last updated: July 2026</p>
        </div>

        <div className="space-y-8">

          <section>
            <h2 className="text-primary text-lg font-bold mb-3">1. Who We Are</h2>
            <p className="text-muted text-sm leading-relaxed">
              Dink Over Coffee ("we", "us", "our") is a community-run pickleball group based in Jayanagar & Basavangudi, Bengaluru, Karnataka, India. This privacy policy explains how we collect, use, and protect your personal information when you use our website at dinkovercoffee.com.
            </p>
          </section>

          <section>
            <h2 className="text-primary text-lg font-bold mb-3">2. Information We Collect</h2>
            <p className="text-muted text-sm leading-relaxed mb-3">When you register for a session, we collect:</p>
            <ul className="space-y-1.5 text-muted text-sm leading-relaxed pl-4">
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Your name</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Your phone number</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Your skill level (Beginner / Intermediate / Advanced)</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Your DUPR ID (only for DUPR-rated sessions)</li>
            </ul>
            <p className="text-muted text-sm leading-relaxed mt-3">
              When you make a payment, payment processing is handled entirely by Razorpay. We do not store your card details, UPI PIN, or bank account information. Razorpay's privacy policy applies to payment data.
            </p>
            <p className="text-muted text-sm leading-relaxed mt-3">
              We also automatically collect basic analytics data (pages visited, device type, approximate location) via Google Analytics to understand site usage.
            </p>
          </section>

          <section>
            <h2 className="text-primary text-lg font-bold mb-3">3. How We Use Your Information</h2>
            <p className="text-muted text-sm leading-relaxed mb-3">We use your information to:</p>
            <ul className="space-y-1.5 text-muted text-sm leading-relaxed pl-4">
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Confirm your session registration</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Contact you about session changes (cancellations, time changes, waitlist updates)</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Display your first name in the session player list so others know who is attending</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Process refunds when applicable</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Improve our website and community experience</li>
            </ul>
            <p className="text-muted text-sm leading-relaxed mt-3">
              We do not sell, rent, or share your personal information with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-primary text-lg font-bold mb-3">4. Data Storage & Security</h2>
            <p className="text-muted text-sm leading-relaxed">
              Your data is stored securely using Supabase (cloud database with encryption at rest). Access is restricted to community organisers for operational purposes only. We retain your registration data for the duration of your participation in the community. You can request deletion at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-primary text-lg font-bold mb-3">5. Third-Party Services</h2>
            <p className="text-muted text-sm leading-relaxed mb-3">We use the following third-party services:</p>
            <ul className="space-y-1.5 text-muted text-sm leading-relaxed pl-4">
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" /><strong>Razorpay</strong> — payment processing (PCI DSS compliant)</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" /><strong>Supabase</strong> — database and authentication</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" /><strong>Google Analytics</strong> — website usage analytics</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" /><strong>Vercel</strong> — website hosting</li>
            </ul>
            <p className="text-muted text-sm leading-relaxed mt-3">
              Each service has its own privacy policy governing how they handle your data.
            </p>
          </section>

          <section>
            <h2 className="text-primary text-lg font-bold mb-3">6. Cookies</h2>
            <p className="text-muted text-sm leading-relaxed">
              We use localStorage to remember your theme preference (light/dark mode) and your last-entered registration details for convenience. Google Analytics may set cookies to track site usage. No advertising or tracking cookies are used.
            </p>
          </section>

          <section>
            <h2 className="text-primary text-lg font-bold mb-3">7. Your Rights</h2>
            <p className="text-muted text-sm leading-relaxed mb-3">You have the right to:</p>
            <ul className="space-y-1.5 text-muted text-sm leading-relaxed pl-4">
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Request access to the personal data we hold about you</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Request correction of inaccurate data</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Request deletion of your data</li>
              <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Withdraw consent at any time</li>
            </ul>
            <p className="text-muted text-sm leading-relaxed mt-3">
              To exercise any of these rights, contact us at <a href="mailto:connect@dinkovercoffee.com" className="text-interactive font-medium">connect@dinkovercoffee.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-primary text-lg font-bold mb-3">8. Changes to This Policy</h2>
            <p className="text-muted text-sm leading-relaxed">
              We may update this policy from time to time. Changes will be posted on this page with an updated date. Continued use of the website after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-primary text-lg font-bold mb-3">9. Contact Us</h2>
            <p className="text-muted text-sm leading-relaxed">
              If you have any questions about this privacy policy or how your data is handled, please contact us:
            </p>
            <div className="mt-3 bg-surface rounded-2xl p-5 border border-border">
              <p className="text-primary text-sm font-semibold">Dink Over Coffee</p>
              <p className="text-muted text-sm mt-1">Jayanagar & Basavangudi, Bengaluru, Karnataka, India</p>
              <p className="text-muted text-sm mt-1">Email: <a href="mailto:connect@dinkovercoffee.com" className="text-interactive font-medium">connect@dinkovercoffee.com</a></p>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full py-6 mt-auto border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo className="h-9 w-auto" />
        </div>
        <p className="text-muted text-xs">Play. Connect. Belong.</p>
      </footer>

    </div>
  )
}
