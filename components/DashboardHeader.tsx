'use client';

import { usePathname } from 'next/navigation';
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
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
      </div>
      
      <div className="flex items-center gap-4">
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
