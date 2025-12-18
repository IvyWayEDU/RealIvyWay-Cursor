'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import SignupPreview from '@/components/SignupPreview';
import FAQAccordion from '@/components/FAQAccordion';
import PricingSection from '@/components/PricingSection';

export default function Home() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-black sm:text-6xl lg:text-7xl">
            Build your future with <span className="text-[#0088CB]">IvyWay</span>
          </h1>
          <p className="mt-8 text-xl leading-8 text-gray-600 sm:text-2xl">
            Transform your academic journey with personalized 1-on-1 tutoring from certified experts and college counseling from real college students. Master any subject, build confidence, and unlock your full potential with IvyWay.
          </p>
          <div className="mt-12 flex items-center justify-center gap-x-4">
            <button
              onClick={() => {
                const element = document.getElementById('create-account');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="rounded-md bg-[#0088CB] px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]"
            >
              Get Started for free →
            </button>
            <button
              onClick={() => {
                const element = document.getElementById('how-it-works');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="rounded-md bg-white px-6 py-3.5 text-base font-semibold text-black ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              How it works
            </button>
          </div>
          
          {/* Demo Video */}
          <div className="mt-16 flex justify-center">
            <div className="relative w-full max-w-4xl aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm transition-all hover:bg-white hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:ring-offset-2"
                  aria-label="Play demo video"
                >
                  <svg
                    className="ml-1 h-12 w-12 text-[#0088CB]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Separator */}
      <div className="border-t border-gray-200"></div>

      {/* Social Proof Section */}
      <div className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-lg font-semibold text-black">
            Trusted by Top Schools, Students, and Educators
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-8 lg:gap-12">
            <div className="rounded-md border border-gray-300 px-4 py-2 text-base font-medium text-gray-900">Harvard</div>
            <div className="rounded-md border border-gray-300 px-4 py-2 text-base font-medium text-gray-900">Stanford</div>
            <div className="rounded-md border border-gray-300 px-4 py-2 text-base font-medium text-gray-900">MIT</div>
            <div className="rounded-md border border-gray-300 px-4 py-2 text-base font-medium text-gray-900">Oxford</div>
            <div className="rounded-md border border-gray-300 px-4 py-2 text-base font-medium text-gray-900">Cambridge</div>
            <div className="rounded-md border border-gray-300 px-4 py-2 text-base font-medium text-gray-900">Yale</div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div id="how-it-works" className="border-t border-gray-200 bg-white py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
              How it works
            </h2>
            <p className="mt-4 text-xl leading-8 text-gray-600">
              Get started in three simple steps
            </p>
          </div>
          <div className="mx-auto mt-20 max-w-4xl">
            <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-4">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center flex-1">
                <div className="flex h-16 w-16 items-center justify-center mb-4">
                  <svg className="h-8 w-8 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold leading-7 text-black">
                  Create your account
                </h3>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Sign up in seconds with email or social login.
                </p>
              </div>
              
              {/* Connector Line */}
              <div className="hidden lg:block flex-shrink-0 w-16 h-0 border-t-2 border-dashed border-gray-300"></div>
              <div className="lg:hidden w-0 h-16 border-l-2 border-dashed border-gray-300"></div>
              
              {/* Step 2 */}
              <div className="flex flex-col items-center text-center flex-1">
                <div className="flex h-16 w-16 items-center justify-center mb-4">
                  <svg className="h-8 w-8 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold leading-7 text-black">
                  Choose your role
                </h3>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Student, tutor, counselor, teacher, or admin.
                </p>
              </div>
              
              {/* Connector Line */}
              <div className="hidden lg:block flex-shrink-0 w-16 h-0 border-t-2 border-dashed border-gray-300"></div>
              <div className="lg:hidden w-0 h-16 border-l-2 border-dashed border-gray-300"></div>
              
              {/* Step 3 */}
              <div className="flex flex-col items-center text-center flex-1">
                <div className="flex h-16 w-16 items-center justify-center mb-4">
                  <svg className="h-8 w-8 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold leading-7 text-black">
                  Start learning or earning
                </h3>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Book sessions or offer your expertise to help others succeed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Core Features Section */}
      <div className="border-t border-gray-200 bg-gray-50 py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
              Everything you need to succeed
            </h2>
            <p className="mt-4 text-xl leading-8 text-gray-600">
              A complete platform built for modern learning
            </p>
          </div>
          <div className="mx-auto mt-20 max-w-2xl sm:mt-24 lg:mt-28 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-12 gap-y-16 lg:max-w-none lg:grid-cols-2">
              <div className="relative rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="absolute top-6 left-6">
                  <svg className="h-6 w-7 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" opacity="0.75" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M18 19.128v-.003c0-1.113-.285-2.16-.786-3.07M18 19.128v.106A12.318 12.318 0 0111.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M15 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" transform="translate(-3 0)" />
                  </svg>
                </div>
                <dt className="mt-8 text-lg font-semibold leading-7 text-black">
                  Unified Platform
                </dt>
                <dd className="mt-3 text-base leading-7 text-gray-600">
                  Tutoring, counseling, mentorship, and AI tools all in one place
                </dd>
              </div>
              <div className="relative rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="absolute top-6 left-6">
                  <svg className="h-6 w-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <dt className="mt-8 text-lg font-semibold leading-7 text-black">
                  Flexible Scheduling
                </dt>
                <dd className="mt-3 text-base leading-7 text-gray-600">
                  Book or offer sessions any time that works for you
                </dd>
              </div>
              <div className="relative rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="absolute top-6 left-6">
                  <svg className="h-6 w-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <dt className="mt-8 text-lg font-semibold leading-7 text-black">
                  Secure Payments
                </dt>
                <dd className="mt-3 text-base leading-7 text-gray-600">
                  Stripe-powered payouts for providers and checkout for buyers
                </dd>
              </div>
              <div className="relative rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="absolute top-6 left-6">
                  <svg className="h-6 w-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                </div>
                <dt className="mt-8 text-lg font-semibold leading-7 text-black">
                  Global Access
                </dt>
                <dd className="mt-3 text-base leading-7 text-gray-600">
                  Connect with educators and learners from anywhere in the world
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* For Students Section */}
      <div className="border-t border-gray-200 bg-white py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
              For Students
            </h2>
            <p className="mt-4 text-xl leading-8 text-gray-600">
              Everything you need to achieve your academic goals
            </p>
          </div>
          <div className="mx-auto mt-20 max-w-2xl sm:mt-24 lg:mt-28 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-12 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="relative rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="absolute top-6 left-6">
                  <svg className="h-6 w-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <dt className="mt-8 text-lg font-semibold leading-7 text-black">
                  Personalized learning
                </dt>
                <dd className="mt-3 text-base leading-7 text-gray-600">
                  Connect with qualified tutors who help you master subjects and excel on standardized tests.
                </dd>
              </div>
              <div className="relative rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="absolute top-6 left-6">
                  <svg className="h-6 w-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443a55.381 55.381 0 0 1 5.25 2.882V15" />
                  </svg>
                </div>
                <dt className="mt-8 text-lg font-semibold leading-7 text-black">
                  College Guidance
                </dt>
                <dd className="mt-3 text-base leading-7 text-gray-600">
                  Get expert counseling on applications, essays, admissions strategies, and life on campus. Plus explore campuses virtually.
                </dd>
              </div>
              <div className="relative rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="absolute top-6 left-6">
                  <svg className="h-6 w-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                </div>
                <dt className="mt-8 text-lg font-semibold leading-7 text-black">
                  AI-powered learning tools
                </dt>
                <dd className="mt-3 text-base leading-7 text-gray-600">
                  Leverage AI tools to personalize your study plans and accelerate your learning.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* For Tutors & Counselors Section */}
      <div className="border-t border-gray-200 bg-white py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
              For Tutors & Counselors
            </h2>
            <p className="mt-4 text-xl leading-8 text-gray-600">
              Increase your earnings, work with flexibility, and build professional credibility
            </p>
          </div>
          <div className="mx-auto mt-20 max-w-2xl sm:mt-24 lg:mt-28 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-12 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-8 shadow-sm">
                <div className="absolute top-6 left-6">
                  <svg className="h-6 w-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <dt className="mt-8 text-lg font-semibold leading-7 text-black">
                  Earn Money
                </dt>
                <dd className="mt-3 text-base leading-7 text-gray-600">
                  Earn a high income by helping students succeed. Get reliable payments directly through the platform.
                </dd>
              </div>
              <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-8 shadow-sm">
                <div className="absolute top-6 left-6">
                  <svg className="h-6 w-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <dt className="mt-8 text-lg font-semibold leading-7 text-black">
                  Flexible Hours
                </dt>
                <dd className="mt-3 text-base leading-7 text-gray-600">
                  Work when and where you want, with full control over your availability and bookings.
                </dd>
              </div>
              <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-8 shadow-sm">
                <div className="absolute top-6 left-6">
                  <svg className="h-6 w-6 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <dt className="mt-8 text-lg font-semibold leading-7 text-black">
                  Grow your practice
                </dt>
                <dd className="mt-3 text-base leading-7 text-gray-600">
                  Grow your client base and establish credibility through verified profiles and reviews.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Academic Tutoring Section */}
      <div id="academic-tutoring" className="border-t border-gray-200 bg-white py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
              Academic Tutoring
            </h2>
            <p className="mt-4 text-xl leading-8 text-gray-600">
              Personalized one on one tutoring with expert instructors across all subjects and academic levels
            </p>
          </div>
          <div className="mx-auto mt-20 max-w-2xl sm:mt-24 lg:mt-28 lg:max-w-none">
            <div className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 lg:max-w-none lg:grid-cols-2 xl:grid-cols-3">
              {/* Mathematics Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <svg className="h-16 w-16 flex-shrink-0" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Calculator body */}
                    <rect x="4" y="8" width="56" height="48" rx="2" stroke="#0088CB" strokeWidth="2" fill="none"/>
                    {/* Screen area */}
                    <rect x="8" y="12" width="48" height="12" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                    {/* Button grid - top row */}
                    <rect x="10" y="28" width="10" height="8" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                    <rect x="22" y="28" width="10" height="8" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                    <rect x="34" y="28" width="10" height="8" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                    <rect x="46" y="28" width="10" height="8" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                    {/* Button grid - second row */}
                    <rect x="10" y="38" width="10" height="8" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                    <rect x="22" y="38" width="10" height="8" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                    <rect x="34" y="38" width="10" height="8" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                    <rect x="46" y="38" width="10" height="8" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                    {/* Button grid - third row */}
                    <rect x="10" y="48" width="10" height="8" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                    <rect x="22" y="48" width="10" height="8" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                    <rect x="34" y="48" width="10" height="8" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                    <rect x="46" y="48" width="10" height="8" rx="1" stroke="#0088CB" strokeWidth="1.5" fill="none"/>
                  </svg>
                  <div>
                    <h3 className="text-2xl font-semibold leading-7 text-black">
                      Mathematics
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      K 12 and College
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  From basic arithmetic to advanced calculus, we cover all mathematical concepts
                </p>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Core Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Algebra</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Geometry</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Calculus</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Statistics</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Trigonometry</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Pre-Calculus</span>
                    <span className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600">And More</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Most Popular</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">AP Calculus</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">SAT Math</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Algebra II</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Statistics</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">Available Now</span>
                </div>
              </div>

              {/* Science Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <svg className="h-16 w-16 flex-shrink-0 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.57.393A9.065 9.065 0 0021.75 12c0-2.486-.815-4.78-2.18-6.622a4.5 4.5 0 00-1.57.393m-14.8.8a4.5 4.5 0 00-1.57.393M5 14.5l-1.57.393A9.065 9.065 0 002.25 12c0-2.486.815-4.78 2.18-6.622a4.5 4.5 0 011.57.393M5 14.5v5.714a2.25 2.25 0 01-.659 1.591L5 20.5m14.8-5.2v5.714a2.25 2.25 0 01-.659 1.591L19.8 20.5" />
                  </svg>
                  <div>
                    <h3 className="text-2xl font-semibold leading-7 text-black">
                      Science
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      K 12 and College
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Biology chemistry physics and earth sciences taught with clarity and depth
                </p>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Core Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Biology</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Chemistry</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Physics</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Earth Science</span>
                    <span className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600">And More</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Most Popular</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">AP Biology</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">AP Chemistry</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">AP Physics</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">Available Now</span>
                </div>
              </div>

              {/* English & Language Arts Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <svg className="h-16 w-16 flex-shrink-0 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                  <div>
                    <h3 className="text-2xl font-semibold leading-7 text-black">
                      English & Language Arts
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      K 12 and College
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Improve reading writing grammar and communication skills
                </p>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Core Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Reading</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Writing</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Grammar</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Literature</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Essay Writing</span>
                    <span className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600">And More</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Most Popular</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">AP English</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">SAT Reading</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Essay Writing</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">Available Now</span>
                </div>
              </div>

              {/* History & Social Studies Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <svg className="h-16 w-16 flex-shrink-0 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  <div>
                    <h3 className="text-2xl font-semibold leading-7 text-black">
                      History & Social Studies
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      K 12 and College
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  World history US history government and social sciences made engaging
                </p>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Core Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">World History</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">US History</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Government</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Economics</span>
                    <span className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600">And More</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Most Popular</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">AP US History</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">AP World History</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Government</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">Available Now</span>
                </div>
              </div>

              {/* Foreign Languages Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center gap-1">
                    <span className="text-4xl font-bold text-[#0088CB]">あ</span>
                    <span className="text-4xl font-bold text-[#0088CB]">A</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold leading-7 text-black">
                      Foreign Languages
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      All Levels
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Learn new languages or improve fluency with native level tutors
                </p>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Core Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Spanish</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">French</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Mandarin</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">German</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Italian</span>
                    <span className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600">And More</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Most Popular</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Spanish</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">French</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">AP Spanish</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">Available Now</span>
                </div>
              </div>

              {/* Computer Science Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <svg className="h-16 w-16 flex-shrink-0 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                  <div>
                    <h3 className="text-2xl font-semibold leading-7 text-black">
                      Computer Science
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      K 12 and College
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Programming fundamentals data structures and real world computer science skills
                </p>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Core Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Programming</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Data Structures</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Algorithms</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Web Development</span>
                    <span className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600">And More</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Most Popular</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">AP Computer Science</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Python</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Java</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">Available Now</span>
                </div>
              </div>

              {/* Test Preparation Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <svg className="h-16 w-16 flex-shrink-0 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  <div>
                    <h3 className="text-2xl font-semibold leading-7 text-black">
                      Test Preparation
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      All Levels
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Targeted preparation for standardized exams and academic assessments
                </p>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Core Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">SAT</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">ACT</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">AP Exams</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">GRE</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">GMAT</span>
                    <span className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600">And More</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Most Popular</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">SAT Prep</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">ACT Prep</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">AP Exam Prep</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">Available Now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Counseling Services Section */}
      <div className="border-t border-gray-200 bg-white py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
              Counseling Services
            </h2>
            <p className="mt-4 text-xl leading-8 text-gray-600">
              Professional guidance for academic planning and college preparation. Connect with real college students already attending your dream schools
            </p>
          </div>
          <div className="mx-auto mt-20 max-w-2xl sm:mt-24 lg:mt-28 lg:max-w-none">
            <div className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 lg:max-w-none lg:grid-cols-2 xl:grid-cols-3">
              {/* Counseling Sessions Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <svg className="h-16 w-16 flex-shrink-0 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443a55.381 55.381 0 0 1 5.25 2.882V15" />
                  </svg>
                  <div>
                    <h3 className="text-2xl font-semibold leading-7 text-black">
                      Counseling Sessions
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      College Focused
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Get one-on-one guidance on applications, essays, admissions strategies, and academic planning from experienced college students.
                </p>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Core Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Applications</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Essays</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Admissions Strategy</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Academic Planning</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Scholarships</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">College Fit</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Most Popular</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">College Applications</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Essay Review</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Admissions Strategy</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">Available Now</span>
                </div>
              </div>

              {/* Virtual College Tours Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <svg className="h-16 w-16 flex-shrink-0 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <div>
                    <h3 className="text-2xl font-semibold leading-7 text-black">
                      Virtual College Tours
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      College Focused
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Explore campuses virtually with current students who share real insights about academics, housing, and student life.
                </p>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Core Topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Campus Life</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Housing</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Academics</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Student Experience</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Extracurriculars</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Most Popular</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Ivy League Tours</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Campus Walkthroughs</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Student Life Q&A</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">Available Now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* IvyWay AI Learning Assistant Section */}
      <div id="ivyway-ai" className="border-t border-gray-200 bg-white py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
              IvyWay AI Learning Assistant
            </h2>
            <p className="mt-4 text-xl leading-8 text-gray-600">
              Powerful AI tools to help you study smarter. Free to use with optional upgrades for unlimited access and advanced features.
            </p>
          </div>
          <div className="mx-auto mt-20 max-w-2xl sm:mt-24 lg:mt-28 lg:max-w-none">
            <div className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 lg:max-w-none lg:grid-cols-2 xl:grid-cols-3">
              {/* AI Problem Solving Camera Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <svg className="h-16 w-16 flex-shrink-0 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                  <div>
                    <h3 className="text-2xl font-semibold leading-7 text-black">
                      AI Problem Solving Camera
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      Free with limits
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Take a picture of a problem and get step by step explanations instantly across math, science, and more.
                </p>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Features</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Step by Step Solutions</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Multiple Subjects</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Instant Feedback</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Upgrade Unlocks</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Unlimited Scans</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Detailed Explanations</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">Available Now</span>
                </div>
              </div>

              {/* AI Flashcards Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <svg className="h-16 w-16 flex-shrink-0 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="4" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="5" y="6" width="14" height="10" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="7" y="8" width="10" height="6" rx="0.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <h3 className="text-2xl font-semibold leading-7 text-black">
                      AI Flashcards
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      Free daily use
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Generate flashcards instantly from any subject to reinforce concepts and improve memory retention.
                </p>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Features</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Auto Generated Cards</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Any Subject</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Quick Review</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Upgrade Unlocks</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Unlimited Decks</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Advanced Topics</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">Available Now</span>
                </div>
              </div>

              {/* AI Quiz Maker Card */}
              <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <svg className="h-16 w-16 flex-shrink-0 text-[#0088CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <div>
                    <h3 className="text-2xl font-semibold leading-7 text-black">
                      AI Quiz Maker
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      Free daily use
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Create instant quizzes to test your knowledge and identify gaps in understanding.
                </p>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Features</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Custom Quizzes</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Instant Scoring</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">Any Subject</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold leading-6 text-black">Upgrade Unlocks</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Unlimited Quizzes</span>
                    <span className="inline-flex items-center rounded-full bg-[#0088CB] px-3 py-1 text-xs font-medium text-white">Longer Tests</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">Available Now</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Call to Action */}
          <div className="mx-auto mt-16 max-w-3xl text-center">
            <h3 className="text-2xl font-semibold leading-7 text-black">
              Start learning with IvyWay AI today
            </h3>
            <p className="mt-3 text-base leading-7 text-gray-600">
              Free to use. Upgrade anytime for unlimited access.
            </p>
            <div className="mt-8">
              <Link
                href="/auth/signup"
                className="inline-flex rounded-md bg-[#0088CB] px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]"
              >
                Sign up to use IvyWay AI
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Signup Preview Section */}
      <SignupPreview />

      {/* Testimonials Section */}
      <div className="border-t border-gray-200 bg-white py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
              What our community says
            </h2>
            <p className="mt-4 text-xl leading-8 text-gray-600">
              Join thousands of students and educators who trust IvyWay
            </p>
          </div>
          <div className="mx-auto mt-20 grid max-w-2xl grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-1 text-[#0088CB]">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-5 w-5 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="mt-4 text-base leading-7 text-black">
                "I was struggling with AP Calculus until I found an amazing tutor on IvyWay. The one-on-one sessions made all the difference, and I went from barely passing to acing my exams. The platform made it so easy to find someone who actually understood how I learn."
              </p>
              <p className="mt-6 text-sm font-semibold text-black">Sarah Caruso</p>
            </div>
            <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-1 text-[#0088CB]">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-5 w-5 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="mt-4 text-base leading-7 text-black">
                "IvyWay has been a game-changer for my career. I'm able to earn a strong income by counseling students on my own schedule, and the platform handles all the logistics. It's made it incredibly easy to monetize my expertise while maintaining the flexibility I need."
              </p>
              <p className="mt-6 text-sm font-semibold text-black">Michael Chen</p>
            </div>
            <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-1 text-[#0088CB]">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-5 w-5 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="mt-4 text-base leading-7 text-black">
                "My daughter had her heart set on Yale, and IvyWay connected her with a current Yale student who also works as a counselor on the platform. She helped with everything from application strategy to understanding campus life. The guidance was invaluable, and my daughter felt much more prepared throughout the process."
              </p>
              <p className="mt-6 text-sm font-semibold text-black">Greg Peterson</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <PricingSection />

      {/* FAQ Section */}
      <div id="faq" className="border-t border-gray-200 bg-gray-50 py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
              Frequently asked questions
            </h2>
          </div>
          <div className="mx-auto mt-20 max-w-3xl">
            <FAQAccordion
              items={[
                {
                  question: 'How do I create an account?',
                  answer: 'Click "Sign up free" and provide your email. You\'ll choose your role during setup.',
                },
                {
                  question: 'Is IvyWay free to use?',
                  answer: 'Account creation is free. Students pay for sessions; tutors and counselors set their own rates.',
                },
                {
                  question: 'How does payment work?',
                  answer: 'Payments are processed securely. Students can pay per session or purchase packages; tutors receive payments directly.',
                },
                {
                  question: 'Can I be both a tutor and counselor?',
                  answer: 'Yes. Set up your profile to offer both services.',
                },
                {
                  question: 'Is my data secure?',
                  answer: 'Yes. We use industry-standard encryption to protect all user data and payment information.',
                },
                {
                  question: 'Can I cancel or reschedule?',
                  answer: 'Yes. Cancel or reschedule sessions up to 24 hours in advance through your dashboard.',
                },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div id="contact" className="border-t border-gray-200 bg-white py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
              Get in touch
            </h2>
            <p className="mt-4 text-xl leading-8 text-gray-600">
              Have questions? We're here to help.
            </p>
          </div>
        </div>
      </div>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#0088CB] text-white shadow-lg transition-all hover:bg-[#0077B3] hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#0088CB] focus:ring-offset-2"
          aria-label="Scroll to top"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

