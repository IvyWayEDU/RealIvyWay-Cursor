import type { Metadata } from 'next';

import PublicLayoutClient from '@/components/PublicLayoutClient';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Refund Policy | IvyWay',
  description:
    'IvyWay Refund Policy outlining how refund requests are reviewed and handled.',
};

export default function RefundPolicyPage() {
  return (
    <PublicLayoutClient>
      <LegalPageLayout
        title="Refund Policy"
        description="How IvyWay reviews and processes refund requests."
        lastUpdated="April 24, 2026"
        toc={[
          { href: '#overview', label: 'Overview' },
          { href: '#eligibility', label: 'Eligibility factors' },
          { href: '#no-shows', label: 'No-shows & attendance' },
          { href: '#process', label: 'How to request a refund' },
          { href: '#timing', label: 'Review timing' },
          { href: '#final', label: 'Final decisions' },
        ]}
      >
        <section id="overview" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Overview</h2>
          <p>
            IvyWay aims to be fair to students and Providers. Refund requests are
            reviewed based on the facts of the Session, including cancellation
            timing, attendance, and administrative review.
          </p>
          <p>
            This policy applies to one-time Session purchases and may also apply
            to plan-based or bundled offerings where relevant. If a conflict
            exists between this policy and an offer-specific policy presented at
            purchase, the offer-specific policy may control.
          </p>
        </section>

        <section id="eligibility" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Eligibility factors</h2>
          <p>
            IvyWay considers the following factors when reviewing refund
            requests:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-semibold">Session status</span> (completed,
              cancelled, rescheduled, or disputed).
            </li>
            <li>
              <span className="font-semibold">Cancellation timing</span>,
              including whether cancellation occurred more than 24 hours before
              the Session or within 24 hours.
            </li>
            <li>
              <span className="font-semibold">Attendance indicators</span> (who
              joined, when, and for how long), including no-show rules.
            </li>
            <li>
              <span className="font-semibold">Policy compliance</span> and prior
              history (e.g., repeated late cancellations or abuse).
            </li>
            <li>
              <span className="font-semibold">Administrative review</span>,
              including any relevant communications and evidence submitted.
            </li>
          </ul>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <p className="font-semibold text-gray-900">Operational rules</p>
            <ul className="mt-3 list-disc pl-5 space-y-2 text-sm text-gray-700">
              <li>
                Cancellations more than <span className="font-semibold">24 hours</span>{' '}
                before a Session may be cancelled without a full charge.
              </li>
              <li>
                Cancellations within <span className="font-semibold">24 hours</span>{' '}
                may be charged.
              </li>
              <li>Student no-shows can result in a full charge.</li>
            </ul>
          </div>
        </section>

        <section id="no-shows" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            No-shows &amp; attendance
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-semibold">Student no-show:</span> If the
              student does not join the Session as scheduled, the Session may be
              treated as completed for billing purposes and may be charged in
              full.
            </li>
            <li>
              <span className="font-semibold">Provider no-show:</span> If the
              Provider does not join as scheduled, the Provider may not be paid,
              and the Session may be flagged for administrative review.
            </li>
            <li>
              <span className="font-semibold">Provider joined, student did not:</span>{' '}
              If the Provider joins as scheduled but the student does not, the
              Provider may still be eligible to be paid.
            </li>
          </ul>
          <p>
            IvyWay may rely on Platform records (including timestamps and join
            events) when evaluating attendance-related issues.
          </p>
        </section>

        <section id="process" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            How to request a refund
          </h2>
          <p>
            To request a refund, contact{' '}
            <a
              className="font-semibold text-[#0088CB] hover:text-[#0077B3] underline underline-offset-4"
              href="mailto:contact@ivywayedu.com"
            >
              contact@ivywayedu.com
            </a>{' '}
            and include:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Your account email</li>
            <li>Session date/time and Provider name</li>
            <li>A brief description of the issue</li>
            <li>Any relevant context or documentation</li>
          </ul>
        </section>

        <section id="timing" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Review timing</h2>
          <p>
            We aim to review requests as quickly as practical. Some requests may
            require additional information or verification and may take longer.
            If a refund is approved, processing times may vary depending on the
            payment method and financial institutions.
          </p>
        </section>

        <section id="final" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Final decisions</h2>
          <p>
            IvyWay may approve, partially approve, deny, or reverse a refund
            where appropriate, including in cases involving disputes, fraud,
            chargebacks, no-shows, policy violations, or misuse of the Platform.
          </p>
          <p>
            Refund decisions are made based on administrative review and the
            information reasonably available at the time.
          </p>
        </section>
      </LegalPageLayout>
    </PublicLayoutClient>
  );
}

