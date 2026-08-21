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
  useDocumentTitle("Privacy Policy", "Read the LuxProperty.ai privacy policy. How we collect, use, and protect your data in line with UK GDPR and the Data Protection Act 2018.");
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
            Last updated: 21 August 2026 · LuxProperty AI Ltd
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
                  <strong className="text-foreground">Search queries</strong> — the postcode or address you enter into
                  the search box. This is sent to our servers, where your brief is built from
                  official UK data sources; it is not processed only in your browser. We keep a
                  record of the searches that produce a brief, in these categories: a usage
                  record of which postcode district a brief was generated for and when (this is
                  what enforces your monthly allowance), a purchase record if you buy a Full
                  Brief for that district, any brief you choose to save to your portfolio, and
                  — if you are not signed in — a short-lived cookie holding the postcode of your
                  one free brief so it can be linked to an account if you sign up. We also keep
                  the property data itself in a shared cache, which is keyed by postcode
                  district and records nothing about who searched for it.
                </li>
                <li>
                  <strong className="text-foreground">Account details</strong> — if you create an account, your name,
                  email address and a securely hashed password. Your email address is also used
                  to send service emails such as address verification and password resets.
                </li>
                <li>
                  <strong className="text-foreground">Payment data</strong> — if you subscribe to a paid plan, payment
                  processing is handled by Stripe. We do not store card details. Stripe's
                  privacy policy applies to payment data.
                </li>
                <li>
                  <strong className="text-foreground">Usage analytics and advertising tags</strong> — every page loads
                  Google's tag, which runs both Google Analytics 4 and a Google Ads tag. These
                  set identifiers in your browser and send them to Google along with your IP
                  address and the pages you visit. This is not anonymous, aggregate-only data:
                  those identifiers can be tied to a browser or device, and to a Google account
                  where one is signed in. Our cookie banner controls Google's analytics storage
                  only — declining it does not prevent the Google Ads tag from loading.
                </li>
              </ul>
            </Section>

            <Section title="3. How we use your data">
              <p>We use the data we collect to:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Generate property reports in response to your search queries</li>
                <li>Send service emails such as address verification and password resets</li>
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
                  <strong className="text-foreground">Supabase</strong> — our database. Your account record, purchases,
                  saved briefs and usage records are stored there.
                </li>
                <li>
                  <strong className="text-foreground">Stripe</strong> — payment processing. We never see or store your
                  card details; Stripe's privacy policy governs how your payment data is handled.
                </li>
                <li>
                  <strong className="text-foreground">Resend</strong> — delivery of service emails such as address
                  verification and password resets. Your email address is shared with Resend in
                  order to send them.
                </li>
                <li>
                  <strong className="text-foreground">Google</strong> — Google Analytics 4 and Google Ads tags, loaded on
                  every page. Google receives your IP address, the pages you visit, and the
                  identifiers its tags set in your browser.
                </li>
                <li>
                  <strong className="text-foreground">Vercel</strong> — website and API hosting. Vercel may log request
                  metadata (IP address, user agent) as part of standard hosting operations.
                </li>
                <li>
                  <strong className="text-foreground">Official UK data sources</strong> — briefs are built by querying
                  public sources including HM Land Registry, Postcodes.io, the Environment
                  Agency, data.police.uk, the ONS, VOA/DLUHC council tax data and
                  planning.data.gov.uk. Most are queried by our servers; the valuation tool
                  looks up Postcodes.io directly from your browser. They receive the postcode
                  being looked up — and, where the request comes from your browser, your IP
                  address — but nothing identifying you by name or account.
                </li>
                <li>
                  <strong className="text-foreground">Content delivery networks</strong> — pages load fonts from Google
                  Fonts and Fontshare, and the sold-prices map loads map tiles from CARTO.
                  Because your browser requests these files directly, those providers receive
                  your IP address.
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
                We keep personal data only for as long as we need it. How long that is depends
                on the kind of data:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-foreground">Account records</strong> — your name, email address and hashed
                  password are kept for as long as your account is open. If you ask us to close
                  it, we delete the account and the saved briefs and usage records linked to it
                  {/* PROPOSED (business decision, not enforced in code): 30-day deletion SLA. */}
                  {" "}within 30 days.
                </li>
                <li>
                  <strong className="text-foreground">Purchase records</strong> — when you buy a Full Brief we keep the
                  district, the Stripe payment reference and the amount paid. This record is
                  what gives you permanent access to that brief, so we keep it for as long as
                  your account is open. We retain the underlying transaction record
                  {/* PROPOSED (business decision): 6 years, the usual UK tax/accounting window. */}
                  {" "}for 6 years to meet UK tax and accounting requirements, even if you close
                  your account.
                </li>
                <li>
                  <strong className="text-foreground">Saved briefs</strong> — briefs you save to your portfolio are kept
                  until you delete them, or until your account is deleted.
                </li>
                <li>
                  <strong className="text-foreground">Abuse-prevention counters</strong> — to stop automated abuse of free
                  briefs, we count generations against a one-way hash of your IP address. The IP
                  address itself is never stored, and these counters are deleted automatically
                  once they are more than two days old.
                </li>
                <li>
                  <strong className="text-foreground">Cached property data</strong> — data we fetch from public sources is
                  cached and treated as expired 7 days after it is fetched. This cache is keyed
                  by postcode district and holds nothing about who searched for it. Expired
                  entries stop being used immediately and are cleared out when we prune the
                  cache.
                </li>
              </ul>
              <p>
                Analytics and advertising data collected by Google's tags is held by Google
                under its own retention policies, which we do not control.
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
