'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { logout } from '@/lib/auth/actions';
import { getDashboardRoute, getDisplayRole } from '@/lib/auth/utils';
import { Session, UserRole } from '@/lib/auth/types';

export default function NavigationClient() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showServicesDropdown, setShowServicesDropdown] = useState(false);
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
    const userRole = getDisplayRole(session.roles);
    return getDashboardRoute(session.roles);
  };

  const dashboardLink = getDashboardLink();

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-28 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo/ivyway-logo.png"
                alt="IvyWay"
                width={256}
                height={92}
                className="h-[92px] w-auto"
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
        </div>
      </div>
    </nav>
  );
}

