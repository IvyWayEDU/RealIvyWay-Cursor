'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import SchoolCarousel from '@/components/SchoolCarousel';
import FAQAccordion from '@/components/FAQAccordion';
import { getDashboardRoute } from '@/lib/auth/utils';
import { Session } from '@/lib/auth/types';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarCheck,
  GraduationCap,
  Map,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

function ScenicHeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base: rich IvyWay blue → white fade */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#052a48_0%,#063a63_9%,#074c7b_18%,#0b5f96_34%,#1f86c1_56%,#bfeaff_82%,#ffffff_100%)]" />

      {/* Top blend bridge (prevents “dark slab → sudden shift” impression) */}
      <div className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,rgba(5,42,72,0.30)_0%,rgba(5,42,72,0.14)_35%,rgba(11,95,150,0.00)_100%)]" />

      {/* Soft atmospheric glows */}
      <div className="absolute -top-56 left-1/2 h-[820px] w-[820px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -top-44 right-[-260px] h-[720px] w-[720px] rounded-full bg-[#0088CB]/18 blur-3xl" />
      <div className="absolute top-24 left-[-260px] h-[640px] w-[640px] rounded-full bg-[#5bbcff]/12 blur-3xl" />

      {/* Scenic abstract landscape (vector, not “AI art”) */}
      <svg
        className="absolute left-1/2 top-[22px] h-[720px] w-[1400px] -translate-x-1/2 opacity-[0.92] sm:top-[10px] sm:h-[800px]"
        viewBox="0 0 1400 760"
        fill="none"
      >
        <defs>
          <linearGradient id="ivywaySky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.30" />
            <stop offset="0.38" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ivywayRidge1" x1="120" y1="220" x2="1240" y2="640">
            <stop offset="0" stopColor="#EAF6FF" stopOpacity="0.45" />
            <stop offset="0.55" stopColor="#BFE8FF" stopOpacity="0.22" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="ivywayRidge2" x1="120" y1="260" x2="1240" y2="700">
            <stop offset="0" stopColor="#CDEEFF" stopOpacity="0.20" />
            <stop offset="0.65" stopColor="#7FD2FF" stopOpacity="0.12" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id="softBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Horizon haze */}
        <rect x="0" y="0" width="1400" height="460" fill="url(#ivywaySky)" />

        {/* Far ridges */}
        <path
          d="M0 430C120 380 220 345 335 360C430 372 520 420 640 402C760 384 870 310 1020 304C1170 298 1260 362 1400 410V760H0V430Z"
          fill="url(#ivywayRidge2)"
          filter="url(#softBlur)"
        />
        <path
          d="M0 470C160 410 260 404 360 420C470 438 560 506 690 486C820 466 940 365 1080 350C1210 336 1290 398 1400 452V760H0V470Z"
          fill="url(#ivywayRidge1)"
        />

        {/* Foreground silhouette hint */}
        <path
          d="M0 560C180 520 300 560 420 598C560 642 700 664 860 640C1030 614 1180 528 1400 540V760H0V560Z"
          fill="#061f33"
          opacity="0.10"
        />
      </svg>

      {/* Top edge gloss */}
      <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0))]" />

      {/* Bottom wash to avoid any hard “cut line” into white sections */}
      <div className="absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.70)_45%,#ffffff_100%)]" />
    </div>
  );
}

function ProductShowcase() {
  return (
    <div className="relative mx-auto mt-10 w-full max-w-5xl sm:mt-12">
      <div className="absolute inset-0 -z-10 rounded-[32px] bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(0,136,203,0.35),rgba(255,255,255,0))]" />
      <div className="relative overflow-hidden rounded-[32px] border border-white/12 bg-white/6 shadow-[0_28px_80px_rgba(3,12,26,0.32)] ring-1 ring-white/10 backdrop-blur-xl">
        {/* Window top bar */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-white/35" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold tracking-wide text-white/70">
            <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1">Dashboard</span>
            <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1">Booking</span>
            <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1">IvyWay AI</span>
          </div>
          <div className="text-xs font-semibold text-white/65">ivywayedu.com</div>
        </div>

        {/* “Real UI” layout mock */}
        <div className="grid grid-cols-1 gap-0 md:grid-cols-12">
          <div className="hidden md:block md:col-span-3 border-r border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-white/10 ring-1 ring-white/10" />
              <div className="min-w-0">
                <div className="h-2.5 w-28 rounded-full bg-white/18" />
                <div className="mt-2 h-2 w-20 rounded-full bg-white/10" />
              </div>
            </div>
            <div className="mt-6 space-y-2">
              {['Overview', 'Sessions', 'Booking', 'IvyWay AI', 'Progress'].map((label, i) => (
                <div
                  key={label}
                  className={[
                    'flex items-center justify-between rounded-2xl px-3 py-2.5',
                    i === 2
                      ? 'bg-white/10 ring-1 ring-white/10'
                      : 'bg-white/0 ring-1 ring-transparent',
                  ].join(' ')}
                >
                  <div className="h-2.5 w-24 rounded-full bg-white/18" />
                  <div className="h-2.5 w-2.5 rounded-full bg-white/12" />
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-9 rounded-2xl bg-[#0088CB]/25 ring-1 ring-[#5bbcff]/30" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white">Next session</div>
                  <div className="mt-1 h-2 w-24 rounded-full bg-white/16" />
                  <div className="mt-2 h-2 w-32 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-9 p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">Book tutoring</div>
                      <div className="mt-1 text-xs text-white/70">
                        Verified providers by subject, availability, and fit.
                      </div>
                    </div>
                    <div className="hidden sm:block rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/80 ring-1 ring-white/10">
                      This week
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { title: 'AP Calculus', meta: 'Mon • 6:00pm' },
                      { title: 'SAT Math', meta: 'Wed • 7:30pm' },
                      { title: 'Chemistry', meta: 'Thu • 5:15pm' },
                      { title: 'Essay review', meta: 'Fri • 4:00pm' },
                    ].map((c) => (
                      <div
                        key={c.title}
                        className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white">{c.title}</div>
                            <div className="mt-1 text-xs text-white/70">{c.meta}</div>
                          </div>
                          <div className="h-9 w-9 rounded-2xl bg-white/8 ring-1 ring-white/10" />
                        </div>
                        <div className="mt-3 h-2 w-3/4 rounded-full bg-white/12" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">IvyWay AI</div>
                    <div className="rounded-full bg-[#0088CB]/18 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-[#5bbcff]/25">
                      Live
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-white/70">
                    Flashcards, quizzes, planning, and problem-solving—between sessions.
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-3xl border border-white/10 bg-white/6 p-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-2xl bg-white/10 ring-1 ring-white/10" />
                        <div className="h-2.5 w-32 rounded-full bg-white/16" />
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-white/10" />
                      <div className="mt-2 h-2 w-5/6 rounded-full bg-white/10" />
                      <div className="mt-2 h-2 w-2/3 rounded-full bg-white/10" />
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(0,136,203,0.20),rgba(255,255,255,0.04))] p-4">
                      <div className="flex items-center justify-between">
                        <div className="h-2.5 w-28 rounded-full bg-white/20" />
                        <div className="h-8 w-16 rounded-full bg-white/10 ring-1 ring-white/10" />
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="h-16 rounded-2xl bg-white/8 ring-1 ring-white/10" />
                        <div className="h-16 rounded-2xl bg-white/6 ring-1 ring-white/10" />
                        <div className="h-16 rounded-2xl bg-white/7 ring-1 ring-white/10" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">Sessions preview</div>
                <div className="mt-1 text-xs text-white/70">
                  Notes, next steps, and progress in one clean timeline.
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <div className="h-9 w-28 rounded-2xl bg-white/8 ring-1 ring-white/10" />
                <div className="h-9 w-10 rounded-2xl bg-white/8 ring-1 ring-white/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showFloatingCta, setShowFloatingCta] = useState(false);
  const [floatingCtaVariant, setFloatingCtaVariant] = useState<'light' | 'brand'>('light');
  const menuRef = useRef<HTMLDivElement>(null);
  const whiteSectionsStartRef = useRef<HTMLDivElement>(null);
  const bottomBlueStartRef = useRef<HTMLElement>(null);
  const sectionTopsRef = useRef<{ whiteStart: number }>({
    whiteStart: 0,
  });

  useEffect(() => {
    const computeSectionTops = () => {
      sectionTopsRef.current.whiteStart = whiteSectionsStartRef.current
        ? whiteSectionsStartRef.current.getBoundingClientRect().top + window.scrollY
        : 0;
    };

    const handleScroll = () => {
      const y = window.scrollY;
      setShowScrollTop(y > 300);
      setShowFloatingCta(y > 140);

      // Use a small forward-looking probe so the CTA feels like it transitions
      // as you enter each background region (premium, not abrupt).
      const probeY = y + 140;
      const { whiteStart } = sectionTopsRef.current;
      // Once the CTA becomes brand-blue (past the hero), keep it blue through the footer.
      const nextVariant: 'light' | 'brand' = probeY >= whiteStart ? 'brand' : 'light';

      setFloatingCtaVariant((prev) => (prev === nextVariant ? prev : nextVariant));
    };

    computeSectionTops();
    handleScroll();
    // Ensure we recalc after initial layout settles (fonts/images).
    const t = window.setTimeout(computeSectionTops, 700);

    window.addEventListener('resize', computeSectionTops);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', computeSectionTops);
      window.removeEventListener('scroll', handleScroll);
    };
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
      } catch {
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
  const primaryCtaHref = dashboardLink ?? '/auth/register';
  const primaryCtaLabel = dashboardLink ? 'Go to Dashboard' : 'Get Started';

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const heroNavItemClass =
    'inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white/90 ' +
    'transition-all duration-200 ease-out ' +
    'hover:bg-white/10 hover:ring-1 hover:ring-white/25 hover:backdrop-blur-xl hover:text-white ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40';

  return (
    <div className="text-gray-950">
      {/* Floating CTA (only sticky element on scroll) */}
      <div
        className={[
          'fixed right-4 z-[60] transition-all duration-300 ease-out',
          'top-[calc(env(safe-area-inset-top)+16px)] sm:right-6 sm:top-[calc(env(safe-area-inset-top)+20px)]',
          showFloatingCta ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-2',
        ].join(' ')}
      >
        <Link
          href={primaryCtaHref}
          className={[
            'inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold',
            'transition-colors duration-500 ease-out transition-shadow',
            floatingCtaVariant === 'brand'
              ? 'bg-[#0088CB] text-white shadow-[0_18px_60px_rgba(0,136,203,0.35)] hover:bg-[#0077B3]'
              : 'bg-white text-[#06233A] shadow-[0_18px_60px_rgba(3,12,26,0.22)] hover:bg-white/95',
          ].join(' ')}
        >
          {primaryCtaLabel}
        </Link>
      </div>

      {/* SECTION 2 — HERO (scenic abstract background) */}
      <section className="relative pt-[calc(env(safe-area-inset-top)+20px)] sm:pt-[calc(env(safe-area-inset-top)+24px)]">
        <ScenicHeroBackdrop />

        {/* Corner softeners (prevents any “boxed/clipped” edge feel under the header) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-[radial-gradient(520px_240px_at_0%_0%,rgba(0,136,203,0.26),rgba(0,136,203,0)_72%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-[radial-gradient(520px_240px_at_100%_0%,rgba(0,136,203,0.26),rgba(0,136,203,0)_72%)]"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* NAVBAR — rebuilt cleanly inside hero canvas */}
          <div className="absolute inset-x-0 top-0 z-40 pt-3 sm:pt-4">
            <div className="flex h-16 items-center justify-between sm:h-[72px]">
              <Link href={dashboardLink ?? '/'} className="flex items-center pl-4 sm:pl-6">
                <Image
                  src="/ivyway-landing-logo-2.png"
                  alt="IvyWay"
                  width={1536}
                  height={1024}
                  sizes="(min-width: 1024px) 320px, (min-width: 768px) 280px, 220px"
                  className="h-[60px] w-auto sm:h-[68px] md:h-[76px] drop-shadow-[0_12px_34px_rgba(3,12,26,0.35)]"
                  priority
                />
              </Link>

              <div className="hidden md:flex flex-1 justify-center">
                <nav className="flex items-center gap-2 lg:gap-3">
                  <button onClick={() => scrollToSection('tutoring')} className={heroNavItemClass}>
                    Tutoring
                  </button>
                  <button onClick={() => scrollToSection('college-counseling')} className={heroNavItemClass}>
                    College Counseling
                  </button>
                  <button onClick={() => scrollToSection('virtual-tours')} className={heroNavItemClass}>
                    Virtual Tours
                  </button>
                  <button onClick={() => scrollToSection('ivyway-ai')} className={heroNavItemClass}>
                    IvyWay AI
                  </button>
                  <Link href="/pricing" className={heroNavItemClass}>
                    Pricing
                  </Link>
                  <button onClick={() => scrollToSection('faq')} className={heroNavItemClass}>
                    FAQ
                  </button>
                </nav>
              </div>

              <div className="relative flex items-center gap-3 pr-1 sm:pr-2" ref={menuRef}>
                <Link
                  href={primaryCtaHref}
                  className="hidden sm:inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#06233A] shadow-[0_18px_50px_rgba(3,12,26,0.22)] hover:bg-white/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
                >
                  {primaryCtaLabel}
                </Link>

                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="inline-flex items-center justify-center rounded-xl p-2 text-white/90 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/40 transition-colors md:hidden"
                  aria-expanded={showMenu}
                  aria-label="Toggle menu"
                >
                  {!showMenu ? (
                    <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  ) : (
                    <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>

                {showMenu && (
                  <div className="absolute top-full right-0 mt-2 w-80 rounded-2xl border border-white/12 bg-[#071d31]/85 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl z-50 md:hidden">
                    <div className="p-2 space-y-1">
                      {[
                        { id: 'tutoring', label: 'Tutoring' },
                        { id: 'college-counseling', label: 'College Counseling' },
                        { id: 'virtual-tours', label: 'Virtual Tours' },
                        { id: 'ivyway-ai', label: 'IvyWay AI' },
                        { id: 'faq', label: 'FAQ' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => scrollToSection(item.id)}
                          className="block w-full text-left rounded-xl px-3 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10 hover:ring-1 hover:ring-white/22 hover:backdrop-blur-xl transition-all"
                        >
                          {item.label}
                        </button>
                      ))}
                      <Link
                        href="/pricing"
                        onClick={() => setShowMenu(false)}
                        className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10 hover:ring-1 hover:ring-white/22 hover:backdrop-blur-xl transition-all"
                      >
                        Pricing
                      </Link>

                      <div className="my-2 border-t border-white/10" />

                      <Link
                        href={primaryCtaHref}
                        onClick={() => setShowMenu(false)}
                        className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-[#06233A] shadow-sm hover:bg-white/95 transition-colors"
                      >
                        {primaryCtaLabel} <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-4xl text-center pt-[124px] sm:pt-[144px]">
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl leading-[1.02]">
              #1 Platform for Tutoring, College Counseling &amp; AI Study Tools
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-white/80 sm:text-xl">
              Real tutors. Real guidance. Real college students.
              <br className="hidden sm:block" />
              Powered by IvyWay AI
            </p>

            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href={primaryCtaHref}
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-base font-semibold text-[#06233A] shadow-sm hover:bg-white/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
              >
                {primaryCtaLabel}
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-xl bg-white/0 px-6 py-3 text-base font-semibold text-white ring-1 ring-inset ring-white/22 hover:bg-white/10 transition-colors"
              >
                Explore Pricing
              </Link>
            </div>

            <ProductShowcase />
          </div>
        </div>

        {/* Fade into white below hero */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.80)_45%,#ffffff_100%)]" />
      </section>

      {/* SECTION 5 placeholder anchor: nav items map to “How it works” cards */}
      <div id="tutoring" ref={whiteSectionsStartRef} className="scroll-mt-28" />

      {/* SECTION 3 — HOW IVYWAY WORKS (Cluely-style premium cards) */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold text-[#0088CB]">How IvyWay works</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
              IvyWay helps students succeed
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="group relative overflow-hidden rounded-[32px] border border-gray-200/70 bg-white p-9 sm:p-10 shadow-[0_28px_80px_rgba(2,10,23,0.06)] ring-1 ring-black/5">
              <div className="absolute inset-0 bg-[radial-gradient(900px_480px_at_20%_0%,rgba(0,136,203,0.10),rgba(255,255,255,0))] opacity-90" />
              <div className="relative">
                <div className="flex items-start gap-4">
                  <span className="mt-1.5 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-[#0088CB] shadow-[0_8px_24px_rgba(0,136,203,0.25)]" />
                  <div>
                    <div className="text-base font-semibold tracking-tight text-gray-950">
                      IvyWay connects students with experienced tutors
                    </div>
                    <p className="mt-3 text-base leading-7 text-gray-600">
                      Whether you’re preparing for an exam, mastering a difficult subject, or learning new languages, IvyWay connects you with experienced tutors who can help you succeed.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div
              id="college-counseling"
              className="scroll-mt-28 group relative overflow-hidden rounded-[32px] border border-gray-200/70 bg-white p-9 sm:p-10 shadow-[0_28px_80px_rgba(2,10,23,0.06)] ring-1 ring-black/5"
            >
              <div className="absolute inset-0 bg-[radial-gradient(900px_480px_at_85%_0%,rgba(0,136,203,0.08),rgba(255,255,255,0))] opacity-90" />
              <div className="relative">
                <div className="flex items-start gap-4">
                  <span className="mt-1.5 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-[#0088CB] shadow-[0_8px_24px_rgba(0,136,203,0.25)]" />
                  <div>
                    <div className="text-base font-semibold tracking-tight text-gray-950">
                      College counseling from real college students
                    </div>
                    <p className="mt-3 text-base leading-7 text-gray-600">
                      Get real admissions insight from alumni and students attending your target schools.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div
              id="virtual-tours"
              className="scroll-mt-28 group relative overflow-hidden rounded-[32px] border border-gray-200/70 bg-white p-9 sm:p-10 shadow-[0_28px_80px_rgba(2,10,23,0.06)] ring-1 ring-black/5"
            >
              <div className="absolute inset-0 bg-[radial-gradient(900px_480px_at_18%_0%,rgba(0,136,203,0.08),rgba(255,255,255,0))] opacity-90" />
              <div className="relative">
                <div className="flex items-start gap-4">
                  <span className="mt-1.5 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-[#0088CB] shadow-[0_8px_24px_rgba(0,136,203,0.25)]" />
                  <div>
                    <div className="text-base font-semibold tracking-tight text-gray-950">Virtual campus tours</div>
                    <p className="mt-3 text-base leading-7 text-gray-600">
                      Save yourself a trip and virtually explore campuses with real students before you visit.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-[32px] border border-gray-200/70 bg-white p-9 sm:p-10 shadow-[0_28px_80px_rgba(2,10,23,0.06)] ring-1 ring-black/5">
              <div className="absolute inset-0 bg-[radial-gradient(900px_480px_at_85%_10%,rgba(0,136,203,0.10),rgba(255,255,255,0))] opacity-90" />
              <div className="relative">
                <div className="flex items-start gap-4">
                  <span className="mt-1.5 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-[#0088CB] shadow-[0_8px_24px_rgba(0,136,203,0.25)]" />
                  <div>
                    <div className="text-base font-semibold tracking-tight text-gray-950">IvyWay AI</div>
                    <p className="mt-3 text-base leading-7 text-gray-600">
                      Solve questions instantly, compete against friends, generate practice quizzes, and much more. Unlock smarter studying with IvyWay AI.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — IVYWAY AI (premium minimal showcase) */}
      <section id="ivyway-ai" className="scroll-mt-28 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold text-[#0088CB]">IvyWay AI</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
              Instant academic help with IvyWay AI
            </h2>
            <p className="mt-5 text-lg leading-8 text-gray-600">
              Your AI tutor for studying, planning, problem solving, flashcards, quizzes, and smarter learning.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-5xl">
            <div className="relative overflow-hidden rounded-[32px] border border-gray-200 bg-[linear-gradient(180deg,#ffffff,#fbfdff)] shadow-[0_30px_90px_rgba(2,10,23,0.08)]">
              <div className="absolute inset-0 bg-[radial-gradient(900px_460px_at_50%_0%,rgba(0,136,203,0.16),rgba(255,255,255,0))]" />
              <div className="relative p-6 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-950">AI Tutor workspace</div>
                    <div className="mt-1 text-sm text-gray-600">
                      Turn a topic into a plan, then practice until it sticks.
                    </div>
                  </div>
                  <Link
                    href={primaryCtaHref}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0088CB] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0077B3] transition-colors"
                  >
                    Try IvyWay AI <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-7 rounded-3xl border border-gray-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-gray-900">Problem solving</div>
                      <div className="rounded-full bg-[#0088CB]/10 px-3 py-1 text-xs font-semibold text-[#0088CB] ring-1 ring-[#0088CB]/15">
                        Step-by-step
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="h-2 w-5/6 rounded-full bg-gray-100" />
                      <div className="h-2 w-full rounded-full bg-gray-100" />
                      <div className="h-2 w-2/3 rounded-full bg-gray-100" />
                      <div className="mt-4 h-2 w-4/6 rounded-full bg-[#0088CB]/12" />
                      <div className="h-2 w-full rounded-full bg-[#0088CB]/10" />
                      <div className="h-2 w-3/4 rounded-full bg-[#0088CB]/10" />
                    </div>
                  </div>

                  <div className="lg:col-span-5 grid grid-cols-1 gap-4">
                    <div className="rounded-3xl border border-gray-200 bg-white p-5">
                      <div className="text-xs font-semibold text-gray-900">Flashcards</div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="h-20 rounded-2xl bg-gray-50 ring-1 ring-gray-200" />
                        <div className="h-20 rounded-2xl bg-gray-50 ring-1 ring-gray-200" />
                      </div>
                      <div className="mt-3 h-2 w-3/5 rounded-full bg-gray-100" />
                    </div>

                    <div className="rounded-3xl border border-gray-200 bg-white p-5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-gray-900">Quiz mode</div>
                        <div className="h-8 w-20 rounded-full bg-gray-50 ring-1 ring-gray-200" />
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="h-2 w-11/12 rounded-full bg-gray-100" />
                        <div className="h-2 w-10/12 rounded-full bg-gray-100" />
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="h-10 rounded-2xl bg-gray-50 ring-1 ring-gray-200" />
                          <div className="h-10 rounded-2xl bg-gray-50 ring-1 ring-gray-200" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — TRUST / SOCIAL PROOF (keep logos; upgrade feature grid) */}
      <section className="border-y border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold text-[#0088CB]">Trust-first by design</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
              Serious support, with less noise.
            </h2>
            <p className="mt-5 text-lg leading-8 text-gray-600">
              IvyWay combines expert human guidance and AI learning tools—so families and schools can understand progress at a glance.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {[
              {
                title: 'Clear matching',
                desc: 'Tutors and counselors aligned to goals, level, and learning style.',
                icon: GraduationCap,
              },
              {
                title: 'End-to-end sessions',
                desc: 'Scheduling, notes, and follow-ups in one place.',
                icon: CalendarCheck,
              },
              {
                title: 'Progress visibility',
                desc: 'Families and schools stay aligned without micromanaging.',
                icon: ShieldCheck,
              },
              {
                title: 'IvyWay AI',
                desc: 'Practice, feedback, and next steps between sessions.',
                icon: Sparkles,
              },
            ].map((f, idx) => {
              const Icon = f.icon;
              const span = idx < 2 ? 'lg:col-span-6' : 'lg:col-span-6';
              return (
                <div
                  key={f.title}
                  className={[
                    span,
                    'relative overflow-hidden rounded-[28px] border border-gray-200 bg-white p-8 shadow-[0_24px_70px_rgba(2,10,23,0.07)]',
                  ].join(' ')}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(900px_460px_at_30%_0%,rgba(0,136,203,0.14),rgba(255,255,255,0))]" />
                  <div className="relative flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold tracking-tight text-gray-950">{f.title}</div>
                      <p className="mt-3 text-base leading-7 text-gray-600">{f.desc}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0088CB]/10 ring-1 ring-[#0088CB]/15">
                      <Icon className="h-5 w-5 text-[#0088CB]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Keep this credibility strip exactly (required) */}
          <div className="mt-14 sm:mt-16">
            <p className="text-center text-sm font-semibold text-gray-700">
              Trusted by top schools, students, and educators
            </p>
            <div className="mt-4">
              <SchoolCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — “Built for students” features (3 across) */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold text-[#0088CB]">Built for education</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
              Built for students. Trusted by families.
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {[
              {
                title: 'Personalized Learning',
                desc: 'Support that adapts to the student—goals, pace, and confidence included.',
                icon: BookOpen,
              },
              {
                title: 'Verified Tutors & Counselors',
                desc: 'Real people, real experience—selected for quality and accountability.',
                icon: ShieldCheck,
              },
              {
                title: 'Secure Sessions + Progress Tracking',
                desc: 'Everything stays organized: sessions, notes, next steps, and momentum.',
                icon: CalendarCheck,
              },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.title}
                  className="relative overflow-hidden rounded-[28px] border border-gray-200 bg-white p-8 shadow-[0_22px_60px_rgba(2,10,23,0.06)]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(900px_460px_at_50%_0%,rgba(0,136,203,0.10),rgba(255,255,255,0))]" />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0088CB]/10 ring-1 ring-[#0088CB]/15">
                        <Icon className="h-5 w-5 text-[#0088CB]" />
                      </div>
                    </div>
                    <div className="mt-6 text-lg font-semibold tracking-tight text-gray-950">{c.title}</div>
                    <p className="mt-3 text-base leading-7 text-gray-600">{c.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 7 — FAQ */}
      <section id="faq" className="scroll-mt-28 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold text-[#0088CB]">FAQ</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
              Answers, without the fluff.
            </h2>
          </div>

          <div className="mx-auto mt-12 max-w-3xl">
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
                  question: 'How are tutors verified?',
                  answer:
                    'We review provider backgrounds and experience before they can offer sessions. Quality and accountability are built into the platform experience.',
                },
                {
                  question: 'Can I book college counseling by school?',
                  answer:
                    'Yes. You can book counseling aligned to your target schools and application strategy, with mentors who have direct, relevant experience.',
                },
                {
                  question: 'Are virtual tours live?',
                  answer:
                    'Yes. Virtual tours are hosted by real students who can show you campus and answer questions with honest, current perspective.',
                },
                {
                  question: 'Do you offer monthly plans?',
                  answer:
                    'Yes. Monthly options are available depending on service type. You can always review what’s included before checkout.',
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* SECTION 8 — FINAL CTA + minimal footer, fading back into IvyWay blue */}
      <section ref={bottomBlueStartRef} className="relative overflow-hidden -mt-px">
        {/* Full-width, seamless white → IvyWay blue transition (no edge patches) */}
        <div
          aria-hidden
          className="absolute left-1/2 top-0 h-full w-screen -translate-x-1/2 bg-[linear-gradient(180deg,#ffffff_0%,#ffffff_22%,#f6fcff_42%,#eef8ff_62%,#e6f5ff_78%,#d9f0ff_92%,#ffffff_100%)]"
        />
        <div
          aria-hidden
          className="absolute left-1/2 -bottom-44 h-[720px] w-screen -translate-x-1/2 bg-[radial-gradient(760px_420px_at_50%_78%,rgba(0,136,203,0.18),rgba(0,136,203,0.00)_70%)]"
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Left: CTA (Cluely-style, left aligned) */}
            <div className="lg:col-span-6">
              <h2 className="text-balance text-3xl font-semibold tracking-tight text-[#06233A] sm:text-5xl leading-[1.04] text-left">
                Education without friction.
                <br />
                Guidance without guesswork.
              </h2>
              <p className="mt-7 text-xl font-medium leading-8 text-[#06233A]/80 text-left">
                Start with IvyWay today.
              </p>
              <div className="mt-10 flex justify-start">
                <Link
                  href={primaryCtaHref}
                  className="inline-flex items-center justify-center rounded-xl bg-[#0088CB] px-7 py-3.5 text-base font-semibold text-white shadow-[0_18px_60px_rgba(0,136,203,0.26)] hover:bg-[#0077B3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088CB]/35 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            </div>

            {/* Right: floating premium UI elements */}
            <div className="lg:col-span-6">
              <div className="relative mx-auto h-[320px] w-full max-w-[520px]">
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(520px_240px_at_55%_60%,rgba(0,136,203,0.14),rgba(255,255,255,0)_72%)] blur-2xl"
                />

                <div
                  className={[
                    'ivyway-finalcta-float ivyway-finalcta-glow-a',
                    'absolute left-6 top-10 sm:left-10',
                    'w-[270px] rounded-[26px] border bg-white/55 backdrop-blur-xl',
                    'shadow-[0_22px_80px_rgba(2,10,23,0.08)]',
                  ].join(' ')}
                >
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-2xl bg-[#0088CB]/10 ring-1 ring-[#0088CB]/15" />
                        <div className="text-sm font-semibold text-[#06233A]">Quick match</div>
                      </div>
                      <div className="rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-[#06233A]/70 ring-1 ring-white/70">
                        Live
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="h-2 w-4/5 rounded-full bg-[#06233A]/10" />
                      <div className="h-2 w-11/12 rounded-full bg-[#06233A]/8" />
                      <div className="h-2 w-2/3 rounded-full bg-[#0088CB]/14" />
                    </div>
                    <div className="mt-5 flex items-center gap-2">
                      <div className="h-8 flex-1 rounded-2xl bg-white/55 ring-1 ring-white/70" />
                      <div className="h-8 w-10 rounded-2xl bg-[#0088CB]/12 ring-1 ring-[#0088CB]/18" />
                    </div>
                  </div>
                </div>

                <div
                  className={[
                    'ivyway-finalcta-float ivyway-finalcta-glow-b',
                    'absolute bottom-8 right-6 sm:right-10',
                    'w-[300px] rounded-[28px] border bg-white/55 backdrop-blur-xl',
                    'shadow-[0_22px_80px_rgba(2,10,23,0.08)]',
                    'animation-delay-[1100ms]',
                  ].join(' ')}
                >
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-[#06233A]">IvyWay AI</div>
                      <div className="h-9 w-9 rounded-2xl bg-white/60 ring-1 ring-white/70" />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="h-14 rounded-2xl bg-white/55 ring-1 ring-white/70" />
                      <div className="h-14 rounded-2xl bg-[#0088CB]/10 ring-1 ring-[#0088CB]/16" />
                      <div className="h-14 rounded-2xl bg-white/50 ring-1 ring-white/70" />
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#0088CB]/50" />
                      <div className="h-2 w-2 rounded-full bg-[#06233A]/15" />
                      <div className="h-2 w-2 rounded-full bg-[#06233A]/10" />
                      <div className="ml-auto rounded-full bg-[#06233A]/5 px-3 py-1 text-xs font-semibold text-[#06233A]/70 ring-1 ring-white/70">
                        Guided
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 border-t border-[#06233A]/10 pt-10">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <div className="text-sm font-semibold text-[#06233A]">IvyWay</div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-[#06233A]/70">
                <Link href="/" className="hover:text-[#06233A] transition-colors">
                  About
                </Link>
                <Link href="/pricing" className="hover:text-[#06233A] transition-colors">
                  Pricing
                </Link>
                <a href="mailto:support@ivyway.com" className="hover:text-[#06233A] transition-colors">
                  Support
                </a>
                <Link href="/terms" className="hover:text-[#06233A] transition-colors">
                  Legal
                </Link>
              </div>
            </div>
            <div className="mt-8 text-center text-xs text-[#06233A]/50">
              &copy; {new Date().getFullYear()} IvyWay. All rights reserved.
            </div>
          </div>
        </div>
      </section>

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

