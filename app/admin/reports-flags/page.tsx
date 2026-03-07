import { getSessions } from '@/lib/sessions/storage';
import Link from 'next/link';

function isNoShowStatus(status: string): boolean {
  return (
    status === 'no-show' ||
    status === 'no-show_student' ||
    status === 'no-show_provider' ||
    status === 'no_show_student' ||
    status === 'no_show_provider' ||
    status === 'no_show_both' ||
    status === 'student_no_show' ||
    status === 'provider_no_show' ||
    status === 'expired_provider_no_show'
  );
}

export default async function AdminReportsFlagsPage() {
  const sessions = await getSessions();
  const all = sessions as any[];

  const noShows = all.filter((s) => isNoShowStatus(String(s?.status || '')));
  const flagged = all.filter((s) => String(s?.status || '') === 'flagged' || String(s?.status || '') === 'requires_review');

  const recent = [...flagged]
    .sort((a, b) => String(b?.updatedAt || '').localeCompare(String(a?.updatedAt || '')))
    .slice(0, 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports / Flags</h1>
        <p className="mt-2 text-sm text-gray-600">Monitor no-shows, disputes, and flagged sessions.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">No-shows</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{noShows.length}</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">Flagged / requires review</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{flagged.length}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">Recent flagged sessions</div>
          <div className="text-sm text-gray-500">{recent.length}</div>
        </div>
        <div className="divide-y divide-gray-200">
          {recent.map((s) => (
            <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{s.id}</div>
                <div className="mt-1 text-xs text-gray-600">
                  {s.studentName || s.studentId} → {s.providerName || s.providerId}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {s.scheduledStartTime} • {String(s.status || 'unknown')}
                </div>
              </div>
              <Link
                href={`/admin/sessions/${encodeURIComponent(s.id)}`}
                className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                View
              </Link>
            </div>
          ))}
          {recent.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-gray-600">No flagged sessions.</div>
          )}
        </div>
      </div>
    </div>
  );
}


