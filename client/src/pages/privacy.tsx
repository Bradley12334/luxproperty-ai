import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { useDocumentTitle } from "@/hooks/use-document-title";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="font-serif text-lg tracking-tight mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  useDocumentTitle("Privacy Policy");
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-14 sm:py-20">
          <Badge variant="outline" className="text-[10px] mb-5">
            Legal
          </Badge>
          <h1 className="font-serif text-2xl sm:text-3xl tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-xs text-muted-foreground mb-10">
            Last updated: 14 April 2026 · LuxProperty AI Ltd
          </p>

          <div className="prose-like">
            <Section title="1. Who we are">
              <p>
                LuxProperty.ai is a trading name of <strong className="text-foreground">LuxProperty AI Ltd</strong>, a company
                registered in England and Wales. When this policy
                refers to "we", "us", or "our", it means LuxProperty AI Ltd.
              </p>
              <p>
                For questions about this policy, contact us at:{" "}
                <a href="mailto:privacy@luxproperty.ai" className="text-primary underline-offset-2 hover:underline">
                  privacy@luxproperty.ai
                </a>
              </p>
            </Section>

            <Section title="2. What data we collect">
              <p>
                LuxProperty.ai is designed as a low-data, self-serve platform. We collect the
                minimum data required to operate the service:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-foreground">Search queries</strong> — postcode or address strings you enter
                  into the search box. These are used to fetch data from HM Land Registry and
                  Postcodes.io. They are processed in your browser and are not stored on our
                  servers.
                </li>
                <li>
                  <strong className="text-foreground">Price alert sign-ups</strong> — if you submit your email address
                  for price alerts, we store that email and the associated postcode for the
                  purpose of sending you alerts.
                </li>
                <li>
                  <strong className="text-foreground">Payment data</strong> — if you subscribe to a paid plan, payment
                  processing is handled by Stripe. We do not store card details. Stripe's
                  privacy policy applies to payment data.
                </li>
                <li>
                  <strong className="text-foreground">Usage analytics</strong> — we may collect anonymised, aggregated
                  usage data (page views, feature usage) via analytics tools. This data
                  cannot be used to identify you individually.
                </li>
              </ul>
            </Section>

            <Section title="3. How we use your data">
              <p>We use the data we collect to:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Generate property intelligence briefs in response to your search queries</li>
                <li>Send price alert notifications to your registered email address</li>
                <li>Process and manage your subscription (if applicable)</li>
                <li>Improve the platform based on anonymised usage patterns</li>
                <li>Comply with legal obligations</li>
              </ul>
              <p>
                We do not sell your personal data to third parties. We do not use your data
                for advertising purposes.
              </p>
            </Section>

            <Section title="4. Data sources">
              <p>
                Property data displayed in LuxProperty.ai briefs is sourced from:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-foreground">HM Land Registry Price Paid Data</strong> — Crown copyright. Available
                  under the Open Government Licence v3.0. This data covers registered property
                  transactions in England and Wales only.
                </li>
                <li>
                  <strong className="text-foreground">Postcodes.io</strong> — Open data postcode lookup. Available under
                  the Open Government Licence.
                </li>
              </ul>
              <p>
                These data sources are public and do not contain personal information about
                property owners.
              </p>
            </Section>

            <Section title="5. Cookies and local storage">
              <p>
                LuxProperty.ai is a client-side application. We use React state held in
                your browser session for temporary data such as portfolio entries and theme
                preferences. This data exists only in your current browser tab and is not
                transmitted to or stored on our servers.
              </p>
              <p>
                We may use cookies for session management and analytics purposes. You can
                control cookie preferences through your browser settings.
              </p>
            </Section>

            <Section title="6. Third-party services">
              <p>We use the following third-party services:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-foreground">Stripe</strong> — payment processing. Stripe's privacy policy governs
                  how your payment data is handled.
                </li>
                <li>
                  <strong className="text-foreground">Vercel</strong> — website hosting. Vercel may log request metadata
                  (IP address, user agent) as part of standard hosting operations.
                </li>
                <li>
                  <strong className="text-foreground">HM Land Registry API</strong> — data fetched directly from the
                  official Land Registry API in response to your search queries.
                </li>
              </ul>
            </Section>

            <Section title="7. Your rights">
              <p>
                Under UK GDPR and the Data Protection Act 2018, you have the right to:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Withdraw consent at any time (where processing is based on consent)</li>
              </ul>
              <p>
                To exercise any of these rights, email us at{" "}
                <a href="mailto:privacy@luxproperty.ai" className="text-primary underline-offset-2 hover:underline">
                  privacy@luxproperty.ai
                </a>
                . We will respond within 30 days.
              </p>
            </Section>

            <Section title="8. Data retention">
              <p>
                We retain personal data only for as long as necessary to deliver the service
                or as required by law. Price alert email addresses are retained until you
                unsubscribe. Anonymous usage data may be retained indefinitely.
              </p>
            </Section>

            <Section title="9. Security">
              <p>
                We take reasonable steps to protect your data, including HTTPS encryption
                for all data in transit and restricted access to any stored personal data.
                However, no system is completely secure, and we cannot guarantee the
                absolute security of your information.
              </p>
            </Section>

            <Section title="10. Changes to this policy">
              <p>
                We may update this privacy policy from time to time. We will notify users
                of material changes by updating the "last updated" date at the top of this
                page. Continued use of the service after changes constitutes acceptance of
                the updated policy.
              </p>
            </Section>

            <Section title="11. Contact">
              <p>
                LuxProperty AI Ltd<br />
                
                Registered in England and Wales<br />
                Email:{" "}
                <a href="mailto:privacy@luxproperty.ai" className="text-primary underline-offset-2 hover:underline">
                  privacy@luxproperty.ai
                </a>
              </p>
            </Section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
