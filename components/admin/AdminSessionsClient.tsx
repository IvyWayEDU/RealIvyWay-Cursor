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

  async function act(sessionId: string, type: 'complete' | 'cancel' | 'flag') {
    setWorkingId(sessionId);
    setError(null);
    try {
      const note =
        type === 'cancel' || type === 'flag'
          ? window.prompt(type === 'cancel' ? 'Cancellation note (optional):' : 'Flag note (optional):') || ''
          : '';

      const path =
        type === 'complete'
          ? '/api/admin/sessions/force-complete'
          : type === 'cancel'
            ? '/api/admin/sessions/cancel'
            : '/api/admin/sessions/flag';

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

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">All sessions</div>
          <div className="text-sm text-gray-500">{filtered.length} shown</div>
        </div>
        <div className="overflow-x-auto">
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
              {filtered.map((s) => {
                const busy = workingId === s.id;
                const status = String(s.status || 'unknown');
                const subject = typeof s.subject === 'string' && s.subject.trim() ? s.subject.trim() : '—';
                const topic = typeof s.topic === 'string' && s.topic.trim() ? s.topic.trim() : '—';
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
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800">
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
                          onClick={() => act(s.id, 'complete')}
                          disabled={busy || status === 'cancelled' || status === 'refunded'}
                          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          Force completed
                        </button>
                        <button
                          type="button"
                          onClick={() => act(s.id, 'cancel')}
                          disabled={busy || status === 'cancelled'}
                          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => act(s.id, 'flag')}
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

              {filtered.length === 0 && (
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
    </div>
  );
}


