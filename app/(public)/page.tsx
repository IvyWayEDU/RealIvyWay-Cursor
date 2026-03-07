'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import SignupPreview from '@/components/SignupPreview';
import SchoolCarousel from '@/components/SchoolCarousel';
import { getDashboardRoute } from '@/lib/auth/utils';
import { Session } from '@/lib/auth/types';

export default function Home() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle smooth scrolling when navigating to page with hash
  useEffect(() => {
    if (window.location.hash === '#create-account') {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById('create-account');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, []);

  // Check for session cookie on client side
  useEffect(() => {
    const checkSession = () => {
      try {
        const cookies = document.cookie.split(';');
        const sessionCookie = cookies.find(cookie => 
          cookie.trim().startsWith('ivyway_session=')
        );
        
        if (sessionCookie) {
          const sessionValue = sessionCookie.split('=')[1];
          try {
            const decodedValue = decodeURIComponent(sessionValue);
            const parsedSession = JSON.parse(decodedValue);
            setSession(parsedSession);
          } catch {
            const parsedSession = JSON.parse(sessionValue);
            setSession(parsedSession);
          }
        }
      } catch (error) {
        setSession(null);
      }
    };

    checkSession();
  }, []);

  // Handle click outside menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const scrollToSection = (sectionId: string) => {
    setShowMenu(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getDashboardLink = () => {
    if (!session) return null;
    return getDashboardRoute(session.roles);
  };

  const dashboardLink = getDashboardLink();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative w-full min-h-[110vh] flex items-center">
        {/* Hero Image */}
        <div className="absolute inset-0">
          <Image
            src="/images/ivyway-hero.png"
            alt="IvyWay students"
            fill
            priority
            className="object-cover"
          />
        </div>

        {/* Cinematic gradient overlay for depth (kept behind hero copy + logo glass panel) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70 z-[1]" />

        {/* Hero Header - Absolute positioning, positioned relative to hero container */}
        <nav className="absolute top-0 left-0 right-0 z-40 bg-transparent">
          <div className="flex h-20 items-center justify-between w-full">
            {/* Logo */}
            <div className="flex items-center pl-4 sm:pl-6 lg:pl-8">
              <Link href={session ? getDashboardRoute(session.roles) : "/"} className="flex items-center">
                <Image
                  src="/ivyway-landing-logo.png"
                  alt="IvyWay"
                  width={160}
                  height={58}
                  className="h-16 md:h-20 w-auto"
                  priority
                />
              </Link>
            </div>
            
            {/* Menu Button and Auth Buttons */}
            <div className="relative flex items-center gap-3 pr-4 sm:pr-6 lg:pr-8" ref={menuRef}>
              {/* Log in and Sign up buttons - only show when not logged in */}
              {!session && (
                <div className="hidden sm:flex items-center gap-3">
                  <Link
                    href="/auth/login"
                    className="rounded-md px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50 transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/register"
                    className="rounded-md px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50 transition-colors"
                  >
                    Sign up
                  </Link>
                </div>
              )}
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/50 transition-colors"
                aria-expanded={showMenu}
                aria-label="Toggle menu"
              >
                {!showMenu ? (
                  <svg
                    className="block h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : (
                  <svg
                    className="block h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
              
              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 z-50">
                  <div className="py-2 space-y-1">
                    <Link
                      href="/"
                      onClick={() => setShowMenu(false)}
                      className="block mx-2 px-3 py-2 text-sm font-medium text-white rounded-[10px] hover:text-[#0f8bff] hover:bg-white/10 transition-colors"
                    >
                      Home
                    </Link>
                    <button
                      onClick={() => scrollToSection('features')}
                      className="block w-full text-left mx-2 px-3 py-2 text-sm font-medium text-white rounded-[10px] hover:text-[#0f8bff] hover:bg-white/10 transition-colors"
                    >
                      Features
                    </button>
                    <button
                      onClick={() => scrollToSection('how-it-works')}
                      className="block w-full text-left mx-2 px-3 py-2 text-sm font-medium text-white rounded-[10px] hover:text-[#0f8bff] hover:bg-white/10 transition-colors"
                    >
                      How It Works
                    </button>
                    <button
                      onClick={() => scrollToSection('testimonials')}
                      className="block w-full text-left mx-2 px-3 py-2 text-sm font-medium text-white rounded-[10px] hover:text-[#0f8bff] hover:bg-white/10 transition-colors"
                    >
                      Testimonials
                    </button>
                    <Link
                      href="/pricing"
                      onClick={() => setShowMenu(false)}
                      className="block mx-2 px-3 py-2 text-sm font-medium text-white rounded-[10px] hover:text-[#0f8bff] hover:bg-white/10 transition-colors"
                    >
                      Pricing
                    </Link>
                    {!session && (
                      <>
                        <div className="border-t border-white/20 my-1"></div>
                        <Link
                          href="/auth/login"
                          onClick={() => setShowMenu(false)}
                          className="block mx-2 px-3 py-2 text-sm font-medium text-white rounded-[10px] hover:text-[#0f8bff] hover:bg-white/10 transition-colors"
                        >
                          Log in
                        </Link>
                        <Link
                          href="/auth/register"
                          onClick={() => setShowMenu(false)}
                          className="block mx-2 px-3 py-2 text-sm font-medium text-white rounded-[10px] hover:text-[#0f8bff] hover:bg-white/10 transition-colors"
                        >
                          Sign up
                        </Link>
                      </>
                    )}
                    {session && dashboardLink && (
                      <>
                        <div className="border-t border-white/20 my-1"></div>
                        <Link
                          href={dashboardLink}
                          onClick={() => setShowMenu(false)}
                          className="block mx-2 px-3 py-2 text-sm font-medium text-white rounded-[10px] hover:text-[#0f8bff] hover:bg-white/10 transition-colors"
                        >
                          Dashboard
                        </Link>
                        <div className="px-5 py-2 text-xs text-white/70">{session.name}</div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>
        
        {/* Content Overlay */}
        <div className="relative w-full flex items-center z-20 pb-36">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl leading-tight">
                Build your future with <span style={{ color: '#5bbcff' }}>Ivy</span><span style={{ color: '#0b3c6f' }}>Way</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-white/95 sm:text-xl md:text-2xl max-w-2xl">
                Personalized tutoring, college counseling, and AI powered learning built for student success.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Link
                  href="/auth/register"
                  className="rounded-md bg-[#0088CB] px-8 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
                >
                  Get Started Free
                </Link>
                <button
                  onClick={() => {
                    const element = document.getElementById('how-it-works');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="rounded-md bg-white/10 backdrop-blur-sm px-6 py-3.5 text-base font-semibold text-white ring-1 ring-inset ring-white/30 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
                >
                  How It Works
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* School logos overlay (premium glass) */}
        <div className="hero-logos-overlay">
          <p className="hero-logos-title">Trusted by Top Schools, Students, and Educators</p>

          <div className="hero-logos-carousel">
            <SchoolCarousel />
          </div>
        </div>
      </section>

      {/* Fade into the next section */}
      <div className="h-16 bg-gradient-to-b from-black/70 to-white" />
      {/* Features Section */}
      <div id="features" className="bg-gray-50 py-32">
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
      {/* How It Works Section */}
      <div id="how-it-works" className="bg-white py-32">
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
                  Student, tutor, or counselor.
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

      {/* Testimonials Section */}
      <div id="testimonials" className="bg-gray-50 py-32">
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

      {/* CTA */}
      <SignupPreview />

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

