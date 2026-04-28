import type { Metadata } from 'next';

import PublicLayoutClient from '@/components/PublicLayoutClient';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Provider Payout Agreement | IvyWay',
  description:
    'IvyWay Provider Payout Agreement describing payout eligibility, holds, and reversals.',
};

export default function ProviderPayoutAgreementPage() {
  return (
    <PublicLayoutClient>
      <LegalPageLayout
        title="Provider Payout Agreement"
        description="Terms for payout eligibility and payout administration on IvyWay."
        lastUpdated="April 24, 2026"
        toc={[
          { href: '#overview', label: 'Overview' },
          { href: '#eligibility', label: 'Eligible sessions' },
          { href: '#holds', label: 'Holds, reversals & offsets' },
          { href: '#no-shows', label: 'No-shows and attendance' },
          { href: '#refunds', label: 'Refunds and disputes' },
          { href: '#tax', label: 'Taxes and reporting' },
          { href: '#admin', label: 'Administrative review' },
          { href: '#changes', label: 'Changes' },
          { href: '#contact', label: 'Contact' },
        ]}
      >
        <section id="overview" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Overview</h2>
          <p>
            This Provider Payout Agreement (the “Payout Agreement”) applies to
            Providers receiving payouts through IvyWay for Sessions booked on the
            Platform.
          </p>
          <p>
            This Payout Agreement is intended to clarify payout eligibility,
            administrative review, and circumstances where payouts may be held,
            adjusted, or reversed.
          </p>
        </section>

        <section id="eligibility" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Eligible Sessions</h2>
          <p>
            Payouts are only owed for eligible Sessions. Eligibility generally
            requires that the Session is properly booked through the Platform
            and is treated as completed under Platform records and policies.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Sessions that are cancelled late, disputed, refunded, or associated
              with policy violations may be ineligible or may have adjusted
              payout amounts.
            </li>
            <li>
              IvyWay may rely on Platform attendance indicators and Session
              status when assessing eligibility.
            </li>
          </ul>
        </section>

        <section id="holds" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Holds, reversals &amp; offsets
          </h2>
          <p>
            IvyWay may hold, delay, adjust, offset, or reverse payouts where
            reasonably necessary, including for:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Disputes, chargebacks, or payment failures</li>
            <li>Refunds (full or partial)</li>
            <li>Fraud, suspected fraud, or misuse of the Platform</li>
            <li>No-shows or attendance-related issues</li>
            <li>Violations of IvyWay policies or agreements</li>
            <li>Errors in Session records or payout calculations</li>
          </ul>
          <p>
            If a payout is reversed after being paid out, IvyWay may recover the
            amount by offsetting future payouts or through other lawful means.
          </p>
        </section>

        <section id="no-shows" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            No-shows and attendance
          </h2>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <p className="font-semibold text-gray-900">
              Operational rules (summary)
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-2 text-sm text-gray-700">
              <li>
                Provider no-shows may result in the Provider not being paid and
                the Session being flagged for review.
              </li>
              <li>
                If the Provider joins but the student does not, the Provider may
                still be eligible to be paid.
              </li>
              <li>
                Student no-shows can result in a full charge, which may support
                Provider payout eligibility (subject to review).
              </li>
            </ul>
          </div>
          <p>
            IvyWay may require sufficient evidence of attendance (including join
            events and timing). Repeated reliability issues may lead to payout
            restrictions or account action.
          </p>
        </section>

        <section id="refunds" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Refunds and disputes
          </h2>
          <p>
            If a Session is refunded (in whole or in part), the associated payout
            may be reduced, held, or reversed. Disputes may result in payout
            holds while IvyWay reviews the matter.
          </p>
          <p>
            Refunds are reviewed based on Session status, cancellation timing,
            no-show rules, policy compliance, and admin review. For refund
            criteria, review the{' '}
            <a
              className="font-semibold text-[#0088CB] hover:text-[#0077B3] underline underline-offset-4"
              href="/refund-policy"
            >
              Refund Policy
            </a>
            .
          </p>
        </section>

        <section id="tax" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Taxes and reporting</h2>
          <p>
            Providers are responsible for determining and fulfilling their tax
            obligations related to payouts they receive. IvyWay may request tax
            information where required for compliance and reporting.
          </p>
        </section>

        <section id="admin" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Administrative review
          </h2>
          <p>
            IvyWay may review Sessions and payouts to protect the integrity of
            the Platform and ensure compliance with policies. Administrative
            determinations may affect payout timing and eligibility.
          </p>
        </section>

        <section id="changes" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Changes</h2>
          <p>
            IvyWay may update this Payout Agreement from time to time. Continued
            use of the Platform as a Provider after changes take effect
            constitutes acceptance of the updated terms.
          </p>
        </section>

        <section id="contact" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Contact</h2>
          <p>
            Questions about payouts? Contact{' '}
            <a
              className="font-semibold text-[#0088CB] hover:text-[#0077B3] underline underline-offset-4"
              href="mailto:contact@ivywayedu.com"
            >
              contact@ivywayedu.com
            </a>
            .
          </p>
        </section>
      </LegalPageLayout>
    </PublicLayoutClient>
  );
}

