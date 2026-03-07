'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Session } from '@/lib/auth/types';

interface DashboardHeaderProps {
  session: Session;
}

function getPageTitle(pathname: string): string {
  // Handle role-based dashboard routes
  if (pathname === '/dashboard/student' || pathname === '/dashboard/provider' || pathname === '/dashboard/admin') {
    return 'Dashboard';
  }

  // Handle specific routes
  const routeMap: Record<string, string> = {
    '/dashboard/book': 'Book Session',
    '/dashboard/sessions': 'Sessions',
    '/dashboard/messages': 'Messages',
    '/dashboard/ai': 'IvyWay AI',
    '/dashboard/availability': 'Availability',
    '/dashboard/earnings': 'Earnings',
    '/dashboard/profile': 'Profile',
    '/dashboard/support': 'Support',
    '/dashboard/admin/support-inbox': 'Support Inbox',
  };

  // Check exact match first
  if (routeMap[pathname]) {
    return routeMap[pathname];
  }

  // Handle sub-routes (e.g., /dashboard/book/...)
  for (const [route, title] of Object.entries(routeMap)) {
    if (pathname.startsWith(route + '/')) {
      return title;
    }
  }

  // Default fallback
  return 'Dashboard';
}

export default function DashboardHeader({ session }: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = getPageTitle(pathname);
  const [isDevClearing, setIsDevClearing] = useState(false);

  const showDevClearAllSessions =
    process.env.NODE_ENV === 'development' && (pathname || '').startsWith('/dashboard/provider');

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
      </div>
      
      <div className="flex items-center gap-4">
        {showDevClearAllSessions && (
          <button
            type="button"
            disabled={isDevClearing}
            onClick={async () => {
              if (!confirm('Dev: Clear ALL sessions? This will delete upcoming + completed sessions and join tracking.')) {
                return;
              }
              try {
                setIsDevClearing(true);
                await fetch('/api/dev/clear-sessions', { method: 'POST' });
              } finally {
                setIsDevClearing(false);
                router.push('/dashboard');
                router.refresh();
              }
            }}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDevClearing ? 'Clearing…' : 'Dev: Clear All Sessions'}
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{session.name}</p>
            <p className="text-xs text-gray-500">{session.email}</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-[#0088CB] flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {session.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

