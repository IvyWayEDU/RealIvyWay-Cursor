import type { Metadata } from 'next';
import Image from 'next/image';

import PublicLayoutClient from '@/components/PublicLayoutClient';
import LandingHeroHeader from '@/components/LandingHeroHeader';
import { SITE_NAME } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: `IvyWay AI | ${SITE_NAME}`,
  description:
    'IvyWay AI gives students 24/7 academic support with problem solving, flashcards, custom quizzes, planning, and more—built to reinforce real tutoring and counseling.',
  alternates: { canonical: '/ivyway-ai' },
  openGraph: {
    title: `IvyWay AI | ${SITE_NAME}`,
    description:
      'IvyWay AI gives students 24/7 academic support with problem solving, flashcards, custom quizzes, planning, and more—built to reinforce real tutoring and counseling.',
    url: '/ivyway-ai',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${SITE_NAME} preview` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `IvyWay AI | ${SITE_NAME}`,
    description:
      'IvyWay AI gives students 24/7 academic support with problem solving, flashcards, custom quizzes, planning, and more—built to reinforce real tutoring and counseling.',
    images: ['/twitter-image'],
  },
};

export default function IvyWayAiMarketingPage() {
  return (
    <PublicLayoutClient>
      <LandingHeroHeader />
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0088CB]">IvyWay AI</p>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.02em] text-[#06233A] sm:text-5xl leading-[1.06]">
            AI study tools built to support real learning.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#06233A]/70 sm:text-base">
            IvyWay AI provides 24/7 academic support—problem solving, flashcards, custom quizzes, planning, and more.
            It’s designed to reinforce tutoring and counseling, not replace it.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[34px] border border-[#0088CB]/14 bg-[linear-gradient(180deg,#f6fbff_0%,#eef8ff_45%,#ffffff_100%)] p-6 shadow-[0_26px_80px_rgba(2,10,23,0.10)] ring-1 ring-black/5 sm:p-8">
              <div className="text-lg font-semibold text-[#06233A]">What you get</div>
              <ul className="mt-4 space-y-3 text-sm text-[#06233A]/75">
                <li>Instant problem solving with step-by-step help</li>
                <li>Flashcard generator for any topic</li>
                <li>Custom quizzes with adjustable difficulty</li>
                <li>Planner to organize tasks and studying</li>
                <li>Study modes designed for engagement and consistency</li>
              </ul>
              <div className="mt-7">
                <a
                  href="/auth/login"
                  data-ga-event="get_started_click"
                  data-ga-label="ivyway_ai_marketing_get_started"
                  className="inline-flex items-center justify-center rounded-xl bg-[#0088CB] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0077B3] transition-colors"
                >
                  Get Started
                </a>
              </div>
            </div>

            <div className="rounded-[34px] border border-[#06233A]/10 bg-white p-6 shadow-[0_18px_55px_rgba(2,10,23,0.08)] ring-1 ring-black/5 sm:p-8">
              <div className="text-lg font-semibold text-[#06233A]">Preview</div>
              <p className="mt-2 text-sm text-[#06233A]/70">
                A quick look at the IvyWay AI experience inside the platform.
              </p>

              <div className="mt-5 overflow-hidden rounded-2xl border border-[#06233A]/10 bg-[#06233A]/[0.02]">
                <div className="relative aspect-[16/10] w-full">
                  <Image
                    src="/images/ai-showcase/ivyway-ai-dashboard.jpeg"
                    alt="IvyWay AI dashboard screenshot"
                    fill
                    sizes="(min-width: 1024px) 560px, 92vw"
                    className="object-cover"
                    priority
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { src: '/images/ai-showcase/ivyway-ai-quiz.png', alt: 'IvyWay AI quiz generator' },
                  { src: '/images/ai-showcase/ivyway-ai-flashcards.png', alt: 'IvyWay AI flashcards' },
                  { src: '/images/ai-showcase/ivyway-ai-chat.png', alt: 'IvyWay AI chat' },
                  { src: '/images/ai-showcase/ivyway-ai-planner.png', alt: 'IvyWay AI planner' },
                ].map((img) => (
                  <div
                    key={img.src}
                    className="overflow-hidden rounded-xl border border-[#06233A]/10 bg-[#06233A]/[0.02]"
                  >
                    <div className="relative aspect-[16/10] w-full">
                      <Image
                        src={img.src}
                        alt={img.alt}
                        fill
                        sizes="(min-width: 1024px) 260px, 44vw"
                        className="object-cover"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayoutClient>
  );
}

