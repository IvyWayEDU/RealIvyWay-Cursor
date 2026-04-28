import type { Metadata } from 'next';

import PublicLayoutClient from '@/components/PublicLayoutClient';
import LandingHeroHeader from '@/components/LandingHeroHeader';
import FAQAccordion from '@/components/FAQAccordion';
import { SITE_NAME } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: `FAQ | ${SITE_NAME}`,
  description:
    'Answers to common questions about IvyWay tutoring, college counseling, test prep, virtual tours, and IvyWay AI.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: `FAQ | ${SITE_NAME}`,
    description:
      'Answers to common questions about IvyWay tutoring, college counseling, test prep, virtual tours, and IvyWay AI.',
    url: '/faq',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${SITE_NAME} preview` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `FAQ | ${SITE_NAME}`,
    description:
      'Answers to common questions about IvyWay tutoring, college counseling, test prep, virtual tours, and IvyWay AI.',
    images: ['/twitter-image'],
  },
};

export default function FAQPage() {
  return (
    <PublicLayoutClient>
      <LandingHeroHeader />
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0088CB]">FAQ</p>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.02em] text-[#06233A] sm:text-5xl leading-[1.06]">
            Questions, answered.
          </h1>
          <p className="mt-5 text-sm leading-7 text-[#06233A]/70 sm:text-base">
            Everything you need to know about tutoring, college counseling, SAT/ACT test prep, virtual college tours,
            and IvyWay AI.
          </p>

          <div className="mt-10">
            <FAQAccordion
              items={[
                {
                  question: 'How does IvyWay tutoring work?',
                  answer:
                    'Choose a subject, pick a verified tutor, and book sessions that fit your schedule. After each session, you’ll get clear next steps—and IvyWay AI can help you practice between sessions.',
                },
                {
                  question: 'How does College Counseling work?',
                  answer:
                    'We connect students with real college students currently attending the schools they are interested in. This gives families direct insight into academics, campus life, admissions expectations, and the real student experience. Instead of generic advice, students get guidance from mentors who have actually gone through the process and understand what it takes to succeed at that specific school.',
                },
                {
                  question: 'What is IvyWay AI?',
                  answer:
                    'IvyWay AI is your academic co-pilot for studying, planning, flashcards, quizzes, and problem solving—built to reinforce real tutoring and counseling work, not replace it.',
                },
                {
                  question: 'Can I book college counseling by school?',
                  answer:
                    'Yes. Choose the colleges you care about, and we’ll match you with counselors and mentors who can share real perspective and help you plan effectively.',
                },
                {
                  question: 'Are virtual tours live?',
                  answer:
                    'Yes. Virtual tours are hosted by real students who can show you campus and answer questions with honest, current perspective.',
                },
              ]}
            />
          </div>
        </div>
      </section>
    </PublicLayoutClient>
  );
}

