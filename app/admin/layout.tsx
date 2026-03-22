import { getAuthContext } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import AdminLogoutButton from '@/components/admin/AdminLogoutButton';
import Link from 'next/link';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get pathname from middleware header
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  const isLoginPage = pathname === '/admin/login' || pathname.startsWith('/admin/login/');
  
  // Skip auth checks for login page (middleware already handles it)
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Verify session exists (middleware already checks, but double-check for safety)
  const auth = await getAuthContext();

  if (auth.status === 'suspended') {
    redirect('/admin/login?error=suspended');
  }

  if (auth.status !== 'ok') {
    redirect('/admin/login');
  }

  const session = auth.session;

  // SECURITY: Only allow admin users
  // Canonical admin check via session.user.role
  if (session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const nav = [
    { name: 'Dashboard', href: '/admin' },
    { name: 'Statistics', href: '/admin/statistics' },
    { name: 'Reconciliation', href: '/admin/analytics/reconciliation' },
    { name: 'Users', href: '/admin/users' },
    { name: 'Sessions', href: '/admin/sessions' },
    { name: 'Support', href: '/admin/support' },
    { name: 'Earnings', href: '/admin/earnings' },
    { name: 'Payouts', href: '/admin/payouts' },
    { name: 'Payout Investigation', href: '/admin/payout-investigation' },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-gray-200 bg-white">
        <div className="h-16 px-6 border-b border-gray-200 flex items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              A
            </div>
            <div className="font-semibold text-gray-900">Admin</div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => {
            const active =
              pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50',
                ].join(' ')}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
      <header className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <Link href="/admin" className="text-sm font-semibold text-gray-900">
                  Admin
                </Link>
              </div>
              <div className="text-sm text-gray-500 hidden md:block">
                Signed in as <span className="text-gray-900 font-medium">{session.email}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{session.name}</span>
              <AdminLogoutButton />
            </div>
          </div>
        </div>
      </header>
      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
      </div>
    </div>
  );
}

