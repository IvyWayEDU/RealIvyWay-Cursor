'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { logout } from '@/lib/auth/actions';
import { Session } from '@/lib/auth/types';
import { getDashboardRoute } from '@/lib/auth/utils';
import { usePathname } from 'next/navigation';

export default function NavigationClient() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showServicesDropdown, setShowServicesDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      } finally {
        if (cancelled) return;
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowServicesDropdown(false);
      }
    };

    if (showServicesDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showServicesDropdown]);

  useEffect(() => {
    setShowMobileMenu(false);
    setShowServicesDropdown(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!showMobileMenu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showMobileMenu]);

  async function handleLogout() {
    await logout();
    setSession(null);
    router.push('/auth/login');
    router.refresh();
  }

  const getDashboardLink = () => {
    if (!session) return null;
    return getDashboardRoute(session.roles);
  };

  const dashboardLink = getDashboardLink();

  const navItemClass =
    'inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-gray-900 ' +
    'transition-all duration-200 ease-out ' +
    'hover:bg-gray-100/75 hover:ring-1 hover:ring-white/80 hover:shadow-[0_10px_24px_rgba(2,10,23,0.06)] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088CB]/35';

  return (
    <nav className="border-b border-gray-200 bg-[linear-gradient(180deg,#0088CB_0px,#0088CB_10px,#ffffff_10px,#ffffff_100%)] shadow-[0_10px_26px_rgba(2,10,23,0.06)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 sm:h-20 items-center justify-between">
          <div className="flex items-center">
            <Link href={session ? getDashboardRoute(session.roles) : "/"} className="flex items-center pl-2 sm:pl-3">
              <Image
                src="/logo/ivyway-logo.png"
                alt="IvyWay"
                width={260}
                height={94}
                className="h-12 sm:h-14 md:h-16 lg:h-[72px] w-auto"
                priority
              />
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link
                href="/"
                className={navItemClass}
              >
                Home
              </Link>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowServicesDropdown(!showServicesDropdown)}
                  onMouseEnter={() => setShowServicesDropdown(true)}
                  className={navItemClass}
                >
                  Services
                </button>
                {showServicesDropdown && (
                  <div
                    className="absolute left-0 mt-1 w-48 z-[60]"
                    onMouseLeave={() => setShowServicesDropdown(false)}
                  >
                    <div className="rounded-2xl border border-gray-200 bg-white/90 py-2 shadow-[0_18px_60px_rgba(2,10,23,0.16)] ring-1 ring-white/60 backdrop-blur-xl">
                      <button
                        onClick={() => {
                          setShowServicesDropdown(false);
                          router.push('/#pricing');
                        }}
                        className="block w-full text-left rounded-xl px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100/70 hover:ring-1 hover:ring-white/70 hover:text-[#0088CB] transition-all"
                      >
                        Tutoring
                      </button>
                      <button
                        onClick={() => {
                          setShowServicesDropdown(false);
                          router.push('/#pricing');
                        }}
                        className="block w-full text-left rounded-xl px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100/70 hover:ring-1 hover:ring-white/70 hover:text-[#0088CB] transition-all"
                      >
                        College
                      </button>
                      <button
                        onClick={() => {
                          setShowServicesDropdown(false);
                          router.push('/#ivyway-ai');
                        }}
                        className="block w-full text-left rounded-xl px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100/70 hover:ring-1 hover:ring-white/70 hover:text-[#0088CB] transition-all"
                      >
                        IvyWay AI
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <Link
                href="/#pricing"
                className={navItemClass}
              >
                Pricing
              </Link>
              <Link
                href="/#faq"
                className={navItemClass}
              >
                FAQ
              </Link>
              <a
                href="mailto:contact@ivywayedu.com"
                className={navItemClass}
              >
                Contact
              </a>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
            ) : session ? (
              <>
                {dashboardLink && (
                  <Link
                    href={dashboardLink}
                    className={navItemClass}
                  >
                    Dashboard
                  </Link>
                )}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">{session.name}</span>
                  <button
                    onClick={handleLogout}
                    className={navItemClass}
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className={navItemClass}
                >
                  Log in
                </Link>
                <button
                  onClick={() => {
                    window.location.href = "/#create-account";
                  }}
                  data-ga-event="sign_up_start"
                  data-ga-label="nav_signup"
                  className="rounded-xl bg-[#0088CB] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_44px_rgba(0,136,203,0.26)] hover:bg-[#0077B3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088CB]/35 transition-colors"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0088CB]/40"
              aria-expanded={showMobileMenu}
              aria-controls="mobile-menu"
            >
              <span className="sr-only">Open main menu</span>
              {!showMobileMenu ? (
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
          </div>
        </div>
      </div>
      {/* Mobile menu (drawer) */}
      {showMobileMenu ? (
        <div className="md:hidden fixed inset-0 z-[70]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowMobileMenu(false)} />
          <div
            id="mobile-menu"
            className="absolute inset-y-0 right-0 w-[min(22rem,92vw)] bg-white shadow-xl border-l border-gray-200 flex flex-col"
          >
            <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Menu</div>
              <button
                type="button"
                onClick={() => setShowMobileMenu(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0088CB]/40"
                aria-label="Close menu"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              <Link
                href="/"
                onClick={() => setShowMobileMenu(false)}
                className="block rounded-md px-3 py-3 text-base font-semibold text-gray-900 hover:bg-gray-50"
              >
                Home
              </Link>
              <Link
                href="/#pricing"
                onClick={() => setShowMobileMenu(false)}
                className="block rounded-md px-3 py-3 text-base font-semibold text-gray-900 hover:bg-gray-50"
              >
                Pricing
              </Link>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  router.push('/#pricing');
                }}
                className="block w-full text-left rounded-md px-3 py-3 text-base font-semibold text-gray-900 hover:bg-gray-50"
              >
                Tutoring
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  router.push('/#pricing');
                }}
                className="block w-full text-left rounded-md px-3 py-3 text-base font-semibold text-gray-900 hover:bg-gray-50"
              >
                College
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  router.push('/#ivyway-ai');
                }}
                className="block w-full text-left rounded-md px-3 py-3 text-base font-semibold text-gray-900 hover:bg-gray-50"
              >
                IvyWay AI
              </button>
              <Link
                href="/#faq"
                onClick={() => setShowMobileMenu(false)}
                className="block rounded-md px-3 py-3 text-base font-semibold text-gray-900 hover:bg-gray-50"
              >
                FAQ
              </Link>
              <a
                href="mailto:contact@ivywayedu.com"
                onClick={() => setShowMobileMenu(false)}
                className="block rounded-md px-3 py-3 text-base font-semibold text-gray-900 hover:bg-gray-50"
              >
                Contact
              </a>

              <div className="pt-2">
                {!isLoading && !session ? (
                  <div className="space-y-2">
                    <Link
                      href="/auth/login"
                      onClick={() => setShowMobileMenu(false)}
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-3 text-center text-base font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Log in
                    </Link>
                    <button
                      onClick={() => {
                        window.location.href = "/#create-account";
                        setShowMobileMenu(false);
                      }}
                      className="block w-full rounded-md bg-[#0088CB] px-3 py-3 text-center text-base font-semibold text-white hover:bg-[#0077B3]"
                    >
                      Sign up
                    </button>
                  </div>
                ) : null}

                {!isLoading && session ? (
                  <div className="space-y-2">
                    {dashboardLink ? (
                      <Link
                        href={dashboardLink}
                        onClick={() => setShowMobileMenu(false)}
                        className="block w-full rounded-md bg-gray-900 px-3 py-3 text-center text-base font-semibold text-white hover:bg-gray-800"
                      >
                        Go to Dashboard
                      </Link>
                    ) : null}
                    <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      Signed in as <span className="font-semibold text-gray-900">{session.name}</span>
                    </div>
                    <button
                      onClick={() => {
                        void handleLogout();
                        setShowMobileMenu(false);
                      }}
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-3 text-center text-base font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

