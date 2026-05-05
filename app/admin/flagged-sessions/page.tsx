import Link from 'next/link';

import { getSessionsReadOnly } from '@/lib/sessions/storage';
import { getUsers } from '@/lib/auth/storage';

function normalize(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

function isProviderNoShow(s: any): boolean {
  const st = normalize(s?.status);
  if (st === 'provider_no_show' || st === 'expired_provider_no_show' || st === 'no_show_provider') return true;
  if (s?.flagNoShowProvider === true) return true;
  if (normalize(s?.attendanceFlag) === 'provider_no_show') return true;
  if (normalize(s?.noShowParty) === 'provider') return true;
  if (normalize(s?.noShowParty) === 'both') return true;
  return false;
}

function isStudentNoShow(s: any): boolean {
  const st = normalize(s?.status);
  if (st === 'student_no_show' || st === 'no_show_student') return true;
  if (s?.flagNoShowStudent === true) return true;
  if (normalize(s?.noShowParty) === 'student') return true;
  return false;
}

function isDisputed(s: any): boolean {
  const st = normalize(s?.status);
  if (st === 'disputed') return true;
  if (typeof s?.disputeId === 'string' && s.disputeId.trim()) return true;
  if (typeof s?.dispute_id === 'string' && s.dispute_id.trim()) return true;
  return false;
}

function isFailedSession(s: any): boolean {
  const zoomStatus = normalize(s?.zoomStatus);
  if (zoomStatus === 'failed') return true;
  if (s?.requiresAdminReview === true) return true;
  const st = normalize(s?.status);
  if (st.includes('review')) return true;
  return false;
}

function isManualReview(s: any): boolean {
  const st = normalize(s?.status);
  if (st === 'flagged' || st === 'requires_review' || st === 'admin_review') return true;
  if (s?.requiresAdminReview === true) return true;
  return false;
}

function sessionSortKeyMs(s: any): number {
  const iso = s?.scheduledStartTime || s?.startTime || s?.datetime || s?.createdAt || '';
  const t = new Date(String(iso)).getTime();
  return Number.isFinite(t) ? t : 0;
}

function RowList(props: { title: string; subtitle: string; rows: any[] }) {
  const rows = props.rows || [];
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
      <div className="px-4 py-4 border-b border-gray-200">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-base font-semibold text-gray-900">{props.title}</div>
            <div className="mt-1 text-sm text-gray-600">{props.subtitle}</div>
          </div>
          <div className="text-sm text-gray-500">{rows.length}</div>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {rows.slice(0, 200).map((s) => (
          <div key={String(s.id)} className="px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{String(s.id || '')}</div>
              <div className="mt-1 text-xs text-gray-600 truncate">
                {String(s.studentName || s.studentId || '—')} → {String(s.providerName || s.providerId || '—')}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {String(s.scheduledStartTime || s.startTime || s.datetime || '—')} • {String(s.status || 'unknown')}
              </div>
            </div>
            <div className="shrink-0">
              <Link
                href={`/admin/sessions/${encodeURIComponent(String(s.id || ''))}`}
                className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Investigate
              </Link>
            </div>
          </div>
        ))}
        {rows.length === 0 ? <div className="px-4 py-10 text-center text-sm text-gray-600">No sessions.</div> : null}
        {rows.length > 200 ? (
          <div className="px-4 py-3 text-xs text-gray-500">Showing first 200 results. Use search on the Sessions page for more.</div>
        ) : null}
      </div>
    </div>
  );
}

export default async function AdminFlaggedSessionsPage() {
  const [sessions, users] = await Promise.all([getSessionsReadOnly(), getUsers()]);
  const raw = Array.isArray(sessions) ? (sessions as any[]) : [];

  const nameById = new Map<string, string>();
  for (const u of (Array.isArray(users) ? (users as any[]) : []) as any[]) {
    const id = typeof u?.id === 'string' ? u.id.trim() : '';
    const name = typeof u?.name === 'string' ? u.name.trim() : '';
    if (id && name) nameById.set(id, name);
  }

  const hydrate = (s: any) => {
    const studentId = typeof s?.studentId === 'string' ? s.studentId.trim() : typeof s?.student_id === 'string' ? s.student_id.trim() : '';
    const providerId = typeof s?.providerId === 'string' ? s.providerId.trim() : typeof s?.provider_id === 'string' ? s.provider_id.trim() : '';
    const studentName = (studentId && nameById.get(studentId)) || s?.studentName || s?.student_name || s?.studentId || s?.student_id;
    const providerName = (providerId && nameById.get(providerId)) || s?.providerName || s?.provider_name || s?.providerId || s?.provider_id;
    return { ...s, studentId, providerId, studentName, providerName };
  };

  const all = raw.map(hydrate);

  const providerNoShows = all.filter(isProviderNoShow).sort((a, b) => sessionSortKeyMs(b) - sessionSortKeyMs(a));
  const studentNoShows = all.filter(isStudentNoShow).sort((a, b) => sessionSortKeyMs(b) - sessionSortKeyMs(a));
  const disputes = all.filter(isDisputed).sort((a, b) => sessionSortKeyMs(b) - sessionSortKeyMs(a));
  const failed = all.filter(isFailedSession).sort((a, b) => sessionSortKeyMs(b) - sessionSortKeyMs(a));
  const manualReview = all.filter(isManualReview).sort((a, b) => sessionSortKeyMs(b) - sessionSortKeyMs(a));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Flagged Sessions</h1>
        <p className="mt-2 text-sm text-gray-600">
          Dedicated operational queue for no-shows, failed sessions, disputes, and manual review. These are intentionally separated from normal sessions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">Provider no-shows</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{providerNoShows.length}</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">Student no-shows</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{studentNoShows.length}</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">Disputes</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{disputes.length}</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">Failed / review</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{failed.length}</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="text-sm text-gray-500">Manual review cases</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{manualReview.length}</div>
        </div>
      </div>

      <RowList title="Provider no-show queue" subtitle="Sessions where provider attendance failed or payout must be withheld." rows={providerNoShows} />
      <RowList title="Student no-show queue" subtitle="Sessions where student missed but provider payout may still apply." rows={studentNoShows} />
      <RowList title="Disputes queue" subtitle="Sessions with an open dispute requiring admin resolution." rows={disputes} />
      <RowList title="Failed sessions / review required" subtitle="Zoom failures, manual review flags, and other operational exceptions." rows={failed} />
      <RowList title="Manual review" subtitle="Explicitly flagged sessions or sessions requiring admin review." rows={manualReview} />
    </div>
  );
}

