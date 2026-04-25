import type { Metadata } from 'next';

import PublicLayoutClient from '@/components/PublicLayoutClient';
import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Tutor Agreement | IvyWay',
  description:
    'IvyWay Tutor Agreement outlining provider responsibilities, attendance expectations, and payout eligibility.',
};

export default function TutorAgreementPage() {
  return (
    <PublicLayoutClient>
      <LegalPageLayout
        title="Tutor Agreement"
        description="Agreement for tutors and education providers using IvyWay."
        lastUpdated="April 24, 2026"
        toc={[
          { href: '#relationship', label: 'Independent provider relationship' },
          { href: '#responsibilities', label: 'Provider responsibilities' },
          { href: '#attendance', label: 'Attendance & no-shows' },
          { href: '#quality', label: 'Session quality standards' },
          { href: '#eligibility', label: 'Payout eligibility (overview)' },
          { href: '#reviews', label: 'Admin review & enforcement' },
          { href: '#compliance', label: 'Compliance & professionalism' },
          { href: '#contact', label: 'Contact' },
        ]}
      >
        <section id="relationship" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Independent provider relationship
          </h2>
          <p>
            This Tutor Agreement (the “Agreement”) applies to you as a tutor,
            counselor, mentor, or other education provider (“Provider”) using
            the IvyWay Platform.
          </p>
          <p>
            Providers are independent service providers and are responsible for
            determining how to deliver their services. IvyWay provides a
            marketplace platform and administrative tools, but does not control
            the substance of Provider services.
          </p>
        </section>

        <section id="responsibilities" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Provider responsibilities
          </h2>
          <p>By offering services on IvyWay, you agree to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Provide accurate profile information, qualifications, and
              offerings.
            </li>
            <li>
              Deliver Sessions professionally, prepared, and in good faith.
            </li>
            <li>
              Communicate promptly with students regarding scheduling needs,
              within the Platform’s allowed communication methods.
            </li>
            <li>
              Comply with applicable laws and regulations, including any
              licensing or background requirements relevant to your services (if
              applicable).
            </li>
            <li>
              Maintain appropriate conduct, including respectful and safe
              interactions with students and families.
            </li>
          </ul>
        </section>

        <section id="attendance" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Attendance, cancellations &amp; no-shows
          </h2>
          <p>
            Reliability is essential to the student experience. Providers are
            expected to join Sessions on time and remain available for the
            scheduled duration unless the Session ends early by mutual agreement.
          </p>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <p className="font-semibold text-gray-900">
              Operational rules (summary)
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-2 text-sm text-gray-700">
              <li>
                Student cancellations more than{' '}
                <span className="font-semibold">24 hours</span> before the Session
                may be cancelled without a full charge.
              </li>
              <li>
                Student cancellations within{' '}
                <span className="font-semibold">24 hours</span> may be charged.
              </li>
              <li>Student no-shows may result in a full charge.</li>
              <li>
                Provider no-shows may result in the Provider not being paid and
                the Session being flagged for administrative review.
              </li>
              <li>
                If the Provider joins but the student does not, the Provider may
                still be eligible to be paid.
              </li>
            </ul>
          </div>
          <p>
            Providers should avoid last-minute cancellations. Repeated late
            cancellations, no-shows, or attendance issues may lead to account
            action.
          </p>
        </section>

        <section id="quality" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Session quality standards
          </h2>
          <p>
            Providers are expected to maintain a high standard of instruction and
            professionalism. This includes:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Being prepared with a plan appropriate to the student’s goals.</li>
            <li>Using respectful, age-appropriate communication.</li>
            <li>
              Delivering services consistent with what was represented in your
              listing.
            </li>
            <li>
              Maintaining a safe learning environment and adhering to Platform
              policies.
            </li>
          </ul>
        </section>

        <section id="eligibility" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Payout eligibility (overview)
          </h2>
          <p>
            Payouts are generally tied to eligible Sessions and may be affected
            by cancellations, no-shows, disputes, refunds, fraud, or policy
            violations. IvyWay may review Session records and related information
            to determine payout eligibility.
          </p>
          <p>
            For payout-specific terms, review the{' '}
            <a
              className="font-semibold text-[#0088CB] hover:text-[#0077B3] underline underline-offset-4"
              href="/provider-payout-agreement"
            >
              Provider Payout Agreement
            </a>
            .
          </p>
        </section>

        <section id="reviews" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Admin review &amp; enforcement
          </h2>
          <p>
            IvyWay may monitor and review Sessions for trust and safety, policy
            compliance, dispute resolution, and quality assurance. Reviews may
            consider Platform attendance indicators and other records.
          </p>
          <p>
            If IvyWay determines that a Provider has engaged in misconduct, poor
            quality service, misrepresentation, or repeated reliability issues,
            IvyWay may take action, including but not limited to warning, fee
            adjustments, payout holds, reduced visibility, temporary suspension,
            or account removal.
          </p>
        </section>

        <section id="compliance" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Compliance &amp; professionalism
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-semibold">Confidentiality:</span> Use
              discretion when handling student information and follow applicable
              privacy expectations.
            </li>
            <li>
              <span className="font-semibold">No circumvention:</span> Do not
              attempt to bypass Platform fees, policies, or processes, including
              by moving payments off-platform where prohibited.
            </li>
            <li>
              <span className="font-semibold">Integrity:</span> Do not falsify
              attendance, Session completion, or any information used for billing
              or payout decisions.
            </li>
          </ul>
        </section>

        <section id="contact" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Contact</h2>
          <p>
            Questions about this Agreement? Contact{' '}
            <a
              className="font-semibold text-[#0088CB] hover:text-[#0077B3] underline underline-offset-4"
              href="mailto:support@ivyway.com"
            >
              support@ivyway.com
            </a>
            .
          </p>
        </section>
      </LegalPageLayout>
    </PublicLayoutClient>
  );
}

