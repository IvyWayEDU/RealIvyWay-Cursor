'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

import Sidebar from './Sidebar';
import DashboardHeader from './DashboardHeader';
import SupportChatWidget from './SupportChatWidget';
import { Session } from '@/lib/auth/types';

type Role = 'student' | 'provider' | 'admin';

function getRoleFromPath(pathname: string): Role {
  if (pathname.startsWith('/dashboard/student')) return 'student';
  if (pathname.startsWith('/dashboard/provider')) return 'provider';
  if (pathname.startsWith('/dashboard/admin')) return 'admin';
  return 'student';
}

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  session: Session;
  userRole: Role;
}

export default function DashboardLayoutClient({
  children,
  session,
  userRole,
}: DashboardLayoutClientProps) {
  const pathname = usePathname() || '';
  const roleFromPath = getRoleFromPath(pathname);

  const isCheckoutPage =
    pathname === '/dashboard/book/summary' ||
    pathname.startsWith('/dashboard/book/summary');

  if (isCheckoutPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="min-h-screen overflow-visible">{children}</main>
      </div>
    );
  }

  if (isCheckoutPage) {
    return (
      <div className="bg-gray-100">
        <main className="p-8">
          {children}
        </main>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar role={userRole} session={session} />
      <div className="flex-1 flex flex-col">
        <DashboardHeader session={session} />
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );  
}
