'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Session } from '@/lib/auth/types';
import { logout } from '@/lib/auth/actions';

interface SidebarProps {
  role: 'student' | 'provider' | 'admin';
  session: Session;
}

const navigation = {
  student: [
    { name: 'Dashboard', href: '/dashboard/student' },
    // Additional navigation items can be added here when routes are created
    // { name: 'My Courses', href: '/dashboard/student/courses' },
    // { name: 'Resources', href: '/dashboard/student/resources' },
  ],
  provider: [
    { name: 'Dashboard', href: '/dashboard/provider' },
    // Additional navigation items can be added here when routes are created
    // { name: 'Courses', href: '/dashboard/provider/courses' },
    // { name: 'Students', href: '/dashboard/provider/students' },
  ],
  admin: [
    { name: 'Dashboard', href: '/dashboard/admin' },
    // Additional navigation items can be added here when routes are created
    // { name: 'Users', href: '/dashboard/admin/users' },
    // { name: 'Providers', href: '/dashboard/admin/providers' },
    // { name: 'Settings', href: '/dashboard/admin/settings' },
  ],
};

export default function Sidebar({ role, session }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = navigation[role];

  async function handleLogout() {
    await logout();
    router.push('/auth/login');
  }

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center border-b border-gray-800 px-6">
        <Link href="/" className="text-xl font-bold text-white">
          IvyWay
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-800 p-4 space-y-2">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-gray-400">Signed in as</p>
          <p className="text-sm font-medium text-white truncate">{session.name}</p>
          <p className="text-xs text-gray-400 truncate">{session.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white text-left"
        >
          Sign out
        </button>
        <Link
          href="/"
          className="block rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

