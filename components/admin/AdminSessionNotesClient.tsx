'use client';

import { useMemo, useState } from 'react';

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

export default function AdminSessionNotesClient(props: {
  sessionId: string;
  initialNotes?: string | null;
}) {
  const sessionId = String(props.sessionId || '').trim();
  const [notes, setNotes] = useState<string>(String(props.initialNotes || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAtIso, setSavedAtIso] = useState<string | null>(null);

  const dirty = useMemo(() => String(notes || '') !== String(props.initialNotes || ''), [notes, props.initialNotes]);

  async function save() {
    if (!sessionId) return;
    setSaving(true);
    setError(null);
    try {
      await post('/api/admin/sessions/notes', { sessionId, adminNotes: notes });
      setSavedAtIso(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save notes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900">Internal admin notes</div>
        <div className="flex items-center gap-2">
          {savedAtIso ? <div className="text-xs text-gray-500">Saved</div> : null}
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={6}
        placeholder="Add internal notes for admin support, disputes, refunds, and payout investigations…"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
      <div className="text-xs text-gray-500">
        Notes are stored on the session record and are visible only to admins.
      </div>
    </div>
  );
}

