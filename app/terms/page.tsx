import type { Metadata } from 'next';

import PublicLayoutClient from '@/components/PublicLayoutClient';
import LandingHeroHeader from '@/components/LandingHeroHeader';
import LegalPageLayout from '@/components/LegalPageLayout';
import { SITE_NAME } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: `Terms of Service | ${SITE_NAME}`,
  description:
    'IvyWay Terms of Service governing access to and use of the IvyWay platform.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: `Terms of Service | ${SITE_NAME}`,
    description: 'IvyWay Terms of Service governing access to and use of the IvyWay platform.',
    url: '/terms',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${SITE_NAME} preview` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Terms of Service | ${SITE_NAME}`,
    description: 'IvyWay Terms of Service governing access to and use of the IvyWay platform.',
    images: ['/twitter-image'],
  },
};

export default function TermsPage() {
  return (
    <PublicLayoutClient>
      <LandingHeroHeader />
      <LegalPageLayout
        title="Terms of Service"
        description="These Terms govern your access to and use of IvyWay."
        lastUpdated="April 24, 2026"
        toc={[
          { href: '#overview', label: 'Overview' },
          { href: '#accounts', label: 'Accounts & eligibility' },
          { href: '#marketplace', label: 'Marketplace & sessions' },
          { href: '#payments', label: 'Payments, cancellations & refunds' },
          { href: '#conduct', label: 'Acceptable use' },
          { href: '#content', label: 'Content & intellectual property' },
          { href: '#disclaimers', label: 'Disclaimers & limitation of liability' },
          { href: '#termination', label: 'Termination' },
          { href: '#changes', label: 'Changes to these Terms' },
          { href: '#contact', label: 'Contact' },
        ]}
      >
        <section id="overview" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Overview</h2>
          <p>
            IvyWay (the “<span className="font-semibold">Platform</span>”) helps
            connect students and families with education providers, including
            tutors, counselors, and mentors (“
            <span className="font-semibold">Providers</span>”). By accessing or
            using the Platform, you agree to these Terms of Service (“
            <span className="font-semibold">Terms</span>”).
          </p>
          <p>
            If you do not agree to these Terms, do not use the Platform. If you
            are using the Platform on behalf of an organization, you represent
            you have authority to bind that organization to these Terms.
          </p>
        </section>

        <section id="accounts" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Accounts &amp; eligibility
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-semibold">Accurate information:</span> You
              must provide accurate account information and keep it up to date.
            </li>
            <li>
              <span className="font-semibold">Security:</span> You are
              responsible for maintaining the confidentiality of your account
              credentials and for activities that occur under your account.
            </li>
            <li>
              <span className="font-semibold">Minors:</span> If you are under 18
              (or the age of majority where you live), you may use the Platform
              only with the involvement and consent of a parent or legal
              guardian.
            </li>
          </ul>
        </section>

        <section id="marketplace" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Marketplace &amp; sessions
          </h2>
          <p>
            The Platform enables scheduling and delivery of education services
            (each, a “<span className="font-semibold">Session</span>”). Providers
            are responsible for the services they offer and deliver. IvyWay may
            provide tools, guidelines, and support, but does not guarantee any
            specific academic outcomes.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-semibold">Session availability:</span>{' '}
              Availability, pricing, and offerings may vary by Provider and are
              subject to change.
            </li>
            <li>
              <span className="font-semibold">Session conduct:</span> You agree
              to participate respectfully and follow any Platform rules for
              scheduling, attendance, and communications.
            </li>
          </ul>
        </section>

        <section id="payments" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Payments, cancellations &amp; refunds
          </h2>
          <p>
            Fees, taxes, and any applicable charges are shown before you confirm
            a purchase. By completing checkout, you authorize IvyWay (and its
            payment processors) to charge your selected payment method.
          </p>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <p className="font-semibold text-gray-900">
              Operational rules (summary)
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-2 text-sm text-gray-700">
              <li>
                Cancellations more than <span className="font-semibold">24 hours</span>{' '}
                before a Session may be cancelled without a full charge.
              </li>
              <li>
                Cancellations within <span className="font-semibold">24 hours</span>{' '}
                of a Session may be charged.
              </li>
              <li>
                Student no-shows may result in a full charge.
              </li>
              <li>
                Provider no-shows may result in the Provider not being paid and
                the Session being flagged for review.
              </li>
              <li>
                If a Provider joins as scheduled but the student does not, the
                Provider may still be eligible to be paid.
              </li>
              <li>
                Refunds are reviewed based on Session status, cancellation
                timing, no-show rules, policy compliance, and admin review.
              </li>
            </ul>
          </div>
          <p>
            For more detail, review our{' '}
            <a
              className="font-semibold text-[#0088CB] hover:text-[#0077B3] underline underline-offset-4"
              href="/cancellation-policy"
            >
              Cancellation Policy
            </a>{' '}
            and{' '}
            <a
              className="font-semibold text-[#0088CB] hover:text-[#0077B3] underline underline-offset-4"
              href="/refund-policy"
            >
              Refund Policy
            </a>
            . IvyWay may deny, prorate, or reverse refunds where appropriate,
            including for fraud, abuse, repeated chargebacks, or policy
            violations.
          </p>
        </section>

        <section id="conduct" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Violate any applicable law or regulation.</li>
            <li>
              Harass, threaten, discriminate against, or harm others.
            </li>
            <li>
              Misrepresent your identity, qualifications, or affiliation.
            </li>
            <li>
              Attempt to bypass Platform protections, scrape data, or interfere
              with Platform operation.
            </li>
            <li>
              Use the Platform to share content that is illegal, harmful,
              exploitative, or infringes intellectual property.
            </li>
          </ul>
        </section>

        <section id="content" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Content &amp; intellectual property
          </h2>
          <p>
            The Platform, including its software, branding, and design, is owned
            by IvyWay or its licensors and is protected by applicable laws. You
            may not copy, modify, distribute, sell, or lease any part of the
            Platform except as permitted by these Terms.
          </p>
          <p>
            You retain ownership of content you submit to the Platform (“User
            Content”). You grant IvyWay a non-exclusive, worldwide, royalty-free
            license to host, store, reproduce, and display User Content as
            needed to operate, improve, and secure the Platform.
          </p>
        </section>

        <section id="disclaimers" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Disclaimers &amp; limitation of liability
          </h2>
          <p>
            The Platform is provided “as is” and “as available”. To the maximum
            extent permitted by law, IvyWay disclaims all warranties, express or
            implied, including fitness for a particular purpose, merchantability,
            and non-infringement.
          </p>
          <p>
            To the maximum extent permitted by law, IvyWay will not be liable for
            any indirect, incidental, special, consequential, or punitive damages,
            or any loss of profits, revenue, data, or goodwill, arising out of or
            related to your use of the Platform. IvyWay’s total liability for all
            claims will not exceed the amount you paid to IvyWay in the 3 months
            preceding the event giving rise to the claim, unless applicable law
            requires otherwise.
          </p>
        </section>

        <section id="termination" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Termination</h2>
          <p>
            IvyWay may suspend or terminate access to the Platform at any time if
            we reasonably believe you violated these Terms, created risk or
            potential legal exposure, or used the Platform in a manner that harms
            IvyWay, users, or third parties.
          </p>
        </section>

        <section id="changes" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Changes to these Terms
          </h2>
          <p>
            We may update these Terms from time to time. If changes are material,
            we will take reasonable steps to provide notice (for example, by
            posting on the Platform). Your continued use after the effective date
            means you accept the updated Terms.
          </p>
        </section>

        <section id="contact" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Contact</h2>
          <p>
            For questions about these Terms, contact{' '}
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

