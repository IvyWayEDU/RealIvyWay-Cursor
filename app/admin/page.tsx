import Link from 'next/link';
import { getAdminOverviewStats } from '@/lib/admin/overview.server';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

export default async function AdminPage() {
  const stats = await getAdminOverviewStats();

  const cards = [
    { label: 'Total users', value: stats.totalUsers },
    { label: 'Total students', value: stats.totalStudents },
    { label: 'Total providers', value: stats.totalProviders },
    { label: 'Total sessions', value: stats.totalSessions },
    { label: 'Upcoming sessions', value: stats.upcomingSessions },
    { label: 'Completed sessions', value: stats.completedSessions },
    { label: 'Total platform revenue', value: formatMoney(stats.totalPlatformRevenueCents) },
    { label: 'Total provider payouts', value: formatMoney(stats.totalProviderPayoutsCents) },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Overview</h1>
          <p className="mt-2 text-sm text-gray-600">Platform health and administrative controls.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/users"
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Manage users
          </Link>
          <Link
            href="/admin/sessions"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Manage sessions
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{String(c.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


