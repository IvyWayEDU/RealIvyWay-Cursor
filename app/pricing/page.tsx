import type { Metadata } from 'next';

import FAQAccordion from '@/components/FAQAccordion';
import PricingSection from '@/components/PricingSection';
import PublicLayoutClient from '@/components/PublicLayoutClient';

export const metadata: Metadata = {
  title: 'IvyWay Pricing | Tutoring, Test Prep, and College Counseling',
  description: 'View IvyWay pricing for tutoring, college counseling, and AI academic tools.',
};

export default function PricingPage() {
  return (
    <PublicLayoutClient>
      <div className="bg-white">
        {/* Hero */}
        <section className="border-b border-gray-200 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
                Simple, Transparent Pricing
              </h1>
              <p className="mt-4 text-xl leading-8 text-gray-600">
                Choose the support level that fits your goals. No hidden fees.
              </p>
            </div>
          </div>
        </section>

        {/* Plans */}
        <PricingSection />

        {/* FAQ about payments & refunds */}
        <section id="payments-faq" className="border-t border-gray-200 bg-gray-50 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">
                FAQ about payments &amp; refunds
              </h2>
              <p className="mt-4 text-lg leading-8 text-gray-600">
                Quick answers to common billing questions.
              </p>
            </div>
            <div className="mx-auto mt-12 max-w-3xl">
              <FAQAccordion
                items={[
                  {
                    question: 'How do payments work?',
                    answer:
                      'Checkout is processed securely. You can book individual sessions or choose a monthly plan where available.',
                  },
                  {
                    question: 'Do you charge hidden fees?',
                    answer: 'No. Pricing is transparent and shown clearly before you confirm checkout.',
                  },
                  {
                    question: 'What is your cancellation policy?',
                    answer:
                      'You can cancel or reschedule sessions up to 24 hours in advance through your dashboard.',
                  },
                  {
                    question: 'Do you offer refunds?',
                    answer:
                      'Refund eligibility depends on timing and service type. If you have an issue with a booking, contact support and we’ll help resolve it.',
                  },
                  {
                    question: 'Can I change or cancel a monthly plan?',
                    answer:
                      'Yes. You can manage plan changes in your account settings. Changes apply to future billing periods.',
                  },
                ]}
              />
            </div>
          </div>
        </section>
      </div>
    </PublicLayoutClient>
  );
}


