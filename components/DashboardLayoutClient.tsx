'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import Sidebar from './Sidebar';
import DashboardHeader from './DashboardHeader';
import { Session } from '@/lib/auth/types';
import SupportWidget from '@/components/support/SupportWidget';
import { getDashboardRoute } from '@/lib/auth/utils';

type Role = 'student' | 'provider' | 'admin';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  session: Session;
  userRole: Role;
  userProfilePhotoUrl?: string | null;
}

export default function DashboardLayoutClient({
  children,
  session,
  userRole,
  userProfilePhotoUrl,
}: DashboardLayoutClientProps) {
  const pathname = usePathname() || '';
  const showSupportWidget = userRole !== 'admin' && !pathname.includes('/dashboard/ai');
  const [isNavOpen, setIsNavOpen] = useState(false);

  const isCheckoutPage =
    pathname === '/dashboard/book/summary' ||
    pathname.startsWith('/dashboard/book/summary');
  const isAiPage = pathname === '/dashboard/ai' || pathname.startsWith('/dashboard/ai/');

  useEffect(() => {
    // Close drawer on navigation.
    setIsNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsNavOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isNavOpen]);

  useEffect(() => {
    // Prevent background scroll while drawer is open.
    if (!isNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isNavOpen]);

  const dashboardHref = getDashboardRoute(session.roles);

  const Drawer = (
    <div
      className={`fixed inset-x-0 bottom-0 top-16 z-40 ${isNavOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!isNavOpen}
    >
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${
          isNavOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => setIsNavOpen(false)}
      />
      <aside
        className={`absolute inset-y-0 left-0 w-72 sm:w-80 bg-white shadow-xl border-r border-gray-200 transform transition-transform duration-300 ease-out ${
          isNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
        aria-label="Navigation"
      >
        <Sidebar role={userRole} session={session} onNavigate={() => setIsNavOpen(false)} />
      </aside>
    </div>
  );

  if (isCheckoutPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="fixed inset-x-0 top-0 z-50 h-16 bg-white border-b border-gray-200">
          <div className="h-full px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsNavOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-gray-100 text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0088CB]/40"
                aria-label="Open menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link href={dashboardHref} className="flex items-center">
                <Image
                  src="/ivyway-wordmark.png"
                  alt="IvyWay"
                  width={120}
                  height={40}
                  className="h-8 w-auto"
                  priority
                />
              </Link>
            </div>
            <DashboardHeader session={session} />
          </div>
        </header>
        {Drawer}
        <main className="min-h-screen overflow-visible pt-16">{children}</main>
        {showSupportWidget && (
          <SupportWidget role={userRole === 'provider' ? 'provider' : 'student'} />
        )}
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="fixed inset-x-0 top-0 z-50 h-16 bg-white border-b border-gray-200">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsNavOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-gray-100 text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0088CB]/40"
              aria-label="Open menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href={dashboardHref} className="flex items-center">
              <Image
                src="/ivyway-wordmark.png"
                alt="IvyWay"
                width={120}
                height={40}
                className="h-8 w-auto"
                priority
              />
            </Link>
          </div>
          <DashboardHeader session={session} />
        </div>
      </header>

      {Drawer}

      <main className="pt-16">
        <div className={isAiPage ? 'p-0' : 'px-4 sm:px-6 lg:px-8 py-6'}>{children}</div>
      </main>
      {showSupportWidget && (
        <SupportWidget role={userRole === 'provider' ? 'provider' : 'student'} />
      )}
    </div>
  );  
}
