import type { Metadata } from 'next';

import PublicLayoutClient from '@/components/PublicLayoutClient';
import LandingHeroHeader from '@/components/LandingHeroHeader';
import { SITE_NAME } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: `Contact | ${SITE_NAME}`,
  description: 'Contact IvyWay for support, partnerships, and general questions.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: `Contact | ${SITE_NAME}`,
    description: 'Contact IvyWay for support, partnerships, and general questions.',
    url: '/contact',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${SITE_NAME} preview` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Contact | ${SITE_NAME}`,
    description: 'Contact IvyWay for support, partnerships, and general questions.',
    images: ['/twitter-image'],
  },
};

export default function ContactPage() {
  return (
    <PublicLayoutClient>
      <LandingHeroHeader />
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0088CB]">Contact</p>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.02em] text-[#06233A] sm:text-5xl leading-[1.06]">
            Talk to IvyWay
          </h1>
          <p className="mt-5 text-sm leading-7 text-[#06233A]/70 sm:text-base">
            For questions about tutoring, college counseling, SAT/ACT test prep, virtual college tours, or IvyWay AI,
            reach out and we’ll get back to you.
          </p>

          <div className="mt-10 rounded-3xl border border-[#06233A]/10 bg-white p-7 shadow-[0_18px_55px_rgba(2,10,23,0.08)] ring-1 ring-black/5 sm:p-9">
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold tracking-[0.12em] text-[#06233A]">EMAIL</div>
                <a
                  href="mailto:contact@ivywayedu.com"
                  className="mt-3 block text-base font-semibold text-[#0088CB] hover:text-[#0077B3] transition-colors"
                >
                  contact@ivywayedu.com
                </a>
                <div className="mt-2 text-sm text-[#06233A]/65">We typically respond within 1–2 business days.</div>
              </div>
              <div>
                <div className="text-sm font-semibold tracking-[0.12em] text-[#06233A]">QUICK LINKS</div>
                <div className="mt-4 space-y-2 text-sm font-medium text-[#06233A]/75">
                  <a href="/#pricing" className="block hover:text-[#06233A] transition-colors">
                    Pricing
                  </a>
                  <a href="/faq" className="block hover:text-[#06233A] transition-colors">
                    FAQ
                  </a>
                  <a href="/ivyway-ai" className="block hover:text-[#06233A] transition-colors">
                    IvyWay AI
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayoutClient>
  );
}

