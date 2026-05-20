'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';

import { getDashboardRoute } from '@/lib/auth/utils';
import type { Session } from '@/lib/auth/types';

export default function LandingHeroHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session', { method: 'GET', cache: 'no-store' });
        const json = (await res.json().catch(() => null)) as any;
        if (cancelled) return;
        setSession((json?.session as Session) || null);
      } catch {
        if (cancelled) return;
        setSession(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const dashboardLink = session ? getDashboardRoute(session.roles) : null;
  const primaryCtaHref = dashboardLink ?? '/auth/register';
  const primaryCtaLabel = dashboardLink ? 'Go to Dashboard' : 'Get Started';

  const heroNavItemClass =
    'inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white/90 ' +
    'transition-all duration-200 ease-out ' +
    'hover:bg-white/10 hover:ring-1 hover:ring-white/25 hover:backdrop-blur-xl hover:text-white ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40';

  const goToLandingSection = (id: 'ivyway-ai' | 'pricing' | 'faq') => {
    setShowMenu(false);

    if (pathname === '/') {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    router.push(`/#${id}`);
  };

  return (
    <section className="relative pt-[calc(env(safe-area-inset-top)+20px)] sm:pt-[calc(env(safe-area-inset-top)+24px)]">
      {/* Premium hero-style blue background (scoped to this header only) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Keep the header area distinctly blue; fade-to-white handled by the bottom overlay. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#052a48_0%,#063a63_18%,#074c7b_44%,#0b5f96_78%,#0b5f96_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,rgba(5,42,72,0.30)_0%,rgba(5,42,72,0.14)_35%,rgba(11,95,150,0.00)_100%)]" />
        <div className="absolute -top-56 left-1/2 h-[820px] w-[820px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -top-44 right-[-260px] h-[720px] w-[720px] rounded-full bg-[#0088CB]/18 blur-3xl" />
        <div className="absolute top-24 left-[-260px] h-[640px] w-[640px] rounded-full bg-[#5bbcff]/12 blur-3xl" />
      </div>

      {/* Corner softeners (match landing header feel) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-[radial-gradient(520px_240px_at_0%_0%,rgba(0,136,203,0.26),rgba(0,136,203,0)_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-[radial-gradient(520px_240px_at_100%_0%,rgba(0,136,203,0.26),rgba(0,136,203,0)_72%)]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
              <nav className="flex items-center justify-center gap-2 lg:gap-3">
                <button
                  onClick={() => goToLandingSection('ivyway-ai')}
                  data-ga-event="nav_click"
                  data-ga-label="header_nav_ivyway_ai"
                  className={heroNavItemClass}
                >
                  IvyWay AI
                </button>
                <button
                  onClick={() => goToLandingSection('pricing')}
                  data-ga-event="nav_click"
                  data-ga-label="header_nav_pricing"
                  className={heroNavItemClass}
                >
                  Pricing
                </button>
                <button
                  onClick={() => goToLandingSection('faq')}
                  data-ga-event="nav_click"
                  data-ga-label="header_nav_faq"
                  className={heroNavItemClass}
                >
                  FAQ
                </button>
              </nav>
            </div>

            <div className="relative flex items-center gap-3 pr-1 sm:pr-2" ref={menuRef}>
              <Link
                href={primaryCtaHref}
                data-ga-event={dashboardLink ? 'nav_click' : 'get_started_click'}
                data-ga-label={dashboardLink ? 'header_go_to_dashboard' : 'header_get_started'}
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
                      { id: 'ivyway-ai' as const, label: 'IvyWay AI' },
                      { id: 'pricing' as const, label: 'Pricing' },
                      { id: 'faq' as const, label: 'FAQ' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => goToLandingSection(item.id)}
                        className="block w-full text-left rounded-xl px-3 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10 hover:ring-1 hover:ring-white/22 hover:backdrop-blur-xl transition-all"
                      >
                        {item.label}
                      </button>
                    ))}

                    <div className="my-2 border-t border-white/10" />

                    <Link
                      href={primaryCtaHref}
                      onClick={() => setShowMenu(false)}
                      data-ga-event={dashboardLink ? 'nav_click' : 'get_started_click'}
                      data-ga-label={dashboardLink ? 'header_mobile_go_to_dashboard' : 'header_mobile_get_started'}
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
      </div>

      {/* Fade into white below header */}
      <div className="relative h-[150px] sm:h-[170px]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.80)_45%,#ffffff_100%)]" />
    </section>
  );
}

