'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { logout } from '@/lib/auth/actions';
import { Session } from '@/lib/auth/types';
import { getDashboardRoute } from '@/lib/auth/utils';

export default function NavigationClient() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showServicesDropdown, setShowServicesDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check for session cookie on client side
    const checkSession = () => {
      try {
        const cookies = document.cookie.split(';');
        const sessionCookie = cookies.find(cookie => 
          cookie.trim().startsWith('ivyway_session=')
        );
        
        if (sessionCookie) {
          const sessionValue = sessionCookie.split('=')[1];
          // Cookie values may be URL encoded, decode if necessary
          try {
            const decodedValue = decodeURIComponent(sessionValue);
            const parsedSession = JSON.parse(decodedValue);
            setSession(parsedSession);
          } catch {
            // Try without decoding if already decoded
            const parsedSession = JSON.parse(sessionValue);
            setSession(parsedSession);
          }
        }
      } catch (error) {
        // Invalid session, ignore
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
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

  const scrollToSection = (sectionId: string) => {
    setShowServicesDropdown(false);
    // If not on home page, navigate to home first
    if (window.location.pathname !== '/') {
      router.push(`/#${sectionId}`);
      // After navigation, scroll will happen automatically via hash
      return;
    }
    // Otherwise, scroll to section smoothly
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-32 items-center justify-between">
          <div className="flex items-center">
            <Link href={session ? getDashboardRoute(session.roles) : "/"} className="flex items-center">
              <Image
                src="/logo/ivyway-logo.png"
                alt="IvyWay"
                width={320}
                height={115}
                className="h-[92px] md:h-[115px] w-auto"
                priority
              />
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link
                href="/"
                className="rounded-md px-3 py-2 text-sm font-medium text-black hover:bg-gray-100"
              >
                Home
              </Link>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowServicesDropdown(!showServicesDropdown)}
                  onMouseEnter={() => setShowServicesDropdown(true)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-black hover:bg-gray-100"
                >
                  Services
                </button>
                {showServicesDropdown && (
                  <div
                    className="absolute left-0 mt-1 w-48 z-[60]"
                    onMouseLeave={() => setShowServicesDropdown(false)}
                  >
                    <div className="bg-gray-50 rounded-lg py-2 space-y-1 shadow-lg">
                      <button
                        onClick={() => scrollToSection('academic-tutoring')}
                        className="block w-full text-left px-4 py-2 text-sm text-black hover:text-[#0088CB] hover:underline transition-colors"
                      >
                        Tutoring
                      </button>
                      <button
                        onClick={() => scrollToSection('counseling-services')}
                        className="block w-full text-left px-4 py-2 text-sm text-black hover:text-[#0088CB] hover:underline transition-colors"
                      >
                        College
                      </button>
                      <button
                        onClick={() => scrollToSection('ivyway-ai')}
                        className="block w-full text-left px-4 py-2 text-sm text-black hover:text-[#0088CB] hover:underline transition-colors"
                      >
                        IvyWay AI
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <Link
                href="#pricing"
                className="rounded-md px-3 py-2 text-sm font-medium text-black hover:bg-gray-100"
              >
                Pricing
              </Link>
              <Link
                href="#faq"
                className="rounded-md px-3 py-2 text-sm font-medium text-black hover:bg-gray-100"
              >
                FAQ
              </Link>
              <Link
                href="#contact"
                className="rounded-md px-3 py-2 text-sm font-medium text-black hover:bg-gray-100"
              >
                Contact
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
            ) : session ? (
              <>
                {dashboardLink && (
                  <Link
                    href={dashboardLink}
                    className="rounded-md px-3 py-2 text-sm font-medium text-black hover:bg-gray-100"
                  >
                    Dashboard
                  </Link>
                )}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">{session.name}</span>
                  <button
                    onClick={handleLogout}
                    className="rounded-md px-3 py-2 text-sm font-medium text-black hover:bg-gray-100"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="rounded-md px-3 py-2 text-sm font-medium text-black hover:bg-gray-100"
                >
                  Log in
                </Link>
                <button
                  onClick={() => {
                    window.location.href = "/#create-account";
                  }}
                  className="rounded-md bg-[#0088CB] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077B3]"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#0088CB]"
              aria-expanded="false"
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
      {/* Mobile menu */}
      {showMobileMenu && (
        <div className="md:hidden border-t border-gray-200">
          <div className="space-y-1 px-2 pb-3 pt-2">
            <Link
              href="/"
              onClick={() => setShowMobileMenu(false)}
              className="block rounded-md px-3 py-2 text-base font-medium text-black hover:bg-gray-100"
            >
              Home
            </Link>
            <button
              onClick={() => {
                scrollToSection('academic-tutoring');
                setShowMobileMenu(false);
              }}
              className="block w-full text-left rounded-md px-3 py-2 text-base font-medium text-black hover:bg-gray-100"
            >
              Tutoring
            </button>
            <button
              onClick={() => {
                scrollToSection('counseling-services');
                setShowMobileMenu(false);
              }}
              className="block w-full text-left rounded-md px-3 py-2 text-base font-medium text-black hover:bg-gray-100"
            >
              College
            </button>
            <button
              onClick={() => {
                scrollToSection('ivyway-ai');
                setShowMobileMenu(false);
              }}
              className="block w-full text-left rounded-md px-3 py-2 text-base font-medium text-black hover:bg-gray-100"
            >
              IvyWay AI
            </button>
            <Link
              href="#pricing"
              onClick={() => setShowMobileMenu(false)}
              className="block rounded-md px-3 py-2 text-base font-medium text-black hover:bg-gray-100"
            >
              Pricing
            </Link>
            <Link
              href="#faq"
              onClick={() => setShowMobileMenu(false)}
              className="block rounded-md px-3 py-2 text-base font-medium text-black hover:bg-gray-100"
            >
              FAQ
            </Link>
            <Link
              href="#contact"
              onClick={() => setShowMobileMenu(false)}
              className="block rounded-md px-3 py-2 text-base font-medium text-black hover:bg-gray-100"
            >
              Contact
            </Link>
            {!session && (
              <>
                <Link
                  href="/auth/login"
                  onClick={() => setShowMobileMenu(false)}
                  className="block rounded-md px-3 py-2 text-base font-medium text-black hover:bg-gray-100"
                >
                  Log In
                </Link>
                <button
                  onClick={() => {
                    window.location.href = "/#create-account";
                    setShowMobileMenu(false);
                  }}
                  className="block w-full text-left rounded-md bg-[#0088CB] px-3 py-2 text-base font-medium text-white hover:bg-[#0077B3]"
                >
                  Sign up
                </button>
              </>
            )}
            {session && (
              <>
                {dashboardLink && (
                  <Link
                    href={dashboardLink}
                    onClick={() => setShowMobileMenu(false)}
                    className="block rounded-md px-3 py-2 text-base font-medium text-black hover:bg-gray-100"
                  >
                    Dashboard
                  </Link>
                )}
                <div className="border-t border-gray-200 pt-2">
                  <div className="px-3 py-2 text-sm text-gray-700">{session.name}</div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setShowMobileMenu(false);
                    }}
                    className="block w-full text-left rounded-md px-3 py-2 text-base font-medium text-black hover:bg-gray-100"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

