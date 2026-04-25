import type { Metadata } from 'next';

import PublicLayoutClient from '@/components/PublicLayoutClient';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Cancellation Policy | IvyWay',
  description:
    'IvyWay Cancellation Policy covering cancellations, late cancellations, and no-shows.',
};

export default function CancellationPolicyPage() {
  return (
    <PublicLayoutClient>
      <LegalPageLayout
        title="Cancellation Policy"
        description="Rules for cancelling or rescheduling Sessions on IvyWay."
        lastUpdated="April 24, 2026"
        toc={[
          { href: '#overview', label: 'Overview' },
          { href: '#more-than-24', label: 'More than 24 hours' },
          { href: '#within-24', label: 'Within 24 hours' },
          { href: '#no-shows', label: 'No-shows' },
          { href: '#provider-no-show', label: 'Provider no-show' },
          { href: '#disputes', label: 'Disputes & admin review' },
        ]}
      >
        <section id="overview" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Overview</h2>
          <p>
            This Cancellation Policy applies to Sessions booked through IvyWay.
            It is designed to protect students’ access to reliable support while
            also respecting Providers’ time.
          </p>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <p className="font-semibold text-gray-900">
              Key rules (high level)
            </p>
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
              <li>
                Provider no-shows may result in the Provider not being paid and
                the Session being flagged.
              </li>
              <li>
                If a Provider joins but the student does not, the Provider may
                still be eligible to be paid.
              </li>
            </ul>
          </div>
        </section>

        <section id="more-than-24" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Cancellations more than 24 hours before the Session
          </h2>
          <p>
            You may cancel or reschedule more than 24 hours before the scheduled
            start time. In these cases, the cancellation may be processed
            without a full charge, subject to any non-refundable fees disclosed
            at checkout (if applicable).
          </p>
        </section>

        <section id="within-24" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Cancellations within 24 hours of the Session
          </h2>
          <p>
            Cancellations within 24 hours of the scheduled start time may be
            charged. This includes late cancellations as well as last-minute
            rescheduling requests that are not accepted or cannot be
            accommodated.
          </p>
          <p>
            IvyWay may review exceptions on a case-by-case basis (for example,
            documented emergencies), but exceptions are not guaranteed.
          </p>
        </section>

        <section id="no-shows" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Student no-shows</h2>
          <p>
            If the student does not join the Session at the scheduled time, the
            Session may be treated as a no-show and may be charged in full.
            IvyWay may use Platform attendance indicators (join events and
            timestamps) when evaluating no-show situations.
          </p>
        </section>

        <section id="provider-no-show" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Provider no-shows</h2>
          <p>
            If a Provider does not join the Session as scheduled, the Session
            may be flagged for review, and the Provider may not be paid for that
            Session. Repeated no-shows or attendance issues may lead to account
            action, including reduced visibility, temporary suspension, or
            removal from the Platform.
          </p>
          <p>
            If a Provider joins as scheduled but the student does not, the
            Provider may still be eligible to be paid, subject to administrative
            review and policy compliance.
          </p>
        </section>

        <section id="disputes" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Disputes &amp; admin review
          </h2>
          <p>
            IvyWay may review cancellation disputes and no-show disputes using
            Platform records and information provided by the parties. IvyWay’s
            administrative determination may affect charges, refunds, and payout
            eligibility.
          </p>
          <p>
            For refund-related questions, see the{' '}
            <a
              className="font-semibold text-[#0088CB] hover:text-[#0077B3] underline underline-offset-4"
              href="/refund-policy"
            >
              Refund Policy
            </a>
            .
          </p>
        </section>
      </LegalPageLayout>
    </PublicLayoutClient>
  );
}

