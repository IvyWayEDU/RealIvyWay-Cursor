'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type SessionRow = {
  id: string;
  studentName?: string;
  studentId?: string;
  providerName?: string;
  providerId?: string;
  serviceType?: string;
  serviceTypeId?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  status?: string;
  zoomMeetingId?: string;
  [key: string]: any;
};

async function post(path: string, body: any) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function getSessionEndMs(s: SessionRow): number {
  const t = new Date(s?.scheduledEndTime || s?.endTime || s?.scheduledEnd || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function getSessionStartMs(s: SessionRow): number {
  const t = new Date(s?.scheduledStartTime || s?.startTime || s?.scheduledStart || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function normalizeStatus(status: unknown): string {
  return String(status || '').trim().toLowerCase();
}

function isPriorityReviewSession(s: SessionRow): boolean {
  const st = normalizeStatus(s.status);

  if (
    st === 'provider_no_show' ||
    st === 'expired_provider_no_show' ||
    st === 'no_show_provider' ||
    st === 'completed_no_show_provider' ||
    st === 'requires_review' ||
    st === 'admin_review' ||
    st === 'flagged'
  ) {
    return true;
  }

  // Heuristic catch-all for review-required / no-show / flagged variants.
  if (st.includes('review') || st.includes('flag') || st.includes('no_show') || st.includes('no-show')) return true;

  // Some records carry canonical attendance markers separate from status.
  if ((s as any)?.flagNoShowProvider === true) return true;
  if (normalizeStatus((s as any)?.attendanceFlag) === 'provider_no_show') return true;
  if (normalizeStatus((s as any)?.flag) === 'provider_no_show') return true;

  return false;
}

function getPriorityRank(s: SessionRow): number {
  const st = normalizeStatus(s.status);
  const providerNoShow =
    st === 'provider_no_show' ||
    st === 'expired_provider_no_show' ||
    st === 'no_show_provider' ||
    st === 'completed_no_show_provider' ||
    (s as any)?.flagNoShowProvider === true ||
    normalizeStatus((s as any)?.attendanceFlag) === 'provider_no_show' ||
    normalizeStatus((s as any)?.flag) === 'provider_no_show';

  if (providerNoShow) return 0;
  if (st === 'requires_review' || st === 'admin_review') return 1;
  if (st === 'flagged') return 2;
  return 3;
}

function getStatusBadgeClass(status: string, priority: boolean): string {
  const st = normalizeStatus(status);
  if (st === 'provider_no_show' || st === 'expired_provider_no_show' || st === 'no_show_provider' || st === 'completed_no_show_provider') {
    return 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200';
  }
  if (st === 'requires_review' || st === 'admin_review') {
    return 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200';
  }
  if (st === 'flagged') {
    return 'bg-yellow-50 text-yellow-900 ring-1 ring-inset ring-yellow-200';
  }
  if (priority) {
    return 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200';
  }
  return 'bg-gray-100 text-gray-800';
}

function SessionsTable(props: {
  title: string;
  subtitleRight?: string;
  sessions: SessionRow[];
  workingId: string | null;
  onCancel: (id: string) => void;
  onFlag: (id: string) => void;
  emphasis?: 'none' | 'priority';
}) {
  const { title, subtitleRight, sessions, workingId, onCancel, onFlag, emphasis = 'none' } = props;
  const priority = emphasis === 'priority';

  return (
    <div
      className={[
        'overflow-hidden rounded-lg bg-white shadow-sm ring-1',
        priority ? 'ring-amber-200' : 'ring-gray-200',
      ].join(' ')}
    >
      <div
        className={[
          'px-4 py-3 border-b flex items-center justify-between',
          priority ? 'border-amber-200 bg-amber-50/60' : 'border-gray-200',
        ].join(' ')}
      >
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-sm text-gray-500">{subtitleRight || `${sessions.length} shown`}</div>
      </div>
      {/* Mobile: cards */}
      <div className="sm:hidden divide-y divide-gray-200 bg-white">
        {sessions.map((s) => {
          const busy = workingId === s.id;
          const status = String(s.status || 'unknown');
          const subject = typeof s.subject === 'string' && s.subject.trim() ? s.subject.trim() : null;
          const topic = typeof s.topic === 'string' && s.topic.trim() ? s.topic.trim() : null;
          const isPriority = isPriorityReviewSession(s);
          const dateLine = s.scheduledStartTime || '—';
          const timeLine = s.scheduledEndTime || '';
          return (
            <div key={s.id} className={['px-4 py-4', busy ? 'opacity-70' : ''].join(' ')}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 break-words">
                    {s.studentName || s.studentId || '—'} <span className="text-gray-400">→</span>{' '}
                    {s.providerName || s.providerId || '—'}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {s.serviceType || s.serviceTypeId || '—'}
                    {subject ? <span className="text-gray-400">{' · '}</span> : null}
                    {subject ? subject : null}
                    {topic ? <span className="text-gray-400">{' · '}</span> : null}
                    {topic ? topic : null}
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    <div className="text-gray-900">{dateLine}</div>
                    {timeLine ? <div className="text-gray-500">{timeLine}</div> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                        getStatusBadgeClass(status, isPriority),
                      ].join(' ')}
                    >
                      {status}
                    </span>
                    {s.zoomMeetingId ? (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                        Zoom: {s.zoomMeetingId}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Link
                  href={`/admin/sessions/${encodeURIComponent(s.id)}`}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => onCancel(s.id)}
                  disabled={busy || normalizeStatus(status) === 'cancelled'}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onFlag(s.id)}
                  disabled={busy}
                  className="inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Flag
                </button>
              </div>
            </div>
          );
        })}

        {sessions.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-600">No sessions found.</div>
        ) : null}
      </div>

      {/* Desktop/tablet: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Student</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Provider</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Service</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Topic</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date/time</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Zoom meeting ID</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sessions.map((s) => {
              const busy = workingId === s.id;
              const status = String(s.status || 'unknown');
              const subject = typeof s.subject === 'string' && s.subject.trim() ? s.subject.trim() : '—';
              const topic = typeof s.topic === 'string' && s.topic.trim() ? s.topic.trim() : '—';
              const isPriority = isPriorityReviewSession(s);

              return (
                <tr key={s.id} className={busy ? 'opacity-70' : ''}>
                  <td className="px-4 py-3 text-sm text-gray-900">{s.studentName || s.studentId || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{s.providerName || s.providerId || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.serviceType || s.serviceTypeId || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{subject}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{topic}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="text-xs text-gray-900">{s.scheduledStartTime || '—'}</div>
                    <div className="text-xs text-gray-500">{s.scheduledEndTime || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <span
                      className={[
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                        getStatusBadgeClass(status, isPriority),
                      ].join(' ')}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.zoomMeetingId || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/sessions/${encodeURIComponent(s.id)}`}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => onCancel(s.id)}
                        disabled={busy || normalizeStatus(status) === 'cancelled'}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => onFlag(s.id)}
                        disabled={busy}
                        className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Flag
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {sessions.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-600">
                  No sessions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminSessionsClient(props: { initialSessions: SessionRow[] }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>(props.initialSessions || []);
  const [query, setQuery] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const hay = [
        s.id,
        s.studentName,
        s.studentId,
        s.providerName,
        s.providerId,
        s.serviceType,
        s.serviceTypeId,
        s.subject,
        s.topic,
        s.status,
        s.zoomMeetingId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, query]);

  const prioritySessions = useMemo(() => {
    const list = filtered.filter(isPriorityReviewSession);
    return [...list].sort((a, b) => {
      const r = getPriorityRank(a) - getPriorityRank(b);
      if (r !== 0) return r;
      const bEnd = getSessionEndMs(b);
      const aEnd = getSessionEndMs(a);
      if (bEnd !== aEnd) return bEnd - aEnd;
      const bStart = getSessionStartMs(b);
      const aStart = getSessionStartMs(a);
      if (bStart !== aStart) return bStart - aStart;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [filtered]);

  const normalSessions = useMemo(() => filtered.filter((s) => !isPriorityReviewSession(s)), [filtered]);

  async function act(sessionId: string, type: 'cancel' | 'flag') {
    setWorkingId(sessionId);
    setError(null);
    try {
      const note =
        window.prompt(type === 'cancel' ? 'Cancellation note (optional):' : 'Flag note (optional):') || '';

      const path =
        type === 'cancel' ? '/api/admin/sessions/cancel' : '/api/admin/sessions/flag';

      const data = await post(path, { sessionId, note });
      if (data?.session) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? data.session : s)));
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sessions</h1>
          <p className="mt-2 text-sm text-gray-600">Admin session control and auditing.</p>
        </div>
        <div className="w-full max-w-sm">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by user, status, zoom id, or session id…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <SessionsTable
        title={`Priority Review (${prioritySessions.length} session${prioritySessions.length === 1 ? '' : 's'})`}
        subtitleRight={prioritySessions.length === 0 ? '0 shown' : `${prioritySessions.length} shown`}
        sessions={prioritySessions}
        workingId={workingId}
        onCancel={(id) => act(id, 'cancel')}
        onFlag={(id) => act(id, 'flag')}
        emphasis="priority"
      />

      <SessionsTable
        title="All Sessions"
        subtitleRight={`${normalSessions.length} shown`}
        sessions={normalSessions}
        workingId={workingId}
        onCancel={(id) => act(id, 'cancel')}
        onFlag={(id) => act(id, 'flag')}
      />
    </div>
  );
}


