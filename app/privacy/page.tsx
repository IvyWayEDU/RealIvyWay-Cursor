import type { Metadata } from 'next';

import PublicLayoutClient from '@/components/PublicLayoutClient';
import LandingHeroHeader from '@/components/LandingHeroHeader';
import LegalPageLayout from '@/components/LegalPageLayout';
import { SITE_NAME } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description:
    'IvyWay Privacy Policy describing how we collect, use, and share information.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: `Privacy Policy | ${SITE_NAME}`,
    description: 'IvyWay Privacy Policy describing how we collect, use, and share information.',
    url: '/privacy',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${SITE_NAME} preview` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Privacy Policy | ${SITE_NAME}`,
    description: 'IvyWay Privacy Policy describing how we collect, use, and share information.',
    images: ['/twitter-image'],
  },
};

export default function PrivacyPage() {
  return (
    <PublicLayoutClient>
      <LandingHeroHeader />
      <LegalPageLayout
        title="Privacy Policy"
        description="This policy explains how IvyWay collects, uses, and shares information."
        lastUpdated="April 24, 2026"
        toc={[
          { href: '#scope', label: 'Scope' },
          { href: '#info-we-collect', label: 'Information we collect' },
          { href: '#how-we-use', label: 'How we use information' },
          { href: '#sharing', label: 'How we share information' },
          { href: '#payments', label: 'Payments' },
          { href: '#cookies', label: 'Cookies & analytics' },
          { href: '#security', label: 'Security & retention' },
          { href: '#children', label: 'Children & minors' },
          { href: '#choices', label: 'Your choices' },
          { href: '#changes', label: 'Changes' },
          { href: '#contact', label: 'Contact' },
        ]}
      >
        <section id="scope" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Scope</h2>
          <p>
            This Privacy Policy describes how IvyWay collects, uses, and shares
            information when you visit or use our websites, products, and
            services (collectively, the “Platform”).
          </p>
          <p>
            This Policy does not apply to third-party websites, services, or
            applications that may be linked from the Platform. Those third
            parties have their own privacy policies.
          </p>
        </section>

        <section id="info-we-collect" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Information we collect
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-semibold">Account information:</span> Name,
              email address, profile details, and role (e.g., student or
              provider).
            </li>
            <li>
              <span className="font-semibold">Session and usage data:</span>{' '}
              Scheduling details, attendance indicators (e.g., joined/left), and
              activity on the Platform.
            </li>
            <li>
              <span className="font-semibold">Communications:</span> Messages
              you send to us (for example, support requests).
            </li>
            <li>
              <span className="font-semibold">Device and log data:</span> IP
              address, browser type, pages viewed, and similar technical
              information.
            </li>
          </ul>
          <p>
            We aim to collect only what we need to operate, secure, and improve
            the Platform.
          </p>
        </section>

        <section id="how-we-use" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            How we use information
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Provide and operate the Platform, including scheduling.</li>
            <li>Process payments and prevent fraud (where applicable).</li>
            <li>
              Support safety and trust, including enforcing policies and
              reviewing disputes.
            </li>
            <li>Communicate with you about updates, support, and notices.</li>
            <li>Analyze performance and improve features and usability.</li>
          </ul>
        </section>

        <section id="sharing" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            How we share information
          </h2>
          <p>
            We may share information in the following circumstances:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-semibold">With other users:</span> Limited
              profile and scheduling information may be shared to facilitate
              Sessions (for example, provider profile details shown to students).
            </li>
            <li>
              <span className="font-semibold">With service providers:</span> We
              use vendors to host data, run the Platform, provide analytics, and
              process payments. They may access information only to perform
              services for IvyWay and are expected to protect it.
            </li>
            <li>
              <span className="font-semibold">For legal and safety reasons:</span>{' '}
              If required by law, subpoena, or similar legal process, or to
              protect the rights, safety, and security of IvyWay, our users, or
              the public.
            </li>
            <li>
              <span className="font-semibold">Business transfers:</span> In
              connection with a merger, acquisition, financing, or sale of all
              or part of our business (subject to standard confidentiality
              protections).
            </li>
          </ul>
          <p>
            We do not sell personal information in exchange for money.
          </p>
        </section>

        <section id="payments" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Payments</h2>
          <p>
            Payments may be processed by third-party payment processors. IvyWay
            may receive information from payment processors (for example, a
            payment status and limited billing details). We do not store full
            payment card numbers on our servers.
          </p>
        </section>

        <section id="cookies" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Cookies &amp; analytics
          </h2>
          <p>
            We may use cookies and similar technologies to keep you signed in,
            remember preferences, measure performance, and improve the Platform.
            You can control cookies through your browser settings, but some
            features may not function properly if cookies are disabled.
          </p>
        </section>

        <section id="security" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">
            Security &amp; retention
          </h2>
          <p>
            We use reasonable administrative, technical, and organizational
            measures to protect information. No system is 100% secure, and we
            cannot guarantee absolute security.
          </p>
          <p>
            We retain information for as long as needed to provide the Platform,
            comply with legal obligations, resolve disputes, and enforce
            agreements. Retention periods may vary depending on the type of
            information and the reason we hold it.
          </p>
        </section>

        <section id="children" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Children &amp; minors</h2>
          <p>
            The Platform is not directed to children under 13. We do not
            knowingly collect personal information from children under 13. If
            you believe a child under 13 has provided personal information,
            contact us and we will take appropriate steps.
          </p>
          <p>
            If you are under 18 (or the age of majority where you live), you may
            use the Platform only with the involvement and consent of a parent
            or legal guardian.
          </p>
        </section>

        <section id="choices" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Your choices</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-semibold">Access and updates:</span> You may
              be able to access and update certain profile information in your
              account.
            </li>
            <li>
              <span className="font-semibold">Marketing:</span> You can opt out
              of marketing communications by following the instructions in those
              messages.
            </li>
            <li>
              <span className="font-semibold">Data requests:</span> You may
              contact us to request access to, deletion of, or information about
              certain data, subject to applicable law and operational needs.
            </li>
          </ul>
        </section>

        <section id="changes" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Changes</h2>
          <p>
            We may update this Privacy Policy from time to time. If we make
            material changes, we will take reasonable steps to provide notice.
            The “Last updated” date reflects the effective date of this Policy.
          </p>
        </section>

        <section id="contact" className="space-y-4">
          <h2 className="text-xl font-semibold text-black">Contact</h2>
          <p>
            Contact us at{' '}
            <a
              className="font-semibold text-[#0088CB] hover:text-[#0077B3] underline underline-offset-4"
              href="mailto:contact@ivywayedu.com"
            >
              contact@ivywayedu.com
            </a>{' '}
            with questions about this Privacy Policy.
          </p>
        </section>
      </LegalPageLayout>
    </PublicLayoutClient>
  );
}

